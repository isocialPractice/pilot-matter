import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
    KNOTS_PER_UNIT,
    FEET_PER_UNIT,
    VERTICAL_SPEED_STEP,
    LOW_ALTITUDE_FEET,
    COMPASS_POINTS,
    speedToKnots,
    altitudeToFeet,
    throttleToPercent,
    headingDegrees,
    formatHeading,
    compassPoint,
    verticalSpeedToFeetPerMinute,
    formatVerticalSpeed,
    isLowAltitude
} from '../js/hud.js';
import { GROUND_CLEARANCE } from '../js/crash.js';
import { createFlightState } from '../js/flight-state.js';

// js/aircraft.js and js/camera.js both import Three.js, so the HUD's contract
// with them is checked against their source rather than by loading them.
const readSource = (name) => readFileSync(
    fileURLToPath(new URL(`../js/${name}`, import.meta.url)),
    'utf8'
);
const hudSource      = readSource('hud.js');
const aircraftSource = readSource('aircraft.js');
const cameraSource   = readSource('camera.js');

const callsOn = (source, receiver) => new Set(
    [...source.matchAll(new RegExp(`${receiver}\\.(\\w+)\\(`, 'g'))].map(match => match[1])
);
const defines = (source, method) =>
    new RegExp(`^\\s*${method}\\s*\\([^)]*\\)\\s*\\{`, 'm').test(source);

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

// --- Heading ---

test('a flight starts on north, the way it is pointed', () => {
    assert.equal(headingDegrees(createFlightState().rotation.y), 0);
});

test('turning right walks the compass card up through east, south, and west', () => {
    // The aircraft yaws right through the falling side of the yaw angle
    assert.equal(headingDegrees(-Math.PI / 2), 90);
    assert.equal(headingDegrees(-Math.PI), 180);
    assert.equal(headingDegrees(-Math.PI * 1.5), 270);
});

test('turning left walks the card back down through west', () => {
    assert.equal(headingDegrees(Math.PI / 2), 270);
    assert.equal(headingDegrees(Math.PI), 180);
});

test('the compass wraps rather than counting past a full turn', () => {
    assert.equal(headingDegrees(-Math.PI * 2), 0);
    assert.equal(headingDegrees(-Math.PI * 6), 0, 'three turns is still one heading');
    assert.equal(headingDegrees(-Math.PI * 2.5), 90);
});

test('a heading is always a bearing on the card, never a negative angle', () => {
    for (let yaw = -20; yaw <= 20; yaw += 0.13) {
        const heading = headingDegrees(yaw);
        assert.ok(heading >= 0 && heading < 360, `yaw ${yaw} read as ${heading}`);
        assert.equal(Number.isInteger(heading), true, `yaw ${yaw} read as ${heading}`);
    }
});

test('headings read as the three digits a compass card shows', () => {
    assert.equal(formatHeading(0), '000');
    assert.equal(formatHeading(7), '007');
    assert.equal(formatHeading(90), '090');
    assert.equal(formatHeading(359), '359');
});

test('the compass point names the quarter the nose is in', () => {
    assert.equal(compassPoint(0), 'N');
    assert.equal(compassPoint(90), 'E');
    assert.equal(compassPoint(180), 'S');
    assert.equal(compassPoint(270), 'W');
    assert.equal(compassPoint(45), 'NE');
    assert.equal(compassPoint(315), 'NW');
});

test('north covers the wrap either side of the card, not just the top', () => {
    assert.equal(compassPoint(350), 'N');
    assert.equal(compassPoint(359), 'N');
    assert.equal(compassPoint(10), 'N');
});

test('every bearing on the card names one of the eight points', () => {
    for (let degrees = 0; degrees < 360; degrees++) {
        assert.ok(COMPASS_POINTS.includes(compassPoint(degrees)), `${degrees} named nothing`);
    }
});

// --- Vertical speed ---

test('level flight reads a flat zero on the vertical speed indicator', () => {
    assert.equal(verticalSpeedToFeetPerMinute(0), 0);
    assert.equal(formatVerticalSpeed(verticalSpeedToFeetPerMinute(0)), '0');
});

test('a climb reads positive and a descent negative, in feet per minute', () => {
    assert.equal(verticalSpeedToFeetPerMinute(10), Math.round(10 * FEET_PER_UNIT * 60 / 10) * 10);
    assert.ok(verticalSpeedToFeetPerMinute(10) > 0);
    assert.equal(verticalSpeedToFeetPerMinute(-10), -verticalSpeedToFeetPerMinute(10));
});

test('the indicator rounds off, so the readout settles instead of flickering', () => {
    for (const rate of [0.1, 1.7, -4.3, 12.9]) {
        const fpm = verticalSpeedToFeetPerMinute(rate);
        assert.ok(fpm % VERTICAL_SPEED_STEP === 0, `${fpm} is not a whole step`);
    }
});

test('a climb always carries its sign, so it cannot be misread as a descent', () => {
    assert.equal(formatVerticalSpeed(1200), '+1200');
    assert.equal(formatVerticalSpeed(-1200), '-1200');
    assert.equal(formatVerticalSpeed(0), '0', 'level flight needs no sign');
});

test('a barely-there drift reads as level rather than as minus nothing', () => {
    assert.equal(formatVerticalSpeed(verticalSpeedToFeetPerMinute(-0.001)), '0');
});

// --- Low altitude warning ---

test('the warning is measured against the ground, not against sea level', () => {
    const threshold = LOW_ALTITUDE_FEET / FEET_PER_UNIT;
    assert.equal(isLowAltitude(threshold - 1), true);
    assert.equal(isLowAltitude(threshold + 1), false);
});

test('cruising well clear of the terrain below leaves the warning off', () => {
    assert.equal(isLowAltitude(createFlightState().position.y), false);
});

test('sitting on the ground is as low as the warning ever gets', () => {
    assert.equal(isLowAltitude(GROUND_CLEARANCE), true);
    assert.equal(isLowAltitude(0), true);
});

test('the warning has room to sound before the ground arrives', () => {
    assert.ok(LOW_ALTITUDE_FEET > altitudeToFeet(GROUND_CLEARANCE),
        'a warning that only trips on contact warns of nothing');
});

// --- What the HUD reads its instruments from ---

test('the aircraft answers every reading the HUD asks it for', () => {
    const asked = callsOn(hudSource, 'aircraft');
    assert.ok(asked.size > 0, 'the HUD should read its instruments off the aircraft');
    for (const method of asked) {
        assert.ok(defines(aircraftSource, method), `js/aircraft.js is missing ${method}()`);
    }
});

test('the camera controller answers every reading the HUD asks it for', () => {
    const asked = callsOn(hudSource, 'cameraController');
    assert.ok(asked.size > 0, 'the HUD should read the camera mode off the controller');
    for (const method of asked) {
        assert.ok(defines(cameraSource, method), `js/camera.js is missing ${method}()`);
    }
});

test('the new instruments are wired to the aircraft and not to guesses', () => {
    const asked = callsOn(hudSource, 'aircraft');
    for (const method of ['getHeading', 'getVerticalSpeed', 'getHeightAboveTerrain', 'isCrashed']) {
        assert.ok(asked.has(method), `the HUD should read ${method}() off the aircraft`);
    }
});
