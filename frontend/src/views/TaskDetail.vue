<template>
  <div>
    <router-link to="/" class="back-btn">← 返回看板</router-link>

    <div v-if="loading" class="loading">加载中...</div>

    <div v-if="task" class="detail-card">
      <h2 style="margin-bottom: 1rem">
        任务 #{{ task.id }} - {{ task.sku.name }}
        <span class="badge" :style="{ background: StatusColors[task.status], color: 'white' }">
          {{ StatusLabels[task.status] }}
        </span>
      </h2>

      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem">
        <div>
          <div style="font-size: 0.75rem; color: #64748b;">模特</div>
          <div style="font-weight: 500;">{{ task.model.name }}</div>
        </div>
        <div>
          <div style="font-size: 0.75rem; color: #64748b;">场景</div>
          <div style="font-weight: 500;">{{ SceneLabels[task.scene] }}</div>
        </div>
        <div>
          <div style="font-size: 0.75rem; color: #64748b;">镜头</div>
          <div style="font-weight: 500;">{{ CameraLabels[task.cameraAngle] }}</div>
        </div>
        <div>
          <div style="font-size: 0.75rem; color: #64748b;">光照</div>
          <div style="font-weight: 500;">{{ LightingLabels[task.lighting] }}</div>
        </div>
      </div>

      <div v-if="task.status === 'PROCESSING'" class="progress-bar" style="margin-bottom: 1.5rem;">
        <div class="progress-fill" :style="{ width: task.progress + '%' }"></div>
      </div>

      <div class="reshoot-section" v-if="task.status === 'RESHOOT_PENDING' || reshootCandidates.length > 0">
        <h3 style="margin-bottom: 1rem; color: #8b5cf6;">🔄 智能补拍候选结果</h3>
        <div class="reshoot-grid">
          <div 
            v-for="candidate in reshootCandidates" 
            :key="candidate.id"
            class="reshoot-card"
            :class="{ selected: candidate.isSelected, processing: candidate.status === 'PROCESSING' }"
            @click="selectReshootCandidate(candidate)"
          >
            <div class="reshoot-image-container">
              <img v-if="candidate.resultImageUrl" :src="candidate.resultImageUrl" :alt="`候选结果 ${candidate.id}`" />
              <div v-else-if="candidate.status === 'PROCESSING'" class="reshoot-loading">
                <div class="mini-progress-bar">
                  <div class="mini-progress-fill" :style="{ width: candidate.progress + '%' }"></div>
                </div>
                <span style="font-size: 0.75rem; color: #64748b;">生成中...</span>
              </div>
              <div v-else class="reshoot-loading">
                <span style="font-size: 0.75rem; color: #64748b;">等待生成</span>
              </div>
            </div>
            <div class="reshoot-params">
              <div class="param-tag">{{ SceneLabels[candidate.scene as keyof typeof SceneLabels] }}</div>
              <div class="param-tag">{{ CameraLabels[candidate.cameraAngle as keyof typeof CameraLabels] }}</div>
              <div class="param-tag">{{ LightingLabels[candidate.lighting as keyof typeof LightingLabels] }}</div>
            </div>
            <div v-if="candidate.isSelected" class="selected-badge">✓ 已选择</div>
          </div>
        </div>
        <p v-if="reshootCandidates.some(c => c.status === 'PROCESSING' || c.status === 'PENDING')" style="margin-top: 1rem; font-size: 0.875rem; color: #64748b;">
          ⏳ 候选结果正在生成中，请稍候...
        </p>
        <p v-else-if="!reshootCandidates.some(c => c.isSelected) && reshootCandidates.every(c => c.status === 'COMPLETED')" style="margin-top: 1rem; font-size: 0.875rem; color: #8b5cf6;">
          👆 点击上方候选图片选择最终交付结果
        </p>
      </div>

      <div class="image-comparison" v-if="task.resultImageUrl && task.status !== 'RESHOOT_PENDING'">
        <div class="image-box">
          <img :src="task.originalImageUrl" alt="原图" />
          <div class="image-label">原图</div>
        </div>
        <div class="image-box">
          <img :src="task.resultImageUrl" alt="试穿结果" />
          <div class="image-label">试穿结果</div>
        </div>
      </div>

      <div v-if="task.status === 'COMPLETED'" style="margin-top: 2rem; padding-top: 2rem; border-top: 1px solid #e5e7eb">
        <h3 style="margin-bottom: 1rem">人工审核</h3>
        
        <div v-if="task.reviews.length > 0">
          <div v-for="review in task.reviews" :key="review.id" style="margin-bottom: 1rem; padding: 1rem; background: #f8fafc; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem">
              <span style="font-weight: 500">{{ review.user?.username || '审核员' }}</span>
              <span>⭐ {{ review.rating }} 分</span>
            </div>
            <div class="review-tags">
              <span
                v-for="tag in review.tags"
                :key="tag"
                class="review-tag"
                :style="{ background: ReviewTagColors[tag] + '20', color: ReviewTagColors[tag] }"
              >
                {{ ReviewTagLabels[tag] }}
              </span>
            </div>
            <p v-if="review.comment" style="margin-top: 0.5rem; font-size: 0.875rem; color: #64748b">
              {{ review.comment }}
            </p>
            <p v-if="review.needsRegen" style="margin-top: 0.5rem; font-size: 0.8rem; color: #ef4444">
              ⚠️ 此结果将被重新生成
            </p>
          </div>
        </div>

        <div v-else>
          <div class="form-group">
            <label class="form-label">评分</label>
            <div class="rating">
              <span
                v-for="i in 5"
                :key="i"
                class="star"
                :class="{ active: i <= rating }"
                @click="rating = i"
              >
                ★
              </span>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">标签</label>
            <div class="review-tags">
              <span
                v-for="(label, tag) in ReviewTagLabels"
                :key="tag"
                class="review-tag"
                :class="{ selected: selectedTags.includes(tag) }"
                :style="{ 
                  background: selectedTags.includes(tag) ? ReviewTagColors[tag] + '20' : '#f1f5f9',
                  color: selectedTags.includes(tag) ? ReviewTagColors[tag] : '#64748b'
                }"
                @click="toggleTag(tag)"
              >
                {{ label }}
              </span>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">备注</label>
            <textarea v-model="comment" class="form-textarea" rows="3" placeholder="输入备注..."></textarea>
          </div>

          <button class="btn btn-success" @click="submitReview" :disabled="rating === 0 || submitting">
            {{ submitting ? '提交中...' : '提交审核' }}
          </button>
          <p v-if="rating < 3 || selectedTags.includes('CLIPPING')" style="margin-top: 1rem; font-size: 0.875rem; color: #ef4444">
            ⚠️ 此任务将自动进入重生成队列
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useStore } from '../store'
import { taskApi, reviewApi, reshootApi } from '../api'
import { StatusLabels, StatusColors, SceneLabels, CameraLabels, LightingLabels, ReviewTagLabels, ReviewTagColors } from '../types'
import type { Task, ReshootCandidate } from '../types'

