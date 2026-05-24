# Multi-stage Dockerfile for building the backpressure simulation services.
# Uses a shared base stage for dependencies, then separate stages for each service.

# --- Base stage: install all workspace dependencies ---
FROM node:22-slim AS base
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY generator/package.json generator/
COPY web/package.json web/
COPY lb/package.json lb/
COPY lb/sidecar/package.json lb/sidecar/
COPY services/sinkhole/package.json services/sinkhole/
COPY services/simulated_pause/package.json services/simulated_pause/
RUN npm ci --ignore-scripts

# --- Generator build ---
FROM base AS generator-build
COPY generator/ generator/
RUN npm run build -w @backpressure/generator

# --- Web build ---
FROM base AS web-build
COPY web/ web/
RUN npm run build -w @backpressure/web

# --- Sinkhole build ---
FROM base AS sinkhole-build
COPY services/sinkhole/ services/sinkhole/
RUN npm run build -w @backpressure/sinkhole

# --- Simulated-pause build ---
FROM base AS simulated-pause-build
COPY services/simulated_pause/ services/simulated_pause/
RUN npm run build -w @backpressure/simulated-pause

# --- Sidecar build ---
FROM base AS sidecar-build
COPY lb/sidecar/ lb/sidecar/
RUN npm run build -w @backpressure/sidecar

# --- Generator runtime ---
FROM node:22-slim AS generator
WORKDIR /app
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./
COPY --from=generator-build /app/generator ./generator
EXPOSE 8080
CMD ["node", "generator/dist/cli.js", "--server", "--port", "8080"]

# --- Web runtime ---
FROM node:22-slim AS web
WORKDIR /app
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./
COPY --from=web-build /app/web ./web
EXPOSE 3001
ENV GENERATOR_HOST=generator
ENV GENERATOR_PORT=8080
ENV WEB_PORT=3001
CMD ["node", "web/dist/server/main.js"]

# --- Sinkhole runtime ---
FROM node:22-slim AS sinkhole
WORKDIR /app
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./
COPY --from=sinkhole-build /app/services/sinkhole ./services/sinkhole
EXPOSE 8080
ENV PORT=8080
CMD ["node", "services/sinkhole/dist/main.js"]

# --- Simulated-pause runtime ---
FROM node:22-slim AS simulated-pause
WORKDIR /app
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./
COPY --from=simulated-pause-build /app/services/simulated_pause ./services/simulated_pause
EXPOSE 8080
ENV PORT=8080
CMD ["node", "services/simulated_pause/dist/main.js"]

# --- Sidecar runtime ---
FROM node:22-slim AS sidecar
WORKDIR /app
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./
COPY --from=sidecar-build /app/lb/sidecar ./lb/sidecar
CMD ["node", "lb/sidecar/dist/main.js"]
