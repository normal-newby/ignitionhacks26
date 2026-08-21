package ca.sjn.ignitionhacks26.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Structured room data extracted from the uploaded frames by the vision pass.
 * This is what feeds the sidebar next to the 3D viewer.
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

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "scan_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @JsonIgnore
    private ScanEntity scan;

    @Column(name = "room_type")
    private String roomType;

    @Column(name = "estimated_sqft")
    private Integer estimatedSqft;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "condition_tags", columnDefinition = "text[]")
    private List<String> conditionTags = new ArrayList<>();

    /** Model's self-reported confidence, 0.0–1.0. Used to pick a winner when frames disagree. */
    @Column(name = "confidence")
    private Double confidence;

    /** How many uploaded frames were merged into this room. */
    @Column(name = "frame_count")
    private Integer frameCount;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
