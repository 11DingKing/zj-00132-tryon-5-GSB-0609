const prisma = require('../shared/prisma');

const DEFAULT_CONFIG = {
  maxWorkers: 3,
  defaultMaxRetries: 3,
  baseRetryDelay: 1000,
  maxRetryDelay: 10000
};

class TaskQueue {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.queue = [];
    this.activeWorkers = new Map();
    this.cancelledTasks = new Set();
    this.isRunning = false;
  }

  getQueueSize() {
    return this.queue.length;
  }

  getActiveCount() {
    return this.activeWorkers.size;
  }

  getStats() {
    return {
      queued: this.queue.length,
      processing: this.activeWorkers.size,
      maxWorkers: this.config.maxWorkers
    };
  }

  enqueue(taskId) {
    if (this.queue.includes(taskId)) {
      return false;
    }
    this.queue.push(taskId);
    this.processQueue();
    return true;
  }

  async cancelTask(taskId) {
    if (this.cancelledTasks.has(taskId)) {
      return false;
    }

    this.cancelledTasks.add(taskId);

    const queueIndex = this.queue.indexOf(taskId);
    if (queueIndex > -1) {
      this.queue.splice(queueIndex, 1);
      await this._markTaskCancelled(taskId);
      this.cancelledTasks.delete(taskId);
      return true;
    }

    const worker = this.activeWorkers.get(taskId);
    if (worker) {
      worker.cancelled = true;
      return true;
    }

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (task && task.status === 'QUEUED') {
      await this._markTaskCancelled(taskId);
      return true;
    }

    this.cancelledTasks.delete(taskId);
    return false;
  }

  async processQueue() {
    while (
      this.activeWorkers.size < this.config.maxWorkers &&
      this.queue.length > 0
    ) {
      const taskId = this.queue.shift();

      if (this.cancelledTasks.has(taskId)) {
        this.cancelledTasks.delete(taskId);
        await this._markTaskCancelled(taskId);
        continue;
      }

      this._startWorker(taskId);
    }
  }

  _startWorker(taskId) {
    const worker = {
      taskId,
      cancelled: false,
      currentStep: 0,
      timeoutIds: []
    };

    this.activeWorkers.set(taskId, worker);
    this._executeTask(taskId, worker);
  }

  async _executeTask(taskId, worker) {
    try {
      const task = await prisma.task.findUnique({ where: { id: taskId } });
      if (!task) {
        this._cleanupWorker(taskId);
        return;
      }

      if (worker.cancelled || this.cancelledTasks.has(taskId)) {
        await this._markTaskCancelled(taskId);
        this._cleanupWorker(taskId);
        return;
      }

      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: 'PROCESSING',
          startedAt: new Date(),
          progress: 0
        }
      });

      console.log(`[TaskQueue] Starting task ${taskId} (worker: ${this.activeWorkers.size}/${this.config.maxWorkers})`);

      const totalTime = 5000 + Math.random() * 10000;
      const steps = 10;
      const stepTime = totalTime / steps;

      for (let i = 1; i <= steps; i++) {
        if (worker.cancelled || this.cancelledTasks.has(taskId)) {
          await this._markTaskCancelled(taskId);
          this._cleanupWorker(taskId);
          return;
        }

        await this._delay(stepTime, worker);

        if (worker.cancelled || this.cancelledTasks.has(taskId)) {
          await this._markTaskCancelled(taskId);
          this._cleanupWorker(taskId);
          return;
        }

        await prisma.task.update({
          where: { id: taskId },
          data: { progress: i * 10 }
        });
      }

      if (worker.cancelled || this.cancelledTasks.has(taskId)) {
        await this._markTaskCancelled(taskId);
        this._cleanupWorker(taskId);
        return;
      }

      const success = Math.random() > 0.2;

      if (success) {
        await prisma.task.update({
          where: { id: taskId },
          data: {
            status: 'COMPLETED',
            progress: 100,
            resultImageUrl: `https://picsum.photos/seed/task${taskId}/800/1000`,
            completedAt: new Date(),
            errorMessage: null
          }
        });
        console.log(`[TaskQueue] Task ${taskId} completed successfully`);
      } else {
        throw new Error('Task execution failed (simulated)');
      }
    } catch (error) {
      if (worker.cancelled || this.cancelledTasks.has(taskId)) {
        await this._markTaskCancelled(taskId);
        this._cleanupWorker(taskId);
        return;
      }

      console.error(`[TaskQueue] Task ${taskId} failed:`, error.message);

      const task = await prisma.task.findUnique({ where: { id: taskId } });
      if (!task) {
        this._cleanupWorker(taskId);
        return;
      }

      const maxRetries = task.maxRetries ?? this.config.defaultMaxRetries;
      const currentRetry = task.retryCount ?? 0;

      if (currentRetry < maxRetries) {
        const newRetryCount = currentRetry + 1;
        const delay = this._calculateBackoffDelay(newRetryCount);

        console.log(`[TaskQueue] Task ${taskId} retry ${newRetryCount}/${maxRetries} in ${delay}ms`);

        await prisma.task.update({
          where: { id: taskId },
          data: {
            status: 'QUEUED',
            retryCount: newRetryCount,
            errorMessage: error.message,
            progress: 0
          }
        });

        setTimeout(() => {
          if (!this.cancelledTasks.has(taskId)) {
            this.enqueue(taskId);
          } else {
            this._markTaskCancelled(taskId);
            this.cancelledTasks.delete(taskId);
          }
        }, delay);
      } else {
        await prisma.task.update({
          where: { id: taskId },
          data: {
            status: 'FAILED',
            errorMessage: error.message,
            progress: 0
          }
        });
        console.log(`[TaskQueue] Task ${taskId} permanently failed after ${maxRetries} retries`);
      }
    } finally {
      this._cleanupWorker(taskId);
      this.processQueue();
    }
  }

  _calculateBackoffDelay(retryCount) {
    const delay = this.config.baseRetryDelay * Math.pow(2, retryCount - 1);
    const jitter = Math.random() * this.config.baseRetryDelay * 0.5;
    return Math.min(delay + jitter, this.config.maxRetryDelay);
  }

  _delay(ms, worker) {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        const idx = worker.timeoutIds.indexOf(timeoutId);
        if (idx > -1) worker.timeoutIds.splice(idx, 1);
        resolve();
      }, ms);
      worker.timeoutIds.push(timeoutId);
    });
  }

  async _markTaskCancelled(taskId) {
    try {
      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date()
        }
      });
      console.log(`[TaskQueue] Task ${taskId} cancelled`);
    } catch (error) {
      console.error(`[TaskQueue] Failed to mark task ${taskId} as cancelled:`, error.message);
    }
  }

  _cleanupWorker(taskId) {
    const worker = this.activeWorkers.get(taskId);
    if (worker) {
      worker.timeoutIds.forEach(id => clearTimeout(id));
      this.activeWorkers.delete(taskId);
    }
    this.cancelledTasks.delete(taskId);
  }

  setMaxWorkers(count) {
    this.config.maxWorkers = Math.max(1, count);
    this.processQueue();
  }
}

const taskQueue = new TaskQueue();

function enqueueTask(taskId) {
  return taskQueue.enqueue(taskId);
}

function getQueueSize() {
  return taskQueue.getQueueSize();
}

function getQueueStats() {
  return taskQueue.getStats();
}

function cancelTask(taskId) {
  return taskQueue.cancelTask(taskId);
}

function setMaxWorkers(count) {
  return taskQueue.setMaxWorkers(count);
}

module.exports = {
  enqueueTask,
  getQueueSize,
  getQueueStats,
  cancelTask,
  setMaxWorkers,
  TaskQueue
};
