 Random Failure Health Check for Sidecar                                                                                            

 Context

 We need a health check that simulates periodic server pauses with random timing, to test the load balancer's drain/failover behavior
 with the sinkhole server. The check fails on a roughly periodic cadence with jitter, stays failed for a random 1-10s duration, then
 recovers.

 Files to Create

 1. lb/sidecar/src/random_failure.ts (NEW)

 - RandomFailure class implements HealthCheck
 - Behavior: Alternates between healthy and unhealthy periods
   - Healthy period: random duration between minHealthyMs and maxHealthyMs (e.g. 5-15s)
   - Unhealthy period: random duration between 1s and 10s
   - Transitions tracked by recording nextTransitionTime using Date.now()
 - Constructor: accepts optional config object for min/max healthy and failure durations
 - isHealthy(): checks if currently in a healthy or unhealthy window based on Date.now() vs nextTransitionTime
 - getDrainInterval(): returns the current failure duration (so the LB drain timeout matches)
 - Pattern follows always_healthy.ts — simple, stateful implementation

 2. lb/sidecar/src/__tests__/random_failure.test.ts (NEW)

 - Test initial state is healthy
 - Test transition to unhealthy after healthy period expires
 - Test recovery after failure period expires
 - Test getDrainInterval returns positive value
 - Use vi.useFakeTimers() + vi.setSystemTime() for deterministic testing

 Files to Modify

 3. lb/sidecar/src/health_check_factory.ts (MODIFY)

 - Add import for RandomFailure
 - Add case "random_failure" → new RandomFailure() in the switch

 4. lb/sidecar/src/index.ts (MODIFY)

 - Add re-export for RandomFailure

 Design Details

 class RandomFailure implements HealthCheck {
   private readonly minHealthyMs: number;   // default 5000
   private readonly maxHealthyMs: number;   // default 15000
   private readonly minFailureMs: number;   // default 1000
   private readonly maxFailureMs: number;   // default 10000
   private currentlyHealthy: boolean = true;
   private nextTransitionTime: number;      // Date.now() timestamp
   private currentFailureDuration: number = 0;

   isHealthy(): boolean {
     // Check if we've passed the transition time
     // If so, flip state and schedule next transition
     return this.currentlyHealthy;
   }

   getDrainInterval(): number {
     return this.currentFailureDuration || this.maxFailureMs;
   }
 }

 Key: isHealthy() checks Date.now() against nextTransitionTime. When the time passes, it flips state and computes a new random
 transition time. This approach works cleanly with the 1ms check interval in HealthCheckRunner.

 Verification

 1. ./run.sh build sidecar — compiles
 2. ./run.sh test sidecar — all tests pass
 3. ./run.sh lint sidecar — no lint errors