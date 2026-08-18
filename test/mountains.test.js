import test from 'node:test';
import assert from 'node:assert/strict';
import { mountainCount } from '../js/mountains.js';

test('16000-unit terrain gets 14 mountains at 10% coverage', () => {
    // (16000^2 * 0.10) / (pi * 750^2) = 14.49 -> rounds to 14
    assert.equal(mountainCount(16000), 14);
});

test('count matches the documented formula for other sizes', () => {
    const size = 24000;
    const expected = Math.round((size * size * 0.10) / (Math.PI * 750 * 750));
    assert.equal(mountainCount(size), expected);
});

test('small terrains are floored at 5 mountains', () => {
    assert.equal(mountainCount(1000), 5);
    assert.equal(mountainCount(0), 5);
});

test('coverage and radius parameters change the count as expected', () => {
    // Doubling coverage doubles the raw count before rounding
    assert.equal(mountainCount(16000, 0.20), 29);
    // Larger average radius means fewer mountains for the same coverage
    assert.ok(mountainCount(16000, 0.10, 1100) < mountainCount(16000, 0.10, 750));
});
