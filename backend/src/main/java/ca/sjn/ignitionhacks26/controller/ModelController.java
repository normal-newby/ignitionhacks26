package ca.sjn.ignitionhacks26.controller;

import ca.sjn.ignitionhacks26.config.CurrentUser;
import ca.sjn.ignitionhacks26.dto.ModelRequest;
import ca.sjn.ignitionhacks26.dto.ModelResponse;
import ca.sjn.ignitionhacks26.entity.UserEntity;
import ca.sjn.ignitionhacks26.service.ModelService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

/**
 * Edits to an already-placed model. Separate from {@link RoomController} because these are
 * addressed by model id alone — once it exists, the editor doesn't care which room it's in.
 *
 * <p>Ownership still comes from the room, though: a model in somebody else's room answers 404
 * the same way the room itself does.
 */
@RestController
@RequestMapping("/api/models")
public class ModelController {

    private final ModelService modelService;

    public ModelController(ModelService modelService) {
        this.modelService = modelService;
    }

    /** Transform update. Debounced by the frontend to ~500ms after a drag ends. */
    @PatchMapping("/{modelId}")
    public ModelResponse update(@CurrentUser UserEntity user, @PathVariable UUID modelId,
                                @RequestBody ModelRequest request) {
        return modelService.update(user, modelId, request)
                .map(ModelResponse::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No such model"));
    }

    @DeleteMapping("/{modelId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@CurrentUser UserEntity user, @PathVariable UUID modelId) {
        if (!modelService.delete(user, modelId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No such model");
        }
    }
}
