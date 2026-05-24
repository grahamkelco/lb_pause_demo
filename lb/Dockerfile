# Stage 1: Build
FROM node:22-alpine AS build
WORKDIR /app
COPY tsconfig.base.json ./tsconfig.base.json
COPY lb/package.json ./lb/
WORKDIR /app/lb
RUN npm install && npm install --no-save typescript@~5.7.0
COPY lb/tsconfig.json ./
COPY lb/src/ ./src/
RUN npx tsc

# Stage 2: Runtime
FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/lb/dist ./dist
COPY --from=build /app/lb/node_modules ./node_modules
COPY lb/package.json ./
COPY lb/lb_config.yaml ./
EXPOSE 8080
CMD ["node", "dist/main.js"]
