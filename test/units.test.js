import test from 'node:test';
import assert from 'node:assert/strict';
import {
    KNOTS_PER_UNIT, FEET_PER_UNIT, SECONDS_PER_MINUTE,
    speedToKnots, knotsToSpeed,
    altitudeToFeet, feetToAltitude,
    throttleToPercent, percentToThrottle,
    feetPerMinuteToVerticalSpeed,
    headingDegrees, headingToYaw
} from '../js/units.js';
import { verticalSpeedToFeetPerMinute } from '../js/hud.js';

test('a reading converted out and back is the reading it started as', () => {
    for (const knots of [0, 40, 80, 137, 400]) {
        assert.equal(speedToKnots(knotsToSpeed(knots)), knots);
    }
    for (const feet of [0, 300, 1390, 9999]) {
        assert.equal(altitudeToFeet(feetToAltitude(feet)), feet);
    }
    for (const percent of [0, 20, 55, 100]) {
        assert.equal(throttleToPercent(percentToThrottle(percent)), percent);
    }
});

test('a climb rate in feet per minute survives the round trip', () => {
    for (const fpm of [0, 100, 1260, -840]) {
        assert.equal(verticalSpeedToFeetPerMinute(feetPerMinuteToVerticalSpeed(fpm)), fpm);
    }
});

test('the conversions are the factors the instruments are calibrated to', () => {
    assert.equal(knotsToSpeed(KNOTS_PER_UNIT), 1);
    assert.equal(feetToAltitude(FEET_PER_UNIT), 1);
    assert.equal(feetPerMinuteToVerticalSpeed(FEET_PER_UNIT * SECONDS_PER_MINUTE), 1);
});

test('a throttle percentage never leaves the lever travel', () => {
    assert.equal(percentToThrottle(-40), 0);
    assert.equal(percentToThrottle(400), 1);
});

test('a bearing converted to a yaw angle reads back as the same bearing', () => {
    for (const degrees of [0, 7, 90, 180, 271, 359]) {
        assert.equal(headingDegrees(headingToYaw(degrees)), degrees);
    }
});

test('north is a yaw of zero, so a level flight starts on the card at 000', () => {
    assert.equal(headingToYaw(0), 0);
    assert.equal(headingDegrees(0), 0);
});
