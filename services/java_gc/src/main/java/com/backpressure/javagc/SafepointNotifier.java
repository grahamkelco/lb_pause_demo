package com.backpressure.javagc;

import java.io.IOException;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.net.SocketException;
import java.net.UnknownHostException;

import java.util.Map;

import jdk.jfr.consumer.RecordingStream;

/**
 * Listens for JVM safepoint events via JDK Flight Recorder and sends
 * UDP notifications to the sidecar pause-detector.
 *
 * Uses {@code jdk.SafepointBegin} and {@code jdk.SafepointEnd} events
 * to bracket safepoint windows. Each event triggers a fire-and-forget
 * UDP datagram containing a small JSON payload.
 */
public class SafepointNotifier {

    private final DatagramSocket socket;
    private final InetAddress targetHost;
    private final int targetPort;
    private RecordingStream stream;

    /**
     * Creates a new SafepointNotifier targeting the given UDP endpoint.
     * @param host the target host for UDP datagrams
     * @param port the target port for UDP datagrams
     * @throws SocketException if the datagram socket cannot be created
     * @throws UnknownHostException if the host cannot be resolved
     */
    public SafepointNotifier(String host, int port) throws SocketException, UnknownHostException {
        this.socket = new DatagramSocket();
        this.targetHost = InetAddress.getByName(host);
        this.targetPort = port;
    }

    /**
     * Starts the JFR recording stream on a daemon thread.
     *
     * Enables {@code jdk.SafepointBegin} and {@code jdk.SafepointEnd} events
     * and registers handlers that send UDP notifications for each event.
     */
    public void start() {
        stream = new RecordingStream();
        stream.setSettings(Map.of("flush-interval", "10ms"));
        stream.enable("jdk.SafepointBegin");
        stream.enable("jdk.SafepointEnd");

        stream.onEvent("jdk.SafepointBegin", event -> {
            long id = event.getLong("safepointId");
            String json = "{\"event\":\"safepoint_start\",\"id\":" + id + "}";
            sendDatagram(json);
        });

        stream.onEvent("jdk.SafepointEnd", event -> {
            long id = event.getLong("safepointId");
            long durationMs = event.getDuration().toMillis();
            String json = "{\"event\":\"safepoint_end\",\"id\":" + id
                + ",\"durationMs\":" + durationMs + "}";
            sendDatagram(json);
        });

        stream.startAsync();
        System.out.println("SafepointNotifier started, sending to "
            + targetHost.getHostAddress() + ":" + targetPort);
    }

    /**
     * Stops the JFR recording stream and closes the UDP socket.
     */
    public void stop() {
        if (stream != null) {
            stream.close();
        }
        socket.close();
        System.out.println("SafepointNotifier stopped.");
    }

    /**
     * Sends a JSON string as a UDP datagram to the configured target.
     * Failures are logged but not propagated.
     * @param json the JSON payload to send
     */
    private void sendDatagram(String json) {
        try {
            byte[] data = json.getBytes(java.nio.charset.StandardCharsets.UTF_8);
            DatagramPacket packet = new DatagramPacket(data, data.length, targetHost, targetPort);
            socket.send(packet);
        } catch (IOException e) {
            System.err.println("SafepointNotifier: failed to send datagram: " + e.getMessage());
        }
    }
}
