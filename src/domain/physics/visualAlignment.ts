import type { PhysicsPresentationBinding } from './presentationBinding.js';
import type { PhysicsKinematicBinding } from './kinematicBinding.js';
import type { PhysicsSimulationProfile } from './simulationProfile.js';
import type { PhysicsObservationProfile } from './observationProfile.js';

export type * from './presentationBinding.js';
export type * from './kinematicBinding.js';
export type * from './simulationProfile.js';
export type * from './observationProfile.js';
export type * from './colliderGeometry.js';

/**
 * Legacy aggregate retained for source compatibility and existing metadata.
 * The name is historical: these fields also affect commands and simulation.
 * Runtime adapters retain their existing fallbacks (notably COM to visual root).
 * @deprecated Historical source encoding; not a Workbench-owned model.
 */
export interface PhysicsVisualAlignmentProfile extends
  PhysicsPresentationBinding,
  PhysicsKinematicBinding,
  PhysicsSimulationProfile,
  PhysicsObservationProfile {}
