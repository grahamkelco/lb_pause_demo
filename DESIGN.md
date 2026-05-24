# Backpressure-Aware Load Balancing: Design Document

## Background

Modern server applications frequently experience brief pauses ranging from single-digit to low-hundreds of milliseconds. During these pauses, the application is unable to process requests, but the load balancer continues routing traffic unaware of the interruption. Requests accumulate in the operating system's TCP accept queue, and when the server resumes it faces a backlog that can take many multiples of the original pause duration to recover from.

### Sources of Server Pauses

| Runtime | Cause | Typical Duration |
|---------|-------|-----------------|
| Java (JVM) | G1GC young/mixed collection, safepoints | 10–500ms |
| Python | Long-held GIL (e.g., C extension, regex) | 1–100ms |
| Node.js | Event loop starvation (sync crypto, JSON parse) | 1–200ms |
| Go | Stop-the-world GC phases | 1–50ms |

### The Cascading Failure Pattern

When a server pauses under load, the following chain of events occurs:

1. **Queue buildup** — The LB continues sending requests at steady-state rate. With a 200ms pause at 10k RPS, ~2,000 requests accumulate in the OS queue.
2. **Thundering herd on resume** — The server drains the accept queue near-instantly, spawning or assigning work to threads for every queued request simultaneously.
3. **Resource contention** — The spike in active threads increases CPU scheduler run-queue depth, context switching, and cache pressure (L1i/L2i thrashing, BTB pollution).
4. **Extended degradation** — In-flight requests that arrived *after* the pause also suffer elevated latency because the system is still recovering from the backlog.
5. **Potential re-pause** — The additional memory allocation from the backlog processing can trigger another GC pause, starting the cycle again.

In real-world observations, a single 200ms GC pause on a heavily loaded Java service produced multi-second tail-latency spikes — over 10x the original pause time.

### Why Traditional Health Checks Fail

Standard load balancer health checks (HTTP pings every 5–30 seconds) are far too slow to detect sub-second pauses. By the time a health check fails, the pause has ended and the damage is done. The server appears healthy again, but is still recovering from the thundering herd.

---

## Solution: Sidecar-Driven Drain Protocol

The core insight is that pause detection must happen *locally* on the server at sub-millisecond granularity, and the results must be communicated to the load balancer proactively via a persistent control channel.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Load Balancer                             │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────────┐  │
│  │ Proxy Server │   │ Round-Robin  │   │  Sidecar Listener  │  │
│  │  (HTTP in)   │──▶│   Router     │   │  (TCP per server)  │  │
│  └──────────────┘   └──────┬───────┘   └────────┬───────────┘  │
│                             │                    │               │
│                      ┌──────▼───────┐            │               │
│                      │ Drain Manager│◀───────────┘               │
│                      └──────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
        │                                              ▲
        │ HTTP requests                                │ TCP control
        ▼                                              │
