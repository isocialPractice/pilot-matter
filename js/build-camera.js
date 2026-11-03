/**
 * The build camera - where the view stands while a canvas is being built.
 *
 * Build mode is not flight, so it does not use the flight camera: that one
 * chases an aircraft, and a canvas has no aircraft to chase. What it has is a
 * middle, four edges, and a pilot who needs to see across it.
 *
 * This is the hold - one framing over the canvas, worked out from the canvas's
 * own size. The target, the distance, the yaw and the pitch a pointer moves,
 * and the fields the editor's own panel writes, join it with the gestures that
 * drive them.
 *
 * Pure module in the shape of `js/camera-math.js`, with no DOM or Three.js
 * dependency, so where the camera stands can be unit tested in Node and the
 * renderer's side of it is a few lines that copy the result onto a camera.
 */

import { TILE_REACH } from './world-tiles.js';

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
 */
export const CANVAS_FAR = 2;

/**
 * How much of the flight's fog is left over a canvas.
 *
 * The flight's air is thick on purpose - it is what keeps the end of the ground
 * out of frame - and a canvas is the opposite case. Its four edges are the
 * extent of what is being built and are there to be seen, so the air is cleared
 * to where the far corner still reads as ground rather than as sky.
 */
export const CANVAS_FOG = 0.06;

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
    const span  = Math.max(Number(size) || 0, 0);
    const limit = far > 0 ? far : canvasFarPlane(span);
    const away  = Math.min(span * CANVAS_STANDOFF, limit);
    const tilt  = Math.max(Math.min(Number(pitch) || 0, 89), 1) * Math.PI / 180;

    return {
        target:   { x: 0, y: 0, z: 0 },
        position: { x: 0, y: away * Math.sin(tilt), z: away * Math.cos(tilt) }
    };
}

/**
 * How far the camera over a canvas has to be able to see, which is past the
 * canvas's far corner rather than to its middle.
 *
 * A canvas smaller than the flight's own reach keeps that reach, so the hold
 * never shortens what was already being drawn.
 */
export function canvasFarPlane(size = 0) {
    const span = Math.max(Number(size) || 0, 0);
    return Math.max(span * CANVAS_FAR, TILE_REACH);
}
