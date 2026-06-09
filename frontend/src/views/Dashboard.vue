<template>
  <div>
    <div class="page-header">
      <h2 class="page-title">任务看板</h2>
      <button class="btn btn-primary" @click="$router.push('/create')">
        + 批量创建任务
      </button>
    </div>

    <div v-if="store.selectedTaskIds.length > 0" class="selection-bar">
      <span>已选择 {{ store.selectedTaskIds.length }} 个任务</span>
      <div style="display: flex; gap: 0.5rem">
        <button class="btn btn-primary" @click="enqueueSelected">
          加入队列
        </button>
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
            store.tasksByStatus[status]?.length || 0
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
              v-if="task.status === 'QUEUED' || task.status === 'PROCESSING'"
              class="cancel-btn"
              @click.stop="handleCancel(task.id)"
              title="取消任务"
            >
              ✕
            </button>
          </div>
          <div class="task-meta">
            <span class="tag">{{ task.model.name }}</span>
            <span class="tag">{{ SceneLabels[task.scene] }}</span>
            <span class="tag">{{ CameraLabels[task.cameraAngle] }}</span>
          </div>
          <div v-if="task.status === 'PROCESSING'" class="progress-bar">
            <div
              class="progress-fill"
              :style="{ width: task.progress + '%' }"
            ></div>
            <span class="progress-text">{{ task.progress }}%</span>
          </div>
          <div
            v-if="task.status === 'QUEUED' && task.retryCount > 0"
            class="retry-badge"
          >
            重试 {{ task.retryCount }}/{{ maxRetries }}
          </div>
          <div
            v-if="task.status === 'FAILED' && task.retryCount > 0"
            class="retry-badge failed"
          >
            已重试 {{ task.retryCount }} 次
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
import { onMounted, onUnmounted } from "vue";
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
const maxRetries = 3;

let stopPolling: (() => void) | null = null;

onMounted(() => {
  stopPolling = store.startPolling();
});

onUnmounted(() => {
  if (stopPolling) {
    stopPolling();
  }
});

function handleTaskClick(task: Task, event: MouseEvent) {
  if (task.status === "PENDING") {
    store.toggleTaskSelection(task.id);
  } else if (!event.ctrlKey && !event.metaKey) {
  }
}

async function enqueueSelected() {
  await store.enqueueTasks(store.selectedTaskIds);
  store.clearSelection();
}

async function handleCancel(taskId: number) {
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

.task-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.25rem;
}

.cancel-btn {
  background: none;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  color: #6b7280;
  cursor: pointer;
  font-size: 0.75rem;
  line-height: 1;
  padding: 2px 6px;
  flex-shrink: 0;
  transition: all 0.15s;
}

.cancel-btn:hover {
  background: #fee2e2;
  border-color: #fca5a5;
  color: #dc2626;
}

.progress-text {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.65rem;
  color: white;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.retry-badge {
  margin-top: 0.25rem;
  font-size: 0.7rem;
  color: #f59e0b;
  background: #fef3c7;
  padding: 1px 6px;
  border-radius: 4px;
  display: inline-block;
}

.retry-badge.failed {
  color: #ef4444;
  background: #fee2e2;
}
</style>
