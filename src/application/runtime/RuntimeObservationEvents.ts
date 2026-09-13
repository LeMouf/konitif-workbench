import type {
  WorkbenchRuntimeObservationEvent,
  WorkbenchRuntimeProjectionCatalogEntry,
  WorkbenchRuntimeSharedStateEntry
} from '../../domain/runtime/model';
import { normalizeProjectionCatalogFromEvent } from './RuntimeProjectionCatalog';
import { upsertSharedStateEntryFromEvent } from './RuntimeSharedState';

export interface RuntimeObservationEventReducerInput {
  projectionCatalog: WorkbenchRuntimeProjectionCatalogEntry[];
  sharedState: WorkbenchRuntimeSharedStateEntry[];
  events: WorkbenchRuntimeObservationEvent[];
  event: WorkbenchRuntimeObservationEvent;
  maxEvents: number;
}

export interface RuntimeObservationEventReducerPatch {
  projectionCatalog: WorkbenchRuntimeProjectionCatalogEntry[];
  sharedState: WorkbenchRuntimeSharedStateEntry[];
  events: WorkbenchRuntimeObservationEvent[];
}

export function appendRuntimeObservationEvent(
  events: WorkbenchRuntimeObservationEvent[],
  event: WorkbenchRuntimeObservationEvent,
  maxEvents: number
): WorkbenchRuntimeObservationEvent[] {
  return [event, ...events].slice(0, maxEvents);
}

export function applyRuntimeObservationEvent(
  input: RuntimeObservationEventReducerInput
): RuntimeObservationEventReducerPatch {
  const projectionCatalog =
    input.event.type === 'projection.catalog'
      ? normalizeProjectionCatalogFromEvent(input.event.payload, input.projectionCatalog)
      : input.projectionCatalog;
  const sharedState =
    input.event.type === 'shared-state.updated'
      ? upsertSharedStateEntryFromEvent(input.sharedState, input.event.payload)
      : input.sharedState;

  return {
    projectionCatalog,
    sharedState,
    events: appendRuntimeObservationEvent(input.events, input.event, input.maxEvents)
  };
}
