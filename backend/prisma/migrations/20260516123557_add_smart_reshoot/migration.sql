-- CreateTable
CREATE TABLE "ReshootCandidate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "taskId" INTEGER NOT NULL,
    "parentTaskId" INTEGER NOT NULL,
    "scene" TEXT NOT NULL,
    "cameraAngle" TEXT NOT NULL,
    "lighting" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "resultImageUrl" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReshootCandidate_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReshootCandidate_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ModelParameterStats" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "modelId" INTEGER NOT NULL,
    "skuCategory" TEXT NOT NULL,
    "scene" TEXT NOT NULL,
    "cameraAngle" TEXT NOT NULL,
    "lighting" TEXT NOT NULL,
    "totalAttempts" INTEGER NOT NULL DEFAULT 0,
    "selectedCount" INTEGER NOT NULL DEFAULT 0,
    "avgRating" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ModelParameterStats_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Task" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "modelId" INTEGER NOT NULL,
    "skuId" INTEGER NOT NULL,
    "scene" TEXT NOT NULL,
    "cameraAngle" TEXT NOT NULL,
    "lighting" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "resultImageUrl" TEXT,
    "originalImageUrl" TEXT,
    "queuedAt" DATETIME,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isReshoot" BOOLEAN NOT NULL DEFAULT false,
    "reshootGroupId" TEXT,
    CONSTRAINT "Task_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "SKU" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("cameraAngle", "completedAt", "createdAt", "id", "lighting", "modelId", "originalImageUrl", "progress", "queuedAt", "resultImageUrl", "scene", "skuId", "startedAt", "status") SELECT "cameraAngle", "completedAt", "createdAt", "id", "lighting", "modelId", "originalImageUrl", "progress", "queuedAt", "resultImageUrl", "scene", "skuId", "startedAt", "status" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ModelParameterStats_modelId_skuCategory_scene_cameraAngle_lighting_key" ON "ModelParameterStats"("modelId", "skuCategory", "scene", "cameraAngle", "lighting");
