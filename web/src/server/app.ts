import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import type { MetricsStore } from "./scraper/metrics_store.js";
import type { MetricsScraper } from "./scraper/metrics_scraper.js";
import type { ServerConfig } from "./config.js";
import { createMetricsRoutes } from "./routes/metrics_routes.js";
import { createSimulationRoutes } from "./routes/simulation_routes.js";
import { createServicesRoutes } from "./routes/services_routes.js";

/**
 * Creates and configures the Express application.
 *
 * Mounts API routes, serves static client files in production,
 * and provides SPA fallback for non-API routes.
 *
 * @param config - the server configuration
 * @param store - the metrics store
 * @param scraper - the metrics scraper
 * @returns a configured Express application
 */
export function createApp(
  config: ServerConfig,
  store: MetricsStore,
  scraper: MetricsScraper,
): express.Express {
  const app = express();

  app.use(express.json());

  // API routes
  const generatorTarget = config.targets.find((t) => t.name === "generator");
  if (generatorTarget) {
    app.use("/api/simulation", createSimulationRoutes(generatorTarget));
  }
  app.use("/api/metrics", createMetricsRoutes(store));
  app.use("/api/services", createServicesRoutes(scraper));

  // Serve static client files in production
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const clientDir = join(currentDir, "..", "client");
  if (existsSync(clientDir)) {
    app.use(express.static(clientDir));
    // SPA fallback: serve index.html for non-API routes
    app.get("*", (_req, res) => {
      res.sendFile(join(clientDir, "index.html"));
    });
  }

  return app;
}
