import { Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import type { LoadTestConfig } from "./config.js";
import { LoadRunner, type RunnerConfig } from "./load_runner.js";
import { Metrics, type MetricsSnapshot } from "./metrics.js";

const WORKER_ENTRY_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "worker_entry.js",
);

/**
 * Distributes a load test across multiple worker threads and merges results.
 *
 * If threads === 1, runs directly on the main thread to avoid worker overhead.
 * For multiple threads, spawns worker_threads and divides the target RPS evenly.
 */
export class WorkerPool {
  /**
   * Executes a load test according to the given configuration.
   *
   * @param config - the full load test configuration
   * @returns a merged MetricsSnapshot from all workers
   */
  async run(config: LoadTestConfig): Promise<MetricsSnapshot> {
    if (config.threads === 1) {
      return this.runSingleThread(config);
    }
    return this.runMultiThread(config);
  }

  /**
   * Runs the load test directly on the main thread.
   *
   * @param config - the load test configuration
   * @returns a MetricsSnapshot from the single runner
   */
  private async runSingleThread(config: LoadTestConfig): Promise<MetricsSnapshot> {
    const runner = new LoadRunner({
      rps: config.rps,
      durationSec: config.durationSec,
      uri: config.uri,
    });
    return runner.run();
  }

  /**
   * Distributes the load test across multiple worker threads.
   * RPS is divided evenly with any remainder assigned to the first worker.
   *
   * @param config - the load test configuration
   * @returns a merged MetricsSnapshot from all workers
   */
  private async runMultiThread(config: LoadTestConfig): Promise<MetricsSnapshot> {
    const { threads, rps, durationSec, uri } = config;
    const baseRps = Math.floor(rps / threads);
    const remainder = rps % threads;

    const workerPromises: Promise<MetricsSnapshot>[] = [];

    for (let i = 0; i < threads; i++) {
      const workerRps = i === 0 ? baseRps + remainder : baseRps;
      const workerConfig: RunnerConfig = { rps: workerRps, durationSec, uri };
      workerPromises.push(this.spawnWorker(workerConfig));
    }

    const snapshots = await Promise.all(workerPromises);
    return Metrics.merge(snapshots);
  }

  /**
   * Spawns a single worker thread and returns its MetricsSnapshot result.
   *
   * @param config - the runner configuration for this worker
   * @returns a promise that resolves to the worker's MetricsSnapshot
   */
  private spawnWorker(config: RunnerConfig): Promise<MetricsSnapshot> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(WORKER_ENTRY_PATH, { workerData: config });

      worker.on("message", (snapshot: MetricsSnapshot) => {
        resolve(snapshot);
      });

      worker.on("error", reject);

      worker.on("exit", (code) => {
        if (code !== 0) {
          reject(new Error(`Worker exited with code ${String(code)}`));
        }
      });
    });
  }
}
