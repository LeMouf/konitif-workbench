# Temporal compatibility surface

This directory contains Workbench-facing temporal adapters. Generic clock,
transport, scheduling, invalidation and history mechanics are provided by
`@konitif/temporal`; the Workbench layer preserves established entry paths and
adds only host-specific coordination.

## Authority boundary

The supplied `ClockGraph` owns adapter resolution. Callers own clock sources,
media sources, scheduler hosts and shared-history lifecycle. Workbench adapters
must not create a second time authority or make a temporal projection own the
history it displays.

## Transport clock resolution

The output clock (`clockId`, `root` by default) must be registered before the
transport is created. A clock referenced by `seek` must be registered before
that command; it may be added to the graph after transport creation.

An unknown reference raises an explicit `TemporalTransport` error. A rejected
seek does not change position, state or timestamps and does not notify
subscribers. It never converts an unknown clock value to seconds implicitly.

For compatibility, register the adapter before use or explicitly select `root`
with `unit: 'seconds'` when the value is expressed in seconds. Omitting the unit
from `seek` still means seconds, even when the output clock uses frames.

## Media clock inputs

Effective audio sample rate and video frame rate must be finite and strictly
positive; invalid values raise `RangeError` before a temporal read. Fractional
rates remain valid. The audio source rate takes precedence over the option, with
48,000 Hz as the fallback.

Rates are captured at creation. Without a source, `now()` remains zero as a
static conversion mode; this is not evidence of measurement or
synchronization. Sources remain owned by the caller and no reader is started
implicitly.

## Scheduler host

`createTemporalScheduler` retains its browser-oriented compatibility adapter.
The independent `scheduler/temporalSchedulerCore` receives an explicit
`TemporalSchedulerHost` and has no DOM dependency.

```ts
import { createTemporalSchedulerCore } from './scheduler/temporalSchedulerCore';

const scheduler = createTemporalSchedulerCore({
  transport,
  externalLoop: true,
  onFrame(snapshot, deltaSeconds) {
    consume(snapshot, deltaSeconds);
  },
}, { isVisible: () => true });

scheduler.start();
scheduler.frame(1);
scheduler.stop();
```

An externally driven loop supplies `requestFrame` and `cancelFrame`. Visibility
is a host input, not a hidden browser read. `frame()` remains usable independently
of `start()` and `stop()`. The `drop-elapsed` policy adjusts rendering delta
without erasing elapsed transport time.

## History compatibility

`createRuntimeHistoryRecorder` and the `RuntimeHistory*` types specialize the
independent immutable-history engine. They accept typed samples and events
without depending on a particular Viewer. Destroying a projection must not
destroy history owned by a longer-lived host.

`timeSeconds` and `seek` use seconds; `now`, `tick` and `recordedAt` use
milliseconds. Inputs are detached and frozen at admission. Payloads must be
plain data: primitives, arrays and plain objects are accepted; functions,
accessors and class instances are rejected.

## Minimal example

```ts
import {
  createClockGraph,
  createTemporalTransport,
  createTemporalScheduler,
  createInvalidationController,
  easingRegistry,
} from './temporal';

const clockGraph = createClockGraph();
const transport = createTemporalTransport({ clockGraph });
const invalidation = createInvalidationController();

const scheduler = createTemporalScheduler({
  transport,
  invalidation,
  mode: 'balanced',
  visibilityPolicy: 'drop-elapsed',
  onFrame(snapshot, delta) {
    consume(snapshot, delta);
  },
});

transport.play();
scheduler.start();

const eased = easingRegistry.evaluate('expo.out', 0.5);
```
