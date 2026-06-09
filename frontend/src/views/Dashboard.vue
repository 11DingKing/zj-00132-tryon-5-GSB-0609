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
        <button
          v-if="hasSelectedPending"
          class="btn btn-primary"
          @click="enqueueSelected"
        >
          加入队列
        </button>
        <button
          v-if="hasSelectedCancellable"
          class="btn btn-danger"
          @click="cancelSelected"
        >
          取消任务
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
          v-for="task in store.tasksByStatus[status] || []"
          :key="task.id"
          class="task-card"
          :class="{ selected: store.selectedTaskIds.includes(task.id) }"
          @click="handleTaskClick(task, $event)"
          @dblclick="$router.push(`/task/${task.id}`)"
        >
          <div class="task-header">
            <div class="task-title">#{{ task.id }} {{ task.sku.name }}</div>
            <button
              v-if="canCancelTask(task)"
              class="cancel-btn"
              @click.stop="cancelTask(task.id)"
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
          <div
            v-if="task.status === 'PROCESSING' || task.status === 'QUEUED'"
            class="progress-section"
          >
            <div v-if="task.status === 'PROCESSING'" class="progress-bar">
              <div
                class="progress-fill"
                :style="{ width: task.progress + '%' }"
              ></div>
            </div>
            <div class="progress-info">
              <span v-if="task.status === 'PROCESSING'" class="progress-text">
                {{ task.progress }}%
              </span>
              <span v-if="task.retryCount > 0" class="retry-badge">
                重试 {{ task.retryCount }}/{{ task.maxRetries }}
              </span>
            </div>
          </div>
          <div
            v-if="task.status === 'FAILED' && task.errorMessage"
            class="error-message"
          >
            {{ task.errorMessage }}
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
import { computed } from "vue";
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

const hasSelectedPending = computed(() => {
  return store.selectedTaskIds.some((id) => {
    const task = store.tasks.find((t) => t.id === id);
    return task?.status === "PENDING";
  });
});

const hasSelectedCancellable = computed(() => {
  return store.selectedTaskIds.some((id) => {
    const task = store.tasks.find((t) => t.id === id);
    return task && (task.status === "QUEUED" || task.status === "PROCESSING");
  });
});

function canCancelTask(task: Task): boolean {
  return task.status === "QUEUED" || task.status === "PROCESSING";
}

function handleTaskClick(task: Task, event: MouseEvent) {
  if (task.status === "PENDING") {
    store.toggleTaskSelection(task.id);
  } else if (canCancelTask(task)) {
    if (event.ctrlKey || event.metaKey) {
      store.toggleTaskSelection(task.id);
    }
  }
}

async function enqueueSelected() {
  const pendingIds = store.selectedTaskIds.filter((id) => {
    const task = store.tasks.find((t) => t.id === id);
    return task?.status === "PENDING";
  });
  await store.enqueueTasks(pendingIds);
  store.clearSelection();
}

async function cancelSelected() {
  const cancellableIds = store.selectedTaskIds.filter((id) => {
    const task = store.tasks.find((t) => t.id === id);
    return task && (task.status === "QUEUED" || task.status === "PROCESSING");
  });
  await store.cancelTasks(cancellableIds);
  store.clearSelection();
}

async function cancelTask(taskId: number) {
  await store.cancelTasks([taskId]);
}
</script>

<style scoped>
.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.cancel-btn {
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  font-size: 14px;
  padding: 2px 6px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.cancel-btn:hover {
  background: #fee2e2;
  color: #ef4444;
}

.progress-section {
  margin-top: 0.75rem;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.25rem;
  font-size: 0.75rem;
}

.progress-text {
  color: #3b82f6;
  font-weight: 500;
}

.retry-badge {
  background: #fef3c7;
  color: #92400e;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.7rem;
}

.error-message {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: #ef4444;
  background: #fef2f2;
  padding: 4px 8px;
  border-radius: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.btn-danger {
  background: #ef4444;
  color: white;
  border: 1px solid #ef4444;
}

.btn-danger:hover {
  background: #dc2626;
  border-color: #dc2626;
}
</style>
