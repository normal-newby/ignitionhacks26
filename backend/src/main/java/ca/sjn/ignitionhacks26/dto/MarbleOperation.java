package ca.sjn.ignitionhacks26.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;

/**
 * Marble's long-running-operation envelope, returned by both worlds:generate and
 * operations/{id}. The payload under {@code response} is kept as a raw JsonNode and mined
 * by {@link ca.sjn.ignitionhacks.dto.MarbleAssets} rather than mapped field-by-field —
 * the exact asset key names aren't confirmed yet.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record MarbleOperation(
        String name,
        @JsonProperty("operation_id") String operationId,
        boolean done,
        JsonNode error,
        JsonNode response
) {

    /** Marble returns the id as either a bare field or the tail of a "operations/{id}" name. */
    public String resolveOperationId() {
        if (operationId != null && !operationId.isBlank()) {
            return operationId;
        }
        if (name != null && name.contains("/")) {
            return name.substring(name.lastIndexOf('/') + 1);
        }
        return name;
    }

    public boolean hasError() {
        return error != null && !error.isNull() && !error.isEmpty();
    }

    public String errorMessage() {
        if (!hasError()) {
            return null;
        }
        JsonNode message = error.get("message");
        return message != null ? message.asText() : error.toString();
    }
}
