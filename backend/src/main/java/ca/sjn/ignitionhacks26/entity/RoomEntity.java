package ca.sjn.ignitionhacks26.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * One uploaded video → one Marble world → one furnishable room.
 *
 * <p>Metadata only: the video lives in Marble's media-asset store and the meshes stay on
 * World Labs' hosts. This app only ever holds ids and URLs.
 */
@Entity
@Data
@AllArgsConstructor
@NoArgsConstructor
@Table(name = "rooms")
public class RoomEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RoomStatus status = RoomStatus.PENDING;

    /** Marble's handle for the uploaded video, from media-assets:prepare_upload. */
    @Column(name = "media_asset_id")
    private String mediaAssetId;

    /** The long-running operation we poll until the world is built. */
    @Column(name = "operation_id")
    private String operationId;

    @Column(name = "world_id")
    private String worldId;

    /** GLB, ~3-4MB. The base scene the editor loads and layers furniture on top of. */
    @Column(name = "collider_mesh_url", length = 2048)
    private String colliderMeshUrl;

    /** SPZ Gaussian splat, 500k tier — the good-looking option when we want it. */
    @Column(name = "splat_url", length = 2048)
    private String splatUrl;

    @Column(name = "thumbnail_url", length = 2048)
    private String thumbnailUrl;

    @Column(name = "pano_url", length = 2048)
    private String panoUrl;

    /** Marble's own viewer for this world, handy for debugging a bad reconstruction. */
    @Column(name = "world_marble_url", length = 2048)
    private String worldMarbleUrl;

    /** Marble's AI-generated caption for the scene. */
    @Column(columnDefinition = "text")
    private String caption;

    /** Known floor height, straight from Marble. Placement raycasting uses this. */
    @Column(name = "ground_plane_offset")
    private Double groundPlaneOffset;

    /** Multiplier that takes the world into metres, so catalog dimensions read true. */
    @Column(name = "metric_scale_factor")
    private Double metricScaleFactor;

    /** Human-readable progress detail, mirrored from the operation and shown while processing. */
    @Column(name = "progress_message", columnDefinition = "text")
    private String progressMessage;

    @Column(name = "error_message", columnDefinition = "text")
    private String errorMessage;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    /** The furniture placed in this room. One room, many models. */
    @OneToMany(mappedBy = "room", cascade = CascadeType.ALL, orphanRemoval = true)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @JsonIgnore
    private List<ModelEntity> models = new ArrayList<>();

    public void addModel(ModelEntity model) {
        model.setRoom(this);
        models.add(model);
    }

    /** True once the editor has something to render. */
    public boolean hasViewableMesh() {
        return colliderMeshUrl != null && !colliderMeshUrl.isBlank();
    }
}
