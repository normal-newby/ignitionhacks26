package ca.sjn.ignitionhacks26.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.unit.DataSize;

/**
 * MinIO settings for the furniture catalog's binaries. Credentials bind from
 * MINIO_ROOT_USER / MINIO_ROOT_PASSWORD — see the explicit mapping in
 * application.properties, since relaxed binding won't bridge those names.
 */
@Data
@ConfigurationProperties(prefix = "minio")
public class MinioProperties {

    /**
     * Where the backend talks to MinIO. On Render this is the <em>internal</em> URL: uploads
     * then never leave Render's network, which is both faster and one less public hop.
     */
    private String endpoint;

    /**
     * Base URL the browser fetches objects from. Separate from {@link #endpoint} because the
     * internal address doesn't resolve outside Render. Falls back to the endpoint when unset,
     * which is what a local MinIO wants.
     */
    private String publicUrl;

    private String bucket = "furniture";

    private String accessKey;

    private String secretKey;

    /** GLBs big enough to stall a browser aren't worth accepting. */
    private DataSize maxModelSize = DataSize.ofMegabytes(20);

    private DataSize maxThumbnailSize = DataSize.ofMegabytes(5);

    /**
     * Whether to apply an anonymous-read policy to the bucket at startup. The frontend loads
     * GLBs straight from MinIO via useGLTF, which can't attach auth headers, so reads have to
     * be public. Turn this off if the policy is managed out of band (e.g. with {@code mc}).
     */
    private boolean ensurePublicRead = true;

    public boolean isConfigured() {
        return notBlank(endpoint) && notBlank(accessKey) && notBlank(secretKey);
    }

    /** The base the frontend should use — public URL if given, otherwise the endpoint. */
    public String publicBase() {
        String base = notBlank(publicUrl) ? publicUrl : endpoint;
        return base == null ? null : base.replaceAll("/+$", "");
    }

    private static boolean notBlank(String value) {
        return value != null && !value.isBlank();
    }
}
