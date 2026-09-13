import type { JsonObject, JsonValue } from '../shared/json';

export type TemporalScalar = number | string;

export type TemporalUnit =
  | 'step'
  | 'frame'
  | 'second'
  | 'millisecond'
  | 'timestamp'
  | 'revision'
  | (string & {});

export type TemporalItemShape = 'instant' | 'segment' | 'range';

export type TemporalCapability =
  | 'viewport.pan'
  | 'viewport.zoom'
  | 'viewport.fit'
  | 'playback.discrete'
  | 'playback.continuous'
  | 'selection.item'
  | 'selection.range'
  | 'lanes.group'
  | 'markers'
  | 'inspect.payload'
  | 'inspect.artifacts'
  | 'diff.snapshot'
  | (string & {});

export interface TemporalRange {
  start: TemporalScalar;
  end: TemporalScalar;
  unit: TemporalUnit;
}

export interface TemporalCursor {
  value: TemporalScalar;
  unit: TemporalUnit;
  itemId?: string | null;
}

export interface TemporalLane {
  id: string;
  title: string;
  summary?: string;
  groupId?: string | null;
  order?: number;
  color?: string;
  metadata?: JsonObject;
}

export interface TemporalMarker {
  id: string;
  value: TemporalScalar;
  unit: TemporalUnit;
  title: string;
  kind?: string;
  metadata?: JsonObject;
}

export interface TemporalArtifactRef {
  kind: 'doc' | 'source' | 'test' | 'schema' | 'fixture' | 'runtime' | 'event' | 'commit' | (string & {});
  path?: string;
  ref?: string;
  label?: string;
}

export interface TemporalItem {
  id: string;
  laneId: string;
  kind: string;
  shape: TemporalItemShape;
  start: TemporalScalar;
  end?: TemporalScalar;
  unit: TemporalUnit;
  title: string;
  summary?: string;
  status?: string;
  source?: TemporalArtifactRef;
  artifacts?: TemporalArtifactRef[];
  payload?: JsonValue;
  metadata?: JsonObject;
}

export interface TemporalDiagnostic {
  id: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  itemId?: string;
}

export interface TemporalProjection {
  id: string;
  dialect: string;
  title: string;
  summary?: string;
  range: TemporalRange;
  cursor?: TemporalCursor;
  lanes: TemporalLane[];
  items: TemporalItem[];
  markers?: TemporalMarker[];
  diagnostics?: TemporalDiagnostic[];
  metadata?: JsonObject;
}

export interface TemporalDialectDefinition {
  id: string;
  title: string;
  version: string;
  summary: string;
  unit: TemporalUnit;
  itemKinds: string[];
  capabilities: TemporalCapability[];
  projectionKinds?: string[];
}

export interface TemporalDialectCompatibilityInput {
  dialect?: string;
  unit?: TemporalUnit;
  projectionKind?: string;
  requiredCapabilities?: TemporalCapability[];
}

export interface TemporalDialectCatalog {
  getDefinition(dialectId: string): TemporalDialectDefinition | undefined;
  list(): TemporalDialectDefinition[];
  listCompatible(input: TemporalDialectCompatibilityInput): TemporalDialectDefinition[];
}

export function validateTemporalProjection(
  projection: TemporalProjection,
  dialect?: TemporalDialectDefinition
): TemporalDiagnostic[] {
  const laneIds = new Set(projection.lanes.map((lane) => lane.id));
  const diagnostics: TemporalDiagnostic[] = [];

  if (dialect && projection.dialect !== dialect.id) {
    diagnostics.push({
      id: 'temporal.dialect.mismatch',
      severity: 'error',
      message: `Projection dialect "${projection.dialect}" does not match dialect "${dialect.id}".`
    });
  }

  if (projection.range.unit && projection.cursor && projection.cursor.unit !== projection.range.unit) {
    diagnostics.push({
      id: 'temporal.cursor.unit-mismatch',
      severity: 'warning',
      message: `Cursor unit "${projection.cursor.unit}" differs from range unit "${projection.range.unit}".`
    });
  }

  for (const item of projection.items) {
    if (!laneIds.has(item.laneId)) {
      diagnostics.push({
        id: `temporal.item.${item.id}.missing-lane`,
        severity: 'error',
        itemId: item.id,
        message: `Temporal item "${item.id}" references missing lane "${item.laneId}".`
      });
    }

    if (item.shape !== 'instant' && item.end === undefined) {
      diagnostics.push({
        id: `temporal.item.${item.id}.missing-end`,
        severity: 'warning',
        itemId: item.id,
        message: `Temporal ${item.shape} item "${item.id}" should declare an end value.`
      });
    }

    if (dialect && !dialect.itemKinds.includes(item.kind)) {
      diagnostics.push({
        id: `temporal.item.${item.id}.unknown-kind`,
        severity: 'warning',
        itemId: item.id,
        message: `Temporal item "${item.id}" uses kind "${item.kind}" outside dialect "${dialect.id}".`
      });
    }
  }

  return diagnostics;
}
