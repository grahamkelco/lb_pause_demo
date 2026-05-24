import { Router } from "express";
import type { ServiceTarget } from "../config.js";

/**
 * Request body for starting a simulation run.
 */
interface RunRequestBody {
  serverType: string;
  serverCount: number;
  rps: number;
  duration: number;
}

/**
 * Maps a server type to its request path on the load balancer.
 */
const TYPE_PATH_MAP: Record<string, string> = {
  "sinkhole": "/query",
  "sinkhole-random": "/query",
  "simulated-pause": "/query",
};

/**
 * Creates an Express router for simulation control endpoints.
 *
 * @param generatorTarget - the generator service target to proxy requests to
 * @param lbTarget - the load balancer target for admin API calls
 * @returns an Express router handling /api/simulation routes
 */
export function createSimulationRoutes(
  generatorTarget: ServiceTarget,
  lbTarget: ServiceTarget,
): Router {
  const router = Router();

  /**
   * POST /api/simulation/run - Configures the LB and triggers a load test.
   */
  router.post("/run", (req, res) => {
    const body = req.body as RunRequestBody;

    if (!body.rps || !body.duration || !body.serverType || !body.serverCount) {
      res.status(400).json({ error: "serverType, serverCount, rps, and duration are required" });
      return;
    }

    void (async () => {
      try {
        // Step 1: Configure LB active servers
        const lbUrl = `http://${lbTarget.host}:${String(lbTarget.port)}/admin/servers`;
        const lbRes = await fetch(lbUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: body.serverType, activeCount: body.serverCount }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!lbRes.ok) {
          const lbData = (await lbRes.json()) as { error?: string };
          res.status(lbRes.status).json({ error: lbData.error ?? "Failed to configure LB" });
          return;
        }

        // Step 2: Map server type to URI path
        const path = TYPE_PATH_MAP[body.serverType] ?? "/query";
        const uri = `http://${lbTarget.host}:${String(lbTarget.port)}${path}`;

        // Step 3: Call generator
        const params = new URLSearchParams({
          rps: String(body.rps),
          duration: String(body.duration),
          uri,
          threads: "1",
        });
        const genUrl = `http://${generatorTarget.host}:${String(generatorTarget.port)}/run?${params.toString()}`;
        const response = await fetch(genUrl, { signal: AbortSignal.timeout(120_000) });
        const data: unknown = await response.json();
        res.status(response.status).json(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to reach generator";
        res.status(502).json({ error: message });
      }
    })();
  });

  return router;
}
