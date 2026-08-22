package ca.sjn.ignitionhacks26.service;

import ca.sjn.ignitionhacks26.entity.UserEntity;
import ca.sjn.ignitionhacks26.repository.UserRepository;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

/**
 * Registration and sign-in.
 *
 * <p>Deliberately not Spring Security: the dependency here is {@code spring-security-crypto},
 * which is the BCrypt implementation on its own with no autoconfiguration behind it. Pulling
 * {@code spring-boot-starter-security} instead would install a filter chain over every
 * endpoint in the app, which is a lot of machinery for a demo whose session is a header.
 */
@Service
public class UserService {

    private static final int MIN_PASSWORD_LENGTH = 6;

    private final UserRepository repository;
    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    public UserService(UserRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public UserEntity register(String username, String password, String displayName) {
        String normalised = normalise(username);
        if (normalised.length() < 3) {
            throw new IllegalArgumentException("Pick a username of at least 3 characters.");
        }
        if (!normalised.matches("[a-z0-9._-]+")) {
            throw new IllegalArgumentException(
                    "Usernames can use letters, numbers, dots, dashes and underscores.");
        }
        if (password == null || password.length() < MIN_PASSWORD_LENGTH) {
            throw new IllegalArgumentException(
                    "Pick a password of at least " + MIN_PASSWORD_LENGTH + " characters.");
        }
        if (repository.existsByUsername(normalised)) {
            throw new IllegalArgumentException("That username is already taken.");
        }

        UserEntity user = new UserEntity();
        user.setUsername(normalised);
        user.setDisplayName(displayName == null || displayName.isBlank()
                ? username.trim()
                : displayName.trim());
        user.setPasswordHash(passwordEncoder.encode(password));
        return repository.save(user);
    }

    /**
     * Empty when the username is unknown or the password is wrong — the caller turns both into
     * the same message, so a failed sign-in doesn't confirm which usernames exist.
     */
    @Transactional(readOnly = true)
    public Optional<UserEntity> signIn(String username, String password) {
        if (password == null) {
            return Optional.empty();
        }
        return repository.findByUsername(normalise(username))
                .filter(user -> passwordEncoder.matches(password, user.getPasswordHash()));
    }

    @Transactional(readOnly = true)
    public Optional<UserEntity> find(UUID id) {
        return repository.findById(id);
    }

    private static String normalise(String username) {
        if (username == null || username.isBlank()) {
            throw new IllegalArgumentException("A username is required.");
        }
        return username.trim().toLowerCase(Locale.ROOT);
    }
}
