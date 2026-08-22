import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { Box3, MeshBasicMaterial } from 'three';

/**
 * The scanned room itself — Marble's collider mesh.
 *
 * Put into a scene where a metre is a metre and the floor is y=0, so every other number in
 * the editor reads as a real-world measurement. `metric_scale_factor` does the first half:
 * the test scan measures 3.262 native units tall, which at its factor of 0.862 is a 2.81m
 * floor-to-ceiling room — right for a real room, so the factor is doing what it claims.
 *
 * The floor height is the mesh's own lowest point rather than Marble's `ground_plane_offset`,
 * which is a deliberate departure from what that field is meant for. On the test scan the
 * mesh bottoms out at -1.267 native units while the offset reads 1.610; under either scaling
 * convention that's ~30cm apart, and following the offset drops every piece of furniture
 * through the floor. The likely reason is that the offset ships under the *splats'*
 * `semantics_metadata` and describes the splat frame, which needn't match the collider mesh's.
 * The lowest point of a room scan is its floor, so measuring is both simpler and reliable
 * here; the offset stays as a fallback for a mesh with no usable bounds.
 *
 * Clicking the shell clears the selection — it's empty space as far as the editor is
 * concerned. Nothing here is editable: Marble's output is a single fused mesh with no
 * per-object structure to pull apart.
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

export default function RoomShell({ url, groundPlaneOffset = 0, metricScaleFactor = 1, onClick }) {
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
    // setFromObject walks node transforms, so this is the real world-space floor, not just
    // the raw POSITION accessor bounds.
    const box = new Box3().setFromObject(model);
    return Number.isFinite(box.min.y)
      ? -box.min.y * metricScaleFactor
      : groundPlaneOffset * metricScaleFactor;
  }, [model, metricScaleFactor, groundPlaneOffset]);

  return (
    <primitive
      object={model}
      scale={metricScaleFactor}
      position={[0, floorLift, 0]}
      onClick={onClick}
    />
  );
}
