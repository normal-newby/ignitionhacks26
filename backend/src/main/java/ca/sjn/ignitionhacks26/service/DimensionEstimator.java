package ca.sjn.ignitionhacks26.service;

import ca.sjn.ignitionhacks26.config.GeminiProperties;
import ca.sjn.ignitionhacks26.dto.DimensionEstimate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Guesses a catalog item's real-world size with Gemini, from its name and category and — when
 * one is supplied — its thumbnail.
 *
 * <p>Why this exists: {@code PlacedModel} scales every GLB so its height matches the catalog
 * entry's {@code height_cm}, which makes the catalog dimensions the thing that sizes a model
 * on screen. An entry left at the default 50×50×50 renders a 50cm sofa. Typing three plausible
 * numbers per item is the sort of chore that gets skipped, and a wrong-by-default number is
 * invisible until the room looks strange.
 *
 * <p>The estimate is never saved from here. It comes back to the admin form, the human sees
 * it, and the existing catalog write is what persists it — see {@link DimensionEstimate}.
 */
@Service
public class DimensionEstimator {

    private static final Logger log = LoggerFactory.getLogger(DimensionEstimator.class);

    private static final ObjectMapper JSON = new ObjectMapper();

    /** Mirrors CatalogService.dimension()'s bounds, so an estimate is always saveable. */
    private static final int MIN_CM = 1;
    private static final int MAX_CM = 10_000;

    private static final String INSTRUCTIONS = """
            You size furniture for a 3D room planner. Given a catalog entry, give the typical \
            real-world dimensions of that piece in centimetres.

            width  = side to side, as the piece faces you
            depth  = front to back
            height = floor to the highest point

            Rules:
            - Answer for a common, mass-market example of the piece, not an outlier.
            - If a reference image is given, let it settle proportions and apparent size; the \
            name and category settle what the piece is.
            - Whole centimetres. Every dimension must be between 1 and 10000.
            - note: one short sentence, under 15 words, saying what you assumed.
            """;

    /**
     * Gemini's structured-output schema. Asking for JSON in the prompt alone gets prose, a
     * code fence, or units in the numbers often enough to matter; this makes the shape the
     * decoder's problem rather than ours.
     */
    private static final Map<String, Object> RESPONSE_SCHEMA = Map.of(
            "type", "OBJECT",
            "properties", Map.of(
                    "width_cm", Map.of("type", "INTEGER"),
                    "depth_cm", Map.of("type", "INTEGER"),
                    "height_cm", Map.of("type", "INTEGER"),
                    "note", Map.of("type", "STRING")),
            "required", List.of("width_cm", "depth_cm", "height_cm", "note"),
            "propertyOrdering", List.of("width_cm", "depth_cm", "height_cm", "note"));

    private final RestClient geminiRestClient;
    private final GeminiProperties properties;

    public DimensionEstimator(@Qualifier("geminiRestClient") RestClient geminiRestClient,
                              GeminiProperties properties) {
        this.geminiRestClient = geminiRestClient;
        this.properties = properties;
    }

