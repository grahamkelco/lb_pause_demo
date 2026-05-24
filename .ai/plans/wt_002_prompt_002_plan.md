 Docker Setup for Load Balancer                                                                                                        
                                                                                                                                       
 Context                                                                                                                               
                                                                                                                                       
 The load balancer code is implemented in lb/ but has no Docker container. run.sh already has ensureDocker() (auto-starts Docker on    
 macOS) and cmdUp()/cmdDown() that use docker-compose.yml, but that file doesn't exist yet. We need to create the Dockerfile,          
 docker-compose.yml, and .dockerignore so ./run.sh up works end-to-end. The compose file should be structured to easily add more
 services later.

 Files to Create

 1. lb/Dockerfile

 - Multi-stage build for smaller image:
   - Stage 1 (build): node:22-alpine, copy package files, npm install, copy source, run tsc
   - Stage 2 (runtime): node:22-alpine, copy only dist/, node_modules/ (production), and lb_config.yaml
 - Working directory: /app
 - Copy lb_config.yaml into the image
 - CMD ["node", "dist/main.js"]
 - Expose port 8080

 2. docker-compose.yml (project root)

 - Single lb service for now, structured for future services
 - Build context: ./lb
 - Port mapping: 8080:8080
 - Mount lb/lb_config.yaml as a volume for easy config changes without rebuild (or bake it in — see question below)
 - Container name: backpressure-lb
 - Network: create a backpressure bridge network (services will need to talk to each other later)

 3. .dockerignore (in lb/)

 - Ignore node_modules/, dist/, *.tsbuildinfo, .env, src/__tests__/

 4. Update run.sh — cmdUp()

 - Remove the "will be created in a later phase" error check (lines 82-85) since docker-compose.yml will now exist
 - Add docker compose build before up -d so code changes are picked up, OR use docker compose up -d --build

 Files to Modify

 ┌────────────────────┬──────────────────────────────────────────────────────────────┐
 │        File        │                            Change                            │
 ├────────────────────┼──────────────────────────────────────────────────────────────┤
 │ lb/Dockerfile      │ Create — multi-stage Node.js build                           │
 ├────────────────────┼──────────────────────────────────────────────────────────────┤
 │ docker-compose.yml │ Create — lb service with network                             │
 ├────────────────────┼──────────────────────────────────────────────────────────────┤
 │ lb/.dockerignore   │ Create — exclude dev files from build context                │
 ├────────────────────┼──────────────────────────────────────────────────────────────┤
 │ run.sh             │ Update cmdUp() to remove placeholder error, use --build flag │
 ├────────────────────┼──────────────────────────────────────────────────────────────┤
 │ .gitignore         │ No changes needed                                            │
 └────────────────────┴──────────────────────────────────────────────────────────────┘

 Key Decisions

 - Config in container: Bake the existing lb_config.yaml into the image as-is. The localhost:3001/3002 targets won't resolve to
 anything in Docker yet, but the LB container will start. Config will be updated when server containers are added later.
 - Network: A named backpressure bridge network so future services can communicate by container name.
 - Port 8080: Mapped directly from host to container.

 docker-compose.yml Structure

 networks:
   backpressure:
     driver: bridge

 services:
   lb:
     build:
       context: ./lb
     container_name: backpressure-lb
     ports:
       - "8080:8080"
     networks:
       - backpressure

 run.sh cmdUp() Change

 cmdUp() {
   ensureDocker
   docker compose -f "$SCRIPT_DIR/docker-compose.yml" up -d --build
 }

 Verification

 1. ./run.sh up — Docker starts (if needed), image builds, container runs
 2. docker ps — shows backpressure-lb running
 3. ./run.sh down — container stops cleanly
 4. docker compose logs lb — shows LB startup message