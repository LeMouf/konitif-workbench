/** @deprecated Historical visual binding shape. Source providers own these declarations. */
export interface PhysicsPresentationBinding {
  visualRootBodyName?: string;
  bodyVisualObjectNames?: Record<string, string[]>;
  debugHiddenBodyNames?: string[];
}
