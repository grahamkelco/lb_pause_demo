 Web Package Implementation Plan                                                                              

 Context

 The backpressure simulation needs a web UI for running simulations and viewing real-time metrics. The
 generator package already exposes metrics in OpenTelemetry text format at /metrics. We need a backend that
 scrapes these endpoints and a React frontend that displays them on auto-refreshing charts.

 Tech choices: Vite + React, Recharts, Express

 Architecture

 Dual-build approach: The web/ package contains both an Express backend (compiled with tsc) and a React
 frontend (compiled with Vite). In production, Express serves the Vite-built static files. In development, Vite
  dev server proxies /api/* to Express.

 Directory Structure

 web/
   package.json                    # Updated
   tsconfig.json                   # Server-only (update include)
   tsconfig.client.json            # Client IDE support (noEmit, jsx, DOM lib)
   vite.config.ts
   src/
     server/
       index.ts                   # Re-exports
       main.ts                    # Entry: start server + scraper
       app.ts                     # Express app factory
       config.ts                  # ServerConfig, ServiceTarget types, env-based loader
       routes/
         metrics_routes.ts        # GET /api/metrics, /api/metrics/:service
         simulation_routes.ts     # POST /api/simulation/run
         services_routes.ts       # GET /api/services
       scraper/
         types.ts                 # ParsedMetrics, TimestampedMetrics, ServiceTimeSeries
         metrics_parser.ts        # Parse OTel text -> Record<string, number>
         metrics_store.ts         # Rolling-window in-memory time-series store
         metrics_scraper.ts       # Periodic fetch from configured targets
     client/
       index.html                 # Vite entry
       main.tsx                   # React mount
       app.tsx                    # Root layout
       types.ts                   # Client-side type defs (mirrors server types)
       styles/
         global.css
       hooks/
         use_metrics.ts           # Poll GET /api/metrics every 2s
         use_simulation.ts        # POST /api/simulation/run
         use_services.ts          # GET /api/services
       components/
         simulation_controls.tsx  # RPS, duration inputs, Run button
         latency_chart.tsx        # p50/p90/p99/p999 line chart
         throughput_chart.tsx     # RPS, success/error rates chart
         service_selector.tsx     # Service tabs/dropdown
         status_indicator.tsx     # Green/red health dot

 Implementation Steps

 Phase 1: Project Scaffolding

 1. Update web/package.json
   - Add deps: express, react, react-dom, recharts
   - Add devDeps: @types/express, @types/react, @types/react-dom, @vitejs/plugin-react, vite
   - Update scripts:
       - "build": "vite build && tsc -p tsconfig.json"
     - "start": "node dist/server/main.js"
     - "dev:client": "vite"
     - "dev:server": "npx tsx src/server/main.ts"
 2. Update web/tsconfig.json — change include to ["src/server/**/*.ts"]
 3. Create web/tsconfig.client.json — extends base, adds jsx: "react-jsx", moduleResolution: "bundler", lib:
 ["ES2022", "DOM", "DOM.Iterable"], noEmit: true, includes src/client/**
 4. Create web/vite.config.ts — root: src/client, build output: ../../dist/client, proxy /api to localhost:3001
 5. Create src/client/index.html — minimal HTML with <div id="root"> and script tag
 6. Update root eslint.config.mjs — add **/*.tsx to the files array, add **/*.tsx to filename convention rule
 7. Run npm install to set up new dependencies

 Phase 2: Backend - Metrics Scraping Core

 8. src/server/config.ts — ServiceTarget (name, host, port, metricsPath) and ServerConfig (port,
 scrapeIntervalMs, retentionMs, targets). Load from env vars with defaults (generator on localhost:8080).
 9. src/server/scraper/types.ts — ParsedMetrics (Record<string, number>), TimestampedMetrics ({timestamp,
 metrics}), ServiceTimeSeries ({name, entries}), ServiceStatus ({name, healthy, lastScrapeMs, error})
 10. src/server/scraper/metrics_parser.ts + test — Parse OTel text format: skip # lines, split name value lines
  into Record<string, number>. Reference: generator/src/metrics_formatter.ts for the exact format.
 11. src/server/scraper/metrics_store.ts + test — MetricsStore class with record(), getAll(), getService().
 Map<string, TimestampedMetrics[]> with eviction on record() for entries older than retentionMs.
 12. src/server/scraper/metrics_scraper.ts — MetricsScraper class. Takes targets + store. start()/stop()
 methods with setInterval. Fetches each target's /metrics, parses, stores. Tracks ServiceStatus per target.
 Handles fetch errors gracefully.

 Phase 3: Backend - API Routes

 13. src/server/routes/metrics_routes.ts — Express Router. GET /api/metrics returns store.getAll(). GET
 /api/metrics/:service returns store.getService() or 404.
 14. src/server/routes/simulation_routes.ts — Express Router. POST /api/simulation/run accepts {rps, duration,
 uri} body, proxies to generator's GET /run?rps=...&duration=...&uri=..., returns response. Generator target
 from config.
 15. src/server/routes/services_routes.ts — Express Router. GET /api/services returns scraper's service
 statuses.
 16. src/server/app.ts — Creates Express app: JSON body parser, mounts routes, serves dist/client/ static
 files, SPA fallback for non-API routes.
 17. src/server/main.ts — Entry point: load config, create store, create scraper, create app, listen.
 18. src/server/index.ts — Re-exports.

 Phase 4: Frontend

 19. src/client/types.ts — Client-side mirrors of ServiceTimeSeries, ServiceStatus, SimulationParams,
 SimulationResult.
 20. src/client/styles/global.css — Minimal clean styling.
 21. src/client/main.tsx + src/client/app.tsx — React mount and root layout (header, controls section, charts
 section).
 22. Hooks:
   - use_metrics.ts — useEffect + setInterval polling /api/metrics every 2s
   - use_simulation.ts — POST /api/simulation/run, tracks running state
   - use_services.ts — fetch /api/services
 23. Components:
   - simulation_controls.tsx — Number inputs for RPS + duration, Run button. Designed for future expansion
 (server type selector, etc.)
   - latency_chart.tsx — Recharts LineChart: p50, p90, p99, p999 over time. Color-coded lines with legend.
   - throughput_chart.tsx — Recharts LineChart: rps_actual, success rate, error rate over time.
   - service_selector.tsx — Tabs/dropdown to filter charts by service.
   - status_indicator.tsx — Green/red dot with service name.

 Phase 5: Integration & Verification

 24. Build and lint: ./run.sh build web && ./run.sh lint web
 25. Run tests: ./run.sh test web
 26. Run setup.sh to install deps, verify clean

 Key Files to Reference

 - generator/src/metrics_formatter.ts — OTel text format contract
 - generator/src/server.ts — HTTP server pattern, /run endpoint interface
 - generator/src/config.ts — Config pattern to follow
 - tsconfig.base.json — Base TS config inherited by server tsconfig
 - eslint.config.mjs — Needs .tsx support added

 Verification

 1. ./run.sh build web — both Vite and tsc succeed
 2. ./run.sh lint web — no lint errors
 3. ./run.sh test web — parser and store tests pass
 4. Start generator in server mode, start web server, verify metrics scraping works
 5. Open browser to web UI, verify charts render and auto-refresh
 6. Run a simulation from the UI, verify it triggers the generator and charts update