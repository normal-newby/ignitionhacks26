package ca.sjn.ignitionhacks26.repository;

import ca.sjn.ignitionhacks26.entity.CatalogItemEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CatalogItemRepository extends JpaRepository<CatalogItemEntity, UUID> {

    /** Catalog rail order: grouped by category, stable within it. */
    List<CatalogItemEntity> findAllByOrderByCategoryAscSortOrderAscNameAsc();
}
