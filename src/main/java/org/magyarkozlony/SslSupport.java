package org.magyarkozlony;

import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManagerFactory;
import java.security.KeyStore;
import java.security.SecureRandom;

/**
 * Builds an {@link SSLContext} that trusts the platform certificate store when available
 * (needed for CAs such as Microsec e-Szigno that are present on Windows but not in
 * the JDK {@code cacerts} file).
 */
public final class SslSupport {

    private SslSupport() {
    }

    public static SSLContext createSslContext() {
        try {
            KeyStore trustStore = loadPlatformTrustStore();
            TrustManagerFactory tmf =
                    TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
            tmf.init(trustStore);
            SSLContext sslContext = SSLContext.getInstance("TLS");
            sslContext.init(null, tmf.getTrustManagers(), new SecureRandom());
            return sslContext;
        } catch (Exception e) {
            throw new IllegalStateException("Unable to initialize SSL context", e);
        }
    }

    /**
     * @return platform trust store, or {@code null} to use the JVM default ({@code cacerts})
     */
    private static KeyStore loadPlatformTrustStore() throws Exception {
        String os = System.getProperty("os.name", "").toLowerCase();
        if (os.contains("win")) {
            KeyStore windowsRoot = KeyStore.getInstance("Windows-ROOT");
            windowsRoot.load(null, null);
            return windowsRoot;
        }
        if (os.contains("mac")) {
            KeyStore keychain = KeyStore.getInstance("KeychainStore");
            keychain.load(null, null);
            return keychain;
        }
        return null;
    }
}
