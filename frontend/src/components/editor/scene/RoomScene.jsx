import { Suspense, Component, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { AdaptiveDpr, OrbitControls, TransformControls, useGLTF, useProgress } from '@react-three/drei';
import { Plane, Raycaster, Vector2, Vector3 } from 'three';
import RoomShell from './RoomShell';
import RoomSplat from './RoomSplat';
import PlacedModel from './PlacedModel';
import UnifiedControls, { EYE_HEIGHT } from './UnifiedControls';

// Marble's collider meshes are DRACO-compressed, so the room simply will not appear without a
// decoder. drei defaults to pulling one from gstatic.com at load time; pointing it at our own
// copy in public/draco means the demo doesn't depend on a third-party CDN being reachable from
// whatever network it's shown on. Set before any useGLTF call runs.
useGLTF.setDecoderPath('/draco/');

/** RoomShell puts the scanned floor on y=0, so this is the floor for placement purposes. */
const FLOOR = new Plane(new Vector3(0, 1, 0), 0);

/** Where you're standing when the room opens: on the floor at the origin, facing -Z. */
const START_POSITION = [0, EYE_HEIGHT, 0];

const GIZMO_MODES = { move: 'translate', rotate: 'rotate', scale: 'scale' };

/** Grid snap steps: 10cm of travel, 15° of turn. */
const TRANSLATE_SNAP = 0.1;
const ROTATE_SNAP = (15 * Math.PI) / 180;

/** How far ahead of where you're standing a piece added from the catalog rail lands. */
const PLACE_DISTANCE = 2;

/**
 * Keeps a handle on the renderer so the code outside the Canvas — the drop handler, the
 * export — can reach it. r3f state is only reachable from inside the tree.
 */
function Bridge({ handle }) {
    const { camera, gl, scene } = useThree();
    handle.current = { camera, gl, scene };
    return null;
}

/* No CameraRig here — where you start standing is UnifiedControls' business, along with
   everything else that moves the camera. START_POSITION above is only the Canvas's initial
   prop, so the first frame isn't rendered from the origin. */

/**
 * The load progress readout.
 *
 * Its own component because `useProgress` fires many times a second while a 5MB mesh and a
 * 28MB splat come down. Read from RoomScene, every one of those ticks would re-render the
 * whole scene graph during the exact stretch where the main thread is busiest.
 */
function LoadingOverlay() {
    const { active, progress } = useProgress();
    if (!active) return null;

    return (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-background/40 backdrop-blur-[1px]">
            <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Loading room · {Math.round(progress)}%
            </p>
        </div>
    );
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
 * frame gets mapped onto that. There is one way to be in the room: standing in it, looking
 * around with a right-drag. See UnifiedControls for why that isn't OrbitControls.
 */
export default function RoomScene({
    room,
    placedItems,
    catalogById,
    selectedId,
    transformMode,
    gridSnap,
    roomMode,
    splatQuality,
    apiRef,
    onSelectItem,
    onUpdateItem,
    onDropItem,
}) {
    const handle = useRef(null);
    const registry = useRef(new Map());
    const [, bumpRegistry] = useState(0);
    const [dragOver, setDragOver] = useState(false);
    // Whether the splat has finished loading and is actually covering the room. Drives whether
    // the collider mesh underneath still needs drawing.
    const [splatReady, setSplatReady] = useState(false);

    const register = useCallback((id, object) => {
        if (object) {
            registry.current.set(id, object);
        } else {
            registry.current.delete(id);
        }
        bumpRegistry((n) => n + 1);
    }, []);

    // The gizmo is available the whole time now. It used to be orbit-only because a pointer
    // lock made it unclickable; with the cursor free, left-drag on the gizmo and right-drag to
    // look never contend for the same button.
    const attached = registry.current.get(selectedId) ?? null;

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
     * Where a piece added by clicking a catalog card should land: on the floor, a couple of
     * metres ahead of where you're standing.
     *
     * The fixed grid near the origin that this replaces was fine to orbit around and useless
     * to walk in — stand in a corner, click a chair, and it appears somewhere behind you. The
     * slot number fans successive adds out sideways and then further away, so clicking three
     * chairs in a row gives three chairs rather than one chair-shaped pile.
     */
    const placementPoint = useCallback((slot = 0) => {
        if (!handle.current) return null;
        const { camera } = handle.current;

        const forward = new Vector3();
        camera.getWorldDirection(forward);
        forward.y = 0;
        // Looking straight down leaves nothing to aim along; the caller falls back to the grid.
        if (forward.lengthSq() < 1e-6) return null;
        forward.normalize();

        const right = new Vector3().crossVectors(forward, camera.up).normalize();
        const across = ((slot % 5) - 2) * 0.6;
        const away = PLACE_DISTANCE + Math.floor(slot / 5) * 0.6;

        return new Vector3(
            camera.position.x + forward.x * away + right.x * across,
            0,
            camera.position.z + forward.z * away + right.z * across
        );
    }, []);

    /**
     * The room and everything arranged in it, as a GLB.
     *
     * **The photoreal splat can't come along.** glTF has no Gaussian-splat primitive, and
     * Marble's `.spz` is a separate asset with its own format; the only 3D geometry in this
     * scene is the collider mesh and the catalog models on top of it. So the export is the
     * scan's mesh plus the layout — the thing that opens in Blender, and the thing that
     * actually carries the user's work.
     *
     * Only two kinds of root go in, named explicitly rather than handing over the whole scene:
     * that leaves out the lights, the splat, Spark's renderer object and the gizmo without
     * having to recognise any of them. The shell is forced visible for the export because it
     * stops drawing whenever the splat covers it, and an invisible node is one `onlyVisible`
     * skips.
     */
    const exportScene = useCallback(async () => {
        if (!handle.current) return null;
        const { scene } = handle.current;

        const shells = [];
        scene.traverse((object) => {
            if (object.userData.roomShell) shells.push(object);
        });

        const roots = [...shells, ...registry.current.values()].filter(Boolean);
        if (roots.length === 0) return null;

        // Selection rings are editing furniture, not furniture.
        const hidden = [];
        roots.forEach((root) => root.traverse((object) => {
            if (object.userData.hideOnExport && object.visible) {
                object.visible = false;
                hidden.push(object);
            }
        }));
        const revealed = shells.filter((shell) => !shell.visible);
        revealed.forEach((shell) => { shell.visible = true; });

        try {
            const buffer = await new Promise((resolve, reject) => {
                new GLTFExporter().parse(roots, resolve, reject, {
                    binary: true,
                    onlyVisible: true,
                });
            });
            return new Blob([buffer], { type: 'model/gltf-binary' });
        } finally {
            hidden.forEach((object) => { object.visible = true; });
            revealed.forEach((shell) => { shell.visible = false; });
        }
    }, []);

    // Handed up to the editor, which owns the export button and the catalog rail.
    useEffect(() => {
        if (!apiRef) return undefined;
        apiRef.current = { exportScene, placementPoint };
        return () => { apiRef.current = null; };
    }, [apiRef, exportScene, placementPoint]);

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
                // far was 500 for a room that's 3m across. A 0.05..500 depth range spends
                // almost all of its precision on empty space and leaves furniture standing on
                // the floor fighting over the same depth values.
                camera={{ position: START_POSITION, fov: 55, near: 0.05, far: 100 }}
                // Capped at 1.5, not the display's full ratio. Splat rendering is fill-rate
                // bound, so this is the single biggest dial in the scene: a 2x display renders
                // four times the pixels of a 1x one for a room that is already soft-edged.
                // First thing to turn back up if a machine has frames to spare.
                dpr={[1, 1.5]}
                gl={{
                    // Spark's own guidance: MSAA does nothing for a Gaussian splat — the
                    // splats are soft-edged already — and costs a great deal of fill rate,
                    // which is exactly what the splat path is short of.
                    antialias: false,
                    // Without this a dual-GPU laptop hands WebGL to the integrated chip.
                    powerPreference: 'high-performance',
                }}
                // Paired with <AdaptiveDpr/> below and `regress` on the controls: while the
                // camera is moving the scene renders at 75% resolution and goes back to full
                // once it settles. Nobody reads fine detail mid-orbit. 0.75 rather than the
                // more usual 0.5 because the dpr cap above already cut resolution once, and
                // stacking both drops is more softness than the frames are worth.
                performance={{ min: 0.75 }}
                // Left button only. r3f raises a miss for `contextmenu` too, so without the
                // guard every right-drag to look around would also drop the selection.
                onPointerMissed={(e) => e.button === 0 && onSelectItem(null)}
            >
                <Bridge handle={handle} />
                <AdaptiveDpr />

                {/* Marble bakes lighting into the scan, so this is mostly here for the
                    furniture sitting on top of it. */}
                <ambientLight intensity={1.1} />
                <hemisphereLight intensity={0.5} groundColor="#8a8378" />
                <directionalLight position={[4, 8, 4]} intensity={1.3} />

                <Suspense fallback={null}>
                    {/* The splat is the photoreal room; the mesh is the fast one and the
                        fallback if the splat can't load. The mesh stays mounted in both modes
                        but stops drawing once the splat is actually up — see `visible` below.

                        No click handler on the shell, deliberately. r3f only raycasts objects
                        that carry handlers, so giving the shell one put 206k triangles into
                        every click test — and its bounding sphere wraps the whole room, so the
                        cheap early-out never fires and all 206k get walked. Without one, a
                        click on the room is a miss and `onPointerMissed` above clears the
                        selection, which is what the handler did anyway. It also picks up that
                        guard's 2px movement threshold, so an orbit drag that happens to end on
                        a wall no longer deselects the piece you were arranging. */}
                    {room?.collider_mesh_url && (
                        <ModelBoundary>
                            <RoomShell
                                url={room.collider_mesh_url}
                                groundPlaneOffset={room.ground_plane_offset ?? 0}
                                metricScaleFactor={room.metric_scale_factor ?? 1}
                                // Hidden, not unmounted, once the splat is actually up: 206k
                                // triangles and a screenful of overdraw per frame, entirely
                                // behind an opaque splat. It stays loaded so dropping back to
                                // mesh mode — or a splat that fails — is instant.
                                visible={!(roomMode === 'splat' && splatReady)}
                            />
                        </ModelBoundary>
                    )}

                    {roomMode === 'splat' && splatUrl && (
                        // Keyed on the URL so switching detail tears the old splat down and
                        // builds the new one, rather than trying to swap a URL underneath a
                        // half-gigabyte of GPU buffers.
                        <ModelBoundary key={splatUrl}>
                            <RoomSplat url={splatUrl} onReady={setSplatReady} />
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
                    : <OrbitControls makeDefault regress enableDamping dampingFactor={0.12} target={[0, 0.8, 0]} maxPolarAngle={Math.PI / 2 + 0.2} />}
            </Canvas>

            {/* The controls hint lives in Viewport, not here: at the bottom centre it sat on
                top of the Viewfinder's status labels. */}
            <LoadingOverlay />
        </div>
    );
}
