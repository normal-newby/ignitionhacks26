package ca.sjn.ignitionhacks26.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Sign-up and sign-in body. {@code display_name} is only read on sign-up; sign-in ignores it.
 */
public record AuthRequest(
        String username,
        String password,
        @JsonProperty("display_name") String displayName
) {}
