# @konitif/workbench

## Build and distribution

Run `npm run build` to produce `dist` with the locked TypeScript compiler. The
published contract exposes compiled ESM and declarations only. Run `npm test`
then `npm run verify:package`; the latter packs the exact payload and consumes
all four public entries from an isolated Node ESM/NodeNext fixture.

The build does not install dependencies or publish. Release remains a separate,
protected operation after the repository and archive have been qualified.

Product-neutral Workbench authority for workspace composition, docking,
registries, persistence ports and shell lifecycle contracts.

The package hosts tools and widgets through generic definitions. It must not
depend on a private product package or specialize product-specific behavior.

## Product color policy migration

The development barrel no longer exports `getRobotJointColor`. Consumers must
obtain their color policy from their product layer; generic viewers accept an
injected color provider. This is a source API change, with no persisted-data migration.
No compatibility reexport is provided because Workbench must not depend on a
product package. This migration does not publish either package.

Widget definitions and lazy bindings belong to `@konitif/widgets`.
Workbench provides `createWorkbenchWidgetAdapter` to project an admitted
definition into its hosting contract without loading or registering it.
Widget registries, zones, placements and docking helpers remain here.
Consumers of the former Widgets facade should import these host contracts
from `@konitif/workbench`; no persisted placement migration is required.

## Selected workspace contracts

`@konitif/workbench/workspace-contracts` exposes an explicit selection of
workspace, shell, layout and tool-state contracts for state orchestration.
It reexports the existing implementations without including audio, HTTP or
local-storage adapters. The root entry and `hosting` remain compatible.
This source-level boundary is tested; standalone archive qualification and
publication remain separate gates.

## Transitional headless physics entry

`@konitif/workbench/physics-runtime` forwards `PhysicsService`,
`NoopPhysicsBackend` and physical contracts to the published `@konitif/physics`
package. Their implementations do not live in Workbench.
Consumers inject backend factories and explicitly drive stepping and disposal.
No worker, engine binary, visual alignment or product configuration is loaded
by this entry. The former UI paths reexport the same classes for compatibility.

This is a compatibility boundary, not a permanent Workbench responsibility.
Backend identifiers and source shapes
remain unchanged; the no-op backend does not simulate physical effects.
