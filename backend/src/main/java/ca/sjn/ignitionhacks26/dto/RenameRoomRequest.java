package ca.sjn.ignitionhacks26.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/** Body for PATCH /api/rooms/{id} — renaming is the only editable field on a room. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record RenameRoomRequest(String name) {
}
