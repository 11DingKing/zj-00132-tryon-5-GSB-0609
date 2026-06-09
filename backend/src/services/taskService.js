const prisma = require("../shared/prisma");
const {
  enqueueTask,
  cancelTask: queueCancelTask,
} = require("../queues/taskQueue");
const { createAuditLog } = require("./auditLogService");
const { serializeTasks, serializeTask } = require("../helpers/serializer");

async function createTasks(modelIds, skuIds, scenes, cameraAngles, lightings) {
  const tasks = [];
  for (const modelId of modelIds) {
    for (const skuId of skuIds) {
      for (const scene of scenes) {
        for (const cameraAngle of cameraAngles) {
          for (const lighting of lightings) {
            tasks.push({
              modelId,
              skuId,
              scene,
              cameraAngle,
              lighting,
              status: "PENDING",
              originalImageUrl: `https://picsum.photos/seed/orig${Date.now()}${tasks.length}/800/1000`,
            });
          }
        }
      }
    }
  }

  const createdTasks = await prisma.$transaction(
    tasks.map((task) => prisma.task.create({ data: task })),
  );

  await createAuditLog(
    1,
    "CREATE_TASKS",
    `Created ${createdTasks.length} tasks`,
  );

  return createdTasks;
}

async function enqueueTasks(taskIds) {
  await prisma.task.updateMany({
    where: {
      id: { in: taskIds },
      status: { in: ["PENDING", "FAILED", "CANCELLED"] },
    },
    data: { status: "QUEUED", queuedAt: new Date() },
  });

  taskIds.forEach((id) => enqueueTask(id));

  await createAuditLog(1, "ENQUEUE_TASKS", `Enqueued ${taskIds.length} tasks`);

  return { success: true, queued: taskIds.length };
}

async function cancelTask(taskId) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    return { success: false, error: "Task not found" };
  }

  if (!["QUEUED", "PROCESSING"].includes(task.status)) {
    return {
      success: false,
      error: `Cannot cancel task in ${task.status} state`,
    };
  }

  const cancelled = queueCancelTask(taskId);

  await createAuditLog(1, "CANCEL_TASK", `Cancelled task ${taskId}`);

  return { success: cancelled, taskId };
}

async function getAllTasks() {
  const tasks = await prisma.task.findMany({
    include: { model: true, sku: true, reviews: true },
    orderBy: { createdAt: "desc" },
  });
  return serializeTasks(tasks);
}

async function getTaskById(id) {
  const task = await prisma.task.findUnique({
    where: { id },
    include: { model: true, sku: true, reviews: { include: { user: true } } },
  });
  if (task) {
    return serializeTask(task);
  }
  return null;
}

async function getReshootCandidates(taskId) {
  return prisma.reshootCandidate.findMany({
    where: { parentTaskId: taskId },
    include: { task: true },
    orderBy: { createdAt: "asc" },
  });
}

module.exports = {
  createTasks,
  enqueueTasks,
  cancelTask,
  getAllTasks,
  getTaskById,
  getReshootCandidates,
};
