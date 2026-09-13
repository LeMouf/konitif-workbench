import type { BootExecutionState, BootPhase } from './types';

export type BootEvent =
  | {
      type: 'boot:start';
      executionId: string;
      state: BootExecutionState;
    }
  | {
      type: 'boot:success';
      executionId: string;
      state: BootExecutionState;
    }
  | {
      type: 'boot:failed';
      executionId: string;
      state: BootExecutionState;
      error: unknown;
    }
  | {
      type: 'phase:start';
      executionId: string;
      phase: BootPhase;
    }
  | {
      type: 'step:start';
      executionId: string;
      stepId: string;
    }
  | {
      type: 'step:success';
      executionId: string;
      stepId: string;
    }
  | {
      type: 'step:failed';
      executionId: string;
      stepId: string;
      error: unknown;
    }
  | {
      type: 'step:blocked';
      executionId: string;
      stepId: string;
      reason: string;
    };

export type BootEventSubscriber = (event: BootEvent) => void;

export interface BootEventBus {
  subscribe(subscriber: BootEventSubscriber): () => void;
  emit(event: BootEvent): void;
}

export function createBootEventBus(): BootEventBus {
  const subscribers = new Set<BootEventSubscriber>();

  return {
    subscribe(subscriber) {
      subscribers.add(subscriber);
      return () => {
        subscribers.delete(subscriber);
      };
    },
    emit(event) {
      for (const subscriber of subscribers) {
        subscriber(event);
      }
    },
  };
}
