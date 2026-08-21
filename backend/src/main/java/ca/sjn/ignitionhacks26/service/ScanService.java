package ca.sjn.ignitionhacks26.service;

import ca.sjn.ignitionhacks26.dto.MarbleAssets;
import ca.sjn.ignitionhacks26.dto.MarbleOperation;
import ca.sjn.ignitionhacks26.dto.UploadedFrame;
import ca.sjn.ignitionhacks26.entity.AnalysisStatus;
import ca.sjn.ignitionhacks26.entity.RoomEntity;
import ca.sjn.ignitionhacks26.entity.ScanEntity;
import ca.sjn.ignitionhacks26.entity.ScanStatus;
import ca.sjn.ignitionhacks26.repository.RoomRepository;
import ca.sjn.ignitionhacks26.repository.ScanRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Owns the scan record: creating it, kicking off both pipelines, and applying Marble results.
 * All write paths go through here so the poller and the vision pass share one set of rules.
 */
@Service
public class ScanService {

    private static final Logger log = LoggerFactory.getLogger(ScanService.class);

    private final ScanRepository scanRepository;
    private final RoomRepository roomRepository;
    private final MarbleClient marbleClient;
    private final RoomAnalysisService roomAnalysisService;

    // @Lazy breaks the ScanService <-> RoomAnalysisService cycle: this service kicks the
    // analysis off, and the analysis calls back here to persist its results.
    public ScanService(ScanRepository scanRepository,
                       RoomRepository roomRepository,
                       MarbleClient marbleClient,
                       @Lazy RoomAnalysisService roomAnalysisService) {
        this.scanRepository = scanRepository;
        this.roomRepository = roomRepository;
        this.marbleClient = marbleClient;
        this.roomAnalysisService = roomAnalysisService;
    }

    /**
     * Upload entry point. Returns as soon as Marble has accepted the job — the ~5 minute
     * generation is picked up by {@link ScanPollingService}, and the vision pass runs in
     * parallel on the same frames.
     */
    @Transactional
    public ScanEntity createScan(String propertyRef, List<UploadedFrame> frames) {
        if (frames == null || frames.isEmpty()) {
            throw new IllegalArgumentException("At least one frame is required to generate a world");
        }

        ScanEntity scan = new ScanEntity();
        scan.setPropertyRef(propertyRef);
        scan.setStatus(ScanStatus.PENDING);
        scan.setAnalysisStatus(AnalysisStatus.PENDING);
        scan.setFrameCount(frames.size());
        scan = scanRepository.save(scan);

        try {
            MarbleOperation operation = marbleClient.generateWorld(frames);
            scan.setOperationId(operation.resolveOperationId());
            scan.setStatus(ScanStatus.GENERATING);
            log.info("Scan {} accepted by Marble as operation {}", scan.getId(), scan.getOperationId());
        } catch (Exception e) {
            log.error("Marble generation request failed for scan {}", scan.getId(), e);
            scan.setStatus(ScanStatus.FAILED);
            scan.setErrorMessage("Could not start world generation: " + e.getMessage());
        }
        scan = scanRepository.save(scan);

        // Room data is worth having even when the 3D generation failed.
        roomAnalysisService.analyzeAsync(scan.getId(), frames);

        return scan;
    }

    @Transactional(readOnly = true)
    public Optional<ScanEntity> getScan(UUID scanId) {
        return scanRepository.findById(scanId);
    }

    @Transactional(readOnly = true)
    public List<ScanEntity> listScans() {
        return scanRepository.findAllByOrderByCreatedAtDesc();
    }

    @Transactional(readOnly = true)
    public List<RoomEntity> getRooms(UUID scanId) {
        return roomRepository.findByScanIdOrderByCreatedAtAsc(scanId);
    }

    /** Applies a finished Marble operation. Called by the poller. */
    @Transactional
    public void applyCompletedOperation(UUID scanId, MarbleOperation operation) {
        ScanEntity scan = scanRepository.findById(scanId).orElse(null);
        if (scan == null) {
            return;
        }

        if (operation.hasError()) {
            scan.setStatus(ScanStatus.FAILED);
            scan.setErrorMessage(operation.errorMessage());
            scanRepository.save(scan);
            log.warn("Marble reported failure for scan {}: {}", scanId, operation.errorMessage());
            return;
        }

        MarbleAssets assets = MarbleAssets.from(operation.response());
        scan.setWorldId(assets.worldId());
        scan.setColliderMeshUrl(assets.colliderMeshUrl());
        scan.setHighQualityMeshUrl(assets.highQualityMeshUrl());
        scan.setThumbnailUrl(assets.thumbnailUrl());
        scan.setPanoramaUrl(assets.panoramaUrl());
        scan.setCaption(assets.caption());

        if (assets.hasViewableMesh()) {
            scan.setStatus(ScanStatus.COMPLETED);
        } else {
            // The operation says done but we couldn't find a mesh URL — almost certainly a
            // response-shape mismatch in MarbleAssets rather than a genuine Marble failure.
            scan.setStatus(ScanStatus.FAILED);
            scan.setErrorMessage("Marble operation completed but no mesh URL was found in the response");
            log.error("No mesh URL found for scan {} in Marble response: {}", scanId, operation.response());
        }
        scanRepository.save(scan);
    }

    @Transactional
    public void markScanFailed(UUID scanId, String message) {
        scanRepository.findById(scanId).ifPresent(scan -> {
            scan.setStatus(ScanStatus.FAILED);
            scan.setErrorMessage(message);
            scanRepository.save(scan);
        });
    }

    /**
     * Called from the async vision pass. Lives here rather than in RoomAnalysisService so the
     * transaction proxy actually applies — a self-invoked @Transactional method would not open
     * a session, and the lazy rooms collection needs one.
     */
    @Transactional
    public void saveRooms(UUID scanId, List<RoomEntity> rooms) {
        scanRepository.findById(scanId).ifPresent(scan -> {
            rooms.forEach(scan::addRoom);
            scan.setAnalysisStatus(AnalysisStatus.COMPLETED);
            scanRepository.save(scan);
        });
    }

    @Transactional
    public void updateAnalysisStatus(UUID scanId, AnalysisStatus status, String errorMessage) {
        scanRepository.findById(scanId).ifPresent(scan -> {
            scan.setAnalysisStatus(status);
            if (errorMessage != null) {
                scan.setErrorMessage(errorMessage);
            }
            scanRepository.save(scan);
        });
    }
}
