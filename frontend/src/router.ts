import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from './views/Dashboard.vue'
import TaskDetail from './views/TaskDetail.vue'
import Statistics from './views/Statistics.vue'
import CreateTasks from './views/CreateTasks.vue'

const routes = [
  { path: '/', name: 'Dashboard', component: Dashboard },
  { path: '/task/:id', name: 'TaskDetail', component: TaskDetail },
  { path: '/statistics', name: 'Statistics', component: Statistics },
  { path: '/create', name: 'CreateTasks', component: CreateTasks },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
