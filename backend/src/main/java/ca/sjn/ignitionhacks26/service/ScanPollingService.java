package ca.sjn.ignitionhacks26.service;

import ca.sjn.ignitionhacks26.config.MarbleProperties;
import ca.sjn.ignitionhacks26.dto.MarbleOperation;
import ca.sjn.ignitionhacks26.entity.ScanEntity;
import ca.sjn.ignitionhacks26.entity.ScanStatus;
import ca.sjn.ignitionhacks26.repository.ScanRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Server-side half of the polled UX: walks every in-flight scan on a fixed interval and asks
 * Marble whether its operation is done. The frontend polls this app's scan endpoint instead of
 * holding a 5-minute request open.
 */
@Service
public class ScanPollingService {

    private static final Logger log = LoggerFactory.getLogger(ScanPollingService.class);

    private static final List<ScanStatus> IN_FLIGHT = List.of(ScanStatus.PENDING, ScanStatus.GENERATING);

    private final ScanRepository scanRepository;
    private final MarbleClient marbleClient;
    private final ScanService scanService;
    private final MarbleProperties properties;

    public ScanPollingService(ScanRepository scanRepository,
                              MarbleClient marbleClient,
                              ScanService scanService,
                              MarbleProperties properties) {
        this.scanRepository = scanRepository;
        this.marbleClient = marbleClient;
        this.scanService = scanService;
        this.properties = properties;
    }

    @Scheduled(fixedDelayString = "${marble.poll-interval-ms:15000}", initialDelay = 10_000L)
    @Transactional(readOnly = true)
    public void pollInFlightScans() {
        List<ScanEntity> scans = scanRepository.findByStatusInAndOperationIdIsNotNull(IN_FLIGHT);
        if (scans.isEmpty()) {
            return;
        }

        log.debug("Polling {} in-flight scan(s)", scans.size());
        for (ScanEntity scan : scans) {
            try {
                pollOne(scan);
            } catch (Exception e) {
                // Transient Marble errors are expected across a 5-minute job; leave the scan
                // in flight and retry on the next tick rather than failing it outright.
                log.warn("Poll failed for scan {} (operation {}): {}",
                        scan.getId(), scan.getOperationId(), e.getMessage());
            }
        }
    }

    private void pollOne(ScanEntity scan) {
        if (hasTimedOut(scan)) {
            log.warn("Scan {} exceeded the {}ms job timeout — marking failed",
                    scan.getId(), properties.getJobTimeoutMs());
            scanService.markScanFailed(scan.getId(),
                    "World generation timed out after " + Duration.ofMillis(properties.getJobTimeoutMs()).toMinutes()
                            + " minutes");
            return;
        }

        MarbleOperation operation = marbleClient.getOperation(scan.getOperationId());
        if (operation == null || !operation.done()) {
            return;
        }

        log.info("Marble operation {} finished for scan {}", scan.getOperationId(), scan.getId());
        scanService.applyCompletedOperation(scan.getId(), operation);
    }

    private boolean hasTimedOut(ScanEntity scan) {
        if (scan.getCreatedAt() == null) {
            return false;
        }
        return Duration.between(scan.getCreatedAt(), Instant.now()).toMillis() > properties.getJobTimeoutMs();
    }
}
