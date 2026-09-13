import type {
  StageAmbientProjection,
  StageAmbientState,
  StageCamera,
  StageNode,
  StageProjectedNode,
  StageProjection,
  StageState,
  StageViewport,
} from './types';

export function projectStageState(state: StageState, viewport: StageViewport): StageProjection {
  const projectedNodes = Object.values(state.nodes)
    .map((node) => projectStageNode(node, state.camera, viewport))
    .sort((a, b) => a.zIndex - b.zIndex || a.depth - b.depth);

  return {
    viewport: { ...viewport },
    camera: {
      position: { ...state.camera.position },
      rotation: { ...state.camera.rotation },
      perspective: state.camera.perspective,
    },
    nodes: projectedNodes,
    ambient: projectStageAmbient(state.ambient, projectedNodes, viewport),
  };
}

export function projectStageNode(
  node: StageNode,
  camera: StageCamera,
  viewport: StageViewport,
): StageProjectedNode {
  const relativeX = node.position.x - camera.position.x;
  const relativeY = node.position.y - camera.position.y;
  const relativeZ = node.position.z - camera.position.z;
  const depth = Math.max(1, camera.perspective + relativeZ);
  const perspectiveScale = camera.perspective / depth;
  const scale = ((node.scale.x + node.scale.y) / 2) * perspectiveScale;
  const x = viewport.width / 2 + relativeX * perspectiveScale;
  const y = viewport.height / 2 + relativeY * perspectiveScale;
  const zIndex = node.zIndex ?? Math.round(10000 - depth);

  return {
    id: node.id,
    kind: node.kind,
    visible: node.visible,
    opacity: node.opacity,
    x,
    y,
    depth,
    scale,
    zIndex,
    transform: createStageNodeTransform(x, y, node.rotation.z - camera.rotation.z, scale),
    metadata: node.metadata ? { ...node.metadata } : undefined,
  };
}

export function projectStageAmbient(
  ambient: StageAmbientState | undefined,
  nodes: readonly StageProjectedNode[],
  viewport: StageViewport,
): StageAmbientProjection {
  const focusNode = ambient?.focusNodeId
    ? nodes.find((node) => node.id === ambient.focusNodeId && node.visible)
    : nodes.find((node) => node.visible);
  const focusPoint = focusNode
    ? { x: focusNode.x / Math.max(1, viewport.width), y: focusNode.y / Math.max(1, viewport.height) }
    : { x: 0.5, y: 0.5 };
  const focusDepth = focusNode ? normalizeStageDepth(focusNode.depth) : 0.5;

  return {
    focusPoint,
    focusDepth,
    depthIntensity: clampAmbientValue(ambient?.depthIntensity ?? 0.5),
    fogIntensity: clampAmbientValue(ambient?.fogIntensity ?? 0.32),
    lightIntensity: clampAmbientValue(ambient?.lightIntensity ?? 0.55),
    motionIntensity: clampAmbientValue(ambient?.motionIntensity ?? 0.22),
    parallaxIntensity: clampAmbientValue(ambient?.parallaxIntensity ?? 0.35),
    tint: ambient?.tint,
    metadata: ambient?.metadata ? { ...ambient.metadata } : undefined,
  };
}

function createStageNodeTransform(x: number, y: number, rotationZ: number, scale: number): string {
  return `translate3d(${roundStageNumber(x)}px, ${roundStageNumber(y)}px, 0) rotate(${roundStageNumber(
    rotationZ,
  )}deg) scale(${roundStageNumber(scale)})`;
}

function normalizeStageDepth(depth: number): number {
  return clampAmbientValue(depth / 1800);
}

function clampAmbientValue(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

function roundStageNumber(value: number): number {
  return Math.round(value * 1000) / 1000;
}
