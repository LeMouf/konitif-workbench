import type {
  RuntimeManagerSnapshot,
  RuntimeServiceSnapshot,
  RuntimeStoreSnapshot
} from '../../domain/runtime/model';

export interface RuntimeStoreRegistration {
  id: string;
  label?: string;
  scope?: string;
  status?: RuntimeStoreSnapshot['status'];
  metadata?: unknown;
  value?: unknown;
  getSnapshot?: () => unknown;
}

export interface RuntimeServiceRegistration {
  id: string;
  label?: string;
  status?: RuntimeServiceSnapshot['status'];
  capabilities?: string[];
  endpoint?: string | null;
  lastError?: string | null;
  metadata?: unknown;
  getSnapshot?: () => Partial<RuntimeServiceSnapshot> | unknown;
}

export interface RuntimeManagerRegistration {
  id: string;
  label?: string;
  status?: RuntimeManagerSnapshot['status'];
  responsibilities?: string[];
  lastError?: string | null;
  metadata?: unknown;
  getSnapshot?: () => Partial<RuntimeManagerSnapshot> | unknown;
}
