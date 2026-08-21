package ca.sjn.ignitionhacks26.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Bound from MARBLE_* env vars via relaxed binding (MARBLE_API_KEY -> marble.api-key).
 */
@Data
@ConfigurationProperties(prefix = "marble")
public class MarbleProperties {

    private String apiKey;

    /**
     * Host only — paths are "/marble/v1/...". NOTE: unverified, confirm against the
     * World Labs docs before the first live call.
     */
    private String baseUrl = "https://api.worldlabs.ai";

    /** How often the poller asks Marble whether a job is done. */
    private long pollIntervalMs = 15_000L;

    /** Give up on a job after this long; generation is normally ~5 minutes. */
    private long jobTimeoutMs = 20 * 60_000L;
}
