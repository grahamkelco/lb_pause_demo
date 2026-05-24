 Plan: Sinkhole Service                                                                                                                    
                                                                                                                                         
 Context                                                                                                                                   

 The project needs its first service implementation — a minimal HTTP server called "sinkhole" that immediately returns 200 on /query and
 exposes RPS metrics on /metrics in OpenTelemetry format. This establishes the service pattern for the monorepo and provides a baseline
 server for backpressure testing.

 Files to Create

 ┌──────────────────────────────────────────┬─────────────────────────────────────────────────────────────────────┐
 │                   File                   │                             Description                             │
 ├──────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────┤
 │ services/sinkhole/package.json           │ Package manifest (@backpressure/sinkhole), follows existing pattern │
 ├──────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────┤
 │ services/sinkhole/tsconfig.json          │ Extends ../../tsconfig.base.json                                    │
 ├──────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────┤
 │ services/sinkhole/src/index.ts           │ Re-exports only (no logic)                                          │
 ├──────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────┤
 │ services/sinkhole/src/metrics_tracker.ts │ MetricsTracker class — sliding window RPS tracking                  │
 ├──────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────┤
 │ services/sinkhole/src/sinkhole_server.ts │ SinkholeServer class — HTTP server with /query and /metrics         │
 ├──────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────┤
 │ services/sinkhole/src/main.ts            │ Bootstrap: read PORT env var, create server, graceful shutdown      │
 └──────────────────────────────────────────┴─────────────────────────────────────────────────────────────────────┘

 Files to Modify

 ┌────────┬────────────────────────────────────────────────────────────────┐
 │  File  │                             Change                             │
 ├────────┼────────────────────────────────────────────────────────────────┤
 │ run.sh │ Add sinkhole to resolvePackage() case statement and usage text │
 └────────┴────────────────────────────────────────────────────────────────┘

 Architecture

 MetricsTracker (metrics_tracker.ts)

 - Circular buffer of per-second request counts (10-second window)
 - setInterval at 1s rotates the active slot
 - recordRequest() — O(1) increment of current slot + total counter
 - getRps() — sum of window / window size
 - getTotalRequests() — monotonic counter
 - start() / stop() — manage the rotation timer

 SinkholeServer (sinkhole_server.ts)

 - Uses Node.js built-in http module (no external deps)
 - Routes: /query → 200 + record request, /metrics → OTel text, else → 404
 - start() / stop() return Promises for clean lifecycle

 Metrics Format (OpenTelemetry text exposition)

 # HELP sinkhole_requests_total Total number of requests received on /query
 # TYPE sinkhole_requests_total counter
 sinkhole_requests_total 12345

 # HELP sinkhole_requests_per_second Requests per second (10s rolling average)
 # TYPE sinkhole_requests_per_second gauge
 sinkhole_requests_per_second 42.5
 Content-Type: text/plain; version=0.0.4; charset=utf-8

 main.ts

 - Reads PORT from env (default 8080)
 - Top-level await for server start
 - SIGTERM/SIGINT handlers for graceful shutdown

 Implementation Sequence

 1. Create package.json and tsconfig.json
 2. Run npm install to register workspace
 3. Create metrics_tracker.ts
 4. Create sinkhole_server.ts
 5. Create main.ts
 6. Create index.ts (re-exports)
 7. Update run.sh
 8. Build and lint: ./run.sh build sinkhole && ./run.sh lint sinkhole

 Verification

 1. ./run.sh build sinkhole — compiles without errors
 2. ./run.sh lint sinkhole — passes lint
 3. Start server manually: node services/sinkhole/dist/main.js
 4. curl http://localhost:8080/query → HTTP 200
 5. curl http://localhost:8080/metrics → OTel-formatted metrics text
 6. Send several requests to /query, confirm RPS metric updates on /metrics