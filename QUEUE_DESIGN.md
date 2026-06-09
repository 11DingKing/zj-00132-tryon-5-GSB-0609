# 并发调度模型说明

## 1. Worker 并发调度

### 核心数据结构

```
TaskQueue {
  queue[]            // 等待队列，FIFO
  activeWorkers      // 当前运行中的 worker 计数
  cancelledSet       // 已取消任务 ID 集合（防止被重新拾起）
  abortControllers   // Map<taskId, AbortController>（运行中任务的中止控制器）
}
```

### Worker 取任务流程

```
enqueue(taskId)
  ├─ 检查 cancelledSet，已取消则拒绝入队
  ├─ 去重检查，已在队列则跳过
  ├─ 推入 queue[]
  └─ 调用 _schedule()
        │
        └─ while (activeWorkers < CONCURRENCY && queue.length > 0)
             ├─ 从 queue 头部取出 entry
             ├─ 若 entry.taskId 在 cancelledSet 中，跳过，继续取下一个
             ├─ activeWorkers++
             └─ 启动 _runWorker(taskId).finally(() => { activeWorkers--; _schedule() })
                                                    ↑ 级联调度：worker 结束后自动填补空位
```

**严格并发上限保证**：`activeWorkers` 在 worker 启动前递增、在 `finally` 中递减，while 循环条件保证 `activeWorkers ≤ CONCURRENCY`。

### 配置项（环境变量）

| 环境变量 | 默认值 | 说明 |
|---------|-------|------|
| `QUEUE_CONCURRENCY` | 3 | 最大并发 worker 数 |
| `QUEUE_MAX_RETRIES` | 3 | 失败最大重试次数 |
| `QUEUE_BASE_RETRY_DELAY` | 2000ms | 重试退避基础延迟 |

## 2. 取消中止机制

取消操作通过 `POST /api/tasks/:id/cancel` 触发，全部逻辑封装在 `TaskQueue.cancelTask()` 内。

### 取消执行步骤（按顺序）

1. **加入 cancelledSet**：`cancelledSet.add(taskId)` —— 这是第一道防线，后续所有路径都会检查此集合
2. **从内存队列移除**：若任务在 `queue[]` 中排队，直接 splice 移除
3. **中止运行中 worker**：若任务有 `AbortController`（正在 PROCESSING），调用 `controller.abort()`
4. **更新数据库**：将状态设为 `CANCELLED`，带 `.catch(() => {})` 容错

### Worker 侧如何响应取消

**_executeTask 中每个进度 step 之间**：
- 检查 `cancelledSet.has(taskId)` —— 内存级快速判断
- 检查 `signal.aborted` —— AbortController 信号
- `_sleep()` 内部监听 `signal.abort` 事件，收到后 `clearTimeout` 并 reject
- 任一条件满足立即抛出 `CANCELLED` 错误

**_runWorker 的 catch 块**：
- 检查 `cancelledSet.has(taskId) || signal.aborted` → 直接 return，不进入重试逻辑

**写入 COMPLETED 前的二次校验**：
- 先检查 `cancelledSet` 和 `signal.aborted`
- 再从数据库读取最新状态，若已是 `CANCELLED` 则放弃写入 COMPLETED
- 这解决了取消和完成之间的竞态条件

**cancelledSet 防复活**：
- `enqueue()` 入口检查 cancelledSet，已取消任务无法重新入队
- `_schedule()` 取任务时跳过 cancelledSet 中的任务
- 重试退避等待后再次检查 cancelledSet，防止等待期间被取消的任务被重新拾起

## 3. 重试退避策略

### 退避公式

```
delay = BASE_RETRY_DELAY × 2^retryCount
```

| 重试次数 | retryCount 值 | 退避延迟（BASE=2000ms） |
|---------|-------------|----------------------|
| 第1次重试 | 0 → 1 | 2000ms |
| 第2次重试 | 1 → 2 | 4000ms |
| 第3次重试 | 2 → 3 | 8000ms |

### 重试流程

```
_executeTask 抛出异常
  │
  ├─ 检查 cancelledSet / signal.aborted → 是 → 直接退出，不重试
  │
  ├─ 从 DB 读取 task.retryCount
  │
  ├─ retryCount < MAX_RETRIES ?
  │    ├─ 是：
  │    │    1. DB 更新 status=QUEUED, retryCount+1
  │    │    2. _sleep(退避延迟, signal)  ← 退避期间仍可被取消
  │    │    3. 再次检查 cancelledSet / signal.aborted
  │    │    4. 从 DB 重读状态，确认仍为 QUEUED 且未在 cancelledSet
  │    │    5. 推回 queue[]，调用 _schedule()
  │    │
  │    └─ 否：
  │         DB 更新 status=FAILED, completedAt=now
  │
  └─ finally: 从 abortControllers 中移除
```

## 4. 状态流转图

```
PENDING ──── enqueue() ────→ QUEUED ──── worker启动 ────→ PROCESSING
  │                            ↑                          │  │  │
  │                            │                          │  │  └── 成功 → COMPLETED
  │                            │                          │  │
  │                            │  retryCount < N          │  └── 失败 → (重试循环)
  │                            │  + 退避等待 ─────────────┘
  │                            │
  │                            └── retryCount ≥ N → FAILED
  │
  └── cancel() → CANCELLED

QUEUED ─────── cancel() ──────→ CANCELLED  (从 queue[] 移除 + DB 更新)
PROCESSING ─── cancel() ──────→ CANCELLED  (AbortController.abort() + DB 更新)
```

### 状态说明

| 状态 | 含义 | 可流转至 |
|------|------|---------|
| PENDING | 已创建，等待入队 | QUEUED, CANCELLED |
| QUEUED | 已入队，等待 worker 或重试等待中 | PROCESSING, CANCELLED |
| PROCESSING | worker 正在执行 | COMPLETED, FAILED, QUEUED(重试), CANCELLED |
| COMPLETED | 执行成功（终态） | — |
| FAILED | 重试耗尽后仍失败（终态） | — |
| CANCELLED | 被用户主动取消（终态） | — |

## 5. 前端对齐

- **轮询**：有 PROCESSING/QUEUED 任务时 1.5s 间隔，否则 3s；递归 setTimeout 避免请求堆积
- **看板**：新增 CANCELLED 列；QUEUED/PROCESSING 任务卡片带 ✕ 取消按钮；进度条显示百分比；重试中任务显示重试次数 badge
- **API**：`POST /api/tasks/:id/cancel`；`GET /api/health` 返回 `{ queue: { queued, active, concurrency, maxRetries } }`
