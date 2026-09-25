import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
    createInputState, applyKeyToInput, isLevelOffKey, isResetKey,
    wantsVerticalChange, LEVEL_OFF_KEYS, VERTICAL_CONTROLS, CONTROL_NAMES
} from '../js/input-map.js';
import { MENU_SELECT_KEYS } from '../js/menu.js';
import { LEVEL_OFF_SECONDS } from '../js/flight-model.js';

// js/aircraft.js imports Three.js, so what it does with these keys is read off
// its source rather than by loading it.
const aircraftSource = readFileSync(
    fileURLToPath(new URL('../js/aircraft.js', import.meta.url)),
    'utf8'
);

// The two comments that go stale together, read as text: the one above the
// binding, and the one above the test that covers it, in this file.
const inputMapSource = readFileSync(
    fileURLToPath(new URL('../js/input-map.js', import.meta.url)),
    'utf8'
);
const ownSource = readFileSync(fileURLToPath(import.meta.url), 'utf8');

/**
 * The comment block sitting directly above `anchor` in `source`, as one string.
 * Walks back from the anchor while the lines are comment lines, which covers
 * both shapes read here - the run of `//` lines above a binding, and the doc
 * block above a test.
 */
function commentAbove(source, anchor) {
    const lines = source.split('\n');
    const at = lines.findIndex(line => line.includes(anchor));
    assert.ok(at > 0, `${anchor} should be in the source being read`);

    const comment = [];
    for (let index = at - 1; index >= 0; index--) {
        const line = lines[index].trim();
        if (line === '' || !/^(\/\/|\/\*|\*)/.test(line)) break;
        comment.unshift(line);
    }
    return comment.join('\n');
}

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
 * does it in one press: the vertical speed goes to zero on the frame the key
 * goes down, and the nose eases from wherever the pilot left it to level over
 * LEVEL_OFF_SECONDS, so the pilot is not left flying the attitude back by hand
 * after the instrument has already said the climb is over.
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
//
// Every field the frame hands `heldAltitude` is asked for by name, and the span
// in front of each is `[^}]*?` rather than the `[\s\S]*?` the source-matching
// tests elsewhere in this folder use, so it cannot run past the call's own
// closing brace. Today either bound would catch a deleted field, because each
// of the three texts occurs once in js/aircraft.js. The difference is what
// happens the day one of them is written a second time anywhere below this
// call: a span free to reach the end of the file matches that second
// occurrence and passes a field the call no longer has, while a span stopped
// at the closing brace still fails. The bound is held against that day rather
// than against anything the file carries now.
test('the aircraft holds the altitude it was levelled at', () => {
    assert.ok(/levelOff\(\)\s*\{/.test(aircraftSource),
        'js/aircraft.js should offer the level off as something it can be asked for');
    assert.ok(aircraftSource.includes('isLevelOffKey(e.code)'),
        'and read it off the binding rather than a key written into the frame loop');
    assert.ok(aircraftSource.includes('wantsVerticalChange(this.input)'),
        'and let go of it where the pilot calls for a different vertical state');
    assert.ok(/levelOff\(\)\s*\{[\s\S]*?this\.levelling = \{/.test(aircraftSource),
        'the one press brings the nose to level as well as trimming the climb out');
    assert.ok(/this\.position\.y = heldAltitude\(startY, this\.position\.y, \{/
        .test(aircraftSource),
        'the altitude held is the one the aircraft was at');
    assert.ok(/heldAltitude\(startY, this\.position\.y, \{[^}]*?holding:\s*this\.holdingAltitude/
        .test(aircraftSource),
        'and only while the hold is in force, so the flag the press sets is the one the frame reads');
    assert.ok(/heldAltitude\(startY, this\.position\.y, \{[^}]*?airborne:\s*this\.airborne/
        .test(aircraftSource),
        'and only in the air');
    assert.ok(/heldAltitude\(startY, this\.position\.y, \{[^}]*?engine:\s*this\.engine/
        .test(aircraftSource),
        'and only under power, so a glide cannot be trimmed to stop coming down');
});

/**
 * The comments nearest the binding spent a version describing the level off as
 * leaving the nose alone, which is what it did until the nose was eased to
 * level, and nothing caught it - a comment being the one part of a module no
 * test reads. This one reads them, and asks that each name the interval rather
 * than write it out, so the number moving cannot strand either of them.
 */
test('the level off is described where it is bound as the ease it is', () => {
    const comments = [
        ['js/input-map.js', commentAbove(inputMapSource, 'export const LEVEL_OFF_KEYS')],
        ['this file',       commentAbove(ownSource, "test('space levels the flight off'")]
    ];

    for (const [where, comment] of comments) {
        assert.ok(comment.includes('LEVEL_OFF_SECONDS'),
            `the level off comment in ${where} should name the interval the nose eases over`);
        assert.ok(!comment.includes(String(LEVEL_OFF_SECONDS)),
            `and name it rather than writing ${LEVEL_OFF_SECONDS} out, which goes stale when the interval moves`);
    }
});
