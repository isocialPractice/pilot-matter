/**
 * The build camera - where the view stands while a canvas is being built.
 *
 * Build mode is not flight, so it does not use the flight camera: that one
 * chases an aircraft, and a canvas has no aircraft to chase. What it has is a
 * middle, four edges, and a pilot who needs to see across it.
 *
 * It starts from the hold - one framing over the canvas, worked out from the
 * canvas's own size - and is moved from there as an orbit: a target on the
 * ground, a distance, a yaw and a pitch, every one a plain number. The wheel,
 * a drag and the keys are each a named function over that state, returning a
 * new one, so a panel that writes `TARGET z` later has somewhere to write it
 * that is not a matrix.
 *
 * Pure module in the shape of `js/camera-math.js`, with no DOM or Three.js
 * dependency, so where the camera stands can be unit tested in Node and the
 * renderer's side of it is a few lines that copy the result onto a camera.
 */

import { TILE_REACH } from './world-tiles.js';
import { SELECT_TOOL } from './build-tools.js';

/**
 * How far the view is tilted down from the horizon, in degrees.
 *
 * Steep enough to read the canvas as a square being worked on rather than as
 * country being flown over, and short of straight down, which would lose every
 * bit of relief the ground has.
 */
export const CANVAS_PITCH = 55;

/**
 * How far back the camera stands, as a fraction of the canvas it is looking at.
 *
 * Written against the canvas rather than as a number of units because what it
 * has to do is frame the canvas: a distance that framed a 16000-unit square
 * would be the wrong distance for any other.
 */
export const CANVAS_STANDOFF = 0.95;

/**
 * How far the camera can see over a canvas, as a multiple of the canvas size.
 *
 * The flight's far plane is `TILE_REACH`, which is the ground the fog is
 * promising, and it is shorter than the diagonal of one tile. That is right for
 * a flight and wrong here: the canvas's far corner is the extent of what is
 * being built, so it has to be drawn rather than clipped away.
 *
 * And it has to be drawn from wherever the camera can be taken, not only from
 * the hold. The furthest the camera stands is the hold's distance, from a
 * target that can be panned to a corner, so the corner opposite is that
 * distance and the diagonal away at most: `CANVAS_STANDOFF + Math.SQRT2`, about
 * 2.36, with room above it for ground that rises off the plane.
 */
export const CANVAS_FAR = 2.5;

/**
 * How much of the flight's fog is left over a canvas.
 *
 * The flight's air is thick on purpose - it is what keeps the end of the ground
 * out of frame - and a canvas is the opposite case. Its four edges are the
 * extent of what is being built and are there to be seen, so the air is cleared
 * to where the far corner still reads as ground rather than as sky.
 */
export const CANVAS_FOG = 0.06;

/** How far the view can tilt, in degrees off the horizon: never flat, never straight down. */
export const MIN_PITCH = 10;
export const MAX_PITCH = 85;

/**
 * How close the camera can come, as a fraction of the canvas: 320 units over
 * the default 16000, near enough to work a single hill and far enough that the
 * view is still of ground rather than of one vertex.
 */
export const CANVAS_NEAREST = 0.02;

/** How far a drag of one pixel turns the view, in degrees. */
export const ORBIT_DEGREES_PER_PIXEL = 0.25;

/**
 * How much a wheel pixel zooms, as a fraction of the distance it moves. A
 * fraction rather than a number of units, so a notch moves the view by the same
 * share of what is in frame whether it is close in or framing the whole canvas.
 */
export const ZOOM_PER_PIXEL = 0.0015;

/**
 * How fast a held key moves the target, as a share of the distance per second:
 * half of what is in frame each second, which crosses the view in about two -
 * quick enough to travel, slow enough to stop where the eye wanted to.
 */
export const MOVE_RATE = 0.5;

/**
 * The longest a single frame may move the view for, in seconds. A frame that
 * arrives after the tab was hidden carries the whole time it was hidden, and a
 * key held across that would throw the target off the canvas in one step.
 */
export const MAX_MOVE_STEP = 0.1;

/** How far the camera is kept above the ground under it, in units. */
export const CAMERA_CLEARANCE = 40;

/** The two things a press on the canvas can drive the camera to do. */
export const CAMERA_ORBIT = 'orbit';
export const CAMERA_PAN   = 'pan';

/**
 * Which press drives which gesture, by button and by whether `shift` was down
 * at the press.
 *
 * Select is the navigation state, so its left drag orbits and its middle drag
 * pans. `shift` and the right button pans from any tool, which is how the view
 * is reached from inside a drawing tool - and it pans in Select as well, which
 * a laptop's trackpad needs, having no middle button.
 *
 * One table, read by the handler and by the control list alike, so the list
 * cannot describe a gesture the canvas does not answer to. `tools` of null is
 * every tool.
 */
export const CAMERA_GESTURES = Object.freeze([
    Object.freeze({ gesture: CAMERA_ORBIT, button: 0, shift: false, tools: Object.freeze([SELECT_TOOL]) }),
    Object.freeze({ gesture: CAMERA_PAN,   button: 1, shift: false, tools: Object.freeze([SELECT_TOOL]) }),
    Object.freeze({ gesture: CAMERA_PAN,   button: 2, shift: true,  tools: null })
]);

