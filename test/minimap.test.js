import test from 'node:test';
import assert from 'node:assert/strict';
import {
    MINIMAP_SIZE,
    DEFAULT_BOUNDS,
    Minimap,
    normalizePosition,
    minimapPoint,
    isOffMap,
    minimapHeading
} from '../js/minimap.js';
import { headingToYaw } from '../js/units.js';

const BOUNDS = { minX: -8000, maxX: 8000, minZ: -8000, maxZ: 8000 };

test('the middle of the world is the middle of the map', () => {
    assert.deepEqual(normalizePosition(BOUNDS, 0, 0), { u: 0.5, v: 0.5 });
    assert.deepEqual(minimapPoint(BOUNDS, 0, 0), { x: 0, y: 0 });
});

test('east is right and north is up, the way a chart is read', () => {
    assert.ok(minimapPoint(BOUNDS, 4000, 0).x > 0, 'east should be to the right');
    assert.ok(minimapPoint(BOUNDS, -4000, 0).x < 0, 'west should be to the left');
    assert.ok(minimapPoint(BOUNDS, 0, 4000).y < 0, 'north should be up the face');
    assert.ok(minimapPoint(BOUNDS, 0, -4000).y > 0, 'south should be down it');
});

test('the corners of the world are the corners of the face', () => {
    const half = MINIMAP_SIZE / 2;
    assert.deepEqual(minimapPoint(BOUNDS, BOUNDS.minX, BOUNDS.maxZ), { x: -half, y: -half });
    assert.deepEqual(minimapPoint(BOUNDS, BOUNDS.maxX, BOUNDS.minZ), { x: half, y: half });
});

test('a position is placed in proportion to how far across the world it is', () => {
    const { u, v } = normalizePosition(BOUNDS, 4000, -4000);
    assert.equal(u, 0.75, 'three quarters of the way east');
    assert.equal(v, 0.25, 'a quarter of the way north');
});

// The world has an edge, and an aircraft can be flown out over it. Holding the
// marker at the edge it left through is the honest reading: it says where the
// aircraft went out, rather than drawing it somewhere it is not.
test('an aircraft outside the world holds the edge it left through', () => {
    const half = MINIMAP_SIZE / 2;
    assert.deepEqual(minimapPoint(BOUNDS, 99999, 0), { x: half, y: 0 });
    assert.deepEqual(minimapPoint(BOUNDS, 0, -99999), { x: 0, y: half });
});

test('being outside the world is something the map says out loud', () => {
    assert.equal(isOffMap(BOUNDS, 0, 0), false);
    assert.equal(isOffMap(BOUNDS, BOUNDS.maxX, BOUNDS.maxZ), false, 'the edge itself is still inside');
    assert.equal(isOffMap(BOUNDS, BOUNDS.maxX + 1, 0), true);
    assert.equal(isOffMap(BOUNDS, 0, BOUNDS.minZ - 1), true);
});

test('a world with no width to it reads as the middle rather than dividing by zero', () => {
    const flat = { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
    assert.deepEqual(normalizePosition(flat, 500, -500), { u: 0.5, v: 0.5 });
    assert.deepEqual(minimapPoint(flat, 500, -500), { x: 0, y: 0 });
});

// The marker is drawn pointing north, so the angle it is turned by is the
// compass heading itself and the map needs no second convention for it.
test('the marker is turned to the heading the compass reads', () => {
    for (const degrees of [0, 45, 90, 180, 270, 359]) {
        assert.equal(minimapHeading(headingToYaw(degrees)), degrees);
    }
});

// Enough of an SVG face for the marker to be placed on, with no browser to
// place it in: elements that remember what was set on them.
function fakeFace() {
    const marker = { attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } };
    const classes = new Set();

    return {
        marker,
        classes,
        querySelector: () => marker,
        classList: { toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)) }
    };
}

test('the map draws the aircraft where it is and turns it the way it points', () => {
    const face = fakeFace();
    const map  = new Minimap(face, BOUNDS);

    map.update({ x: 4000, y: 500, z: 4000 }, headingToYaw(90));
    assert.equal(face.marker.attributes.transform, 'translate(25.00 -25.00) rotate(90)');
    assert.equal(face.classes.has('off-map'), false);
});

test('the map says so when the aircraft it is drawing has left the world', () => {
    const face = fakeFace();
    const map  = new Minimap(face, BOUNDS);

    map.update({ x: 99999, y: 500, z: 0 }, 0);
    assert.equal(face.classes.has('off-map'), true);

    map.update({ x: 0, y: 500, z: 0 }, 0);
    assert.equal(face.classes.has('off-map'), false, 'and stops saying it on the way back in');
});

test('the map is refitted to whatever world is being flown', () => {
    const face = fakeFace();
    const map  = new Minimap(face);
    assert.deepEqual(map.bounds, DEFAULT_BOUNDS, 'a map with no world yet still has a scale');

    const smaller = { minX: -100, maxX: 100, minZ: -100, maxZ: 100 };
    assert.deepEqual(map.setBounds(smaller), smaller);

    map.update({ x: 100, y: 0, z: 0 }, 0);
    assert.equal(face.classes.has('off-map'), false, 'the edge of the new world is inside it');
    assert.deepEqual(map.setBounds(null), DEFAULT_BOUNDS, 'and no world at all falls back rather than throwing');
});
