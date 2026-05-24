import * as net from "node:net";

const INITIAL_RECONNECT_DELAY_MS = 100;
const MAX_RECONNECT_DELAY_MS = 5000;

/**
 * Manages a long-lived TCP connection from the sidecar to the load balancer.
 *
 * Sends newline-delimited DRAIN and RESUME commands. Automatically
 * reconnects with exponential backoff when the connection drops.
 */
export class LbConnection {
  private readonly host: string;
  private readonly port: number;
  private socket: net.Socket | null = null;
  private reconnectDelay: number = INITIAL_RECONNECT_DELAY_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isConnected: boolean = false;
  private stopped: boolean = false;

  /**
   * Creates a new LbConnection.
   * @param host - The load balancer host to connect to.
   * @param port - The sidecar TCP port on the load balancer.
   */
  constructor(host: string, port: number) {
    this.host = host;
    this.port = port;
  }

  /**
   * Whether the TCP connection is currently established.
   * @returns True if connected.
   */
  get connected(): boolean {
    return this.isConnected;
  }

  /**
   * Establishes the TCP connection to the load balancer.
   * @returns A promise that resolves once connected (or on first connect failure, which triggers reconnect).
   */
  connect(): Promise<void> {
    this.stopped = false;
    return new Promise<void>((resolve) => {
      this.doConnect(resolve);
    });
  }

  /**
   * Sends a DRAIN command with the specified duration.
   * @param durationMs - The drain duration in milliseconds.
   */
  sendDrain(durationMs: number): void {
    this.write(`DRAIN:${durationMs}\n`);
  }

  /**
   * Sends a RESUME command.
   */
  sendResume(): void {
    this.write("RESUME\n");
  }

  /**
   * Closes the connection and stops reconnect attempts.
   */
  disconnect(): void {
    this.stopped = true;

    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }

    this.isConnected = false;
  }

  /**
   * Writes a string to the socket if connected.
   * @param data - The data to write.
   */
  private write(data: string): void {
    if (this.socket && this.isConnected) {
      this.socket.write(data);
    }
  }

  /**
   * Creates the TCP connection and sets up event handlers.
   *
   * On success, resets the reconnect delay. On close or error,
   * schedules a reconnect with exponential backoff.
   *
   * @param onFirstConnect - Called once when the first connection attempt resolves (success or fail).
   */
  private doConnect(onFirstConnect?: () => void): void {
    if (this.stopped) {
      onFirstConnect?.();
      return;
    }

    const socket = net.createConnection({ host: this.host, port: this.port });

    socket.on("connect", () => {
      this.isConnected = true;
      this.reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
      onFirstConnect?.();
      onFirstConnect = undefined;
    });

    socket.on("close", () => {
      this.isConnected = false;
      this.socket = null;
      this.scheduleReconnect();
    });

    socket.on("error", () => {
      // Connection error triggers close, which handles reconnect.
      // Resolve the initial connect promise so startup isn't blocked.
      onFirstConnect?.();
      onFirstConnect = undefined;
    });

    this.socket = socket;
  }

  /**
   * Schedules a reconnect attempt with exponential backoff.
   */
  private scheduleReconnect(): void {
    if (this.stopped) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.doConnect();
    }, this.reconnectDelay);

    // Exponential backoff with cap
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
  }
}
