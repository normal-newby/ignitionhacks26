package ca.sjn.ignitionhacks26.service;

import ca.sjn.ignitionhacks26.config.MinioProperties;
import io.minio.BucketExistsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import io.minio.SetBucketPolicyArgs;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.net.URLConnection;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Everything that touches MinIO. Postgres holds metadata; the GLBs and thumbnails behind the
 * furniture catalog live here, and the only thing that crosses back is the object's URL.
 *
 * <p>Like the Marble key, the app boots fine without MinIO configured — uploads just fail
 * fast with a message that says so, instead of the whole context refusing to start.
 */
@Service
public class StorageService {

    private static final Logger log = LoggerFactory.getLogger(StorageService.class);

    public static final List<String> MODEL_EXTENSIONS = List.of("glb", "gltf");
    public static final List<String> IMAGE_EXTENSIONS = List.of("png", "jpg", "jpeg", "webp", "avif");

    /** Streamed in 10MB parts; we never buffer a whole file on the heap. */
    private static final long PART_SIZE = 10L * 1024 * 1024;

    private final MinioProperties properties;

    /** Null when MinIO isn't configured. Guard every use with {@link #isReady()}. */
    private final MinioClient client;

    public StorageService(MinioProperties properties) {
        this.properties = properties;
        this.client = properties.isConfigured()
                ? MinioClient.builder()
                        .endpoint(properties.getEndpoint())
                        .credentials(properties.getAccessKey(), properties.getSecretKey())
                        .build()
                : null;
    }

    /**
     * Creates the bucket if it's missing and opens it for anonymous reads, because the
     * frontend's useGLTF fetches GLBs directly and has nowhere to put credentials. Writes
     * still require the keys. Failures here are logged, not fatal: a MinIO that's slow to
     * come up shouldn't take the API down with it.
     */
    @PostConstruct
    void ensureBucket() {
        if (!isReady()) {
            log.warn("MinIO is not configured (minio.endpoint / MINIO_ROOT_USER / MINIO_ROOT_PASSWORD)."
                    + " Catalog asset uploads will be rejected until it is.");
            return;
        }

        String bucket = properties.getBucket();
        try {
            if (!client.bucketExists(BucketExistsArgs.builder().bucket(bucket).build())) {
                client.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
                log.info("Created MinIO bucket '{}'", bucket);
            }

            if (properties.isEnsurePublicRead()) {
                client.setBucketPolicy(SetBucketPolicyArgs.builder()
                        .bucket(bucket)
                        .config(publicReadPolicy(bucket))
                        .build());
            }
            log.info("MinIO ready: bucket '{}' at {} (public base {})",
                    bucket, properties.getEndpoint(), properties.publicBase());
        } catch (Exception e) {
            log.error("Could not prepare MinIO bucket '{}': {}", bucket, e.getMessage());
        }
    }

    public boolean isReady() {
        return client != null;
    }

    public long maxModelBytes() {
        return properties.getMaxModelSize().toBytes();
    }

    public long maxThumbnailBytes() {
        return properties.getMaxThumbnailSize().toBytes();
    }

    /**
     * Validates and stores one file under {@code prefix/}, returning its public URL.
     *
     * <p>Validation is extension plus declared size — deliberately shallow. Nothing here
     * parses the GLB; the bucket is read-only to the public and the frontend feeds these to
     * a GLTF loader that rejects garbage on its own.
     */
    public StoredObject upload(MultipartFile file, String prefix, List<String> allowedExtensions, long maxBytes) {
        if (!isReady()) {
            throw new IllegalStateException(
                    "File storage is not configured on this server, so assets cannot be uploaded.");
        }
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("The uploaded file is empty");
        }

        String extension = extensionOf(file.getOriginalFilename());
        if (!allowedExtensions.contains(extension)) {
            throw new IllegalArgumentException("Unsupported file type '" + extension
                    + "'. Allowed: " + String.join(", ", allowedExtensions) + ".");
        }
        if (file.getSize() > maxBytes) {
            throw new IllegalArgumentException(
                    "That file is " + megabytes(file.getSize()) + "MB; the limit is " + megabytes(maxBytes) + "MB.");
        }

