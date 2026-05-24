import { Router } from "express";
import type { ServiceTarget } from "../config.js";

/**
 * Request body for starting a simulation run.
 */
interface RunRequestBody {
  rps: number;
  duration: number;
  uri: string;
}

/**
 * Creates an Express router for simulation control endpoints.
 *
 * @param generatorTarget - the generator service target to proxy requests to
 * @returns an Express router handling /api/simulation routes
 */
export function createSimulationRoutes(generatorTarget: ServiceTarget): Router {
  const router = Router();

  /**
   * POST /api/simulation/run - Triggers a load test run on the generator.
   */
  router.post("/run", (req, res) => {
    const body = req.body as RunRequestBody;

    if (!body.rps || !body.duration || !body.uri) {
      res.status(400).json({ error: "rps, duration, and uri are required" });
      return;
    }

    const params = new URLSearchParams({
      rps: String(body.rps),
      duration: String(body.duration),
      uri: body.uri,
    });

    const url = `http://${generatorTarget.host}:${String(generatorTarget.port)}/run?${params.toString()}`;

    void (async () => {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
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
