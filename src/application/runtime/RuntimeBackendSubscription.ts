import type { WorkbenchRuntimeSubscription } from '../../domain/runtime/model';

export type RuntimeBackendSubscriptionOwner = {
  replace(subscription: WorkbenchRuntimeSubscription): void;
  replaceWith(create: () => WorkbenchRuntimeSubscription): void;
  disconnect(): void;
  hasActiveSubscription(): boolean;
};

export function createRuntimeBackendSubscriptionOwner(): RuntimeBackendSubscriptionOwner {
  // Retain failed cleanup too: a thrown dispose never relinquishes ownership.
  const owned = new Set<WorkbenchRuntimeSubscription>();

  function release(subscription: WorkbenchRuntimeSubscription, errors: unknown[]): void {
    try {
      subscription.dispose();
      owned.delete(subscription);
    } catch (error) {
      errors.push(error);
    }
  }

  function report(errors: unknown[]): void {
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, 'Subscription cleanup failed');
  }

  return {
    replaceWith(create): void {
      const errors: unknown[] = [];
      for (const subscription of [...owned]) release(subscription, errors);
      report(errors);
      // No acquisition until every previous release has succeeded.
      // The factory owns cleanup of any partial acquisition if it throws.
      owned.add(create());
    },
    replace(subscription): void {
      if (owned.has(subscription)) return;
      const errors: unknown[] = [];
      for (const previous of [...owned]) release(previous, errors);
      owned.add(subscription);
      // The already-acquired candidate transfers to this owner even on failure.
      // Reject it by cleanup, retaining it if that cleanup also fails.
      if (errors.length > 0) release(subscription, errors);
      report(errors);
    },
    disconnect(): void {
      const errors: unknown[] = [];
      for (const subscription of [...owned]) release(subscription, errors);
      report(errors);
    },
    hasActiveSubscription(): boolean {
      return owned.size > 0;
    }
  };
}
