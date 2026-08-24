import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
    INITIAL_AIRSPEED_KNOTS,
    INITIAL_ALTITUDE_FEET,
    INITIAL_VERTICAL_SPEED_FPM,
    INITIAL_HEADING_DEGREES,
    INITIAL_THROTTLE_PERCENT,
    INITIAL_CAMERA_MODE,
    INITIAL_SPEED,
    INITIAL_ALTITUDE,
    INITIAL_VERTICAL_SPEED,
    INITIAL_THROTTLE,
    INITIAL_PITCH,
    INITIAL_YAW,
    createFlightState,
    flightStart
} from '../js/flight-state.js';
import { DEFAULT_CONFIG, startDefaults } from '../js/config.js';
import {
    speedToKnots, altitudeToFeet, throttleToPercent,
    verticalSpeedToFeetPerMinute, formatVerticalSpeed,
    headingDegrees, formatHeading, compassPoint
} from '../js/hud.js';
import { MAX_SPEED, targetSpeed, sinkRate, isStalled } from '../js/flight-model.js';
import { CAMERA_MODES } from '../js/camera-math.js';

const indexHtml = readFileSync(
    fileURLToPath(new URL('../index.html', import.meta.url)),
    'utf8'
);

const readout = (id) => {
    const match = indexHtml.match(new RegExp(`id="${id}"[^>]*>([^<]*)<`));
    assert.ok(match, `index.html should contain the ${id} readout`);
    return match[1].trim();
};

// The nose direction the aircraft carries at a pitch angle. The model flies
// along +Z, and a positive rotation about +X carries that nose down, which is
// where the sign comes from.
const forwardY = (pitch) => -Math.sin(pitch);

test('the flight starts on the configured instrument readings', () => {
    const state = createFlightState();
    assert.equal(speedToKnots(state.speed), INITIAL_AIRSPEED_KNOTS);
    assert.equal(altitudeToFeet(state.position.y), INITIAL_ALTITUDE_FEET);
    assert.equal(verticalSpeedToFeetPerMinute(state.verticalSpeed), INITIAL_VERTICAL_SPEED_FPM);
    assert.equal(throttleToPercent(state.throttle), INITIAL_THROTTLE_PERCENT);
    assert.equal(headingDegrees(state.rotation.y), INITIAL_HEADING_DEGREES);
    assert.equal(state.cameraMode, INITIAL_CAMERA_MODE);
});

test('the configured start is the one the instruments were written for', () => {
    assert.equal(INITIAL_AIRSPEED_KNOTS, 80);
    assert.equal(INITIAL_ALTITUDE_FEET, 1390);
    assert.equal(INITIAL_VERTICAL_SPEED_FPM, 1260);
    assert.equal(INITIAL_HEADING_DEGREES, 0);
    assert.equal(INITIAL_THROTTLE_PERCENT, 20);
    assert.equal(INITIAL_CAMERA_MODE, 'CHASE');
});

test('the start heading reads as north on the card, in three digits', () => {
    assert.equal(formatHeading(headingDegrees(INITIAL_YAW)), '000');
    assert.equal(compassPoint(headingDegrees(INITIAL_YAW)), 'N');
});

test('the camera the flight starts in is one the C key cycles through', () => {
    assert.ok(CAMERA_MODES.includes(INITIAL_CAMERA_MODE));
});

// The throttle lever picks a target speed and airspeed converges on it. A
// start whose lever asks for a different speed than the aircraft has would
// drift off its configured airspeed on the first frame that runs.
test('the throttle setting asks for exactly the airspeed configured', () => {
    assert.equal(targetSpeed(INITIAL_THROTTLE, MAX_SPEED), INITIAL_SPEED);
});

test('the start airspeed is not below the stall speed', () => {
    assert.equal(isStalled(INITIAL_SPEED), false);
});

// The climb is flown rather than declared: the pitch has to convert enough
// forward motion into height to cover both the climb and the sink the wing is
// already losing at that airspeed.
test('the start attitude actually holds the configured climb', () => {
    const climb = forwardY(INITIAL_PITCH) * INITIAL_SPEED - sinkRate(INITIAL_SPEED);
    assert.ok(Math.abs(climb - INITIAL_VERTICAL_SPEED) < 1e-9,
        `the start pitch climbs at ${climb}, not ${INITIAL_VERTICAL_SPEED}`);
    assert.equal(verticalSpeedToFeetPerMinute(climb), INITIAL_VERTICAL_SPEED_FPM);
});

test('the aircraft starts nose up, the way a climb is flown', () => {
    assert.ok(forwardY(INITIAL_PITCH) > 0, 'a climb needs the nose above the horizon');
    assert.equal(INITIAL_YAW, 0, 'and pointed at north');
});

test('the aircraft starts aloft, over the middle of the world', () => {
    const state = createFlightState();
    assert.equal(state.position.y, INITIAL_ALTITUDE);
    assert.equal(state.position.x, 0);
    assert.equal(state.position.z, 0);
    assert.equal(state.rotation.z, 0, 'and level in the roll axis');
});

