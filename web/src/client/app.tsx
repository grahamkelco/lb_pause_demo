import { useMetrics } from "./hooks/use_metrics";
import { useSimulation } from "./hooks/use_simulation";
import { useServices } from "./hooks/use_services";
import { useServerGroups } from "./hooks/use_server_groups";
import { useBackpressure } from "./hooks/use_backpressure";
import { SimulationControls } from "./components/simulation_controls";
import { LatencyChart } from "./components/latency_chart";
import { ThroughputChart } from "./components/throughput_chart";
import { StatusIndicator } from "./components/status_indicator";
import { ServerCard } from "./components/server_card";
import type { ServerGroup } from "./types";

/**
 * Derives the sidecar name for a given server name.
 * For sinkhole types, replaces "sinkhole" with "sidecar" (e.g. "sinkhole-random-2" → "sidecar-random-2").
 * For other types, prefixes with "sidecar-" (e.g. "simulated-pause-3" → "sidecar-simulated-pause-3").
 * @param serverName - The server container name, e.g. "sinkhole-random-2"
 * @param groupType - The server group type, e.g. "sinkhole-random"
 * @returns The matching sidecar name.
 */
function sidecarNameFor(serverName: string, groupType: string): string {
  if (groupType.startsWith("sinkhole")) {
    return serverName.replace(/^sinkhole/, "sidecar");
  }
  return `sidecar-${serverName}`;
}

/**
 * Root application layout with dashboard sections for generator and servers.
 */
export function App(): React.JSX.Element {
  const metrics = useMetrics();
  const simulation = useSimulation();
  const services = useServices();
  const serverGroups = useServerGroups();
  const backpressure = useBackpressure();

  const generatorData = metrics.find((m) => m.name === "generator") ?? null;

  // Find the currently active group (the one selected for routing)
  const activeGroup = serverGroups.find((g) => g.active > 0 && g.active <= g.total);

  return (
    <div className="app">
      <header className="header">
        <h1>Backpressure Simulation</h1>
        <div className="header-statuses">
          {services.map((s) => (
            <StatusIndicator key={s.name} status={s} />
          ))}
        </div>
      </header>

      <SimulationControls
        onRun={simulation.run}
        running={simulation.running}
        error={simulation.error}
        serverGroups={serverGroups}
        backpressureEnabled={backpressure.enabled}
        onToggleBackpressure={backpressure.toggle}
      />

      <section className="dashboard-section">
        <h2>Generator</h2>
        <div className="charts-section">
          <LatencyChart data={generatorData} />
          <ThroughputChart data={generatorData} />
        </div>
      </section>

      {serverGroups.map((group: ServerGroup) => (
        <ServerGroupSection
          key={group.type}
          group={group}
          isActive={group.type === activeGroup?.type}
          metrics={metrics}
        />
      ))}
    </div>
  );
}

/** Props for ServerGroupSection. */
interface ServerGroupSectionProps {
  group: ServerGroup;
  isActive: boolean;
  metrics: Array<{ name: string; entries: Array<{ timestamp: number; metrics: Record<string, number> }> }>;
}

/**
 * Renders a section for a single server type group.
 */
function ServerGroupSection({ group, isActive, metrics }: ServerGroupSectionProps): React.JSX.Element {
  const count = isActive ? group.active : group.total;
  const servers = Array.from({ length: count }, (_, i) => i + 1);

  return (
    <section className="dashboard-section">
      <h2>{group.type} ({count} of {group.total})</h2>
      <div className="server-grid">
        {servers.map((n) => {
          const serverName = `${group.type}-${String(n)}`;
          const sidecarName = sidecarNameFor(serverName, group.type);
          return (
            <ServerCard
              key={serverName}
              name={serverName}
              serverData={metrics.find((m) => m.name === serverName) ?? null}
              sidecarData={metrics.find((m) => m.name === sidecarName) ?? null}
            />
          );
        })}
      </div>
    </section>
  );
}
