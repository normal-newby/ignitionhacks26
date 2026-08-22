package ca.sjn.ignitionhacks26.repository;

import ca.sjn.ignitionhacks26.entity.TourEntity;
import ca.sjn.ignitionhacks26.entity.TourStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TourRepository extends JpaRepository<TourEntity, UUID> {

    /** Address lookup is the primary entry point from the search bar. */
    Optional<TourEntity> findFirstByAddressIgnoreCaseOrderByCreatedAtDesc(String address);

    List<TourEntity> findByStatusOrderByCreatedAtDesc(TourStatus status);
}
