# Prompt 1
Read .ai/plans/PROJECT.md for background on the project we are building.

## Response
⏺ Here's a summary of the project:                                                                              
                                                                                                                
  Load Balancer Backpressure Simulation — A prototype demonstrating how server pauses (GC, GIL, etc.) cause     
  cascading latency issues, and a backpressure mechanism to mitigate them.                                      
                                                                                                                
  Components:                                                                                                   
                                                                                                                
  1. Load Balancer (lb/) — Round-robin routing in TypeScript, with drain/resume support                         
  2. Sidecar (lb/sidecar/) — Monitors server pauses at sub-ms frequency, sends DRAIN/RESUME commands to the LB  
  3. Servers (services/) — Simple demo servers that simulate pauses                                             
  4. Load Generator (generator/) — Sends fixed-rate requests; supports CLI and HTTP server mode                 
  5. Web Server + React UI (web/) — Scrapes /metrics (OpenTelemetry format), displays real-time charts, and     
  provides simulation controls                                                                                  
                                                                                                                
  Key Guidelines:                                                                                               
                                                                                                              
  - TypeScript with strict compiler flags + ESLint                                                              
  - Javadoc-style comments, camelCase naming, snake_case filenames                                              
  - Small methods (≤70 lines, ≤3 nesting levels)                                                                
  - DevEx scripts: setup.sh and run.sh (with up, down, build, lint, test, help)                                 
  - Docker-based deployment                                                                                     
  - Keep it readable — avoid boilerplate, focus on the core backpressure logic                                  
                                                                                                                
  What would you like to work on first? 


  # Prompt 2
  We first need to establish the basics of the new project layout. We should set up a CLAUDE.md file to help    
you navigate the project. It should contain a directory map of the project as well as our coding standards. We  
also want to implement a basic README.md file for others to understand the project purpose and structure. We    
also want to include sections on setup (run setup.sh) and commands for interacting with the project (the run.sh 
 commands). We also want to setup the basic typescript coding standards and linter from the project             
description. Lastly, we should get the basics of setup.sh and run.sh in place. When writing the shell scripts   
be sure to apply the same coding standards. These should be functionized and each function contain a            
function-level comment. 

## Response
See .ai/plans/wr_001_prompt_002_plan.md for plan mode.

Everything works as expected:                                                                               
  - setup.sh installs dependencies successfully                                                                 
  - run.sh help prints usage                                                                                    
  - run.sh build lb correctly dispatches to the workspace (fails only because no .ts files yet)                 
  - run.sh build invalid_target shows proper error message                                                      
  - ESLint config loads and resolves rules                                                                      
  - TypeScript config parses (just no input files yet)                                                          
                                                                                                                
  Here's a summary of what was created:                                                                         
                                                                                                                
  18 files total:                                                                                               
  - .gitignore — ignores node_modules, dist, tsbuildinfo, .env                                                
  - package.json — root workspace config with shared devDependencies                                            
  - tsconfig.base.json — strict TypeScript config shared by all packages                                      
  - eslint.config.mjs — flat ESLint config enforcing naming conventions, method size (70 lines), nesting depth  
  (3), snake_case filenames, no any, no floating promises                                                     
  - lb/package.json, lb/tsconfig.json — load balancer package                                                   
  - lb/sidecar/package.json, lb/sidecar/tsconfig.json — sidecar package                                       
  - generator/package.json, generator/tsconfig.json — load generator package                                    
  - web/package.json, web/tsconfig.json — web UI package                                                        
  - setup.sh — installs dependencies (functionized with comments)                                               
  - run.sh — subcommand runner: up/down/build/lint/test/help (functionized with comments)                       
  - CLAUDE.md — project guide with directory map, coding standards, commands                                    
  - README.md — project overview with architecture, setup, and usage    