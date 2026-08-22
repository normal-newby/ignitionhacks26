package ca.sjn.ignitionhacks26.service;

import ca.sjn.ignitionhacks26.entity.CatalogItemEntity;
import ca.sjn.ignitionhacks26.repository.CatalogItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Owns the furniture catalog: the Postgres rows and, through {@link StorageService}, the GLB
 * and thumbnail objects behind them. Every catalog write goes through here so uploading a
 * file and recording its URL can't drift apart.
 */
@Service
public class CatalogService {

    /** Fixed set, mirrored in the frontend's category filter. */
    public static final List<String> CATEGORIES =
            List.of("Seating", "Tables", "Lighting", "Storage", "Plants", "Decor");

    private static final String MODEL_PREFIX = "models";
    private static final String THUMBNAIL_PREFIX = "thumbnails";

    private final CatalogItemRepository repository;
    private final StorageService storage;

    public CatalogService(CatalogItemRepository repository, StorageService storage) {
        this.repository = repository;
        this.storage = storage;
    }

    @Transactional(readOnly = true)
    public List<CatalogItemEntity> list() {
        return repository.findAllByOrderByCategoryAscSortOrderAscNameAsc();
    }

    @Transactional
    public CatalogItemEntity create(CatalogItemInput input, MultipartFile model, MultipartFile thumbnail) {
        CatalogItemEntity item = new CatalogItemEntity();
        item.setName(requireName(input.name()));
        item.setCategory(normaliseCategory(input.category()));
        item.setWidthCm(dimension(input.width(), 50));
        item.setDepthCm(dimension(input.depth(), 50));
        item.setHeightCm(dimension(input.height(), 50));
        item.setBuiltIn(false);
        // User uploads sort after the seeded entries in their category.
        item.setSortOrder(1_000);

        if (present(model)) {
            StorageService.StoredObject stored = storage.upload(
                    model, MODEL_PREFIX, StorageService.MODEL_EXTENSIONS, storage.maxModelBytes());
            item.setModelUrl(stored.url());
            item.setModelObjectKey(stored.objectKey());
        }
        if (present(thumbnail)) {
            StorageService.StoredObject stored = storage.upload(
                    thumbnail, THUMBNAIL_PREFIX, StorageService.IMAGE_EXTENSIONS, storage.maxThumbnailBytes());
            item.setThumbnailUrl(stored.url());
            item.setThumbnailObjectKey(stored.objectKey());
        }

        return repository.save(item);
    }

    /**
     * Partial update. A null field means "leave alone", matching how the model transform
     * PATCH behaves. Replacing a file deletes the object it replaced — the row only ever
     * points at one GLB, so the old one is unreachable the moment this commits.
     */
    @Transactional
    public Optional<CatalogItemEntity> update(UUID id, CatalogItemInput input,
                                              MultipartFile model, MultipartFile thumbnail) {
        return repository.findById(id).map(item -> {
            if (input.name() != null) {
                item.setName(requireName(input.name()));
            }
            if (input.category() != null) {
                item.setCategory(normaliseCategory(input.category()));
            }
            if (input.width() != null) {
                item.setWidthCm(dimension(input.width(), item.getWidthCm()));
            }
            if (input.depth() != null) {
                item.setDepthCm(dimension(input.depth(), item.getDepthCm()));
            }
            if (input.height() != null) {
                item.setHeightCm(dimension(input.height(), item.getHeightCm()));
            }

            if (present(model)) {
                String previousKey = item.getModelObjectKey();
                StorageService.StoredObject stored = storage.upload(
                        model, MODEL_PREFIX, StorageService.MODEL_EXTENSIONS, storage.maxModelBytes());
                item.setModelUrl(stored.url());
                item.setModelObjectKey(stored.objectKey());
                storage.deleteQuietly(previousKey);
            }
            if (present(thumbnail)) {
                String previousKey = item.getThumbnailObjectKey();
                StorageService.StoredObject stored = storage.upload(
                        thumbnail, THUMBNAIL_PREFIX, StorageService.IMAGE_EXTENSIONS, storage.maxThumbnailBytes());
                item.setThumbnailUrl(stored.url());
                item.setThumbnailObjectKey(stored.objectKey());
                storage.deleteQuietly(previousKey);
            }

            return repository.save(item);
        });
    }

    /**
     * Removes the entry and its objects. Rooms that already placed this piece are untouched:
     * their models carry their own copy of the URL, so an existing layout keeps rendering
     * from the same MinIO object — which is why the bucket delete is best-effort rather than
     * something we'd want to be strict about.
     */
    @Transactional
    public boolean delete(UUID id) {
        return repository.findById(id).map(item -> {
            repository.delete(item);
            storage.deleteQuietly(item.getModelObjectKey());
            storage.deleteQuietly(item.getThumbnailObjectKey());
            return true;
        }).orElse(false);
    }

    /** Metadata fields from the multipart form; all optional so PATCH can be partial. */
    public record CatalogItemInput(String name, String category,
                                   Integer width, Integer depth, Integer height) {}

    /* ------------------------------------------------------------------ */

    private static boolean present(MultipartFile file) {
        return file != null && !file.isEmpty();
    }

    private static String requireName(String name) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("A name is required");
        }
        return name.trim();
    }

    private static String normaliseCategory(String category) {
        return CATEGORIES.stream()
                .filter(known -> known.equalsIgnoreCase(category == null ? "" : category.trim()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException(
                        "Unknown category '" + category + "'. Use one of: " + String.join(", ", CATEGORIES) + "."));
    }

    private static int dimension(Integer value, int fallback) {
        if (value == null) {
            return fallback;
        }
        if (value <= 0 || value > 10_000) {
            throw new IllegalArgumentException("Dimensions must be between 1 and 10000 cm");
        }
        return value;
    }
}
