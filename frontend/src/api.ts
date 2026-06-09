import axios from "axios";
import type {
  Task,
  Model,
  SKU,
  Review,
  AuditLog,
  ReshootCandidate,
  ModelParameterStats,
} from "./types";

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

export const taskApi = {
  getAll: () => api.get<Task[]>("/tasks"),
  getById: (id: number) => api.get<Task>(`/tasks/${id}`),
  create: (data: {
    modelIds: number[];
    skuIds: number[];
    scenes: string[];
    cameraAngles: string[];
    lightings: string[];
    maxRetries?: number;
  }) => api.post<Task[]>("/tasks", data),
  enqueue: (taskIds: number[]) => api.post("/tasks/enqueue", { taskIds }),
  cancel: (taskIds: number[]) => api.post("/tasks/cancel", { taskIds }),
  getQueueStats: () => api.get("/tasks/stats/queue"),
  getReshootCandidates: (id: number) =>
    api.get<ReshootCandidate[]>(`/tasks/${id}/reshoot-candidates`),
};

export const modelApi = {
  getAll: () => api.get<Model[]>("/models"),
  getParameterStats: (id: number, category?: string) =>
    api.get<ModelParameterStats[]>(`/models/${id}/parameter-stats`, {
      params: { category },
    }),
};

export const skuApi = {
  getAll: () => api.get<SKU[]>("/skus"),
};

export const reviewApi = {
  create: (data: {
    taskId: number;
    userId: number;
    tags: string[];
    rating: number;
    comment?: string;
  }) => api.post<Review>("/reviews", data),
};

export const reshootApi = {
  select: (id: number, userId: number) =>
    api.post(`/reshoot-candidates/${id}/select`, { userId }),
};

export const statsApi = {
  get: () => api.get("/statistics"),
};

export const auditApi = {
  getLogs: () => api.get<AuditLog[]>("/audit-logs"),
};

export default api;
