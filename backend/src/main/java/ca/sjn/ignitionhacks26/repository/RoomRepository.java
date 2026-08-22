package ca.sjn.ignitionhacks26.repository;

import ca.sjn.ignitionhacks26.entity.RoomEntity;
import ca.sjn.ignitionhacks26.entity.RoomStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface RoomRepository extends JpaRepository<RoomEntity, UUID> {

    /** Drives the poller: every room whose Marble job is still in flight. */
    List<RoomEntity> findByStatusInAndOperationIdIsNotNull(Collection<RoomStatus> statuses);

    List<RoomEntity> findAllByOrderByCreatedAtDesc();
}
