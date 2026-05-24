import * as http from "node:http";
import type { ServerConfig } from "./config.js";
import type { RoundRobinRouter } from "./router.js";

const REQUEST_TIMEOUT_MS = 30_000;

/**
 * HTTP reverse proxy server that forwards incoming requests to downstream
 * servers selected by a round-robin router.
 */
export class ProxyServer {
  private readonly server: http.Server;
  private readonly router: RoundRobinRouter;
  private readonly listenPort: number;

  /**
   * Creates a new ProxyServer.
   * @param router - The router used to select downstream targets.
   * @param listenPort - The port to listen on for incoming requests.
   */
  constructor(router: RoundRobinRouter, listenPort: number) {
    this.router = router;
    this.listenPort = listenPort;
    this.server = http.createServer(
      (req: http.IncomingMessage, res: http.ServerResponse) => {
        this.handleRequest(req, res);
      },
    );
  }

  /**
   * Starts listening for incoming HTTP requests.
   * @returns A promise that resolves once the server is listening.
   */
  start(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(this.listenPort, () => {
        this.server.removeListener("error", reject);
        resolve();
      });
    });
  }

  /**
   * Gracefully shuts down the server, closing all connections.
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
   * Handles an incoming request by selecting a target and forwarding to it.
   * @param req - The incoming HTTP request.
   * @param res - The outgoing HTTP response.
   */
  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const target = this.router.next();
    this.forwardRequest(target, req, res);
  }

  /**
   * Forwards a request to a downstream server and pipes the response back.
   * @param target - The downstream server to forward to.
   * @param req - The incoming HTTP request.
   * @param res - The outgoing HTTP response.
   */
  private forwardRequest(
    target: ServerConfig,
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): void {
    const options: http.RequestOptions = {
      hostname: target.host,
      port: target.port,
      path: req.url,
      method: req.method,
      headers: req.headers,
      timeout: REQUEST_TIMEOUT_MS,
    };

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on("error", () => {
      if (!res.headersSent) {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        res.writeHead(502, { "Content-Type": "text/plain" });
        res.end("Bad Gateway");
      }
    });

    proxyReq.on("timeout", () => {
      proxyReq.destroy();
    });

    req.pipe(proxyReq);
  }
}
