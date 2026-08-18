import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
    INITIAL_SPEED,
    INITIAL_ALTITUDE,
    createFlightState
} from '../js/flight-state.js';
import { speedToKnots, altitudeToFeet } from '../js/hud.js';

const indexHtml = readFileSync(
    fileURLToPath(new URL('../index.html', import.meta.url)),
    'utf8'
);

test('gameplay starts at an airspeed of 0 knots', () => {
    assert.equal(INITIAL_SPEED, 0);
    assert.equal(speedToKnots(createFlightState().speed), 0);
});

test('the HUD airspeed readout starts at 0 before the first frame renders', () => {
    const match = indexHtml.match(/id="hud-speed"[^>]*>([^<]*)</);
    assert.ok(match, 'index.html should contain the hud-speed readout');
    assert.equal(match[1].trim(), '0');
});

test('the aircraft starts aloft and level', () => {
    const state = createFlightState();
    assert.equal(state.position.y, INITIAL_ALTITUDE);
    assert.equal(altitudeToFeet(state.position.y), 984);
    assert.deepEqual(state.position, { x: 0, y: INITIAL_ALTITUDE, z: 0 });
    assert.deepEqual(state.rotation, { x: 0, y: 0, z: 0 });
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