┌───────────────────┐                          ┌───────────────────┐
│   Server Process  │                          │     Sidecar       │
│   (application)   │                          │  (pause detector) │
└───────────────────┘                          └───────────────────┘
```

### The Sidecar Process

The sidecar runs as a co-located process alongside the application server. It performs high-frequency health checks (default: every 1ms) to detect pauses. Because it runs in the same process environment (same host, same cgroup), any OS-level scheduling stall, GC pause, or event-loop block that affects the application will equally affect the sidecar's check timer — a missed timer tick *is* the detection signal.

Health checks are pluggable. The current implementation includes:
- **Always healthy** — baseline/control (for testing)
- **Random failure** — simulates intermittent pauses (for demo purposes)

In a production deployment, checks would include JVM GC hooks (via JMX), `/proc/schedstat` monitoring, or eventfd-based wakeup timers.

### The DRAIN/RESUME Protocol

Communication between sidecars and the load balancer uses a simple newline-delimited text protocol over persistent TCP connections:

```
DRAIN:<duration_ms>\n    — Remove server from rotation for up to <duration_ms>
RESUME\n                 — Return server to rotation immediately
```

**Protocol semantics:**
- **Last command wins** — Each new command fully replaces the previous state.
- **Auto-resume safety net** — A DRAIN command starts a server-side timer; if no RESUME arrives within `duration_ms`, the server is automatically returned to rotation. This prevents permanent drains from lost RESUME messages or sidecar crashes.
- **Redundant heartbeat** — The sidecar re-sends its current state every `drainInterval / 2` to handle packet loss or connection resets without requiring application-level ACKs.
- **Reconnect with backoff** — If the TCP connection drops, the sidecar reconnects with exponential backoff (100ms initial, 5s cap).

### Timing Characteristics

The system is designed for speed over durability:
- Health check interval: 1ms (configurable)
- Detection-to-drain latency: ~1–2ms (one check interval + TCP write)
- No persistence, no consensus — pure in-memory state on the LB

This means the total time from pause onset to traffic diversion is on the order of low single-digit milliseconds, well within the window needed to prevent meaningful queue buildup.

---

## Server Architecture Impact Analysis

The severity of the pause-induced thundering herd varies significantly based on the server's concurrency model. Understanding these differences is important for prioritizing where backpressure-aware load balancing provides the most value.

### Single-Process, Fixed-Size Thread Pool

**Examples:** Tomcat (default), traditional Java EE application servers, .NET Kestrel with bounded threads.

**Behavior during pause:**
- Requests queue in the OS accept queue during the pause
- On resume, the thread pool drains requests from the accept queue up to pool capacity
- Excess requests beyond pool size remain queued, providing natural *implicit* backpressure
- Recovery is bounded: at most `pool_size` concurrent requests execute simultaneously

**Severity: Moderate.** The fixed thread pool provides a ceiling on concurrent work, limiting the blast radius. However, all threads immediately become busy with stale (queued) requests, meaning fresh requests arriving post-resume experience high queueing delay until the backlog clears. For pools of 200+ threads, context switching overhead is still significant.

### Single-Process, Unbounded (or Large) Thread Pool

**Examples:** Legacy Java services with `Executors.newCachedThreadPool()`, systems with `maxThreads` set very high.

**Behavior during pause:**
- Same OS queue buildup as the fixed pool case
- On resume, the runtime creates/assigns a thread for *every* queued request simultaneously
- Thread count can spike to thousands within milliseconds
- Massive context switching, memory allocation for stacks, CPU cache invalidation

**Severity: Critical.** This is the worst case. The lack of concurrency bounds means the entire queued backlog becomes active simultaneously. CPU scheduler run-queue depth explodes, L1i/L2i caches thrash from thousands of code paths competing, and the system can take 10x+ the pause duration to stabilize. This was the real-world scenario that inspired this project.

### Multi-Process (Fork-per-Request)

**Examples:** Apache with mod_php/mod_perl (prefork MPM), traditional CGI, PHP-FPM.

**Behavior during pause:**
- In the prefork model, idle worker processes block on `accept()`. During a pause, no process is accepting, so requests queue in the OS.
- On resume, multiple processes wake up and race to accept — classic thundering herd on `accept()`.
- Each process handles one request at a time, so concurrency is bounded by the number of pre-forked workers.
- If workers are exhausted, new processes may be forked, which is expensive (COW page table duplication, new address space).

**Severity: Moderate to High.** Bounded by prefork process count, but fork overhead on dynamic scaling is expensive. The `accept()` thundering herd is a well-known problem that kernel patches (SO_REUSEPORT, EPOLLEXCLUSIVE) only partially mitigate. Memory overhead per process is much higher than per thread, so recovery from spawning additional processes is slower.

### Event Loop (Single-Threaded)

**Examples:** Node.js, Python asyncio (single worker), Nginx worker processes, Redis.

**Behavior during pause:**
- An event loop pause means *all* I/O processing stops — no accepts, no reads, no writes.
- On resume, the event loop processes all accumulated I/O events in a single iteration — potentially hundreds or thousands of socket readable/writable events.
- There's no thread explosion, but the single CPU core handling the event loop becomes saturated processing the backlog sequentially.
- Subsequent timer callbacks are delayed, connection timeouts may fire spuriously.

**Severity: Moderate, but different character.** No thread explosion means no context-switching storm. However, the event queue processing can block the loop for extended periods, causing cascading timer misses and upstream timeouts. For Node.js cluster mode (multiple worker processes), each worker is independently affected, and the recovery pattern is per-worker.

### Summary Matrix

| Architecture | Thundering Herd | Resource Explosion | Recovery Time | Backpressure Value |
|---|---|---|---|---|
| Fixed thread pool | Bounded | Low | Moderate | High |
| Unbounded thread pool | Unbounded | Extreme | Very Long | Critical |
| Multi-process (fork) | Bounded | Moderate (fork cost) | Moderate-High | High |
| Event loop | Sequential drain | Low | Moderate | Moderate-High |

In all cases, preventing OS queue buildup via proactive drain significantly reduces or eliminates the recovery penalty. The benefit is most dramatic for unbounded-concurrency architectures but meaningful across all models.

---

## Scaling

### Single Load Balancer Limits

Each server with sidecar support requires one persistent TCP connection to the load balancer's sidecar listener. The relevant resource constraints are:

| Resource | Typical Limit | Impact |
|----------|--------------|--------|
| File descriptors | 1M (tunable via `ulimit`/`sysctl`) | Each TCP conn = 1 fd |
| Memory per connection | ~10–20 KB (socket buffers) | 1000 servers ≈ 10–20 MB |
| CPU for protocol parsing | Negligible (simple text, infrequent messages) | Not a bottleneck |
| Epoll/kqueue scalability | O(1) per event | Efficient at 10K+ conns |

**Practical single-LB capacity:** A single load balancer instance can comfortably maintain persistent sidecar connections for **10,000–50,000 servers**. The protocol traffic is minimal (a few bytes every ~100ms per server in steady state, with bursts only during state transitions). The limiting factor is more likely to be HTTP request throughput than sidecar connection count.

For comparison, a busy LB routing HTTP requests already maintains far more connections to clients than it would for sidecar control channels. The sidecar connections are idle most of the time and produce negligible additional load.

### Two-Tier Load Balancer Topology

For deployments exceeding single-LB capacity or spanning multiple failure domains (racks, clusters, availability zones), a two-tier topology provides horizontal scaling:

```
                    ┌───────────────────┐
                    │   Tier-1 (Global) │
                    │   Load Balancer   │
                    └─────────┬─────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                  ▼
   ┌─────────────────┐ ┌─────────────┐ ┌─────────────────┐
   │  Tier-2 (Rack)  │ │  Tier-2     │ │  Tier-2 (Rack)  │
   │  Load Balancer  │ │  Load Bal.  │ │  Load Balancer  │
   └────────┬────────┘ └──────┬──────┘ └────────┬────────┘
            │                  │                  │
      ┌─────┼─────┐     ┌─────┼─────┐     ┌─────┼─────┐
      ▼     ▼     ▼     ▼     ▼     ▼     ▼     ▼     ▼
    [S+SC][S+SC][S+SC] [S+SC][S+SC][S+SC] [S+SC][S+SC][S+SC]
