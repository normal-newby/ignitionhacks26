package ca.sjn.ignitionhacks26.service;

import ca.sjn.ignitionhacks26.config.MarbleProperties;
import ca.sjn.ignitionhacks26.dto.MarbleOperation;
import ca.sjn.ignitionhacks26.dto.MediaAssetUpload;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.File;
import java.util.UUID;

/**
 * The off-request half of an upload: push the video to Marble's media store, then ask for a
 * world. Split out from {@link RoomService} so {@code @Async} actually goes through a proxy —
 * a self-invoked async method would just run inline on the request thread.
 */
@Service
public class RoomGenerationService {

    private static final Logger log = LoggerFactory.getLogger(RoomGenerationService.class);

    private final MarbleClient marbleClient;
    private final RoomService roomService;
    private final MarbleProperties properties;

    // @Lazy breaks the RoomService <-> RoomGenerationService cycle: RoomService kicks this
    // off, and this calls back into RoomService to record each state change.
    public RoomGenerationService(MarbleClient marbleClient,
                                 @Lazy RoomService roomService,
                                 MarbleProperties properties) {
        this.marbleClient = marbleClient;
        this.roomService = roomService;
        this.properties = properties;
    }

    @Async
    public void uploadAndGenerate(UUID roomId, File video, String originalName, String extension, String contentType) {
        try {
            if (!properties.hasApiKey()) {
                roomService.markFailed(roomId, "WORLD_LABS_API_KEY is not configured on the server");
                return;
            }

            roomService.markUploading(roomId);

            String fileName = originalName == null || originalName.isBlank()
                    ? roomId + "." + extension
                    : originalName;

            MediaAssetUpload prepared = marbleClient.prepareVideoUpload(fileName, extension);
            if (prepared == null || prepared.mediaAssetId() == null || prepared.uploadInfo() == null) {
                roomService.markFailed(roomId, "World Labs did not return an upload slot for the video");
                return;
            }

            marbleClient.uploadMedia(
                    prepared.uploadInfo(),
                    video,
                    contentType == null || contentType.isBlank() ? "video/" + extension : contentType);

            MarbleOperation operation =
                    marbleClient.generateFromVideoAsset(roomNameFor(roomId), prepared.mediaAssetId());
            if (operation == null || operation.operationId() == null) {
                roomService.markFailed(roomId, "World Labs accepted the video but returned no operation to track");
                return;
            }

            roomService.markGenerating(roomId, prepared.mediaAssetId(), operation.operationId());
            log.info("Room {} is now Marble operation {}", roomId, operation.operationId());
        } catch (Exception e) {
            log.error("World generation failed for room {}", roomId, e);
            roomService.markFailed(roomId, "Could not start world generation: " + e.getMessage());
        } finally {
            if (!video.delete()) {
                video.deleteOnExit();
            }
        }
    }

    /** Marble shows display_name in its own dashboard, so give it something recognisable. */
    private String roomNameFor(UUID roomId) {
        return roomService.getRoom(roomId).map(room -> room.getName()).orElse("Roomcast scan");
    }
}
