package ca.sjn.ignitionhacks26.repository;

import ca.sjn.ignitionhacks26.entity.CatalogItemEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface CatalogItemRepository extends JpaRepository<CatalogItemEntity, UUID> {

    /** The seeded entries, which belong to the app rather than to any account. */
    List<CatalogItemEntity> findByOwnerIsNull();

    /**
     * What one user is allowed to see: everything public, plus their own private uploads.
     * Seeded entries have no owner and are public, so they fall out of the first clause.
     *
     * <p>Written as JPQL rather than a derived name because the derived form
     * ({@code findByIsPublicTrueOrOwnerIdOrderBy...}) puts an OR across two properties in a
     * method name that also has to carry the three-part sort — at which point the name is
     * less readable than the query it stands for.
     *
     * <p>The join is aliased and the predicate reads {@code owner.id} through that alias
     * rather than through the implicit path {@code item.owner.id}. Both work, but only this
     * form is obviously one join: an implicit path in a WHERE clause is an inner join unless
     * Hibernate folds it into the FK column, and an inner join here would drop every
     * owner-less seeded row — the exact rows that must never disappear.
     */
    @Query("""
            select item from CatalogItemEntity item
            left join fetch item.owner owner
            where item.isPublic = true or owner.id = :userId
            order by item.category asc, item.sortOrder asc, item.name asc
            """)
    List<CatalogItemEntity> findVisibleTo(@Param("userId") UUID userId);
}
