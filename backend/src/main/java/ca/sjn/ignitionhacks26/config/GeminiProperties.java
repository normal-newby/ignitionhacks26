package ca.sjn.ignitionhacks26.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Bound from GEMINI_* env vars (see application.properties for the explicit mapping).
 */
@Data
@ConfigurationProperties(prefix = "gemini")
public class GeminiProperties {

    private String apiKey;

    /** Host only — paths are "/v1beta/models/...". */
    private String baseUrl = "https://generativelanguage.googleapis.com";

    /** gemini-2.5-flash is 404 for keys created now — the API points new users at 3.6. */
    private String model = "gemini-3.6-flash";

    /** Cap on how many uploaded frames get a vision pass, so a 200-photo upload can't run away. */
    private int maxFramesAnalyzed = 24;
}
