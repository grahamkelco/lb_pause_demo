# Load Balancer Backpressure Simulation

A working prototype demonstrating a novel load balancer backpressure mechanism that mitigates the cascading latency impact of server pauses (GC, GIL, event loop stalls).

## Problem

When a server experiences a brief pause (10-200ms) from garbage collection, GIL contention, or similar runtime events, the load balancer continues routing requests to it. These requests pile up in the OS network queue. When the server resumes, it faces a thundering herd: a backlog of queued requests plus new incoming traffic. This causes cascading latency degradation that can last 10x longer than the original pause.

This simulation implements a sidecar-based backpressure mechanism where a lightweight process detects server pauses and signals the load balancer to temporarily drain traffic away from the affected server.

## Architecture

| Component | Description |
|-----------|-------------|
| **Load Balancer** (`lb/`) | Round-robin request router with drain/resume support |
| **Sidecar** (`lb/sidecar/`) | Sub-millisecond pause detector that sends DRAIN/RESUME commands |
| **Servers** (`services/`) | Demo servers that simulate runtime pauses |
| **Load Generator** (`generator/`) | Fixed-rate request generator with CLI and HTTP server modes |
| **Web UI** (`web/`) | Real-time metrics dashboard with simulation controls |

## Quick Start

```bash
# Install dependencies
./setup.sh

# Start the simulation
./run.sh up

# Open the Web UI
open http://localhost:3001
```

## Using the Simulation UI

Once the services are running, open **http://localhost:3001** to access the dashboard.

### Server Types

| Type | Description |
|------|-------------|
| **sinkhole** | Instant 200 OK responses with no work. Sidecar always reports healthy. Useful as a baseline. |
| **sinkhole-random** | Same instant responses, but the sidecar randomly toggles healthy/unhealthy. Demonstrates backpressure drain/resume behavior in isolation from actual server load. |
| **simulated-pause** | Performs real CPU work (SHA-256 hashing) on each request and simulates GC-like stop-the-world pauses — a 1.5s busy-spin that interrupts request processing mid-computation via safepoint checks, just like a real JVM GC. The sidecar detects pauses via UDP IPC and drains traffic. |
| **java-gc** | A real Java 21 server (G1GC) that allocates memory and performs CPU work on each request, creating genuine GC pressure. JFR safepoint events are streamed to the sidecar over UDP for real-time pause detection. |

### Recommended Demo

1. Select **simulated-pause** as the server type
2. Set **Servers** to **4**
3. Set **RPS** to **100**
4. Set **Duration** to **180** seconds
5. Run with **Backpressure ON** — observe that the load balancer drains paused servers, keeping p99 latency low
6. Run again with **Backpressure OFF** — observe the p99 spike as requests pile up on paused servers

The **Backpressure** toggle controls whether the load balancer honors sidecar drain signals. When off, it routes pure round-robin regardless of server health, demonstrating the latency impact of sending traffic to a paused server.

## Commands

| Command | Description |
|---------|-------------|
| `./run.sh up` | Start Docker containers (auto-starts Docker if needed) |
| `./run.sh down` | Stop Docker containers |
| `./run.sh build <target>` | Build a package |
| `./run.sh lint <target>` | Run linter on a package |
| `./run.sh test <target>` | Run tests for a package |
| `./run.sh help` | Show all available commands |

**Targets:** `lb`, `sidecar`, `generator`, `web`, `sinkhole`, `java-gc`

## Project Structure

```
lb/               Load balancer
lb/sidecar/       Sidecar pause detector
services/         Demo servers
generator/        Load generator
web/              Web UI and backend
docs/             Documentation
.ai/plans/        Project plans
```

## Design Document

For a detailed technical discussion of the backpressure mechanism, scaling considerations, server architecture impact analysis, and future work, see [DESIGN.md](DESIGN.md).

## Development

This is a TypeScript monorepo using npm workspaces. All packages share a common TypeScript configuration (`tsconfig.base.json`) and ESLint setup (`eslint.config.mjs`).

```bash
# Build a specific package
./run.sh build lb

# Lint a specific package
./run.sh lint generator

# Run tests for a specific package
./run.sh test web
```
