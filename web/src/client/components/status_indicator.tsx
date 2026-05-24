import type { ServiceStatus } from "../types";

/** Props for the StatusIndicator component. */
interface StatusIndicatorProps {
  status: ServiceStatus;
}

/**
 * Displays a green or red health dot with the service name.
 */
export function StatusIndicator({ status }: StatusIndicatorProps): React.JSX.Element {
  const dotClass = status.healthy ? "status-dot healthy" : "status-dot unhealthy";

  return (
    <span className="status-indicator">
      <span className={dotClass} />
      {status.name}
    </span>
  );
}
