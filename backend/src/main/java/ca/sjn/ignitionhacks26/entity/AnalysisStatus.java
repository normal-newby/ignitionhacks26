package ca.sjn.ignitionhacks26.entity;

/**
 * Lifecycle of the vision-LLM room extraction. Runs independently of Marble generation —
 * rooms usually land well before the 3D world does, so the sidebar can populate first.
 */
public enum AnalysisStatus {
    PENDING,
    RUNNING,
    COMPLETED,
    FAILED
}
