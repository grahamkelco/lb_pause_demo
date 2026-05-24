import { useState, useEffect } from "react";
import type { ServiceTimeSeries } from "../types";

const POLL_INTERVAL_MS = 2000;

/**
 * Hook that polls the metrics API every 2 seconds.
 *
 * @returns the latest time-series data for all services
 */
export function useMetrics(): ServiceTimeSeries[] {
  const [data, setData] = useState<ServiceTimeSeries[]>([]);

  useEffect(() => {
    let active = true;

    const fetchMetrics = async (): Promise<void> => {
      try {
        const res = await fetch("/api/metrics");
        if (res.ok) {
          const json = (await res.json()) as ServiceTimeSeries[];
          if (active) {
            setData(json);
          }
        }
      } catch {
        // Silently ignore fetch errors
      }
    };

    void fetchMetrics();
    const timer = setInterval(() => void fetchMetrics(), POLL_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  return data;
}
