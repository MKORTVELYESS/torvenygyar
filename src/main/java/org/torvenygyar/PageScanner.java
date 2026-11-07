package org.torvenygyar;

import org.jsoup.HttpStatusException;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;

import javax.net.ssl.SSLSocketFactory;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/**
 * Fetches listing pages and extracts PDF download URLs from journal-row entries.
 */
public final class PageScanner {

    private static final String LISTING_URL = "https://magyarkozlony.hu/?page=%d";
    private static final String USER_AGENT =
            "torvenygyar/1.0 (+https://github.com/local; research aggregation)";
    private static final long RETRY_DELAY_MS = 3_000L;

    private static final SSLSocketFactory SSL_SOCKET_FACTORY =
            SslSupport.createSslContext().getSocketFactory();

    private PageScanner() {
    }

    /**
     * Returns download URLs ({@code .../letoltes}) for every PDF journal row on the page.
     * On HTTP 500, waits 3 seconds and retries once.
     */
    public static List<String> findPdfDownloadUrls(int pageNumber) throws IOException {
        Document document = fetchListingPage(pageNumber);
        List<String> downloadUrls = new ArrayList<>();
        Elements rows = document.select("div.journal-row, div.fresh-row");
        for (Element row : rows) {
            Element fileFormat = row.selectFirst("meta[itemprop=fileFormat][content=application/pdf]");
            if (fileFormat == null) {
                continue;
            }
            Element urlMeta = row.selectFirst("meta[itemprop=url]");
            if (urlMeta == null) {
                continue;
            }
            String content = urlMeta.attr("content").trim();
            if (content.isEmpty()) {
                continue;
            }
            downloadUrls.add(toDownloadUrl(content));
        }
        return downloadUrls;
    }

    private static Document fetchListingPage(int pageNumber) throws IOException {
        String url = LISTING_URL.formatted(pageNumber);
        try {
            return getDocument(url);
        } catch (HttpStatusException e) {
            if (e.getStatusCode() != 500) {
                throw e;
            }
            IO.println("HTTP 500 for page %d, waiting 3s then retrying".formatted(pageNumber));
            try {
                Thread.sleep(RETRY_DELAY_MS);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                throw new IOException("Interrupted while waiting to retry page " + pageNumber, ie);
            }
            return getDocument(url);
        }
    }

    private static Document getDocument(String url) throws IOException {
        return Jsoup.connect(url)
                .userAgent(USER_AGENT)
                .sslSocketFactory(SSL_SOCKET_FACTORY)
                .timeout(60_000)
                .get();
    }

    static String toDownloadUrl(String metaUrl) {
        if (metaUrl.endsWith("/megtekintes")) {
            return metaUrl.substring(0, metaUrl.length() - "/megtekintes".length()) + "/letoltes";
        }
        if (metaUrl.endsWith("/letoltes")) {
            return metaUrl;
        }
        if (metaUrl.contains("/dokumentumok/") && !metaUrl.endsWith("/letoltes")) {
            int slash = metaUrl.lastIndexOf('/');
            if (slash > 0) {
                return metaUrl.substring(0, slash) + "/letoltes";
            }
        }
        return metaUrl;
    }
}
