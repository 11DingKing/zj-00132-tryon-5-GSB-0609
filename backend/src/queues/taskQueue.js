const prisma = require("../shared/prisma");

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
      data: { status: "PROCESSING", startedAt: new Date() },
    });

    const totalTime = 5000 + Math.random() * 10000;
    const steps = 10;
    const stepTime = totalTime / steps;

    for (let i = 1; i <= steps; i++) {
      await new Promise((resolve) => setTimeout(resolve, stepTime));
      await prisma.task.update({
        where: { id: taskId },
        data: { progress: i * 10 },
      });
    }

    const success = Math.random() > 0.1;
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: success ? "COMPLETED" : "FAILED",
        progress: 100,
        resultImageUrl: success
          ? `https://picsum.photos/seed/task${taskId}/800/1000`
          : null,
        completedAt: success ? new Date() : null,
      },
    });

    console.log(`Task ${taskId} ${success ? "completed" : "failed"}`);
  } catch (error) {
    console.error(`Error processing task ${taskId}:`, error);
    try {
      await prisma.task.update({
        where: { id: taskId },
        data: { status: "FAILED"Id)) {
      cancelRequested.delete(taskId);
      retryCount.delete(taskId);
      safeUpdate(taskId, { status: 'CANCELLED', progress: 0 });
      continue;
    }

    activeWorkers += 1;
    runTask(taskId).finally(() => {
      activeWorkers -= 1;
      running.delete(taskId);
      // Drain any newly free slot
      schedule();
    });
  }
}

// ---------------- Worker ----------------
async function runTask(taskId) {
  let cancelled = false;
  const cancel = () => { cancelled = true; };
  running.set(taskId, { cancel, retries: retryCount.get(taskId) || 0, startedAt: Date.now() });

  const attempt = (retryCount.get(taskId) || 0) + 1;
  console.log(`[taskQueue] Processing task ${taskId} (attempt ${attempt}/${maxRetries + 1})`);

  try {
    await prisma.task.update({
      where: { id: taskId },
      data: { status: 'PROCESSING', startedAt: new Date(), progress: 0 },
    });

    const totalTime = 5000 + Math.random() * 10000;
    const steps = 10;
    const stepTime = totalTime / steps;

    for (let i = 1; i <= steps; i++) {
      // Sleep with cancellation polling (250ms granularity)
      const deadline = Date.now() + stepTime;
      while (Date.now() < deadline) {
        if (cancelled || cancelRequested.has(taskId)) break;
        await new Promise(r => setTimeout(r, Math.min(250, deadline - Date.now())));
      }
      if (cancelled || cancelRequested.has(taskId)) {
        cancelRequested.delete(taskId);
        retryCount.delete(taskId);
        await safeUpdate(taskId, { status: 'CANCELLED', progress: i * 10 });
        console.log(`[taskQueue] Task ${taskId} cancelled mid-flight`);
        return;
      }
      await safeUpdate(taskId, { progress: i * 10 });
    }

    // Simulate success/failure
    const success = Math.random() > 0.2;
    if (!success) {
      throw new Error('Simulated generation failure');
    }

    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'COMPLETED',
        progress: 100,
        resultImageUrl: `https://picsum.photos/seed/task${taskId}/800/1000`,
        completedAt: new Date(),
      },
    });
    retryCount.delete(taskId);
    console.log(`[taskQueue] Task ${taskId} completed`);
  } catch (err) {
    if (cancelled || cancelRequested.has(taskId)) {
      cancelRequested.delete(taskId);
      retryCount.delete(taskId);
      await safeUpdate(taskId, { status: 'CANCELLED' });
      return;
    }

    const currentRetries = retryCount.get(taskId) || 0;
    if (currentRetries < maxRetries) {
      const nextAttempt = currentRetries + 1;
      retryCount.set(taskId, nextAttempt);
      const delay = backoffDelay(nextAttempt);
      console.warn(`[taskQueue] Task ${taskId} failed: ${err.message}. Retrying in ${delay}ms (attempt ${nextAttempt}/${maxRetries})`);
      await safeUpdate(taskId, { status: 'QUEUED', progress: 0 });
      const timer = setTimeout(() => {
        retryTimers.delete(taskId);
        if (cancelRequested.has(taskId)) {
          cancelRequested.delete(taskId);
          retryCount.delete(taskId);
          safeUpdate(taskId, { status: 'CANCELLED' });
          return;
        }
        waiting.push(taskId);
        schedule();
      }, delay);
      retryTimers.set(taskId, timer);
    } else {
      console.error(`[taskQueue] Task ${taskId} failed permanently: ${err.message}`);
      retryCount.delete(taskId);
      await safeUpdate(taskId, { status: 'FAILED', progress: 0 });
    }
  }
}

// ---------------- Public API ----------------
function enqueueTask(taskId) {
  if (cancelRequested.has(taskId)) cancelRequested.delete(taskId);
  waiting.push(taskId);
  schedule();
}

/**
 * Request cancellation of a task. Works for QUEUED, PROCESSING, and tasks
 * waiting in retry back-off. Returns true if state was affected.
 */
async function cancelTask(taskId) {
  cancelRequested.add(taskId);

  // If currently waiting in retry back-off, clear timer
  const t = retryTimers.get(taskId);
  if (t) {
    clearTimeout(t);
    retryTimers.delete(taskId);
  }

  // If queued (waiting), remove from queue
  const idx = waiting.indexOf(taskId);
  if (idx !== -1) {
    waiting.splice(idx, 1);
  }

  // If processing, signal worker
  const r = running.get(taskId);
  if (r) {
    r.cancel();
    return { running: true };
  }

  // Otherwise update DB right away (PENDING / QUEUED / waiting-for-retry)
  cancelRequested.delete(taskId);
  retryCount.delete(taskId);
  await safeUpdate(taskId, { status: 'CANCELLED' });
  return { running: false };
}

function getQueueStats() {
  return {
    concurrency,
    maxRetries,
    activeWorkers,
    runningTaskIds: Array.from(running.keys()),
    waiting: waiting.length,
    waitingForRetry: retryTimers.size,
  };
}

function getQueueSize() {
  return waiting.length + activeWorkers;
}

function configure({ concurrency: c, maxRetries: m, retryBaseMs: b } = {}) {
  if (typeof c === 'number' && c > 0) concurrency = c;
  if (typeof m === 'number' && m >= 0) maxRetries = m;
  if (typeof b === 'number' && b >= 0) retryBaseMs = b;
  schedule();
  return getQueueStats();
}

module.exports = {
  enqueueTask,
  cancelTask,
  getQueueSize,
  getQueueStats,
  configure,
};
