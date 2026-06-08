<template>
  <div>
    <h2 class="page-title" style="margin-bottom: 1.5rem">批量创建任务</h2>

    <div class="detail-card">
      <div class="form-group">
        <label class="form-label">选择模特</label>
        <div class="checkbox-group">
          <label v-for="model in store.models" :key="model.id" class="checkbox-item">
            <input type="checkbox" v-model="selectedModels" :value="model.id" />
            {{ model.name }}
          </label>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">选择 SKU</label>
        <div class="checkbox-group">
          <label v-for="sku in store.skus" :key="sku.id" class="checkbox-item">
            <input type="checkbox" v-model="selectedSkus" :value="sku.id" />
            {{ sku.name }} ({{ sku.category }})
          </label>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">选择场景</label>
        <div class="checkbox-group">
          <label v-for="(label, value) in SceneLabels" :key="value" class="checkbox-item">
            <input type="checkbox" v-model="selectedScenes" :value="value" />
            {{ label }}
          </label>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">选择镜头角度</label>
        <div class="checkbox-group">
          <label v-for="(label, value) in CameraLabels" :key="value" class="checkbox-item">
            <input type="checkbox" v-model="selectedCameras" :value="value" />
            {{ label }}
          </label>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">选择光照预设</label>
        <div class="checkbox-group">
          <label v-for="(label, value) in LightingLabels" :key="value" class="checkbox-item">
            <input type="checkbox" v-model="selectedLightings" :value="value" />
            {{ label }}
          </label>
        </div>
      </div>

      <div style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #e5e7eb">
        <div style="margin-bottom: 1rem; font-size: 1.1rem">
          预计创建任务数: <strong style="color: #3b82f6; font-size: 1.5rem">{{ estimatedCount }}</strong>
        </div>
        <button
          class="btn btn-primary"
          @click="createTasks"
          :disabled="!canCreate || creating"
          style="font-size: 1rem; padding: 0.75rem 2rem"
        >
          {{ creating ? '创建中...' : '创建任务' }}
        </button>
        <p v-if="!canCreate" style="margin-top: 0.5rem; color: #ef4444; font-size: 0.875rem">
          请至少选择 1 个模特、1 个 SKU、1 个场景、1 个镜头和 1 个光照
        </p>
      </div>
    </div>

    <div v-if="success" style="margin-top: 1.5rem">
      <div class="detail-card" style="background: #dcfce7; border: 1px solid #86efac">
        <h3 style="color: #166534; margin-bottom: 1rem">✅ 任务创建成功</h3>
        <p style="margin-bottom: 1rem">已创建 {{ createdTasks.length }} 个任务</p>
        <div style="display: flex; gap: 0.5rem">
          <button class="btn btn-success" @click="enqueueAll">
            全部加入队列
          </button>
          <button class="btn" @click="reset">
            创建更多任务
          </button>
          <button class="btn" @click="$router.push('/')">
            返回看板
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useStore } from '../store'
import { SceneLabels, CameraLabels, LightingLabels } from '../types'

const router = useRouter()
const store = useStore()

const selectedModels = ref<number[]>([])
const selectedSkus = ref<number[]>([])
const selectedScenes = ref<string[]>([])
const selectedCameras = ref<string[]>([])
const selectedLightings = ref<string[]>([])
const creating = ref(false)
const success = ref(false)
const createdTasks = ref<any[]>([])

const estimatedCount = computed(() => {
  return selectedModels.value.length *
    selectedSkus.value.length *
    selectedScenes.value.length *
    selectedCameras.value.length *
    selectedLightings.value.length
})

const canCreate = computed(() => {
  return selectedModels.value.length > 0 &&
    selectedSkus.value.length > 0 &&
    selectedScenes.value.length > 0 &&
    selectedCameras.value.length > 0 &&
    selectedLightings.value.length > 0
})

async function createTasks() {
  if (!canCreate.value) return
  creating.value = true
  try {
    const tasks = await store.createTasks(
      selectedModels.value,
      selectedSkus.value,
      selectedScenes.value as any,
      selectedCameras.value as any,
      selectedLightings.value as any
    )
    createdTasks.value = tasks
    success.value = true
  } finally {
    creating.value = false
  }
}

async function enqueueAll() {
  await store.enqueueTasks(createdTasks.value.map((t: any) => t.id))
  router.push('/')
}

function reset() {
  selectedModels.value = []
  selectedSkus.value = []
  selectedScenes.value = []
  selectedCameras.value = []
  selectedLightings.value = []
  success.value = false
  createdTasks.value = []
}
</script>
