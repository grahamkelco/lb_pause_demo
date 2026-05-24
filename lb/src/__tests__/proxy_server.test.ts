import { describe, it, expect, afterEach } from "vitest";
import * as http from "node:http";
import { RoundRobinRouter } from "../router.js";
import { ProxyServer } from "../proxy_server.js";

/**
 * Creates a simple HTTP server that echoes the request URL back.
 * @param port - Port to listen on.
 * @returns The server instance and a promise that resolves when listening.
 */
function createEchoServer(port: number): { server: http.Server; listening: Promise<void> } {
  const server = http.createServer((req, res) => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    res.writeHead(200, { "content-type": "text/plain" });
    res.end(`echo:${req.url}`);
  });
  const listening = new Promise<void>((resolve) => {
    server.listen(port, resolve);
  });
  return { server, listening };
}

/**
 * Sends an HTTP GET request and returns the response body.
 * @param url - Full URL to request.
 * @returns The response body as a string.
 */
function httpGet(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = "";
      res.on("data", (chunk: Buffer) => { body += chunk.toString(); });
      res.on("end", () => {
        resolve({ status: res.statusCode ?? 0, body });
      });
    }).on("error", reject);
  });
}

describe("ProxyServer", () => {
  const servers: http.Server[] = [];
  let proxy: ProxyServer | undefined;

  afterEach(async () => {
    if (proxy) {
      await proxy.stop();
      proxy = undefined;
    }
    await Promise.all(
      servers.map((s) => new Promise<void>((resolve) => { s.close(() => { resolve(); }); })),
    );
    servers.length = 0;
  });

  it("proxies a request preserving path and query string", async () => {
    const echo = createEchoServer(19001);
    servers.push(echo.server);
    await echo.listening;

    const router = new RoundRobinRouter([{ host: "localhost", port: 19001 }]);
    proxy = new ProxyServer(router, 19000);
    await proxy.start();

    const res = await httpGet("http://localhost:19000/foo?bar=1");
    expect(res.status).toBe(200);
    expect(res.body).toBe("echo:/foo?bar=1");
  });

  it("round-robins between multiple downstream servers", async () => {
    const echo1 = createEchoServer(19002);
    const echo2 = createEchoServer(19003);
    servers.push(echo1.server, echo2.server);
    await Promise.all([echo1.listening, echo2.listening]);

    const router = new RoundRobinRouter([
      { host: "localhost", port: 19002 },
      { host: "localhost", port: 19003 },
    ]);
    proxy = new ProxyServer(router, 19004);
    await proxy.start();

    const res1 = await httpGet("http://localhost:19004/a");
    const res2 = await httpGet("http://localhost:19004/b");

    // First goes to 19002, second to 19003
    expect(res1.body).toBe("echo:/a");
    expect(res2.body).toBe("echo:/b");
  });

  it("returns 502 when downstream is unreachable", async () => {
    // Port 19099 has nothing listening
    const router = new RoundRobinRouter([{ host: "localhost", port: 19099 }]);
    proxy = new ProxyServer(router, 19005);
    await proxy.start();

    const res = await httpGet("http://localhost:19005/fail");
    expect(res.status).toBe(502);
    expect(res.body).toBe("Bad Gateway");
  });

  it("starts and stops cleanly", async () => {
    const router = new RoundRobinRouter([{ host: "localhost", port: 19001 }]);
    proxy = new ProxyServer(router, 19006);
    await proxy.start();
    await proxy.stop();
    proxy = undefined;
  });
});
