package ca.sjn.ignitionhacks26.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

/**
 * One piece of furniture available to place. The catalog used to be a hard-coded list in the
 * frontend's localStorage; it moved here once users could upload their own GLBs, since an
 * upload that only exists in one browser isn't really saved.
 *
 * <p>The binaries themselves are in MinIO — this row holds their public URLs plus the object
 * keys, which are what we need to clean the bucket up on delete.
 *
 * <p>{@link ModelEntity} still snapshots name/category/modelUrl rather than pointing a
 * foreign key here, on purpose: a placed layout should keep rendering even if the catalog
 * entry behind it is later edited or removed.
 */
@Entity
@Data
@AllArgsConstructor
@NoArgsConstructor
@Table(name = "furniture_catalog")
public class CatalogItemEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String category;

    /** Public MinIO URL of the GLB. Null for an entry still waiting on an asset. */
    @Column(name = "model_url", length = 2048)
    private String modelUrl;

    @Column(name = "model_object_key", length = 1024)
    private String modelObjectKey;

    @Column(name = "thumbnail_url", length = 2048)
    private String thumbnailUrl;

    @Column(name = "thumbnail_object_key", length = 1024)
    private String thumbnailObjectKey;

    /** Real-world size in centimetres, shown in the catalog rail and used for initial scale. */
    @Column(name = "width_cm", nullable = false)
    private int widthCm = 50;

    @Column(name = "depth_cm", nullable = false)
    private int depthCm = 50;

    @Column(name = "height_cm", nullable = false)
    private int heightCm = 50;

    /** True for the entries seeded at first boot, false for anything a user uploaded. */
    @Column(name = "built_in", nullable = false)
    private boolean builtIn = false;

    /** Display order within a category; seeded items keep the order they were listed in. */
    @Column(name = "sort_order", nullable = false)
    private int sortOrder = 0;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
