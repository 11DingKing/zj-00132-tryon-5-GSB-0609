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

    <div class="queue-status-bar">
      <span class="queue-stat">
        <span class="queue-stat-label">Worker:</span>
        <span class="worker-dots">
          <span
            v-for="i in store.queueStats.maxConcurrency"
            :key="i"
            class="worker-dot"
            :class="{ active: i <= store.queueStats.active }"
          ></span>
        </span>
        <span class="queue-stat-value"
          >{{ store.queueStats.active }}/{{
            store.queueStats.maxConcurrency
          }}</span
        >
      </span>
      <span class="queue-stat">
        <span class="queue-stat-label">排队中:</span>
        <span class="queue-stat-value">{{ store.queueStats.queued }}</span>
      </span>
      <span class="queue-stat" v-if="store.processingTasks.length > 0">
        <span class="queue-stat-label">执行中任务:</span>
        <span class="queue-stat-value"
          >#{{ store.processingTasks.map((t) => t.id).join(", #") }}</span
        >
      </span>
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
            (store.tasksByStatus[status] || []).length
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
          <div class="task-title">#{{ task.id }} {{ task.sku.name }}</div>
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
          </div>
          <div
            v-if="task.status === 'PROCESSING'"
            style="
              font-size: 0.7rem;
              color: #3b82f6;
              margin-top: 0.25rem;
              text-align: right;
            "
          >
            {{ task.progress }}%
          </div>
          <div v-if="task.reviews.length > 0" style="margin-top: 0.5rem">
            <span style="font-size: 0.7rem; color: #64748b">
              ⭐ {{ task.reviews[0].rating }}
            </span>
          </div>
          <div
            v-if="task.status === 'QUEUED' || task.status === 'PROCESSING'"
            class="task-card-actions"
          >
            <button
              class="btn-cancel"
              :disabled="store.cancellingTaskIds.has(task.id)"
              @click.stop="cancelTask(task.id)"
            >
              {{
                store.cancellingTaskIds.has(task.id) ? "取消中..." : "✕ 取消"
              }}
            </button>
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

function handleTaskClick(task: Task, event: MouseEvent) {
  if (task.status === "PENDING") {
    store.toggleTaskSelection(task.id);
  }
}

async function enqueueSelected() {
  await store.enqueueTasks(store.selectedTaskIds);
  store.clearSelection();
}

async function cancelTask(taskId: number) {
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
</style>
