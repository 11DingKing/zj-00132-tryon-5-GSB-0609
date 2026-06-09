<template>
  <div>
    <div class="page-header">
      <h2 class="page-title">任务看板</h2>
      <button class="btn btn-primary" @click="$router.push('/create')">
        + 批量创建任务
      </button>
    </div>

    <div v-if="store.queueStats" class="queue-stats">
      <span class="qs-item">
        并发: <b>{{ store.queueStats.activeWorkers }}</b> /
        {{ store.queueStats.concurrency }}
      </span>
      <span class="qs-item"
        >排队: <b>{{ store.queueStats.waiting }}</b></span
      >
      <span class="qs-item"
        >重试等待: <b>{{ store.queueStats.waitingForRetry }}</b></span
      >
      <span class="qs-item"
        >最大重试: <b>{{ store.queueStats.maxRetries }}</b></span
      >
    </div>

    <div v-if="store.selectedTaskIds.length > 0" class="selection-bar">
      <span>已选择 {{ store.selectedTaskIds.length }} 个任务</span>
      <div style="display: flex; gap: 0.5rem">
        <button class="btn btn-primary" @click="enqueueSelected">
          加入队列
        </button>
        <button class="btn btn-danger" @click="cancelSelected">批量取消</button>
        <button class="btn" @click="store.clearSelection()">取消选择</button>
      </div>
    </div>

    <div v-if="store.loading" class="loading">加载中...</div>

    <div class="kanban">
      <div v-for="status in statusColumns" :key="status" class="kanban-column">
        <div class="column-header">
          <span class="column-title">
            <span
              class="status-dot"
              :style="{ background: StatusColors[status] }"
            ></span>
            {{ StatusLabels[status] }}
          </span>
          <span class="column-count">{{
            store.tasksByStatus[status].length
          }}</span>
        </div>

        <div
          v-for="task in store.tasksByStatus[status]"
          :key="task.id"
          class="task-card"
          :class="{ selected: store.selectedTaskIds.includes(task.id) }"
          @click="handleTaskClick(task, $event)"
          @dblclick="$router.push(`/task/${task.id}`)"
        >
          <div class="task-card-header">
            <div class="task-title">#{{ task.id }} {{ task.sku.name }}</div>
            <button
              v-if="canCancel(task)"
              class="cancel-btn"
              title="取消该任务"
              @click.stop="onCancel(task.id)"
            >
              ✕
            </button>
          </div>
          <div class="task-meta">
            <span class="tag">{{ task.model.name }}</span>
            <span class="tag">{{ SceneLabels[task.scene] }}</span>
            <span class="tag">{{ CameraLabels[task.cameraAngle] }}</span>
          </div>
          <div
            v-if="task.status === 'PROCESSING' || task.status === 'QUEUED'"
            class="progress-wrap"
          >
            <div class="progress-bar">
              <div
                class="progress-fill"
                :style="{
                  width: task.progress + '%',
                  background: StatusColors[task.status],
                }"
              ></div>
            </div>
            <span class="progress-text">{{ task.progress }}%</span>
          </div>
          <div v-if="task.reviews.length > 0" style="margin-top: 0.5rem">
            <span style="font-size: 0.7rem; color: #64748b">
              ⭐ {{ task.reviews[0].rating }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useStore } from "../store";
import {
  StatusLabels,
  StatusColors,
  SceneLabels,
  CameraLabels,
} from "../types";
import type { Task, TaskStatus } from "../types";

const store = useStore();

const statusColumns: TaskStatus[] = [
  "PENDING",
  "QUEUED",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
];

function canCancel(task: Task) {
  return (
    task.status === "PENDING" ||
    task.status === "QUEUED" ||
    task.status === "PROCESSING"
  );
}

function handleTaskClick(task: Task, _event: MouseEvent) {
  if (
    task.status === "PENDING" ||
    task.status === "FAILED" ||
    task.status === "CANCELLED"
  ) {
    store.toggleTaskSelection(task.id);
  }
}

async function enqueueSelected() {
  await store.enqueueTasks(store.selectedTaskIds);
  store.clearSelection();
}

async function cancelSelected() {
  await store.cancelTasks(store.selectedTaskIds);
  store.clearSelection();
}

async function onCancel(taskId: number) {
  await store.cancelTask(taskId);
}
</script>

<style scoped>
.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}

.queue-stats {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  margin-bottom: 1rem;
  font-size: 0.8rem;
  color: #475569;
}
.qs-item b {
  color: #0f172a;
}

.task-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
}

.cancel-btn {
  background: transparent;
  border: 1px solid #e2e8f0;
  color: #64748b;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75rem;
  line-height: 1;
  padding: 0;
  flex-shrink: 0;
}
.cancel-btn:hover {
  background: #fef2f2;
  border-color: #ef4444;
  color: #ef4444;
}

.progress-wrap {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
.progress-wrap .progress-bar {
  flex: 1;
}
.progress-text {
  font-size: 0.7rem;
  color: #64748b;
  min-width: 32px;
  text-align: right;
}

.btn-danger {
  background: #ef4444;
  color: white;
  border-color: #ef4444;
}
.btn-danger:hover {
  background: #dc2626;
}
</style>
