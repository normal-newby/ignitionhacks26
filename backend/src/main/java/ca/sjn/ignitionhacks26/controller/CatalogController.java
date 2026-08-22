package ca.sjn.ignitionhacks26.controller;

import ca.sjn.ignitionhacks26.dto.CatalogItemResponse;
import ca.sjn.ignitionhacks26.dto.DimensionEstimate;
import ca.sjn.ignitionhacks26.service.CatalogService;
import ca.sjn.ignitionhacks26.service.CatalogService.CatalogItemInput;
import ca.sjn.ignitionhacks26.service.DimensionEstimator;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

/**
 * Backs src/api/catalog.js. Writes are multipart because the GLB and its thumbnail arrive
 * with the metadata in one request — the browser never talks to MinIO directly, so there's
 * no presigned-URL round trip to coordinate.
 */
@RestController
@RequestMapping("/api/catalog")
public class CatalogController {

    private final CatalogService catalogService;
    private final DimensionEstimator dimensionEstimator;

    public CatalogController(CatalogService catalogService, DimensionEstimator dimensionEstimator) {
        this.catalogService = catalogService;
        this.dimensionEstimator = dimensionEstimator;
    }

    @GetMapping
    public List<CatalogItemResponse> list() {
        return catalogService.list().stream().map(CatalogItemResponse::from).toList();
    }

    @GetMapping("/categories")
    public List<String> categories() {
        return CatalogService.CATEGORIES;
    }

    /**
     * Guesses the item's real-world size from its name, category and — if the admin has picked
     * one — its thumbnail. Reads nothing and writes nothing: the numbers go back to the form,
     * and the ordinary create/update below is what saves them.
     *
     * <p>Multipart to match the rest of this controller, since the interesting input is a file.
     */
    @PostMapping(value = "/estimate-dimensions", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public DimensionEstimate estimateDimensions(
            @RequestParam("name") String name,
            @RequestParam(value = "category", required = false) String category,
            @RequestParam(value = "thumbnail", required = false) MultipartFile thumbnail) {
        try {
            return dimensionEstimator.estimate(name, category, thumbnail);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        } catch (IllegalStateException e) {
            // Gemini unconfigured, unreachable, or unhelpful — the request itself was fine, and
            // the admin can still type the numbers in.
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, e.getMessage());
        }
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public CatalogItemResponse create(
            @RequestParam("name") String name,
            @RequestParam("category") String category,
            @RequestParam(value = "width", required = false) Integer width,
            @RequestParam(value = "depth", required = false) Integer depth,
            @RequestParam(value = "height", required = false) Integer height,
            @RequestParam(value = "model", required = false) MultipartFile model,
            @RequestParam(value = "thumbnail", required = false) MultipartFile thumbnail) {
        try {
            return CatalogItemResponse.from(catalogService.create(
                    new CatalogItemInput(name, category, width, depth, height), model, thumbnail));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        } catch (IllegalStateException e) {
            // Storage unconfigured or unreachable — the client's request was fine.
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, e.getMessage());
        }
    }

    /** Partial: omitted fields and omitted files both mean "leave alone". */
    @PatchMapping(value = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public CatalogItemResponse update(
            @PathVariable UUID id,
            @RequestParam(value = "name", required = false) String name,
            @RequestParam(value = "category", required = false) String category,
            @RequestParam(value = "width", required = false) Integer width,
            @RequestParam(value = "depth", required = false) Integer depth,
            @RequestParam(value = "height", required = false) Integer height,
            @RequestParam(value = "model", required = false) MultipartFile model,
            @RequestParam(value = "thumbnail", required = false) MultipartFile thumbnail) {
        try {
            return catalogService.update(id, new CatalogItemInput(name, category, width, depth, height),
                            model, thumbnail)
                    .map(CatalogItemResponse::from)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No such catalog item"));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        if (!catalogService.delete(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No such catalog item");
        }
    }
}
