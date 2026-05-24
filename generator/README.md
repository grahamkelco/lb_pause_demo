# @backpressure/generator

A TypeScript load generator that sends HTTP GET traffic at a controlled rate to a target URI. Supports both CLI and HTTP server modes.

## Features

- **Precise rate control** — drift-compensating scheduler anchored to absolute time, not relative intervals
- **Auto-concurrency** — automatically determines worker thread count based on CPU cores and target RPS, or accepts an explicit `--threads` value
- **Fire-and-forget requests** — maintains target RPS regardless of server response latency
- **Server mode** — exposes an HTTP API for triggering runs and scraping metrics (OpenTelemetry text format)
- **Zero runtime dependencies** — uses only Node.js built-ins (`fetch`, `worker_threads`, `node:http`, `node:util`)

## CLI Usage

```bash
# Build first
./run.sh build generator

# Basic run
node generator/dist/cli.js --rps 100 --duration 10 --uri http://localhost:8080

# With explicit thread count
node generator/dist/cli.js --rps 1000 --duration 30 --uri http://localhost:8080 --threads 4

# Show help
node generator/dist/cli.js --help
```

### Options

| Flag | Short | Description |
|------|-------|-------------|
| `--rps <n>` | `-r` | Target requests per second (required) |
| `--duration <n>` | `-d` | Test duration in seconds (required) |
| `--uri <url>` | `-u` | Target URI to send GET requests to (required) |
| `--threads <n>` | `-t` | Worker thread count (auto-determined if omitted) |
| `--server` | `-s` | Start in HTTP server mode |
| `--port <n>` | `-p` | Server mode listen port (default: 8080) |
| `--help` | `-h` | Show help |

## Server Mode

```bash
node generator/dist/cli.js --server --port 9090
```

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/run?rps=N&duration=N&uri=URL[&threads=N]` | Start a load test, returns JSON results |
| `GET` | `/metrics` | Last run's metrics in OpenTelemetry text format |
| `GET` | `/health` | Health check |

## Quick Smoke Test

To verify the generator works without needing a real target, start a minimal server that discards requests and responds immediately:

```bash
# Terminal 1 — start a sink server on port 9999
node -e "require('http').createServer((_, r) => { r.writeHead(200); r.end(); }).listen(9999, () => console.log('Sink listening on :9999'))"

# Terminal 2 — run the generator against it
node generator/dist/cli.js --rps 50 --duration 5 --uri http://localhost:9999
```

You should see output like:

```
Starting load test: 50 RPS, 5s, 1 thread(s) -> http://localhost:9999/

Results:
{
  "totalRequests": 250,
  "successCount": 250,
  "errorCount": 0,
  "p50": 1.23,
  "p90": 2.01,
  "p99": 3.45,
  ...
}
```

## Development

```bash
./run.sh build generator   # Compile TypeScript
./run.sh lint generator    # Run ESLint
./run.sh test generator    # Run unit tests (30 tests across 6 suites)
```
