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
import java.util.UUID;

/**
 * One catalog model placed inside a room — this is the user-editable layout, and the only
 * thing in the app the user actually authors.
 *
 * <p>A room holds many of these; each one belongs to exactly one room. Nothing here is
 * extracted from the Marble scan: every model comes from our own catalog and sits on top
 * of the scanned shell.
 *
 * <p>The catalog fields (name, category, modelUrl) are denormalised copies rather than a
 * foreign key. The catalog is a static frontend asset list, not a table, so snapshotting
 * keeps a saved layout renderable even if the catalog is later reshuffled.
 */
@Entity
@Data
@AllArgsConstructor
@NoArgsConstructor
@Table(name = "models")
public class ModelEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "room_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @JsonIgnore
    private RoomEntity room;

    /** Which catalog entry this came from, e.g. "sofa_beige". */
    @Column(name = "catalog_id", nullable = false)
    private String catalogId;

    @Column(nullable = false)
    private String name;

    private String category;

    /** Path to the GLB, served from the frontend's public/models folder. */
    @Column(name = "model_url", length = 2048)
    private String modelUrl;

    @Column(name = "pos_x", nullable = false)
    private double posX;

    @Column(name = "pos_y", nullable = false)
    private double posY;

    @Column(name = "pos_z", nullable = false)
    private double posZ;

    /** Yaw in degrees. Furniture only ever spins about the vertical axis. */
    @Column(name = "rotation_y", nullable = false)
    private double rotationY;

    @Column(nullable = false)
    private double scale = 1.0;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
