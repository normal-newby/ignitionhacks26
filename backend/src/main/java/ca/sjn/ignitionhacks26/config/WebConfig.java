package ca.sjn.ignitionhacks26.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.List;

/**
 * Registers {@link CurrentUserResolver} so controllers can take a {@code @CurrentUser
 * UserEntity} parameter. Kept apart from {@code AppConfig}, which owns the outbound
 * RestClients — implementing {@link WebMvcConfigurer} there would tangle the app's HTTP
 * clients with its request handling for no reason.
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final CurrentUserResolver currentUserResolver;

    /**
     * {@code @Lazy} because a {@link WebMvcConfigurer} is built early, and this one transitively
     * pulls in a JPA repository. Injecting a proxy defers that until the first request, which
     * is the only time the resolver actually runs, and keeps the persistence layer from being
     * dragged into existence ahead of the bean post-processors that configure it.
     */
    public WebConfig(@Lazy CurrentUserResolver currentUserResolver) {
        this.currentUserResolver = currentUserResolver;
    }

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(currentUserResolver);
    }
}
