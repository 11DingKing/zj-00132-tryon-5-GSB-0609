export type TaskStatus =
  | "PENDING"
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "RESHOOT_PENDING";

export interface ReshootCandidate {
  id: number;
  taskId: number;
  parentTaskId: number;
  scene: string;
  cameraAngle: string;
  lighting: string;
  status: TaskStatus;
  progress: number;
  resultImageUrl?: string;
  startedAt?: string;
  completedAt?: string;
  isSelected: boolean;
  createdAt: string;
  task: Task;
}

export interface ModelParameterStats {
  id: number;
  modelId: number;
  skuCategory: string;
  scene: string;
  cameraAngle: string;
  lighting: string;
  totalAttempts: number;
  selectedCount: number;
  avgRating: number;
  winRate: number;
  createdAt: string;
  updatedAt: string;
}

export type Scene = "WHITE" | "STREET" | "BEACH" | "STUDIO";

export type CameraAngle = "FRONT" | "SIDE_45" | "BACK" | "SITTING";

export type LightingPreset = "SOFT" | "DRAMATIC" | "NATURAL" | "STUDIO";

export type ReviewTag =
  | "FIT"
  | "SIZE_ISSUE"
  | "CLIPPING"
  | "LIGHTING_ISSUE"
  | "COLOR_DISTORTION";

export interface Model {
  id: number;
  name: string;
  avatarUrl: string;
  bodyData: string;
  styleTags: string[];
  createdAt: string;
}

export interface SKU {
  id: number;
  name: string;
  category: string;
  sizeRange: string;
  flatImageUrl: string;
  mock3dUrl: string;
  createdAt: string;
}

export interface Review {
  id: number;
  taskId: number;
  userId: number;
  tags: ReviewTag[];
  rating: number;
  comment?: string;
  needsRegen: boolean;
  createdAt: string;
  user?: User;
}

export interface Task {
  id: number;
  modelId: number;
  skuId: number;
  scene: Scene;
  cameraAngle: CameraAngle;
  lighting: LightingPreset;
  status: TaskStatus;
  progress: number;
  resultImageUrl?: string;
  originalImageUrl?: string;
  queuedAt?: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  createdAt: string;
  retryCount: number;
  maxRetries: number;
  errorMessage?: string;
  model: Model;
  sku: SKU;
  reviews: Review[];
}

export interface User {
  id: number;
  username: string;
  role: "OPERATOR" | "AUDITOR" | "DESIGNER";
  createdAt: string;
}

export interface AuditLog {
  id: number;
  userId: number;
  action: string;
  details?: string;
  createdAt: string;
  user: User;
}

export const StatusLabels: Record<TaskStatus, string> = {
  PENDING: "未开始",
  QUEUED: "排队中",
  PROCESSING: "生成中",
  COMPLETED: "已完成",
  FAILED: "失败",
  CANCELLED: "已取消",
  RESHOOT_PENDING: "智能补拍中",
};

export const StatusColors: Record<TaskStatus, string> = {
  PENDING: "#9ca3af",
  QUEUED: "#f59e0b",
  PROCESSING: "#3b82f6",
  COMPLETED: "#22c55e",
  FAILED: "#ef4444",
  CANCELLED: "#6b7280",
  RESHOOT_PENDING: "#8b5cf6",
};

export const SceneLabels: Record<Scene, string> = {
  WHITE: "白底",
  STREET: "街景",
  BEACH: "沙滩",
  STUDIO: "工作室",
};

export const CameraLabels: Record<CameraAngle, string> = {
  FRONT: "正面",
  SIDE_45: "侧45度",
  BACK: "背面",
  SITTING: "坐姿",
};

export const LightingLabels: Record<LightingPreset, string> = {
  SOFT: "柔和",
  DRAMATIC: "戏剧",
  NATURAL: "自然",
  STUDIO: "影棚",
};

export const ReviewTagLabels: Record<ReviewTag, string> = {
  FIT: "贴合",
  SIZE_ISSUE: "版型走样",
  CLIPPING: "穿模",
  LIGHTING_ISSUE: "光照不一致",
  COLOR_DISTORTION: "颜色失真",
};

export const ReviewTagColors: Record<ReviewTag, string> = {
  FIT: "#22c55e",
  SIZE_ISSUE: "#f59e0b",
  CLIPPING: "#ef4444",
  LIGHTING_ISSUE: "#8b5cf6",
  COLOR_DISTORTION: "#f97316",
};