/**
 * The keys that move the target across the ground, relative to the view: the
 * `MOVE` fields of Select's panel, as keys. Each direction's keys are listed as
 * alternatives, letters first, so the control list reads them `W/A/S/D or
 * ↑/←/↓/→`.
 */
export const BUILD_MOVE_KEYS = Object.freeze({
    forward: Object.freeze(['KeyW', 'ArrowUp']),
    left:    Object.freeze(['KeyA', 'ArrowLeft']),
    back:    Object.freeze(['KeyS', 'ArrowDown']),
    right:   Object.freeze(['KeyD', 'ArrowRight'])
});

/** The key that puts the hold back. */
export const REFRAME_KEYS = Object.freeze(['Home']);

const RADIANS = Math.PI / 180;

const clamp = (value, low, high) => Math.min(Math.max(value, low), high);

/**
 * How far back the hold stands: the share of the canvas `CANVAS_STANDOFF` gives,
 * held inside what the camera can see.
 */
function holdDistance(span, far) {
    const limit = far > 0 ? far : canvasFarPlane(span);
    return Math.min(span * CANVAS_STANDOFF, limit);
}

/**
 * Where the camera stands over a canvas, and what it looks at.
 *
 * The target is the middle of the canvas at ground level, which is the middle
 * of the home tile - a canvas is one tile and the world is laid out from the
 * middle of it. The camera stands back along one axis and up by the pitch, so
 * the view is square to the canvas rather than at a corner of it: an edge being
 * worked to reads as an edge when it is parallel to the frame.
 *
 * The distance is held inside what the camera can see, so a canvas bigger than
 * the far plane is framed as far as the far plane allows rather than being
 * placed where the whole of it would be clipped.
 */
export function canvasCamera(size = 0, { pitch = CANVAS_PITCH, far = 0 } = {}) {
    const span = Math.max(Number(size) || 0, 0);
    const away = holdDistance(span, far);
    const tilt = Math.max(Math.min(Number(pitch) || 0, 89), 1) * RADIANS;

    return {
        target:   { x: 0, y: 0, z: 0 },
        position: { x: 0, y: away * Math.sin(tilt), z: away * Math.cos(tilt) }
    };
}

/**
 * How far the camera over a canvas has to be able to see, which is past the
 * canvas's far corner from wherever the camera can be taken.
 *
 * A canvas smaller than the flight's own reach keeps that reach, so the hold
 * never shortens what was already being drawn.
 */
export function canvasFarPlane(size = 0) {
    const span = Math.max(Number(size) || 0, 0);
    return Math.max(span * CANVAS_FAR, TILE_REACH);
}

/**
 * The camera over a canvas as state that can be moved: seeded from the hold,
 * so the first frame of a session is exactly the frame the hold always drew.
 *
 * It carries its own bounds - how near, how far, and how far from the middle
 * the target may go - worked out from the canvas once, so a gesture is a
 * function of the state alone.
 */
export function createBuildCamera(size = 0, { far = 0 } = {}) {
    const span     = Math.max(Number(size) || 0, 0);
    const distance = holdDistance(span, far);

    return {
        target:   { x: 0, y: 0, z: 0 },
        distance,
        yaw:      0,
        pitch:    CANVAS_PITCH,
        // The hold frames the whole canvas, so it is the furthest out a zoom
        // goes; nearer than a hill is a view of one vertex.
        nearest:  Math.min(span * CANVAS_NEAREST, distance),
        furthest: distance,
        // The target stays over the canvas, so the thing being built cannot be
        // pushed out of frame.
        reach:    span / 2
    };
}

/** Where the camera stands for a state, and what it looks at. */
export function buildCameraPosition(state) {
    const yaw   = state.yaw * RADIANS;
    const pitch = clamp(state.pitch, 1, 89) * RADIANS;
    const flat  = state.distance * Math.cos(pitch);
    const { target } = state;

    return {
        target: { ...target },
        position: {
            x: target.x + flat * Math.sin(yaw),
            y: target.y + state.distance * Math.sin(pitch),
            z: target.z + flat * Math.cos(yaw)
        }
    };
}

/**
 * The ground directions the view faces along: `ahead` into the screen and
 * `right` across it, both level. At a yaw of 0 the camera stands back along z,
 * so ahead is toward -z and right is +x.
 */
function groundAxes(yaw) {
    const turn = yaw * RADIANS;
    return {
        ahead: { x: -Math.sin(turn), z: -Math.cos(turn) },
        right: { x:  Math.cos(turn), z: -Math.sin(turn) }
    };
}

function withTarget(state, x, z) {
    const reach = Math.max(state.reach, 0);
    return { ...state, target: { ...state.target, x: clamp(x, -reach, reach), z: clamp(z, -reach, reach) } };
}

/**
 * Turns the view by a drag. Across the screen turns it about the target, the
 * ground following the pointer; down the screen tilts it toward looking
 * straight down, held off both poles. The distance and the target do not move.
 */
