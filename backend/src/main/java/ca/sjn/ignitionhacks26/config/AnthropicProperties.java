package ca.sjn.ignitionhacks26.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Bound from ANTHROPIC_API_KEY via relaxed binding.
 */
@Data
@ConfigurationProperties(prefix = "anthropic")
public class AnthropicProperties {

    private String apiKey;

    private String model = "claude-opus-5";

    /** Cap on how many uploaded frames get a vision pass, so a 200-photo upload can't run away. */
    private int maxFramesAnalyzed = 24;
}
