package ca.sjn.ignitionhacks26.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.web.client.RestClient;

import java.time.Duration;

@Configuration
@EnableAsync
@EnableScheduling
@EnableConfigurationProperties({MarbleProperties.class, MinioProperties.class, GeminiProperties.class})
public class AppConfig {

    /**
     * Talks to api.worldlabs.ai. Marble authenticates with its own WLT-Api-Key header, not
     * a bearer token.
     *
     * <p>Built from RestClient.builder() rather than an injected RestClient.Builder: Spring
     * Boot 4 moved RestClientAutoConfiguration out of spring-boot-starter-web, so no Builder
     * bean exists to autowire here.
     */
    @Bean
    public RestClient marbleRestClient(MarbleProperties properties) {
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory();
        factory.setReadTimeout(Duration.ofSeconds(60));

        RestClient.Builder builder = RestClient.builder()
                .baseUrl(properties.getBaseUrl())
                .requestFactory(factory)
                .defaultHeader("Accept", "application/json");

        // Left unset when absent so the failure is a clear 401 rather than a null header.
        if (properties.hasApiKey()) {
            builder.defaultHeader("WLT-Api-Key", properties.getApiKey());
        }
        return builder.build();
    }

    /**
     * Talks to generativelanguage.googleapis.com for the catalog's dimension estimator.
     * Gemini takes its key in an {@code x-goog-api-key} header; passing it as a {@code ?key=}
     * query parameter also works but would put the secret in every access log along the way.
     *
     * <p>The read timeout is short on purpose: an admin is watching a spinner in the catalog
     * form, and a slow guess is worth less than a quick failure they can type over.
     */
    @Bean
    public RestClient geminiRestClient(GeminiProperties properties) {
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory();
        factory.setReadTimeout(Duration.ofSeconds(30));

        RestClient.Builder builder = RestClient.builder()
                .baseUrl(properties.getBaseUrl())
                .requestFactory(factory)
                .defaultHeader("Accept", "application/json");

        // Left unset when absent so the failure is a clear 401 rather than a null header.
        if (properties.hasApiKey()) {
            builder.defaultHeader("x-goog-api-key", properties.getApiKey());
        }
        return builder.build();
    }

    /**
     * For PUTting video bytes at the signed upload URL Marble hands back. Deliberately
     * separate from {@link #marbleRestClient}: that URL points at object storage, not the
     * API, and sending our API key to a third-party host would be both pointless and
     * careless. The long timeout is the upload itself.
     */
    @Bean
    public RestClient uploadRestClient() {
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory();
        factory.setReadTimeout(Duration.ofMinutes(15));
        return RestClient.builder().requestFactory(factory).build();
    }
}
