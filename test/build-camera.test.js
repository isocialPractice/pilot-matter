import test from 'node:test';
import assert from 'node:assert/strict';
import {
    canvasCamera, canvasFarPlane,
    CANVAS_PITCH, CANVAS_STANDOFF, CANVAS_FAR, CANVAS_FOG
} from '../js/build-camera.js';
import { TILE_REACH } from '../js/world-tiles.js';
import { DEFAULT_SIZE } from '../js/environment/elements.js';
import { readFileSync } from 'node:fs';

/**
 * The flight's own fog density, read out of `js/sky.js` as text rather than
 * imported from it.
 *
 * That module pulls in Three.js, which the suite does not have and is
 * deliberately browserless about. Read rather than written out a second time,
 * because a second copy of the number is how the two come to disagree - which
 * is the failure this comparison is about.
 */
const skySource = readFileSync(new URL('../js/sky.js', import.meta.url), 'utf8');
const FOG_DENSITY = Number(skySource.match(/export const FOG_DENSITY\s*=\s*([\d.eE-]+)/)?.[1]);

/** How far a camera placement stands from what it is looking at. */
function standoff({ position, target }) {
    return Math.hypot(position.x - target.x, position.y - target.y, position.z - target.z);
}

test('the camera looks at the middle of the canvas, which is the middle of the world', () => {
    const { target } = canvasCamera(DEFAULT_SIZE);
    assert.deepEqual(target, { x: 0, y: 0, z: 0 });
});

// Square to the canvas rather than at a corner of it: an edge being worked to
// reads as an edge when it is parallel to the frame.
test('the camera stands back along one axis rather than across a corner', () => {
    const { position } = canvasCamera(DEFAULT_SIZE);

    assert.equal(position.x, 0);
    assert.ok(position.y > 0, 'above the canvas');
    assert.ok(position.z > 0, 'and back from the middle of it');
});

test('the view is tilted down by the pitch it declares', () => {
    const { position, target } = canvasCamera(DEFAULT_SIZE);
    const down = Math.atan2(position.y - target.y, Math.hypot(position.x - target.x, position.z - target.z));

    assert.ok(Math.abs(down * 180 / Math.PI - CANVAS_PITCH) < 0.001,
        `the view should be ${CANVAS_PITCH} degrees down and it was ${down * 180 / Math.PI}`);
});

test('a steeper pitch stands the camera higher without moving it further off', () => {
    const shallow = canvasCamera(DEFAULT_SIZE, { pitch: 30 });
    const steep   = canvasCamera(DEFAULT_SIZE, { pitch: 75 });

    assert.ok(steep.position.y > shallow.position.y, 'higher');
    assert.ok(steep.position.z < shallow.position.z, 'and less of it behind');
    assert.ok(Math.abs(standoff(steep) - standoff(shallow)) < 0.001,
        'at the same distance, because the pitch turns the view rather than moving it');
});

// A pitch straight down loses every bit of relief the ground has, and one on
// the horizon is not looking at the canvas at all, so both poles are clamped.
test('the pitch is held off both poles', () => {
    for (const pitch of [0, -40, 90, 200, NaN, undefined]) {
        const { position, target } = canvasCamera(DEFAULT_SIZE, { pitch });
        const height = position.y - target.y;
        const flat   = Math.hypot(position.x - target.x, position.z - target.z);

        assert.ok(height > 0, `a pitch of ${pitch} should still be above the canvas`);
        assert.ok(flat > 0, `and a pitch of ${pitch} should still be back from it`);
    }
});

/**
 * The distance is written against the canvas rather than as a number of units,
 * because what it has to do is frame the canvas: a distance that framed a
 * 16000-unit square would be the wrong distance for any other.
 */
test('the distance is measured off the canvas it is framing', () => {
    assert.ok(Math.abs(standoff(canvasCamera(16000)) - 16000 * CANVAS_STANDOFF) < 0.001);
    assert.ok(Math.abs(standoff(canvasCamera(4000)) - 4000 * CANVAS_STANDOFF) < 0.001);
    assert.ok(standoff(canvasCamera(16000)) > standoff(canvasCamera(4000)),
        'a bigger canvas is stood further back from');
});

test('the camera never stands further off than it can see', () => {
    // A canvas far wider than the far plane allows: the camera is placed where
    // it can see rather than where the whole of the square would be clipped.
    const far = canvasFarPlane(1000);
    assert.ok(standoff(canvasCamera(1000000, { far })) <= far + 0.001,
        'the distance should be held inside the far plane it was handed');
});

test('a canvas of no size is not a reason to divide by it', () => {
    for (const size of [0, -16000, NaN, undefined, null, 'wide']) {
        const placement = canvasCamera(size);

        assert.ok(Number.isFinite(placement.position.x), `${size} should still place a camera`);
        assert.ok(Number.isFinite(placement.position.y));
        assert.ok(Number.isFinite(placement.position.z));
    }
});

/**
 * The far plane has to reach past the canvas's far corner rather than to its
 * middle, because that corner is the extent of what is being built. The
 * flight's own `TILE_REACH` is shorter than the diagonal of one tile, which is
 * right for a flight - it is what keeps the end of the ground out of frame -
 * and wrong for a canvas.
 */
test('the far plane reaches past the canvas corner furthest from the camera', () => {
    const size = DEFAULT_SIZE;
    const far = canvasFarPlane(size);
    const { position } = canvasCamera(size);
    const half = size / 2;

    assert.ok(far > TILE_REACH, 'and further than a flight needs to see');

    for (const [x, z] of [[half, half], [-half, half], [half, -half], [-half, -half]]) {
        const away = Math.hypot(position.x - x, position.y, position.z - z);
        assert.ok(away < far, `the corner at ${x},${z} is ${away} away and would be clipped at ${far}`);
    }
});

test('a canvas inside the flight reach keeps that reach rather than shortening it', () => {
    assert.equal(canvasFarPlane(100), TILE_REACH);
    assert.equal(canvasFarPlane(0), TILE_REACH);
    assert.equal(canvasFarPlane(DEFAULT_SIZE), DEFAULT_SIZE * CANVAS_FAR);
});

/**
 * And the air is cleared, which is the other half of being able to see the
 * edges. Exponential fog at the flight's own density is total well inside one
 * tile, so a canvas left in it would be a disc of ground in a grey wall.
 */
test('the air over a canvas is clear enough to read its far corner as ground', () => {
    assert.ok(FOG_DENSITY > 0, 'js/sky.js should still declare the density this is measured against');

    const density = FOG_DENSITY * CANVAS_FOG;
    const corner  = Math.hypot(DEFAULT_SIZE, DEFAULT_SIZE) / 2;

    // FogExp2: the fraction of a surface the air has taken at a distance.
    const hidden = 1 - Math.exp(-((density * corner) ** 2));
    assert.ok(hidden < 0.5, `the far corner should still read as ground, and it was ${hidden} hidden`);

    const flight = 1 - Math.exp(-((FOG_DENSITY * corner) ** 2));
    assert.ok(flight > 0.99, 'where the flight it is standing down from hides it entirely');
    assert.ok(CANVAS_FOG > 0, 'and the air is thinned rather than taken away');
});
