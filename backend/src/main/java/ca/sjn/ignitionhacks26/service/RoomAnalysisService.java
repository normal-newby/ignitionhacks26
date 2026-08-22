package ca.sjn.ignitionhacks26.service;

import ca.sjn.ignitionhacks26.config.GeminiProperties;
import ca.sjn.ignitionhacks26.dto.RoomAnalysis;
import ca.sjn.ignitionhacks26.dto.UploadedFrame;
import ca.sjn.ignitionhacks26.entity.AnalysisStatus;
import ca.sjn.ignitionhacks26.entity.RoomEntity;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * One vision-LLM pass per uploaded frame, then a merge step so ten photos of the same kitchen
 * become one kitchen row instead of ten. Runs async and independently of Marble generation.
 */
@Service
public class RoomAnalysisService {

    private static final Logger log = LoggerFactory.getLogger(RoomAnalysisService.class);

    private static final String SYSTEM_PROMPT = """
            You are analysing a single photo taken during a walkthrough of a residential property.
            Identify the room shown, estimate its floor area, and note its visible condition.

            Estimate square footage by using known-size objects in frame as references: a standard
            interior door is about 7 feet tall, a kitchen counter about 3 feet, a queen bed about
            5 by 6.7 feet. Reason about the visible floor area, not the whole home.

            Condition tags should describe what is actually visible — materials, finishes, wear,
            light. Do not speculate about anything out of frame. If the photo is an exterior shot,
            a close-up of an object, or otherwise not a room, return roomType "unknown".
            """;

    /**
     * Gemini responseSchema (OpenAPI subset) matching {@link RoomAnalysis}. The descriptions are
     * part of the prompt as far as the model is concerned, so they carry real weight.
     */
    private static final Map<String, Object> RESPONSE_SCHEMA = Map.of(
            "type", "OBJECT",
            "properties", Map.of(
                    "roomType", Map.of(
                            "type", "STRING",
                            "description", "The type of room shown, lowercase, e.g. 'kitchen', "
                                    + "'primary bedroom', 'living room', 'bathroom', 'hallway', 'garage'. "
                                    + "Use 'unknown' if the frame is too ambiguous or does not show an "
                                    + "interior room."),
                    "estimatedSqft", Map.of(
                            "type", "INTEGER",
                            "nullable", true,
                            "description", "Estimated floor area of the room in square feet, inferred from "
                                    + "visible furniture and fixtures used as scale references. Null if not "
                                    + "estimable."),
                    "conditionTags", Map.of(
                            "type", "ARRAY",
                            "items", Map.of("type", "STRING"),
                            "description", "Short lowercase condition descriptors observed in the frame, e.g. "
                                    + "'hardwood floors', 'dated cabinets', 'water damage', 'natural light', "
                                    + "'recently renovated'. Between 0 and 5 tags."),
                    "confidence", Map.of(
                            "type", "NUMBER",
                            "description", "Confidence in the roomType classification, between 0.0 and 1.0.")),
            "required", List.of("roomType", "conditionTags", "confidence"),
            "propertyOrdering", List.of("roomType", "estimatedSqft", "conditionTags", "confidence"));

    private final Optional<RestClient> geminiRestClient;
    private final GeminiProperties properties;
    private final ObjectMapper objectMapper;
    private final ScanService scanService;

    public RoomAnalysisService(@Qualifier("geminiRestClient") Optional<RestClient> geminiRestClient,
                               GeminiProperties properties,
                               ObjectMapper objectMapper,
                               ScanService scanService) {
        this.geminiRestClient = geminiRestClient;
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.scanService = scanService;
    }

    /**
     * Fire-and-forget entry point called right after upload, while Marble is still generating.
     * Frames are held in memory for the duration and never persisted.
     */
    @Async
    public void analyzeAsync(UUID scanId, List<UploadedFrame> frames) {
        if (geminiRestClient.isEmpty()) {
            log.warn("GEMINI_API_KEY not configured — skipping room analysis for scan {}", scanId);
            scanService.updateAnalysisStatus(scanId, AnalysisStatus.FAILED, "Vision model not configured");
            return;
        }

        scanService.updateAnalysisStatus(scanId, AnalysisStatus.RUNNING, null);

        List<UploadedFrame> sampled = frames.size() > properties.getMaxFramesAnalyzed()
                ? frames.subList(0, properties.getMaxFramesAnalyzed())
                : frames;

        List<RoomAnalysis> results = new ArrayList<>();
        for (UploadedFrame frame : sampled) {
            try {
                RoomAnalysis analysis = analyzeFrame(frame);
                if (analysis != null && analysis.isUsable()) {
                    results.add(analysis);
                }
            } catch (Exception e) {
                // One bad frame shouldn't sink the whole sidebar.
                log.warn("Vision pass failed for frame {} on scan {}: {}",
                        frame.filename(), scanId, e.getMessage());
            }
        }

        if (results.isEmpty()) {
            log.warn("No usable room data extracted for scan {}", scanId);
            scanService.updateAnalysisStatus(scanId, AnalysisStatus.FAILED,
                    "No rooms could be identified from the uploaded frames");
            return;
        }

        scanService.saveRooms(scanId, merge(results));
        log.info("Room analysis complete for scan {}", scanId);
    }

