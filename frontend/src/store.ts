import { defineStore } from "pinia";
import { taskApi, modelApi, skuApi, statsApi, auditApi, queueApi } from "./api";
import type { Task, Model, SKU, AuditLog } from "./types";
import type { Scene, CameraAngle, LightingPreset } from "./types";

export interface QueueStats {
  concurrency: number;
  maxRetries: number;
  activeWorkers: number;
  runningTaskIds: number[];
  waiting: number;
  waitingForRetry: number;
}

export const useStore = defineStore("main", {
  state: () => ({
    tasks: [] as Task[],
    models: [] as Model[],
    skus: [] as SKU[],
    auditLogs: [] as AuditLog[],
    statistics: null as any,
    loading: false,
    currentUser: { id: 1, username: "operator", role: "OPERATOR" },
    selectedTaskIds: [] as number[],
    queueStats: null as QueueStats | null,
    pollingTimer: null as ReturnType<typeof setInterval> | null,
  }),

  getters: {
    tasksByStatus: (state) => {
      const grouped: Record<string, Task[]> = {
        PENDING: [],
        QUEUED: [],
        PROCESSING: [],
        COMPLETED: [],
        FAILED: [],
        CANCELLED: [],
      };
      state.tasks.forEach((task) => {
        if (grouped[task.status]) grouped[task.status].push(task);
      });
      return grouped;
    },

    pendingTasks: (state) => state.tasks.filter((t) => t.status === "PENDING"),
    activeTasks: (state) =>
      state.tasks.filter(
        (t) => t.status === "PROCESSING" || t.status === "QUEUED",
      ),
  },

  actions: {
    async fetchAll() {
      this.loading = true;
      try {
        const [tasksRes, modelsRes, skusRes] = await Promise.all([
          taskApi.getAll(),
          modelApi.getAll(),
          skuApi.getAll(),
        ]);
        this.tasks = tasksRes.data;
        this.models = modelsRes.data;
        this.skus = skusRes.data;
      } finally {
        this.loading = false;
      }
    },

    async fetchTasks() {
      const res = await taskApi.getAll();
      this.tasks = res.data;
    },

    async fetchQueueStats() {
      try {
        const res = await queueApi.getStats();
        this.queueStats = res.data;
      } catch (e) {
        // ignore
      }
    },

    async fetchModels() {
      const res = await modelApi.getAll();
      this.models = res.data;
    },

    async fetchSkus() {
      const res = await skuApi.getAll();
      this.skus = res.data;
    },

    async fetchStatistics() {
      const res = await statsApi.get();
      this.statistics = res.data;
    },

    async fetchAuditLogs() {
      const res = await auditApi.getLogs();
      this.auditLogs = res.data;
    },

    async createTasks(
      modelIds: number[],
      skuIds: number[],
      scenes: Scene[],
      cameraAngles: CameraAngle[],
      lightings: LightingPreset[],
    ) {
      const res = await taskApi.create({
        modelIds,
        skuIds,
        scenes,
        cameraAngles,
        lightings,
      });
      this.tasks = [...res.data, ...this.tasks];
      return res.data;
    },

    async enqueueTasks(taskIds: number[]) {
      await taskApi.enqueue(taskIds);
      await this.fetchTasks();
    },

    async cancelTask(taskId: number) {
      await taskApi.cancelOne(taskId);
      await this.fetchTasks();
    },

    async cancelTasks(taskIds: number[]) {
      if (taskIds.length === 0) return;
      await taskApi.cancel(taskIds);
      await this.fetchTasks();
    },

    toggleTaskSelection(taskId: number) {
      const idx = this.selectedTaskIds.indexOf(taskId);
      if (idx > -1) {
        this.selectedTaskIds.splice(idx, 1);
      } else {
        this.selectedTaskIds.push(taskId);
      }
    },

    clearSelection() {
      this.selectedTaskIds = [];
    },

    /**
     * Adaptive polling: use a tighter cadence (1.2s) when there is
     * any in-flight work so progress bars update smoothly; otherwise
     * fall back to the slower interval.
     */
    startPolling(idleInterval = 3000, busyInterval = 1200) {
      this.stopPolling();
      const tick = async () => {
        await Promise.all([this.fetchTasks(), this.fetchQueueStats()]);
        const busy = this.queueStats
          ? this.queueStats.activeWorkers > 0 || this.queueStats.waiting > 0
          : this.tasks.some(
              (t) => t.status === "PROCESSING" || t.status === "QUEUED",
            );
        const next = busy ? busyInterval : idleInterval;
        this.pollingTimer = setTimeout(tick, next) as unknown as ReturnType<
          typeof setInterval
        >;
      };
      tick();
      return () => this.stopPolling();
    },

    stopPolling() {
      if (this.pollingTimer) {
        clearTimeout(
          this.pollingTimer as unknown as ReturnType<typeof setTimeout>,
        );
        this.pollingTimer = null;
      }
    },
  },
});
