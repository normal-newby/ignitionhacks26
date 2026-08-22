import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Euler, Vector3 } from 'three';

/** Metres per second. A shade under a real walking pace — rooms are small. */
const MOVE_SPEED = 2.4;
const SPRINT_MULTIPLIER = 2.2;
const ASCEND_DESCEND_SPEED = 1.5;

/** Metres of dolly per wheel notch. */
const WHEEL_STEP = 0.25;

/** Standing eye height, in the metric scene RoomShell sets up. */
export const EYE_HEIGHT = 1.6;

/** Radians of turn per pixel of drag. A full 180° is about the width of the viewport. */
const LOOK_SENSITIVITY = 0.0025;

/** Stops just short of straight up and straight down, where a YXZ euler flips over. */
const PITCH_LIMIT = Math.PI / 2 - 0.01;

/** Bit 1 of a MouseEvent's `buttons` mask: the right button. */
const RIGHT_BUTTON_HELD = 2;

/**
 * Scratch. Rebuilding these inside useFrame is three short-lived Vector3s per frame — 180 a
 * second handed to the GC, during the one mode where the frame budget is tightest.
 */
const _forward = new Vector3();
const _right = new Vector3();
const _move = new Vector3();
const _euler = new Euler(0, 0, 0, 'YXZ');
const WORLD_UP = new Vector3(0, 1, 0);

