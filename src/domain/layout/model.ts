import type { PanelNode } from '../panel/model';

export type SplitOrientation = 'horizontal' | 'vertical';
export type NonEmptyArray<T> = readonly [T, ...T[]];

/**
 * Invariants:
 * - split nodes always have exactly two children
 * - `sizes` are finite, positive, and normalized by domain helpers
 */
export interface SplitNode {
  id: string;
  kind: 'split';
  orientation: SplitOrientation;
  sizes: [number, number];
  children: readonly [LayoutNode, LayoutNode];
}

/**
 * Invariants:
 * - stack nodes always contain at least one panel
 * - `activeChildId` always points at one of `children`
 */
export interface StackNode {
  id: string;
  kind: 'stack';
  activeChildId: string;
  headerVisible?: boolean;
  children: NonEmptyArray<PanelNode>;
}

export type LayoutNode = SplitNode | StackNode;
