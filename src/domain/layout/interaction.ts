import type { SplitOrientation } from './model';

export type LayoutEdge = 'top' | 'right' | 'bottom' | 'left';
export type LayoutDockSide = 'top' | 'right' | 'bottom' | 'left';
export type LayoutDockPlacement = LayoutDockSide | 'center';
export type LayoutInteractionSourceKind = 'workspace-edge' | 'split-boundary' | 'panel-menu';
export type LayoutMenuActionId = 'split:vertical' | 'split:horizontal' | 'join-areas' | 'swap-areas';
export type BoundaryPullSourceKind = 'edge' | 'corner';

export interface LayoutInteractionAnchor {
  x: number;
  y: number;
}

export interface LayoutInteractionPointer {
  x: number;
  y: number;
}

export interface LayoutMenuTarget {
  id: string;
  panelId: string;
  areaId: string;
  areaPanelIds: readonly string[];
  edge: LayoutEdge;
  label: string;
  joinSide: LayoutDockSide;
  joinSiblingPanelIds: readonly string[];
  swapSiblingPanelIds: readonly string[];
}

export type LayoutDockTarget =
  | {
      kind: 'workspace-edge';
      side: LayoutDockSide;
    }
  | {
      kind: 'stack';
      stackId: string;
      placement: LayoutDockPlacement;
      tabIndex?: number | null;
    };

export type LayoutInteractionState =
  | {
      mode: 'idle';
    }
  | {
      mode: 'split-menu';
      source: LayoutInteractionSourceKind;
      panelId: string | null;
      edge: LayoutEdge;
      anchor: LayoutInteractionAnchor;
      targets: LayoutMenuTarget[];
      initialActionId: LayoutMenuActionId | null;
    }
  | {
      mode: 'split-side-pick';
      panelId: string | null;
      edge: LayoutEdge;
      orientation: SplitOrientation;
      hoveredSide: LayoutDockSide | null;
    }
  | {
      mode: 'split-preview';
      panelId: string | null;
      edge: LayoutEdge;
      orientation: SplitOrientation;
      cuts: number;
      pointerRatio: number;
    }
  | {
      mode: 'boundary-pull';
      windowId?: string;
      source: BoundaryPullSourceKind;
      anchor: LayoutInteractionAnchor;
      pointer: LayoutInteractionPointer;
      horizontalEdge: 'left' | 'right' | null;
      verticalEdge: 'top' | 'bottom' | null;
      neutralThreshold: number;
      creationThreshold: number;
      horizontalDistance: number;
      verticalDistance: number;
      horizontalBandRatio: number | null;
      verticalBandRatio: number | null;
    }
  | {
      mode: 'intersection-resize';
      anchor: LayoutInteractionAnchor;
      pointer: LayoutInteractionPointer;
      columnSplitId: string;
      rowSplitId: string;
      columnBaseSizes: [number, number];
      rowBaseSizes: [number, number];
      columnPreviewSizes: [number, number];
      rowPreviewSizes: [number, number];
    }
  | {
      mode: 'drag-panel';
      panelId: string;
      sourceStackId: string;
      anchor: LayoutInteractionAnchor;
      pointer: LayoutInteractionPointer;
      hoveredTarget: LayoutDockTarget | null;
    };
