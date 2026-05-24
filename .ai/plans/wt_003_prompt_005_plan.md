 Plan: JFR Safepoint Notifier + Sidecar GC Pause Health Check                                                                            
                                                                                                                                           
 Context                                                                                                                                   
                                                                                                                                           
 The Java GC server (services/java_gc/) creates real G1GC pressure under load. We now need to connect its actual JVM safepoint pauses to
 the sidecar's health check system so the load balancer can drain traffic during pauses.                                                   
                                                                                                                                           
 Approach: Use JDK Flight Recorder's streaming API (jdk.jfr.consumer.RecordingStream) to capture jdk.SafepointBegin and jdk.SafepointEnd
 events in real-time. When a safepoint starts, send a UDP datagram to the sidecar; when it ends, send another. The sidecar implements a
 new HealthCheck that listens on UDP and marks the server unhealthy during safepoint windows (plus a brief cooldown).

 Why JFR safepoints? JMX GC notifications only fire after GC completes. JFR safepoint events give us actual start/end bracketing of all
 safepoint operations (not just GC), with low overhead, using only built-in JDK 21 APIs.

 Why UDP? Fire-and-forget on localhost — no connection management needed. java.net.DatagramSocket and Node dgram are both built-in. Packet
  loss on localhost is negligible.

 Files to Create

 ┌───────────────────────────────────────────────────────────────────────────────┬─────────────────────────────────────────────────────┐
 │                                     File                                      │                     Description                     │
 ├───────────────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
 │ services/java_gc/src/main/java/com/backpressure/javagc/SafepointNotifier.java │ JFR streaming listener + UDP sender                 │
 ├───────────────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
 │ lb/sidecar/src/gc_pause_check.ts                                              │ HealthCheck impl that listens on UDP for safepoint  │
 │                                                                               │ events                                              │
 └───────────────────────────────────────────────────────────────────────────────┴─────────────────────────────────────────────────────┘

 Files to Modify

 ┌──────────────────────────────────────────────────────────────────┬──────────────────────────────────────────────────────────────────┐
 │                               File                               │                              Change                              │
 ├──────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────┤
 │ services/java_gc/src/main/java/com/backpressure/javagc/Main.java │ Create & start SafepointNotifier, add env vars, stop in shutdown │
 │                                                                  │  hook                                                            │
 ├──────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────┤
 │ lb/sidecar/src/health_check_factory.ts                           │ Add "gc_pause" case                                              │
 ├──────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────┤
 │ lb/sidecar/src/index.ts                                          │ Export GcPauseCheck and GcPauseCheckConfig                       │
 └──────────────────────────────────────────────────────────────────┴──────────────────────────────────────────────────────────────────┘

 Architecture

 SafepointNotifier (Java side)

 Uses jdk.jfr.consumer.RecordingStream to subscribe to safepoint events and sends UDP datagrams to the sidecar.

 public class SafepointNotifier {
     private final DatagramSocket socket;
     private final InetAddress targetHost;
     private final int targetPort;
     private RecordingStream stream;
 }

 Lifecycle:
 - start() — creates a RecordingStream, enables jdk.SafepointBegin and jdk.SafepointEnd events, registers onEvent handlers, calls
 stream.startAsync() (runs on a daemon thread)
 - stop() — closes the stream and socket

 Event handlers:
 - jdk.SafepointBegin → send {"event":"safepoint_start","id":<eventId>}
 - jdk.SafepointEnd → send {"event":"safepoint_end","id":<safepointId>,"durationMs":<duration>}

 The id field uses event.getLong("safepointId") for correlation. Duration on SafepointEnd is computed from event.getDuration().toMillis().

 UDP send: JSON constructed via string concatenation (no library needed for trivial messages). DatagramPacket sent fire-and-forget,
 IOException caught and logged.

 JFR event config: Set withPeriod to "everyChunk" (or omit — safepoint events are instant events, not periodic). No threshold filtering —
 we want all safepoints.

 GcPauseCheck (Sidecar side)

 Implements the existing HealthCheck interface. Binds a UDP socket in the constructor and listens for safepoint events.

 export class GcPauseCheck implements HealthCheck {
     private readonly port: number;          // default 9200
     private readonly host: string;          // default "127.0.0.1"
     private readonly cooldownMs: number;    // default 50
     private socket: Socket | null;
     private healthyAfter: number = 0;       // timestamp when cooldown expires
     private lastDrainMs: number = 0;        // last pause duration for getDrainInterval
 }

 State machine:
 - On safepoint_start → set healthyAfter = Infinity (unhealthy until end received)
 - On safepoint_end → set healthyAfter = Date.now() + max(durationMs, cooldownMs) (brief cooldown to catch back-to-back pauses)
 - isHealthy() → Date.now() >= this.healthyAfter
 - getDrainInterval() → max(lastDrainMs, cooldownMs)

 Socket lifecycle: Bind in constructor (non-blocking, matches how RandomFailure starts implicitly). Parse incoming datagrams as JSON,
 validate event field, ignore malformed packets.

 Message parsing in handleMessage(msg: Buffer):
 const parsed = JSON.parse(msg.toString("utf-8"));
 if (parsed.event === "safepoint_start") {
     this.healthyAfter = Infinity;
 } else if (parsed.event === "safepoint_end") {
     this.lastDrainMs = parsed.durationMs ?? 0;
     const cooldown = Math.max(this.lastDrainMs, this.cooldownMs);
     this.healthyAfter = Date.now() + cooldown;
 }

 Environment Variables (new)

 ┌────────────────┬───────────┬──────┬─────────────────┐
 │    Variable    │  Default  │ Side │     Purpose     │
 ├────────────────┼───────────┼──────┼─────────────────┤
 │ GC_NOTIFY_HOST │ 127.0.0.1 │ Java │ UDP target host │
 ├────────────────┼───────────┼──────┼─────────────────┤
 │ GC_NOTIFY_PORT │ 9200      │ Java │ UDP target port │
 └────────────────┴───────────┴──────┴─────────────────┘

 Sidecar side uses constructor config defaults (port 9200, host 127.0.0.1). Configurable via GcPauseCheckConfig if needed.

 Integration Points

 Main.java changes:
 String gcNotifyHost = strEnv("GC_NOTIFY_HOST", "127.0.0.1");
 int gcNotifyPort = intEnv("GC_NOTIFY_PORT", 9200);
 var notifier = new SafepointNotifier(gcNotifyHost, gcNotifyPort);
 notifier.start();
 // In shutdown hook: notifier.stop();

 health_check_factory.ts changes:
 case "gc_pause":
     return new GcPauseCheck();

 index.ts changes:
 export { GcPauseCheck } from "./gc_pause_check.js";
 export type { GcPauseCheckConfig } from "./gc_pause_check.js";

 Implementation Sequence

 1. Create SafepointNotifier.java
 2. Modify Main.java — add env vars, start/stop notifier
 3. Create gc_pause_check.ts
 4. Modify health_check_factory.ts — add gc_pause case
 5. Modify index.ts — add exports
 6. Build Java: ./run.sh build java-gc
 7. Build sidecar: ./run.sh build sidecar
 8. Verify end-to-end

 Verification

 1. ./run.sh build java-gc — compiles without errors
 2. ./run.sh build sidecar — compiles without errors
 3. ./run.sh lint sidecar — passes
 4. Start Java server: GC_NOTIFY_PORT=9200 ./run.sh (via gradlew run)
 5. Start a simple UDP listener to confirm datagrams arrive: nc -u -l 9200
 6. Hit /query several times to trigger GC → see safepoint_start/safepoint_end JSON messages
 7. Full integration: start sidecar with health_checks: [gc_pause], confirm DRAIN/RESUME commands sent to LB during GC pauses