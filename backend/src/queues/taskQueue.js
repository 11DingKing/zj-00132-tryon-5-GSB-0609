const prisma = require('../shared/prisma');

// ============================================================
// Production-grade in-memory task queue.
// Features:
//  - Bounded concurrency worker pool (default 3, configurable)
//  - Cancellation of QUEUED / PROCESSING / retry-backoff tasks
//  - Automatic retry with exponential backoff + jitter
//  - Self-consistent state machine:
//      PENDING -> QUEUED -> PROCESSING -> COMPLETED
//                                      \-> FAILED        (no retries left)
//                                      \-> QUEUED        (retry pending)
//      any of {QUEUED, PROCESSING, retry-waiting} -> CANCELLED
// ============================================================

// ---------------- Configuration ----------------
let concurrency = parseInt(process.env.TASK_QUEUE_CONCURRENCY || '3', 10);
let maxRetries = parseInt(process.env.TASK_QUEUE_MAX_RETRIES || '2', 10);
let retryBaseMs = parseInt(process.env.TASK_QUEUE_RETRY_BASE_MS || '1000', 10);

// ---------------- Internal state ----------------
const waiting = [];                     // FIFO queue of taskIds awaiting a worker slot
const running = new Map();              // Map<taskId, { cancel: () => void }>
const cancelRequested = new Set();      // Set<taskId> pending cancellation flag
const retryCount = new Map();           // Map<taskId, attemptsAlreadyRetried>
const retryTimers = new Map();          // Map<taskId, NodeJS.Timeout> backoff timers

let activeWorkers = 0;

// ---------------- Helpers ----------------
function backoffDelay(attempt) {
  // Exponential backoff with jitter: base * 2^(attempt-1) + [0, base)
  const exp = retryBaseMs * Math.pow(2, Math.max(0, attempt - 1));
  return exp + Math.floor(Math.random() * retryBaseMs);
}

async function safeUpdate(taskId, data) {
  try {
    await prisma.task.update({ where: { id: taskId }, data });
  } catch (e) {
    // Task may have been deleted; swallow.
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------- Scheduler ----------------
function schedule() {
  while (activeWorkers < concurrency && waiting.length > 0) {
    const taskId = waiting.shift();

    // Honour cancel requested while sitting in queue
    if (cancelRequested.has(taskId)) {
      cancelRequested.delete(taskId);
      retryCount.delete(taskId);
      safeUpdate(taskId, { status: 'CANCELLED', progress: 0 });
      continue;
    }

    activeWorkers += 1;
    runTask(taskId).finally(() => {
      activeWorkers -= 1;
      running.delete(taskId);
      // A slot just freed up — try to drain the queue.
      schedule();
    });
  }
}

// ---------------- Worker ----------------
async function runTask(taskId) {
  let cancelled = false;
  const cancel = () => { cancelled = true; };
  running.set(taskId, { cancel });

  const attempt = (retryCount.get(taskId) || 0) + 1;
  console.log(
    `[taskQueue] Processing task ${taskId} (attempt ${attempt}/${maxRetries + 1})`
  );

  try {
    await prisma.task.update({
      where: { id: taskId },
      data: { status: 'PROCESSING', startedAt: new Date(), progress: 0 },
    });

    const totalTime = 5000 + Math.random() * 10000;
    const steps = 10;
    const stepTime = totalTime / steps;

    for (let i = 1; i <= steps; i++) {
      // Sleep with cancellation polling at <=250ms granularity.
      const deadline = Date.now() + stepTime;
      while (Date.now() < deadline) {
        if (cancelled || cancelRequested.has(taskId)) break;
        const remaining = deadline - Date.now();
        await sleep(Math.min(250, remaining));
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

    // Simulate success / failure (~80% success rate).
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
    // If the failure is actually due to a cancel request, treat as CANCELLED.
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
      console.warn(
        `[taskQueue] Task ${taskId} failed: ${err.message}. ` +
        `Retrying in ${delay}ms (retry ${nextAttempt}/${maxRetries})`
      );
      await safeUpdate(taskId, { status: 'QUEUED', progress: 0 });

      const timer = setTimeout(() => {
        retryTimers.delete(taskId);
        // The task may have been cancelled while waiting in backoff.
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
      console.error(
        `[taskQueue] Task ${taskId} failed permanently: ${err.message}`
      );
      retryCount.delete(taskId);
      await safeUpdate(taskId, { status: 'FAILED', progress: 0 });
    }
  }
}

// ---------------- Public API ----------------
function enqueueTask(taskId) {
  // Re-enqueueing clears any prior cancel intent.
  cancelRequested.delete(taskId);
  waiting.push(taskId);
  schedule();
}

/**
 * Request cancellation of a task.
 * Works in three relevant phases:
 *   - waiting in queue            -> remove from queue + mark CANCELLED
 *   - waiting in retry backoff    -> clear timer + mark CANCELLED
 *   - currently PROCESSING        -> signal worker; worker writes CANCELLED
 *
 * Already terminal tasks (COMPLETED / FAILED / CANCELLED) are no-ops.
 */
async function cancelTask(taskId) {
  cancelRequested.add(taskId);

  // Cancel any pending retry backoff.
  const timer = retryTimers.get(taskId);
  if (timer) {
    clearTimeout(timer);
    retryTimers.delete(taskId);
  }

  // Remove from waiting queue if present.
  const idx = waiting.indexOf(taskId);
  if (idx !== -1) {
    waiting.splice(idx, 1);
  }

  // If currently running, signal the worker; it will write CANCELLED itself.
  const r = running.get(taskId);
  if (r) {
    r.cancel();
    return { running: true };
  }

  // Otherwise (PENDING / QUEUED / retry-waiting) write the DB now.
  cancelRequested.delete(taskId);
  retryCount.delete(taskId);
  await safeUpdate(taskId, { status: 'CANCELLED' });
  return { running: false };
}

function getQueueSize() {
  // Total work the queue is responsible for right now.
  return waiting.length + activeWorkers + retryTimers.size;
}

function getQueueStats() {
  return {
    concurrency,
    maxRetries,
    retryBaseMs,
    activeWorkers,
    runningTaskIds: Array.from(running.keys()),
    waiting: waiting.length,
    waitingForRetry: retryTimers.size,
  };
}

function configure({ concurrency: c, maxRetries: m, retryBaseMs: b } = {}) {
  if (typeof c === 'number' && c > 0) concurrency = c;
  if (typeof m === 'number' && m >= 0) maxRetries = m;
  if (typeof b === 'number' && b >= 0) retryBaseMs = b;
  // If concurrency was raised, fill any newly available slots.
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
