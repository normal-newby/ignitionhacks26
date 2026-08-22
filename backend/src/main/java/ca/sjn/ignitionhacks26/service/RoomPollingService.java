package ca.sjn.ignitionhacks26.service;

import ca.sjn.ignitionhacks26.config.MarbleProperties;
import ca.sjn.ignitionhacks26.dto.MarbleOperation;
import ca.sjn.ignitionhacks26.entity.RoomEntity;
import ca.sjn.ignitionhacks26.entity.RoomStatus;
import ca.sjn.ignitionhacks26.repository.RoomRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Server-side half of the polled UX: walks every in-flight room on a fixed interval and asks
 * Marble whether its operation is done. The frontend polls this app rather than holding a
 * five-minute request open against World Labs.
 */
@Service
public class RoomPollingService {

    private static final Logger log = LoggerFactory.getLogger(RoomPollingService.class);

    private static final List<RoomStatus> IN_FLIGHT = List.of(RoomStatus.GENERATING);

    private final RoomRepository roomRepository;
    private final MarbleClient marbleClient;
    private final RoomService roomService;
    private final MarbleProperties properties;

    public RoomPollingService(RoomRepository roomRepository,
                              MarbleClient marbleClient,
                              RoomService roomService,
                              MarbleProperties properties) {
        this.roomRepository = roomRepository;
        this.marbleClient = marbleClient;
        this.roomService = roomService;
        this.properties = properties;
    }

    /**
     * Deliberately not @Transactional. A read-only transaction here would enclose the
     * RoomService calls below — they'd join it rather than start their own, Hibernate would
     * skip the flush, and every completed job would be silently re-polled forever. The
     * repository read manages its own transaction, and the entities are only read for
     * scalar fields, so nothing here needs one.
     */
    @Scheduled(fixedDelayString = "${marble.poll-interval-ms:15000}", initialDelay = 10_000L)
    public void pollInFlightRooms() {
        List<RoomEntity> rooms = roomRepository.findByStatusInAndOperationIdIsNotNull(IN_FLIGHT);
        if (rooms.isEmpty()) {
            return;
        }

        log.debug("Polling {} in-flight room(s)", rooms.size());
        for (RoomEntity room : rooms) {
            try {
                pollOne(room);
            } catch (Exception e) {
                // Transient Marble errors are expected across a five-minute job; leave the
                // room in flight and retry on the next tick rather than failing it outright.
                log.warn("Poll failed for room {} (operation {}): {}",
                        room.getId(), room.getOperationId(), e.getMessage());
            }
        }
    }

    private void pollOne(RoomEntity room) {
        if (hasTimedOut(room)) {
            long minutes = Duration.ofMillis(properties.getJobTimeoutMs()).toMinutes();
            log.warn("Room {} exceeded the {} minute job timeout — marking failed", room.getId(), minutes);
            roomService.markFailed(room.getId(), "World generation timed out after " + minutes + " minutes");
            return;
        }

        MarbleOperation operation = marbleClient.getOperation(room.getOperationId());
        if (operation == null) {
            return;
        }

        if (!operation.done()) {
            roomService.updateProgress(room.getId(), operation.progressDescription());
            return;
        }

        log.info("Marble operation {} finished for room {}", room.getOperationId(), room.getId());
        roomService.applyCompletedOperation(room.getId(), operation);
    }

    private boolean hasTimedOut(RoomEntity room) {
        if (room.getCreatedAt() == null) {
            return false;
        }
        return Duration.between(room.getCreatedAt(), Instant.now()).toMillis() > properties.getJobTimeoutMs();
    }
}
