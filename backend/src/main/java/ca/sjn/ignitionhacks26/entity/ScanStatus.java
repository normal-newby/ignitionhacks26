package ca.sjn.ignitionhacks26.entity;

/**
 * Lifecycle of the Marble world-generation job for a scan.
 * Generation takes ~5 minutes, so everything past PENDING is driven by the poller.
 */
public enum ScanStatus {
    PENDING,
    GENERATING,
    COMPLETED,
    FAILED
}
