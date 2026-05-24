import { parentPort, workerData } from "node:worker_threads";
import { LoadRunner, type RunnerConfig } from "./load_runner.js";

/**
 * Worker thread entry point.
 *
 * Receives a RunnerConfig via workerData, executes the load test,
 * and posts the MetricsResult back to the parent thread.
 */
async function main(): Promise<void> {
  if (!parentPort) {
    throw new Error("worker_entry must be run as a worker thread");
  }

  const config = workerData as RunnerConfig;
  const runner = new LoadRunner(config);
  const result = await runner.run();
  parentPort.postMessage(result);
}

void main();
