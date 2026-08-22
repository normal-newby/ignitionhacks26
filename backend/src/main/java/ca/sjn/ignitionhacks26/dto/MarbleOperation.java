package ca.sjn.ignitionhacks26.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import tools.jackson.databind.JsonNode;

/**
 * Marble's long-running-operation envelope, returned by both {@code worlds:generate} and
 * {@code operations/{id}}.
 *
 * <p>{@code response} stays a raw JsonNode and is mined by {@link MarbleAssets}: it is a
 * deep asset tree we only want six values out of, and mapping it field-by-field would mean
 * five more records for no gain.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record MarbleOperation(
        @JsonProperty("operation_id") String operationId,
        boolean done,
        JsonNode error,
        JsonNode metadata,
        JsonNode response
) {

    public boolean hasError() {
        return error != null && !error.isNull() && !error.isEmpty();
    }

    public String errorMessage() {
        if (!hasError()) {
            return null;
        }
        if (error.isString()) {
            return error.asString();
        }
        JsonNode message = error.get("message");
        return message != null && message.isString() ? message.asString() : error.toString();
    }

    /** Marble's own wording for what it's currently doing, e.g. "Reconstructing geometry". */
    public String progressDescription() {
        if (metadata == null || metadata.isNull()) {
            return null;
        }
        JsonNode progress = metadata.get("progress");
        if (progress == null || progress.isNull()) {
            return null;
        }
        JsonNode description = progress.get("description");
        return description != null && description.isString() ? description.asString() : null;
    }
}
