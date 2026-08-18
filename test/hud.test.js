import test from 'node:test';
import assert from 'node:assert/strict';
import {
    KNOTS_PER_UNIT,
    FEET_PER_UNIT,
    speedToKnots,
    altitudeToFeet,
    throttleToPercent
} from '../js/hud.js';

test('speedToKnots scales by the knots conversion factor and rounds', () => {
    assert.equal(speedToKnots(0), 0);
    assert.equal(speedToKnots(100), Math.round(100 * KNOTS_PER_UNIT));
    assert.equal(speedToKnots(50.4), 101);
    assert.equal(speedToKnots(200), 400);
});

test('altitudeToFeet scales by the feet conversion factor and rounds', () => {
    assert.equal(altitudeToFeet(0), 0);
    assert.equal(altitudeToFeet(100), Math.round(100 * FEET_PER_UNIT));
    assert.equal(altitudeToFeet(300), 984);
    assert.equal(altitudeToFeet(1), 3);
});

test('throttleToPercent maps the 0-1 throttle fraction to whole percent', () => {
    assert.equal(throttleToPercent(0), 0);
    assert.equal(throttleToPercent(0.5), 50);
    assert.equal(throttleToPercent(1), 100);
    assert.equal(throttleToPercent(0.333), 33);
});
