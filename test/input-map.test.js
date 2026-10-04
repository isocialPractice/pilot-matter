import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
    createInputState, applyKeyToInput, isLevelOffKey, isResetKey,
    wantsVerticalChange, LEVEL_OFF_KEYS, VERTICAL_CONTROLS, CONTROL_NAMES,
    AXIS_DIRECTIONAL, AXIS_INVERTED, AXIS_CONTROLS, AXIS_NAMES, AXIS_CONTROL_NAMES,
    DEFAULT_AXES, DEFAULT_KEYMAP, controlAxis, isAxisInverted, axisControl,
    resolveAxes, releaseAxisControls
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
// Three things have to hold and none of them can be run here, because
// js/aircraft.js imports three and cannot be constructed in Node: the frame
// asks `heldAltitude` for the right thing, the press is refused with no engine,
// and an engine dying under a hold hands the aircraft back. So all three are
// read out of the source, and the two refusals are read because deleting either
// of them left the whole suite green.
//
// Every span in this test that matches the source is bounded with `[^}]*?`
// rather than the `[\s\S]*?` the source-matching tests elsewhere in this folder
// use, so none of them can run past the closing brace of the call it is
// anchored on. Today either bound would catch a deleted line, because each of
// the texts they look for occurs once in js/aircraft.js. The difference is what
// happens the day one of them is written a second time anywhere below its own
// call: a span free to reach the end of the file matches that second occurrence
// and passes a call that no longer makes it, while a span stopped at the
// closing brace still fails. The bound is held against that day rather than
// against anything the file carries now.
test('the aircraft holds the altitude it was levelled at', () => {
    assert.ok(/levelOff\(\)\s*\{/.test(aircraftSource),
        'js/aircraft.js should offer the level off as something it can be asked for');
    assert.ok(aircraftSource.includes('isLevelOffKey(e.code)'),
        'and read it off the binding rather than a key written into the frame loop');
    assert.ok(aircraftSource.includes('wantsVerticalChange(this.input)'),
        'and let go of it where the pilot calls for a different vertical state');
    assert.ok(/levelOff\(\)\s*\{[^}]*?this\.levelling = \{/.test(aircraftSource),
        'the one press brings the nose to level as well as trimming the climb out');
    assert.ok(/levelOff\(\)\s*\{[^}]*?if \(!this\.engine\) return false;/.test(aircraftSource),
        'and is refused with no engine, so a glide cannot be trimmed to stop coming down');
    assert.ok(/setEngine\([^)]*\)\s*\{[^}]*?if \(!this\.engine\) this\.endLevelOff\(\);/
        .test(aircraftSource),
        'and an engine dying under a hold already in force hands the aircraft back');
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

// --- Which way an axis reads its keys --------------------------------------

test('both axes read the way the key is drawn until a pilot asks otherwise', () => {
    assert.deepEqual({ ...DEFAULT_AXES }, { pitch: AXIS_DIRECTIONAL, roll: AXIS_DIRECTIONAL });
    for (const axis of AXIS_NAMES) {
        assert.equal(isAxisInverted(DEFAULT_AXES, axis), false, `${axis} should open directional`);
    }
});

// An axis is a pair of ends rather than a name with a rule applied to it, so
// every control the flight model reads is either on one axis or on neither.
test('each axis is two of the controls, and no control is on two axes', () => {
    for (const axis of AXIS_NAMES) {
        assert.equal(AXIS_CONTROLS[axis].length, 2, `${axis} is flown with two controls`);
        for (const name of AXIS_CONTROLS[axis]) {
            assert.ok(CONTROL_NAMES.includes(name), `${name} should be a control the flight model reads`);
            assert.equal(controlAxis(name), axis);
        }
    }

    assert.equal(new Set(AXIS_CONTROL_NAMES).size, AXIS_CONTROL_NAMES.length);
    for (const name of ['yawLeft', 'yawRight', 'throttleUp', 'throttleDown']) {
        assert.equal(controlAxis(name), null, `${name} is not on an axis a pilot can turn over`);
    }
});

test('a directional axis leaves its keys alone and an inverted one exchanges them', () => {
    for (const axis of AXIS_NAMES) {
        const [low, high] = AXIS_CONTROLS[axis];
        const inverted = { ...DEFAULT_AXES, [axis]: AXIS_INVERTED };

        assert.equal(axisControl(low, DEFAULT_AXES), low);
        assert.equal(axisControl(high, DEFAULT_AXES), high);
        assert.equal(axisControl(low, inverted), high);
        assert.equal(axisControl(high, inverted), low);
    }
});

// The whole point of the two settings being two settings: all four states fall
// out of them, and turning one over says nothing about the other.
test('the two axes are turned over independently, and make four states between them', () => {
    const states = [];

    for (const pitch of [AXIS_DIRECTIONAL, AXIS_INVERTED]) {
        for (const roll of [AXIS_DIRECTIONAL, AXIS_INVERTED]) {
            const axes = { pitch, roll };
            states.push([axisControl('pitchUp', axes), axisControl('rollLeft', axes)].join('+'));
        }
    }

    assert.deepEqual(states, [
        'pitchUp+rollLeft', 'pitchUp+rollRight', 'pitchDown+rollLeft', 'pitchDown+rollRight'
    ]);
});

// WASD and the arrow keys are two spellings of one control rather than two
// control schemes, so an axis turned over turns over for both of them at once.
test('an inverted axis reads both spellings of its input the same way', () => {
    const axes = { pitch: AXIS_INVERTED, roll: AXIS_INVERTED };

    for (const [control, codes] of Object.entries(DEFAULT_KEYMAP)) {
        const axis = controlAxis(control);
        if (!axis) continue;

        const expected = axisControl(control, axes);
        for (const code of codes) {
            const input = createInputState();
            assert.equal(applyKeyToInput(input, code, true, DEFAULT_KEYMAP, axes), expected,
                `${code} should work ${expected} while ${axis} is inverted`);
            assert.equal(input[expected], true);
            assert.equal(input[control], false, `and should leave ${control} alone`);
        }
    }
});

test('an axis nobody turned over writes exactly what it always wrote', () => {
    for (const [control, codes] of Object.entries(DEFAULT_KEYMAP)) {
        for (const code of codes) {
            const input = createInputState();
            assert.equal(applyKeyToInput(input, code, true), control);
            assert.equal(input[control], true);
        }
    }
});

test('a key the keymap does not bind writes nothing, whichever way the axes read', () => {
    const input = createInputState();
    assert.equal(applyKeyToInput(input, 'KeyZ', true, DEFAULT_KEYMAP, { pitch: AXIS_INVERTED }), null);
    assert.ok(CONTROL_NAMES.every(name => input[name] === false));
});

test('an axis setting from somewhere else falls back on its own', () => {
    assert.deepEqual(resolveAxes(), { ...DEFAULT_AXES });
    assert.deepEqual(resolveAxes({ pitch: AXIS_INVERTED, roll: 'sideways' }),
        { pitch: AXIS_INVERTED, roll: AXIS_DIRECTIONAL });
    assert.deepEqual(resolveAxes({ pitch: null }), { ...DEFAULT_AXES });
    assert.deepEqual(resolveAxes('inverted'), { ...DEFAULT_AXES },
        'a setting that is not a pair of axes is no setting at all');
});

/**
 * The failure this exists for: a key held down while its axis is turned over is
 * released by the other end of its pair when it finally comes up, which leaves
 * the end that was pressed held for the rest of the flight. An aircraft rolling
 * on its own with nothing on the keyboard that stops it.
 */
test('turning an axis over lets go of what it was holding', () => {
    const input = createInputState();

    applyKeyToInput(input, 'KeyW', true);
    applyKeyToInput(input, 'KeyA', true);
    assert.equal(input.pitchUp, true);
    assert.equal(input.rollLeft, true);

    releaseAxisControls(input);
    for (const name of AXIS_CONTROL_NAMES) {
        assert.equal(input[name], false, `${name} should have been let go of`);
    }

    // The key coming up on the other end of the pair now releases a control that
    // is already released, which is the harmless half of the problem.
    applyKeyToInput(input, 'KeyW', false, DEFAULT_KEYMAP, { pitch: AXIS_INVERTED });
    assert.ok(AXIS_CONTROL_NAMES.every(name => input[name] === false));
});

test('letting go of the axes leaves every other control where it was', () => {
    const input = createInputState();

    applyKeyToInput(input, 'KeyQ', true);
    applyKeyToInput(input, 'ShiftLeft', true);
    releaseAxisControls(input);

    assert.equal(input.yawLeft, true, 'yaw is not on an axis a pilot can turn over');
    assert.equal(input.throttleUp, true, 'and neither is the lever');
});

test('letting go of the axes adds nothing to an input state that has no such field', () => {
    const input = { pitchUp: true };
    releaseAxisControls(input);

    assert.deepEqual(Object.keys(input), ['pitchUp']);
    assert.equal(input.pitchUp, false);
});

/**
 * The aircraft hands its own axes to the input map rather than taking the
 * default, and lets go of the four controls when they change. Read off the
 * source because js/aircraft.js imports Three.js and cannot be built in Node.
 */
test('the aircraft reads its keys through the axes the pilot set', () => {
    assert.ok(/applyKeyToInput\(this\.input, e\.code, down, this\.keymap, this\.axes\)/
        .test(aircraftSource),
        'the aircraft should pass its own axes to the input map');
    assert.ok(/setAxes\([^)]*\)\s*\{[^}]*?releaseAxisControls\(this\.input\)/
        .test(aircraftSource),
        'and let go of both ends of both axes when they change');
});
