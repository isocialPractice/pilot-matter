import test from 'node:test';
import assert from 'node:assert/strict';
import { createInputState, applyKeyToInput } from '../js/input-map.js';

test('createInputState starts with every control released', () => {
    const input = createInputState();
    for (const [name, value] of Object.entries(input)) {
        assert.equal(value, false, `${name} should start false`);
    }
});

test('primary and arrow keys map to the same pitch/roll fields', () => {
    const pairs = [
        ['KeyW', 'ArrowUp', 'pitchUp'],
        ['KeyS', 'ArrowDown', 'pitchDown'],
        ['KeyA', 'ArrowLeft', 'rollLeft'],
        ['KeyD', 'ArrowRight', 'rollRight']
    ];
    for (const [primary, alternate, field] of pairs) {
        const input = createInputState();
        assert.equal(applyKeyToInput(input, primary, true), field);
        assert.equal(input[field], true);
        assert.equal(applyKeyToInput(input, alternate, false), field);
        assert.equal(input[field], false);
    }
});

test('Q and E map to yaw left and yaw right', () => {
    const input = createInputState();
    assert.equal(applyKeyToInput(input, 'KeyQ', true), 'yawLeft');
    assert.equal(input.yawLeft, true);
    assert.equal(applyKeyToInput(input, 'KeyE', true), 'yawRight');
    assert.equal(input.yawRight, true);
    assert.equal(applyKeyToInput(input, 'KeyQ', false), 'yawLeft');
    assert.equal(input.yawLeft, false);
    assert.equal(input.yawRight, true, 'releasing Q must not release E');
});

test('either shift or ctrl key drives the throttle fields', () => {
    const input = createInputState();
    assert.equal(applyKeyToInput(input, 'ShiftLeft', true), 'throttleUp');
    assert.equal(applyKeyToInput(input, 'ShiftRight', false), 'throttleUp');
    assert.equal(input.throttleUp, false);
    assert.equal(applyKeyToInput(input, 'ControlRight', true), 'throttleDown');
    assert.equal(input.throttleDown, true);
});

test('unmapped keys return null and leave the state untouched', () => {
    const input = createInputState();
    assert.equal(applyKeyToInput(input, 'KeyZ', true), null);
    assert.equal(applyKeyToInput(input, 'Space', true), null);
    assert.deepEqual(input, createInputState());
});
