package org.magyarkozlony;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.awt.Desktop;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

/**
 * Serves the browser visualization (classpath {@code /viz}) and the results CSV on localhost.
 *
 * <p>Usage: {@code gradlew viz --args="--port=8080 --csv=results.csv"}
 */
public class VizServer {

    private static final Map<String, String> CONTENT_TYPES = Map.of(
            "html", "text/html; charset=utf-8",
            "js", "text/javascript; charset=utf-8",
            "css", "text/css; charset=utf-8",
            "csv", "text/csv; charset=utf-8",
            "svg", "image/svg+xml",
            "txt", "text/plain; charset=utf-8");

    static void main(String[] args) throws IOException {
        int port = 8080;
        Path csv = Path.of("results.csv");
        for (String arg : args) {
            if (arg.startsWith("--port=")) {
                port = Integer.parseInt(arg.substring("--port=".length()));
            } else if (arg.startsWith("--csv=")) {
                csv = Path.of(arg.substring("--csv=".length()));
            } else {
                throw new IllegalArgumentException("Unknown argument: " + arg);
            }
        }
        if (Files.notExists(csv)) {
            throw new IllegalArgumentException("CSV not found: " + csv.toAbsolutePath());
        }

        Path csvPath = csv;
        HttpServer server = HttpServer.create(
                new InetSocketAddress(InetAddress.getLoopbackAddress(), port), 0);
        server.createContext("/", exchange -> handle(exchange, csvPath));
        server.start();

        URI uri = URI.create("http://localhost:" + port + "/");
        IO.println("Serving visualization of %s at %s (Ctrl+C to stop)".formatted(csv.toAbsolutePath(), uri));
        openBrowser(uri);
    }

    private static void handle(HttpExchange exchange, Path csv) throws IOException {
        try {
            String path = exchange.getRequestURI().getPath();
            if (path.equals("/")) {
                path = "/index.html";
            }
            if (path.equals("/results.csv")) {
                send(exchange, 200, "csv", Files.readAllBytes(csv));
                return;
            }
            if (path.contains("..")) {
                send(exchange, 400, "txt", "Bad path".getBytes(StandardCharsets.UTF_8));
                return;
            }
            try (InputStream in = VizServer.class.getResourceAsStream("/viz" + path)) {
                if (in == null) {
                    send(exchange, 404, "txt", "Not found".getBytes(StandardCharsets.UTF_8));
                    return;
                }
                send(exchange, 200, extension(path), in.readAllBytes());
            }
        } finally {
            exchange.close();
        }
    }

    private static void send(HttpExchange exchange, int status, String extension, byte[] body) throws IOException {
        exchange.getResponseHeaders().set("Content-Type", CONTENT_TYPES.getOrDefault(extension, "application/octet-stream"));
        exchange.getResponseHeaders().set("Cache-Control", "no-store");
        exchange.sendResponseHeaders(status, body.length);
        try (OutputStream out = exchange.getResponseBody()) {
            out.write(body);
        }
    }

    private static String extension(String path) {
        int dot = path.lastIndexOf('.');
        return dot < 0 ? "" : path.substring(dot + 1);
    }

    private static void openBrowser(URI uri) {
        try {
            if (Desktop.isDesktopSupported() && Desktop.getDesktop().isSupported(Desktop.Action.BROWSE)) {
                Desktop.getDesktop().browse(uri);
            }
        } catch (IOException | UnsupportedOperationException e) {
            IO.println("Open " + uri + " in your browser.");
        }
    }
}
