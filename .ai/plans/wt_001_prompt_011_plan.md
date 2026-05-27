 Multi-Server Docker Support with UI Controls                                                                 

 Context

 The backpressure simulation needs to run multiple backend servers behind the load balancer. Each server in the
  LB config is tagged with a type (e.g., "sinkhole"). The UI discovers available server types and counts from
 the LB at runtime, so adding a new server type later (e.g., "java-gc") only requires config/Docker changes —
 no UI code changes.

 Architecture Overview

 Simulation flow:
 1. UI fetches GET /api/servers → web backend proxies to GET http://lb:8080/admin/servers → returns available
 types and counts (e.g., [{ type: "sinkhole", total: 4, active: 4 }])
 2. User selects server type from dropdown (populated dynamically), server count (1–N), RPS, duration
 3. Web backend calls POST http://lb:8080/admin/servers with { type: "sinkhole", activeCount: 2 }
 4. Web backend calls generator with rps, duration, uri=http://lb:8080/query (path determined by server type)
 5. LB routes round-robin only to servers matching the selected type, limited to activeCount

 LB config with typed servers:
 listen:
   port: 8080
 servers:
   - host: sinkhole-1
     port: 8080
     sidecar_port: 9001
     type: sinkhole
   - host: sinkhole-2
     port: 8080
     sidecar_port: 9002
     type: sinkhole
   # ... sinkhole-3, sinkhole-4

 Docker topology: 13 containers on backpressure bridge network:
 - lb (port 8080, sidecar TCP ports 9001–9004)
 - sinkhole-1..4 (each port 8080 internal)
 - sidecar-1..4 (each connects to LB on its assigned TCP port)
 - generator, web (existing)

 Implementation Steps

 Phase 1: LB Config — Add type field

 1a. lb/src/config.ts — Add type to ServerConfig
 - Add optional type?: string field to ServerConfig interface
 - Parse type from YAML (string, optional) in parseServerEntry()

 1b. lb/lb_config.yaml — Add type tags
 listen:
   port: 8080
 servers:
   - host: sinkhole-1
     port: 8080
     sidecar_port: 9001
     type: sinkhole
   - host: sinkhole-2
     port: 8080
     sidecar_port: 9002
     type: sinkhole
   - host: sinkhole-3
     port: 8080
     sidecar_port: 9003
     type: sinkhole
   - host: sinkhole-4
     port: 8080
     sidecar_port: 9004
     type: sinkhole

 Phase 2: LB Router — Type-aware active count

 2a. lb/src/router.ts — Type-based routing
 - Add Map<string, number> for per-type active counts (initialized to full count per type)
 - Add setActiveServers(type: string, count: number) method — validates count ≤ servers of that type, resets
 currentIndex
 - Add getServerGroups(): Array<{ type: string, total: number, active: number }> — returns info per type
 - Modify next(): only consider servers whose type matches the active type AND whose index within their type
 group is < activeCount for that type. Simplest approach: build an "eligible servers" list from the config
 based on active type/counts, round-robin over that list
 - Add setActiveType(type: string) — sets which type the router is currently routing to
 - Track activeType: string | null — when set, next() only considers servers of that type (up to activeCount)

 2b. Tests — New tests for type-based routing and setActiveServers

 Phase 3: LB Admin Endpoint

 3a. lb/src/admin_handler.ts (new) — Admin HTTP request handler
 - handleRequest(req, res): boolean — returns true if path starts with /admin/
 - GET /admin/servers — returns router.getServerGroups() as JSON (array of { type, total, active })
 - POST /admin/servers — accepts { type: string, activeCount: number }, calls router.setActiveServers(type,
 count) and router.setActiveType(type), returns 200

 3b. lb/src/proxy_server.ts — Intercept admin requests
 - Add optional AdminHandler to constructor
 - In handleRequest, check admin handler first; if handled, return early

 3c. lb/src/main.ts — Wire up AdminHandler
 - Create AdminHandler with router, pass to ProxyServer

 3d. Tests — Admin handler tests

 Phase 4: Sidecar Env Var Config

 4a. lb/sidecar/src/config.ts — Add loadSidecarConfigFromEnv()
 - Reads LB_HOST, LB_PORT (required), CHECK_INTERVAL_MS, METRICS_PORT, HEALTH_CHECKS (comma-separated, default
 "always_healthy")

 4b. lb/sidecar/src/main.ts — Use env config when LB_HOST is set
 - If LB_HOST env var exists, call loadSidecarConfigFromEnv() instead of loading YAML

 Phase 5: Web Backend Changes

 5a. web/src/server/config.ts — Add LB target and sinkhole scrape targets
 - Add LB_HOST/LB_PORT env vars → lbTarget: ServiceTarget
 - Add sinkhole-1..4 as scrape targets (defaulting host to sinkhole-N)

 5b. web/src/server/routes/simulation_routes.ts — Orchestrate simulation
 - Accept { serverType, serverCount, rps, duration } body
 - Step 1: POST to LB admin API { type: serverType, activeCount: serverCount }
 - Step 2: Map serverType to URI path (sinkhole → /query; extensible map)
 - Step 3: Call generator with rps, duration, uri=http://lb:8080/<path>
 - Accept lbTarget parameter in createSimulationRoutes

 5c. web/src/server/routes/services_routes.ts — Add LB server groups proxy
 - Add GET /api/servers route that fetches GET http://lb:8080/admin/servers and returns the result
 - This lets the UI discover available server types/counts dynamically

 5d. web/src/server/app.ts — Pass lbTarget to routes, mount new /api/servers route

 Phase 6: Web UI Changes

 6a. web/src/client/types.ts — Update types
 - Update SimulationParams: remove uri, add serverType: string, serverCount: number
 - Add ServerGroup type: { type: string, total: number, active: number }

 6b. web/src/client/hooks/use_servers.ts — Rename/repurpose
 - Fetch GET /api/servers (LB server groups), not /api/services (scraper statuses)
 - Return ServerGroup[] for populating the dropdown
 - Keep the existing use_services.ts for scraper health statuses (rename the new hook to use_server_groups.ts
 to avoid confusion)

 6c. New hook: web/src/client/hooks/use_server_groups.ts
 - Fetch GET /api/servers on mount (one-time, not polling — server types don't change at runtime)
 - Return ServerGroup[]

 6d. web/src/client/components/simulation_controls.tsx — Dynamic form
 - Accept serverGroups: ServerGroup[] prop
 - Server type <select> populated from serverGroups (shows type names)
 - Server count <select> populated with 1..N where N = selected group's total
 - Remove URI input (auto-determined by backend)
 - Update handleSubmit to pass { serverType, serverCount, rps, duration }

 6e. web/src/client/hooks/use_simulation.ts — Match new SimulationParams shape

 6f. web/src/client/app.tsx — Use useServerGroups() hook, pass to SimulationControls

 6g. web/src/client/styles/global.css — Add select element styling to match inputs

 Phase 7: Dockerfile & Docker Compose

 7a. Dockerfile — Add sinkhole and sidecar build/runtime stages
 - Update base stage: add COPY services/sinkhole/package.json services/sinkhole/
 - sinkhole-build stage: copy services/sinkhole/, build @backpressure/sinkhole
 - sidecar-build stage: copy lb/sidecar/, build @backpressure/sidecar
 - sinkhole runtime: node services/sinkhole/dist/main.js, ENV PORT=8080
 - sidecar runtime: node lb/sidecar/dist/main.js

 7b. docker-compose.yml — Add 8 new service entries
 - sinkhole-1..4: build target sinkhole, PORT=8080, expose 8080, backpressure network
 - sidecar-1..4: build target sidecar, env LB_HOST=lb LB_PORT=900N HEALTH_CHECKS=always_healthy, depends_on lb
 + sinkhole-N
 - Update lb: depends_on sinkhole-1..4
 - Update web: add LB_HOST=lb LB_PORT=8080 env vars, depends_on lb

 Phase 8: Build & Verify

 1. ./run.sh build lb && ./run.sh build sidecar && ./run.sh build web — all compile
 2. ./run.sh lint lb && ./run.sh lint web — no lint errors
 3. ./run.sh test lb && ./run.sh test web — tests pass
 4. ./run.sh up — all 13 containers start
 5. curl http://localhost:3002/api/servers — returns [{ type: "sinkhole", total: 4, active: 4 }]
 6. Open http://localhost:3002 — dropdown shows "sinkhole", count shows 1–4
 7. Run simulation with 2 servers — LB routes to only sinkhole-1 and sinkhole-2

 Key Files

 ┌───────────────────────────────────────────────────┬───────────────────────────────────────────────────┐
 │                       File                        │                      Action                       │
 ├───────────────────────────────────────────────────┼───────────────────────────────────────────────────┤
 │ lb/src/config.ts                                  │ Modify — add type to ServerConfig                 │
 ├───────────────────────────────────────────────────┼───────────────────────────────────────────────────┤
 │ lb/src/router.ts                                  │ Modify — type-aware active count routing          │
 ├───────────────────────────────────────────────────┼───────────────────────────────────────────────────┤
 │ lb/src/admin_handler.ts                           │ Create — admin HTTP handler                       │
 ├───────────────────────────────────────────────────┼───────────────────────────────────────────────────┤
 │ lb/src/proxy_server.ts                            │ Modify — intercept /admin/                        │
 ├───────────────────────────────────────────────────┼───────────────────────────────────────────────────┤
 │ lb/src/main.ts                                    │ Modify — wire AdminHandler                        │
 ├───────────────────────────────────────────────────┼───────────────────────────────────────────────────┤
 │ lb/lb_config.yaml                                 │ Modify — add type tags, Docker hostnames          │
 ├───────────────────────────────────────────────────┼───────────────────────────────────────────────────┤
 │ lb/sidecar/src/config.ts                          │ Modify — add env var loader                       │
 ├───────────────────────────────────────────────────┼───────────────────────────────────────────────────┤
 │ lb/sidecar/src/main.ts                            │ Modify — use env config                           │
 ├───────────────────────────────────────────────────┼───────────────────────────────────────────────────┤
 │ web/src/client/types.ts                           │ Modify — update SimulationParams, add ServerGroup │
 ├───────────────────────────────────────────────────┼───────────────────────────────────────────────────┤
 │ web/src/client/components/simulation_controls.tsx │ Modify — dynamic dropdowns                        │
 ├───────────────────────────────────────────────────┼───────────────────────────────────────────────────┤
 │ web/src/client/hooks/use_server_groups.ts         │ Create — fetch server groups from LB              │
 ├───────────────────────────────────────────────────┼───────────────────────────────────────────────────┤
 │ web/src/client/hooks/use_simulation.ts            │ Modify — new params shape                         │
 ├───────────────────────────────────────────────────┼───────────────────────────────────────────────────┤
 │ web/src/client/app.tsx                            │ Modify — use server groups hook                   │
 ├───────────────────────────────────────────────────┼───────────────────────────────────────────────────┤
 │ web/src/client/styles/global.css                  │ Modify — select styling                           │
 ├───────────────────────────────────────────────────┼───────────────────────────────────────────────────┤
 │ web/src/server/config.ts                          │ Modify — add LB + sinkhole targets                │
 ├───────────────────────────────────────────────────┼───────────────────────────────────────────────────┤
 │ web/src/server/routes/simulation_routes.ts        │ Modify — orchestration with type                  │
 ├───────────────────────────────────────────────────┼───────────────────────────────────────────────────┤
 │ web/src/server/routes/services_routes.ts          │ Modify — add /api/servers proxy                   │
 ├───────────────────────────────────────────────────┼───────────────────────────────────────────────────┤
 │ web/src/server/app.ts                             │ Modify — pass lbTarget, mount /api/servers        │
 ├───────────────────────────────────────────────────┼───────────────────────────────────────────────────┤
 │ Dockerfile                                        │ Modify — add sinkhole/sidecar stages              │
 ├───────────────────────────────────────────────────┼───────────────────────────────────────────────────┤
 │ docker-compose.yml                                │ Modify — add 8 new services                       │
 └───────────────────────────────────────────────────┴───────────────────────────────────────────────────┘