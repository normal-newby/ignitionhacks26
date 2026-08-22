package ca.sjn.ignitionhacks26.dto;

/**
 * A guess at one catalog item's real-world size, in centimetres, plus the model's one-line
 * reason for it. Deliberately not persisted: the admin page drops these into the dimension
 * fields and the human still presses Save, so a bad guess is a typo away from fixed rather
 * than something already written to the catalog.
 *
 * <p>Field names match {@code CatalogItemResponse.Dimensions} so the frontend can spread this
 * straight into {@code default_dimensions}.
 */
public record DimensionEstimate(int width, int depth, int height, String note) {}
