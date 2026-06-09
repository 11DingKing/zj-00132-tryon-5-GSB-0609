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
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "errorMessage" TEXT,
    "cancelledAt" DATETIME,
    CONSTRAINT "Task_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "SKU" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("cameraAngle", "completedAt", "createdAt", "id", "isReshoot", "lighting", "modelId", "originalImageUrl", "progress", "queuedAt", "reshootGroupId", "resultImageUrl", "scene", "skuId", "startedAt", "status") SELECT "cameraAngle", "completedAt", "createdAt", "id", "isReshoot", "lighting", "modelId", "originalImageUrl", "progress", "queuedAt", "reshootGroupId", "resultImageUrl", "scene", "skuId", "startedAt", "status" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
