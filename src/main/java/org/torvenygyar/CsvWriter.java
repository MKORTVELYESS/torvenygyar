package org.torvenygyar;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

/**
 * Single-threaded CSV appender. Producers enqueue records; one dedicated thread writes them.
 */
public final class CsvWriter implements AutoCloseable {

    private static final PdfRecord POISON = new PdfRecord("__POISON__", null, -1);
    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private final BlockingQueue<PdfRecord> queue = new LinkedBlockingQueue<>();
    private final Path csvPath;
    private final Thread writerThread;
    private volatile IOException writeFailure;

    public CsvWriter(Path csvPath) throws IOException {
        this.csvPath = csvPath;
        ensureHeader();
        this.writerThread = Thread.ofPlatform()
                .name("csv-writer")
                .start(this::drain);
    }

    public void enqueue(PdfRecord record) {
        if (writeFailure != null) {
            throw new UncheckedIOException(writeFailure);
        }
        queue.add(record);
    }

    /**
     * Reads URLs already present in the output CSV (first column), skipping the header.
     */
    public static Set<String> loadExistingUrls(Path csvPath) throws IOException {
        Set<String> urls = new HashSet<>();
        if (Files.notExists(csvPath) || Files.size(csvPath) == 0) {
            return urls;
        }
        try (BufferedReader reader = Files.newBufferedReader(csvPath, StandardCharsets.UTF_8)) {
            String line = reader.readLine(); // header
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) {
                    continue;
                }
                String url = firstCsvField(line);
                if (!url.isEmpty()) {
                    urls.add(url);
                }
            }
        }
        return urls;
    }

    private static String firstCsvField(String line) {
        if (line.startsWith("\"")) {
            StringBuilder field = new StringBuilder();
            for (int i = 1; i < line.length(); i++) {
                char c = line.charAt(i);
                if (c == '"') {
                    if (i + 1 < line.length() && line.charAt(i + 1) == '"') {
                        field.append('"');
                        i++;
                        continue;
                    }
                    break;
                }
                field.append(c);
            }
            return field.toString();
        }
        int comma = line.indexOf(',');
        return comma < 0 ? line.trim() : line.substring(0, comma).trim();
    }

    @Override
    public void close() throws IOException, InterruptedException {
        queue.add(POISON);
        writerThread.join();
        if (writeFailure != null) {
            throw writeFailure;
        }
    }

    private void ensureHeader() throws IOException {
        Path parent = csvPath.getParent();
        if (parent != null) {
            Files.createDirectories(parent);
        }
        if (Files.notExists(csvPath) || Files.size(csvPath) == 0) {
            Files.writeString(
                    csvPath,
                    "url,publication_date_time,page_count\n",
                    StandardCharsets.UTF_8,
                    StandardOpenOption.CREATE,
                    StandardOpenOption.TRUNCATE_EXISTING);
        }
    }

    private void drain() {
        try (BufferedWriter writer = Files.newBufferedWriter(
                csvPath,
                StandardCharsets.UTF_8,
                StandardOpenOption.CREATE,
                StandardOpenOption.APPEND)) {
            while (true) {
                PdfRecord record = queue.poll(1, TimeUnit.SECONDS);
                if (record == null) {
                    continue;
                }
                if (record == POISON) {
                    writer.flush();
                    return;
                }
                writer.write(toCsvLine(record));
                writer.newLine();
                writer.flush();
            }
        } catch (IOException e) {
            writeFailure = e;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            writeFailure = new IOException("CSV writer interrupted", e);
        }
    }

    static String toCsvLine(PdfRecord record) {
        return escape(record.url())
                + ","
                + escape(formatDate(record.publicationDateTime()))
                + ","
                + record.pageCount();
    }

    private static String formatDate(OffsetDateTime dateTime) {
        return dateTime == null ? "" : ISO.format(dateTime);
    }

    private static String escape(String value) {
        if (value == null) {
            return "";
        }
        boolean needsQuotes = value.contains(",")
                || value.contains("\"")
                || value.contains("\n")
                || value.contains("\r");
        if (!needsQuotes) {
            return value;
        }
        return "\"" + value.replace("\"", "\"\"") + "\"";
    }
}
