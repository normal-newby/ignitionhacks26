package ca.sjn.ignitionhacks26.service;

import ca.sjn.ignitionhacks26.config.AnthropicProperties;
import ca.sjn.ignitionhacks26.dto.RoomAnalysis;
import ca.sjn.ignitionhacks26.dto.UploadedFrame;
import ca.sjn.ignitionhacks26.entity.AnalysisStatus;
import ca.sjn.ignitionhacks26.entity.RoomEntity;
import com.anthropic.client.AnthropicClient;
import com.anthropic.models.messages.Base64ImageSource;
import com.anthropic.models.messages.ContentBlockParam;
import com.anthropic.models.messages.ImageBlockParam;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.StructuredMessageCreateParams;
import com.anthropic.models.messages.TextBlockParam;
import com.anthropic.models.messages.ThinkingConfigAdaptive;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

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

    private final Optional<AnthropicClient> anthropicClient;
    private final AnthropicProperties properties;
    private final ScanService scanService;

    public RoomAnalysisService(Optional<AnthropicClient> anthropicClient,
                               AnthropicProperties properties,
                               ScanService scanService) {
        this.anthropicClient = anthropicClient;
        this.properties = properties;
        this.scanService = scanService;
    }

    /**
     * Fire-and-forget entry point called right after upload, while Marble is still generating.
     * Frames are held in memory for the duration and never persisted.
     */
    @Async
    public void analyzeAsync(UUID scanId, List<UploadedFrame> frames) {
        if (anthropicClient.isEmpty()) {
            log.warn("ANTHROPIC_API_KEY not configured — skipping room analysis for scan {}", scanId);
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

    private RoomAnalysis analyzeFrame(UploadedFrame frame) {
        ImageBlockParam image = ImageBlockParam.builder()
                .source(Base64ImageSource.builder()
                        .mediaType(mediaType(frame.mimeType()))
                        .data(frame.base64())
                        .build())
                .build();

        StructuredMessageCreateParams<RoomAnalysis> params = MessageCreateParams.builder()
                .model(properties.getModel())
                .maxTokens(4096L)
                .system(SYSTEM_PROMPT)
                .thinking(ThinkingConfigAdaptive.builder().build())
                .addUserMessageOfBlockParams(List.of(
                        ContentBlockParam.ofImage(image),
                        ContentBlockParam.ofText(TextBlockParam.builder()
                                .text("Analyse this walkthrough photo.")
                                .build())))
                .outputConfig(RoomAnalysis.class)
                .build();

        return anthropicClient.orElseThrow().messages().create(params).content().stream()
                .flatMap(block -> block.text().stream())
                .map(text -> text.text())
                .findFirst()
                .orElse(null);
    }

    private static Base64ImageSource.MediaType mediaType(String mimeType) {
        return switch (mimeType == null ? "" : mimeType.toLowerCase(Locale.ROOT)) {
            case "image/png" -> Base64ImageSource.MediaType.IMAGE_PNG;
            case "image/gif" -> Base64ImageSource.MediaType.IMAGE_GIF;
            case "image/webp" -> Base64ImageSource.MediaType.IMAGE_WEBP;
            default -> Base64ImageSource.MediaType.IMAGE_JPEG;
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
