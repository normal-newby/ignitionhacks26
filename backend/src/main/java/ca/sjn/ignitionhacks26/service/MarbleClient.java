package ca.sjn.ignitionhacks26.service;

import ca.sjn.ignitionhacks26.dto.MarbleOperation;
import ca.sjn.ignitionhacks26.dto.UploadedFrame;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Thin wrapper over the two Marble endpoints we use. Deliberately does no persistence and no
 * retry logic — {@link ScanService} and {@link ScanPollingService} own that.
 */
@Service
public class MarbleClient {

    private static final Logger log = LoggerFactory.getLogger(MarbleClient.class);

    private final RestClient marbleRestClient;

    public MarbleClient(@Qualifier("marbleRestClient") RestClient marbleRestClient) {
        this.marbleRestClient = marbleRestClient;
    }

    /**
     * Kicks off generation. Returns immediately with an Operation whose {@code done} is false.
     *
     * <p>NOTE: the request body shape below is a best guess — frames are inlined as base64.
     * Confirm against the World Labs docs; if Marble expects pre-uploaded image URLs instead,
     * this method is the only thing that changes.
     */
    public MarbleOperation generateWorld(List<UploadedFrame> frames) {
        List<Map<String, String>> images = new ArrayList<>(frames.size());
        for (UploadedFrame frame : frames) {
            Map<String, String> image = new LinkedHashMap<>();
            image.put("mime_type", frame.mimeType());
            image.put("data", frame.base64());
            images.add(image);
        }

        log.info("Requesting Marble world generation from {} frame(s)", frames.size());

        return marbleRestClient.post()
                .uri("/marble/v1/worlds:generate")
                .body(Map.of("images", images))
                .retrieve()
                .body(MarbleOperation.class);
    }

    public MarbleOperation getOperation(String operationId) {
        return marbleRestClient.get()
                .uri("/marble/v1/operations/{operationId}", operationId)
                .retrieve()
                .body(MarbleOperation.class);
    }
}
