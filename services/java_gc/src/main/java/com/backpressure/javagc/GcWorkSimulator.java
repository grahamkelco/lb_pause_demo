package com.backpressure.javagc;

import java.util.ArrayList;
import java.util.List;

/**
 * Provides static methods that simulate GC-heavy workloads by allocating memory
 * and busy-spinning to keep the thread in the OS runqueue.
 */
public final class GcWorkSimulator {

    private GcWorkSimulator() {}

    /**
     * Allocates the specified number of megabytes as 1 MB byte arrays,
     * keeping them alive in a local list until the method returns.
     * @param mb number of megabytes to allocate
     * @return the list of allocated arrays (caller can discard immediately)
     */
    public static List<byte[]> allocateMemory(int mb) {
        List<byte[]> buffers = new ArrayList<>(mb);
        for (int i = 0; i < mb; i++) {
            // Each array is 1 MB; contents are zero-initialized by the JVM
            buffers.add(new byte[1024 * 1024]);
        }
        return buffers;
    }

    /**
     * Busy-spins for the specified duration using {@code System.nanoTime()} for
     * monotonic accuracy. Performs arithmetic in the loop to prevent JIT elimination.
     * @param ms duration to spin in milliseconds
     * @return a checksum value (prevents dead-code elimination by the JIT)
     */
    public static long busySpin(long ms) {
        long durationNanos = ms * 1_000_000L;
        long start = System.nanoTime();
        long counter = 0;
        while (System.nanoTime() - start < durationNanos) {
            // Arithmetic to keep the CPU busy and prevent loop elimination
            counter += System.nanoTime() ^ (counter * 31);
        }
        return counter;
    }
}
