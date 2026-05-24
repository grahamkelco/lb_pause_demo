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
```

## Commands

| Command | Description |
|---------|-------------|
| `./run.sh up` | Start Docker containers (auto-starts Docker if needed) |
| `./run.sh down` | Stop Docker containers |
| `./run.sh build <target>` | Build a package |
| `./run.sh lint <target>` | Run linter on a package |
| `./run.sh test <target>` | Run tests for a package |
| `./run.sh help` | Show all available commands |

**Targets:** `lb`, `sidecar`, `generator`, `web`

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
