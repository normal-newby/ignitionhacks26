import { useEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { SplatMesh, SparkRenderer } from '@sparkjsdev/spark';

/**
 * Height of the bins used to find the floor, in metres. Coarse enough that a real floor lands
 * in one bin, fine enough that a rug doesn't get mistaken for one.
 */
const BIN = 0.1;

/**
 * Finds the floor: the densest horizontal band of splats *above* the median height.
 *
 * Above, because Marble's frame is Y-down — the floor is the largest y. Density alone can't
 * tell you which band is which, and picking the denser one gets it wrong here: the test
 * scan's ceiling holds 168k splats against the floor's 62k, so "densest band" finds the
 * ceiling and hangs the whole room upside down.
 *
 * Bounds can't decide it either. Splat clouds are full of floaters — the test scan's box
 * reaches y=10.2 with the room only 2.75m tall — which is also why this looks for a density
 * peak rather than a min or max, and why it declines to guess when no band stands out.
 */
function findFloor(mesh) {
    const ys = [];
    mesh.forEachSplat((_i, center) => ys.push(center.y));
    if (ys.length === 0) {
        return null;
    }

    ys.sort((a, b) => a - b);
    const median = ys[Math.floor(ys.length / 2)];

    const bins = new Map();
    let bestBin = null;
    let bestCount = 0;
    for (const y of ys) {
        if (y < median) continue;
        const bin = Math.floor(y / BIN);
        const count = (bins.get(bin) ?? 0) + 1;
        bins.set(bin, count);
        if (count > bestCount) {
            bestCount = count;
            bestBin = bin;
        }
    }

    // A flat-ish distribution means no clear floor; better to admit that than invent one.
    if (bestBin === null || bestCount < ys.length * 0.02) {
        return null;
    }
    return bestBin * BIN;
}

/**
 * The photoreal version of the room: Marble's Gaussian splat, rendered with Spark.
 *
 * This is the same room as {@link RoomShell} but from the other asset. The collider mesh is
 * 103k triangles built for collision, so it always looks soft; the splat is what the scan
 * actually saw.
 *
 * Two things that are not obvious, both settled by measurement rather than by reading:
 *
 * - **It needs the 180° flip** that Spark's quickstart does with `quaternion.set(1, 0, 0, 0)`.
 *   Marble's frame is Y-down like its sample asset. Nothing structural gives this away — a
 *   floor and a ceiling are both large flat horizontal surfaces, and the room looks perfectly
 *   reasonable upside down until you notice the light fitting underfoot. The tell is the
 *   lighting baked into the colours: the brightest 0.1% of splats sit at y≈-0.64, against the
 *   surface at -0.8, and the darkest average y≈+1.5. Ceiling lights are the brightest thing
 *   in a room and shadow gathers low, so -0.8 is the ceiling.
 * - **No metric scaling.** Unlike the mesh, the splat already measures ~2.75m floor to
 *   ceiling, matching the mesh's 2.81m after its `metric_scale_factor`. Applying the factor
 *   here as well would shrink the room to 2.37m and furniture would no longer fit it.
 */
export default function RoomSplat({ url, onFloorFound }) {
    const { gl, scene } = useThree();
    const [mesh, setMesh] = useState(null);

    // One SparkRenderer per scene, and it needs the live WebGL renderer to do its sorting
    // work outside the normal render pass.
    useEffect(() => {
        const spark = new SparkRenderer({ renderer: gl });
        scene.add(spark);
        return () => {
            scene.remove(spark);
        };
    }, [gl, scene]);

    useEffect(() => {
        if (!url) return undefined;

        let cancelled = false;
        const splat = new SplatMesh({ url });

        // Y-down -> Y-up. 180° about X, so y and z both negate.
        splat.quaternion.set(1, 0, 0, 0);

        splat.initialized
            .then(() => {
                if (cancelled) return;
                const floor = findFloor(splat);
                if (floor !== null) {
                    // The flip put the floor at -floor; lift it back to y=0.
                    splat.position.y = floor;
                }
                onFloorFound?.(floor);
                setMesh(splat);
            })
            .catch((err) => {
                if (!cancelled) console.error('The splat failed to load', err);
            });

        return () => {
            cancelled = true;
            setMesh(null);
            splat.dispose();
        };
    }, [url, onFloorFound]);

    return mesh ? <primitive object={mesh} /> : null;
}
