import { SimulatedPauseServer } from "./simulated_pause_server.js";

const port = parseInt(process.env["PORT"] ?? "8080", 10);
const server = new SimulatedPauseServer(port);

await server.start();

/** Shuts down the server gracefully on process signals. */
function shutdown(): void {
  // eslint-disable-next-line no-console
  console.log("Shutting down simulated-pause server...");
  void server.stop().then(() => {
    // eslint-disable-next-line no-console
    console.log("Simulated-pause server stopped.");
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
