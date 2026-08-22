package ca.sjn.ignitionhacks26.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Body for adding a model to a room and for patching one. snake_case to match what the
 * React editor sends.
 *
 * <p>Every transform field is boxed so a PATCH can leave the others untouched — the editor
 * debounces drags and sends just the axis that changed.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ModelRequest(
        @JsonProperty("catalog_id") String catalogId,
        String name,
        String category,
        @JsonProperty("model_url") String modelUrl,
        @JsonProperty("pos_x") Double posX,
        @JsonProperty("pos_y") Double posY,
        @JsonProperty("pos_z") Double posZ,
        @JsonProperty("rotation_y") Double rotationY,
        Double scale
) {
}
