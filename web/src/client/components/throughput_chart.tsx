import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { ServiceTimeSeries } from "../types";

/** Props for the ThroughputChart component. */
interface ThroughputChartProps {
  data: ServiceTimeSeries | null;
}

interface ChartPoint {
  time: string;
  rps: number;
  success: number;
  errors: number;
}

/**
 * Line chart showing RPS, success count, and error count over time.
 */
export function ThroughputChart({ data }: ThroughputChartProps): React.JSX.Element {
  const points: ChartPoint[] = (data?.entries ?? []).map((entry) => ({
    time: new Date(entry.timestamp).toLocaleTimeString(),
    rps: entry.metrics["generator_rps_actual"] ?? 0,
    success: entry.metrics["generator_requests_success"] ?? 0,
    errors: entry.metrics["generator_requests_error"] ?? 0,
  }));

  return (
    <div className="card">
      <h3>Throughput</h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={points}>
          <XAxis dataKey="time" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="rps" stroke="#58a6ff" dot={false} name="RPS" />
          <Line type="monotone" dataKey="success" stroke="#3fb950" dot={false} name="Success" />
          <Line type="monotone" dataKey="errors" stroke="#f85149" dot={false} name="Errors" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
