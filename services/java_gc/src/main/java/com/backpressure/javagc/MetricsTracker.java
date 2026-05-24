package com.backpressure.javagc;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicIntegerArray;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Thread-safe sliding-window RPS tracker using a circular buffer of per-second counts.
 * Mirrors the algorithm from the TypeScript sinkhole MetricsTracker.
 */
public class MetricsTracker {

    private final int windowSize;
    private final AtomicIntegerArray slots;
    private final AtomicInteger currentSlot;
    private final AtomicLong totalRequests;
    private ScheduledExecutorService scheduler;

    /**
     * Creates a new MetricsTracker with the given window size.
     * @param windowSize number of seconds in the sliding window
     */
    public MetricsTracker(int windowSize) {
        this.windowSize = windowSize;
        this.slots = new AtomicIntegerArray(windowSize);
        this.currentSlot = new AtomicInteger(0);
        this.totalRequests = new AtomicLong(0);
    }

    /** Creates a new MetricsTracker with a default 10-second window. */
    public MetricsTracker() {
        this(10);
    }

    /**
     * Starts the per-second slot rotation timer.
     */
    public void start() {
        if (scheduler != null) {
            return;
        }
        scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "metrics-rotator");
            t.setDaemon(true);
            return t;
        });
        scheduler.scheduleAtFixedRate(() -> {
            int next = (currentSlot.get() + 1) % windowSize;
            slots.set(next, 0);
            currentSlot.set(next);
        }, 1, 1, TimeUnit.SECONDS);
    }

    /**
     * Stops the slot rotation timer.
     */
    public void stop() {
        if (scheduler != null) {
            scheduler.shutdownNow();
            scheduler = null;
        }
    }

    /**
     * Records a single incoming request.
     */
    public void recordRequest() {
        slots.incrementAndGet(currentSlot.get());
        totalRequests.incrementAndGet();
    }

    /**
     * Calculates the current requests per second over the sliding window.
     * @return the average RPS across all window slots
     */
    public double getRps() {
        int sum = 0;
        for (int i = 0; i < windowSize; i++) {
            sum += slots.get(i);
        }
        return (double) sum / windowSize;
    }

    /**
     * Returns the total number of requests recorded since creation.
     * @return the monotonic total request count
     */
    public long getTotalRequests() {
        return totalRequests.get();
    }
}
