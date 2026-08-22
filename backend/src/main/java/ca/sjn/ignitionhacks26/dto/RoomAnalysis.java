package ca.sjn.ignitionhacks26.dto;

import java.util.List;

/**
 * Result of the per-frame vision pass. Gemini is asked to return exactly this shape via a
 * responseSchema — the field descriptions that steer the model live alongside that schema in
 * {@code RoomAnalysisService.RESPONSE_SCHEMA}, so keep the two in step.
 */
public record RoomAnalysis(
        String roomType,
        Integer estimatedSqft,
        List<String> conditionTags,
        Double confidence
) {
    public static final String UNKNOWN_ROOM_TYPE = "unknown";

    public boolean isUsable() {
        return roomType != null
                && !roomType.isBlank()
                && !UNKNOWN_ROOM_TYPE.equalsIgnoreCase(roomType.trim());
    }
}
