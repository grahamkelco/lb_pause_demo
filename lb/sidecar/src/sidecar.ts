import type { HealthCheck } from "./health_check.js";
import type { SidecarConfig } from "./config.js";
import { HealthCheckRunner } from "./health_check_runner.js";
import { LbConnection } from "./lb_connection.js";
import { SidecarMetricsServer } from "./metrics_server.js";

const MIN_SEND_INTERVAL_MS = 50;

/**
 * Orchestrates the sidecar process: runs health checks, communicates
 * drain/resume state to the load balancer, and exposes a metrics endpoint.
 *
 * The sidecar sends commands both on state transitions and on a redundant
 * interval (drainInterval / 2) to guard against lost messages.
 */
export class Sidecar {
  private readonly config: SidecarConfig;
  private readonly runner: HealthCheckRunner;
  private readonly connection: LbConnection;
  private readonly metricsServer: SidecarMetricsServer;
  private sendTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Creates a new Sidecar.
   * @param config - The sidecar configuration.
   * @param checks - The health checks to run.
   */
  constructor(config: SidecarConfig, checks: readonly HealthCheck[]) {
    this.config = config;
    this.runner = new HealthCheckRunner(checks, config.checkIntervalMs);
    this.connection = new LbConnection(config.lbHost, config.lbPort);
    this.metricsServer = new SidecarMetricsServer(
      config.metricsPort,
      () => this.runner.healthy,
    );
  }

  /**
   * Starts the sidecar: connects to the LB, starts health checks,
   * and begins the redundant send loop.
   * @returns A promise that resolves once all components are started.
   */
  async start(): Promise<void> {
    await this.connection.connect();
    this.runner.start();
    await this.metricsServer.start();

    // Send immediately on state change
    this.runner.on("stateChange", () => {
      this.sendCurrentState();
    });

    // Redundant send loop to handle missed messages
    const sendInterval = Math.max(
      Math.floor(this.runner.drainInterval / 2),
      MIN_SEND_INTERVAL_MS,
    );
    this.sendTimer = setInterval(() => {
      this.sendCurrentState();
    }, sendInterval);
  }

  /**
   * Stops the sidecar and all its components.
   * @returns A promise that resolves once shutdown is complete.
   */
  async stop(): Promise<void> {
    if (this.sendTimer !== null) {
      clearInterval(this.sendTimer);
      this.sendTimer = null;
    }

    this.runner.stop();
    this.connection.disconnect();
    await this.metricsServer.stop();
  }

  /**
   * Sends the current health state to the load balancer.
   *
   * If unhealthy, sends DRAIN with the max drain interval.
   * If healthy, sends RESUME.
   */
  private sendCurrentState(): void {
    if (this.runner.healthy) {
      this.connection.sendResume();
    } else {
      this.connection.sendDrain(this.runner.drainInterval);
    }
  }
}
