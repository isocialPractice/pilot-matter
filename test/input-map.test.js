import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
    createInputState, applyKeyToInput, isLevelOffKey, isResetKey,
    wantsVerticalChange, LEVEL_OFF_KEYS, VERTICAL_CONTROLS, CONTROL_NAMES
} from '../js/input-map.js';
import { MENU_SELECT_KEYS } from '../js/menu.js';

// js/aircraft.js imports Three.js, so what it does with these keys is read off
// its source rather than by loading it.
const aircraftSource = readFileSync(
    fileURLToPath(new URL('../js/aircraft.js', import.meta.url)),
    'utf8'
);

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

// --- Levelling off ---------------------------------------------------------

/**
 * Holding an altitude used to mean trimming the vertical speed to zero by hand,
 * which is a fiddle in the middle of everything else a landing asks for. Space
 * does it in one press, and leaves the nose where the pilot put it.
 */
test('space levels the flight off', () => {
    assert.equal(isLevelOffKey('Space'), true);
    assert.equal(isLevelOffKey('KeyZ'), false);
    assert.equal(isLevelOffKey('Enter'), false, 'choosing a menu entry is not levelling off');
});

/**
 * It is bound beside reset rather than among the control surfaces, and for the
 * same reason reset is: it is an instruction rather than a surface held while a
 * key is down. Space is also the key a menu is chosen with, and a surface a
 * menu key could write to is a surface waiting for the one path that forgets to
 * take the key first.
 */
test('levelling off is an instruction rather than a control surface', () => {
    assert.ok(!CONTROL_NAMES.includes('levelOff'),
        'the input state is control surfaces, and this is not one');

    const input = createInputState();
    for (const code of [...LEVEL_OFF_KEYS, ...MENU_SELECT_KEYS]) {
        assert.equal(applyKeyToInput(input, code, true), null, `${code} should not fly the aircraft`);
    }
    assert.deepEqual(input, createInputState());

    assert.ok(!LEVEL_OFF_KEYS.some(code => isResetKey(code)),
        'and it is its own instruction rather than a second name for reset');
});

/**
 * The hold ends when the pilot calls for a different vertical state. Roll and
 * yaw are not that call: an altitude held through a turn is what holding one is
 * for, and a hold that let go on the first aileron input would be a hold nobody
 * could use in a circuit.
 */
test('the next call for a different vertical state hands the aircraft back', () => {
    for (const control of VERTICAL_CONTROLS) {
        assert.equal(wantsVerticalChange({ ...createInputState(), [control]: true }), true,
            `${control} is the pilot taking the vertical back`);
    }
});

test('a turn is not a call for a different altitude', () => {
    for (const control of ['rollLeft', 'rollRight', 'yawLeft', 'yawRight']) {
        assert.equal(wantsVerticalChange({ ...createInputState(), [control]: true }), false,
            `${control} should leave the hold in force`);
    }
    assert.equal(wantsVerticalChange(createInputState()), false, 'and hands off, nothing moves');
    assert.equal(wantsVerticalChange(null), false, 'and no input at all is not a call either');
});

// The hold is the aircraft's, taken on the press and let go where the pilot
// asks for something else, rather than held for as long as the key is down.
test('the aircraft holds the altitude it was levelled at', () => {
    assert.ok(/levelOff\(\)\s*\{/.test(aircraftSource),
        'js/aircraft.js should offer the level off as something it can be asked for');
    assert.ok(aircraftSource.includes('isLevelOffKey(e.code)'),
        'and read it off the binding rather than a key written into the frame loop');
    assert.ok(aircraftSource.includes('wantsVerticalChange(this.input)'),
        'and let go of it where the pilot calls for a different vertical state');
    assert.ok(/this\.holdingAltitude && this\.airborne\)\s*this\.position\.y = startY/
        .test(aircraftSource),
        'the altitude held is the one the aircraft was at, and only in the air');
});
