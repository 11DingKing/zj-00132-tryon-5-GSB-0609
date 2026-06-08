const prisma = require('../shared/prisma');

const taskQueue = [];
let isProcessing = false;

async function processTaskQueue() {
  if (isProcessing || taskQueue.length === 0) return;
  isProcessing = true;

  const taskId = taskQueue.shift();
  console.log(`Processing task ${taskId}...`);

  try {
    await prisma.task.update({
      where: { id: taskId },
      data: { status: 'PROCESSING', startedAt: new Date() },
    });

    const totalTime = 5000 + Math.random() * 10000;
    const steps = 10;
    const stepTime = totalTime / steps;

    for (let i = 1; i <= steps; i++) {
      await new Promise(resolve => setTimeout(resolve, stepTime));
      await prisma.task.update({
        where: { id: taskId },
        data: { progress: i * 10 },
      });
    }

    const success = Math.random() > 0.1;
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: success ? 'COMPLETED' : 'FAILED',
        progress: 100,
        resultImageUrl: success ? `https://picsum.photos/seed/task${taskId}/800/1000` : null,
        completedAt: success ? new Date() : null,
      },
    });

    console.log(`Task ${taskId} ${success ? 'completed' : 'failed'}`);
  } catch (error) {
    console.error(`Error processing task ${taskId}:`, error);
    try {
      await prisma.task.update({
        where: { id: taskId },
        data: { status: 'FAILED', progress: 0 },
      });
    } catch (e) {}
  }

  isProcessing = false;
  setTimeout(processTaskQueue, 500);
}

function enqueueTask(taskId) {
  taskQueue.push(taskId);
  processTaskQueue();
}

function getQueueSize() {
  return taskQueue.length;
}

module.exports = {
  enqueueTask,
  getQueueSize,
};
