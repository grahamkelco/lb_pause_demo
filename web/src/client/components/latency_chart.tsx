import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { ServiceTimeSeries } from "../types";

/** Props for the LatencyChart component. */
interface LatencyChartProps {
  data: ServiceTimeSeries | null;
}

interface ChartPoint {
  time: string;
  p50: number;
  p90: number;
  p99: number;
  p999: number;
}

/**
 * Line chart showing p50/p90/p99/p999 latency percentiles over time.
 */
export function LatencyChart({ data }: LatencyChartProps): React.JSX.Element {
  const points: ChartPoint[] = (data?.entries ?? []).map((entry) => ({
    time: new Date(entry.timestamp).toLocaleTimeString(),
    p50: entry.metrics["generator_latency_p50_ms"] ?? 0,
    p90: entry.metrics["generator_latency_p90_ms"] ?? 0,
    p99: entry.metrics["generator_latency_p99_ms"] ?? 0,
    p999: entry.metrics["generator_latency_p999_ms"] ?? 0,
  }));

  return (
    <div className="card">
      <h3>Latency (ms)</h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={points}>
          <XAxis dataKey="time" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="p50" stroke="#58a6ff" dot={false} name="p50" />
          <Line type="monotone" dataKey="p90" stroke="#3fb950" dot={false} name="p90" />
          <Line type="monotone" dataKey="p99" stroke="#d29922" dot={false} name="p99" />
          <Line type="monotone" dataKey="p999" stroke="#f85149" dot={false} name="p99.9" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
