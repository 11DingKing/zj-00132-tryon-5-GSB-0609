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
        <button class="btn" @click="store.clearSelection()">
          取消选择
        </button>
      </div>
    </div>

    <div v-if="store.loading" class="loading">加载中...</div>

    <div class="kanban">
      <div
        v-for="status in statusColumns"
        :key="status"
        class="kanban-column"
      >
        <div class="column-header">
          <span class="column-title">
            <span class="status-dot" :style="{ background: StatusColors[status] }"></span>
            {{ StatusLabels[status] }}
          </span>
          <span class="column-count">{{ store.tasksByStatus[status].length }}</span>
        </div>

        <div
          v-for="task in store.tasksByStatus[status]"
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
            <div class="progress-fill" :style="{ width: task.progress + '%' }"></div>
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
import { useStore } from '../store'
import { StatusLabels, StatusColors, SceneLabels, CameraLabels } from '../types'
import type { Task, TaskStatus } from '../types'

const store = useStore()

const statusColumns: TaskStatus[] = ['PENDING', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED']

function handleTaskClick(task: Task, event: MouseEvent) {
  if (task.status === 'PENDING') {
    store.toggleTaskSelection(task.id)
  } else if (!event.ctrlKey && !event.metaKey) {
    // Double click handled by @dblclick
  }
}

async function enqueueSelected() {
  await store.enqueueTasks(store.selectedTaskIds)
  store.clearSelection()
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
