import { useState, useCallback } from "react";
import type { SimulationParams, SimulationResult } from "../types";

/** State returned by the useSimulation hook. */
export interface SimulationState {
  running: boolean;
  result: SimulationResult | null;
  error: string | null;
  run: (params: SimulationParams) => void;
}

/**
 * Hook for triggering simulation runs via the API.
 *
 * @returns simulation state including the run trigger function
 */
export function useSimulation(): SimulationState {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback((params: SimulationParams) => {
    setRunning(true);
    setError(null);

    void (async () => {
      try {
        const res = await fetch("/api/simulation/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });
        const data = (await res.json()) as SimulationResult & { error?: string };
        if (!res.ok) {
          setError(data.error ?? `HTTP ${String(res.status)}`);
        } else {
          setResult(data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Request failed");
      } finally {
        setRunning(false);
      }
    })();
  }, []);

  return { running, result, error, run };
}
