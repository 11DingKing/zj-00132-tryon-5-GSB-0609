const prisma = require("../shared/prisma");
const { enqueueTask, cancelTask } = require("../queues/taskQueue");
const { createAuditLog } = require("./auditLogService");
const { serializeTasks, serializeTask } = require("../helpers/serializer");

async function createTasks(
  modelIds,
  skuIds,
  scenes,
  cameraAngles,
  lightings,
  options = {},
) {
  const tasks = [];
  const maxRetries = options.maxRetries ?? 3;

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
              maxRetries,
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
  const tasks = await prisma.task.findMany({
    where: { id: { in: taskIds }, status: "PENDING" },
    select: { id: true },
  });

  const validTaskIds = tasks.map((t) => t.id);

  if (validTaskIds.length === 0) {
    return { success: true, queued: 0 };
  }

  await prisma.task.updateMany({
    where: { id: { in: validTaskIds } },
    data: { status: "QUEUED", queuedAt: new Date() },
  });

  validTaskIds.forEach((id) => enqueueTask(id));

  await createAuditLog(
    1,
    "ENQUEUE_TASKS",
    `Enqueued ${validTaskIds.length} tasks`,
  );

  return { success: true, queued: validTaskIds.length };
}

async function cancelTasks(taskIds) {
  const results = [];

  for (const taskId of taskIds) {
    const success = await cancelTask(taskId);
    if (success) {
      results.push(taskId);
    }
  }

  await createAuditLog(1, "CANCEL_TASKS", `Cancelled ${results.length} tasks`);

  return { success: true, cancelled: results.length, taskIds: results };
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
