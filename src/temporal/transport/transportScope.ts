import type { TemporalTransport } from './temporalTransport';

export interface TransportScope {
  id: string;
  transport: TemporalTransport;
  dispose(): void;
}

export function createTransportScope(
  id: string,
  transport: TemporalTransport,
  dispose: () => void = () => {},
): TransportScope {
  return { id, transport, dispose };
}
