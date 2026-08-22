package ca.sjn.ignitionhacks26.dto;

import tools.jackson.databind.JsonNode;

import java.util.Iterator;
import java.util.List;
import java.util.Map;

/**
 * The bits of a completed Marble operation we actually persist.
 *
 * <p>Marble's exact response key names aren't confirmed yet, so rather than a rigid mapping
 * this pulls each asset by searching the response tree for any of several plausible key
 * names. When the real shape is known, the candidate lists below are the only thing to fix.
 */
public record MarbleAssets(
        String worldId,
        String colliderMeshUrl,
        String highQualityMeshUrl,
        String thumbnailUrl,
        String panoramaUrl,
        String caption
) {

    private static final List<String> WORLD_ID_KEYS = List.of("world_id", "worldId", "id");
    private static final List<String> COLLIDER_KEYS =
            List.of("collider_mesh_url", "colliderMeshUrl", "collider_mesh", "colliderMesh", "collider");
    private static final List<String> HIGH_QUALITY_KEYS =
            List.of("high_quality_mesh_url", "highQualityMeshUrl", "high_quality_mesh", "highQualityMesh", "mesh_url");
    private static final List<String> THUMBNAIL_KEYS = List.of("thumbnail_url", "thumbnailUrl", "thumbnail");
    private static final List<String> PANORAMA_KEYS = List.of("panorama_url", "panoramaUrl", "panorama");
    private static final List<String> CAPTION_KEYS = List.of("caption", "description");

    public static MarbleAssets from(JsonNode response) {
        if (response == null || response.isNull()) {
            return new MarbleAssets(null, null, null, null, null, null);
        }
        return new MarbleAssets(
                findString(response, WORLD_ID_KEYS),
                findString(response, COLLIDER_KEYS),
                findString(response, HIGH_QUALITY_KEYS),
                findString(response, THUMBNAIL_KEYS),
                findString(response, PANORAMA_KEYS),
                findString(response, CAPTION_KEYS)
        );
    }

    /** True if we got the one asset the interactive viewer actually needs. */
    public boolean hasViewableMesh() {
        return colliderMeshUrl != null || highQualityMeshUrl != null;
    }

    /**
     * Depth-first search for the first string value under any of {@code keys}. Handles both a
     * flat {@code {"collider_mesh_url": "..."} } and a nested {@code {"assets": {"collider": {"url": "..."}}}}.
     */
    private static String findString(JsonNode node, List<String> keys) {
        if (node == null || node.isNull()) {
            return null;
        }
        if (node.isObject()) {
            for (String key : keys) {
                JsonNode candidate = node.get(key);
                String value = asUrlOrText(candidate);
                if (value != null) {
                    return value;
                }
            }
            Iterator<Map.Entry<String, JsonNode>> fields = node.properties().iterator();
            while (fields.hasNext()) {
                String found = findString(fields.next().getValue(), keys);
                if (found != null) {
                    return found;
                }
            }
        } else if (node.isArray()) {
            for (JsonNode child : node) {
                String found = findString(child, keys);
                if (found != null) {
                    return found;
                }
            }
        }
        return null;
    }

    /** Accepts a plain string, or an object that wraps the value under "url"/"uri"/"href". */
    private static String asUrlOrText(JsonNode candidate) {
        if (candidate == null || candidate.isNull()) {
            return null;
        }
        if (candidate.isString()) {
            return candidate.asString().isBlank() ? null : candidate.asString();
        }
        if (candidate.isObject()) {
            for (String wrapper : List.of("url", "uri", "href", "signed_url")) {
                JsonNode inner = candidate.get(wrapper);
                if (inner != null && inner.isString() && !inner.asString().isBlank()) {
                    return inner.asString();
                }
            }
        }
        return null;
    }
}
