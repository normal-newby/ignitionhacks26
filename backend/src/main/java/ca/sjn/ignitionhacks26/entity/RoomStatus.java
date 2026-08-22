package ca.sjn.ignitionhacks26.entity;

/**
 * Lifecycle of one room scan. Everything past UPLOADING is driven by
 * {@link ca.sjn.ignitionhacks26.service.RoomPollingService}, since Marble generation
 * takes ~5 minutes and no HTTP request is held open for it.
 *
 * <p>The frontend compares against lowercase strings, so DTOs serialize
 * {@link #wireValue()} rather than the enum name.
 */
public enum RoomStatus {
    /** Row created; the video hasn't reached World Labs yet. */
    PENDING,
    /** Streaming the video up to the Marble media-asset store. */
    UPLOADING,
    /** Marble accepted the job and is building the world. */
    GENERATING,
    /** Mesh URLs are on the row and the editor can open. */
    READY,
    FAILED;

    public String wireValue() {
        return switch (this) {
            case READY -> "ready";
            case FAILED -> "failed";
            // The UI only distinguishes "still working" from the two terminal states.
            default -> "processing";
        };
    }
}
