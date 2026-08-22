package ca.sjn.ignitionhacks26.service;

import ca.sjn.ignitionhacks26.config.MarbleProperties;
import ca.sjn.ignitionhacks26.dto.MarbleAssets;
import ca.sjn.ignitionhacks26.dto.MarbleOperation;
import ca.sjn.ignitionhacks26.entity.RoomEntity;
import ca.sjn.ignitionhacks26.entity.RoomStatus;
import ca.sjn.ignitionhacks26.repository.RoomRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

/**
 * Fills in the SPZ tiers for rooms generated before we started storing all of them.
 *
 * <p>Marble publishes the splat at three detail levels but the tiers have unrelated file
 * names — spelling {@code _100k} or {@code _full_res} into the 500k URL just 404s — so a room
 * that only kept one URL has no way to reach the others locally. The operation id is still on
 * the row though, and operations stay readable after they complete, so the rest can simply be
 * fetched back. No regeneration, and none of the ~5 minutes that would cost.
 *
 * <p>Runs once at startup and only for rooms that are actually missing something. Failures are
 * logged and left alone: a room keeps working on its 500k splat, and the next boot tries
 * again.
 */
@Component
public class SplatBackfillService implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SplatBackfillService.class);

    private final RoomRepository roomRepository;
    private final MarbleClient marbleClient;
    private final MarbleProperties marbleProperties;

    public SplatBackfillService(RoomRepository roomRepository,
                                MarbleClient marbleClient,
                                MarbleProperties marbleProperties) {
        this.roomRepository = roomRepository;
        this.marbleClient = marbleClient;
        this.marbleProperties = marbleProperties;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!marbleProperties.hasApiKey()) {
            return;
        }

        List<RoomEntity> pending =
                roomRepository.findByStatusAndOperationIdIsNotNullAndSplatUrlFullResIsNull(RoomStatus.READY);
        if (pending.isEmpty()) {
            return;
        }

        log.info("Backfilling splat tiers for {} room(s)", pending.size());
        int filled = 0;
        for (RoomEntity room : pending) {
            if (backfill(room)) {
                filled++;
            }
        }
        log.info("Splat backfill complete: {} of {} room(s) updated", filled, pending.size());
    }

    /**
     * Re-reads one room's operation and stores whatever tiers it turns up.
     *
     * <p>No {@code @Transactional} here on purpose: this is called from {@link #run} on the
     * same bean, so the proxy wouldn't apply it anyway. It doesn't need one — the repository's
     * own {@code save} is a transaction, and a room is a single independent row, so a failure
     * partway through the list leaves the rooms already done correctly saved.
     */
    private boolean backfill(RoomEntity room) {
        UUID roomId = room.getId();
        try {
            MarbleOperation operation = marbleClient.getOperation(room.getOperationId());
            if (operation == null || !operation.done() || operation.hasError()) {
                log.warn("Operation {} for room {} is not readable; leaving its splat tiers alone",
                        room.getOperationId(), roomId);
                return false;
            }

            MarbleAssets assets = MarbleAssets.from(operation.response());
            if (assets.splatUrlFullRes() == null && assets.splatUrl100k() == null) {
                // Nothing to gain, and nothing to stop us asking again next boot — but this
                // world genuinely has one tier, so say so rather than looking broken.
                log.info("Room {} has no additional splat tiers in its operation", roomId);
                return false;
            }

            room.setSplatUrlFullRes(assets.splatUrlFullRes());
            room.setSplatUrl100k(assets.splatUrl100k());
            // An older row may predate the 500k column being populated too.
            if (room.getSplatUrl() == null) {
                room.setSplatUrl(assets.splatUrl());
            }
            roomRepository.save(room);

            log.info("Room {} backfilled: full_res={}, 100k={}", roomId,
                    assets.splatUrlFullRes() != null, assets.splatUrl100k() != null);
            return true;
        } catch (Exception e) {
            log.warn("Could not backfill splat tiers for room {}: {}", roomId, e.getMessage());
            return false;
        }
    }
}
