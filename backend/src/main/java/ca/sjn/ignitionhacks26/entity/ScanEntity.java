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
 * One upload → one Marble world. Metadata only: mesh binaries stay on World Labs'
 * hosts and the frontend loads them straight from these URLs.
 */
@Entity
@Data
@AllArgsConstructor
@NoArgsConstructor
@Table(name = "scans")
public class ScanEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    /** Free-form reference to whoever/whatever this scan belongs to. */
    @Column(name = "property_ref")
    private String propertyRef;

    @Column(name = "world_id")
    private String worldId;

    @Column(name = "operation_id")
    private String operationId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ScanStatus status = ScanStatus.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(name = "analysis_status", nullable = false)
    private AnalysisStatus analysisStatus = AnalysisStatus.PENDING;

    @Column(name = "collider_mesh_url", length = 2048)
    private String colliderMeshUrl;

    @Column(name = "high_quality_mesh_url", length = 2048)
    private String highQualityMeshUrl;

    @Column(name = "thumbnail_url", length = 2048)
    private String thumbnailUrl;

    @Column(name = "panorama_url", length = 2048)
    private String panoramaUrl;

    /** Marble's AI-generated caption for the world. */
    @Column(columnDefinition = "text")
    private String caption;

    @Column(name = "frame_count")
    private Integer frameCount;

    @Column(name = "error_message", columnDefinition = "text")
    private String errorMessage;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    @OneToMany(mappedBy = "scan", cascade = CascadeType.ALL, orphanRemoval = true)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @JsonIgnore
    private List<RoomEntity> rooms = new ArrayList<>();

    public void addRoom(RoomEntity room) {
        room.setScan(this);
        rooms.add(room);
    }
}
