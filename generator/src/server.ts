import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { configFromQueryParams } from "./config.js";
import { Metrics, type MetricsSnapshot } from "./metrics.js";
import { formatMetrics } from "./metrics_formatter.js";
import { WorkerPool } from "./worker_pool.js";

const CONTENT_TYPE = "Content-Type";

/**
 * HTTP server mode for the load generator.
 *
 * Exposes endpoints to trigger load test runs, retrieve metrics,
 * and check health. Only one run may execute at a time.
 */
export class GeneratorServer {
  private readonly pool = new WorkerPool();
  private isRunning = false;
  private lastResult: MetricsSnapshot | null = null;
  private liveMetrics: Metrics | null = null;

  /**
   * Starts the HTTP server on the given port.
   *
   * @param port - the port to listen on
   * @returns a promise that resolves with the server's address info once listening
   */
  async listen(port: number): Promise<AddressInfo> {
    const server = createServer((req, res) => {
      void this.handleRequest(req, res);
    });

    return new Promise((resolve) => {
      server.listen(port, () => {
        const addr = server.address() as AddressInfo;
        // eslint-disable-next-line no-console
        console.log(`Generator server listening on port ${String(addr.port)}`);
        resolve(addr);
      });
    });
  }

  /**
   * Routes incoming HTTP requests to the appropriate handler.
   *
   * @param req - the incoming HTTP request
   * @param res - the server response
   */
  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    switch (url.pathname) {
      case "/run":
        await this.handleRun(url.searchParams, res);
        break;
      case "/metrics":
        this.handleMetrics(res);
        break;
      case "/health":
        this.handleHealth(res);
        break;
      default:
        sendJson(res, 404, { error: "Not found" });
    }
  }

  /**
   * Handles a load test run request. Returns 409 if a run is already in progress.
   *
   * @param params - query string parameters containing run configuration
   * @param res - the server response
   */
  private async handleRun(params: URLSearchParams, res: ServerResponse): Promise<void> {
    if (this.isRunning) {
      sendJson(res, 409, { error: "A run is already in progress" });
      return;
    }

    let config;
    try {
      config = configFromQueryParams(params);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid parameters";
      sendJson(res, 400, { error: message });
      return;
    }

    this.isRunning = true;
    const liveMetrics = new Metrics();
    try {
      const result = await this.pool.run(config, liveMetrics, () => {
        this.liveMetrics = liveMetrics;
      });
      this.lastResult = result;
      sendJson(res, 200, result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Run failed";
      sendJson(res, 500, { error: message });
    } finally {
      this.isRunning = false;
      this.liveMetrics = null;
    }
  }

  /**
   * Returns the last completed run's metrics in OpenTelemetry text format.
   *
   * @param res - the server response
   */
  private handleMetrics(res: ServerResponse): void {
    const snapshot = this.liveMetrics?.snapshot() ?? this.lastResult;
    if (!snapshot) {
      res.writeHead(204);
      res.end();
      return;
    }

    res.writeHead(200, { [CONTENT_TYPE]: "text/plain; charset=utf-8" });
    res.end(formatMetrics(snapshot));
  }

  /**
   * Returns a simple health check response.
   *
   * @param res - the server response
   */
  private handleHealth(res: ServerResponse): void {
    sendJson(res, 200, { status: "ok" });
  }
}

/**
 * Sends a JSON response with the given status code and body.
 *
 * @param res - the server response
 * @param status - HTTP status code
 * @param body - object to serialize as JSON
 */
function sendJson(res: ServerResponse, status: number, body: object): void {
  res.writeHead(status, { [CONTENT_TYPE]: "application/json" });
  res.end(JSON.stringify(body));
}
