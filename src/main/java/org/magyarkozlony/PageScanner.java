package org.magyarkozlony;

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
            "terjedelem/1.0 (+https://github.com/local; research aggregation)";

    private static final SSLSocketFactory SSL_SOCKET_FACTORY =
            SslSupport.createSslContext().getSocketFactory();

    private PageScanner() {
    }

    /**
     * Returns download URLs ({@code .../letoltes}) for every PDF journal row on the page.
     */
    public static List<String> findPdfDownloadUrls(int pageNumber) throws IOException {
        String url = LISTING_URL.formatted(pageNumber);
        Document document = Jsoup.connect(url)
                .userAgent(USER_AGENT)
                .sslSocketFactory(SSL_SOCKET_FACTORY)
                .timeout(60_000)
                .get();

        List<String> downloadUrls = new ArrayList<>();
        Elements rows = document.select("div.journal-row");
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
