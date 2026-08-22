import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import { Vector3 } from 'three';

/** Metres per second. A shade under a real walking pace — rooms are small. */
const SPEED = 2.4;
const SPRINT_MULTIPLIER = 2.2;

/** Standing eye height, in the metric scene RoomShell sets up. */
export const EYE_HEIGHT = 1.6;

/**
 * Scratch vectors. Walking allocated three of these every frame, which is 180 short-lived
 * Vector3s a second handed to the GC during the one mode where the frame budget is tightest.
 */
const _forward = new Vector3();
const _right = new Vector3();
const _move = new Vector3();

const BINDINGS = {
    KeyW: 'forward', ArrowUp: 'forward',
    KeyS: 'back', ArrowDown: 'back',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
};

/**
 * First-person walkthrough. Click to capture the pointer, mouse to look, WASD to move,
 * shift to hurry, escape to release.
 *
 * Movement is deliberately collisionless — you can walk through walls and furniture. Proper
 * collision against Marble's fused mesh is a much bigger job than it looks, and being able to
 * step outside the shell to look back in turns out to be useful rather than annoying. Height
 * is pinned to {@link EYE_HEIGHT} so it reads as walking rather than flying.
 */
export default function WalkControls() {
    const { camera } = useThree();
    const held = useRef(new Set());
    const sprinting = useRef(false);

    useEffect(() => {
        const down = (e) => {
            const action = BINDINGS[e.code];
            if (action) {
                held.current.add(action);
                // Arrow keys would otherwise scroll the editor behind the canvas.
                e.preventDefault();
            }
            if (e.shiftKey) sprinting.current = true;
        };
        const up = (e) => {
            const action = BINDINGS[e.code];
            if (action) held.current.delete(action);
            if (!e.shiftKey) sprinting.current = false;
        };
        // Losing focus mid-stride would otherwise leave a key stuck down forever.
        const clear = () => {
            held.current.clear();
            sprinting.current = false;
        };

        window.addEventListener('keydown', down);
        window.addEventListener('keyup', up);
        window.addEventListener('blur', clear);
        return () => {
            window.removeEventListener('keydown', down);
            window.removeEventListener('keyup', up);
            window.removeEventListener('blur', clear);
            clear();
        };
    }, []);

    useFrame((_, delta) => {
        const keys = held.current;
        if (keys.size === 0) {
            camera.position.y = EYE_HEIGHT;
            return;
        }

        camera.getWorldDirection(_forward);
        // Flattened so looking at the floor doesn't drive you into it.
        _forward.y = 0;
        _forward.normalize();

        _right.crossVectors(_forward, camera.up).normalize();
        _move.set(0, 0, 0);

        if (keys.has('forward')) _move.add(_forward);
        if (keys.has('back')) _move.sub(_forward);
        if (keys.has('right')) _move.add(_right);
        if (keys.has('left')) _move.sub(_right);

        if (_move.lengthSq() > 0) {
            // Normalised so diagonals aren't faster than the cardinals.
            _move.normalize().multiplyScalar(SPEED * (sprinting.current ? SPRINT_MULTIPLIER : 1) * delta);
            camera.position.add(_move);
        }
        camera.position.y = EYE_HEIGHT;
    });

    return <PointerLockControls makeDefault />;
}
