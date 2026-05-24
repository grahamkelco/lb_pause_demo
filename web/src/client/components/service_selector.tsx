import type { ServiceTimeSeries } from "../types";

/** Props for the ServiceSelector component. */
interface ServiceSelectorProps {
  services: ServiceTimeSeries[];
  selected: string | null;
  onSelect: (name: string | null) => void;
}

/**
 * Tabs for filtering charts by service.
 */
export function ServiceSelector({ services, selected, onSelect }: ServiceSelectorProps): React.JSX.Element {
  return (
    <div className="services-bar">
      <button
        className={`service-tab ${selected === null ? "active" : ""}`}
        onClick={() => onSelect(null)}
      >
        All
      </button>
      {services.map((s) => (
        <button
          key={s.name}
          className={`service-tab ${selected === s.name ? "active" : ""}`}
          onClick={() => onSelect(s.name)}
        >
          {s.name}
        </button>
      ))}
    </div>
  );
}
