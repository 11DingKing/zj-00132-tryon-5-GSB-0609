import { defineStore } from "pinia";
import { taskApi, modelApi, skuApi, statsApi, auditApi } from "./api";
import type { Task, Model, SKU, AuditLog } from "./types";
import type { Scene, CameraAngle, LightingPreset } from "./types";

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
        if (grouped[task.status]) {
          grouped[task.status].push(task);
        }
      });
      return grouped;
    },

    pendingTasks: (state) => state.tasks.filter((t) => t.status === "PENDING"),
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
      try {
        await taskApi.cancel(taskId);
        await this.fetchTasks();
      } catch (e) {
        console.error("Failed to cancel task:", e);
      }
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

    startPolling(defaultInterval = 3000) {
      const activeInterval = 1500;
      let timerId: number | null = null;

      const poll = () => {
        const hasActive = this.tasks.some(
          (t) => t.status === "PROCESSING" || t.status === "QUEUED",
        );
        const interval = hasActive ? activeInterval : defaultInterval;
        timerId = window.setTimeout(async () => {
          await this.fetchTasks();
          poll();
        }, interval);
      };

      poll();

      return () => {
        if (timerId !== null) {
          clearTimeout(timerId);
        }
      };
    },
  },
});
