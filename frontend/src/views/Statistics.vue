<template>
  <div>
    <h2 class="page-title" style="margin-bottom: 1.5rem">统计报表</h2>

    <div v-if="loading" class="loading">加载中...</div>

    <div v-if="stats" class="stats-grid">
      <div class="stat-card">
        <div class="stat-title">总完成任务数</div>
        <div class="stat-value">{{ stats.totalCompleted || 0 }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">模特总数</div>
        <div class="stat-value">{{ store.models.length }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">SKU 总数</div>
        <div class="stat-value">{{ store.skus.length }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">待审核任务</div>
        <div class="stat-value">{{ pendingReview }}</div>
      </div>
    </div>

    <div class="detail-card" style="margin-bottom: 1.5rem">
      <h3 style="margin-bottom: 1rem">各模特合格率排名</h3>
      <table class="table">
        <thead>
          <tr>
            <th>模特</th>
            <th>总任务数</th>
            <th>通过数</th>
            <th>合格率</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="stat in sortedModelStats" :key="stat.modelName">
            <td style="font-weight: 500">{{ stat.modelName }}</td>
            <td>{{ stat.total }}</td>
            <td>{{ stat.passed }}</td>
            <td>
              <span class="badge" :style="getRateStyle(stat.passRate)">
                {{ Math.round(stat.passRate * 100) }}%
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="detail-card" style="margin-bottom: 1.5rem">
      <h3 style="margin-bottom: 1rem">各场景平均评分</h3>
      <table class="table">
        <thead>
          <tr>
            <th>场景</th>
            <th>任务数</th>
            <th>平均评分</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(data, scene) in stats.sceneStats" :key="scene">
            <td style="font-weight: 500">{{ SceneLabels[scene as unknown as keyof typeof SceneLabels] || scene }}</td>
            <td>{{ data.total }}</td>
            <td>⭐ {{ data.avgRating.toFixed(1) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="detail-card" style="margin-bottom: 1.5rem">
      <h3 style="margin-bottom: 1rem">热门镜头角度</h3>
      <table class="table">
        <thead>
          <tr>
            <th>镜头</th>
            <th>使用次数</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(count, camera) in sortedCameraStats" :key="camera">
            <td style="font-weight: 500">{{ CameraLabels[camera as unknown as keyof typeof CameraLabels] || camera }}</td>
            <td>{{ count }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="detail-card">
      <h3 style="margin-bottom: 1rem">审计日志</h3>
      <table class="table">
        <thead>
          <tr>
            <th>时间</th>
            <th>用户</th>
            <th>操作</th>
            <th>详情</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in store.auditLogs.slice(0, 10)" :key="log.id">
            <td style="font-size: 0.8rem">{{ new Date(log.createdAt).toLocaleString() }}</td>
            <td style="font-weight: 500">{{ log.user?.username }}</td>
            <td>{{ log.action }}</td>
            <td style="font-size: 0.8rem; color: #64748b">{{ log.details || '-' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useStore } from '../store'
import { SceneLabels, CameraLabels } from '../types'

const store = useStore()
const loading = ref(true)
const stats = ref<any>({ modelStats: [], sceneStats: {}, cameraStats: {}, monthlyStats: {} })

const pendingReview = computed(() => {
  return store.tasks.filter(t => t.status === 'COMPLETED' && t.reviews.length === 0).length
})

const sortedModelStats = computed(() => {
  return (stats.value.modelStats || []).sort((a: any, b: any) => b.passRate - a.passRate)
})

const sortedCameraStats = computed(() => {
  return Object.entries(stats.value.cameraStats || {})
    .sort((a: [string, any], b: [string, any]) => b[1] - a[1])
})

function getRateStyle(rate: number) {
  if (rate >= 0.8) return { background: '#dcfce7', color: '#166534' }
  if (rate >= 0.6) return { background: '#fef3c7', color: '#92400e' }
  return { background: '#fee2e2', color: '#991b1b' }
}

onMounted(async () => {
  await store.fetchStatistics()
  await store.fetchAuditLogs()
  stats.value = store.statistics
  loading.value = false
})
</script>
