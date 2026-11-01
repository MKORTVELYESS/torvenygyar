package org.torvenygyar;

import java.time.OffsetDateTime;

/**
 * Aggregated metadata extracted from a downloaded PDF.
 */
public record PdfRecord(String url, OffsetDateTime publicationDateTime, int pageCount) {
}
