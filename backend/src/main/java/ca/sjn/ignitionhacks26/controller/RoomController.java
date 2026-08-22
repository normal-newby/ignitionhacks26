package ca.sjn.ignitionhacks26.controller;

import ca.sjn.ignitionhacks26.dto.ModelRequest;
import ca.sjn.ignitionhacks26.dto.ModelResponse;
import ca.sjn.ignitionhacks26.dto.RenameRoomRequest;
import ca.sjn.ignitionhacks26.dto.RoomResponse;
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
    public RoomResponse create(@RequestParam(value = "name", required = false) String name,
                               @RequestParam("video") MultipartFile video) {
        try {
            return RoomResponse.from(roomService.createRoom(name, video));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    @GetMapping
    public List<RoomResponse> list() {
        return roomService.listRooms().stream().map(RoomResponse::from).toList();
    }

    /** The editor's single read: room metadata, mesh URLs, and the saved layout. */
    @GetMapping("/{roomId}")
    public RoomResponse get(@PathVariable UUID roomId) {
        return roomService.getRoom(roomId)
                .map(room -> RoomResponse.from(room, modelService.listForRoom(roomId)))
                .orElseThrow(() -> notFound("room"));
    }

    @PatchMapping("/{roomId}")
    public RoomResponse rename(@PathVariable UUID roomId, @RequestBody RenameRoomRequest request) {
        try {
            return roomService.rename(roomId, request.name())
                    .map(RoomResponse::from)
                    .orElseThrow(() -> notFound("room"));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    @DeleteMapping("/{roomId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID roomId) {
        if (!roomService.deleteRoom(roomId)) {
            throw notFound("room");
        }
    }

    @GetMapping("/{roomId}/models")
    public List<ModelResponse> listModels(@PathVariable UUID roomId) {
        return modelService.listForRoom(roomId).stream().map(ModelResponse::from).toList();
    }

    @PostMapping("/{roomId}/models")
    @ResponseStatus(HttpStatus.CREATED)
    public ModelResponse addModel(@PathVariable UUID roomId, @RequestBody ModelRequest request) {
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
    public void clearModels(@PathVariable UUID roomId) {
        if (roomService.getRoom(roomId).isEmpty()) {
            throw notFound("room");
        }
        modelService.deleteAllInRoom(roomId);
    }

    private static ResponseStatusException notFound(String what) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "No such " + what);
    }
}
