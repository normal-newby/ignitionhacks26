package ca.sjn.ignitionhacks26.dto;

import ca.sjn.ignitionhacks26.entity.UserEntity;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.UUID;

/**
 * The account as the browser holds it. The id doubles as the session token — see
 * {@code CurrentUserResolver} for exactly how much that is and isn't worth. No hash ever
 * leaves the server.
 */
public record UserResponse(
        UUID id,
        String username,
        @JsonProperty("display_name") String displayName
) {

    public static UserResponse from(UserEntity user) {
        return new UserResponse(user.getId(), user.getUsername(), user.getDisplayName());
    }
}
