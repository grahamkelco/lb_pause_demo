 Load Balancer — Initial Implementation Plan                                                                                        

 Context

 The lb/ package exists as a skeleton (package.json + tsconfig.json only). We need to implement the initial load balancer: a
 YAML-configured HTTP reverse proxy with round-robin routing. The config schema should support sidecar_port fields for future
 backpressure integration, but that logic is deferred.

 Config File Format — lb/lb_config.yaml

 listen:
   port: 8080

 servers:
   - host: localhost
     port: 3001
     sidecar_port: 9001  # optional, for future use
   - host: localhost
     port: 3002
     sidecar_port: 9002

 Config path resolution: CLI arg → LB_CONFIG_PATH env var → ./lb_config.yaml default.

 Files to Create

 1. Update lb/package.json

 - Add js-yaml (runtime dep) and @types/js-yaml (dev dep)
 - Add "start": "node dist/main.js" script

 2. lb/src/config.ts — Config types & loader

 - ServerConfig interface: host: string, port: number, sidecarPort?: number
 - ListenConfig interface: port: number
 - LbConfig interface: listen: ListenConfig, servers: readonly ServerConfig[]
 - loadConfig(filePath: string): LbConfig — reads YAML, validates structure, maps sidecar_port → sidecarPort. Throws descriptive
 errors on invalid config.

 3. lb/src/router.ts — Round-robin router

 - RoundRobinRouter class with servers array and rotating currentIndex
 - next(): ServerConfig — returns next server, increments index mod length
 - Constructor validates non-empty server list
 - Handle noUncheckedIndexedAccess with non-null assertion (index always in bounds)

 4. lb/src/proxy_server.ts — HTTP proxy server

 - ProxyServer class wrapping http.Server
 - Constructor takes RoundRobinRouter and listenPort
 - start(): Promise<void> — begins listening
 - stop(): Promise<void> — graceful shutdown
 - Private handleRequest(req, res) — calls router.next(), delegates to forwardRequest
 - Private forwardRequest(target, req, res) — builds http://host:port${req.url}, uses http.request() to proxy, pipes response back.
 Returns 502 on downstream errors.
 - Forwards all HTTP methods, preserves path + query string

 5. lb/src/main.ts — Entry point

 - Resolves config path: process.argv[2] → process.env['LB_CONFIG_PATH'] → ./lb_config.yaml
 - Loads config, creates router + server, starts listening
 - Registers SIGINT/SIGTERM handlers for graceful shutdown
 - Logs startup info (port, server count)

 6. lb/src/index.ts — Re-exports only

 - Export types and classes from config, router, proxy_server (no logic)

 7. lb/lb_config.yaml — Sample config file

 Tests — lb/src/__tests__/

 config.test.ts

 - Valid YAML parses correctly including sidecar_port → sidecarPort mapping
 - sidecarPort is optional (undefined when omitted)
 - Validation errors: missing listen, missing servers, empty servers, missing host/port, non-numeric port

 router.test.ts

 - Round-robin cycles correctly through servers (3 servers, 6 calls → [0,1,2,0,1,2])
 - Single server always returns same target

 proxy_server.test.ts

 - Proxies request to mock downstream server, verifies response
 - Path + query string preserved (/foo?bar=1)
 - Returns 502 when downstream is unreachable
 - start/stop lifecycle works

 Implementation Order

 1. Add deps to lb/package.json, run npm install
 2. Create lb/src/config.ts
 3. Create lb/src/router.ts
 4. Create lb/src/proxy_server.ts
 5. Create lb/src/main.ts
 6. Create lb/src/index.ts
 7. Create lb/lb_config.yaml
 8. Create tests in lb/src/__tests__/
 9. Build, lint, test: ./run.sh build lb && ./run.sh lint lb && ./run.sh test lb

 Key Technical Notes

 - ES module imports require .js extensions (Node16 resolution)
 - no-console is a warning — acceptable for startup/shutdown logs
 - noUncheckedIndexedAccess means array access returns T | undefined; use non-null assertion where index is guaranteed in-bounds
 - no-floating-promises — wrap server.listen() in Promise; handle shutdown promise in signal handlers

 Verification

 1. ./run.sh build lb — compiles without errors
 2. ./run.sh lint lb — passes (warnings OK for no-console)
 3. ./run.sh test lb — all tests pass
 4. Manual: start LB + a simple HTTP server, send request through LB, verify proxied response
