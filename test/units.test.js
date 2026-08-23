import test from 'node:test';
import assert from 'node:assert/strict';
import {
    KNOTS_PER_UNIT, FEET_PER_UNIT, SECONDS_PER_MINUTE,
    MPH_PER_KNOT, METERS_PER_FOOT,
    SPEED_UNITS, ALTITUDE_UNITS, DEFAULT_SPEED_UNIT, DEFAULT_ALTITUDE_UNIT,
    speedToKnots, knotsToSpeed,
    altitudeToFeet, feetToAltitude,
    speedTo, altitudeTo, speedUnit, altitudeUnit,
    throttleToPercent, percentToThrottle,
    feetPerMinuteToVerticalSpeed,
    headingDegrees, headingToYaw
} from '../js/units.js';
import { verticalSpeedToFeetPerMinute, verticalSpeedToRate } from '../js/hud.js';

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

// --- The second scale an instrument can be switched to ---

test('every scale an instrument offers names itself and says what it reads in', () => {
    for (const scale of Object.values(SPEED_UNITS)) {
        assert.ok(scale.label.length > 0, `${scale.id} needs a label to be read beside`);
        assert.ok(scale.perUnit > 0);
    }
    for (const scale of Object.values(ALTITUDE_UNITS)) {
        assert.ok(scale.label.length > 0, `${scale.id} needs a label to be read beside`);
        assert.ok(scale.rateLabel.includes('/min'), 'a climb rate is that scale over a minute');
        assert.ok(scale.perUnit > 0);
    }
});

test('a flight opens on the scales the start state is configured in', () => {
    assert.equal(DEFAULT_SPEED_UNIT, 'knots');
    assert.equal(DEFAULT_ALTITUDE_UNIT, 'feet');
    assert.equal(speedTo(40), speedToKnots(40));
    assert.equal(altitudeTo(423), altitudeToFeet(423));
});

// The second scale is a conversion of the same reading rather than a second
// set of tuning numbers, so the two can never drift apart.
test('the second scale is the first one converted, not a second calibration', () => {
    const speed = knotsToSpeed(80);
    assert.equal(speedTo(speed, 'mph'), Math.round(80 * MPH_PER_KNOT));

    const altitude = feetToAltitude(1390);
    assert.equal(altitudeTo(altitude, 'meters'), Math.round(1390 * METERS_PER_FOOT));
});

test('a climb rate is read on whichever scale the altimeter is set to', () => {
    const climb = 1 / (FEET_PER_UNIT * SECONDS_PER_MINUTE) * 1260;
    assert.equal(verticalSpeedToRate(climb, 'feet'), verticalSpeedToFeetPerMinute(climb));
    assert.ok(verticalSpeedToRate(climb, 'meters') < verticalSpeedToRate(climb, 'feet'),
        'the same climb is a smaller number in metres');
});

test('a scale this version has never heard of reads as the one it opens on', () => {
    for (const id of [undefined, null, 'furlongs', 7]) {
        assert.equal(speedUnit(id).id, DEFAULT_SPEED_UNIT);
        assert.equal(altitudeUnit(id).id, DEFAULT_ALTITUDE_UNIT);
        assert.equal(speedTo(40, id), speedToKnots(40));
        assert.equal(altitudeTo(423, id), altitudeToFeet(423));
    }
});
