package ca.sjn.ignitionhacks26.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

/**
 * One account. This is an identity, not a security boundary — see {@code CurrentUserResolver}
 * for how thin the session is. It exists so a room belongs to somebody and an uploaded catalog
 * piece can be private to the person who uploaded it.
 *
 * <p>The password is BCrypt-hashed anyway. Not because the login is doing any real work, but
 * because people reuse passwords and a hackathon Postgres is still a database on the internet.
 */
@Entity
@Data
@AllArgsConstructor
@NoArgsConstructor
@Table(name = "users")
public class UserEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    /** Stored lower-cased so "Nimo" and "nimo" are the same account. */
    @Column(nullable = false, unique = true)
    private String username;

    /** What the UI shows. Defaults to whatever was typed into the username field. */
    @Column(name = "display_name", nullable = false)
    private String displayName;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
