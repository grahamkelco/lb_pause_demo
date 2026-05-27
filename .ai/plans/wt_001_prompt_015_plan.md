 Add simulated_pause Service Type                                                                             

 Context

 We need a new backend service type that simulates realistic server behavior: actual CPU work on each request
 (fixed compute via repeated hashing) and random GC-like pauses (200ms blocking sleep at random intervals).
 Unlike the sinkhole (which returns instantly), this creates observable latency and backpressure effects. The
 sidecar detects these pauses and reports health status.

 Design Decisions

 - CPU work: Use Node's built-in crypto.createHash('sha256') in a synchronous loop (2000 iterations) on /query.
  This is a fixed amount of compute, not a fixed duration — it takes longer under load as expected.
 - GC pause simulation: A background timer randomly triggers a 200ms synchronous blocking pause (Atomics.wait
 on a SharedArrayBuffer). This blocks the event loop, simulating a real GC stop-the-world. The sidecar's health
  check will detect the unresponsiveness.
 - Metric names: Use simulated_pause_* prefix (same shape as sinkhole: _requests_total counter,
 _requests_per_second gauge).
 - Sidecar: Use the existing random health check (already implemented) since the GC pauses are built into the
 server itself.
 - Naming convention: Server type simulated-pause, containers simulated-pause-1..4, sidecars
 sidecar-simulated-pause-1..4.

 UI Integration Fixes

 Two things in the UI currently hardcode "sinkhole" and need to be generalized:
 1. server_card.tsx hardcodes sinkhole_requests_per_second — needs to detect the metric name dynamically from
 available metrics
 2. app.tsx sidecarNameFor() uses replace(/^sinkhole/, "sidecar") — needs a generic approach that works for any
  server type

 Implementation

 Phase 1: Create services/simulated_pause/ package

 1a. services/simulated_pause/package.json
 - Copy from sinkhole, change name to @backpressure/simulated-pause

 1b. services/simulated_pause/tsconfig.json
 - Same as sinkhole's tsconfig

 1c. services/simulated_pause/src/metrics_tracker.ts
 - Reuse the same MetricsTracker class from sinkhole (copy it — it's small, ~75 lines)

 1d. services/simulated_pause/src/gc_pause_simulator.ts (new)
 - Class GcPauseSimulator that runs a background timer
 - Constructor params: pauseDurationMs = 200, minIntervalMs = 5000, maxIntervalMs = 15000
 - start(): schedules next pause at a random delay between min/max interval
 - When triggered: blocks the event loop for pauseDurationMs using Atomics.wait(new Int32Array(new
 SharedArrayBuffer(4)), 0, 0, pauseDurationMs)
 - After pausing, schedules the next one
 - stop(): clears the timer
 - isPaused: boolean getter for whether currently in a pause (set true before blocking, false after)

 1e. services/simulated_pause/src/cpu_work.ts (new)
 - function doCpuWork(iterations: number = 2000): void
 - Synchronous loop: hash a seed value with crypto.createHash('sha256').update(buffer).digest() for iterations
 rounds, feeding each output as the next input

 1f. services/simulated_pause/src/simulated_pause_server.ts (new)
 - Similar to SinkholeServer but:
   - Constructor creates MetricsTracker and GcPauseSimulator
   - GET /query: calls doCpuWork(2000), records request in metrics, returns 200
   - GET /metrics: returns simulated_pause_requests_total and simulated_pause_requests_per_second
   - start(): starts metrics tracker AND gc pause simulator
   - stop(): stops both

 1g. services/simulated_pause/src/main.ts
 - Same pattern as sinkhole main.ts, instantiates SimulatedPauseServer

 1h. services/simulated_pause/src/index.ts
 - Re-exports

 Phase 2: LB config

 lb/lb_config.yaml — Add 4 simulated-pause servers
   - host: simulated-pause-1
     port: 8080
     sidecar_port: 9009
     type: simulated-pause
   # ... through simulated-pause-4 on ports 9009-9012

 Phase 3: Docker

 3a. Dockerfile — Add build + runtime stages
 - simulated-pause-build stage: copy services/simulated_pause/, build
 - simulated-pause runtime stage: same pattern as sinkhole
 - Update base stage: add COPY services/simulated_pause/package.json services/simulated_pause/

 3b. docker-compose.yml — Add 8 new containers
 - simulated-pause-1..4: build target simulated-pause, PORT=8080
 - sidecar-simulated-pause-1..4: HEALTH_CHECKS=random, LB_PORT=9009..9012

 Phase 4: Web backend

 4a. web/src/server/config.ts — Add scrape targets
 - simulated-pause-1..4 on port 8080
 - sidecar-simulated-pause-1..4 on port 9100

 4b. web/src/server/routes/simulation_routes.ts — Add to TYPE_PATH_MAP
 - "simulated-pause": "/query"

 Phase 5: UI fixes for generic service support

 5a. web/src/client/app.tsx — Fix sidecarNameFor()
 - Change from serverName.replace(/^sinkhole/, "sidecar") to a generic approach:
 - Extract the type from the server name (everything before the last -N), replace with sidecar-{suffix}
 - Simpler: derive sidecar name from group type + index: sidecar-${type}-${n} for non-sinkhole types, keep
 existing logic for sinkhole/sinkhole-random
 - Actually simplest: pass sidecar prefix from ServerGroupSection since it knows the type. For type sinkhole →
 sidecar prefix sidecar, for sinkhole-random → sidecar-random, for simulated-pause → sidecar-simulated-pause.
 Pattern: replace the first word of the type with sidecar.

 5b. web/src/client/components/server_card.tsx — Generic RPS metric lookup
 - Instead of hardcoding sinkhole_requests_per_second, detect the *_requests_per_second metric dynamically from
  available metric keys in the entry
 - Simple approach: find the first metric key ending in _requests_per_second

 Phase 6: Build & Verify

 1. ./run.sh build lb && ./run.sh build sidecar && ./run.sh build web
 2. Build new service: npm run build -w @backpressure/simulated-pause
 3. ./run.sh lint lb && ./run.sh lint web
 4. ./run.sh test lb && ./run.sh test web
 5. ./run.sh up — all containers start
 6. Select simulated-pause in UI dropdown, run simulation
 7. Verify: server cards show RPS, sidecar health toggles, generator latency is higher than sinkhole

 Key Files

 ┌────────────────────────────────────────────────────────┬──────────────────────────────────────────┐
 │                          File                          │                  Action                  │
 ├────────────────────────────────────────────────────────┼──────────────────────────────────────────┤
 │ services/simulated_pause/package.json                  │ Create                                   │
 ├────────────────────────────────────────────────────────┼──────────────────────────────────────────┤
 │ services/simulated_pause/tsconfig.json                 │ Create                                   │
 ├────────────────────────────────────────────────────────┼──────────────────────────────────────────┤
 │ services/simulated_pause/src/metrics_tracker.ts        │ Create (copy from sinkhole)              │
 ├────────────────────────────────────────────────────────┼──────────────────────────────────────────┤
 │ services/simulated_pause/src/gc_pause_simulator.ts     │ Create                                   │
 ├────────────────────────────────────────────────────────┼──────────────────────────────────────────┤
 │ services/simulated_pause/src/cpu_work.ts               │ Create                                   │
 ├────────────────────────────────────────────────────────┼──────────────────────────────────────────┤
 │ services/simulated_pause/src/simulated_pause_server.ts │ Create                                   │
 ├────────────────────────────────────────────────────────┼──────────────────────────────────────────┤
 │ services/simulated_pause/src/main.ts                   │ Create                                   │
 ├────────────────────────────────────────────────────────┼──────────────────────────────────────────┤
 │ services/simulated_pause/src/index.ts                  │ Create                                   │
 ├────────────────────────────────────────────────────────┼──────────────────────────────────────────┤
 │ lb/lb_config.yaml                                      │ Modify — add 4 simulated-pause entries   │
 ├────────────────────────────────────────────────────────┼──────────────────────────────────────────┤
 │ Dockerfile                                             │ Modify — add build/runtime stages        │
 ├────────────────────────────────────────────────────────┼──────────────────────────────────────────┤
 │ docker-compose.yml                                     │ Modify — add 8 containers                │
 ├────────────────────────────────────────────────────────┼──────────────────────────────────────────┤
 │ web/src/server/config.ts                               │ Modify — add scrape targets              │
 ├────────────────────────────────────────────────────────┼──────────────────────────────────────────┤
 │ web/src/server/routes/simulation_routes.ts             │ Modify — add to TYPE_PATH_MAP            │
 ├────────────────────────────────────────────────────────┼──────────────────────────────────────────┤
 │ web/src/client/app.tsx                                 │ Modify — generic sidecar name derivation │
 ├────────────────────────────────────────────────────────┼──────────────────────────────────────────┤
 │ web/src/client/components/server_card.tsx              │ Modify — generic RPS metric lookup       │
 └────────────────────────────────────────────────────────┴──────────────────────────────────────────┘