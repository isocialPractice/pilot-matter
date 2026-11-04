import test from 'node:test';
import assert from 'node:assert/strict';
import {
    pickGround, canvasPickBounds, pickStep, pointerDevice, PICK_STEP_CELLS
} from '../js/build-picking.js';
import { createField, applyBase, sampleHeight, DEFAULT_SIZE } from '../js/environment/elements.js';

const flat = () => 0;

/** A round hill 400 high, 1000 across its foot, standing at the middle of the ground. */
const hill = (x, z) => Math.max(0, 400 * (1 - Math.hypot(x, z) / 500));

const near = (a, b, within = 0.05) => Math.abs(a - b) <= within;

test('a ray pointed down at flat ground meets it where a plane would', () => {
    const hit = pickGround({ x: 0, y: 1000, z: 1000 }, { x: 0, y: -1, z: -1 }, flat);
    assert.ok(near(hit.x, 0) && near(hit.y, 0) && near(hit.z, 0), JSON.stringify(hit));
});

/**
 * The reason a pick is a ray against the ground and not a plane: a click aimed
 * at the face of a hill has to land on the face, not on the flat ground behind
 * the hill where the same ray would cross sea level.
 */
test('a ray aimed at the face of a hill lands on the face, not on the plane behind it', () => {
    const origin = { x: 0, y: 1200, z: 2400 };
    const direction = { x: 0, y: -1200, z: -2400 };

    const hit = pickGround(origin, direction, hill, { step: 20 });
    assert.ok(hit, 'the ray should meet the hill');
    assert.ok(hit.y > 50, `it should land up on the hill, and it landed at height ${hit.y}`);
    assert.ok(hit.z > 0, 'on the face toward the camera');
    assert.ok(near(hit.y, hill(hit.x, hit.z), 1e-9), 'and on the ground, not above or under it');

    const plane = pickGround(origin, direction, flat);
    assert.ok(plane.z < hit.z, 'the plane would have put it further back, behind the face');
});

test('a hit sits on the ground to well inside a unit', () => {
    const field = createField({ size: 4000, segments: 40 });
    applyBase(field, { maxHeight: 480, scale: 3.5 });
    const heightAt = (x, z) => sampleHeight(field, x, z);

    for (const [x, z] of [[0, 0], [700, -900], [-1500, 1200]]) {
        const origin = { x: x + 600, y: 3000, z: z + 900 };
        const hit = pickGround(origin, { x: -600, y: -3000 + heightAt(x, z), z: -900 }, heightAt, { step: 50 });

        assert.ok(hit, `a ray at ${x},${z} should land`);
        assert.ok(near(hit.x, x, 0.5) && near(hit.z, z, 0.5), `aimed at ${x},${z} and landed at ${hit.x},${hit.z}`);
    }
});

test('a ray over the sky, or pointed level, meets nothing', () => {
    assert.equal(pickGround({ x: 0, y: 1000, z: 0 }, { x: 0, y: 1, z: -1 }, flat), null, 'pointing up');
    assert.equal(pickGround({ x: 0, y: 1000, z: 0 }, { x: 0, y: 0, z: -1 }, flat, { maxDistance: 5000 }), null,
        'level and never coming down within reach');
    assert.equal(pickGround({ x: 0, y: 1000, z: 0 }, { x: 0, y: 0, z: 0 }, flat), null, 'no direction at all');
});

test('a ray that comes down too far away to be drawn meets nothing', () => {
    assert.equal(pickGround({ x: 0, y: 1000, z: 0 }, { x: 0, y: -1, z: -100 }, flat, { maxDistance: 20000 }), null);
});

/**
 * The guard the plan writes down: a point whose ray meets the ground off the
 * canvas is dropped rather than moved onto the canvas's edge, because it is not
 * a point anything was pointed at.
 */
test('ground met off the canvas is a miss, not a point moved onto its edge', () => {
    const bounds = canvasPickBounds(4000);
    const off = pickGround({ x: 0, y: 1000, z: 0 }, { x: 2500, y: -1000, z: 0 }, flat, { bounds });
    assert.equal(off, null);

    const on = pickGround({ x: 0, y: 1000, z: 0 }, { x: 1500, y: -1000, z: 0 }, flat, { bounds });
    assert.ok(on && near(on.x, 1500), 'and ground on it is a hit');
});

test('a camera inside the ground points at nothing', () => {
    assert.equal(pickGround({ x: 0, y: 100, z: 0 }, { x: 0, y: -1, z: 1 }, hill), null);
});

// The walk starts where the ray comes down through the highest ground, which
// is only a saving if it lands on the same point a walk from the camera does.
test('skipping the air above the highest ground lands on the same point', () => {
    const origin = { x: 300, y: 9000, z: 6000 };
    const direction = { x: -300, y: -9000, z: -6000 };

    const walked  = pickGround(origin, direction, hill, { step: 20, maxDistance: 40000 });
    const skipped = pickGround(origin, direction, hill, { step: 20, maxDistance: 40000, top: 400 });

    assert.ok(walked && skipped);
    assert.ok(near(walked.x, skipped.x, 1e-6) && near(walked.z, skipped.z, 1e-6));
    assert.equal(pickGround({ x: 0, y: 1000, z: 0 }, { x: 0, y: 0, z: -1 }, flat, { top: 400 }), null,
        'and a ray above the highest ground that never comes down misses outright');
});

test('the square a pick may land on is the canvas', () => {
    assert.deepEqual(canvasPickBounds(DEFAULT_SIZE),
        { minX: -DEFAULT_SIZE / 2, maxX: DEFAULT_SIZE / 2, minZ: -DEFAULT_SIZE / 2, maxZ: DEFAULT_SIZE / 2 });
    assert.equal(pickStep(80), 80 * PICK_STEP_CELLS, 'and the walk steps half a cell, so no rise is stepped over');
});

test('the pointer is read as the device coordinates a camera casts through', () => {
    const rect = { left: 10, top: 20, width: 800, height: 600 };
    assert.deepEqual(pointerDevice(410, 320, rect), { x: 0, y: 0 }, 'the middle of the canvas');
    assert.deepEqual(pointerDevice(10, 20, rect), { x: -1, y: 1 }, 'its top left');
    assert.deepEqual(pointerDevice(810, 620, rect), { x: 1, y: -1 }, 'its bottom right');
});
