# @konitif/workbench

Workspace composition, docking, registries and hosting contracts for KONITIF
applications.

## Installation

```sh
npm install @konitif/workbench
```

## What it provides

- Workspace, layout, panel and shell contracts.
- Tool and widget admission, registries and hosting adapters.
- Runtime lifecycle, checkpoint, recovery and observability contracts.
- Project preflight and repository-quality contracts.
- Explicit workspace persistence, synchronization and surface ports.
- Content-addressed workspace usage bundles with strict host-context admission.

## Authority boundary

Workbench owns workspace and runtime coordination contracts. It does not own
hosted domain modules, UI projections, model assets or application policy.
Widgets and tools retain their own definitions; Workbench admits and hosts them.
Physical implementations remain in `@konitif/physics` and are only exposed here
through a compatibility entry.

Workspace presets remain authored source. A usage bundle records an immutable,
content-addressed projection of a preset and its workspace, shell and focus
fragments. Admission rejects altered content, incomplete fragments, incompatible
host contexts and identity/revision conflicts.

## Quick start

```ts
import { createWorkspace, validateWorkspace } from '@konitif/workbench/hosting';

const workspace = createWorkspace();
const issues = validateWorkspace(workspace);

if (issues.length > 0) {
  console.error(issues);
}
```

## Public entry points

| Entry | Purpose |
| --- | --- |
| `@konitif/workbench` | Complete Workbench contract surface. |
| `@konitif/workbench/hosting` | Focused workspace hosting operations. |
| `@konitif/workbench/workspace-contracts` | State-orchestration contracts without host adapters. |
| `@konitif/workbench/physics-runtime` | Transitional forwarding entry for headless Physics contracts. |

## Reference

See [`reference/`](reference/) for the machine-readable capability catalog and
authority diagrams. Layout state and executable composition remain distinct
authorities even when projected by the same application shell.

## License

Source-available under [PolyForm Noncommercial 1.0.0](LICENSE.md), not OSI open
source. Commercial use requires separate written authorization.
