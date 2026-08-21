package ca.sjn.ignitionhacks26.dto;

import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Base64;

/**
 * A single uploaded image, held in memory only. Frames are forwarded to Marble and to the
 * vision model and then dropped — nothing about them is persisted.
 */
public record UploadedFrame(String filename, String mimeType, byte[] data) {

    public static UploadedFrame from(MultipartFile file) throws IOException {
        String mimeType = file.getContentType() != null ? file.getContentType() : "image/jpeg";
        return new UploadedFrame(file.getOriginalFilename(), mimeType, file.getBytes());
    }

    public String base64() {
        return Base64.getEncoder().encodeToString(data);
    }
}
