import { useState } from "react";
import { useMetrics } from "./hooks/use_metrics";
import { useSimulation } from "./hooks/use_simulation";
import { useServices } from "./hooks/use_services";
import { SimulationControls } from "./components/simulation_controls";
import { LatencyChart } from "./components/latency_chart";
import { ThroughputChart } from "./components/throughput_chart";
import { ServiceSelector } from "./components/service_selector";
import { StatusIndicator } from "./components/status_indicator";

/**
 * Root application layout.
 */
export function App(): React.JSX.Element {
  const metrics = useMetrics();
  const simulation = useSimulation();
  const services = useServices();
  const [selectedService, setSelectedService] = useState<string | null>(null);

  const activeData = selectedService
    ? (metrics.find((m) => m.name === selectedService) ?? null)
    : (metrics[0] ?? null);

  return (
    <div className="app">
      <header className="header">
        <h1>Backpressure Simulation</h1>
        <div style={{ display: "flex", gap: 16 }}>
          {services.map((s) => (
            <StatusIndicator key={s.name} status={s} />
          ))}
        </div>
      </header>

      <SimulationControls
        onRun={simulation.run}
        running={simulation.running}
        error={simulation.error}
      />

      <ServiceSelector
        services={metrics}
        selected={selectedService}
        onSelect={setSelectedService}
      />

      <div className="charts-section">
        <LatencyChart data={activeData} />
        <ThroughputChart data={activeData} />
      </div>
    </div>
  );
}
