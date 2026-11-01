package org.magyarkozlony;

import java.io.BufferedWriter;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
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
