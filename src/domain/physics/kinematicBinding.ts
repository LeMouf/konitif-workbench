/** Bidirectional coordinate/joint correspondence, not only display settings. */
export type PhysicsCoordinateFrame = 'viewer-y-up' | 'mujoco-z-up' | 'z-up' | 'custom';

export type PhysicsJointMappingMode = 'direct' | 'mimic' | 'fixed' | 'visual-only' | 'physics-only';

/** @deprecated Historical compatibility shape; source providers own authored correspondences. */
export interface PhysicsJointMapping {
  mode: PhysicsJointMappingMode;
  visualJointName?: string;
  physicsJointName?: string;
  sourceJointName?: string;
  scale?: number;
  sign?: number;
  offset?: number;
  lowerLimit?: number | null;
  upperLimit?: number | null;
  label?: string;
}

/** @deprecated Historical compatibility shape, not workspace authority. */
export interface PhysicsKinematicBinding {
  coordinateFrame?: PhysicsCoordinateFrame | string;
  sceneYawRadians?: number;
  jointMappings?: PhysicsJointMapping[];
}
