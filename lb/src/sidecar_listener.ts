import * as net from "node:net";
import type { ServerConfig } from "./config.js";
import type { DrainManager } from "./drain_manager.js";

const DRAIN_PREFIX = "DRAIN:";
const RESUME_COMMAND = "RESUME";

/**
 * Listens for sidecar TCP connections on each server's sidecar port.
 *
 * Sidecars send newline-delimited commands (`DRAIN:<ms>` or `RESUME`) over
 * a long-lived TCP connection. Each command is forwarded to the DrainManager
 * to update the corresponding server's drain state.
 */
export class SidecarListener {
  private readonly servers: readonly ServerConfig[];
  private readonly drainManager: DrainManager;
  private readonly tcpServers: net.Server[] = [];
  private readonly activeSockets = new Set<net.Socket>();

  /**
   * Creates a new SidecarListener.
   * @param servers - The downstream server list (only those with sidecarPort are used).
   * @param drainManager - The drain manager to update on DRAIN/RESUME commands.
   */
  constructor(servers: readonly ServerConfig[], drainManager: DrainManager) {
    this.servers = servers;
    this.drainManager = drainManager;
  }

  /**
   * Starts TCP listeners for every server that has a configured sidecar port.
   * @returns A promise that resolves once all listeners are bound.
   */
  async start(): Promise<void> {
    const listenPromises: Promise<void>[] = [];

    for (const server of this.servers) {
      if (server.sidecarPort === undefined) {
        continue;
      }

      const tcpServer = net.createServer((socket) => {
        this.handleConnection(server, socket);
      });

      this.tcpServers.push(tcpServer);

      listenPromises.push(
        new Promise<void>((resolve, reject) => {
          tcpServer.once("error", reject);
          tcpServer.listen(server.sidecarPort, () => {
            tcpServer.removeListener("error", reject);
            resolve();
          });
        }),
      );
    }

    await Promise.all(listenPromises);
  }

  /**
   * Stops all TCP listeners and closes active sockets.
   * @returns A promise that resolves once everything is closed.
   */
  async stop(): Promise<void> {
    for (const socket of this.activeSockets) {
      socket.destroy();
    }
    this.activeSockets.clear();

    await Promise.all(
      this.tcpServers.map(
        (s) => new Promise<void>((resolve) => {
          s.close(() => { resolve(); });
        }),
      ),
    );
    this.tcpServers.length = 0;
  }

  /**
   * Handles a new TCP connection from a sidecar.
   *
   * Accumulates incoming data into a buffer and processes complete
   * newline-delimited lines as commands.
   *
   * @param server - The server this sidecar connection corresponds to.
   * @param socket - The TCP socket.
   */
  private handleConnection(server: ServerConfig, socket: net.Socket): void {
    this.activeSockets.add(socket);
    let buffer = "";

    socket.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      // Keep the last (potentially incomplete) segment in the buffer
      buffer = lines.pop()!;

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length > 0) {
          this.parseLine(server, trimmed);
        }
      }
    });

    socket.on("close", () => {
      this.activeSockets.delete(socket);
    });

    socket.on("error", () => {
      this.activeSockets.delete(socket);
    });
  }

  /**
   * Parses a single command line and updates drain state accordingly.
   * @param server - The server the command applies to.
   * @param line - The raw command string (e.g. "DRAIN:500" or "RESUME").
   */
  private parseLine(server: ServerConfig, line: string): void {
    if (line.startsWith(DRAIN_PREFIX)) {
      const durationStr = line.slice(DRAIN_PREFIX.length);
      const durationMs = Number(durationStr);

      if (!Number.isFinite(durationMs) || durationMs <= 0) {
        return;
      }

      this.drainManager.drain(server, durationMs);
    } else if (line === RESUME_COMMAND) {
      this.drainManager.resume(server);
    }
  }
}
