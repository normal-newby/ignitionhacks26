package ca.sjn.ignitionhacks26.dto;

import com.fasterxml.jackson.annotation.JsonPropertyDescription;

import java.util.List;

/**
 * Structured-output schema for the per-frame vision pass. The Anthropic SDK derives the JSON
 * schema from this record, so the descriptions below are the prompt for each field.
 */
public record RoomAnalysis(

        @JsonPropertyDescription("The type of room shown, lowercase, e.g. 'kitchen', 'primary bedroom', "
                + "'living room', 'bathroom', 'hallway', 'garage'. Use 'unknown' if the frame is too "
                + "ambiguous or does not show an interior room.")
        String roomType,

        @JsonPropertyDescription("Estimated floor area of the room in square feet, inferred from visible "
                + "furniture and fixtures used as scale references. Null if not estimable.")
        Integer estimatedSqft,

        @JsonPropertyDescription("Short lowercase condition descriptors observed in the frame, e.g. "
                + "'hardwood floors', 'dated cabinets', 'water damage', 'natural light', 'recently renovated'. "
                + "Between 0 and 5 tags.")
        List<String> conditionTags,

        @JsonPropertyDescription("Confidence in the roomType classification, between 0.0 and 1.0.")
        Double confidence
) {
    public static final String UNKNOWN_ROOM_TYPE = "unknown";

    public boolean isUsable() {
        return roomType != null
                && !roomType.isBlank()
                && !UNKNOWN_ROOM_TYPE.equalsIgnoreCase(roomType.trim());
    }
}
