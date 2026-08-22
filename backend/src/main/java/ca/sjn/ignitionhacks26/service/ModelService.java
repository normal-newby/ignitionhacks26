package ca.sjn.ignitionhacks26.service;

import ca.sjn.ignitionhacks26.dto.ModelRequest;
import ca.sjn.ignitionhacks26.entity.ModelEntity;
import ca.sjn.ignitionhacks26.entity.RoomEntity;
import ca.sjn.ignitionhacks26.entity.UserEntity;
import ca.sjn.ignitionhacks26.repository.ModelRepository;
import ca.sjn.ignitionhacks26.repository.RoomRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * The furniture layout: models placed in a room. This is the part that has to survive a
 * page reload, so every edit in the editor lands here rather than in browser storage.
 */
@Service
public class ModelService {

    private final ModelRepository modelRepository;
    private final RoomRepository roomRepository;

    public ModelService(ModelRepository modelRepository, RoomRepository roomRepository) {
        this.modelRepository = modelRepository;
        this.roomRepository = roomRepository;
    }

    @Transactional(readOnly = true)
    public List<ModelEntity> listForRoom(UUID roomId) {
        return modelRepository.findByRoomIdOrderByCreatedAtAsc(roomId);
    }

    @Transactional
    public Optional<ModelEntity> addToRoom(UUID roomId, ModelRequest request) {
        if (request.catalogId() == null || request.catalogId().isBlank()) {
            throw new IllegalArgumentException("catalog_id is required");
        }

        return roomRepository.findById(roomId).map(room -> {
            ModelEntity model = new ModelEntity();
            model.setCatalogId(request.catalogId());
            model.setName(request.name() == null || request.name().isBlank() ? request.catalogId() : request.name());
            model.setCategory(request.category());
            model.setModelUrl(request.modelUrl());
            applyTransform(model, request);
            room.addModel(model);
            return modelRepository.save(model);
        });
    }

    /**
     * Partial update — the editor sends only what moved. Nulls mean "leave alone", which is
     * why every transform field on the request is boxed.
     */
    @Transactional
    public Optional<ModelEntity> update(UserEntity user, UUID modelId, ModelRequest request) {
        return findOwned(user, modelId).map(model -> {
            if (request.name() != null && !request.name().isBlank()) {
                model.setName(request.name());
            }
            applyTransform(model, request);
            return modelRepository.save(model);
        });
    }

    @Transactional
    public boolean delete(UserEntity user, UUID modelId) {
        return findOwned(user, modelId).map(model -> {
            modelRepository.delete(model);
            return true;
        }).orElse(false);
    }

    /**
     * A placed model has no owner of its own — it inherits the room's, which is the only
     * ownership that could be meaningful for something that only exists inside one room.
     */
    private Optional<ModelEntity> findOwned(UserEntity user, UUID modelId) {
        return modelRepository.findById(modelId).filter(model -> {
            RoomEntity room = model.getRoom();
            return room != null && room.getOwner() != null
                    && room.getOwner().getId().equals(user.getId());
        });
    }

    /** Clears a room's layout in one call — backs the editor's "reset room" button. */
    @Transactional
    public void deleteAllInRoom(UUID roomId) {
        modelRepository.deleteByRoomId(roomId);
    }

    private static void applyTransform(ModelEntity model, ModelRequest request) {
        if (request.posX() != null) {
            model.setPosX(request.posX());
        }
        if (request.posY() != null) {
            model.setPosY(request.posY());
        }
        if (request.posZ() != null) {
            model.setPosZ(request.posZ());
        }
        if (request.rotationY() != null) {
            model.setRotationY(request.rotationY());
        }
        if (request.scale() != null) {
            model.setScale(request.scale());
        }
    }
}
