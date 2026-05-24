import { useState, useEffect } from "react";
import type { SimulationParams, ServerGroup } from "../types";

/** Props for the SimulationControls component. */
interface SimulationControlsProps {
  onRun: (params: SimulationParams) => void;
  running: boolean;
  error: string | null;
  serverGroups: ServerGroup[];
}

/**
 * Form for configuring and triggering a simulation run.
 * Server type and count are populated dynamically from the LB.
 */
export function SimulationControls({ onRun, running, error, serverGroups }: SimulationControlsProps): React.JSX.Element {
  const [rps, setRps] = useState(100);
  const [duration, setDuration] = useState(10);
  const [serverType, setServerType] = useState("");
  const [serverCount, setServerCount] = useState(1);

  const selectedGroup = serverGroups.find((g) => g.type === serverType);
  const maxCount = selectedGroup?.total ?? 1;

  // Auto-select first type when groups load
  useEffect(() => {
    if (serverGroups.length > 0 && !serverType) {
      setServerType(serverGroups[0]!.type);
      setServerCount(serverGroups[0]!.total);
    }
  }, [serverGroups, serverType]);

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    onRun({ serverType, serverCount, rps, duration });
  };

  return (
    <div className="card controls-section">
      <h3>Simulation</h3>
      <form className="controls-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="serverType">Server Type</label>
          <select
            id="serverType"
            value={serverType}
            onChange={(e) => {
              setServerType(e.target.value);
              const group = serverGroups.find((g) => g.type === e.target.value);
              setServerCount(group?.total ?? 1);
            }}
          >
            {serverGroups.map((g) => (
              <option key={g.type} value={g.type}>{g.type}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="serverCount">Servers</label>
          <select
            id="serverCount"
            value={serverCount}
            onChange={(e) => setServerCount(Number(e.target.value))}
          >
            {Array.from({ length: maxCount }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="rps">RPS</label>
          <input
            id="rps"
            type="number"
            min={1}
            max={100000}
            value={rps}
            onChange={(e) => setRps(Number(e.target.value))}
          />
        </div>
        <div className="form-group">
          <label htmlFor="duration">Duration (s)</label>
          <input
            id="duration"
            type="number"
            min={1}
            max={3600}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          />
        </div>
        <button type="submit" disabled={running || serverGroups.length === 0}>
          {running ? "Running..." : "Run"}
        </button>
      </form>
      {error && <div className="error-message">{error}</div>}
    </div>
  );
}
