import { useState, useEffect } from "react";
import type { ServerGroup } from "../types";

const POLL_INTERVAL_MS = 5000;

/**
 * Hook that polls server groups from the LB admin API.
 *
 * @returns the list of available server groups with active counts
 */
export function useServerGroups(): ServerGroup[] {
  const [groups, setGroups] = useState<ServerGroup[]>([]);

  useEffect(() => {
    let active = true;

    const fetchGroups = async (): Promise<void> => {
      try {
        const res = await fetch("/api/services/servers");
        if (res.ok) {
          const json = (await res.json()) as ServerGroup[];
          if (active) {
            setGroups(json);
          }
        }
      } catch {
        // Silently ignore fetch errors
      }
    };

    void fetchGroups();
    const timer = setInterval(() => void fetchGroups(), POLL_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  return groups;
}
