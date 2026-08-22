package ca.sjn.ignitionhacks26.config;

import ca.sjn.ignitionhacks26.entity.UserEntity;
import ca.sjn.ignitionhacks26.service.UserService;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

/**
 * Turns the {@code X-User-Id} request header into the {@link UserEntity} a controller asked
 * for with {@link CurrentUser}.
 *
 * <p>This is the whole session mechanism, and it is worth being blunt about what it is not: a
 * user id is not a secret, so anyone who knows another account's id can send it and be treated
 * as that account. That's the "don't worry about authentication" the app was built to — the
 * ownership rules below it are about keeping one person's rooms out of another person's grid,
 * not about withstanding someone forging a header. Swapping this for a signed token later is a
 * change to this one class plus how the frontend stores what it gets back from
 * {@code /api/auth/*}; nothing downstream cares where the {@code UserEntity} came from.
 */
@Component
public class CurrentUserResolver implements HandlerMethodArgumentResolver {

    public static final String HEADER = "X-User-Id";

    private final UserService userService;

    public CurrentUserResolver(UserService userService) {
        this.userService = userService;
    }

    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        return parameter.hasParameterAnnotation(CurrentUser.class)
                && UserEntity.class.isAssignableFrom(parameter.getParameterType());
    }

    @Override
    public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer mavContainer,
                                  NativeWebRequest request, WebDataBinderFactory binderFactory) {
        boolean required = parameter.getParameterAnnotation(CurrentUser.class).required();
        String header = request.getHeader(HEADER);

        if (header == null || header.isBlank()) {
            if (!required) {
                return null;
            }
            throw unauthorized();
        }

        UUID id;
        try {
            id = UUID.fromString(header.trim());
        } catch (IllegalArgumentException e) {
            throw unauthorized();
        }

        // An id that no longer resolves means a deleted account or a stale browser; either way
        // the client needs to sign in again, so it gets the same 401 as no header at all.
        UserEntity user = userService.find(id).orElse(null);
        if (user == null && required) {
            throw unauthorized();
        }
        return user;
    }

    private static ResponseStatusException unauthorized() {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sign in to continue.");
    }
}
