import { useState, useEffect, useCallback } from "react";

const POLL_INTERVAL_MS = 5000;

/** State returned by the useBackpressure hook. */
export interface BackpressureState {
  /** Whether the LB is currently honoring sidecar drain signals. */
  enabled: boolean;
  /** Whether the state is still loading from the server. */
  loading: boolean;
  /** Toggles backpressure on or off. */
  toggle: () => void;
}

/**
 * Hook that polls and controls the LB's backpressure enabled state.
 *
 * @returns current backpressure state and a toggle function
 */
export function useBackpressure(): BackpressureState {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const fetchState = async (): Promise<void> => {
      try {
        const res = await fetch("/api/services/backpressure");
        if (res.ok) {
          const json = (await res.json()) as { enabled: boolean };
          if (active) {
            setEnabled(json.enabled);
            setLoading(false);
          }
        }
      } catch {
        // Silently ignore fetch errors
      }
    };

    void fetchState();
    const timer = setInterval(() => void fetchState(), POLL_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const toggle = useCallback(() => {
    const newValue = !enabled;
    setEnabled(newValue);

    void (async () => {
      try {
        await fetch("/api/services/backpressure", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: newValue }),
        });
      } catch {
        // Revert on failure
        setEnabled(!newValue);
      }
    })();
  }, [enabled]);

  return { enabled, loading, toggle };
}
