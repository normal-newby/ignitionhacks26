package ca.sjn.ignitionhacks26.dto;

import ca.sjn.ignitionhacks26.entity.TourEntity;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.UUID;

/**
 * A tour as the frontend consumes it. Field names are snake_case because that is
 * what the React pages read (t.search_tags, tour.world_id, ...).
 */
public record TourResponse(
        UUID id,
        String address,
        @JsonProperty("video_url") String videoUrl,
        @JsonProperty("search_tags") List<String> searchTags,
        @JsonProperty("estimated_value") Long estimatedValue,
        String status,
        @JsonProperty("world_id") String worldId
) {
    public static TourResponse from(TourEntity tour) {
        return new TourResponse(
                tour.getId(),
                tour.getAddress(),
                tour.getVideoUrl(),
                tour.getSearchTags() == null ? List.of() : List.copyOf(tour.getSearchTags()),
                tour.getEstimatedValue(),
                tour.getStatus().wireValue(),
                tour.getWorldId()
        );
    }
}
