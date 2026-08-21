package ca.sjn.ignitionhacks26.repository;

import ca.sjn.ignitionhacks26.entity.RoomEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RoomRepository extends JpaRepository<RoomEntity, UUID> {

    List<RoomEntity> findByScanIdOrderByCreatedAtAsc(UUID scanId);

    void deleteByScanId(UUID scanId);
}
