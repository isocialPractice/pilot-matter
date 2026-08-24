import test from 'node:test';
import assert from 'node:assert/strict';
import { wrapValue, wrapPosition, isOutsideBounds } from '../js/world-edge.js';
import { boundsFromSize } from '../js/api/contract.js';
import { DEFAULT_SIZE } from '../js/environment/elements.js';

const bounds = boundsFromSize(DEFAULT_SIZE);
const half = DEFAULT_SIZE / 2;

test('a value inside the span is the value it already was', () => {
    assert.equal(wrapValue(0, -100, 100), 0);
    assert.equal(wrapValue(-99, -100, 100), -99);
});

// Reaching an edge is not crossing it: an aircraft sitting exactly on the
// boundary is over the last of the ground rather than over none of it.
test('a value on either edge is still inside', () => {
    assert.equal(wrapValue(100, -100, 100), 100);
    assert.equal(wrapValue(-100, -100, 100), -100);
});

test('a value past one end comes back the same distance past the other', () => {
    assert.equal(wrapValue(101, -100, 100), -99);
    assert.equal(wrapValue(-101, -100, 100), 99);
});

test('a value flown clean past the far side keeps going round', () => {
    assert.equal(wrapValue(301, -100, 100), -99, 'one and a half worlds out is still half a world in');
    assert.equal(wrapValue(-301, -100, 100), 99);
});

test('a span with no width, or a value that is no number, is left alone', () => {
    assert.equal(wrapValue(5, 100, 100), 5);
    assert.equal(wrapValue(5, 100, -100), 5);
    assert.ok(Number.isNaN(wrapValue(NaN, -100, 100)));
    assert.equal(wrapValue(Infinity, -100, 100), Infinity);
});

test('a position inside the world is reported as untouched', () => {
    const inside = wrapPosition(bounds, 120, -4000);
    assert.deepEqual(inside, { x: 120, z: -4000, wrapped: false });
    assert.equal(isOutsideBounds(bounds, 120, -4000), false);
});

test('flying out over the east edge brings the aircraft in over the west one', () => {
    const carried = wrapPosition(bounds, half + 40, 1000);
    assert.equal(carried.wrapped, true);
    assert.equal(carried.x, -half + 40, 'and at the same distance in');
    assert.equal(carried.z, 1000, 'with the other axis left where it was');
});

test('flying out over the north edge brings the aircraft in over the south one', () => {
    const carried = wrapPosition(bounds, -2000, half + 1);
    assert.equal(carried.wrapped, true);
    assert.equal(carried.x, -2000);
    assert.equal(carried.z, -half + 1);
});

// The axes are carried on their own, so a corner is a corner rather than
// whichever of its two edges the aircraft happened to cross first.
test('a corner crossed diagonally comes back in at the opposite corner', () => {
    const carried = wrapPosition(bounds, half + 10, half + 10);
    assert.equal(carried.x, -half + 10);
    assert.equal(carried.z, -half + 10);
});

test('a carried position is one the world can be sampled at', () => {
    for (const [x, z] of [[half + 1, 0], [-half - 1, 0], [0, half + 1], [half + 1, -half - 1]]) {
        const carried = wrapPosition(bounds, x, z);
        assert.equal(isOutsideBounds(bounds, carried.x, carried.z), false,
            `(${x}, ${z}) should come back inside the world`);
    }
});

test('a pilot with no bounds to fly inside is left where they are', () => {
    assert.deepEqual(wrapPosition(null, 99999, 99999), { x: 99999, z: 99999, wrapped: false });
});
