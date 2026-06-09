<template>
  <div>
    <nav class="nav">
      <h1>👔 AI 虚拟试衣任务编排平台</h1>
      <div class="nav-links">
        <router-link to="/">看板</router-link>
        <router-link to="/create">创建任务</router-link>
        <router-link to="/statistics">统计</router-link>
        <span>{{ store.currentUser.username }} ({{ store.currentUser.role }})</span>
      </div>
    </nav>
    <div class="container">
      <router-view />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useStore } from './store'

const store = useStore()
let stopPolling: (() => void) | null = null

onMounted(async () => {
  await store.fetchAll()
  stopPolling = store.startPolling()
})

onUnmounted(() => {
  if (stopPolling) stopPolling()
})
</script>
