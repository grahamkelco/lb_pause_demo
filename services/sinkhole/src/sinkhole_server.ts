import * as http from "node:http";
import { MetricsTracker } from "./metrics_tracker.js";

/**
 * A minimal HTTP server that immediately returns 200 on /query
 * and exposes RPS metrics on /metrics in OpenTelemetry text format.
 */
export class SinkholeServer {
  private readonly server: http.Server;
  private readonly metrics: MetricsTracker;
  private readonly port: number;

  /**
   * Creates a new SinkholeServer.
   * @param port - The port number to listen on.
   */
  constructor(port: number) {
    this.port = port;
    this.metrics = new MetricsTracker();
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
   * Handles /query requests by recording the request and returning 200.
   * @param res - The server response.
   */
  private handleQuery(res: http.ServerResponse): void {
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
      "# HELP sinkhole_requests_total Total number of requests received on /query",
      "# TYPE sinkhole_requests_total counter",
      `sinkhole_requests_total ${total}`,
      "",
      "# HELP sinkhole_requests_per_second Requests per second (10s rolling average)",
      "# TYPE sinkhole_requests_per_second gauge",
      `sinkhole_requests_per_second ${rps}`,
      "",
    ].join("\n");

    res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    res.writeHead(200);
    res.end(body);
  }

  /**
   * Starts the server and metrics tracker.
   * @returns A promise that resolves when the server is listening.
   */
  start(): Promise<void> {
    return new Promise((resolve) => {
      this.metrics.start();
      this.server.listen(this.port, () => {
        // eslint-disable-next-line no-console
        console.log(`Sinkhole server listening on port ${this.port}`);
        resolve();
      });
    });
  }

  /**
   * Stops the server and metrics tracker gracefully.
   * @returns A promise that resolves when the server has closed.
   */
  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.metrics.stop();
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
