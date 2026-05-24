package com.backpressure.javagc;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

/**
 * HTTP server that simulates GC pressure on every /query request and exposes
 * request metrics on /metrics in OpenTelemetry text exposition format.
 */
public class JavaGcServer {

    private final HttpServer server;
    private final MetricsTracker metrics;
    private final ThreadPoolExecutor executor;
    private final int allocMb;
    private final int spinIterations;

    /**
     * Creates a new JavaGcServer.
     * @param port HTTP listen port
     * @param threadPoolSize number of threads in the request-handling pool
     * @param allocMb megabytes of memory to allocate per /query request
     * @param spinIterations number of SHA-256 digest iterations per /query request
     * @throws IOException if the server socket cannot be bound
     */
    public JavaGcServer(int port, int threadPoolSize, int allocMb, int spinIterations) throws IOException {
        this.allocMb = allocMb;
        this.spinIterations = spinIterations;
        this.metrics = new MetricsTracker();
        this.executor = new ThreadPoolExecutor(
            threadPoolSize, threadPoolSize,
            60L, TimeUnit.SECONDS,
            new LinkedBlockingQueue<>(),
            r -> {
                Thread t = new Thread(r, "gc-worker");
                t.setDaemon(true);
                return t;
            }
        );
        this.server = HttpServer.create(new InetSocketAddress(port), 0);
        this.server.setExecutor(executor);
        this.server.createContext("/query", this::handleQuery);
        this.server.createContext("/metrics", this::handleMetrics);
    }

    /**
     * Handles /query requests: allocates memory, busy-spins, records the metric,
     * then returns 200 OK.
     * @param exchange the HTTP exchange
     * @throws IOException if writing the response fails
     */
    private void handleQuery(HttpExchange exchange) throws IOException {
        // Allocate memory to create GC pressure
        var buffers = GcWorkSimulator.allocateMemory(allocMb);

        // Busy-spin to simulate compute work
        long checksum = GcWorkSimulator.busySpin(spinIterations);

        // Record the request for metrics
        metrics.recordRequest();

        // Respond with 200 OK
        byte[] response = ("OK checksum=" + checksum + " buffers=" + buffers.size() + "\n")
            .getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "text/plain");
        exchange.sendResponseHeaders(200, response.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(response);
        }
    }

    /**
     * Handles /metrics requests by returning OpenTelemetry text exposition format.
     * @param exchange the HTTP exchange
     * @throws IOException if writing the response fails
     */
    private void handleMetrics(HttpExchange exchange) throws IOException {
        long total = metrics.getTotalRequests();
        double rps = metrics.getRps();

        String body = String.join("\n",
            "# HELP java_gc_requests_total Total number of requests received on /query",
            "# TYPE java_gc_requests_total counter",
            "java_gc_requests_total " + total,
            "",
            "# HELP java_gc_requests_per_second Requests per second (10s rolling average)",
            "# TYPE java_gc_requests_per_second gauge",
            "java_gc_requests_per_second " + rps,
            ""
        );

        byte[] response = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
        exchange.sendResponseHeaders(200, response.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(response);
        }
    }

    /**
     * Starts the HTTP server and metrics tracker.
     */
    public void start() {
        metrics.start();
        server.start();
    }

    /**
     * Stops the HTTP server, metrics tracker, and thread pool gracefully.
     */
    public void stop() {
        server.stop(2);
        metrics.stop();
        executor.shutdown();
    }
}
