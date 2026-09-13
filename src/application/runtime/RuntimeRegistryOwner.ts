import type {
  RuntimeManagerSnapshot,
  RuntimeServiceSnapshot,
  RuntimeStoreSnapshot,
  WorkbenchRuntimeSubscription
} from '../../domain/runtime/model';
import {
  createRuntimeManagerSnapshot,
  createRuntimeServiceSnapshot,
  createRuntimeStoreSnapshot
} from './RuntimeRegistrySnapshots';
import type {
  RuntimeManagerRegistration,
  RuntimeServiceRegistration,
  RuntimeStoreRegistration
} from './RuntimeRegistryTypes';

export interface RuntimeRegistryOwnerCallbacks {
  onChanged?: () => void;
  onManagerDisposed?: (registration: RuntimeManagerRegistration) => void;
  onManagerRegistered?: (registration: RuntimeManagerRegistration) => void;
  onServiceDisposed?: (registration: RuntimeServiceRegistration) => void;
  onServiceRegistered?: (registration: RuntimeServiceRegistration) => void;
  onStoreDisposed?: (registration: RuntimeStoreRegistration) => void;
  onStoreRegistered?: (registration: RuntimeStoreRegistration) => void;
}

export interface RuntimeRegistryOwner {
  getManagerSnapshots(): RuntimeManagerSnapshot[];
  getServiceSnapshots(): RuntimeServiceSnapshot[];
  getStoreSnapshots(): RuntimeStoreSnapshot[];
  registerManager(registration: RuntimeManagerRegistration): WorkbenchRuntimeSubscription;
  registerService(registration: RuntimeServiceRegistration): WorkbenchRuntimeSubscription;
  registerStore(registration: RuntimeStoreRegistration): WorkbenchRuntimeSubscription;
}

export function createRuntimeRegistryOwner(
  callbacks: RuntimeRegistryOwnerCallbacks = {}
): RuntimeRegistryOwner {
  const stores = new Map<string, RuntimeStoreRegistration>();
  const services = new Map<string, RuntimeServiceRegistration>();
  const managers = new Map<string, RuntimeManagerRegistration>();

  return {
    getManagerSnapshots() {
      return [...managers.values()].map((registration) => createRuntimeManagerSnapshot(registration));
    },
    getServiceSnapshots() {
      return [...services.values()].map((registration) => createRuntimeServiceSnapshot(registration));
    },
    getStoreSnapshots() {
      return [...stores.values()].map((registration) => createRuntimeStoreSnapshot(registration));
    },
    registerManager(registration) {
      let disposed = false;

      managers.set(registration.id, registration);
      callbacks.onManagerRegistered?.(registration);
      callbacks.onChanged?.();

      return {
        dispose: () => {
          if (disposed || managers.get(registration.id) !== registration) {
            disposed = true;
            return;
          }

          disposed = true;
          managers.delete(registration.id);
          callbacks.onManagerDisposed?.(registration);
          callbacks.onChanged?.();
        }
      };
    },
    registerService(registration) {
      let disposed = false;

      services.set(registration.id, registration);
      callbacks.onServiceRegistered?.(registration);
      callbacks.onChanged?.();

      return {
        dispose: () => {
          if (disposed || services.get(registration.id) !== registration) {
            disposed = true;
            return;
          }

          disposed = true;
          services.delete(registration.id);
          callbacks.onServiceDisposed?.(registration);
          callbacks.onChanged?.();
        }
      };
    },
    registerStore(registration) {
      let disposed = false;

      stores.set(registration.id, registration);
      callbacks.onStoreRegistered?.(registration);
      callbacks.onChanged?.();

      return {
        dispose: () => {
          if (disposed || stores.get(registration.id) !== registration) {
            disposed = true;
            return;
          }

          disposed = true;
          stores.delete(registration.id);
          callbacks.onStoreDisposed?.(registration);
          callbacks.onChanged?.();
        }
      };
    }
  };
}
