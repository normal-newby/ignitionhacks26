package ca.sjn.ignitionhacks26.controller;

import ca.sjn.ignitionhacks26.config.CurrentUser;
import ca.sjn.ignitionhacks26.dto.AuthRequest;
import ca.sjn.ignitionhacks26.dto.UserResponse;
import ca.sjn.ignitionhacks26.entity.UserEntity;
import ca.sjn.ignitionhacks26.service.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * Backs src/api/auth.js. Both writes answer with the account, and the browser keeps its id to
 * send back as {@code X-User-Id} — there is no token to refresh and nothing to sign out of
 * server-side, so there's no logout endpoint either.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserService userService;

    public AuthController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse register(@RequestBody AuthRequest request) {
        try {
            return UserResponse.from(
                    userService.register(request.username(), request.password(), request.displayName()));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    @PostMapping("/login")
    public UserResponse login(@RequestBody AuthRequest request) {
        try {
            return userService.signIn(request.username(), request.password())
                    .map(UserResponse::from)
                    // One message for both "no such user" and "wrong password", so the form
                    // can't be used to find out which usernames exist.
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.UNAUTHORIZED, "That username and password don't match."));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    /** Confirms a stored session still resolves. The frontend calls this once on boot. */
    @GetMapping("/me")
    public UserResponse me(@CurrentUser UserEntity user) {
        return UserResponse.from(user);
    }
}
