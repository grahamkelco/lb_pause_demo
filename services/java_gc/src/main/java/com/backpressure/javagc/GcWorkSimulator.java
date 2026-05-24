package com.backpressure.javagc;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.List;

/**
 * Provides static methods that simulate GC-heavy workloads by allocating memory
 * and busy-spinning to keep the thread in the OS runqueue.
 */
public final class GcWorkSimulator {

    private static final int DIGEST_BLOCK_SIZE = 4096;

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
     * Performs a fixed number of SHA-256 digest iterations to simulate CPU-bound work.
     * Uses {@link MessageDigest#digest}, a JDK method with natural safepoint
     * opportunities, so G1GC can pause this thread promptly. A fixed iteration
     * count means each request does identical work — latency increases under
     * contention come purely from thread scheduling and GC pauses.
     * @param iterations number of SHA-256 digest rounds to compute
     * @return a checksum derived from the digest output (prevents JIT dead-code elimination)
     */
    public static long busySpin(int iterations) {
        long checksum = 0;

        MessageDigest digest;
        try {
            digest = MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            throw new AssertionError("SHA-256 must be available in every JDK", e);
        }

        // Seed data fed into the digest each iteration
        byte[] block = new byte[DIGEST_BLOCK_SIZE];
        for (int i = 0; i < block.length; i++) {
            block[i] = (byte) (i ^ 0xAB);
        }

        for (int i = 0; i < iterations; i++) {
            // Feed previous checksum into the block so each iteration differs
            block[0] = (byte) checksum;
            block[1] = (byte) (checksum >> 8);

            // MessageDigest.digest is a JDK method call — the JVM can reach a
            // safepoint on method entry/exit, avoiding high time-to-safepoint
            byte[] hash = digest.digest(block);

            // Fold the 32-byte hash into the running checksum
            for (byte b : hash) {
                checksum = checksum * 31 + b;
            }
        }

        return checksum;
    }
}
