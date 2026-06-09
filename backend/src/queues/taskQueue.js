const prisma = require("../shared/prisma");

const CONCURRENCY = parseInt(process.env.QUEUE_CONCURRENCY, 10) || 3;
const MAX_RETRIES = parseInt(process.env.QUEUE_MAX_RETRIES, 10) || 3;
const BASE_RETRY_DELAY =
  parseInt(process.env.QUEUE_BASE_RETRY_DELAY, 10) || 2000;

class TaskQueue {
  constructor() {
    this.queue = [];
    this.activeWorkers = 0;
    this.cancelledSet = new Set();
    this.abortControllers = new Map();
  }

  enqueue(taskId) {
    if (this.cancelledSet.has(taskId)) return;
    const exists = this.queue.some((e) => e.taskId === taskId);
    if (exists) return;
    this.queue.push({ taskId, enqueuedAt: Date.now() });
    this._schedule();
  }

  enqueueMany(taskIds) {
    for (const id of taskIds) {
      this.enqueue(id);
    }
  }

  async cancelTask(taskId) {
    this.cancelledSet.add(taskId);

    const queueIdx = this.queue.findIndex((e) => e.taskId === taskId);
    if (queueIdx !== -1) {
      this.queue.splice(queueIdx, 1);
    }

    const controller = this.abortControllers.get(taskId);
    if (controller && !controller.signal.aborted) {
      controller.abort();
    }

    await prisma.task
      .update({
        where: { id: taskId },
        data: { status: "CANCELLED", completedAt: new Date() },
      })
      .catch(() => {});

    return true;
  }

  getQueueInfo() {
    return {
      queued: this.queue.length,
      active: this.activeWorkers,
      concurrency: CONCURRENCY,
      maxRetries: MAX_RETRIES,
    };
  }

  _schedule() {
    while (this.activeWorkers < CONCURRENCY && this.queue.length > 0) {
      const entry = this.queue.shift();
      if (this.cancelledSet.has(entry.taskId)) continue;
      this.activeWorkers++;
      this._runWorker(entry.taskId).finally(() => {
        this.activeWorkers--;
        this._schedule();
      });
    }
  }

  async _runWorker(taskId) {
    const controller = new AbortController();
    this.abortControllers.set(taskId, controller);

    try {
      if (this.cancelledSet.has(taskId)) return;

      const preCheck = await prisma.task.findUnique({ where: { id: taskId } });
      if (!preCheck || preCheck.status === "CANCELLED") {
        this.cancelledSet.add(taskId);
        return;
      }

      await prisma.task.update({
        where: { id: taskId },
        data: { status: "PROCESSING", startedAt: new Date(), progress: 0 },
      });

      await this._executeTask(taskId, controller.signal);

      if (this.cancelledSet.has(taskId) || controller.signal.aborted) return;

      const beforeComplete = await prisma.task.findUnique({
        where: { id: taskId },
      });
      if (!beforeComplete || beforeComplete.status === "CANCELLED") return;

      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: "COMPLETED",
          progress: 100,
          resultImageUrl: `https://picsum.photos/seed/task${taskId}/800/1000`,
          completedAt: new Date(),
        },
      });
    } catch (error) {
      if (this.cancelledSet.has(taskId) || controller.signal.aborted) return;

      const task = await prisma.task.findUnique({ where: { id: taskId } });
      if (!task || task.status === "CANCELLED") {
        this.cancelledSet.add(taskId);
        return;
      }

      const currentRetry = task.retryCount || 0;

      if (currentRetry < MAX_RETRIES) {
        const delay = BASE_RETRY_DELAY * Math.pow(2, currentRetry);
        console.log(
          `Task ${taskId} failed (attempt ${currentRetry + 1}/${MAX_RETRIES}), retrying in ${delay}ms...`,
        );

        await prisma.task.update({
          where: { id: taskId },
          data: {
            status: "QUEUED",
            progress: 0,
            retryCount: currentRetry + 1,
          },
        });

        await this._sleep(delay, controller.signal);

        if (this.cancelledSet.has(taskId) || controller.signal.aborted) return;

        const recheck = await prisma.task.findUnique({ where: { id: taskId } });
        if (
          recheck &&
          recheck.status === "QUEUED" &&
          !this.cancelledSet.has(taskId)
        ) {
          this.queue.push({ taskId, enqueuedAt: Date.now() });
          this._schedule();
        }
      } else {
        console.log(
          `Task ${taskId} failed after ${MAX_RETRIES} retries, marking FAILED`,
        );
        await prisma.task.update({
          where: { id: taskId },
          data: { status: "FAILED", progress: 0, completedAt: new Date() },
        });
      }
    } finally {
      this.abortControllers.delete(taskId);
    }
  }

  async _executeTask(taskId, signal) {
    const totalTime = 5000 + Math.random() * 10000;
    const steps = 10;
    const stepTime = totalTime / steps;

    for (let i = 1; i <= steps; i++) {
      if (this.cancelledSet.has(taskId) || signal.aborted) {
        throw new Error("CANCELLED");
      }

      await this._sleep(stepTime, signal);

      if (this.cancelledSet.has(taskId) || signal.aborted) {
        throw new Error("CANCELLED");
      }

      await prisma.task.update({
        where: { id: taskId },
        data: { progress: i * 10 },
      });
    }
  }

  _sleep(ms, signal) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      if (signal) {
        const onAbort = () => {
          clearTimeout(timer);
          reject(new Error("CANCELLED"));
        };
        if (signal.aborted) {
          clearTimeout(timer);
          reject(new Error("CANCELLED"));
        } else {
          signal.addEventListener("abort", onAbort, { once: true });
        }
      }
    });
  }
}

const instance = new TaskQueue();

function enqueueTask(taskId) {
  instance.enqueue(taskId);
}

function getQueueSize() {
  return instance.getQueueInfo();
}

async function cancelTask(taskId) {
  return instance.cancelTask(taskId);
}

module.exports = {
  enqueueTask,
  getQueueSize,
  cancelTask,
};
