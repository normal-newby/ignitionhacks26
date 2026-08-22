package ca.sjn.ignitionhacks26.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/** Body of POST /api/tours, sent by the publish form. */
public record PublishTourRequest(
        String address,
        @JsonProperty("video_url") String videoUrl,
        @JsonProperty("search_tags") List<String> searchTags,
        @JsonProperty("estimated_value") Long estimatedValue
) {}