        String key = prefix + "/" + UUID.randomUUID() + "." + extension;
        try (InputStream in = file.getInputStream()) {
            client.putObject(PutObjectArgs.builder()
                    .bucket(properties.getBucket())
                    .object(key)
                    .stream(in, file.getSize(), PART_SIZE)
                    .contentType(contentTypeFor(extension, file.getContentType()))
                    .build());
        } catch (IOException e) {
            throw new IllegalStateException("Could not read the uploaded file: " + e.getMessage(), e);
        } catch (Exception e) {
            throw new IllegalStateException("Could not store the file: " + e.getMessage(), e);
        }

        log.info("Stored {} ({} bytes) as {}", file.getOriginalFilename(), file.getSize(), key);
        return new StoredObject(key, publicUrlFor(key));
    }

    /** Same as {@link #upload} but for bytes we already hold — used to seed the built-ins. */
    public StoredObject upload(byte[] bytes, String key, String contentType) {
        if (!isReady()) {
            throw new IllegalStateException("File storage is not configured");
        }
        try (InputStream in = new java.io.ByteArrayInputStream(bytes)) {
            client.putObject(PutObjectArgs.builder()
                    .bucket(properties.getBucket())
                    .object(key)
                    .stream(in, bytes.length, -1)
                    .contentType(contentType)
                    .build());
        } catch (Exception e) {
            throw new IllegalStateException("Could not store " + key + ": " + e.getMessage(), e);
        }
        return new StoredObject(key, publicUrlFor(key));
    }

    /**
     * Best-effort delete. A catalog row going away matters; an orphaned object in the bucket
     * doesn't, so a failure here is logged rather than rolled back onto the caller.
     */
    public void deleteQuietly(String objectKey) {
        if (!isReady() || objectKey == null || objectKey.isBlank()) {
            return;
        }
        try {
            client.removeObject(RemoveObjectArgs.builder()
                    .bucket(properties.getBucket())
                    .object(objectKey)
                    .build());
        } catch (Exception e) {
            log.warn("Could not delete object {}: {}", objectKey, e.getMessage());
        }
    }

    public String publicUrlFor(String key) {
        return properties.publicBase() + "/" + properties.getBucket() + "/" + key;
    }

    /** An object as stored: the key we need to delete it later, and the URL the browser uses. */
    public record StoredObject(String objectKey, String url) {}

    /* ------------------------------------------------------------------ */

    private static String publicReadPolicy(String bucket) {
        return """
                {
                  "Version": "2012-10-17",
                  "Statement": [
                    {
                      "Effect": "Allow",
                      "Principal": {"AWS": ["*"]},
                      "Action": ["s3:GetObject"],
                      "Resource": ["arn:aws:s3:::%s/*"]
                    }
                  ]
                }
                """.formatted(bucket);
    }

    /**
     * The browser needs {@code model/gltf-binary} on a GLB for the loader to be happy, and
     * MinIO won't infer it. Everything else falls back to what the client declared.
     */
    static String contentTypeFor(String extension, String declared) {
        return switch (extension) {
            case "glb" -> "model/gltf-binary";
            case "gltf" -> "model/gltf+json";
            case "avif" -> "image/avif";
            default -> {
                if (declared != null && !declared.isBlank()) {
                    yield declared;
                }
                String guessed = URLConnection.guessContentTypeFromName("f." + extension);
                yield guessed != null ? guessed : "application/octet-stream";
            }
        };
    }

    static String extensionOf(String filename) {
        if (filename == null || !filename.contains(".")) {
            return "";
        }
        return filename.substring(filename.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
    }

    private static long megabytes(long bytes) {
        return Math.max(1, Math.round(bytes / 1024.0 / 1024.0));
    }
}
