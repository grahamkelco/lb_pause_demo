package com.backpressure.javagc;

import java.io.IOException;

/**
 * Entry point for the Java GC pause simulator service.
 * Reads configuration from environment variables and starts the HTTP server.
 */
public class Main {

    /**
     * Starts the Java GC server with configuration from environment variables.
     * @param args command-line arguments (unused)
     * @throws IOException if the server socket cannot be bound
     */
    public static void main(String[] args) throws IOException {
        int port = intEnv("PORT", 8080);
        int threadPoolSize = intEnv("THREAD_POOL_SIZE", 16);
        int allocMb = intEnv("GC_ALLOC_MB", 64);
        int spinIterations = intEnv("GC_SPIN_ITERATIONS", 2000);
        String gcNotifyHost = strEnv("GC_NOTIFY_HOST", "127.0.0.1");
        int gcNotifyPort = intEnv("GC_NOTIFY_PORT", 9200);

        var server = new JavaGcServer(port, threadPoolSize, allocMb, spinIterations);
        server.start();

        var notifier = new SafepointNotifier(gcNotifyHost, gcNotifyPort);
        notifier.start();

        System.out.println("Java GC server listening on port " + port
            + " (threads=" + threadPoolSize
            + ", allocMb=" + allocMb
            + ", spinIterations=" + spinIterations + ")");

        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            System.out.println("Shutting down Java GC server...");
            notifier.stop();
            server.stop();
            System.out.println("Java GC server stopped.");
        }));
    }

    /**
     * Reads an integer environment variable with a default fallback.
     * @param name the environment variable name
     * @param defaultValue the default value if the variable is not set
     * @return the parsed integer value
     */
    private static int intEnv(String name, int defaultValue) {
        String value = System.getenv(name);
        if (value == null || value.isEmpty()) {
            return defaultValue;
        }
        return Integer.parseInt(value);
    }

    /**
     * Reads a string environment variable with a default fallback.
     * @param name the environment variable name
     * @param defaultValue the default value if the variable is not set
     * @return the environment variable value or the default
     */
    private static String strEnv(String name, String defaultValue) {
        String value = System.getenv(name);
        if (value == null || value.isEmpty()) {
            return defaultValue;
        }
        return value;
    }
}
