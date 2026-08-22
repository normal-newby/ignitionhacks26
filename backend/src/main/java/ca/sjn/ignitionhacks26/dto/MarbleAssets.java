package ca.sjn.ignitionhacks26.dto;

import tools.jackson.databind.JsonNode;

/**
 * The bits of a completed Marble operation we persist, pulled out of
 * {@code operation.response}:
 *
 * <pre>
 * { "id": ..., "display_name": ..., "world_marble_url": ...,
 *   "assets": { "caption": ...,
 *               "thumbnail_url": ...,
 *               "mesh":    { "collider_mesh_url": ... },
 *               "imagery": { "pano_url": ... },
 *               "splats":  { "spz_urls": { "100k": ..., "500k": ..., "full_res": ... },
 *                            "semantics_metadata": { "metric_scale_factor": ...,
 *                                                    "ground_plane_offset": ... } } } }
 * </pre>
 */
public record MarbleAssets(
        String worldId,
        String colliderMeshUrl,
        String splatUrl,
        String splatUrl100k,
        String splatUrlFullRes,
        String thumbnailUrl,
        String panoUrl,
        String worldMarbleUrl,
        String caption,
        Double groundPlaneOffset,
        Double metricScaleFactor
) {

    private static final MarbleAssets EMPTY =
            new MarbleAssets(null, null, null, null, null, null, null, null, null, null, null);

    public static MarbleAssets from(JsonNode response) {
        if (response == null || response.isNull()) {
            return EMPTY;
        }

        JsonNode assets = path(response, "assets");
        JsonNode splats = path(assets, "splats");
        JsonNode semantics = path(splats, "semantics_metadata");

        JsonNode spzUrls = path(splats, "spz_urls");

        return new MarbleAssets(
                text(response, "id"),
                text(path(assets, "mesh"), "collider_mesh_url"),
                // 500k is the middle tier and the default: good enough to look at, small
                // enough to stream. The other two are kept so the editor can trade detail
                // against download size without us having to ask Marble again — the tiers
                // have unrelated file names, so one URL can't be derived from another.
                text(spzUrls, "500k"),
                text(spzUrls, "100k"),
                text(spzUrls, "full_res"),
                text(assets, "thumbnail_url"),
                text(path(assets, "imagery"), "pano_url"),
                text(response, "world_marble_url"),
                text(assets, "caption"),
                number(semantics, "ground_plane_offset"),
                number(semantics, "metric_scale_factor")
        );
    }

    /** True if we got the one asset the editor actually needs to render a room. */
    public boolean hasViewableMesh() {
        return colliderMeshUrl != null && !colliderMeshUrl.isBlank();
    }

    private static JsonNode path(JsonNode node, String field) {
        if (node == null || node.isNull()) {
            return null;
        }
        JsonNode child = node.get(field);
        return child == null || child.isNull() ? null : child;
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = path(node, field);
        if (value == null || !value.isString() || value.asString().isBlank()) {
            return null;
        }
        return value.asString();
    }

    private static Double number(JsonNode node, String field) {
        JsonNode value = path(node, field);
        return value != null && value.isNumber() ? value.asDouble() : null;
    }
}
