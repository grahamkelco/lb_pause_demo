Code Review: Load Generator (gkelco_load_generator vs main)                                                   
                                                                                                                
  Overview                                                                                                      
                                                                                                                
  This branch adds the full @backpressure/generator package — a TypeScript load generator that sends HTTP GET   
  traffic at a controlled rate. It includes CLI mode, HTTP server mode, worker thread distribution,             
  drift-compensating rate scheduling, and metrics collection with OpenTelemetry formatting. 30 tests, all       
  passing. Build and lint clean.                                                                                
                                                                                                                
  ---
  Strengths
                                                                                                                
  - Clean architecture — well-separated concerns across small, focused files (config, metrics, rate limiter,
  runner, pool, server, CLI)                                                                                    
  - Zero runtime dependencies — uses only Node.js built-ins, keeping the package lightweight                  
  - Good rate control design — absolute-time anchored scheduling in RateLimiter avoids cumulative drift         
  - Fire-and-forget model — correctly decouples request dispatch rate from response latency                     
  - Thorough test coverage — 30 tests across 6 suites covering config validation, metrics math, rate timing,    
  load running, server endpoints, and formatting                                                                
  - Consistent style — follows project conventions (snake_case files, PascalCase classes, javadoc comments,     
  @param/@returns)                                                                                              
                                                                                                              
  ---                                                                                                           
  Issues & Suggestions                                                                                        
                                                                                                                
  Bug: RateLimiter produces fractional totalRequests
                                                                                                                
  File: rate_limiter.ts:27                                                                                      
                                                                                                                
  this.totalRequests = rps * durationSec;                                                                       
                                                                                                              
  If rps is not an integer (e.g. a worker gets baseRps + remainder that happens to be fractional from division),
   or if a non-integer RPS is passed, the loop count could be fractional. Currently parseConfig doesn't enforce
  integer RPS, and worker_pool.ts:57 uses Math.floor which could result in baseRps = 0 for low RPS with many    
  threads. Consider Math.round(rps * durationSec) or enforcing integer RPS at the config level.               

  Severity: Low — unlikely in practice but worth hardening.                                                     
  
  Missing: GeneratorServer has no close() method                                                                
                                                                                                              
  File: server.ts:27-40                                                                                         
                                                                                                              
  The listen() method creates an http.Server but doesn't store a reference to it. There's no way to gracefully  
  shut down the server. This causes:
  1. The server test (server.test.ts) doesn't close the generator server in afterAll, only the target server    
  2. In server mode via CLI, there's no graceful shutdown on SIGINT/SIGTERM                                     
                                                                           
  Suggestion: Store the server instance and expose a close(): Promise<void> method.                             
                                                                                                                
  Memory: Unbounded inFlight array in LoadRunner                                                                
                                                                                                                
  File: load_runner.ts:45                                                                                       
                                                                                                              
  const inFlight: Promise<void>[] = [];
                                                                                                                
  Every request promise is pushed but never removed. At 10k RPS for 60s, that's 600k resolved promises kept in  
  memory. The promises themselves are lightweight after settling, but for very long/high-throughput runs this   
  could accumulate.                                                                                             
                                                                                                              
  Severity: Low for a demo — the comment in the plan acknowledged this trade-off.                               
  
  Metrics merge approximation could mislead                                                                     
                                                                                                              
  File: metrics.ts:126-127                                                                                      
                                                                                                              
  The approxPercentile function takes the max of each percentile across workers. This means merged p50 equals   
  the worst worker's p50, which overstates the true p50 significantly when workers have different latency
  profiles. The comment acknowledges this, but a better approach would be to pass raw latencies from workers    
  (via structured clone) and merge them properly. Worker data is already serialized via postMessage, so passing
  a Float64Array of latencies would be straightforward.

  Severity: Medium — could produce confusing metrics for multi-threaded runs.                                   
  
  Response body not consumed in LoadRunner.sendRequest                                                          
                                                                                                              
  File: load_runner.ts:70                                                                                       
                                                                                                              
  const response = await fetch(uri);                                                                            
                                                                                                              
  The response body is never consumed (response.text() or response.body?.cancel()). In Node.js, unconsumed fetch
   response bodies can cause memory leaks and resource exhaustion as connections are held open. At high RPS this
   could degrade the generator's own performance.                                                               
                                                                                                              
  Suggestion: Add await response.text() or await response.body?.cancel() after checking response.ok.            
  
  Server mode doesn't validate HTTP method                                                                      
                                                                                                              
  File: server.ts:51                                                                                            
                                                                                                              
  All routes accept any HTTP method (POST, DELETE, etc.). The /run endpoint in particular should probably only  
  respond to GET per the project spec.
                                                                                                                
  Severity: Low — functional but not REST-correct.                                                              
  
  No vitest.config.ts                                                                                           
                                                                                                              
  Tests work because vitest auto-discovers .test.ts files, but there's no explicit config for the generator     
  package. If test files are added to dist/ after build, vitest might pick them up. The tsconfig.json includes
  src/**/*.ts which will compile test files too.                                                                
                                                                                                              
  Suggestion: Either add a vitest config with include: ['src/**/*.test.ts'] or add exclude patterns to          
  tsconfig.json for test files so they don't end up in dist/.
                                                                                                                
  ---                                                                                                         
  Minor Nits
                                                                                                                
  - cli.ts has 5 eslint-disable-next-line no-console comments — consider adding a file-level disable for
  no-console since it's a CLI tool that naturally logs to stdout                                                
  - worker_pool.ts:82 — the snapshot parameter in worker.on("message", ...) is typed via assertion but        
  postMessage data is actually unknown; this is fine for internal code but worth noting                         
                                                                                                              
  ---                                                                                                           
  Summary                                                                                                     
         
  Solid implementation that follows project conventions well. The most actionable items are:
                                                                                                                
  1. Consume or cancel fetch response bodies — prevents resource leaks under load                               
  2. Add close() to GeneratorServer — needed for clean test teardown and graceful shutdown                      
  3. Consider passing raw latencies in worker merge — current max-based percentile approximation overstates p50 
  in multi-thread mode                                                                                          
  4. Exclude test files from tsc compilation — prevents test artifacts in dist/  