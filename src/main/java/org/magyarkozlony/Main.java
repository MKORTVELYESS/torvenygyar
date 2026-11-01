package org.magyarkozlony;

import java.net.http.HttpClient;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Semaphore;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Scans Magyar Közlöny listing pages, downloads each PDF briefly to extract metadata,
 * appends results to a CSV via a dedicated writer thread, and deletes each PDF afterwards.
 *
 * <p>Usage:
 * {@code gradle run --args="--from=696 --to=1 --out=results.csv --concurrency=8"}
 */
public class Main {

    private static final int DEFAULT_FROM = 696;
    private static final int DEFAULT_TO = 1;
    private static final int DEFAULT_CONCURRENCY = 8;
    private static final Path DEFAULT_OUT = Path.of("results.csv");
    private static final Path DEFAULT_TMP = Path.of("tmp-pdfs");

    static void main(String[] args) throws Exception {
        Config config = Config.parse(args);
        IO.println("Scanning pages %d -> %d (concurrency=%d), writing %s"
                .formatted(config.fromPage, config.toPage, config.concurrency, config.outputCsv));

        HttpClient httpClient = HttpClient.newBuilder()
                .sslContext(SslSupport.createSslContext())
                .connectTimeout(Duration.ofSeconds(30))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();

        PdfProcessor processor = new PdfProcessor(httpClient, config.tmpDir);
        Semaphore inFlight = new Semaphore(config.concurrency);
        AtomicInteger successCount = new AtomicInteger();
        AtomicInteger failureCount = new AtomicInteger();
        AtomicInteger skipCount = new AtomicInteger();
        Set<String> knownUrls = ConcurrentHashMap.newKeySet();
        knownUrls.addAll(CsvWriter.loadExistingUrls(config.outputCsv));
        IO.println("Loaded %d existing URL(s) from %s".formatted(knownUrls.size(), config.outputCsv));

        try (ExecutorService workers = Executors.newVirtualThreadPerTaskExecutor();
             CsvWriter csvWriter = new CsvWriter(config.outputCsv)) {

            int step = config.fromPage >= config.toPage ? -1 : 1;
            List<CompletableFuture<Void>> pageFutures = new ArrayList<>();

            for (int page = config.fromPage; ; page += step) {
                final int pageNumber = page;
                List<String> urls = PageScanner.findPdfDownloadUrls(pageNumber);
                IO.println("Page %d: %d PDF(s)".formatted(pageNumber, urls.size()));

                List<CompletableFuture<Void>> downloads = new ArrayList<>(urls.size());
                for (String url : urls) {
                    if (!knownUrls.add(url)) {
                        skipCount.incrementAndGet();
                        IO.println("SKIP %s (already in output)".formatted(url));
                        continue;
                    }
                    inFlight.acquire();
                    CompletableFuture<Void> future = processor.processAsync(url, workers)
                            .handle((record, error) -> {
                                inFlight.release();
                                if (error != null) {
                                    knownUrls.remove(url);
                                    failureCount.incrementAndGet();
                                    IO.println("FAIL %s: %s".formatted(url, rootMessage(error)));
                                    return null;
                                }
                                csvWriter.enqueue(record);
                                successCount.incrementAndGet();
                                IO.println("OK  %s pages=%d date=%s"
                                        .formatted(
                                                record.url(),
                                                record.pageCount(),
                                                record.publicationDateTime()));
                                return null;
                            });
                    downloads.add(future);
                }

                // Keep a bounded amount of page work outstanding so listing stays ahead of downloads
                // without buffering every future for 696 pages.
                pageFutures.add(CompletableFuture.allOf(downloads.toArray(CompletableFuture[]::new)));
                if (pageFutures.size() >= 4) {
                    CompletableFuture.allOf(pageFutures.toArray(CompletableFuture[]::new)).join();
                    pageFutures.clear();
                }

                if (page == config.toPage) {
                    break;
                }
            }

            CompletableFuture.allOf(pageFutures.toArray(CompletableFuture[]::new)).join();
        }

        IO.println("Done. success=%d skipped=%d failure=%d -> %s"
                .formatted(successCount.get(), skipCount.get(), failureCount.get(), config.outputCsv));
    }

    private static String rootMessage(Throwable error) {
        Throwable current = error;
        while (current.getCause() != null && current.getCause() != current) {
            current = current.getCause();
        }
        return current.getMessage() != null ? current.getMessage() : current.toString();
    }

    private record Config(int fromPage, int toPage, int concurrency, Path outputCsv, Path tmpDir) {

        static Config parse(String[] args) {
            int from = DEFAULT_FROM;
            int to = DEFAULT_TO;
            int concurrency = DEFAULT_CONCURRENCY;
            Path out = DEFAULT_OUT;
            Path tmp = DEFAULT_TMP;

            for (String arg : args) {
                if (arg.startsWith("--from=")) {
                    from = Integer.parseInt(arg.substring("--from=".length()));
                } else if (arg.startsWith("--to=")) {
                    to = Integer.parseInt(arg.substring("--to=".length()));
                } else if (arg.startsWith("--concurrency=")) {
                    concurrency = Integer.parseInt(arg.substring("--concurrency=".length()));
                } else if (arg.startsWith("--out=")) {
                    out = Path.of(arg.substring("--out=".length()));
                } else if (arg.startsWith("--tmp=")) {
                    tmp = Path.of(arg.substring("--tmp=".length()));
                } else if ("--help".equals(arg) || "-h".equals(arg)) {
                    printHelpAndExit();
                } else {
                    throw new IllegalArgumentException("Unknown argument: " + arg);
                }
            }

            if (from < 1 || to < 1) {
                throw new IllegalArgumentException("--from and --to must be >= 1");
            }
            if (concurrency < 1) {
                throw new IllegalArgumentException("--concurrency must be >= 1");
            }
            return new Config(from, to, concurrency, out, tmp);
        }

        private static void printHelpAndExit() {
            IO.println("""
                    Usage: gradle run --args="[--from=696] [--to=1] [--concurrency=8] [--out=results.csv] [--tmp=tmp-pdfs]"
                    Scans listing pages, downloads PDFs briefly, writes url/date/pages to CSV, deletes each PDF.
                    """);
            System.exit(0);
        }
    }
}
