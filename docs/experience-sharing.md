# Portable experience transfer

The shared Workbench authority owns the versioned transfer envelope, content integrity, PNG carrier and content-reference QR encoder. It does not own domain serialization, authentication, cloud storage, package installation or execution.

## Contract

An artifact declares schema/schemaVersion, profile (distribution or continuation), provider format, title, payload and explicit Tool/capability/resource requirements. contentId is SHA-256 of the canonical complete body. Admission verifies the body and its fingerprint before the host interprets provider payloads. A fingerprint proves integrity, not author identity or trust.

The PNG stores the full artifact in an uncompressed UTF-8 iTXt chunk named konitif.experience-transfer. The QR encodes a content-addressed URN; it is an identification reference, not an online resolver or a substitute for the PNG payload. Preserve original file bytes when transporting cards; image recompression may strip metadata.

## Ownership

A provider captures the current definition and declares a disclosure policy. Distribution explicitly selects authored initial state and removes personal editing history/preferences; continuation explicitly includes supported working state. The generic renderer never guesses which fields are personal. Unknown providers or missing policies refuse capture instead of exporting lossy or undisclosed content.

The receiving host validates provider format, inner payload and requirement consistency, then resolves already admitted capabilities before activation. Failure preserves the active workspace. Import never installs code, publishes content or begins a task. Identical admitted content reuses the existing active occurrence; activation is distinct from execution.

The local demo provider supports distribution for empty and leg-vector experiences. Leg geometry and pose are authored initial content; history, selection and presentation preferences are excluded. It derives a separate distribution identity with lineage to the source revision. Continuation retains supported state. Brick distribution remains explicitly unavailable pending its authored-state disclosure adapter; continuation remains available.

## User data projection

WorkbenchUserDataProjection is a host-declared read model for connection state, data purposes, storage locations, retention information, unavailable services and supported provider actions. No credentials or session tokens belong in this projection. Displaying a privacy panel is not a declaration of regulatory compliance; connected providers must supply their actual data inventory and operations.

## Compatibility and rollout

New cards require an updated compatible host and a provider for their declared format. Old Behavior Studio preset-only cards remain a distinct format and are not silently relabelled as complete experiences. Public source and integrated source mirrors must remain equal. Release core before UI, update the UI dependency pin, then update consuming hosts and migrate their provider adapters. Source integration is not publication. No remote publication, automatic acquisition or authentication is supplied by this change.
