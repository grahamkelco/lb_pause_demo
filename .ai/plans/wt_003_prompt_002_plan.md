 Plan: Java GC Pause Simulator Service (Real Java / JDK 21 / G1GC)                                                                       

 Context

 We need a real Java HTTP server running on JDK 21 with G1GC that creates genuine GC pressure under load. Each /query request is handled
 in a thread pool thread that allocates memory (driving G1GC collections) and busy-spins doing compute (staying in the OS runqueue — NOT
 sleeping). This gives us an authentic Java GC pause profile for backpressure testing. The server also exposes /metrics in OTel text
 format like the sinkhole service.

 Naming

 - Directory: services/java_gc
 - run.sh target: java-gc
 - Java package: com.backpressure.javagc

 Files to Create

 ┌─────────────────────────────────────────────────────────────────────────────┬───────────────────────────────────────────────────────┐
 │                                    File                                     │                      Description                      │
 ├─────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────┤
 │ services/java_gc/build.gradle.kts                                           │ Gradle build with application plugin, JDK 21 target,  │
 │                                                                             │ no external deps (uses com.sun.net.httpserver)        │
 ├─────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────┤
 │ services/java_gc/settings.gradle.kts                                        │ Root project name                                     │
 ├─────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────┤
 │ services/java_gc/src/main/java/com/backpressure/javagc/Main.java            │ Entry point: reads env vars, starts server, registers │
 │                                                                             │  shutdown hook                                        │
 ├─────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────┤
 │ services/java_gc/src/main/java/com/backpressure/javagc/JavaGcServer.java    │ HTTP server with /query and /metrics routes, thread   │
 │                                                                             │ pool executor                                         │
 ├─────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────┤
 │ services/java_gc/src/main/java/com/backpressure/javagc/GcWorkSimulator.java │ Static methods: allocateMemory(int mb) and            │
 │                                                                             │ busySpin(long ms)                                     │
 ├─────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────┤
 │ services/java_gc/src/main/java/com/backpressure/javagc/MetricsTracker.java  │ Sliding-window RPS tracker (same algorithm as         │
 │                                                                             │ sinkhole, ported to Java)                             │
 └─────────────────────────────────────────────────────────────────────────────┴───────────────────────────────────────────────────────┘

 Files to Modify

 ┌────────┬────────────────────────────────────────────────────────────────────────────────────────────────────┐
 │  File  │                                               Change                                               │
 ├────────┼────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ run.sh │ Add java-gc target — build calls gradle build, lint is no-op or checkstyle, test calls gradle test │
 └────────┴────────────────────────────────────────────────────────────────────────────────────────────────────┘

 Architecture

 JavaGcServer

 - Uses JDK built-in com.sun.net.httpserver.HttpServer (no external deps like Netty/Spring)
 - Creates a ThreadPoolExecutor with configurable pool size (default 16) as the server's executor
 - Routes:
   - /query → calls GcWorkSimulator.allocateMemory() + GcWorkSimulator.busySpin(), records metric, returns 200
   - /metrics → returns OTel text format
   - Everything else → 404

 GcWorkSimulator

 - allocateMemory(int mb) — allocates mb × 1MB byte arrays in a loop, stores in a local List<byte[]> to keep alive, then releases after
 spin
 - busySpin(long ms) — tight loop: while (System.nanoTime() - start < ms * 1_000_000) doing arithmetic (e.g. incrementing a volatile
 counter or computing checksums). Uses nanoTime not currentTimeMillis for monotonic accuracy

 MetricsTracker

 - Thread-safe (AtomicLong for total, AtomicIntegerArray for slots)
 - ScheduledExecutorService at 1s interval rotates the circular buffer
 - recordRequest() — atomically increment current slot + total
 - getRps() — sum slots / window size
 - getTotalRequests() — read AtomicLong

 Metrics Format (same as sinkhole)

 # HELP java_gc_requests_total Total number of requests received on /query
 # TYPE java_gc_requests_total counter
 java_gc_requests_total 12345

 # HELP java_gc_requests_per_second Requests per second (10s rolling average)
 # TYPE java_gc_requests_per_second gauge
 java_gc_requests_per_second 42.5

 Environment Variables

 ┌──────────────────┬─────────┬─────────────────────────────────────────┐
 │     Variable     │ Default │                 Purpose                 │
 ├──────────────────┼─────────┼─────────────────────────────────────────┤
 │ PORT             │ 8080    │ HTTP listen port                        │
 ├──────────────────┼─────────┼─────────────────────────────────────────┤
 │ THREAD_POOL_SIZE │ 16      │ Thread pool size for request handling   │
 ├──────────────────┼─────────┼─────────────────────────────────────────┤
 │ GC_ALLOC_MB      │ 64      │ MB of byte arrays allocated per request │
 ├──────────────────┼─────────┼─────────────────────────────────────────┤
 │ GC_SPIN_MS       │ 50      │ Busy-spin duration per request (ms)     │
 └──────────────────┴─────────┴─────────────────────────────────────────┘

 JVM Flags (in build.gradle.kts application block)

 -XX:+UseG1GC -Xmx512m -Xms512m
 Fixed heap to make GC behavior more predictable and pauses more visible.

 run.sh Integration

 The java-gc target won't use npm workspaces. Instead, resolvePackage will be bypassed — add dedicated cases in cmdBuild, cmdLint, and
 cmdTest:

 # In resolvePackage — add java-gc but have build/lint/test handle it specially
 java-gc)   echo "java-gc" ;;  # sentinel value, not an npm package

 # In cmdBuild
 if [[ "$pkg" == "java-gc" ]]; then
   (cd "$SCRIPT_DIR/services/java_gc" && ./gradlew build)
   return
 fi

 # In cmdLint — no-op for now (could add checkstyle later)
 # In cmdTest — gradle test

 Implementation Sequence

 1. Create build.gradle.kts and settings.gradle.kts
 2. Run gradle wrapper to generate gradlew
 3. Create MetricsTracker.java
 4. Create GcWorkSimulator.java
 5. Create JavaGcServer.java
 6. Create Main.java
 7. Update run.sh with java-gc target
 8. Build: ./run.sh build java-gc

 Verification

 1. ./run.sh build java-gc — compiles without errors
 2. Start: java -XX:+UseG1GC -Xmx512m -jar services/java_gc/build/libs/*.jar
 3. curl http://localhost:8080/query — returns 200 (after ~50ms)
 4. curl http://localhost:8080/metrics — OTel formatted metrics
 5. Concurrent load: for i in $(seq 1 100); do curl -s http://localhost:8080/query & done — CPU spikes, GC logs visible with -Xlog:gc