    /**
     * @param name      what the piece is called, e.g. "Two-seat linen sofa"
     * @param category  one of {@link CatalogService#CATEGORIES}
     * @param image     optional reference photo, sent inline; may be null or empty
     * @throws IllegalArgumentException when the request itself is unusable
     * @throws IllegalStateException    when Gemini is unconfigured, unreachable or unhelpful
     */
    public DimensionEstimate estimate(String name, String category, MultipartFile image) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Give the item a name before estimating its size");
        }
        if (!properties.hasApiKey()) {
            throw new IllegalStateException(
                    "Dimension estimates are not configured on this server (GEMINI_API_KEY is unset).");
        }

        JsonNode body = call(requestBody(name.trim(), category, image));
        return parse(extractText(body));
    }

    /* ------------------------------------------------------------------ */

    private Map<String, Object> requestBody(String name, String category, MultipartFile image) {
        List<Map<String, Object>> parts = new ArrayList<>();
        parts.add(Map.of("text", INSTRUCTIONS));
        parts.add(Map.of("text", "Catalog entry\nname: " + name
                + "\ncategory: " + (category == null || category.isBlank() ? "unspecified" : category.trim())));

        if (image != null && !image.isEmpty()) {
            parts.add(Map.of("inline_data", Map.of(
                    "mime_type", imageMimeType(image),
                    "data", Base64.getEncoder().encodeToString(imageBytes(image)))));
        }

        Map<String, Object> generationConfig = new LinkedHashMap<>();
        generationConfig.put("responseMimeType", "application/json");
        generationConfig.put("responseSchema", RESPONSE_SCHEMA);
        generationConfig.put("temperature", 0.2);
        // Gemini 3 thinks by default, which is time spent on a question whose answer is recall
        // rather than reasoning, and the admin is watching a spinner. "low" is as far down as
        // it goes: the 2.5-era {"thinkingBudget": 0} is rejected outright by 3.x, and
        // thinkingLevel belongs inside thinkingConfig, not beside it — both were 400s.
        generationConfig.put("thinkingConfig", Map.of("thinkingLevel", "low"));

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("contents", List.of(Map.of("role", "user", "parts", parts)));
        body.put("generationConfig", generationConfig);
        return body;
    }

    private JsonNode call(Map<String, Object> body) {
        try {
            return geminiRestClient.post()
                    .uri("/v1beta/models/{model}:generateContent", properties.getModel())
                    .body(body)
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (request, response) -> {
                        String raw = new String(response.getBody().readAllBytes(), StandardCharsets.UTF_8);
                        throw new IllegalStateException(
                                "The dimension estimator failed: " + geminiErrorMessage(response.getStatusCode().value(), raw));
                    })
                    .body(JsonNode.class);
        } catch (RestClientException e) {
            // Timeouts and DNS failures land here; the estimate is optional, so say so plainly
            // rather than dressing a network problem up as a bad request.
            log.warn("Gemini call failed: {}", e.getMessage());
            throw new IllegalStateException("Could not reach the dimension estimator. Enter the sizes by hand.", e);
        }
    }

    /**
     * Pulls the JSON payload out of the candidate. A response with no candidates is a blocked
     * prompt or a stop before any text — either way there is nothing to read, and the caller
     * needs to hear that rather than a NullPointerException.
     */
    private static String extractText(JsonNode body) {
        JsonNode candidates = body == null ? null : body.get("candidates");
        if (candidates == null || candidates.isEmpty()) {
            throw new IllegalStateException("The dimension estimator returned no answer. Enter the sizes by hand.");
        }

        JsonNode parts = candidates.get(0).path("content").path("parts");
        StringBuilder text = new StringBuilder();
        for (JsonNode part : parts) {
            JsonNode value = part.get("text");
            if (value != null && value.isString()) {
                text.append(value.asString());
            }
        }
        if (text.isEmpty()) {
            throw new IllegalStateException("The dimension estimator returned an empty answer. Enter the sizes by hand.");
        }
        return text.toString();
    }

    private static DimensionEstimate parse(String json) {
        JsonNode node;
        try {
            node = JSON.readTree(json);
        } catch (Exception e) {
            log.warn("Gemini returned unparseable dimensions: {}", json);
            throw new IllegalStateException("The dimension estimate came back malformed. Enter the sizes by hand.", e);
        }

        JsonNode note = node.get("note");
        return new DimensionEstimate(
                centimetres(node, "width_cm"),
                centimetres(node, "depth_cm"),
                centimetres(node, "height_cm"),
                note != null && note.isString() ? note.asString() : "");
    }

    /**
     * Rounds and clamps into the range the catalog accepts. The schema asks for an integer but
     * a decoder can still hand back 87.5, and a value outside 1..10000 would be rejected by
     * {@code CatalogService} on save — better to land the estimate somewhere saveable than to
     * hand the admin a number the next request will refuse.
     */
    private static int centimetres(JsonNode node, String field) {
        JsonNode value = node.get(field);
        if (value == null || !value.isNumber()) {
            throw new IllegalStateException("The dimension estimate was missing " + field + ". Enter the sizes by hand.");
        }
        return Math.clamp(Math.round(value.asDouble()), MIN_CM, MAX_CM);
    }

    private byte[] imageBytes(MultipartFile image) {
        if (image.getSize() > properties.getMaxImageSize().toBytes()) {
            throw new IllegalArgumentException("That image is too large to send to the estimator; the limit is "
                    + properties.getMaxImageSize().toMegabytes() + "MB.");
        }
        try {
            return image.getBytes();
        } catch (IOException e) {
            throw new IllegalArgumentException("Could not read the reference image: " + e.getMessage(), e);
        }
    }

    /**
     * Gemini needs a real image mime type on inline data. Browsers usually send one, but a
     * drag-and-drop from an odd source can arrive as application/octet-stream, so fall back to
     * the extension the same way {@link StorageService} does.
     */
    private static String imageMimeType(MultipartFile image) {
        String declared = image.getContentType();
        if (declared != null && declared.startsWith("image/")) {
            return declared;
        }
        String extension = StorageService.extensionOf(image.getOriginalFilename());
        return switch (extension.toLowerCase(Locale.ROOT)) {
            case "png" -> "image/png";
            case "jpg", "jpeg" -> "image/jpeg";
            case "webp" -> "image/webp";
            default -> throw new IllegalArgumentException(
                    "The estimator needs a PNG, JPEG or WebP reference image.");
        };
    }

    /** Gemini reports errors as {@code {"error": {"message": "..."}}}. */
    private static String geminiErrorMessage(int status, String raw) {
        try {
            JsonNode message = JSON.readTree(raw).path("error").get("message");
            if (message != null && message.isString()) {
                return message.asString();
            }
        } catch (Exception ignored) {
            // Not JSON — fall through to the status.
        }
        return "Gemini returned HTTP " + status;
    }
}
