package ca.sjn.ignitionhacks26.dto;

import ca.sjn.ignitionhacks26.entity.CatalogItemEntity;
import ca.sjn.ignitionhacks26.entity.UserEntity;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * A catalog entry as the editor and the admin page consume it. Field names match what the
 * frontend already read from the old localStorage catalog, so the pages didn't have to be
 * reshaped when the data moved to Postgres.
 *
 * <p>Three of these fields are computed per request rather than stored, because the same row
 * means different things to different callers:
 *
 * <ul>
 *   <li>{@code mine} — did I upload it? Drives the catalog's owner filter.
 *   <li>{@code editable} — may I change it? Drives the edit and delete buttons.
 *   <li>{@code built_in} — does it belong to the app rather than to a person?
 * </ul>
 *
 * <p>{@code editable} currently equals {@code mine}, since built-in pieces are read-only to
 * everyone. It stays a separate field rather than collapsing into {@code mine} because the two
 * answer different questions — "did I upload it" and "may I change it" — and they have already
 * diverged once: built-ins used to be editable by anyone. Keeping them apart means a future
 * change to the permission rule is one line in {@code CatalogService.requireEditable} plus one
 * here, with no frontend change at all.
 *
 * <p>That is also why the frontend must not re-derive it. It used to compute
 * {@code mine || built_in} and got it wrong on rows with no owner and a false {@code built_in}
 * column — which a database predating the seeder's flag is full of. The server enforces the
 * rule, so the server reports it.
 */
public record CatalogItemResponse(
        String id,
        String name,
        String category,
        @JsonProperty("thumbnail_url") String thumbnailUrl,
        @JsonProperty("model_asset_url") String modelAssetUrl,
        @JsonProperty("default_dimensions") Dimensions defaultDimensions,
        @JsonProperty("built_in") boolean builtIn,
        @JsonProperty("is_public") boolean isPublic,
        @JsonProperty("owner_name") String ownerName,
        boolean mine,
        boolean editable
) {

    public record Dimensions(int width, int depth, int height) {}

    public static CatalogItemResponse from(CatalogItemEntity item, UserEntity viewer) {
        UserEntity owner = item.getOwner();
        boolean appOwned = owner == null;
        boolean mine = !appOwned && viewer != null && owner.getId().equals(viewer.getId());

        return new CatalogItemResponse(
                item.getId().toString(),
                item.getName(),
                item.getCategory(),
                nullToEmpty(item.getThumbnailUrl()),
                nullToEmpty(item.getModelUrl()),
                new Dimensions(item.getWidthCm(), item.getDepthCm(), item.getHeightCm()),
                // Reported from the owner column, not the stored `built_in` flag. "Belongs to
                // the app" is what the UI actually needs to know, and it's what the service's
                // permission check keys off — whereas the stored flag is only ever true for
                // rows the seeder wrote, so a hand-added owner-less row would read as an
                // upload with a missing uploader.
                appOwned,
                item.isPublic(),
                // App-owned entries read as "Refurnish" rather than blank: the rail shows this
                // next to a piece's name, and an empty byline looks like missing data. It is a
                // display string, not a stored owner — the column stays null.
                appOwned ? "Refurnish" : owner.getDisplayName(),
                mine,
                // Mirrors CatalogService.requireEditable exactly: built-ins are nobody's to
                // change, so only your own uploads are editable.
                mine
        );
    }

    /** The frontend treats "" as "no asset"; keeping nulls out of the JSON avoids a branch there. */
    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }
}
