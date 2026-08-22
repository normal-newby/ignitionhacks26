package ca.sjn.ignitionhacks26.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.web.client.RestClient;

import java.time.Duration;

@Configuration
@EnableAsync
@EnableScheduling
@EnableConfigurationProperties({MarbleProperties.class, GeminiProperties.class})
public class AppConfig {

    /**
     * Built from RestClient.builder() rather than an injected RestClient.Builder: Spring Boot 4
     * moved RestClientAutoConfiguration out of spring-boot-starter-web, so no Builder bean
     * exists to autowire here.
     */
    @Bean
    public RestClient marbleRestClient(MarbleProperties properties) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(15));
        // Generous: the generate call uploads every frame in one request body.
        factory.setReadTimeout(Duration.ofSeconds(180));

        RestClient.Builder builder = RestClient.builder()
                .baseUrl(properties.getBaseUrl())
                .requestFactory(factory)
                .defaultHeader("Accept", "application/json");

        // Left unset when absent so the failure is a clear 401 rather than "Bearer null".
        if (properties.getApiKey() != null && !properties.getApiKey().isBlank()) {
            builder.defaultHeader("Authorization", "Bearer " + properties.getApiKey());
        }
        return builder.build();
    }

    /**
     * Only defined when a key is present, so the app still boots (with the vision pass
     * disabled) if GEMINI_API_KEY isn't set.
     */
    @Bean
    @ConditionalOnExpression("!'${gemini.api-key:}'.isBlank()")
    public RestClient geminiRestClient(GeminiProperties properties) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(15));
        // One frame per call, but thinking-enabled models can take a while to answer.
        factory.setReadTimeout(Duration.ofSeconds(120));

        return RestClient.builder()
                .baseUrl(properties.getBaseUrl())
                .requestFactory(factory)
                .defaultHeader("Accept", "application/json")
                .defaultHeader("x-goog-api-key", properties.getApiKey())
                .build();
    }
}
