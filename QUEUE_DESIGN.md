# 并发调度模型说明

## 概览

任务队列从单 worker 串行模型升级为多 worker 并发模型，支持可配置并发数、任务取消（含运行中中止）、指数退避自动重试。

## Worker 调度模型

```
enqueue(taskId) → queue[] → _schedule() → _runWorker(taskId)
                                    ↑              |
                                    └── finally() ─┘
```

- **入队**：`enqueue()` 将任务推入内存队列 `queue[]`，立即调用 `_schedule()`
- **调度**：`_schedule()` 循环检查 `activeWorkers < CONCURRENCY`，只要有空位就从队列头部取出任务启动 worker
- **释放**：worker 完成（无论成功/失败/取消）后在 `finally` 中递减 `activeWorkers` 并再次调用 `_schedule()`，形成级联调度
- **严格上限**：`activeWorkers` 在 worker 启动前递增、结束后递减，保证同一时刻运行中的 worker 数量 ≤ `CONCURRENCY`

### 配置项

| 环境变量 | 默认值 | 说明 |
|---------|-------|------|
| `QUEUE_CONCURRENCY` | 3 | 最大并发 worker 数 |
| `QUEUE_MAX_RETRIES` | 3 | 失败最大重试次数 |
| `QUEUE_BASE_RETRY_DELAY` | 2000ms | 重试退避基础延迟 |

## 任务取消机制

取消操作通过 `POST /api/tasks/:id/cancel` 触发，根据任务当前状态分三种情况处理：

### 1. 排队中（QUEUED，在内存队列中）
- 从 `queue[]` 中移除该条目
- 数据库状态更新为 `CANCELLED`

### 2. 执行中（PROCESSING，worker 正在运行）
- 通过 `AbortController` 机制中止：
  - 每个运行中的任务在 `_runWorker` 入口创建 `AbortController`，存入 `abortControllers` Map
  - 取消时调用 `controller.abort()`
  - `_executeTask` 中每个步骤的 `setTimeout` 都监听了 `abort` 事件，收到信号后 `clearTimeout` 并 reject
  - worker catch 到 `CANCELLED` 错误后检查 `signal.aborted`，跳过重试逻辑直接退出
- 数据库状态更新为 `CANCELLED`

### 3. 待入队（PENDING，尚未 enqueue）
- 直接在数据库中将状态更新为 `CANCELLED`

## 重试退避策略

```
delay = BASE_RETRY_DELAY × 2^retryCount
```

| 重试次数 | 退避延迟（BASE=2000ms） |
|---------|----------------------|
| 第1次重试 | 2000ms |
| 第2次重试 | 4000ms |
| 第3次重试 | 8000ms |

流程：
1. 任务执行失败，检查 `retryCount < MAX_RETRIES`
2. 若可重试：将数据库状态设回 `QUEUED`，`retryCount + 1`，等待退避延迟后重新入队
3. 退避等待后再次检查数据库状态（防止等待期间被取消），若仍为 `QUEUED` 则推入队列重新调度
4. 若已达上限：标记 `FAILED`，记录 `completedAt`

## 状态流转图

```
PENDING ──enqueue──→ QUEUED ──worker启动──→ PROCESSING
                       ↑                      │
                       │ retryCount < N       ├─成功──→ COMPLETED
                       │ + 退避等待            │
                       └──────────────────────┤
                                              ├─失败且retryCount ≥ N──→ FAILED
                                              │
                    ┌──── cancel ──────────────┤
                    ↓                         ↓
                 CANCELLED                 CANCELLED
              (QUEUED时取消)          (PROCESSING时取消)

PENDING ──cancel──→ CANCELLED
```

### 状态说明

| 状态 | 含义 |
|------|------|
| PENDING | 已创建，等待入队 |
| QUEUED | 已入队，等待/重试等待中 |
| PROCESSING | worker 正在执行 |
| COMPLETED | 执行成功 |
| FAILED | 重试耗尽后仍失败 |
| CANCELLED | 被用户主动取消 |

## 前端轮询优化

- 有 PROCESSING/QUEUED 任务时轮询间隔缩短为 1.5s
- 无活跃任务时恢复 3s 默认间隔
- 使用递归 `setTimeout` 替代 `setInterval`，每次请求完成后才设定下次定时器，避免请求堆积
