package ca.sjn.ignitionhacks26.config;

import java.lang.annotation.*;

/**
 * Marks a controller parameter as "the signed-in user". Resolved by
 * {@link CurrentUserResolver} from the {@code X-User-Id} header.
 *
 * <p>Set {@code required = false} for an endpoint that works signed out; the parameter is then
 * null instead of the request being rejected.
 */
@Target(ElementType.PARAMETER)
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface CurrentUser {
    boolean required() default true;
}
