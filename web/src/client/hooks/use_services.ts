import { useState, useEffect } from "react";
import type { ServiceStatus } from "../types";

const POLL_INTERVAL_MS = 5000;

/**
 * Hook that polls the services API for health statuses.
 *
 * @returns the latest service status list
 */
export function useServices(): ServiceStatus[] {
  const [statuses, setStatuses] = useState<ServiceStatus[]>([]);

  useEffect(() => {
    let active = true;

    const fetchServices = async (): Promise<void> => {
      try {
        const res = await fetch("/api/services");
        if (res.ok) {
          const json = (await res.json()) as ServiceStatus[];
          if (active) {
            setStatuses(json);
          }
        }
      } catch {
        // Silently ignore fetch errors
      }
    };

    void fetchServices();
    const timer = setInterval(() => void fetchServices(), POLL_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  return statuses;
}
