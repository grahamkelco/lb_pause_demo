import { Router } from "express";
import type { MetricsStore } from "../scraper/metrics_store.js";

/**
 * Creates an Express router for metrics API endpoints.
 *
 * @param store - the metrics store to query
 * @returns an Express router handling /api/metrics routes
 */
export function createMetricsRoutes(store: MetricsStore): Router {
  const router = Router();

  /**
   * GET /api/metrics - Returns time-series data for all services.
   */
  router.get("/", (_req, res) => {
    res.json(store.getAll());
  });

  /**
   * GET /api/metrics/:service - Returns time-series data for a single service.
   */
  router.get("/:service", (req, res) => {
    const data = store.getService(req.params["service"]!);
    if (!data) {
      res.status(404).json({ error: "Service not found" });
      return;
    }
    res.json(data);
  });

  return router;
}
