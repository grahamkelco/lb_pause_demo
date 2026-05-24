# Prompt 1 (Plan Mode)
We want to implement the initial version of the load balancer. This should be take a basic yaml config with the downstream           
servers/ports to route traffic to. We want to use round robin routing between servers. The config file format should be flexible       
enough to allow for specification of sidecar process ports for the same server but we will implement that logic later. The             
loadbalancer should strip of the path and querystirng arguments for the inbound HTTP get request and forward them to the selected      
downstream server. 

## Response
See .ai/plans/wt_002_prompt_001_plan.md for plan mode output.

All 16 tests pass across all 3 test files. Here's a summary of what was implemented:
                                                                                                                                       
  Implementation Complete                                                                                                              
                                                                                                                                       
  Files Created                                                                                                                        
                                                                                                                                       
  - lb/src/config.ts — Config types (ServerConfig, ListenConfig, LbConfig) and loadConfig() YAML loader with validation and            
  sidecar_port → sidecarPort mapping                                                                                                   
  - lb/src/router.ts — RoundRobinRouter class with rotating index                                                                      
  - lb/src/proxy_server.ts — ProxyServer class using Node.js http module to proxy requests, preserving path + query string, with 502   
  error handling                                                                                                                       
  - lb/src/main.ts — Entry point with config path resolution (CLI arg → env var → default), graceful shutdown                          
  - lb/src/index.ts — Re-exports only                                                                                                  
  - lb/lb_config.yaml — Sample config with 2 servers + sidecar ports                                                                
  - lb/src/__tests__/config.test.ts — 8 tests for config parsing and validation                                                        
  - lb/src/__tests__/router.test.ts — 4 tests for round-robin behavior                                                                 
  - lb/src/__tests__/proxy_server.test.ts — 4 tests for proxying, round-robin, 502 handling, lifecycle                                 
                                                                                                                                       
  Files Modified                                                                                                                       
                                                                                                                                       
  - lb/package.json — Added js-yaml, @types/js-yaml, @types/node deps and start script                                                 
                                                                                                                                    
  Verification                                                                                                                         
                                                                                                                                    
  - Build: clean                                                                                                                       
  - Lint: clean (1 warning for test file length)                                                                                    
  - Tests: 16/16 passing

# Prompt 2 (Plan Mode)
We now want to set up a basic Docker container setup to contain the load balancer. This should come up with run.sh up. We also want  
to ensure that run.sh up will bring up the docker daemon if it is not running yet. We will be adding other services to this docker     
config later but for now it will just be the load balancer.

## Response
See .ai/plans/wt_002_prompt_002_plan.md for plan mode output.

Everything looks good. Here's a summary of what was done:                                                                            
                                                                                                                                    
  Created:                                                                                                                             
  - lb/Dockerfile — Multi-stage build (build stage compiles TypeScript, runtime stage copies only dist/, node_modules/, package.json,  
  and lb_config.yaml). Build context is the project root so tsconfig.base.json is accessible.                                          
  - docker-compose.yml — Defines lb service with backpressure bridge network, port 8080:8080, container name backpressure-lb.          
  - .dockerignore — Excludes node_modules/, dist/, *.tsbuildinfo, .env, test files, .git/, .ai/, docs/ from the build context.         
                                                                                                                                       
  Modified:                                                                                                                            
  - run.sh — Removed the placeholder error check in cmdUp() and added --build flag to docker compose up -d.                            
                                                                                                                                       
  Deleted:                                                                                                                          
  - lb/.dockerignore — Moved to project root since the build context is . not ./lb.                                                    
                                                                                                                                       
  Verification steps:                                                                                                                  
  1. ./run.sh up — builds image and starts container                                                                                   
  2. docker ps — should show backpressure-lb                                                                                           
  3. ./run.sh down — stops cleanly