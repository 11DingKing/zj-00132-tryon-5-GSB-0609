# AI 虚拟试衣任务编排平台

一个全栈虚拟试衣任务管理系统，支持任务队列、人工审核、数据统计等功能。

## 技术栈

### 后端
- Node.js + Express
- Prisma ORM
- SQLite 数据库

### 前端
- Vue 3 + Vite
- Pinia 状态管理
- TypeScript

## 项目结构

```
.
├── backend/          # 后端服务
│   ├── prisma/       # Prisma schema 和 seed 数据
│   ├── src/
│   │   └── server.js # 入口文件
│   └── package.json
├── frontend/         # 前端应用
│   ├── src/
│   │   ├── views/    # 页面组件
│   │   ├── api.ts    # API 封装
│   │   ├── store.ts  # Pinia store
│   │   ├── types.ts  # 类型定义
│   │   └── router.ts # 路由配置
│   └── package.json
└── README.md
```

## 快速开始

### 安装后端依赖

```bash
cd backend
npm install
```

安装完成后会自动运行：
- `prisma migrate dev` - 初始化数据库
- `node prisma/seed.js` - 填充种子数据（2个模特、3个SKU、一批演示任务）

### 启动后端服务

```bash
cd backend
npm run dev
# 服务运行在 http://localhost:3000
```

### 安装前端依赖

```bash
cd frontend
npm install
```

### 启动前端服务

```bash
cd frontend
npm run dev
# 服务运行在 http://localhost:5173
```

## 功能特性

### 1. 任务看板 (Dashboard)
- 五栏状态展示：未开始 / 排队中 / 生成中 / 已完成 / 失败
- 任务卡片实时更新进度
- 点击选择未开始任务，批量加入队列
- 双击任务查看详情

### 2. 批量创建任务 (Create Tasks)
- 选择多个模特 × SKU × 场景 × 镜头 × 光照
- 笛卡尔积自动生成任务组合
- 支持一次性创建上百个任务

### 3. 任务详情与审核 (Task Detail)
- 原图与试穿结果对比
- 星级评分（1-5星）
- 审核标签：贴合/版型走样/穿模/光照不一致/颜色失真
- 低分或穿模自动标记重生成

### 4. 统计报表 (Statistics)
- 各模特合格率排名
- 各场景平均人工评分
- 热门镜头角度统计
- 审计日志记录关键操作

## 数据模型

### User（用户）
- 三种角色：运营(OPERATOR) / 审核员(AUDITOR) / 设计师(DESIGNER)

### Model（模特）
- 头像、身材数据、风格标签

### SKU（商品）
- 品类、尺码范围、平铺图、3D网格mock

### Task（任务）
- 模特 × SKU × 场景 × 镜头 × 光照
- 五状态流转
- 进度百分比
- 结果图片URL

### Review（审核）
- 评分、标签、备注
- 自动判断是否需要重生成

### AuditLog（审计日志）
- 记录所有关键操作
