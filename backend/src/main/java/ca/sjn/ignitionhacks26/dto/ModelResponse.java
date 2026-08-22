package ca.sjn.ignitionhacks26.dto;

import ca.sjn.ignitionhacks26.entity.ModelEntity;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.UUID;

/** A placed model as the editor consumes it. */
public record ModelResponse(
        UUID id,
        @JsonProperty("room_id") UUID roomId,
        @JsonProperty("catalog_id") String catalogId,
        String name,
        String category,
        @JsonProperty("model_url") String modelUrl,
        @JsonProperty("pos_x") double posX,
        @JsonProperty("pos_y") double posY,
        @JsonProperty("pos_z") double posZ,
        @JsonProperty("rotation_y") double rotationY,
        double scale
) {

    public static ModelResponse from(ModelEntity model) {
        return new ModelResponse(
                model.getId(),
                model.getRoom().getId(),
                model.getCatalogId(),
                model.getName(),
                model.getCategory(),
                model.getModelUrl(),
                model.getPosX(),
                model.getPosY(),
                model.getPosZ(),
                model.getRotationY(),
                model.getScale()
        );
    }
}
