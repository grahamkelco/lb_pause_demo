import * as http from "node:http";
import { MetricsTracker } from "./metrics_tracker.js";
import { GcPauseSimulator } from "./gc_pause_simulator.js";
import { doCpuWork } from "./cpu_work.js";

/**
 * An HTTP server that performs real CPU work on each /query request
 * and simulates random GC-like pauses that block the event loop.
 * Exposes RPS metrics on /metrics in OpenTelemetry text format.
 */
export class SimulatedPauseServer {
  private readonly server: http.Server;
  private readonly metrics: MetricsTracker;
  private readonly gcSimulator: GcPauseSimulator;
  private readonly port: number;

  /**
   * Creates a new SimulatedPauseServer.
   * @param port - The port number to listen on.
   */
  constructor(port: number) {
    this.port = port;
    this.metrics = new MetricsTracker();
    this.gcSimulator = new GcPauseSimulator();
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });
  }

  /**
   * Routes incoming HTTP requests to the appropriate handler.
   * @param req - The incoming HTTP request.
   * @param res - The server response.
   */
  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    switch (req.url) {
      case "/query":
        this.handleQuery(res);
        break;
      case "/metrics":
        this.handleMetrics(res);
        break;
      default:
        res.setHeader("Content-Type", "text/plain");
        res.writeHead(404);
        res.end("Not Found\n");
    }
  }

  /**
   * Handles /query requests by performing CPU work and recording the request.
   * @param res - The server response.
   */
  private handleQuery(res: http.ServerResponse): void {
    doCpuWork(2000);
    this.metrics.recordRequest();
    res.setHeader("Content-Type", "text/plain");
    res.writeHead(200);
    res.end("OK\n");
  }

  /**
   * Handles /metrics requests by returning OpenTelemetry text exposition format.
   * @param res - The server response.
   */
  private handleMetrics(res: http.ServerResponse): void {
    const total = this.metrics.getTotalRequests();
    const rps = this.metrics.getRps();

    const body = [
      "# HELP simulated_pause_requests_total Total number of requests received on /query",
      "# TYPE simulated_pause_requests_total counter",
      `simulated_pause_requests_total ${total}`,
      "",
      "# HELP simulated_pause_requests_per_second Requests per second (10s rolling average)",
      "# TYPE simulated_pause_requests_per_second gauge",
      `simulated_pause_requests_per_second ${rps}`,
      "",
    ].join("\n");

    res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    res.writeHead(200);
    res.end(body);
  }

  /**
   * Starts the server, metrics tracker, and GC pause simulator.
   * @returns A promise that resolves when the server is listening.
   */
  start(): Promise<void> {
    return new Promise((resolve) => {
      this.metrics.start();
      this.gcSimulator.start();
      this.server.listen(this.port, () => {
        // eslint-disable-next-line no-console
        console.log(`Simulated-pause server listening on port ${this.port}`);
        resolve();
      });
    });
  }

  /**
   * Stops the server, metrics tracker, and GC pause simulator gracefully.
   * @returns A promise that resolves when the server has closed.
   */
  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.metrics.stop();
      this.gcSimulator.stop();
      this.server.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}
