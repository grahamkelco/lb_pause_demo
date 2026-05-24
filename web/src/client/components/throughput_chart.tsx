import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { ServiceTimeSeries } from "../types";

/** Props for the ThroughputChart component. */
interface ThroughputChartProps {
  data: ServiceTimeSeries | null;
}

interface ChartPoint {
  time: string;
  rps: number;
}

/**
 * Line chart showing generator RPS over time.
 */
export function ThroughputChart({ data }: ThroughputChartProps): React.JSX.Element {
  const points: ChartPoint[] = (data?.entries ?? []).map((entry) => ({
    time: new Date(entry.timestamp).toLocaleTimeString(),
    rps: entry.metrics["generator_rps_actual"] ?? 0,
  }));

  return (
    <div className="card">
      <h3>Throughput</h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={points}>
          <XAxis dataKey="time" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Line type="monotone" dataKey="rps" stroke="#58a6ff" dot={false} name="RPS" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
