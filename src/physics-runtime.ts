/** Headless physics kernel. Backend construction and stepping remain caller-driven. */
export type * from './domain/physics/contracts';
export { PhysicsService, type PhysicsServiceOptions } from './application/physics/PhysicsService';
export { NoopPhysicsBackend } from './application/physics/NoopPhysicsBackend';
