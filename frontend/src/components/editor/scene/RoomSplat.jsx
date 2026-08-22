import { useEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { SplatMesh, SparkRenderer } from '@sparkjsdev/spark';

/**
 * Height of the bins used to find the floor, in metres. Coarse enough that a real floor lands
 * in one bin, fine enough that a rug doesn't get mistaken for one.
 */
const BIN = 0.1;

/**
 * The histogram spans ±100m around the origin. A room is 3m tall; anything past this is a
 * floater with nothing to say about where the floor is, so it's dropped rather than clamped —
 * clamping would pile every stray splat into the end bins and invent a density peak there.
 */
const BIN_COUNT = 2000;
const BIN_ZERO = BIN_COUNT / 2;

function binOf(y) {
    const bin = Math.floor(y / BIN) + BIN_ZERO;
    return bin >= 0 && bin < BIN_COUNT ? bin : -1;
}

/**
 * Half-float -> float, as a lookup over all 65536 bit patterns.
 *
 * Built once, on the first splat load, and then a height decode is one array index. Worth the
 * 256KB: the full-res tier is 1.92M splats, so this runs nearly two million times per load.
 */
let halfFloats = null;

function halfFloatTable() {
    if (halfFloats) return halfFloats;

    halfFloats = new Float32Array(65536);
    for (let h = 0; h < 65536; h++) {
        const sign = h & 0x8000 ? -1 : 1;
        const exponent = (h >> 10) & 0x1f;
        const mantissa = h & 0x03ff;

        let magnitude;
        if (exponent === 0) {
            magnitude = mantissa * 2 ** -24; // subnormal
        } else if (exponent === 31) {
            magnitude = mantissa ? NaN : Infinity;
        } else {
            magnitude = (1 + mantissa / 1024) * 2 ** (exponent - 15);
        }
        halfFloats[h] = sign * magnitude;
    }
    return halfFloats;
}

/**
 * Bins every splat's height, which is the one thing the floor search needs.
 *
 * Reads the packed buffer directly where it can. `forEachSplat` is the tidy way in, but it
 * fully unpacks each splat before handing it over — three `Math.exp` calls for the scales, an
 * octahedral quaternion decode, a colour — all thrown away here. Across 1.92M splats that's
 * seconds of blocked main thread to read one number per splat. The centre's y is the top half
 * of word 1, so a shift and a table lookup gets it on its own.
 *
 * `packedArray` and `numSplats` are both public on Spark's `PackedSplats`, but this still
 * falls back to `forEachSplat` if the buffer isn't there — a future Spark could free it after
 * the GPU upload, and a slow floor search beats a room on the ceiling.
 */
function binHeights(mesh) {
    const bins = new Int32Array(BIN_COUNT);
    let total = 0;

    const packed = mesh.packedSplats?.packedArray;
    const count = mesh.packedSplats?.numSplats ?? 0;

    if (packed && count > 0 && packed.length >= count * 4) {
        const table = halfFloatTable();
        for (let i = 0; i < count; i++) {
            const bin = binOf(table[packed[i * 4 + 1] >>> 16]);
            if (bin >= 0) {
                bins[bin]++;
                total++;
            }
        }
    } else {
        mesh.forEachSplat((_i, center) => {
            const bin = binOf(center.y);
            if (bin >= 0) {
                bins[bin]++;
                total++;
            }
        });
    }

    return { bins, total };
}

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
 *
 * The median is read off the histogram rather than by sorting the heights. Sorting a couple of
 * million floats to learn a single one of them is the most expensive thing on the splat's load
 * path, and bin resolution is all "above the middle of the room" ever needed.
 */
function findFloor(mesh) {
    const { bins, total } = binHeights(mesh);
    if (total === 0) {
        return null;
    }

    let seen = 0;
    let medianBin = 0;
    for (let bin = 0; bin < BIN_COUNT; bin++) {
        seen += bins[bin];
        if (seen * 2 >= total) {
            medianBin = bin;
            break;
        }
    }

    let bestBin = -1;
    let bestCount = 0;
    for (let bin = medianBin; bin < BIN_COUNT; bin++) {
        if (bins[bin] > bestCount) {
            bestCount = bins[bin];
            bestBin = bin;
        }
    }

    // A flat-ish distribution means no clear floor; better to admit that than invent one.
    if (bestBin < 0 || bestCount < total * 0.02) {
        return null;
    }
    return (bestBin - BIN_ZERO) * BIN;
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
export default function RoomSplat({ url, onFloorFound, onReady }) {
    const { gl, scene } = useThree();
    const [mesh, setMesh] = useState(null);

    // One SparkRenderer per scene, and it needs the live WebGL renderer to do its sorting
    // work outside the normal render pass.
    //
    // The two tuned options are both fill rate and sort rate, which is what a 1.9M-splat room
    // is actually bound by:
    //
    // - `maxStdDev` is how far out from its centre each Gaussian is drawn. Spark's default is
    //   sqrt(8) and it documents sqrt(5)..sqrt(8) as the useful range; sqrt(5) makes every
    //   splat quad ~21% narrower, so ~37% fewer shaded pixels, for a tail that was nearly
    //   transparent anyway.
    // - `sortDistance` is how far the camera may travel before the splats are re-sorted back
    //   to front. The default 1cm means a full re-sort on essentially every frame of an orbit.
    //   At 5cm the sort runs a fraction as often, and 5cm of parallax across a 3m room isn't
    //   enough to reorder anything you can see.
    // - `clipXY` is how far past the frustum edge a splat's centre may sit before it's culled.
    //   1.4 keeps splats 40% out of frame; 1.2 still leaves a generous margin at room scale
    //   and drops a slice of what gets sorted and rasterised every frame.
    // - `maxPixelRadius` caps how large one splat may be drawn. The 512px default means a
    //   single splat can cover most of the viewport when you walk right up to a wall, which is
    //   exactly where the frame rate falls over. 256 clamps that worst case.
    useEffect(() => {
        const spark = new SparkRenderer({
            renderer: gl,
            maxStdDev: Math.sqrt(5),
            clipXY: 1.2,
            maxPixelRadius: 256,
            view: { sortDistance: 0.05 },
        });
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
                // Tells RoomScene the photoreal room is up, so it can stop drawing the
                // collider mesh underneath it. Only ever fires on success, so a splat that
                // fails to load leaves the mesh showing.
                onReady?.(true);
            })
            .catch((err) => {
                if (!cancelled) console.error('The splat failed to load', err);
            });

        return () => {
            cancelled = true;
            setMesh(null);
            // Puts the collider mesh back before this splat goes away — on a tier switch, on
            // leaving splat mode, and when ModelBoundary unmounts us after a load failure.
            onReady?.(false);
            splat.dispose();
        };
    }, [url, onFloorFound, onReady]);

    return mesh ? <primitive object={mesh} /> : null;
}