```

**How it works:**
- **Tier-2 (local) LBs** — Each manages sidecar connections for a rack/pod/cluster of servers (100–1000 each). These handle the fast-path DRAIN/RESUME protocol and make local routing decisions.
- **Tier-1 (global) LB** — Routes across Tier-2 LBs. Can use aggregate health signals (e.g., "Rack A has 30% capacity drained") to shift traffic between clusters.
- **Aggregated drain signaling** — Tier-2 LBs can report their available capacity upstream to Tier-1 using a similar but lower-frequency protocol (e.g., capacity updates every 1–5 seconds).

**Scale achieved:**
- 100 Tier-2 LBs × 1,000 servers each = **100,000 servers** with sub-millisecond pause detection
- Suitable for datacenter / campus / region scale deployments

The Tier-1 LB doesn't need sub-millisecond reaction times because it's making coarser-grained decisions (shifting load between clusters, not individual servers). A 1–5 second update interval is sufficient at that tier.

---

## When Not to Use This

This mechanism solves a specific problem — sub-second server pauses causing queue buildup under high throughput. It is not universally necessary and should not be treated as a replacement for traditional health checking.

### Low Throughput Services

If a service handles tens or low hundreds of requests per second, a 200ms pause accumulates only a handful of queued requests. The recovery cost is negligible — the server clears the small backlog in a single scheduling quantum with no measurable impact on tail latency. The operational complexity of deploying and maintaining sidecars is not justified.

**Rule of thumb:** If `RPS × max_pause_duration` produces a queue smaller than your thread/worker pool, the thundering herd problem doesn't meaningfully apply.

### High-Latency Services

Services where normal request latency is already in the hundreds of milliseconds or seconds (batch processing, report generation, ML inference) have latency budgets that dwarf typical pause durations. A 200ms GC pause against a 5-second p50 latency is within noise. Clients of these services already account for high variability and typically use longer timeouts, retry budgets, and queue-based architectures that absorb brief interruptions naturally.

### Services with Built-In Backpressure

Some architectures already limit concurrency effectively:
- **Bounded work queues with rejection** — Services that reject requests when a queue is full (HTTP 503) already signal the LB via standard retry/error-based routing.
- **Cooperative scheduling runtimes** — Systems like Erlang/BEAM that preemptively schedule lightweight processes don't experience the same all-or-nothing pause pattern.
- **Request-level deadlines** — gRPC services with strict deadlines will shed stale queued requests on their own, limiting the blast radius.

### Relationship to Traditional Health Checks

This system is a **complement** to — not a replacement for — standard health signals:

| Signal | What It Detects | Timescale | Scope |
|--------|----------------|-----------|-------|
| HTTP health check (periodic) | Process crash, dependency failure, misconfiguration | Seconds | LB + server |
| Readiness probe (k8s) | Startup completion, graceful shutdown | Seconds | LB + server |
| Connection-level errors | Network partition, port not listening | Immediate | LB + server |
| Circuit breaker (in-server) | Dependency failure, overload | Immediate | Server only (does not prevent queue buildup) |
| **Sidecar drain protocol** | **Sub-second runtime pauses** | **Milliseconds** | **LB + server** |

Traditional health checks handle *sustained* failures — the server is down, a database is unreachable, a deployment is rolling. The sidecar protocol handles *transient* pauses that are invisible to periodic probes. Both are needed; they operate at different timescales and detect different failure modes.

---

## Coordinated Server Failure

### The Risk of Simultaneous Drains

A naive implementation of this protocol has a dangerous failure mode: if all (or most) servers drain simultaneously, the load balancer has nowhere to send traffic. This isn't a theoretical concern — it's a realistic scenario in several common deployment patterns.

### Why Coordinated Pauses Happen

**GC correlation in homogeneous pools:** Consider a pool of 8 Java servers receiving round-robin traffic with identical request profiles. Each server allocates memory at roughly the same rate, fills its young generation at roughly the same time, and triggers GC at roughly the same time. The servers are effectively synchronized by the load balancer itself — identical work arriving at identical rates produces identical memory pressure curves. A GC pause on one server is a strong predictor that the others are moments away from their own.

**Deployment rollouts:** Rolling restarts often produce brief pauses (JIT warmup, class loading, connection pool initialization). Even with staggered rollouts, the new instances may share startup characteristics that produce near-simultaneous pressure.

**External dependency stalls:** If servers share a dependency (database, cache) that becomes slow, backpressure from that dependency can cause coordinated event loop stalls or thread pool exhaustion across the pool.

### Mitigation Strategies

**LB-side: Panic threshold / duress mode**

The load balancer should track what fraction of the pool is currently drained. When that fraction exceeds a configurable threshold (e.g., 50–70%), the LB enters a "duress mode" where it has several options:

- **Ignore drains** — Continue routing to drained servers on the theory that degraded service is better than no service. The servers will still process requests, just with higher latency from the backlog.
- **Reject traffic** — Return 503 immediately to the client, signaling upstream to retry elsewhere or back off. This protects servers from deeper overload at the cost of availability.
- **Partial respect** — Only honor drains for a subset of servers, maintaining a minimum available pool size.

The right choice here is product- and context-specific. A latency-sensitive service might prefer to reject and let clients retry at a different region. A best-effort service might prefer degraded-but-available.

**Server-side: Breaking GC correlation**

The root cause of coordinated GC pauses can be addressed directly:

- **Routing jitter** — Instead of pure round-robin, introduce weighted randomness so servers accumulate memory at slightly different rates, desynchronizing their GC cycles.
- **Staggered ramp-up** — When bringing servers into rotation (after deploy or scale-out), introduce them gradually with increasing traffic share rather than immediately at full weight.
- **GC scheduling hints** — Some runtimes allow triggering GC during low-traffic periods (e.g., between request batches). Staggering these explicit GC windows across the pool prevents simultaneous pauses.
- **Memory pressure signaling** — A more sophisticated sidecar could report heap occupancy or GC frequency as an early warning, allowing the LB to preemptively shift traffic away from servers approaching a GC threshold — reducing their allocation rate and potentially avoiding the pause entirely.

The goal of this section is not to fully design coordinated-failure handling but to acknowledge that **correlated drains are a real operational concern**, not an edge case. Any production deployment of this system must account for the possibility that the mechanism designed to protect individual servers could, if applied naively across a correlated pool, produce a pool-wide outage. The mitigations above represent a spectrum of approaches; the right combination depends on the specific service's availability vs. latency tradeoffs.

---

## Observer Effect: Cost of High-Frequency Monitoring

The sidecar's tight detection loop is not free. Observing at 1ms intervals has real costs that must be weighed against the protection it provides.

### CPU and Scheduling Overhead

A 1ms check interval means the sidecar expects to be scheduled by the OS at least once per millisecond. This has direct consequences:

- **Forced preemption** — The sidecar's timer fires every 1ms, requiring the kernel scheduler to preempt whatever is running on at least one core, perform a context switch, run the sidecar's check, and switch back. On a server already under load, this adds measurable context-switch overhead.
- **Cache disruption** — Each context switch to the sidecar pollutes L1i/L1d caches with the sidecar's code and data, evicting hot application cache lines. At 1000 switches/second this is a persistent drag on application performance.
- **CPU accounting** — Even if each check iteration is microseconds of work, the scheduling overhead (runqueue insertion, timer interrupt, context switch) is not. On a system with many cores this is negligible; on a 2–4 core container it's a meaningful fraction of available CPU.

The irony is clear: the sidecar designed to protect p99 latency is itself a source of p99 perturbation through scheduling noise.

### Reliability Under Duress

The sidecar's detection model assumes it can reliably observe scheduling gaps. But under the exact conditions it's meant to detect, its own reliability degrades:

- **Thread pool storms** — In the unbounded thread pool scenario, thousands of threads compete for CPU time after a pause. The sidecar process is just another task in the scheduler's run queue. If the system is so overloaded that runqueue depths are in the hundreds, the sidecar itself may not get scheduled within its 1ms window — meaning it either false-positives (detects a "pause" that is actually just scheduler contention) or fails to send its DRAIN command in time because *it* is the one being starved.
- **CPU cgroup limits** — In containerized deployments with CPU limits, the sidecar competes with the application for the same cgroup quota. A CPU-bound application may consume the entire quota, leaving the sidecar throttled.

### Practical Tradeoffs

| Check Interval | Detection Latency | CPU Overhead | Scheduling Pressure |
|---|---|---|---|
| 100μs | Excellent | High — requires near-realtime priority | Significant |
| 1ms | Good | Moderate — ~1000 context switches/sec | Noticeable on small hosts |
| 5ms | Acceptable | Low | Minimal |
| 10ms | Marginal | Negligible | Negligible |

The right interval depends on the deployment: a dedicated 64-core bare-metal host can easily absorb 1ms checks, while a 2-vCPU container should probably use 5–10ms intervals. A production sidecar in C++/Rust with `SCHED_FIFO` or `SCHED_DEADLINE` priority can achieve tighter intervals with less overhead, but still at the cost of reserving scheduler bandwidth that the application cannot use.

---

## Future Work

### Production Implementation: Envoy Plugin

This prototype implements the load balancer in TypeScript for simplicity and self-containment. A production deployment would integrate as an **Envoy proxy filter**:

- **Envoy xDS integration** — The drain state could be exposed as endpoint health metadata via EDS (Endpoint Discovery Service), allowing standard Envoy cluster management to respect drain signals without custom routing logic.
- **Filter chain placement** — A custom network filter on a dedicated listener port would handle sidecar TCP connections and update endpoint health status in Envoy's cluster manager.
- **Existing ecosystem** — Envoy already supports endpoint draining, priority levels, and panic thresholds. The sidecar protocol would feed into these existing mechanisms rather than replacing them.
- **Performance** — Envoy's C++ event loop can handle tens of thousands of sidecar connections alongside millions of RPS of proxied traffic with negligible overhead.

### Production Sidecar: C++ or Rust

The Node.js sidecar implementation in this prototype is adequate for demonstration but has inherent limitations for production use:

- **Timer precision** — Node.js `setInterval` has 1ms minimum resolution and is subject to event loop delays. A C++ or Rust sidecar using `timerfd_create` + `epoll` can achieve sub-100μs check intervals with deterministic timing.
- **Memory footprint** — A native sidecar would consume <1 MB RSS vs. ~30–50 MB for a Node.js process. This matters when deploying thousands of sidecars fleet-wide.
- **No GC of its own** — A Rust sidecar with no garbage collector eliminates the ironic possibility of the pause-detector itself pausing.
- **Deployment** — A statically linked binary simplifies deployment vs. requiring a Node.js runtime on every host.

### Additional Future Directions

- **Graduated drain** — Instead of binary drain/resume, report a "health score" (0.0–1.0) to enable weighted routing during partial degradation.
- **Predictive drain** — For runtimes with observable GC pressure (JVM heap occupancy, Go `GOGC`), begin draining *before* a pause occurs based on heuristic triggers.
- **Kernel integration** — Use eBPF to observe scheduler latency spikes (`sched_switch` events) for language-agnostic pause detection without any application instrumentation.
- **Drain coordination** — Prevent cascading drains by limiting the fraction of the pool that can be simultaneously drained (similar to Envoy's panic threshold).
- **Metrics and observability** — Integrate with OpenTelemetry to expose drain events, pause durations, and queue-depth-avoided metrics for capacity planning.

## Project Scope & Approach

This prototype was scoped and executed in approximately 5 hours using Claude Code. Allocating roughly 2 hours to core protocol implementation, 2 hours to behavioral simulation testing, and 1 hour to documentation and architectural analysis. 

### What Was Built (The Evaluation Harness)

To satisfy the core requirement of a completely self-contained, zero-configuration evaluation experience, I designed and built an end-to-end simulation cluster:

* **Custom Load Balancer:** A lightweight, reactive round-robin proxy built in TypeScript that implements the custom TCP `DRAIN`/`RESUME` protocol. Developing this from scratch ensures that the core routing mechanics, state mutations, and panic thresholds remain entirely transparent and inspectable without being obscured by an enterprise proxy binary.
* **Sidecar Pause Detector:** The co-located monitoring process that samples scheduler health at high frequency and manages the persistent control-plane channel back to the load balancer.
* **Synthetic Edge Runtimes:** Mock application servers engineered to simulate deterministic scheduling stalls. A reference Java server implementation is included to demonstrate real-world integration patterns under severe garbage collection pressure.
* **Integrated Load Generator:** A deterministic HTTP workload injector built to map seamlessly to the simulation's control-plane UI, allowing tight coupling between traffic spikes and simulated runtime pauses.
* **Observability Dashboard:** A unified React and Node.js web interface providing real-time telemetry visualization of the queue-depth mitigation and latency curves.

### Pragmatic Design Trade-offs
* **Decoupled from Envoy/Service Meshes:** While a production-grade deployment would ideally manifest as an Envoy network filter or xDS control-plane extension, doing so here would add significant environmental friction for the reviewer. A bespoke proxy allowed me to cleanly expose the state synchronization and edge-case behaviors (like the auto-resume safety net) instantly.
* **In-Memory Telemetry vs. Prometheus/Grafana:** To avoid forcing the reviewer to spin up a heavy TSDB/visualization stack, metrics are scraped directly from internal memory allocations via light HTTP endpoints. This achieves sub-second metric granularity for the UI while keeping the runtime footprint negligible.
* **Unified TypeScript Stack:** Chosen intentionally to enforce a single-language domain across the control plane, proxy, and frontend. This minimizes cognitive overhead for the reviewer, trading off low-level runtime optimization in the prototype to maximize codebase scannability.
* **Bespoke Load Injection vs. Standard Tools (wrk/vegeta):** Standard tools are superior for raw throughput testing, but lack the runtime API bindings required to dynamically orchestrate coordinated traffic spikes alongside simulated runtime failures. The custom injector allows the entire system to run as a single, closed-loop state machine.

The ultimate objective of this scope is absolute operational simplicity: a reviewer can clone this repository, execute `./setup.sh && ./run.sh up`, and immediately observe and evaluate the end-to-end mechanics of backpressure-aware routing using only Docker and Node.js.