export function orbitBuildCamera(state, dx = 0, dy = 0) {
    return {
        ...state,
        yaw:   state.yaw - (Number(dx) || 0) * ORBIT_DEGREES_PER_PIXEL,
        pitch: clamp(state.pitch + (Number(dy) || 0) * ORBIT_DEGREES_PER_PIXEL, MIN_PITCH, MAX_PITCH)
    };
}

/**
 * Slides the view by a drag, the ground following the pointer: the target
 * moves the other way across the ground, by what one pixel spans at the
 * target's distance. The distance and the angles do not move.
 *
 * Down the screen is foreshortened on tilted ground, so a vertical drag is
 * stretched by the pitch to keep the ground under the pointer rather than
 * slipping behind it.
 */
export function panBuildCamera(state, dx = 0, dy = 0, { viewHeight = 1, fov = 70 } = {}) {
    const perPixel = 2 * state.distance * Math.tan((Number(fov) || 70) * RADIANS / 2) / Math.max(Number(viewHeight) || 1, 1);
    const stretch  = 1 / Math.sin(clamp(state.pitch, MIN_PITCH, MAX_PITCH) * RADIANS);
    const { ahead, right } = groundAxes(state.yaw);
    const across = -(Number(dx) || 0) * perPixel;
    const along  =  (Number(dy) || 0) * perPixel * stretch;

    return withTarget(state,
        state.target.x + right.x * across + ahead.x * along,
        state.target.z + right.z * across + ahead.z * along);
}

/**
 * Moves the target across the ground on held keys: `forward` into the screen
 * and `right` across it, each -1, 0 or 1, by a share of the distance per second
 * of real time. The simulation's own clock is stopped for as long as the
 * builder is open, so this is handed the clock's real delta - and nothing at
 * all moves on a frame handed none.
 */
export function moveBuildCamera(state, { forward = 0, right = 0 } = {}, elapsed = 0) {
    const step = state.distance * MOVE_RATE * clamp(Number(elapsed) || 0, 0, MAX_MOVE_STEP);
    if (step === 0 || (forward === 0 && right === 0)) return state;

    const axes = groundAxes(state.yaw);
    return withTarget(state,
        state.target.x + (axes.ahead.x * forward + axes.right.x * right) * step,
        state.target.z + (axes.ahead.z * forward + axes.right.z * right) * step);
}

/**
 * Zooms by a wheel's travel in pixels: down the page is out, up is in, each as
 * a share of the distance, held between the nearest and the hold. The target
 * does not move - the wheel zooms toward the middle of the screen until the
 * ground under the pointer can be found.
 */
export function zoomBuildCamera(state, pixels = 0) {
    const distance = state.distance * Math.exp((Number(pixels) || 0) * ZOOM_PER_PIXEL);
    return { ...state, distance: clamp(distance, state.nearest, state.furthest) };
}

/** Puts the hold back: the middle of the canvas, square to it, framing the whole of it. */
export function reframeBuildCamera(state) {
    return { ...state, target: { x: 0, y: 0, z: 0 }, distance: state.furthest, yaw: 0, pitch: CANVAS_PITCH };
}

/**
 * Which gesture a press drives, from its button, whether `shift` was down, and
 * the live tool - or null for a press the camera does not take.
 */
export function cameraGesture({ button, shiftKey = false } = {}, tool = SELECT_TOOL) {
    const match = CAMERA_GESTURES.find(entry =>
        entry.button === button
        && entry.shift === Boolean(shiftKey)
        && (entry.tools === null || entry.tools.includes(tool)));
    return match ? match.gesture : null;
}

/**
 * A wheel's travel in pixels, whatever unit the browser reported it in: some
 * report lines and a few report pages, and a notch should zoom the same either
 * way.
 */
export function wheelPixels(deltaY = 0, deltaMode = 0) {
    const scale = deltaMode === 1 ? 16 : deltaMode === 2 ? 800 : 1;
    return (Number(deltaY) || 0) * scale;
}

/**
 * Which way the held keys move the target: `forward` and `right` each -1, 0 or
 * 1, with opposite keys held together cancelling.
 */
export function moveIntent(held) {
    const down = keys => keys.some(code => held?.has?.(code));
    return {
        forward: (down(BUILD_MOVE_KEYS.forward) ? 1 : 0) - (down(BUILD_MOVE_KEYS.back) ? 1 : 0),
        right:   (down(BUILD_MOVE_KEYS.right) ? 1 : 0) - (down(BUILD_MOVE_KEYS.left) ? 1 : 0)
    };
}

/** True for a key that moves the target. */
export function isBuildMoveKey(code) {
    return Object.values(BUILD_MOVE_KEYS).some(keys => keys.includes(code));
}

/** True for a key that puts the hold back. */
export function isReframeKey(code) {
    return REFRAME_KEYS.includes(code);
}

/**
 * Where the camera may stand over ground of a given height: never closer to it
 * than the clearance, so a view taken low and close over a hill is not a view
 * from inside it.
 */
export function clearOfGround(position, groundHeight) {
    const floor = (Number(groundHeight) || 0) + CAMERA_CLEARANCE;
    return position.y < floor ? { ...position, y: floor } : position;
}
