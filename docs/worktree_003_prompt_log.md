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