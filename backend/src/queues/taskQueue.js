const prisma = require('../shared/prisma');

const CONFIG = {
  maxConcurrency: 3,
  maxRetries: 3,
  baseBackoffMs: 1000,
  pollIntervalMs: 200,
};

const taskQueue = [];
const activeWorkers = new Map();
const retryCount = new Map();
const cancelRequested = new Set();
let pollingTimer = null;

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    if (signal) {
      const onAbort = () => {
        clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      if (signal.aborted) {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      } else {
        signal.addEventListener('abort', onAbort);
      }
    }
  });
}

async function executeTaskRun(taskId, signal) {
  const totalTime = 5000 + Math.random() * 10000;
  const steps = 10;
  const stepTime = totalTime / steps;

  for (let i = 1; i <= steps; i++) {
    if (signal.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    await sleep(stepTime, signal);
    if (signal.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    await prisma.task.update({
      where: { id: taskId },
      data: { progress: i * 10 },
    });
  }

  const success = Math.random() > 0.1;
  if (!success) {
    throw new Error('Task generation failed');
  }

  return {
    status: 'COMPLETED',
    progress: 100,
    resultImageUrl: `https://picsum.photos/seed/task${taskId}/800/1000`,
    completedAt: new Date(),
  };
}

async function runWorker(taskId) {
  const abortController = new AbortController();
  activeWorkers.set(taskId, abortController);

  try {
    if (cancelRequested.has(taskId)) {
      await prisma.task.update({
        where: { id: taskId },
        data: { status: 'CANCELLED' },
      });
      return;
    }

    await prisma.task.update({
      where: { id: taskId },
      data: { status: 'PROCESSING', startedAt: new Date(), progress: 0 },
    });

    const result = await executeTaskRun(taskId, abortController.signal);

    await prisma.task.update({
      where: { id: taskId },
      data: result,
    });

    console.log(`Task ${taskId} completed`);
  } catch (error) {
    if (error.name === 'AbortError' || cancelRequested.has(taskId)) {
      await prisma.task.update({
        where: { id: taskId },
        data: { status: 'CANCELLED' },
      });
      console.log(`Task ${taskId} cancelled`);
      return;
    }

    const attempts = (retryCount.get(taskId) || 0) + 1;
    retryCount.set(taskId, attempts);

    if (attempts <= CONFIG.maxRetries) {
      const backoff = CONFIG.baseBackoffMs * Math.pow(2, attempts - 1);
      console.log(`Task ${taskId} failed (attempt ${attempts}/${CONFIG.maxRetries}), retrying in ${backoff}ms...`);

      await prisma.task.update({
        where: { id: taskId },
        data: { status: 'QUEUED', progress: 0 },
      });

      setTimeout(() => {
        if (!cancelRequested.has(taskId)) {
          taskQueue.unshift(taskId);
        }
      }, backoff);
    } else {
      console.log(`Task ${taskId} failed after ${attempts} attempts, marking FAILED`);
      await prisma.task.update({
        where: { id: taskId },
        data: { status: 'FAILED', progress: 0 },
      });
      retryCount.delete(taskId);
    }
  } finally {
    activeWorkers.delete(taskId);
    cancelRequested.delete(taskId);
  }
}

function dispatchWorkers() {
  while (activeWorkers.size < CONFIG.maxConcurrency && taskQueue.length > 0) {
    const taskId = taskQueue.shift();
    if (cancelRequested.has(taskId)) {
      prisma.task.update({
        where: { id: taskId },
        data: { status: 'CANCELLED' },
      }).catch(() => {});
      cancelRequested.delete(taskId);
      continue;
    }
    runWorker(taskId);
  }
}

function startPolling() {
  if (pollingTimer) return;
  pollingTimer = setInterval(dispatchWorkers, CONFIG.pollIntervalMs);
}

function enqueueTask(taskId) {
  cancelRequested.delete(taskId);
  retryCount.delete(taskId);
  taskQueue.push(taskId);
  startPolling();
  dispatchWorkers();
}

function cancelTask(taskId) {
  cancelRequested.add(taskId);

  const queuedIdx = taskQueue.indexOf(taskId);
  if (queuedIdx !== -1) {
    taskQueue.splice(queuedIdx, 1);
    prisma.task.update({
      where: { id: taskId },
      data: { status: 'CANCELLED' },
    }).catch(() => {});
    cancelRequested.delete(taskId);
    return true;
  }

  if (activeWorkers.has(taskId)) {
    const controller = activeWorkers.get(taskId);
    controller.abort();
    return true;
  }

  return false;
}

function getQueueStats() {
  return {
    queued: taskQueue.length,
    active: activeWorkers.size,
    maxConcurrency: CONFIG.maxConcurrency,
    activeTaskIds: Array.from(activeWorkers.keys()),
  };
}

module.exports = {
  enqueueTask,
  cancelTask,
  getQueueStats,
  CONFIG,
};
