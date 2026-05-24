import { Router } from "express";
import type { MetricsScraper } from "../scraper/metrics_scraper.js";

/**
 * Creates an Express router for service status endpoints.
 *
 * @param scraper - the metrics scraper to query for service statuses
 * @returns an Express router handling /api/services routes
 */
export function createServicesRoutes(scraper: MetricsScraper): Router {
  const router = Router();

  /**
   * GET /api/services - Returns health status of all configured services.
   */
  router.get("/", (_req, res) => {
    res.json(scraper.getStatuses());
  });

  return router;
}
