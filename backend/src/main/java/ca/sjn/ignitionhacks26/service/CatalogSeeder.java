package ca.sjn.ignitionhacks26.service;

import ca.sjn.ignitionhacks26.entity.CatalogItemEntity;
import ca.sjn.ignitionhacks26.repository.CatalogItemRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Puts the starter catalog in place on an empty database, so a fresh deploy has something to
 * drag into a room instead of a blank rail.
 *
 * <p>Rows only — no GLBs. The source models are ~90MB between them, which is not something to
 * carry inside the container image on every deploy; MinIO outlives deploys, so the assets get
 * attached once through the catalog admin page and stay attached. An entry without a model
 * still lists and still records its real-world dimensions, it just can't render in 3D yet.
 */
@Component
public class CatalogSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(CatalogSeeder.class);

    private record Seed(String name, String category, int width, int depth, int height) {}

    private static final List<Seed> SEEDS = List.of(
            new Seed("Lounge Chair", "Seating", 75, 80, 82),
            new Seed("3-Seat Sofa", "Seating", 200, 90, 85),
            new Seed("Accent Stool", "Seating", 40, 40, 45),
            new Seed("Coffee Table", "Tables", 120, 60, 40),
            new Seed("Side Table", "Tables", 45, 45, 55),
            new Seed("Desk", "Tables", 140, 70, 75),
            new Seed("Floor Lamp", "Lighting", 35, 35, 160),
            new Seed("Table Lamp", "Lighting", 25, 25, 50),
            new Seed("Bookshelf", "Storage", 80, 30, 180),
            new Seed("Sideboard", "Storage", 150, 45, 70),
            new Seed("Fiddle Leaf Fig", "Plants", 40, 40, 170),
            new Seed("Snake Plant", "Plants", 30, 30, 90),
            new Seed("Area Rug", "Decor", 200, 140, 2),
            new Seed("Framed Print", "Decor", 60, 4, 80));

    private final CatalogItemRepository repository;

    public CatalogSeeder(CatalogItemRepository repository) {
        this.repository = repository;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (repository.count() > 0) {
            publishOwnerlessEntries();
            return;
        }

        for (int i = 0; i < SEEDS.size(); i++) {
            Seed seed = SEEDS.get(i);
            CatalogItemEntity item = new CatalogItemEntity();
            item.setName(seed.name());
            item.setCategory(seed.category());
            item.setWidthCm(seed.width());
            item.setDepthCm(seed.depth());
            item.setHeightCm(seed.height());
            item.setBuiltIn(true);
            // No owner, so nobody could ever mark it shared — but every account needs to see
            // it, and visibility is decided by this flag alone.
            item.setPublic(true);
            item.setSortOrder(i);
            repository.save(item);
        }

        log.info("Seeded {} catalog entries. Attach GLBs to them at /catalog.", SEEDS.size());
    }

    /**
     * Makes owner-less entries visible again on a database that predates the public flag.
     *
     * <p>{@code ddl-auto=update} adds {@code is_public} defaulted to false, which would hide
     * every already-seeded piece from everyone — an owner-less private row belongs to nobody
     * and so shows up for nobody. Idempotent: after the first boot it finds nothing to change.
     */
    private void publishOwnerlessEntries() {
        List<CatalogItemEntity> stranded = repository.findByOwnerIsNull().stream()
                .filter(item -> !item.isPublic())
                .toList();
        if (stranded.isEmpty()) {
            return;
        }
        stranded.forEach(item -> item.setPublic(true));
        repository.saveAll(stranded);
        log.info("Marked {} owner-less catalog entries public.", stranded.size());
    }
}
