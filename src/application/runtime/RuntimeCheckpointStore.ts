import {
  createRuntimeCheckpoint,
  createRuntimeCheckpointSnapshot,
  updateRuntimeCheckpoint,
  type RuntimeCheckpoint,
  type RuntimeCheckpointInput,
  type RuntimeCheckpointSnapshot
} from '../../domain/runtime/checkpoint';

export interface RuntimeCheckpointStoreOptions {
  maxEntries?: number;
  now?: () => string;
}

export class RuntimeCheckpointStore {
  private readonly maxEntries: number;
  private readonly now: () => string;
  private checkpoints: RuntimeCheckpoint[] = [];
  private lastKnownGoodId: string | null = null;

  constructor(options: RuntimeCheckpointStoreOptions = {}) {
    this.maxEntries = Math.max(1, Math.floor(options.maxEntries ?? 50));
    this.now = options.now ?? (() => new Date().toISOString());
  }

  save(input: RuntimeCheckpointInput): RuntimeCheckpoint {
    const checkpoint = createRuntimeCheckpoint(input, this.now());
    const existing = this.checkpoints.filter((candidate) => candidate.id !== checkpoint.id);

    this.checkpoints = [checkpoint, ...existing].slice(0, this.maxEntries);

    if (checkpoint.kind === 'last-known-good') {
      this.lastKnownGoodId = checkpoint.id;
    }

    return checkpoint;
  }

  update(id: string, data: unknown): RuntimeCheckpoint | null {
    const checkpoint = this.get(id);

    if (!checkpoint) {
      return null;
    }

    const updated = updateRuntimeCheckpoint(checkpoint, data, this.now());

    this.checkpoints = this.checkpoints.map((candidate) => candidate.id === id ? updated : candidate);

    return updated;
  }

  get(id: string): RuntimeCheckpoint | null {
    return this.checkpoints.find((checkpoint) => checkpoint.id === id) ?? null;
  }

  list(): RuntimeCheckpoint[] {
    return [...this.checkpoints];
  }

  remove(id: string): boolean {
    const previousLength = this.checkpoints.length;

    this.checkpoints = this.checkpoints.filter((checkpoint) => checkpoint.id !== id);

    if (this.lastKnownGoodId === id) {
      this.lastKnownGoodId = null;
    }

    return this.checkpoints.length !== previousLength;
  }

  markLastKnownGood(id: string): RuntimeCheckpoint | null {
    const checkpoint = this.get(id);

    if (!checkpoint) {
      return null;
    }

    const lastKnownGood = {
      ...checkpoint,
      id: `last-known-good:${checkpoint.id}`,
      kind: 'last-known-good' as const,
      label: `Last known good - ${checkpoint.label}`,
      updatedAt: this.now()
    };

    this.checkpoints = [lastKnownGood, ...this.checkpoints].slice(0, this.maxEntries);
    this.lastKnownGoodId = lastKnownGood.id;

    return lastKnownGood;
  }

  restore(id: string): RuntimeCheckpoint | null {
    return this.get(id);
  }

  createSnapshot(timestamp = this.now()): RuntimeCheckpointSnapshot {
    return createRuntimeCheckpointSnapshot(this.checkpoints, this.lastKnownGoodId, timestamp);
  }
}
