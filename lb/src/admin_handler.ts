import type * as http from "node:http";
import type { RoundRobinRouter } from "./router.js";

/**
 * Request body for the POST /admin/servers endpoint.
 */
interface SetActiveBody {
  type: string;
  activeCount: number;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

/**
 * Handles administrative HTTP requests for the load balancer.
 * Supports querying and updating server group configurations.
 */
export class AdminHandler {
  private readonly router: RoundRobinRouter;

  /**
   * Creates a new AdminHandler.
   * @param router - The router to query and update.
   */
  constructor(router: RoundRobinRouter) {
    this.router = router;
  }

  /**
   * Attempts to handle an incoming request as an admin endpoint.
   * @param req - The incoming HTTP request.
   * @param res - The outgoing HTTP response.
   * @returns True if the request was handled, false otherwise.
   */
  handleRequest(req: http.IncomingMessage, res: http.ServerResponse): boolean {
    const url = req.url ?? "";
    if (!url.startsWith("/admin/")) {
      return false;
    }

    if (url === "/admin/servers" && req.method === "GET") {
      this.handleGetServers(res);
      return true;
    }

    if (url === "/admin/servers" && req.method === "POST") {
      this.handlePostServers(req, res);
      return true;
    }

    res.writeHead(404, JSON_HEADERS);
    res.end(JSON.stringify({ error: "Not found" }));
    return true;
  }

  /**
   * Returns the current server groups as JSON.
   * @param res - The HTTP response.
   */
  private handleGetServers(res: http.ServerResponse): void {
    const groups = this.router.getServerGroups();
    res.writeHead(200, JSON_HEADERS);
    res.end(JSON.stringify(groups));
  }

  /**
   * Parses the request body and updates active server count and type.
   * @param req - The HTTP request.
   * @param res - The HTTP response.
   */
  private handlePostServers(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): void {
    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        const parsed = JSON.parse(body) as SetActiveBody;
        if (typeof parsed.type !== "string" || typeof parsed.activeCount !== "number") {
          res.writeHead(400, JSON_HEADERS);
          res.end(JSON.stringify({ error: "type (string) and activeCount (number) are required" }));
          return;
        }
        this.router.setActiveServers(parsed.type, parsed.activeCount);
        this.router.setActiveType(parsed.type);
        res.writeHead(200, JSON_HEADERS);
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Bad request";
        res.writeHead(400, JSON_HEADERS);
        res.end(JSON.stringify({ error: message }));
      }
    });
  }
}
