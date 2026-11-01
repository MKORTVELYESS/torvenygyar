package org.torvenygyar;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDDocumentInformation;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Calendar;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;

/**
 * Downloads a PDF, extracts publication datetime and page count, then deletes the file.
 */
public final class PdfProcessor {

    private static final String USER_AGENT =
            "torvenygyar/1.0 (+https://github.com/local; research aggregation)";

    private final HttpClient httpClient;
    private final Path downloadDir;

    public PdfProcessor(HttpClient httpClient, Path downloadDir) throws IOException {
        this.httpClient = Objects.requireNonNull(httpClient);
        this.downloadDir = Objects.requireNonNull(downloadDir);
        Files.createDirectories(downloadDir);
    }

    public CompletableFuture<PdfRecord> processAsync(String downloadUrl, Executor executor) {
        return CompletableFuture.supplyAsync(() -> process(downloadUrl), executor);
    }

    public PdfRecord process(String downloadUrl) {
        Path tempFile = null;
        try {
            tempFile = downloadToTemp(downloadUrl);
            return extractRecord(downloadUrl, tempFile);
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            throw new PdfProcessingException("Failed to process " + downloadUrl, e);
        } finally {
            deleteQuietly(tempFile);
        }
    }

    private Path downloadToTemp(String downloadUrl) throws IOException, InterruptedException {
        Path tempFile = Files.createTempFile(downloadDir, "mk-", ".pdf");
        HttpRequest request = HttpRequest.newBuilder(URI.create(downloadUrl))
                .header("User-Agent", USER_AGENT)
                .header("Accept", "application/pdf,*/*")
                .GET()
                .build();

        HttpResponse<InputStream> response =
                httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            deleteQuietly(tempFile);
            throw new IOException("HTTP " + response.statusCode() + " for " + downloadUrl);
        }

        try (InputStream body = response.body()) {
            Files.copy(body, tempFile, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        }
        return tempFile;
    }

    private static PdfRecord extractRecord(String downloadUrl, Path pdfFile) throws IOException {
        try (PDDocument document = Loader.loadPDF(pdfFile.toFile())) {
            int pageCount = document.getNumberOfPages();
            OffsetDateTime published = publicationDateTime(document.getDocumentInformation());
            return new PdfRecord(downloadUrl, published, pageCount);
        }
    }

    private static OffsetDateTime publicationDateTime(PDDocumentInformation info) {
        Calendar calendar = null;
        if (info != null) {
            calendar = info.getCreationDate();
            if (calendar == null) {
                calendar = info.getModificationDate();
            }
        }
        if (calendar == null) {
            return null;
        }
        return calendar.toInstant().atOffset(ZoneOffset.UTC);
    }

    private static void deleteQuietly(Path path) {
        if (path == null) {
            return;
        }
        try {
            Files.deleteIfExists(path);
        } catch (IOException ignored) {
            // Best-effort cleanup; next run uses a fresh temp name.
        }
    }

    public static final class PdfProcessingException extends RuntimeException {
        public PdfProcessingException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
