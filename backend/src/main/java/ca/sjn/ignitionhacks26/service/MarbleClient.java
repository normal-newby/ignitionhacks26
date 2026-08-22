package ca.sjn.ignitionhacks26.service;

import ca.sjn.ignitionhacks26.config.MarbleProperties;
import ca.sjn.ignitionhacks26.dto.MarbleOperation;
import ca.sjn.ignitionhacks26.dto.MediaAssetUpload;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Thin wrapper over the three Marble endpoints we use. Does no persistence and no retrying —
 * {@link RoomService} and {@link RoomPollingService} own that.
 *
 * <p>The upload is a three-step dance, because Marble won't take video bytes inline:
 * reserve a slot, PUT the file at the signed URL it hands back, then generate against the
 * resulting asset id.
 */
@Service
public class MarbleClient {

    private static final Logger log = LoggerFactory.getLogger(MarbleClient.class);

    private static final ObjectMapper JSON = new ObjectMapper();

    private final RestClient marbleRestClient;
    private final RestClient uploadRestClient;
    private final MarbleProperties properties;

    public MarbleClient(@Qualifier("marbleRestClient") RestClient marbleRestClient,
                        @Qualifier("uploadRestClient") RestClient uploadRestClient,
                        MarbleProperties properties) {
        this.marbleRestClient = marbleRestClient;
        this.uploadRestClient = uploadRestClient;
        this.properties = properties;
    }

    /** Step 1: reserve a media asset and get a signed URL to upload the video to. */
    public MediaAssetUpload prepareVideoUpload(String fileName, String extension) {
        return marbleRestClient.post()
                .uri("/marble/v1/media-assets:prepare_upload")
                .body(Map.of(
                        "file_name", fileName,
                        "kind", "video",
                        "extension", extension))
                .retrieve()
                .onStatus(HttpStatusCode::isError, (request, response) -> {
                    throw toMarbleException(response.getStatusCode().value(), response.getBody());
                })
                .body(MediaAssetUpload.class);
    }

    /** Step 2: stream the file straight at the signed URL. */
    public void uploadMedia(MediaAssetUpload.UploadInfo uploadInfo, File file, String contentType) {
        RestClient.RequestBodySpec request = uploadRestClient
                .method(HttpMethod.PUT)
                // URI.create, not the String overload: the String form is treated as a URI
                // template and re-encoded, which mangles the already-encoded query string
                // the signature was computed over. GCS then answers SignatureDoesNotMatch.
                .uri(URI.create(uploadInfo.uploadUrl()))
                .header("Content-Type", contentType);

        // Signed into the URL, so the PUT has to send them back verbatim.
        if (uploadInfo.requiredHeaders() != null) {
            uploadInfo.requiredHeaders().forEach(request::header);
        }

        log.info("Uploading {} ({} bytes) to the Marble media store", file.getName(), file.length());
        // FileSystemResource streams from disk and reports its own length, so the video
        // never has to sit in the heap.
        request.body(new FileSystemResource(file)).retrieve().toBodilessEntity();
    }

    /** Step 3: kick off generation. Returns immediately with an operation whose done is false. */
    public MarbleOperation generateFromVideoAsset(String displayName, String mediaAssetId) {
        Map<String, Object> videoPrompt = new LinkedHashMap<>();
        videoPrompt.put("source", "media_asset");
        videoPrompt.put("media_asset_id", mediaAssetId);

        Map<String, Object> worldPrompt = new LinkedHashMap<>();
        worldPrompt.put("type", "video");
        worldPrompt.put("video_prompt", videoPrompt);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("display_name", displayName);
        body.put("model", properties.getModel());
        body.put("world_prompt", worldPrompt);

        log.info("Requesting Marble world generation for media asset {}", mediaAssetId);

        return marbleRestClient.post()
                .uri("/marble/v1/worlds:generate")
                .body(body)
                .retrieve()
                .onStatus(HttpStatusCode::isError, (request, response) -> {
                    // 422 here is the common one: Marble could not decode the video.
                    throw toMarbleException(response.getStatusCode().value(), response.getBody());
                })
                .body(MarbleOperation.class);
    }

    public MarbleOperation getOperation(String operationId) {
        return marbleRestClient.get()
                .uri("/marble/v1/operations/{operationId}", operationId)
                .retrieve()
                .body(MarbleOperation.class);
    }

    /**
     * Marble reports errors as {@code {"detail": "..."}}. Fall back to the raw body when it
     * doesn't, so nothing is swallowed.
     */
    private static MarbleException toMarbleException(int status, InputStream body) {
        String raw;
        try (InputStream in = body) {
            raw = new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            return new MarbleException(status, "World Labs returned HTTP " + status);
        }

        try {
            JsonNode detail = JSON.readTree(raw).get("detail");
            if (detail != null && detail.isString()) {
                return new MarbleException(status, detail.asString());
            }
        } catch (Exception ignored) {
            // Not JSON — fall through to the raw body.
        }
        return new MarbleException(status, raw.isBlank() ? "World Labs returned HTTP " + status : raw);
    }
}
