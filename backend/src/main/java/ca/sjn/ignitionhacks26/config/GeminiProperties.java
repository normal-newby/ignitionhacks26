package ca.sjn.ignitionhacks26.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.unit.DataSize;

/**
 * Gemini settings, used by the catalog's dimension estimator. The key binds from
 * GEMINI_API_KEY — see the explicit mapping in application.properties, same relaxed-binding
 * reason as the Marble key.
 */
@Data
@ConfigurationProperties(prefix = "gemini")
public class GeminiProperties {

    private String apiKey;

    /** Host only — paths are "/v1beta/models/{model}:generateContent". */
    private String baseUrl = "https://generativelanguage.googleapis.com";

    /**
     * Flash rather than Pro: this is one short structured answer about everyday furniture,
     * and the admin is waiting on it with a spinner.
     */
    private String model = "gemini-3.1-flash-lite";

    /**
     * A reference photo is sent inline (base64 in the request body), not by URL, so it has to
     * be small. Matches the catalog's own thumbnail cap.
     */
    private DataSize maxImageSize = DataSize.ofMegabytes(5);

    public boolean hasApiKey() {
        return apiKey != null && !apiKey.isBlank();
    }
}
