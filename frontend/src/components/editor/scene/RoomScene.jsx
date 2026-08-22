import { Suspense, Component, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, TransformControls, useGLTF, useProgress } from '@react-three/drei';
import { Plane, Raycaster, Vector2, Vector3 } from 'three';
import RoomShell from './RoomShell';
import RoomSplat from './RoomSplat';
import PlacedModel from './PlacedModel';
import WalkControls, { EYE_HEIGHT } from './WalkControls';

// Marble's collider meshes are DRACO-compressed, so the room simply will not appear without a
// decoder. drei defaults to pulling one from gstatic.com at load time; pointing it at our own
// copy in public/draco means the demo doesn't depend on a third-party CDN being reachable from
// whatever network it's shown on. Set before any useGLTF call runs.
useGLTF.setDecoderPath('/draco/');

/** RoomShell puts the scanned floor on y=0, so this is the floor for placement purposes. */
const FLOOR = new Plane(new Vector3(0, 1, 0), 0);

const ORBIT_CAMERA = [3.2, 2.4, 3.6];
const GIZMO_MODES = { move: 'translate', rotate: 'rotate', scale: 'scale' };

/** Grid snap steps: 10cm of travel, 15° of turn. */
const TRANSLATE_SNAP = 0.1;
const ROTATE_SNAP = (15 * Math.PI) / 180;

/**
 * Keeps a handle on the renderer so the drop handler outside the Canvas can turn a mouse
 * position into a point on the floor. r3f state is only reachable from inside the tree.
 */
function Bridge({ handle }) {
    const { camera, gl } = useThree();
    handle.current = { camera, gl };
    return null;
}

/** Puts the camera somewhere sensible each time the navigation mode changes. */
function CameraRig({ mode }) {
    const { camera } = useThree();

    useEffect(() => {
        if (mode === 'walk') {
            camera.position.set(0, EYE_HEIGHT, 0);
            camera.lookAt(0, EYE_HEIGHT, -2);
        } else {
            camera.position.set(...ORBIT_CAMERA);
            camera.lookAt(0, 0.8, 0);
        }
    }, [mode, camera]);

    return null;
}

/**
 * A single bad GLB shouldn't blank the room. Suspense propagates a load failure all the way
 * up and unmounts the whole subtree, so each model gets its own boundary and simply goes
 * missing if its file won't load.
 */
class ModelBoundary extends Component {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    componentDidCatch(error) {
        console.error('A model failed to load and was skipped', error);
    }

    render() {
        return this.state.failed ? null : this.props.children;
    }
}

/**
 * The 3D editor viewport.
 *
 * Everything is in metres with the scanned floor at y=0 — see RoomShell for how Marble's
 * frame gets mapped onto that. Orbit mode is for arranging; walk mode drops you inside the
 * room at eye height.
 */
