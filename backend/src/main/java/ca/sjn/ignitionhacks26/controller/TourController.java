package ca.sjn.ignitionhacks26.controller;

import ca.sjn.ignitionhacks26.dto.PublishTourRequest;
import ca.sjn.ignitionhacks26.dto.PublishTourResponse;
import ca.sjn.ignitionhacks26.dto.TourResponse;
import ca.sjn.ignitionhacks26.dto.TourStatusResponse;
import ca.sjn.ignitionhacks26.dto.UploadedFrame;
import ca.sjn.ignitionhacks26.entity.TourEntity;
import ca.sjn.ignitionhacks26.service.TourService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Backs src/api/tours.js. Every response shape here is dictated by what the React
 * pages already read, so the frontend's function signatures stay unchanged.
 */
@RestController
@RequestMapping("/api/tours")
public class TourController {

    private final TourService tourService;

    public TourController(TourService tourService) {
        this.tourService = tourService;
    }

    /** 404 rather than a null body, so the client can map it cleanly to "no tour". */
    @GetMapping("/search")
    public TourResponse searchByAddress(@RequestParam String address) {
        return tourService.findByAddress(address)
                .map(TourResponse::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No tour for that address"));
    }

    @GetMapping
    public List<TourResponse> searchByTag(@RequestParam String tag) {
        return tourService.findByTag(tag).stream().map(TourResponse::from).toList();
    }

    @GetMapping("/similar")
    public List<TourResponse> similar(@RequestParam String address) {
        return tourService.findSimilar(address).stream().map(TourResponse::from).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PublishTourResponse publish(@RequestBody PublishTourRequest request) {
        try {
            TourEntity tour = tourService.publish(request);
            return new PublishTourResponse(tour.getId());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    /**
     * Frames for a tour, sampled and downscaled in the browser. Kicks off Marble
     * generation; the client then polls {@code /status}.
     */
    @PostMapping(value = "/{tourId}/frames", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public TourStatusResponse uploadFrames(@PathVariable UUID tourId,
                                           @RequestParam("frames") List<MultipartFile> frames) {
        List<UploadedFrame> uploaded = new ArrayList<>(frames.size());
        for (MultipartFile file : frames) {
            if (file.isEmpty()) {
                continue;
            }
            try {
                uploaded.add(UploadedFrame.from(file));
            } catch (IOException e) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Could not read frame " + file.getOriginalFilename(), e);
            }
        }

        try {
            return tourService.startGeneration(tourId, uploaded)
                    .map(TourStatusResponse::from)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No such tour"));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    @GetMapping("/{tourId}/status")
    public TourStatusResponse status(@PathVariable UUID tourId) {
        return tourService.findById(tourId)
                .map(TourStatusResponse::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No such tour"));
    }

    @GetMapping("/{tourId}")
    public TourResponse get(@PathVariable UUID tourId) {
        return tourService.findById(tourId)
                .map(TourResponse::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No such tour"));
    }
}
