 Load Generator Implementation Plan                                                                             
                                                                                                                
 Context

 The backpressure simulation project needs a load generator (@backpressure/generator) that sends HTTP GET
 traffic at a controlled rate to a target URI. This is a core component used both from the CLI and from the web
  UI (via server mode). The generator/ package is fully scaffolded (package.json, tsconfig.json) but src/ is
 empty.

 File Structure

 generator/src/
   index.ts              -- Re-exports only
   cli.ts                -- CLI entry point (parseArgs, dispatch)
   config.ts             -- LoadTestConfig type + validation + defaults
   rate_limiter.ts       -- Drift-compensating interval scheduler
   load_runner.ts        -- Single-thread load test orchestration
   worker_pool.ts        -- Distributes work across worker_threads
   worker_entry.ts       -- Worker thread entry point
   metrics.ts            -- Latency tracking, percentile computation
   metrics_formatter.ts  -- OpenTelemetry text format output
   server.ts             -- HTTP server mode for web UI integration

 Implementation Order

 Step 1: config.ts + tests

 - LoadTestConfig interface: { rps: number; durationSec: number; uri: string; threads: number }
 - parseConfig() — validates inputs, auto-determines threads: Math.max(1, Math.min(cpuCount, Math.ceil(rps /
 500)))
 - configFromQueryParams() — parses URL search params for server mode

 Step 2: metrics.ts + tests

 - Metrics class — stores raw latencies in number[], records success/error counts
 - record(latencyMs, success) and snapshot(): MetricsSnapshot
 - MetricsSnapshot type: totalRequests, successCount, errorCount, p50, p90, p99, p999, min, max, mean,
 rpsActual, elapsedMs
 - Static merge(snapshots[]) — combines results from multiple workers (concat latencies, re-sort, sum counts)
 - Percentiles computed via sorted array index lookup

 Step 3: rate_limiter.ts + tests

 - Drift-compensating scheduler anchored to absolute start time
 - nextTime = startTime + (requestIndex * interval) — eliminates cumulative drift vs setInterval
 - start(callback): Promise<void> resolves when duration complete
 - stop(): void for cancellation
 - For high RPS (interval < 1ms): batch multiple requests per tick

 Step 4: load_runner.ts + tests

 - Combines RateLimiter + fetch() + Metrics
 - Fire-and-forget model: requests launched at scheduled rate, NOT awaited before next send (critical for
 accurate rate generation)
 - Each request: performance.now() before/after fetch, record to Metrics
 - run(config): Promise<MetricsSnapshot>
 - Tests use a local node:http server as target

 Step 5: worker_pool.ts + worker_entry.ts + tests

 - If threads === 1: run LoadRunner directly (no worker overhead)
 - If threads > 1: spawn N worker_threads, each running worker_entry.ts
 - RPS distribution: baseRps = Math.floor(rps / threads), first worker gets remainder
 - Workers post MetricsSnapshot back via parentPort.postMessage()
 - Parent merges all snapshots via Metrics.merge()

 Step 6: metrics_formatter.ts

 - Converts MetricsSnapshot to OpenTelemetry text exposition format
 - Counters for total/success/error, gauges for latency percentiles

 Step 7: server.ts

 - Raw node:http server (no frameworks)
 - GET /run?rps=N&duration=N&uri=URL&threads=N — runs test, returns JSON MetricsSnapshot
 - GET /metrics — returns last run in OpenTelemetry format (204 if none)
 - GET /health — returns {"status":"ok"}
 - Concurrency guard: boolean isRunning, returns 409 if busy

 Step 8: cli.ts

 - Uses parseArgs from node:util (zero dependencies)
 - Options: --rps/-r, --duration/-d, --uri/-u, --threads/-t, --server/-s, --port/-p, --help/-h
 - --server flag starts server mode; otherwise runs one-shot test and prints results
 - Shebang line: #!/usr/bin/env node

 Step 9: index.ts + package.json update

 - Re-export public API (LoadTestConfig, WorkerPool, Metrics, etc.)
 - Add "bin": { "generator": "./dist/cli.js" } to package.json

 Key Design Decisions

 - Zero runtime dependencies — uses Node.js built-ins: fetch, node:util/parseArgs, node:http, worker_threads,
 node:os
 - Fire-and-forget requests — maintains target RPS regardless of response latency
 - Raw latency array — simple and exact percentiles; 600k entries at 10k RPS x 60s = ~5MB, acceptable for a
 demo
 - Drift-compensating scheduler — anchored to absolute start time, not relative intervals

 Verification

 ./run.sh build generator        # Compiles successfully
 ./run.sh lint generator         # No lint errors
 ./run.sh test generator         # All unit tests pass
 # Manual CLI test:
 node generator/dist/cli.js --rps 10 --duration 5 --uri http://localhost:8080/health
 # Manual server mode test:
 node generator/dist/cli.js --server --port 9090
 curl "http://localhost:9090/run?rps=10&duration=5&uri=http://localhost:8080/health"
 curl http://localhost:9090/metrics