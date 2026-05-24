# Prompt 1 (Plan Mode)

## Response
See .ai/plans/wt_003_prompt_001_plan.md

Everything works. Here's a summary of what was implemented:                      
                                                                                                                                           
  Files created:                                                                                                                           
  - services/sinkhole/package.json — Package manifest with @types/node devDependency                                                       
  - services/sinkhole/tsconfig.json — Extends tsconfig.base.json                                                                           
  - services/sinkhole/src/metrics_tracker.ts — MetricsTracker class with 10s sliding window circular buffer                                
  - services/sinkhole/src/sinkhole_server.ts — SinkholeServer with /query (200), /metrics (OTel text), and 404 fallback                    
  - services/sinkhole/src/main.ts — Bootstrap with PORT env var and graceful shutdown                                                      
  - services/sinkhole/src/index.ts — Re-exports only                                                                                       
                                                                                                                                           
  Files modified:                                                                                                                          
  - run.sh — Added sinkhole target to resolvePackage(), usage text, and error messages                                                     
                                                                                                                                           
  Verification:                                                                                                                            
  - ./run.sh build sinkhole — compiles cleanly                                                                                             
  - ./run.sh lint sinkhole — passes with no errors or warnings                                                                             
  - /query returns HTTP 200 with "OK"                                                                                                      
  - /metrics returns OTel-formatted counter and gauge metrics                                                                              
  - Unknown routes return 404                                                                                                              
  - Graceful shutdown on SIGTERM/SIGINT works correctly  


# Prompt 2 (Plan Mode)
We now want to implement a new server in services/java_gc that will simulate a Java GC pause on G1GC. For this we want to implement the  
same /query endpoint but this time we want to run a loop that allocates memory to drive up GC pressure. We also want to add a loop that    
spins doing compute for some time. We DO NOT want to use sleep to add latency to our request handler thread as that will have a different  
impact on the OS Scheudler than we are trying to replicate (i.e. it won't be in the runqueue whereas a busy spin will still be taking      
cycles and if it gets preempted will still have more work to do in a future quantum). The server should handle each inbound request in a   
different thread and have a threadpool where we can configure the number of threads to accept. For now lets pick a sane default but at     
some point we might want to play with a large pool size. We will also need the same /metrics endpoint that reports rps of the server.

## Response
See .ai/plans/wt_003_prompt_002_plan.md for plan mode output.