test('the HUD readouts on the page match the state the flight starts in', () => {
    assert.equal(readout('hud-speed'), String(INITIAL_AIRSPEED_KNOTS));
    assert.equal(readout('hud-altitude'), String(INITIAL_ALTITUDE_FEET));
    assert.equal(readout('hud-vertical-speed'), formatVerticalSpeed(INITIAL_VERTICAL_SPEED_FPM));
    assert.equal(readout('hud-throttle'), String(INITIAL_THROTTLE_PERCENT));
    assert.equal(readout('hud-heading'), formatHeading(INITIAL_HEADING_DEGREES));
    assert.equal(readout('hud-compass'), compassPoint(INITIAL_HEADING_DEGREES));
    assert.equal(readout('hud-camera'), INITIAL_CAMERA_MODE);
});

// The constants are the configured start resolved once. Reading them off
// js/config.js is what keeps the start data rather than a set of literals the
// flight code happens to agree with.
test('the constants are the configured start, and not a second copy of it', () => {
    assert.equal(INITIAL_AIRSPEED_KNOTS, DEFAULT_CONFIG.start.airspeedKnots);
    assert.equal(INITIAL_ALTITUDE_FEET, DEFAULT_CONFIG.start.altitudeFeet);
    assert.equal(INITIAL_VERTICAL_SPEED_FPM, DEFAULT_CONFIG.start.verticalSpeedFpm);
    assert.equal(INITIAL_HEADING_DEGREES, DEFAULT_CONFIG.start.headingDegrees);
    assert.equal(INITIAL_THROTTLE_PERCENT, DEFAULT_CONFIG.start.throttlePercent);
    assert.equal(INITIAL_CAMERA_MODE, DEFAULT_CONFIG.start.cameraMode);
});

test('a start with nothing named is the one the simulator ships with', () => {
    const start = flightStart();
    assert.equal(start.speed, INITIAL_SPEED);
    assert.equal(start.altitude, INITIAL_ALTITUDE);
    assert.equal(start.verticalSpeed, INITIAL_VERTICAL_SPEED);
    assert.equal(start.throttle, INITIAL_THROTTLE);
    assert.equal(start.yaw, INITIAL_YAW);
    assert.equal(start.pitch, INITIAL_PITCH);
    assert.equal(start.cameraMode, INITIAL_CAMERA_MODE);
});

test('a configured start reads back on the instruments as the numbers set', () => {
    const start = flightStart({
        ...startDefaults(),
        airspeedKnots: 140,
        altitudeFeet: 3000,
        verticalSpeedFpm: -500,
        headingDegrees: 90,
        throttlePercent: 60,
        cameraMode: 'COCKPIT'
    });

    assert.equal(speedToKnots(start.speed), 140);
    assert.equal(altitudeToFeet(start.altitude), 3000);
    assert.equal(verticalSpeedToFeetPerMinute(start.verticalSpeed), -500);
    assert.equal(headingDegrees(start.yaw), 90);
    assert.equal(throttleToPercent(start.throttle), 60);
    assert.equal(start.cameraMode, 'COCKPIT');
});

// The pitch is worked out from the climb and the airspeed rather than stored,
// so a start edited to a different climb is flown at the attitude that holds it.
test('an edited climb comes with the attitude that actually holds it', () => {
    for (const [verticalSpeedFpm, airspeedKnots] of [[-500, 140], [0, 200], [2400, 120]]) {
        const start = flightStart({ ...startDefaults(), verticalSpeedFpm, airspeedKnots });
        const climb = forwardY(start.pitch) * start.speed - sinkRate(start.speed);

        // Read off the dial rather than compared as a number: a climb worked
        // out through an arcsine and back lands a rounding error away from the
        // one asked for, and the indicator is what says whether that matters.
        assert.equal(
            formatVerticalSpeed(verticalSpeedToFeetPerMinute(climb)),
            formatVerticalSpeed(verticalSpeedFpm),
            `a start climbing at ${verticalSpeedFpm} should be pitched to climb at it`
        );
    }
});

test('a start nose down is a start pointed at the ground', () => {
    const descent = flightStart({ ...startDefaults(), verticalSpeedFpm: -2000, airspeedKnots: 200 });
    assert.ok(forwardY(descent.pitch) < 0, 'a descent needs the nose below the horizon');
});

test('a flight state can be built from a start other than the configured one', () => {
    const state = createFlightState({ ...startDefaults(), altitudeFeet: 3000, headingDegrees: 180 });
    assert.equal(altitudeToFeet(state.position.y), 3000);
    assert.equal(headingDegrees(state.rotation.y), 180);
    assert.equal(state.position.x, 0, 'and still over the middle of the world');
    assert.equal(state.position.z, 0);
});

test('a start a version cannot read falls back to the configured one, field by field', () => {
    const state = createFlightState({ altitudeFeet: 3000, airspeedKnots: 'quite fast' });
    assert.equal(altitudeToFeet(state.position.y), 3000);
    assert.equal(speedToKnots(state.speed), INITIAL_AIRSPEED_KNOTS);
});

test('createFlightState hands out fresh objects, so a reset is never poisoned', () => {
    const first = createFlightState();
    first.speed = 150;
    first.position.y = 10;
    first.rotation.z = 1;

    const second = createFlightState();
    assert.equal(second.speed, INITIAL_SPEED);
    assert.equal(second.position.y, INITIAL_ALTITUDE);
    assert.equal(second.rotation.z, 0);
    assert.notEqual(first.position, second.position);
});
