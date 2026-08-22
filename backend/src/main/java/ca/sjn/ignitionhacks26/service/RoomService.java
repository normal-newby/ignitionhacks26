package ca.sjn.ignitionhacks26.service;

import ca.sjn.ignitionhacks26.dto.MarbleAssets;
import ca.sjn.ignitionhacks26.dto.MarbleOperation;
import ca.sjn.ignitionhacks26.entity.RoomEntity;
import ca.sjn.ignitionhacks26.entity.RoomStatus;
import ca.sjn.ignitionhacks26.repository.RoomRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

/**
 * Owns the room record. Every write to a room goes through here so the upload path and the
 * poller share one set of rules about how a room moves between states.
 */
@Service
public class RoomService {

    private static final Logger log = LoggerFactory.getLogger(RoomService.class);

    /** Marble takes jpg/jpeg/png/webp for images and mp4/mov/webm for video. */
    private static final List<String> ALLOWED_VIDEO_EXTENSIONS = List.of("mp4", "mov", "webm");

    private final RoomRepository roomRepository;
    private final RoomGenerationService generationService;

    public RoomService(RoomRepository roomRepository, RoomGenerationService generationService) {
        this.roomRepository = roomRepository;
        this.generationService = generationService;
    }

    /**
     * Upload entry point. Returns as soon as the row exists — the upload to Marble and the
     * ~5 minute generation both happen off-request, and the client polls {@code GET /api/rooms/{id}}.
     *
     * <p>The video is spooled to a temp file before returning: Spring deletes the multipart
     * temp file when the request completes, so the async half needs its own copy.
     */
    public RoomEntity createRoom(String name, MultipartFile video) {
        if (video == null || video.isEmpty()) {
            throw new IllegalArgumentException("A video file is required to scan a room");
        }

        String extension = extensionOf(video.getOriginalFilename());
        if (!ALLOWED_VIDEO_EXTENSIONS.contains(extension)) {
            throw new IllegalArgumentException(
                    "Unsupported video format '" + extension + "'. Use MP4, MOV, or WebM.");
        }

        RoomEntity room = new RoomEntity();
        room.setName(name == null || name.isBlank() ? "Untitled room" : name.trim());
        room.setStatus(RoomStatus.PENDING);
        room.setProgressMessage("Queued for upload.");
        room = roomRepository.save(room);

        File spooled;
        try {
            spooled = File.createTempFile("roomcast-", "." + extension);
            video.transferTo(spooled);
        } catch (IOException e) {
            markFailed(room.getId(), "Could not read the uploaded video: " + e.getMessage());
            throw new UncheckedIOException("Failed to spool the uploaded video to disk", e);
        }

        log.info("Room {} created from {} ({} bytes)", room.getId(), video.getOriginalFilename(), spooled.length());
        generationService.uploadAndGenerate(
                room.getId(), spooled, video.getOriginalFilename(), extension, video.getContentType());

        return room;
    }

    @Transactional(readOnly = true)
    public List<RoomEntity> listRooms() {
        return roomRepository.findAllByOrderByCreatedAtDesc();
    }

    @Transactional(readOnly = true)
    public Optional<RoomEntity> getRoom(UUID roomId) {
        return roomRepository.findById(roomId);
    }

    @Transactional
    public Optional<RoomEntity> rename(UUID roomId, String name) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("A room name is required");
        }
        return roomRepository.findById(roomId).map(room -> {
            room.setName(name.trim());
            return roomRepository.save(room);
        });
    }

    /** Cascades to the room's models. */
    @Transactional
    public boolean deleteRoom(UUID roomId) {
        if (!roomRepository.existsById(roomId)) {
            return false;
        }
        roomRepository.deleteById(roomId);
        return true;
    }

    @Transactional
    public void markUploading(UUID roomId) {
        roomRepository.findById(roomId).ifPresent(room -> {
            room.setStatus(RoomStatus.UPLOADING);
            room.setProgressMessage("Uploading the video to World Labs.");
            roomRepository.save(room);
        });
    }

    /** Called once Marble has accepted the job and handed back an operation to poll. */
    @Transactional
    public void markGenerating(UUID roomId, String mediaAssetId, String operationId) {
        roomRepository.findById(roomId).ifPresent(room -> {
            room.setMediaAssetId(mediaAssetId);
            room.setOperationId(operationId);
            room.setStatus(RoomStatus.GENERATING);
            room.setProgressMessage("Reconstructing the room. This usually takes about 5 minutes.");
            roomRepository.save(room);
        });
    }

    @Transactional
    public void updateProgress(UUID roomId, String message) {
        if (message == null || message.isBlank()) {
            return;
        }
        roomRepository.findById(roomId).ifPresent(room -> {
            if (!message.equals(room.getProgressMessage())) {
                room.setProgressMessage(message);
                roomRepository.save(room);
            }
        });
    }

    @Transactional
    public void markFailed(UUID roomId, String message) {
        roomRepository.findById(roomId).ifPresent(room -> {
            room.setStatus(RoomStatus.FAILED);
            room.setErrorMessage(message);
            roomRepository.save(room);
        });
    }

    /** Applies a finished Marble operation. Called by the poller. */
    @Transactional
    public void applyCompletedOperation(UUID roomId, MarbleOperation operation) {
        RoomEntity room = roomRepository.findById(roomId).orElse(null);
        if (room == null) {
            return;
        }

        if (operation.hasError()) {
            room.setStatus(RoomStatus.FAILED);
            room.setErrorMessage(operation.errorMessage());
            roomRepository.save(room);
            log.warn("Marble reported failure for room {}: {}", roomId, operation.errorMessage());
            return;
        }

        MarbleAssets assets = MarbleAssets.from(operation.response());
        room.setWorldId(assets.worldId());
        room.setColliderMeshUrl(assets.colliderMeshUrl());
        room.setSplatUrl(assets.splatUrl());
        room.setThumbnailUrl(assets.thumbnailUrl());
        room.setPanoUrl(assets.panoUrl());
        room.setWorldMarbleUrl(assets.worldMarbleUrl());
        room.setCaption(assets.caption());
        room.setGroundPlaneOffset(assets.groundPlaneOffset());
        room.setMetricScaleFactor(assets.metricScaleFactor());

        if (assets.hasViewableMesh()) {
            room.setStatus(RoomStatus.READY);
            room.setProgressMessage("The room is ready.");
        } else {
            // Done, but no mesh URL — almost certainly a response-shape mismatch in
            // MarbleAssets rather than a genuine Marble failure, so log the whole payload.
            room.setStatus(RoomStatus.FAILED);
            room.setErrorMessage("Marble finished but returned no collider mesh URL");
            log.error("No collider mesh for room {} in Marble response: {}", roomId, operation.response());
        }
        roomRepository.save(room);
    }

    private static String extensionOf(String filename) {
        if (filename == null || !filename.contains(".")) {
            return "";
        }
        return filename.substring(filename.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
    }
}
