import {
  cancelRuntimeOffloadTask,
  completeRuntimeOffloadTask,
  createRuntimeOffloadSnapshot,
  createRuntimeOffloadTask,
  failRuntimeOffloadTask,
  startRuntimeOffloadTask,
  updateRuntimeOffloadTaskProgress,
  type RuntimeOffloadEvent,
  type RuntimeOffloadSnapshot,
  type RuntimeOffloadTask,
  type RuntimeOffloadTaskInput
} from '../../domain/runtime/offload';

export interface RuntimeOffloadManagerOptions {
  maxConcurrentTasks?: number;
  now?: () => string;
  onEvent?: (event: RuntimeOffloadEvent) => void;
}

export class RuntimeOffloadManager {
  private readonly maxConcurrentTasks: number;
  private readonly now: () => string;
  private readonly onEvent: ((event: RuntimeOffloadEvent) => void) | null;
  private tasks: RuntimeOffloadTask[] = [];
  private sequence = 0;

  constructor(options: RuntimeOffloadManagerOptions = {}) {
    this.maxConcurrentTasks = Math.max(1, Math.floor(options.maxConcurrentTasks ?? 1));
    this.now = options.now ?? (() => new Date().toISOString());
    this.onEvent = options.onEvent ?? null;
  }

  enqueue(input: RuntimeOffloadTaskInput): RuntimeOffloadTask {
    const task = createRuntimeOffloadTask(input, this.now());

    this.tasks = [...this.tasks, task];
    this.emit(task, 'queued', `${task.label} queued`);

    return task;
  }

  startNext(): RuntimeOffloadTask | null {
    const runningCount = this.tasks.filter((task) => task.status === 'running').length;

    if (runningCount >= this.maxConcurrentTasks) {
      return null;
    }

    const nextTask = createRuntimeOffloadSnapshot(this.tasks, this.now()).tasks.find((task) => task.status === 'queued') ?? null;

    if (!nextTask) {
      return null;
    }

    const startedTask = startRuntimeOffloadTask(nextTask, this.now());

    this.replaceTask(startedTask);
    this.emit(startedTask, 'started', `${startedTask.label} started`);

    return startedTask;
  }

  updateProgress(taskId: string, progress: number): RuntimeOffloadTask | null {
    const task = this.findTask(taskId);

    if (!task) {
      return null;
    }

    const updatedTask = updateRuntimeOffloadTaskProgress(task, progress, this.now());

    this.replaceTask(updatedTask);
    this.emit(updatedTask, 'progress', `${updatedTask.label} ${updatedTask.progress}%`);

    return updatedTask;
  }

  complete(taskId: string, result?: unknown): RuntimeOffloadTask | null {
    const task = this.findTask(taskId);

    if (!task) {
      return null;
    }

    const completedTask = completeRuntimeOffloadTask(task, result, this.now());

    this.replaceTask(completedTask);
    this.emit(completedTask, 'completed', `${completedTask.label} completed`);
    this.startNext();

    return completedTask;
  }

  fail(taskId: string, error: string): RuntimeOffloadTask | null {
    const task = this.findTask(taskId);

    if (!task) {
      return null;
    }

    const failedTask = failRuntimeOffloadTask(task, error, this.now());

    this.replaceTask(failedTask);
    this.emit(failedTask, 'failed', error);
    this.startNext();

    return failedTask;
  }

  cancel(taskId: string): RuntimeOffloadTask | null {
    const task = this.findTask(taskId);

    if (!task) {
      return null;
    }

    const cancelledTask = cancelRuntimeOffloadTask(task, this.now());

    this.replaceTask(cancelledTask);
    this.emit(cancelledTask, 'cancelled', `${cancelledTask.label} cancelled`);
    this.startNext();

    return cancelledTask;
  }

  createSnapshot(timestamp = this.now()): RuntimeOffloadSnapshot {
    return createRuntimeOffloadSnapshot(this.tasks, timestamp);
  }

  private findTask(taskId: string): RuntimeOffloadTask | null {
    return this.tasks.find((task) => task.id === taskId) ?? null;
  }

  private replaceTask(task: RuntimeOffloadTask): void {
    this.tasks = this.tasks.map((candidate) => candidate.id === task.id ? task : candidate);
  }

  private emit(task: RuntimeOffloadTask, kind: RuntimeOffloadEvent['kind'], message: string): void {
    this.sequence += 1;
    this.onEvent?.({
      id: `offload-event:${this.sequence}`,
      taskId: task.id,
      kind,
      timestamp: this.now(),
      message,
      progress: task.progress
    });
  }
}
