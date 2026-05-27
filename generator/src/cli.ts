#!/usr/bin/env node

import { Agent, setGlobalDispatcher } from "undici";
import { parseArgs } from "node:util";
import { parseConfig } from "./config.js";
import { WorkerPool } from "./worker_pool.js";
import { GeneratorServer } from "./server.js";

const MAX_CONNECTIONS = parseInt(process.env["MAX_CONNECTIONS"] ?? "5", 10);
setGlobalDispatcher(new Agent({ connections: MAX_CONNECTIONS, pipelining: 1 }));

const USAGE = `
Usage: generator [options]

Options:
  -r, --rps <n>        Target requests per second (required for run mode)
  -d, --duration <n>   Test duration in seconds (required for run mode)
  -u, --uri <url>      Target URI (required for run mode)
  -t, --threads <n>    Number of worker threads (auto-determined if omitted)
  -s, --server         Start in server mode
  -p, --port <n>       Server port (default: 8080)
  -h, --help           Show this help message
`.trim();

/**
 * CLI entry point for the load generator.
 * Parses command line arguments and runs either a one-shot load test
 * or starts the HTTP server mode.
 */
async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      rps: { type: "string", short: "r" },
      duration: { type: "string", short: "d" },
      uri: { type: "string", short: "u" },
      threads: { type: "string", short: "t" },
      server: { type: "boolean", short: "s", default: false },
      port: { type: "string", short: "p", default: "8080" },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help) {
    // eslint-disable-next-line no-console
    console.log(USAGE);
    return;
  }

  if (values.server) {
    await startServer(Number(values.port));
    return;
  }

  await runOnce(values);
}

/**
 * Starts the generator in HTTP server mode.
 *
 * @param port - the port to listen on
 */
async function startServer(port: number): Promise<void> {
  const server = new GeneratorServer();
  await server.listen(port);
}

/**
 * Runs a one-shot load test and prints results to stdout.
 *
 * @param values - parsed CLI argument values
 */
async function runOnce(values: {
  rps?: string;
  duration?: string;
  uri?: string;
  threads?: string;
}): Promise<void> {
  const config = parseConfig({
    rps: values.rps,
    duration: values.duration,
    uri: values.uri,
    threads: values.threads,
  });

  // eslint-disable-next-line no-console
  console.log(
    `Starting load test: ${String(config.rps)} RPS, ${String(config.durationSec)}s, `
    + `${String(config.threads)} thread(s) -> ${config.uri}`,
  );

  const pool = new WorkerPool();
  const result = await pool.run(config);

  // eslint-disable-next-line no-console
  console.log("\nResults:");
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result, null, 2));
}

void main();
