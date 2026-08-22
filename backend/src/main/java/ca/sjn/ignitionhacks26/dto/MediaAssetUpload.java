package ca.sjn.ignitionhacks26.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Map;

/**
 * Answer to {@code media-assets:prepare_upload}: an asset id to reference in the generate
 * call, plus a signed URL to PUT the bytes at (good for one hour).
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record MediaAssetUpload(
        @JsonProperty("media_asset") MediaAsset mediaAsset,
        @JsonProperty("upload_info") UploadInfo uploadInfo
) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record MediaAsset(
            // Marble names this media_asset_id, not id — the published example is wrong.
            @JsonProperty("media_asset_id") String mediaAssetId,
            @JsonProperty("file_name") String fileName,
            String kind,
            String extension
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record UploadInfo(
            @JsonProperty("upload_url") String uploadUrl,
            @JsonProperty("upload_method") String uploadMethod,
            /*
             * Currently just x-goog-content-length-range. It is one of the two headers signed
             * into the URL (the other being host), so the PUT has to send it back verbatim or
             * the signature won't validate. Unsigned extras like Content-Type are ignored.
             */
            @JsonProperty("required_headers") Map<String, String> requiredHeaders
    ) {
    }

    public String mediaAssetId() {
        return mediaAsset != null ? mediaAsset.mediaAssetId() : null;
    }
}