    private RoomAnalysis analyzeFrame(UploadedFrame frame) throws Exception {
        Map<String, Object> request = Map.of(
                "systemInstruction", Map.of("parts", List.of(Map.of("text", SYSTEM_PROMPT))),
                "contents", List.of(Map.of(
                        "role", "user",
                        "parts", List.of(
                                Map.of("inline_data", Map.of(
                                        "mime_type", mediaType(frame.mimeType()),
                                        "data", frame.base64())),
                                Map.of("text", "Analyse this walkthrough photo.")))),
                "generationConfig", Map.of(
                        "responseMimeType", "application/json",
                        "responseSchema", RESPONSE_SCHEMA));

        JsonNode response = geminiRestClient.orElseThrow().post()
                .uri("/v1beta/models/{model}:generateContent", properties.getModel())
                .body(request)
                .retrieve()
                .body(JsonNode.class);

        String json = extractJson(response);
        return json == null ? null : objectMapper.readValue(json, RoomAnalysis.class);
    }

    /**
     * Digs the model's JSON out of the generateContent envelope. A candidate can come back with no
     * text part at all (safety block, or a MAX_TOKENS stop before anything was emitted), which is a
     * skipped frame rather than an error.
     */
    private static String extractJson(JsonNode response) {
        if (response == null) {
            return null;
        }
        for (JsonNode part : response.path("candidates").path(0).path("content").path("parts")) {
            // Thinking models can emit a thought-summary part before the answer; it also carries
            // "text", so taking the first text part blindly would hand back reasoning, not JSON.
            if (part.path("thought").asBoolean(false)) {
                continue;
            }
            if (part.hasNonNull("text")) {
                return part.get("text").asString();
            }
        }
        return null;
    }

    /** Gemini takes the MIME type verbatim; normalise the handful of formats we accept. */
    private static String mediaType(String mimeType) {
        return switch (mimeType == null ? "" : mimeType.toLowerCase(Locale.ROOT)) {
            case "image/png" -> "image/png";
            case "image/webp" -> "image/webp";
            case "image/heic" -> "image/heic";
            case "image/heif" -> "image/heif";
            default -> "image/jpeg";
        };
    }

    /**
     * Collapses per-frame results into one row per room type: sqft from the highest-confidence
     * frame, condition tags unioned across all frames of that room.
     */
    private List<RoomEntity> merge(List<RoomAnalysis> results) {
        Map<String, List<RoomAnalysis>> byRoomType = new LinkedHashMap<>();
        for (RoomAnalysis result : results) {
            byRoomType.computeIfAbsent(normalize(result.roomType()), key -> new ArrayList<>()).add(result);
        }

        List<RoomEntity> rooms = new ArrayList<>(byRoomType.size());
        for (Map.Entry<String, List<RoomAnalysis>> entry : byRoomType.entrySet()) {
            List<RoomAnalysis> group = entry.getValue();

            RoomAnalysis best = group.stream()
                    .max((a, b) -> Double.compare(confidenceOf(a), confidenceOf(b)))
                    .orElseThrow();

            LinkedHashSet<String> tags = new LinkedHashSet<>();
            for (RoomAnalysis result : group) {
                if (result.conditionTags() != null) {
                    result.conditionTags().stream()
                            .filter(tag -> tag != null && !tag.isBlank())
                            .map(RoomAnalysisService::normalize)
                            .forEach(tags::add);
                }
            }

            RoomEntity room = new RoomEntity();
            room.setRoomType(entry.getKey());
            room.setEstimatedSqft(best.estimatedSqft());
            room.setConditionTags(new ArrayList<>(tags));
            room.setConfidence(confidenceOf(best));
            room.setFrameCount(group.size());
            rooms.add(room);
        }
        return rooms;
    }

    private static double confidenceOf(RoomAnalysis analysis) {
        return analysis.confidence() != null ? analysis.confidence() : 0.0;
    }

    private static String normalize(String value) {
        return value.trim().toLowerCase(Locale.ROOT);
    }
}
