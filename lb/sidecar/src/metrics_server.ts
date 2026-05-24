import * as http from "node:http";

/**
 * A lightweight HTTP server that exposes a `/metrics` endpoint for the sidecar.
 *
 * Reports a single gauge metric indicating whether the monitored server
 * is healthy (1) or unhealthy (0) in OpenTelemetry text exposition format.
 */
export class SidecarMetricsServer {
  private readonly server: http.Server;
  private readonly port: number;

  /**
   * Creates a new SidecarMetricsServer.
   * @param port - The port to listen on.
   * @param getHealthy - Callback that returns the current health state.
   */
  constructor(port: number, getHealthy: () => boolean) {
    this.port = port;
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res, getHealthy);
    });
  }

  /**
   * Starts listening for HTTP requests.
   * @returns A promise that resolves once the server is listening.
   */
  start(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(this.port, () => {
        this.server.removeListener("error", reject);
        resolve();
      });
    });
  }

  /**
   * Stops the HTTP server.
   * @returns A promise that resolves once the server has closed.
   */
  stop(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.server.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Handles an incoming HTTP request, serving metrics on GET /metrics.
   * @param req - The incoming request.
   * @param res - The outgoing response.
   * @param getHealthy - Callback for the current health state.
   */
  private handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    getHealthy: () => boolean,
  ): void {
    if (req.method === "GET" && req.url === "/metrics") {
      const value = getHealthy() ? 1 : 0;
      const body =
        "# HELP sidecar_server_healthy Whether the monitored server is healthy\n"
        + "# TYPE sidecar_server_healthy gauge\n"
        + `sidecar_server_healthy ${value}\n`;

      // eslint-disable-next-line @typescript-eslint/naming-convention
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(body);
    } else {
      res.writeHead(404);
      res.end();
    }
  }
}
