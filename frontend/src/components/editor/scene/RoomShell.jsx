import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { Box3, MeshBasicMaterial } from 'three';

/**
 * The scanned room itself — Marble's collider mesh.
 *
 * Put into a scene where a metre is a metre and the floor is y=0, so every other number in
 * the editor reads as a real-world measurement. `metric_scale_factor` does part of it: the
 * test scan measures 3.262 native units tall, which at its factor of 0.862 is a 2.81m
 * floor-to-ceiling room — right for a real room, so the factor is doing what it claims.
 *
 * **Marble's frame is Y-down**, hence the 180° flip about X. This is easy to get backwards
 * and both assets look plausible upside down — a floor and a ceiling are both big flat
 * horizontal surfaces. What settles it is the lighting baked into the scan: on the test room
 * the brightest 0.1% of splats sit at y≈-0.64, hard against the surface at -0.8, while the
 * darkest gather at y≈+1.5. The bright band is a ceiling light and shadow pools low, so the
 * surface at -0.8 is the ceiling and the floor is the *largest* y. See RoomSplat, where the
 * same test is what fixed this.
 *
 * The floor height is measured off the mesh rather than taken from `ground_plane_offset`. On
 * the test scan that field reads 1.610 while the mesh's floor is at 1.719 metric — 11cm out,
 * enough to leave furniture hovering. It ships under the *splats'* `semantics_metadata`, so
 * it likely describes a frame that isn't quite the mesh's. It stays as a fallback for a mesh
 * with no usable bounds.
 *
 * Clicking the shell clears the selection — it's empty space as far as the editor is
 * concerned. That's handled by the Canvas's `onPointerMissed` rather than a handler here, on
 * purpose: r3f only raycasts objects carrying event handlers, and a handler here would put
 * 206k triangles into every click test. See RoomScene for the full note.
 *
 * Nothing here is editable: Marble's output is a single fused mesh with no per-object
 * structure to pull apart.
 */
/**
 * The scan arrives as bare geometry: `COLOR_0` vertex colours, `materials: []`, no textures.
 * glTF gives a primitive with no material three's default MeshStandardMaterial, which has
 * `vertexColors: false` — so every colour in the file is loaded and then ignored, and the room
 * renders flat grey. Turning vertex colours on is what makes the scan look like the room.
 *
 * Basic rather than Standard because photogrammetry colour already has the room's real
 * lighting baked into it; relighting it would be lighting it twice. Same reasoning for
 * `toneMapped: false` — the Canvas tone-maps by default, which mutes colour that is already
 * finished.
 */
function scanMaterial() {
  return new MeshBasicMaterial({ vertexColors: true, toneMapped: false });
}

export default function RoomShell({ url, groundPlaneOffset = 0, metricScaleFactor = 1, visible = true }) {
  const { scene } = useGLTF(url);

  // Cloned so React's reconciler owns an instance per mount; useGLTF caches the original and
  // hands the same object to every caller. Assigning materials on the clone leaves the cached
  // original alone.
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((object) => {
      if (object.isMesh && object.geometry?.attributes?.color) {
        object.material = scanMaterial();
      }
    });
    return clone;
  }, [scene]);

  const floorLift = useMemo(() => {
    // setFromObject walks node transforms, so this is the real floor, not just the raw
    // POSITION accessor bounds. max, not min: Marble's frame is Y-down, so the floor is the
    // largest y. The 180° flip below then turns that into a world floor at y=0.
    const box = new Box3().setFromObject(model);
    return Number.isFinite(box.max.y)
      ? box.max.y * metricScaleFactor
      : groundPlaneOffset * metricScaleFactor;
  }, [model, metricScaleFactor, groundPlaneOffset]);

  return (
    <primitive
      object={model}
      scale={metricScaleFactor}
      rotation={[Math.PI, 0, 0]}
      position={[0, floorLift, 0]}
      // Stays mounted but stops drawing once the splat covers it — see RoomScene. It's still
      // loaded and one prop away from being the visible room again if the splat goes.
      visible={visible}
    />
  );
}
