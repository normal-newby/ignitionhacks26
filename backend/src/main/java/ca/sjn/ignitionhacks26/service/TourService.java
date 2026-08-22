package ca.sjn.ignitionhacks26.service;

import ca.sjn.ignitionhacks26.dto.PublishTourRequest;
import ca.sjn.ignitionhacks26.dto.UploadedFrame;
import ca.sjn.ignitionhacks26.entity.ScanEntity;
import ca.sjn.ignitionhacks26.entity.ScanStatus;
import ca.sjn.ignitionhacks26.entity.TourEntity;
import ca.sjn.ignitionhacks26.entity.TourStatus;
import ca.sjn.ignitionhacks26.repository.TourRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

/**
 * Read and write paths for tours. The search behaviour here is a direct port of what
 * the frontend used to do in the browser after fetching every tour — the same matching
 * rules, now applied against Postgres.
 */
@Service
public class TourService {

    private static final Logger log = LoggerFactory.getLogger(TourService.class);

    private final TourRepository tourRepository;
    private final ScanService scanService;

    public TourService(TourRepository tourRepository, ScanService scanService) {
        this.tourRepository = tourRepository;
        this.scanService = scanService;
    }

    /**
     * Records the tour immediately so the user gets an id to poll on. World generation
     * is attached separately via {@link #attachScan}; until then the tour sits in
     * PROCESSING.
     */
    @Transactional
    public TourEntity publish(PublishTourRequest request) {
        if (request.address() == null || request.address().isBlank()) {
            throw new IllegalArgumentException("An address is required to publish a tour");
        }

        TourEntity tour = new TourEntity();
        tour.setAddress(request.address().trim());
        tour.setVideoUrl(request.videoUrl());
        tour.setSearchTags(normalizeTags(request.searchTags()));
        tour.setEstimatedValue(request.estimatedValue());
        tour.setStatus(TourStatus.PROCESSING);
        tour.setDescription("Queued for world generation.");

        tour = tourRepository.save(tour);
        log.info("Published tour {} for address '{}'", tour.getId(), tour.getAddress());
        return tour;
    }

    @Transactional
    public Optional<TourEntity> findByAddress(String address) {
        if (address == null || address.isBlank()) {
            return Optional.empty();
        }
        return tourRepository.findFirstByAddressIgnoreCaseOrderByCreatedAtDesc(address.trim())
                .map(this::syncFromScan);
    }

    @Transactional
    public Optional<TourEntity> findById(UUID tourId) {
        return tourRepository.findById(tourId).map(this::syncFromScan);
    }

    /** Published tours carrying the given tag, matched case-insensitively. */
    @Transactional(readOnly = true)
    public List<TourEntity> findByTag(String tag) {
        if (tag == null || tag.isBlank()) {
            return List.of();
        }
        String needle = tag.trim().toLowerCase(Locale.ROOT);
        return publishedTours().stream()
                .filter(tour -> tour.getSearchTags() != null && tour.getSearchTags().stream()
                        .anyMatch(t -> t != null && t.toLowerCase(Locale.ROOT).equals(needle)))
                .toList();
    }

    /**
     * Other published tours in the same city, excluding the address itself. City is the
     * second-to-last comma-separated component ("123 Maple St, Portland, OR 97201" -> "Portland").
     */
    @Transactional(readOnly = true)
    public List<TourEntity> findSimilar(String address) {
        if (address == null || address.isBlank()) {
            return List.of();
        }
        String city = extractCity(address);
        if (city == null) {
            return List.of();
        }
        String cityLower = city.toLowerCase(Locale.ROOT);
        String addressLower = address.trim().toLowerCase(Locale.ROOT);

        return publishedTours().stream()
                .filter(tour -> {
                    String candidate = tour.getAddress().toLowerCase(Locale.ROOT);
                    return candidate.contains(cityLower) && !candidate.equals(addressLower);
                })
                .toList();
    }

    /**
     * Second half of publishing: hands the extracted frames to Marble and links the
     * resulting scan to the tour. From here the scan poller drives everything, and
     * {@link #syncFromScan} surfaces the result on the next status read.
     *
     * <p>Frames arrive already sampled and downscaled by the browser — this app never
     * sees the original video.
     */
    @Transactional
    public Optional<TourEntity> startGeneration(UUID tourId, List<UploadedFrame> frames) {
        return tourRepository.findById(tourId).map(tour -> {
            if (frames == null || frames.isEmpty()) {
                throw new IllegalArgumentException("At least one frame is required to generate a world");
            }

            ScanEntity scan = scanService.createScan(tour.getAddress(), frames);
            tour.setScan(scan);
            tour.setDescription("Generating the 3D world from " + frames.size()
                    + " frames. This usually takes about 5 minutes.");
            log.info("Tour {} linked to scan {} ({} frames)", tour.getId(), scan.getId(), frames.size());

            // createScan may have failed the scan outright (Marble rejected the request);
            // syncFromScan carries that straight through to the tour.
            return syncFromScan(tourRepository.save(tour));
        });
    }

    @Transactional
    public Optional<TourEntity> markFailed(UUID tourId, String reason) {
        return tourRepository.findById(tourId).map(tour -> {
            tour.setStatus(TourStatus.FAILED);
            tour.setDescription(reason);
            return tourRepository.save(tour);
        });
    }

    /**
     * Projects the linked scan's state onto the tour. Called on read so the processing
     * screen reflects Marble progress without needing its own poller — the scan poller
     * already updates the scan row.
     */
    private TourEntity syncFromScan(TourEntity tour) {
        ScanEntity scan = tour.getScan();
        if (scan == null || tour.getStatus() == TourStatus.FAILED) {
            return tour;
        }

        TourStatus previous = tour.getStatus();
        String previousWorldId = tour.getWorldId();

        switch (scan.getStatus()) {
            case COMPLETED -> {
                tour.setStatus(TourStatus.PUBLISHED);
                tour.setWorldId(scan.getWorldId());
                tour.setDescription("The 3D world is ready.");
            }
            case FAILED -> {
                tour.setStatus(TourStatus.FAILED);
                tour.setDescription(scan.getErrorMessage() != null
                        ? scan.getErrorMessage()
                        : "The 3D world could not be generated.");
            }
            case GENERATING -> tour.setDescription("Generating the 3D world. This usually takes about 5 minutes.");
            case PENDING -> tour.setDescription("Queued for world generation.");
        }

        // Only write when something actually moved, so reads stay cheap.
        boolean changed = previous != tour.getStatus()
                || (tour.getWorldId() != null && !tour.getWorldId().equals(previousWorldId));
        return changed ? tourRepository.save(tour) : tour;
    }

    private List<TourEntity> publishedTours() {
        return tourRepository.findByStatusOrderByCreatedAtDesc(TourStatus.PUBLISHED);
    }

    private static String extractCity(String address) {
        List<String> parts = Arrays.stream(address.split(","))
                .map(String::trim)
                .filter(part -> !part.isEmpty())
                .toList();
        if (parts.size() >= 2) {
            return parts.get(parts.size() - 2);
        }
        return parts.size() == 1 ? parts.getFirst() : null;
    }

    private static List<String> normalizeTags(List<String> tags) {
        if (tags == null) {
            return new ArrayList<>();
        }
        return tags.stream()
                .filter(tag -> tag != null && !tag.isBlank())
                .map(String::trim)
                .distinct()
                .collect(java.util.stream.Collectors.toCollection(ArrayList::new));
    }
}