const route = useRoute()
const store = useStore()

const loading = ref(true)
const submitting = ref(false)
const selectingReshoot = ref(false)
const task = ref<Task | null>(null)
const reshootCandidates = ref<ReshootCandidate[]>([])
const rating = ref(0)
const comment = ref('')
const selectedTags = ref<string[]>([])

let pollInterval: number | null = null

onMounted(async () => {
  const taskId = parseInt(route.params.id as string)
  await loadTask(taskId)
  loading.value = false

  pollInterval = window.setInterval(() => {
    if (task.value?.status === 'RESHOOT_PENDING') {
      loadReshootCandidates(task.value.id)
    }
  }, 2000)
})

onUnmounted(() => {
  if (pollInterval) {
    clearInterval(pollInterval)
  }
})

async function loadTask(taskId: number) {
  try {
    const res = await taskApi.getById(taskId) as any
    task.value = res.data
    if (task.value?.status === 'RESHOOT_PENDING') {
      await loadReshootCandidates(taskId)
    }
  } catch (e) {
    task.value = store.tasks.find(t => t.id === taskId) || null
  }
}

async function loadReshootCandidates(taskId: number) {
  try {
    const res = await taskApi.getReshootCandidates(taskId) as any
    reshootCandidates.value = res.data
  } catch (e) {
    console.error('Failed to load reshoot candidates:', e)
  }
}

function toggleTag(tag: string) {
  const idx = selectedTags.value.indexOf(tag)
  if (idx > -1) {
    selectedTags.value.splice(idx, 1)
  } else {
    selectedTags.value.push(tag)
  }
}

async function selectReshootCandidate(candidate: ReshootCandidate) {
  if (candidate.status !== 'COMPLETED' || candidate.isSelected || selectingReshoot.value) return
  
  selectingReshoot.value = true
  try {
    await reshootApi.select(candidate.id, store.currentUser.id)
    await loadTask(task.value!.id)
    await loadReshootCandidates(task.value!.id)
    await store.fetchTasks()
  } finally {
    selectingReshoot.value = false
  }
}

async function submitReview() {
  if (rating.value === 0) return
  submitting.value = true
  try {
    await reviewApi.create({
      taskId: task.value!.id,
      userId: store.currentUser.id,
      tags: selectedTags.value,
      rating: rating.value,
      comment: comment.value,
    })
    await store.fetchTasks()
    if (task.value) {
      await loadTask(task.value.id)
    }
  } finally {
    submitting.value = false
  }
}
</script>