/** Whether the keystroke belongs to a text field rather than to the room. */
function isTyping(target) {
    if (!target) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

/**
 * Freezes the cursor for the duration of a look-drag.
 *
 * Pointer lock is the only thing that stops the OS cursor travelling across the screen while
 * the mouse moves, and on release it comes back exactly where it was left. `unadjustedMovement`
 * turns off OS pointer acceleration, which otherwise makes a slow drag and a fast one cover
 * different angles for the same distance. Chrome rejects the request if it can't honour that
 * option, hence the plain retry; Firefox and Safari take no options and simply ignore it.
 *
 * Every failure path is survivable: without the lock the look still works off `movementX`, the
 * cursor just travels. So nothing here throws or blocks.
 */
function lockPointer(element) {
    if (document.pointerLockElement === element) return;
    try {
        const request = element.requestPointerLock({ unadjustedMovement: true });
        if (request && typeof request.catch === 'function') {
            request.catch(() => {
                try {
                    element.requestPointerLock();
                } catch {
                    /* look unlocked */
                }
            });
        }
    } catch {
        /* look unlocked */
    }
}

/**
 * The camera. All of it — there is one mode, standing in the room.
 *
 * - **Right-drag looks around**, with the cursor locked in place for the drag (see
 *   {@link lockPointer}). Left stays free for picking furniture and dragging its gizmo.
 * - WASD walks, Q/E drop and rise, shift hurries, the wheel dollies along the view.
 *
 * ## Why this stopped using OrbitControls
 *
 * Right-drag used to be `MOUSE.PAN` on an `OrbitControls` pinned to `target=[0, 0.8, 0]`, and
 * it worked *sometimes*: OrbitControls scales a pan by the distance from the camera to its
 * target, and WASD moves the camera without moving the target. Walk up to the middle of the
 * room — where the target sits — and the pan distance goes to nearly zero, so the drag does
 * nothing. Walk past it and left-drag orbits you around a point behind your head. A fixed
 * orbit point and free first-person movement can't both be true, and the intermittency was
 * that contradiction showing through, not a flaky event handler.
 *
 * Driving the camera directly also means no `makeDefault` controls object, so drei's
 * TransformControls has nothing to disable mid-gizmo-drag, and the two never interact.
 */
export default function UnifiedControls() {
    const { camera, gl, performance } = useThree();

    const keys = useRef({
        forward: false,
        back: false,
        left: false,
        right: false,
        ascend: false,
        descend: false,
        sprint: false,
    });
    const looking = useRef(false);

    // Stand up in the middle of the room, facing away from the camera's start corner.
    useEffect(() => {
        camera.position.set(0, EYE_HEIGHT, 0);
        camera.lookAt(0, EYE_HEIGHT, -2);
    }, [camera]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            // Nothing else could hold focus back when this was a pointer lock; the inspector's
            // coordinate boxes and the top bar's room name can now, and "Wardrobe" shouldn't
            // walk you across the room.
            if (isTyping(e.target)) return;

            switch (e.code) {
                case 'KeyW': case 'ArrowUp': keys.current.forward = true; break;
                case 'KeyA': case 'ArrowLeft': keys.current.left = true; break;
                case 'KeyS': case 'ArrowDown': keys.current.back = true; break;
                case 'KeyD': case 'ArrowRight': keys.current.right = true; break;
                case 'KeyE': keys.current.ascend = true; break;
                case 'KeyQ': keys.current.descend = true; break;
                case 'ShiftLeft': case 'ShiftRight': keys.current.sprint = true; break;
                default: return;
            }
            // Arrow keys would otherwise scroll the editor behind the canvas.
            e.preventDefault();
        };

        const handleKeyUp = (e) => {
            switch (e.code) {
                case 'KeyW': case 'ArrowUp': keys.current.forward = false; break;
                case 'KeyA': case 'ArrowLeft': keys.current.left = false; break;
                case 'KeyS': case 'ArrowDown': keys.current.back = false; break;
                case 'KeyD': case 'ArrowRight': keys.current.right = false; break;
                case 'KeyE': keys.current.ascend = false; break;
                case 'KeyQ': keys.current.descend = false; break;
                case 'ShiftLeft': case 'ShiftRight': keys.current.sprint = false; break;
            }
        };

        // Losing focus mid-stride would otherwise leave a key stuck down forever.
        const clearKeys = () => { keys.current = {
            forward: false, back: false, left: false, right: false,
            ascend: false, descend: false, sprint: false,
        }; };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', clearKeys);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', clearKeys);
        };
    }, []);

    /**
     * Right-drag to look.
     *
     * Mouse events rather than pointer events, because `mousemove` under a pointer lock is the
     * one thing the Pointer Lock spec actually guarantees. Move and release go on `window`, so
     * a drag doesn't die at the edge of the canvas.
     */
    useEffect(() => {
        const element = gl.domElement;

        const stop = () => {
            if (!looking.current) return;
            looking.current = false;
            element.style.cursor = '';
            if (document.pointerLockElement === element) document.exitPointerLock();
        };

        const handleMouseDown = (e) => {
            if (e.button !== 2) return;
            e.preventDefault();
            looking.current = true;
            element.style.cursor = 'none';
            lockPointer(element);
        };

        const handleMouseMove = (e) => {
            if (!looking.current) return;
            // Self-heal: the button was released somewhere we never heard about — over the
            // browser's own chrome, or during an alert. Without this the camera keeps turning
            // with nothing held down, which is exactly what a stuck look-drag feels like.
            if ((e.buttons & RIGHT_BUTTON_HELD) === 0) {
                stop();
                return;
            }

            _euler.setFromQuaternion(camera.quaternion);
            _euler.y -= e.movementX * LOOK_SENSITIVITY;
            _euler.x -= e.movementY * LOOK_SENSITIVITY;
            _euler.x = Math.min(PITCH_LIMIT, Math.max(-PITCH_LIMIT, _euler.x));
            // No roll, ever. A tilted horizon in a room reads as a bug.
            _euler.z = 0;
            camera.quaternion.setFromEuler(_euler);

            performance.regress();
        };

        const handleMouseUp = (e) => {
            if (e.button === 2) stop();
        };

        // Right-drag in a 3D view is a look, not a menu.
        const handleContextMenu = (e) => e.preventDefault();

        /** Escape releases the lock; the drag has to end with it or the camera runs on. */
        const handleLockChange = () => {
            if (looking.current && document.pointerLockElement !== element) stop();
        };

        const handleWheel = (e) => {
            e.preventDefault();
            camera.getWorldDirection(_forward);
            camera.position.addScaledVector(_forward, -Math.sign(e.deltaY) * WHEEL_STEP);
            performance.regress();
        };

        element.addEventListener('mousedown', handleMouseDown);
        element.addEventListener('contextmenu', handleContextMenu);
        // Not passive: the wheel dollies the camera instead of scrolling the page.
        element.addEventListener('wheel', handleWheel, { passive: false });
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('blur', stop);
        document.addEventListener('pointerlockchange', handleLockChange);

        return () => {
            element.removeEventListener('mousedown', handleMouseDown);
            element.removeEventListener('contextmenu', handleContextMenu);
            element.removeEventListener('wheel', handleWheel);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('blur', stop);
            document.removeEventListener('pointerlockchange', handleLockChange);
            stop();
        };
    }, [camera, gl, performance]);

    useFrame((_, delta) => {
        const { forward, back, left, right, ascend, descend, sprint } = keys.current;
        if (!forward && !back && !left && !right && !ascend && !descend) return;

        camera.getWorldDirection(_forward);
        // Flattened so looking at the floor doesn't drive you into it.
        _forward.y = 0;
        _forward.normalize();

        // forward × up, not up × forward: the other order points left, which had D strafing
        // the wrong way.
        _right.crossVectors(_forward, WORLD_UP).normalize();

        _move.set(0, 0, 0);
        if (forward) _move.add(_forward);
        if (back) _move.sub(_forward);
        if (right) _move.add(_right);
        if (left) _move.sub(_right);

        if (_move.lengthSq() > 0) {
            // Normalised so diagonals aren't faster than the cardinals.
            _move.normalize().multiplyScalar(MOVE_SPEED * (sprint ? SPRINT_MULTIPLIER : 1) * delta);
            camera.position.add(_move);
        }

        if (ascend) camera.position.y += ASCEND_DESCEND_SPEED * delta;
        if (descend) camera.position.y -= ASCEND_DESCEND_SPEED * delta;

        // What `regress` on OrbitControls used to do: tells AdaptiveDpr the camera is moving,
        // so the splat renders at reduced resolution until it settles.
        performance.regress();
    });

    return null;
}
