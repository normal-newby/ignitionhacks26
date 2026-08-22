package ca.sjn.ignitionhacks26.dto;

import ca.sjn.ignitionhacks26.entity.CatalogItemEntity;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * A catalog entry as the editor and the admin page consume it. Field names match what the
 * frontend already read from the old localStorage catalog, so the pages didn't have to be
 * reshaped when the data moved to Postgres.
 */
public record CatalogItemResponse(
        String id,
        String name,
        String category,
        @JsonProperty("thumbnail_url") String thumbnailUrl,
        @JsonProperty("model_asset_url") String modelAssetUrl,
        @JsonProperty("default_dimensions") Dimensions defaultDimensions,
        @JsonProperty("built_in") boolean builtIn
) {

    public record Dimensions(int width, int depth, int height) {}

    public static CatalogItemResponse from(CatalogItemEntity item) {
        return new CatalogItemResponse(
                item.getId().toString(),
                item.getName(),
                item.getCategory(),
                nullToEmpty(item.getThumbnailUrl()),
                nullToEmpty(item.getModelUrl()),
                new Dimensions(item.getWidthCm(), item.getDepthCm(), item.getHeightCm()),
                item.isBuiltIn()
        );
    }

    /** The frontend treats "" as "no asset"; keeping nulls out of the JSON avoids a branch there. */
    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }
}
