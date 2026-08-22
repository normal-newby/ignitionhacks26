import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Vector3, MOUSE } from 'three';

/** Metres per second. A shade under a real walking pace — rooms are small. */
const MOVE_SPEED = 2.4;
const SPRINT_MULTIPLIER = 2.2;
const ASCEND_DESCEND_SPEED = 1.5;

/** Standing eye height, in the metric scene RoomShell sets up. */
export const EYE_HEIGHT = 1.6;

/**
 * Unified camera controls that combine:
 * - WASD movement (like walk mode)
 * - EQ for ascending/descending
 * - Mouse drag with left click for rotation (like orbit mode)
 * - Mouse drag with right click for panning
 * - Mouse wheel for zooming in/out
 */
export default function UnifiedControls({ makeDefault = true }) {
    const { camera, gl } = useThree();
    const controlsRef = useRef(null);

    // Track keyboard state
    const keys = useRef({
        forward: false,
        back: false,
        left: false,
        right: false,
        ascend: false,
        descend: false,
        sprint: false
    });

    // Track if mouse is being used for rotation/pan
    const isMouseControlling = useRef(false);

    // Initial camera position - similar to orbit mode's starting position
    useEffect(() => {
        camera.position.set(3.2, 2.4, 3.6);
        camera.lookAt(0, 0.8, 0);
    }, [camera]);

    // Keyboard event handlers
    useEffect(() => {
        const handleKeyDown = (e) => {
            switch (e.code) {
                case 'KeyW': keys.current.forward = true; break;
                case 'KeyA': keys.current.left = true; break;
                case 'KeyS': keys.current.back = true; break;
                case 'KeyD': keys.current.right = true; break;
                case 'KeyE': keys.current.ascend = true; break;
                case 'KeyQ': keys.current.descend = true; break;
                case 'ShiftLeft':
                case 'ShiftRight': keys.current.sprint = true; break;
            }
        };

        const handleKeyUp = (e) => {
            switch (e.code) {
                case 'KeyW': keys.current.forward = false; break;
                case 'KeyA': keys.current.left = false; break;
                case 'KeyS': keys.current.back = false; break;
                case 'KeyD': keys.current.right = false; break;
                case 'KeyE': keys.current.ascend = false; break;
                case 'KeyQ': keys.current.descend = false; break;
                case 'ShiftLeft':
                case 'ShiftRight': keys.current.sprint = false; break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    // Mouse event handlers to track when mouse is controlling camera
    useEffect(() => {
        const controls = controlsRef.current;
        if (!controls) return;

        const handleMouseDown = () => {
            isMouseControlling.current = true;
        };

        const handleMouseUp = () => {
            isMouseControlling.current = false;
        };

        const canvas = gl.domElement;
        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('mouseleave', handleMouseUp);

        return () => {
            canvas.removeEventListener('mousedown', handleMouseDown);
            canvas.removeEventListener('mouseup', handleMouseUp);
            canvas.removeEventListener('mouseleave', handleMouseUp);
        };
    }, [gl]);

    // Movement logic
    useFrame((state, delta) => {
        if (isMouseControlling.current) return;

        const { forward, back, left, right, ascend, descend, sprint } = keys.current;

        // Scratch vectors for movement calculations
        const _move = new Vector3();
        const _forward = new Vector3();
        const _right = new Vector3();

        // Get camera direction vectors
        camera.getWorldDirection(_forward);
        _forward.y = 0; // Keep movement horizontal
        _forward.normalize();

        _right.crossVectors(new Vector3(0, 1, 0), _forward);

        // Calculate movement based on keyboard input
        if (forward) _move.add(_forward);
        if (back) _move.sub(_forward);
        if (right) _move.add(_right);
        if (left) _move.sub(_right);

        // Apply horizontal movement
        if (_move.lengthSq() > 0) {
            _move.normalize();
            const speed = MOVE_SPEED * (sprint ? SPRINT_MULTIPLIER : 1);
            _move.multiplyScalar(speed * delta);
            camera.position.add(_move);
        }

        // Apply vertical movement (ascend/descend)
        let verticalMovement = 0;
        if (ascend) verticalMovement += ASCEND_DESCEND_SPEED * delta;
        if (descend) verticalMovement -= ASCEND_DESCEND_SPEED * delta;

        if (verticalMovement !== 0) {
            camera.position.y += verticalMovement;
        }
    });

    return (
        <OrbitControls
            ref={controlsRef}
            makeDefault={makeDefault}
            regress
            enableDamping
            dampingFactor={0.12}
            target={[0, 0.8, 0]}
            maxPolarAngle={Math.PI / 2 + 0.2}
            // Left click rotates, right click pans, middle/mousewheel zooms
            mouseButtons={{
                LEFT: MOUSE.ROTATE,
                MIDDLE: MOUSE.DOLLY,
                RIGHT: MOUSE.PAN
            }}
            // Enable keyboard controls for orbit (in addition to our custom WASD)
            enableKeys={false} // We handle keys ourselves
            screenSpacePanning={false}
        />
    );
}