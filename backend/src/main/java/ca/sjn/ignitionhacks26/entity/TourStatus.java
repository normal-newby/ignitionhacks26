package ca.sjn.ignitionhacks26.entity;

/**
 * Lifecycle of a published tour. The frontend compares against lowercase strings
 * ("processing" / "published" / "failed"), so DTOs serialize {@link #wireValue()}
 * rather than the enum name.
 */
public enum TourStatus {
    PROCESSING,
    PUBLISHED,
    FAILED;

    public String wireValue() {
        return name().toLowerCase();
    }
}
