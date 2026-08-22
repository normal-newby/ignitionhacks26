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
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * A property tour as the public site sees it: searchable by address or tag, and
 * pointing at the Marble world once one has been generated.
 *
 * <p>Distinct from {@link ScanEntity}, which tracks a single Marble generation job.
 * A tour is the user-facing listing; the scan is the machinery behind it. The link is
 * optional because a tour is created the moment the video is submitted, before any
 * scan exists.
 */
@Entity
@Data
@AllArgsConstructor
@NoArgsConstructor
@Table(name = "tours")
public class TourEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(nullable = false)
    private String address;

    /** Where the uploaded walk-through video lives. Not served by this app. */
    @Column(name = "video_url", length = 2048)
    private String videoUrl;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "search_tags", columnDefinition = "text[]")
    private List<String> searchTags = new ArrayList<>();

    @Column(name = "estimated_value")
    private Long estimatedValue;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TourStatus status = TourStatus.PROCESSING;

    /** Human-readable progress detail, shown on the processing screen. */
    @Column(columnDefinition = "text")
    private String description;

    /** Mirrored from the linked scan once Marble finishes, so reads need no join. */
    @Column(name = "world_id")
    private String worldId;

    /** Set once world generation has been kicked off for this tour. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "scan_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @JsonIgnore
    private ScanEntity scan;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
