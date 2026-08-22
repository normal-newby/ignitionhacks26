package ca.sjn.ignitionhacks26.dto;

import ca.sjn.ignitionhacks26.entity.ModelEntity;
import ca.sjn.ignitionhacks26.entity.RoomEntity;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * A room as the frontend consumes it. snake_case throughout, because that is what the
 * React pages read.
 *
 * <p>{@code status} is the coarse "processing / ready / failed" the UI switches on;
 * {@code progress_message} carries the detail behind it.
 */
public record RoomResponse(
        UUID id,
        String name,
        String status,
        @JsonProperty("world_id") String worldId,
        @JsonProperty("collider_mesh_url") String colliderMeshUrl,
        @JsonProperty("splat_url") String splatUrl,
        @JsonProperty("splat_url_full_res") String splatUrlFullRes,
        @JsonProperty("thumbnail_url") String thumbnailUrl,
        @JsonProperty("pano_url") String panoUrl,
        @JsonProperty("world_marble_url") String worldMarbleUrl,
        String caption,
        @JsonProperty("ground_plane_offset") Double groundPlaneOffset,
        @JsonProperty("metric_scale_factor") Double metricScaleFactor,
        @JsonProperty("progress_message") String progressMessage,
        @JsonProperty("error_message") String errorMessage,
        @JsonProperty("created_at") Instant createdAt,
        @JsonProperty("updated_at") Instant updatedAt,
        List<ModelResponse> models
) {

    /** Summary form for the project grid — no need to ship the layout with every card. */
    public static RoomResponse from(RoomEntity room) {
        return from(room, List.of());
    }

    public static RoomResponse from(RoomEntity room, List<ModelEntity> models) {
        return new RoomResponse(
                room.getId(),
                room.getName(),
                room.getStatus().wireValue(),
                room.getWorldId(),
                room.getColliderMeshUrl(),
                room.getSplatUrl(),
                room.getSplatUrlFullRes(),
                room.getThumbnailUrl(),
                room.getPanoUrl(),
                room.getWorldMarbleUrl(),
                room.getCaption(),
                room.getGroundPlaneOffset(),
                room.getMetricScaleFactor(),
                room.getProgressMessage(),
                room.getErrorMessage(),
                room.getCreatedAt(),
                room.getUpdatedAt(),
                models.stream().map(ModelResponse::from).toList()
        );
    }
}
