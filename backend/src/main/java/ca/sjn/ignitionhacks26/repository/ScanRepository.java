package ca.sjn.ignitionhacks26.repository;

import ca.sjn.ignitionhacks26.entity.ScanEntity;
import ca.sjn.ignitionhacks26.entity.ScanStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface ScanRepository extends JpaRepository<ScanEntity, UUID> {

    /** Drives the poller: everything still in flight with Marble. */
    List<ScanEntity> findByStatusInAndOperationIdIsNotNull(Collection<ScanStatus> statuses);

    List<ScanEntity> findAllByOrderByCreatedAtDesc();

    List<ScanEntity> findByPropertyRefOrderByCreatedAtDesc(String propertyRef);
}