export default function RoomScene({
    room,
    placedItems,
    catalogById,
    selectedId,
    transformMode,
    gridSnap,
    navMode,
    roomMode,
    splatQuality,
    onSelectItem,
    onUpdateItem,
    onDropItem,
}) {
    const handle = useRef(null);
    const registry = useRef(new Map());
    const [, bumpRegistry] = useState(0);
    const [dragOver, setDragOver] = useState(false);
    const { active: loading, progress } = useProgress();

    const register = useCallback((id, object) => {
        if (object) {
            registry.current.set(id, object);
        } else {
            registry.current.delete(id);
        }
        bumpRegistry((n) => n + 1);
    }, []);

    // Only in orbit mode: a gizmo you can't click while the pointer is locked is just an
    // obstruction, and it would swallow the walk-mode pointer events.
    const attached = navMode === 'orbit' ? registry.current.get(selectedId) ?? null : null;

    /** Screen point -> floor point, for dropping a catalog card where the cursor is. */
    const floorPointAt = useCallback((clientX, clientY) => {
        if (!handle.current) return null;
        const { camera, gl } = handle.current;
        const rect = gl.domElement.getBoundingClientRect();

        const ndc = new Vector2(
            ((clientX - rect.left) / rect.width) * 2 - 1,
            -((clientY - rect.top) / rect.height) * 2 + 1
        );
        const raycaster = new Raycaster();
        raycaster.setFromCamera(ndc, camera);

        const point = new Vector3();
        // Misses when the cursor is above the horizon; the caller falls back to a grid slot.
        return raycaster.ray.intersectPlane(FLOOR, point) ? point : null;
    }, []);

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        const catalogItemId = e.dataTransfer.getData('text/plain');
        if (catalogItemId) {
            onDropItem(catalogItemId, floorPointAt(e.clientX, e.clientY));
        }
    };

    /**
     * Reads the transform back off the gizmo. Scale is forced uniform: furniture stretched on
     * one axis stops looking like furniture, and the model carries a single `scale` anyway.
     */
    const commitTransform = useCallback(() => {
        const object = attached;
        if (!object || !selectedId) return;

        const previous = placedItems.find((p) => p.id === selectedId)?.scale ?? 1;
        const candidates = [object.scale.x, object.scale.y, object.scale.z];
        const scale = candidates.reduce(
            (best, c) => (Math.abs(c - previous) > Math.abs(best - previous) ? c : best),
            previous
        );
        object.scale.setScalar(scale);

        const degrees = ((object.rotation.y * 180) / Math.PI) % 360;

        onUpdateItem(selectedId, {
            position: { x: object.position.x, y: object.position.y, z: object.position.z },
            rotation: degrees < 0 ? degrees + 360 : degrees,
            scale: Math.max(0.05, scale),
        });
    }, [attached, selectedId, placedItems, onUpdateItem]);

    // Falls back to the 500k tier whenever full_res is missing — an older room whose backfill
    // hasn't run, or a world Marble only published one tier for.
    const splatUrl = splatQuality === 'high'
        ? room?.splat_url_full_res || room?.splat_url
        : room?.splat_url;

    const items = useMemo(
        () => placedItems.map((item) => ({ item, dimensions: catalogById?.[item.catalog_item_id]?.default_dimensions })),
        [placedItems, catalogById]
    );

    return (
        <div
            className={`w-full h-full rounded-md overflow-hidden relative border transition-colors ${
                dragOver ? 'border-primary' : 'border-border/30'
            }`}
            onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
        >
            <Canvas
                camera={{ position: ORBIT_CAMERA, fov: 55, near: 0.05, far: 500 }}
                dpr={[1, 2]}
                onPointerMissed={() => navMode === 'orbit' && onSelectItem(null)}
            >
                <Bridge handle={handle} />
                <CameraRig mode={navMode} />

                {/* Marble bakes lighting into the scan, so this is mostly here for the
                    furniture sitting on top of it. */}
                <ambientLight intensity={1.1} />
                <hemisphereLight intensity={0.5} groundColor="#8a8378" />
                <directionalLight position={[4, 8, 4]} intensity={1.3} />

                <Suspense fallback={null}>
                    {/* The splat is the photoreal room; the mesh is the fast, clickable one.
                        The mesh renders underneath either way — it's what a click on empty
                        space hits to clear the selection, and it's the fallback if the splat
                        can't load. Under the splat it's simply not visible. */}
                    {room?.collider_mesh_url && (
                        <ModelBoundary>
                            <RoomShell
                                url={room.collider_mesh_url}
                                groundPlaneOffset={room.ground_plane_offset ?? 0}
                                metricScaleFactor={room.metric_scale_factor ?? 1}
                                onClick={() => navMode === 'orbit' && onSelectItem(null)}
                            />
                        </ModelBoundary>
                    )}

                    {roomMode === 'splat' && splatUrl && (
                        // Keyed on the URL so switching detail tears the old splat down and
                        // builds the new one, rather than trying to swap a URL underneath a
                        // half-gigabyte of GPU buffers.
                        <ModelBoundary key={splatUrl}>
                            <RoomSplat url={splatUrl} />
                        </ModelBoundary>
                    )}

                    {items.map(({ item, dimensions }) => (
                        <ModelBoundary key={item.id}>
                            <PlacedModel
                                item={item}
                                dimensions={dimensions}
                                selected={item.id === selectedId}
                                onSelect={onSelectItem}
                                register={register}
                            />
                        </ModelBoundary>
                    ))}
                </Suspense>

                {attached && (
                    <TransformControls
                        object={attached}
                        mode={GIZMO_MODES[transformMode] ?? 'translate'}
                        // Furniture only ever turns about the vertical axis.
                        showX={transformMode !== 'rotate'}
                        showZ={transformMode !== 'rotate'}
                        translationSnap={gridSnap ? TRANSLATE_SNAP : null}
                        rotationSnap={gridSnap ? ROTATE_SNAP : null}
                        onObjectChange={commitTransform}
                    />
                )}

                {navMode === 'walk'
                    ? <WalkControls />
                    : <OrbitControls makeDefault enableDamping dampingFactor={0.12} target={[0, 0.8, 0]} maxPolarAngle={Math.PI / 2 + 0.2} />}
            </Canvas>

            {loading && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-background/40 backdrop-blur-[1px]">
                    <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                        Loading room · {Math.round(progress)}%
                    </p>
                </div>
            )}

            {navMode === 'walk' && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-primary/90 bg-background/70 backdrop-blur-sm px-3 py-1 rounded">
                        Click to look · WASD to move · Shift to hurry · Esc to release
                    </p>
                </div>
            )}
        </div>
    );
}
