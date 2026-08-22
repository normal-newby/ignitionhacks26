package ca.sjn.ignitionhacks26.repository;

import ca.sjn.ignitionhacks26.entity.ModelEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ModelRepository extends JpaRepository<ModelEntity, UUID> {

    List<ModelEntity> findByRoomIdOrderByCreatedAtAsc(UUID roomId);

    void deleteByRoomId(UUID roomId);
}
