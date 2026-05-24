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
RUN mkdir -p services && npm ci --ignore-scripts

# --- Generator build ---
FROM base AS generator-build
COPY generator/ generator/
RUN npm run build -w @backpressure/generator

# --- Web build ---
FROM base AS web-build
COPY web/ web/
RUN npm run build -w @backpressure/web

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
