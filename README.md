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
- Abstract Experience revisions that bind presets by immutable content reference
  or by an explicit, traceable override.

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

An Experience is a Workbench authority: it records the stable identity and
revision lineage of an experimentation arrangement without absorbing the
domain that specializes it. A product can reference an authored workspace
preset unchanged or declare an override with ordered transformation records;
admission always verifies the referenced canonical content.

Workbench also owns the generic Experience lifecycle: an immutable revision
opens into a draft bound to an explicit base, saving creates a new revision only
when that base is still the current head, and archive, restore and tombstone
transitions are explicit. The repository contract is storage-neutral; browser,
remote, tenant and product-admission policies remain host adapters.

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
