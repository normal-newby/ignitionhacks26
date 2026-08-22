package ca.sjn.ignitionhacks26.repository;

import ca.sjn.ignitionhacks26.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<UserEntity, UUID> {

    /** Usernames are stored lower-cased, so callers must lower-case before looking one up. */
    Optional<UserEntity> findByUsername(String username);

    boolean existsByUsername(String username);
}
