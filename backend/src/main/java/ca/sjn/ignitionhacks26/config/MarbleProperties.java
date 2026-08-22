package ca.sjn.ignitionhacks26.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * World Labs Marble API settings. The key binds from WORLD_LABS_API_KEY — see the explicit
 * mapping in application.properties, since relaxed binding won't bridge those two names.
 */
@Data
@ConfigurationProperties(prefix = "marble")
public class MarbleProperties {

    private String apiKey;

    /** Host only — paths are "/marble/v1/...". */
    private String baseUrl = "https://api.worldlabs.ai";

    /** Marble model to generate with. */
    private String model = "marble-1.1";

    /** How often the poller asks Marble whether a job is done. */
    private long pollIntervalMs = 15_000L;

    /** Give up on a job after this long; generation is normally ~5 minutes. */
    private long jobTimeoutMs = 20 * 60_000L;

    public boolean hasApiKey() {
        return apiKey != null && !apiKey.isBlank();
    }
}
