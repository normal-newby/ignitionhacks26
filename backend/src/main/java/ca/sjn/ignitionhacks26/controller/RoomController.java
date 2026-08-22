package ca.sjn.ignitionhacks26.controller;

import ca.sjn.ignitionhacks26.config.CurrentUser;
import ca.sjn.ignitionhacks26.dto.ModelRequest;
import ca.sjn.ignitionhacks26.dto.ModelResponse;
import ca.sjn.ignitionhacks26.dto.RenameRoomRequest;
import ca.sjn.ignitionhacks26.dto.RoomResponse;
import ca.sjn.ignitionhacks26.entity.UserEntity;
import ca.sjn.ignitionhacks26.service.ModelService;
import ca.sjn.ignitionhacks26.service.RoomService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

/**
 * Backs src/api/rooms.js. A room is one scanned space; the models under it are its layout.
 *
 * <p>Every endpoint here is scoped to the signed-in account: a room is listed to, opened by,
 * renamed by and deleted by its owner and nobody else. Someone else's room id is a 404, not a
 * 403 — see {@code RoomService.getRoom}.
 */
@RestController
@RequestMapping("/api/rooms")
public class RoomController {

    private final RoomService roomService;
    private final ModelService modelService;

    public RoomController(RoomService roomService, ModelService modelService) {
        this.roomService = roomService;
        this.modelService = modelService;
    }

    /**
     * Upload a room-scan video. Returns as soon as the row exists, with status "processing" —
     * the upload to World Labs and the ~5 minute reconstruction both run off-request.
     */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public RoomResponse create(@CurrentUser UserEntity user,
                               @RequestParam(value = "name", required = false) String name,
                               @RequestParam("video") MultipartFile video) {
        try {
            return RoomResponse.from(roomService.createRoom(user, name, video));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    @GetMapping
    public List<RoomResponse> list(@CurrentUser UserEntity user) {
        return roomService.listRooms(user).stream().map(RoomResponse::from).toList();
    }

    /** The editor's single read: room metadata, mesh URLs, and the saved layout. */
    @GetMapping("/{roomId}")
    public RoomResponse get(@CurrentUser UserEntity user, @PathVariable UUID roomId) {
        return roomService.getRoom(user, roomId)
                .map(room -> RoomResponse.from(room, modelService.listForRoom(roomId)))
                .orElseThrow(() -> notFound("room"));
    }

    @PatchMapping("/{roomId}")
    public RoomResponse rename(@CurrentUser UserEntity user, @PathVariable UUID roomId,
                               @RequestBody RenameRoomRequest request) {
        try {
            return roomService.rename(user, roomId, request.name())
                    .map(RoomResponse::from)
                    .orElseThrow(() -> notFound("room"));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    @DeleteMapping("/{roomId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@CurrentUser UserEntity user, @PathVariable UUID roomId) {
        if (!roomService.deleteRoom(user, roomId)) {
            throw notFound("room");
        }
    }

    @GetMapping("/{roomId}/models")
    public List<ModelResponse> listModels(@CurrentUser UserEntity user, @PathVariable UUID roomId) {
        requireOwnRoom(user, roomId);
        return modelService.listForRoom(roomId).stream().map(ModelResponse::from).toList();
    }

    @PostMapping("/{roomId}/models")
    @ResponseStatus(HttpStatus.CREATED)
    public ModelResponse addModel(@CurrentUser UserEntity user, @PathVariable UUID roomId,
                                  @RequestBody ModelRequest request) {
        requireOwnRoom(user, roomId);
        try {
            return modelService.addToRoom(roomId, request)
                    .map(ModelResponse::from)
                    .orElseThrow(() -> notFound("room"));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    /** Clears the whole layout — the editor's "reset room". */
    @DeleteMapping("/{roomId}/models")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void clearModels(@CurrentUser UserEntity user, @PathVariable UUID roomId) {
        requireOwnRoom(user, roomId);
        modelService.deleteAllInRoom(roomId);
    }

    /** The layout endpoints inherit the room's ownership — there is no separate rule for them. */
    private void requireOwnRoom(UserEntity user, UUID roomId) {
        if (roomService.getRoom(user, roomId).isEmpty()) {
            throw notFound("room");
        }
    }

    private static ResponseStatusException notFound(String what) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "No such " + what);
    }
}
