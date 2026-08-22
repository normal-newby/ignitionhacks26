import { memo, useMemo, useLayoutEffect, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { Box3, Vector3 } from 'three';

/** Scratch, so measuring a model doesn't allocate. */
const _size = new Vector3();

/**
 * Measures a GLB once and works out both numbers that depend on its bounds.
 *
 * `fit`: catalog GLBs come from wherever their author left them — some are modelled in
 * centimetres, some in metres, some in nothing in particular. Rather than trust the file,
 * measure it and scale so its height matches the real-world height on the catalog entry.
 * That's what keeps a chair chair-sized next to a scanned room. Falls back to 1 when there's
 * no height to aim at (the catalog entry was deleted after the item was placed) or the model
 * has no measurable extent.
 *
 * `lift`: sits the model's base on the group's origin, wherever the author put the pivot.
 *
 * One `Box3` for both. `setFromObject` walks the whole node tree and, on first call, every
 * vertex of every geometry under it; doing that twice for two numbers off the same box is a
 * load-time cost with nothing to show for it.
 */
function measure(object, heightCm) {
    const box = new Box3().setFromObject(object);
    const size = box.getSize(_size);

    const fit = heightCm && Number.isFinite(size.y) && size.y > 0
        ? heightCm / 100 / size.y
        : 1;

    return {
        fit,
        lift: Number.isFinite(box.min.y) ? -box.min.y * fit : 0,
    };
}

/**
 * Wraps one piece so it can be picked and pushed around.
 *
 * The user's `scale` lives on this group rather than on the model inside it, so the gizmo can
 * write straight back to it: whatever TransformControls leaves in `group.scale` is exactly the
 * number we persist. The inner normalisation scale then rides along underneath, untouched.
 */
function Selectable({ children, item, selected, onSelect, register }) {
    const group = useRef();

    // The gizmo attaches by object reference, so the registry has to be populated before the
    // parent renders its TransformControls — hence layout effect rather than effect.
    useLayoutEffect(() => {
        register(item.id, group.current);
        return () => register(item.id, null);
    }, [item.id, register]);

    return (
        <group
            ref={group}
            position={[item.position.x, item.position.y, item.position.z]}
            rotation={[0, (item.rotation * Math.PI) / 180, 0]}
            scale={item.scale}
            onClick={(e) => {
                e.stopPropagation();
                onSelect(item.id);
            }}
            onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor = 'pointer';
            }}
            onPointerOut={() => {
                document.body.style.cursor = '';
            }}
        >
            {children}
            {selected && <SelectionRing />}
        </group>
    );
}

/**
 * Excludes an object from picking.
 *
 * It has to be a function, not `null`. r3f assigns unknown props straight onto the instance,
 * so `raycast={null}` really does leave `mesh.raycast === null` — and three calls
 * `object.raycast(...)` unconditionally on every object it walks, so the next pointer event
 * dies with "object.raycast is not a function". Module-level so it isn't reallocated per
 * render.
 */
const noRaycast = () => null;

/** A disc on the floor under the selection — legible from any angle, unlike an outline. */
function SelectionRing() {
    return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} raycast={noRaycast}>
            <ringGeometry args={[0.3, 0.36, 48]} />
            <meshBasicMaterial color="#c2410c" transparent opacity={0.9} depthTest={false} />
        </mesh>
    );
}

function GltfModel({ item, dimensions, register, selected, onSelect }) {
    const { scene } = useGLTF(item.model_url);

    // Cloned because useGLTF caches one instance per URL and hands the same object to every
    // caller — two of the same chair in a room would otherwise be one chair.
    const model = useMemo(() => scene.clone(true), [scene]);

    const { fit, lift } = useMemo(
        () => measure(model, dimensions?.height),
        [model, dimensions?.height]
    );

    return (
        <Selectable item={item} selected={selected} onSelect={onSelect} register={register}>
            <primitive object={model} scale={fit} position={[0, lift, 0]} />
        </Selectable>
    );
}

/**
 * Stand-in for a catalog entry with no GLB attached. Sized from the entry's real dimensions so
 * the layout still means something — most of the seeded catalog is in this state until models
 * are uploaded for it.
 */
function PlaceholderBox({ item, dimensions, register, selected, onSelect }) {
    const w = (dimensions?.width ?? 50) / 100;
    const d = (dimensions?.depth ?? 50) / 100;
    const h = (dimensions?.height ?? 50) / 100;

    return (
        <Selectable item={item} selected={selected} onSelect={onSelect} register={register}>
            <mesh position={[0, h / 2, 0]}>
                <boxGeometry args={[w, h, d]} />
                <meshStandardMaterial color="#a8a29e" roughness={0.85} transparent opacity={0.72} />
            </mesh>
        </Selectable>
    );
}

/**
 * One placed piece of furniture. Split on whether a GLB exists rather than branching inside a
 * single component, because useGLTF can't be called conditionally.
 *
 * Memoised because the gizmo commits a transform on every mouse move of a drag, and each
 * commit replaces the whole `placedItems` array upstream. Only the dragged item's `item`
 * object actually changes identity, so without this every other piece in the room reconciles
 * sixty times a second for no change at all.
 */
export default memo(function PlacedModel(props) {
    return props.item.model_url
        ? <GltfModel {...props} />
        : <PlaceholderBox {...props} />;
});
