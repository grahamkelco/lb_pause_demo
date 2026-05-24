import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { ServiceTimeSeries, TimestampedMetrics } from "../types";

/** Props for the ServerCard component. */
interface ServerCardProps {
  name: string;
  serverData: ServiceTimeSeries | null;
  sidecarData: ServiceTimeSeries | null;
}

interface ChartPoint {
  time: string;
  rps: number;
  healthy: number | undefined;
}

/**
 * Finds the requests-per-second metric value from a metrics record,
 * detecting the metric name dynamically.
 * @param metrics - The metrics record from a timestamped entry.
 * @returns The RPS value, or 0 if not found.
 */
function findRpsMetric(metrics: Record<string, number>): number {
  for (const key of Object.keys(metrics)) {
    if (key.endsWith("_requests_per_second")) {
      return metrics[key] ?? 0;
    }
  }
  return 0;
}

/**
 * Merges server RPS and sidecar health entries by timestamp into chart points.
 * @param serverEntries - Time-series entries from the sinkhole server.
 * @param sidecarEntries - Time-series entries from the sidecar.
 * @returns Merged chart points with both rps and health values.
 */
function mergeEntries(
  serverEntries: TimestampedMetrics[],
  sidecarEntries: TimestampedMetrics[],
): ChartPoint[] {
  // Build a map of sidecar health by rounded timestamp (nearest second)
  const healthByTime = new Map<number, number>();
  for (const entry of sidecarEntries) {
    const key = Math.round(entry.timestamp / 1000);
    healthByTime.set(key, entry.metrics["sidecar_server_healthy"] ?? 0);
  }

  return serverEntries.map((entry) => {
    const key = Math.round(entry.timestamp / 1000);
    return {
      time: new Date(entry.timestamp).toLocaleTimeString(),
      rps: findRpsMetric(entry.metrics),
      healthy: healthByTime.get(key),
    };
  });
}

/**
 * Compact card showing a single server's throughput and sidecar health.
 */
export function ServerCard({ name, serverData, sidecarData }: ServerCardProps): React.JSX.Element {
  const serverEntries = serverData?.entries ?? [];
  const sidecarEntries = sidecarData?.entries ?? [];

  const points = mergeEntries(serverEntries, sidecarEntries);

  // Current health status from latest sidecar entry
  const lastSidecar = sidecarEntries.at(-1);
  const healthy = lastSidecar
    ? (lastSidecar.metrics["sidecar_server_healthy"] ?? 0) === 1
    : false;
  const hasSidecarData = sidecarEntries.length > 0;

  return (
    <div className="card server-card">
      <div className="server-card-header">
        <h3>{name}</h3>
        <span className="server-card-health">
          {hasSidecarData && (
            <>
              <span className={`status-dot ${healthy ? "healthy" : "unhealthy"}`} />
              {healthy ? "healthy" : "unhealthy"}
            </>
          )}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={points}>
          <XAxis dataKey="time" tick={{ fontSize: 10 }} />
          <YAxis yAxisId="rps" tick={{ fontSize: 10 }} />
          <YAxis yAxisId="health" orientation="right" domain={[0, 1]} hide />
          <Tooltip />
          <Legend />
          <Line
            yAxisId="rps"
            type="monotone"
            dataKey="rps"
            stroke="#58a6ff"
            dot={false}
            name="RPS"
            strokeWidth={2}
          />
          <Line
            yAxisId="health"
            type="stepAfter"
            dataKey="healthy"
            stroke="#3fb950"
            dot={false}
            name="Health"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
