import { Router } from "express";
import type { MetricsScraper } from "../scraper/metrics_scraper.js";
import type { ServiceTarget } from "../config.js";

/**
 * Creates an Express router for service status endpoints.
 *
 * @param scraper - the metrics scraper to query for service statuses
 * @param lbTarget - the load balancer target for proxying admin API calls
 * @returns an Express router handling /api/services and /api/servers routes
 */
export function createServicesRoutes(
  scraper: MetricsScraper,
  lbTarget: ServiceTarget,
): Router {
  const router = Router();

  /**
   * GET /api/services - Returns health status of all configured services.
   */
  router.get("/", (_req, res) => {
    res.json(scraper.getStatuses());
  });

  /**
   * GET /api/servers - Proxies to LB admin API for server group info.
   */
  router.get("/servers", (_req, res) => {
    const url = `http://${lbTarget.host}:${String(lbTarget.port)}/admin/servers`;

    void (async () => {
      try {
        const lbRes = await fetch(url, { signal: AbortSignal.timeout(5000) });
        const data: unknown = await lbRes.json();
        res.status(lbRes.status).json(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to reach LB";
        res.status(502).json({ error: message });
      }
    })();
  });

  return router;
}
