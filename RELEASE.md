# Release @konitif/workbench

`LeMouf/konitif-workbench` is the sole release authority for
`@konitif/workbench`. The package owns workspace composition, docking,
registries and hosting contracts. Hosted domain modules, UI projections and
application presets remain consumers.

## Protected release path

1. Keep `WORKBENCH_NPM_PUBLISH_ENABLED` absent or different from `true` while
   the repository and npm Trusted Publisher are being configured.
2. Protect the `npm-release` environment with a required reviewer. Allow
   deployment tags matching `v*`; do not admit `main` as a deployment branch.
3. Configure the npm Trusted Publisher for repository
   `LeMouf/konitif-workbench`, workflow `publish.yml` and environment
   `npm-release`.
4. Require the validation workflow on `main` and preserve tag ancestry checks.
5. Set `WORKBENCH_NPM_PUBLISH_ENABLED=true` only after those controls are
   visible and verified.

The workflow checks out the exact tag in a separate directory, verifies that
the tag matches the package version and belongs to `main`, rebuilds, tests and
qualifies the exact archive, then publishes that retained archive through npm
OIDC. It does not install a newer Node or npm toolchain.

## Initial 0.284.1 bootstrap

Version `0.284.1` may use one explicit bootstrap exception if the Trusted
Publisher cannot publish the first package version.

Leave `WORKBENCH_NPM_PUBLISH_ENABLED` absent while pushing
`v0.284.1`. Run `npm run verify:package`, retain the exact archive reported by
the verifier, and publish only that archive from an already authenticated local
machine.

That bootstrap has no CI provenance and must not be repeated. The next version
must exercise the protected OIDC path; `0.284.1` must never be republished.

## Manual dispatch

Manual dispatch is a retry mechanism for an existing protected tag, not a way
to publish a branch. Dispatch from the exact tag ref and provide the same tag as
input. Dispatching from `main` is intentionally refused.

Never publish the monorepo source package, a directory with source exports,
Workbench Runtime, a UI projection, hosted domain modules or application presets from
this repository.

## Physics subject migration

Version `0.285.0` forwards the generic Physics subject contract. Consumers of
the transitional `@konitif/workbench/physics-runtime` entry must replace
`RobotPhysicsSource` with `PhysicsSubjectSource` and call `loadSubject` instead
of `loadRobot`. Physics `0.285.0` must therefore be available before this
Workbench version is published.

## Workspace usage admission

Version `0.285.1` adds generic launch, catalog, preset-selection and immutable
workspace-usage contracts. It also makes the source compiler boundary check
portable across POSIX and Windows paths. These additions remain independent of
hosted products and require no dependency-version change.

Version `0.285.2` republishes the identical contract surface after npm accepted
the `0.285.1` metadata during a registry incident without making its tarball
available. Consumers must use `0.285.2`; the unavailable `0.285.1` version is
not a valid delivery artifact.
