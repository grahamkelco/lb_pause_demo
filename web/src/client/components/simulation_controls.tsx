import { useState } from "react";
import type { SimulationParams } from "../types";

/** Props for the SimulationControls component. */
interface SimulationControlsProps {
  onRun: (params: SimulationParams) => void;
  running: boolean;
  error: string | null;
}

/**
 * Form for configuring and triggering a simulation run.
 */
export function SimulationControls({ onRun, running, error }: SimulationControlsProps): React.JSX.Element {
  const [rps, setRps] = useState(100);
  const [duration, setDuration] = useState(10);
  const [uri, setUri] = useState("http://localhost:3000");

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    onRun({ rps, duration, uri });
  };

  return (
    <div className="card controls-section">
      <h3>Simulation</h3>
      <form className="controls-form" onSubmit={handleSubmit}>
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
        <div className="form-group">
          <label htmlFor="uri">Target URI</label>
          <input
            id="uri"
            type="text"
            value={uri}
            onChange={(e) => setUri(e.target.value)}
            style={{ width: 260 }}
          />
        </div>
        <button type="submit" disabled={running}>
          {running ? "Running..." : "Run"}
        </button>
      </form>
      {error && <div className="error-message">{error}</div>}
    </div>
  );
}
