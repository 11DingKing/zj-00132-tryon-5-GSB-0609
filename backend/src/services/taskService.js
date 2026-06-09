const prisma = require("../shared/prisma");
const { enqueueTask, cancelTask } = require("../queues/taskQueue");
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
  // Only re-enqueue tasks that are in a re-queueable state.
  const updatable = await prisma.task.findMany({
    where: {
      id: { in: taskIds },
      status: { in: ["PENDING", "FAILED", "CANCELLED"] },
    },
    select: { id: true },
  });
  const ids = updatable.map((t) => t.id);

  if (ids.length > 0) {
    await prisma.task.updateMany({
      where: { id: { in: ids } },
      data: {
        status: "QUEUED",
        queuedAt: new Date(),
        progress: 0,
        resultImageUrl: null,
        startedAt: null,
        completedAt: null,
      },
    });
    ids.forEach((id) => enqueueTask(id));
  }

  await createAuditLog(1, "ENQUEUE_TASKS", `Enqueued ${ids.length} tasks`);

  return {
    success: true,
    queued: ids.length,
    skipped: taskIds.length - ids.length,
  };
}

async function cancelTasks(taskIds) {
  // Skip tasks that already finished
  const cancellable = await prisma.task.findMany({
    where: {
      id: { in: taskIds },
      status: { in: ["PENDING", "QUEUED", "PROCESSING"] },
    },
    select: { id: true },
  });
  const ids = cancellable.map((t) => t.id);

  // Ask the in-process queue to stop them; the queue itself updates DB
  // for QUEUED / PROCESSING states. We still mark PENDING ones explicitly
  // so any never-enqueued task is also cancelled.
  await Promise.all(ids.map((id) => cancelTask(id)));

  // For any PENDING task that was never sent to the queue, ensure DB is updated.
  await prisma.task.updateMany({
    where: { id: { in: ids }, status: { in: ["PENDING", "QUEUED"] } },
    data: { status: "CANCELLED" },
  });

  await createAuditLog(1, "CANCEL_TASKS", `Cancelled ${ids.length} tasks`);

  return {
    success: true,
    cancelled: ids.length,
    skipped: taskIds.length - ids.length,
  };
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
  cancelTasks,
  getAllTasks,
  getTaskById,
  getReshootCandidates,
};
