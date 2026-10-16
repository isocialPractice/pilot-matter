import test from 'node:test';
import assert from 'node:assert/strict';
import {
    KEY_BINDINGS_STORAGE_KEY,
    RESET_BINDING,
    LEVEL_OFF_BINDING,
    ACTION_BINDINGS,
    DEFAULT_BINDINGS,
    BINDING_NAMES,
    BINDING_LABELS,
    OPTIONAL_BINDINGS,
    UNBOUND_LABEL,
    BINDING_CANCEL_KEYS,
    BINDING_CLEAR_KEYS,
    keyLabel,
    bindingLabel,
    bindingOptional,
    isBindingCancelKey,
    isBindingClearKey,
    defaultBindings,
    cloneBindings,
    resolveBindings,
    boundTo,
    bindingKeys,
    rebind,
    clearBinding,
    restoreBindings,
    bindingsAreDefault,
    keymapFor,
    aircraftBindings,
    readKeyBindings,
    writeKeyBindings,
    reservedKeys,
    reservedRole,
    isReservedKey
} from '../js/key-bindings.js';
import {
    DEFAULT_KEYMAP, CONTROL_NAMES, RESET_KEYS, LEVEL_OFF_KEYS,
    createInputState, applyKeyToInput
} from '../js/input-map.js';
import { MENU_UP_KEYS, MENU_DOWN_KEYS, MENU_SELECT_KEYS } from '../js/menu.js';

// The keys the game reads for itself, imported from the modules that read them
// rather than written out here. A code copied into this file would pass against
// itself for ever, which is the one thing these tests must not do.
import { HUD_TOGGLE_KEY }    from '../js/hud-visibility.js';
import { PAUSE_KEY }         from '../js/pause.js';
import { HELP_KEY }          from '../js/controls-help.js';
import { MUTE_KEY }          from '../js/audio.js';
import { SETTINGS_OPEN_KEYS } from '../js/settings.js';
import { EDITOR_OPEN_KEYS }  from '../js/element-editor.js';
import { PHOTO_KEY }         from '../js/photo.js';
import { CAMERA_CYCLE_KEY }  from '../js/camera-math.js';

// A storage that remembers, for the map to be written into and read back out.
function fakeStorage(initial = {}) {
    const held = { ...initial };
    return {
        held,
        getItem: (key) => (key in held ? held[key] : null),
        setItem: (key, value) => { held[key] = String(value); }
    };
}

test('every control and both instructions are something a key can be put on', () => {
    for (const name of CONTROL_NAMES) {
        assert.deepEqual(DEFAULT_BINDINGS[name], DEFAULT_KEYMAP[name],
            `${name} should open on the keys the keymap already binds it to`);
    }

    assert.deepEqual(DEFAULT_BINDINGS[RESET_BINDING], [...RESET_KEYS]);
    assert.deepEqual(DEFAULT_BINDINGS[LEVEL_OFF_BINDING], [...LEVEL_OFF_KEYS]);
    assert.deepEqual(BINDING_NAMES, [...CONTROL_NAMES, ...ACTION_BINDINGS],
        'the control surfaces first, then the two keys that are not surfaces');
});

// A row with nothing written on it is a row nobody can work, so every binding
// has to be something a pilot can read off the panel.
test('every binding has a name a pilot reads it by', () => {
    for (const name of BINDING_NAMES) {
        assert.ok(BINDING_LABELS[name]?.length > 0, `${name} needs a label`);
    }
    assert.equal(new Set(Object.values(BINDING_LABELS)).size, BINDING_NAMES.length,
        'two bindings under one name is one row the pilot cannot tell from another');
});

test('no key starts out on two bindings', () => {
    const codes = BINDING_NAMES.flatMap(name => DEFAULT_BINDINGS[name]);
    assert.equal(new Set(codes).size, codes.length,
        'a key on two bindings is a keyboard working two things at once');
});

// The map is what the whole panel edits, so a default anything can write
// through is a default the next session reads back changed.
test('the map the game ships with cannot be written through', () => {
    assert.throws(() => { DEFAULT_BINDINGS.pitchUp = ['KeyZ']; });
    assert.throws(() => { DEFAULT_BINDINGS.pitchUp.push('KeyZ'); });

    const mine = defaultBindings();
    mine.pitchUp.push('KeyZ');
    assert.deepEqual(DEFAULT_BINDINGS.pitchUp, [...DEFAULT_KEYMAP.pitchUp],
        'a copy handed out is the caller\'s to write on');
});

test('a key reads as what is written on it rather than as its code', () => {
    assert.equal(keyLabel('KeyW'), 'W');
    assert.equal(keyLabel('KeyR'), 'R');
    assert.equal(keyLabel('Digit4'), '4');
    assert.equal(keyLabel('ArrowUp'), '↑');
    assert.equal(keyLabel('Space'), 'Space');
    assert.equal(keyLabel('Numpad5'), 'Num 5');

    // Both sides of a modifier read as one key, because that is what the
    // keyboard shows and what the reference list has always written.
    assert.equal(keyLabel('ShiftLeft'), keyLabel('ShiftRight'));
    assert.equal(keyLabel('ControlLeft'), 'Ctrl');

    // A key nothing here knows is shown as its code. A row naming a key
    // awkwardly is better than a blank row where a key should be.
    assert.equal(keyLabel('F7'), 'F7');
    assert.equal(keyLabel('SomethingNew'), 'SomethingNew');
    assert.equal(keyLabel(''), '');
    assert.equal(keyLabel(null), '');
});

test('a binding reads as every key it is on, and a binding on none says so', () => {
    assert.equal(bindingLabel(DEFAULT_BINDINGS.pitchUp), 'W/↑');
    assert.equal(bindingLabel(DEFAULT_BINDINGS.throttleUp), 'Shift',
        'the two Shift keys are one key to read, so they are written once');
    assert.equal(bindingLabel([]), UNBOUND_LABEL);
    assert.equal(bindingLabel(), UNBOUND_LABEL);
});

/**
 * Reset is the only binding a pilot may leave on nothing, and that is the whole
 * of why this is a list rather than a flag: `R` ends a flight on one press with
 * nothing in between, while a control surface with no key is a surface nothing
 * can work.
 */
test('only the reset is allowed to be on no key at all', () => {
    assert.deepEqual(OPTIONAL_BINDINGS, [RESET_BINDING]);
    assert.equal(bindingOptional(RESET_BINDING), true);
    for (const name of BINDING_NAMES.filter(other => other !== RESET_BINDING)) {
        assert.equal(bindingOptional(name), false, `${name} has to be on something`);
    }
});

// A row that waits for any key at all has to keep a key back to stop waiting
// with, and those keys are therefore the ones nothing can be bound to.
test('the way out of the wait and the way to clear are not keys to bind', () => {
    for (const code of BINDING_CANCEL_KEYS) assert.equal(isBindingCancelKey(code), true);
    for (const code of BINDING_CLEAR_KEYS)  assert.equal(isBindingClearKey(code), true);

    assert.equal(isBindingCancelKey('KeyW'), false);
    assert.equal(isBindingClearKey('KeyW'), false);

    const reserved = [...BINDING_CANCEL_KEYS, ...BINDING_CLEAR_KEYS];
    assert.equal(new Set(reserved).size, reserved.length,
        'a key that both cancels and clears would do one of them and not the other');
    for (const code of reserved) {
        assert.equal(boundTo(DEFAULT_BINDINGS, code), null,
            `${code} is kept back from binding, so nothing may ship on it`);
    }
});

/**
 * A key the game reads for itself is not the map's to take. Two listeners read
 * one press and neither knows of the other, so a control surface bound onto one
 * of these is an aircraft that pauses itself when it rolls right - and the key
 * was taken with nothing said, which is the part that made it a defect rather
 * than a choice.
 *
 * The list is read off the modules that own the keys, so a key renamed in its
 * own module fails here rather than dropping silently out of the guard.
 */
test('the keys the game reads for itself are not the map\'s to take', () => {
    const owned = [
        HUD_TOGGLE_KEY, PAUSE_KEY, HELP_KEY, MUTE_KEY,
        ...SETTINGS_OPEN_KEYS, ...EDITOR_OPEN_KEYS, PHOTO_KEY, CAMERA_CYCLE_KEY
    ];

    assert.deepEqual([...reservedKeys()].sort(), [...new Set(owned)].sort(),
        'the reserved list is those modules\' own keys and nothing else');

    for (const code of owned) {
        assert.equal(isReservedKey(code), true, `${code} is read by the game`);
        assert.ok(reservedRole(code), `${code} says what it is already doing`);
    }

    for (const code of reservedKeys()) {
        const bindings = defaultBindings();

        assert.deepEqual(rebind(bindings, 'rollRight', code),
            { result: 'reserved', conflict: reservedRole(code) },
            `${code} is refused, and the refusal says what the key already does`);
        assert.deepEqual(bindings.rollRight, [...DEFAULT_BINDINGS.rollRight],
            'the row that asked is left on the key it was already on');
        assert.equal(boundTo(bindings, code), null,
            `and nothing anywhere in the map holds ${code}`);
    }

    // Nothing ships on one of them, so reserving them costs a pilot nothing out
    // of the box.
    for (const code of reservedKeys()) {
        assert.equal(boundTo(DEFAULT_BINDINGS, code), null,
            `${code} is the game's, so no binding may ship on it`);
    }

    assert.equal(isReservedKey('KeyZ'), false);
    assert.equal(reservedRole('KeyZ'), null);
});

/**
 * A map stored before the keys above were reserved still has the collision
 * written down, so reading it back unchanged would hand a pilot the pausing
 * aircraft on every load of the version that refuses to let them build it.
 */
test('a stored map putting a control on a key the game reads is read past', () => {
    const bindings = resolveBindings({ rollRight: [PAUSE_KEY], yawLeft: [HUD_TOGGLE_KEY] });

    assert.deepEqual(bindings.rollRight, [...DEFAULT_BINDINGS.rollRight],
        'the binding is given its own keys back rather than left with the collision');
    assert.deepEqual(bindings.yawLeft, [...DEFAULT_BINDINGS.yawLeft]);
    assert.equal(boundTo(bindings, PAUSE_KEY), null);
    assert.equal(boundTo(bindings, HUD_TOGGLE_KEY), null);
});

/**
 * The cursor is worked with the keys the aircraft is flown with, so a pilot who
 * has bound a control onto a menu key can still reach the panel that undoes it.
 * The menu reads its keys before the flight behind it does, and the map has no
 * say in that - which is what makes `RESTORE DEFAULT KEYS` reachable from any
 * map at all.
 *
 * So the menu keys are not reserved, and this test is named for what it holds
 * rather than for a guarantee the map does not give. Nine of the eleven are
 * refused because a row already holds them - they are the keys the aircraft is
 * flown with, which is the whole point of choosing them - and `Enter` and
 * `NumpadEnter` are on no binding and bind like any other free key. Reserving
 * them was the alternative and was not taken: `W` has to stay bindable for the
 * axis settings that read it as both a cursor key and a pitch key, so reserving
 * the rest would buy a half-rule in exchange for two keys a pilot may want.
 */
test('the keys that walk the panel are the map\'s, and the menu reads them first', () => {
    const walking = [
        ...MENU_UP_KEYS, ...MENU_DOWN_KEYS, ...MENU_SELECT_KEYS
    ];

    for (const code of walking) {
        const bindings = defaultBindings();
        const holder = boundTo(DEFAULT_BINDINGS, code);
        const { result, conflict } = rebind(bindings, 'yawLeft', code);

        if (holder == null) {
            assert.equal(result, 'bound',
                `${code} is on no binding, so the map takes it like any other free key`);
            assert.deepEqual(bindings.yawLeft, [code]);
        } else {
            assert.deepEqual({ result, conflict }, { result: 'taken', conflict: holder },
                `${code} is refused because ${holder} holds it, not because it walks a menu`);
            assert.deepEqual(bindings.yawLeft, [...DEFAULT_BINDINGS.yawLeft]);
        }

        assert.equal(isReservedKey(code), false,
            `${code} is not reserved: the menu reading it first is what protects it`);
    }

    // The two that are free, named so that a default map which put a control on
    // one of them has to come through here.
    assert.deepEqual(walking.filter(code => boundTo(DEFAULT_BINDINGS, code) == null),
        ['Enter', 'NumpadEnter'],
        'the keys that choose a row are the only menu keys the map can take');
});

test('a key put on a binding is the key it is on, and the keys before it are let go', () => {
    const bindings = defaultBindings();

    assert.deepEqual(rebind(bindings, 'pitchUp', 'KeyI'), { result: 'bound', conflict: null });
    assert.deepEqual(bindings.pitchUp, ['KeyI'],
        'a control on two keys out of the box is on one once a pilot names one');
    assert.equal(boundTo(bindings, 'KeyW'), null, 'and the key it was on is free');
    assert.equal(boundTo(bindings, 'KeyI'), 'pitchUp');
});

test('a key already working something else is refused rather than taken from it', () => {
    const bindings = defaultBindings();

    assert.deepEqual(rebind(bindings, 'yawLeft', 'KeyW'), { result: 'taken', conflict: 'pitchUp' });
    assert.deepEqual(bindings.yawLeft, [...DEFAULT_BINDINGS.yawLeft], 'the row that asked is unchanged');
    assert.deepEqual(bindings.pitchUp, [...DEFAULT_BINDINGS.pitchUp], 'and so is the row that had it');
});

test('the key a binding is already on is the pilot saying they meant it', () => {
    const bindings = defaultBindings();
    assert.deepEqual(rebind(bindings, 'pitchUp', 'ArrowUp'), { result: 'held', conflict: null });
    assert.deepEqual(bindings.pitchUp, [...DEFAULT_BINDINGS.pitchUp],
        'which changes nothing, rather than dropping the other key it is on');
});

test('a binding or a key this module has never heard of moves nothing', () => {
    const bindings = defaultBindings();
    assert.deepEqual(rebind(bindings, 'nothingOfTheSort', 'KeyI'), { result: 'unknown', conflict: null });
    assert.deepEqual(rebind(bindings, 'pitchUp', ''), { result: 'unknown', conflict: null });
    assert.deepEqual(rebind(bindings, 'pitchUp', null), { result: 'unknown', conflict: null });
    assert.deepEqual(bindings, defaultBindings());
});

test('the reset can be left on nothing, and a control surface cannot', () => {
    const bindings = defaultBindings();

    assert.equal(clearBinding(bindings, RESET_BINDING), true);
    assert.deepEqual(bindings[RESET_BINDING], []);
    assert.equal(bindingLabel(bindings[RESET_BINDING]), UNBOUND_LABEL);

    assert.equal(clearBinding(bindings, 'pitchUp'), false);
    assert.deepEqual(bindings.pitchUp, [...DEFAULT_BINDINGS.pitchUp],
        'a control with no key is a control nothing can work');
    assert.equal(clearBinding(bindings, LEVEL_OFF_BINDING), false,
        'and the level off is an instruction the pilot still has to be able to give');
});

test('a map put back is the map it shipped as, however far it had been moved', () => {
    const bindings = defaultBindings();
    rebind(bindings, 'pitchUp', 'KeyI');
    rebind(bindings, 'rollLeft', 'KeyJ');
    clearBinding(bindings, RESET_BINDING);

    assert.equal(bindingsAreDefault(bindings), false);
    assert.deepEqual(restoreBindings(bindings), defaultBindings());
    assert.equal(bindingsAreDefault(bindings), true);
});

test('the keys one binding is on are handed over as a copy', () => {
    const bindings = defaultBindings();
    const keys = bindingKeys(bindings, 'pitchUp');

    keys.push('KeyZ');
    assert.deepEqual(bindings.pitchUp, [...DEFAULT_BINDINGS.pitchUp]);
    assert.deepEqual(bindingKeys(bindings, 'nothingOfTheSort'), []);
});

test('a copy of a map is one the caller can write on', () => {
    const copy = cloneBindings();
    copy.pitchUp.push('KeyZ');
    assert.deepEqual(DEFAULT_BINDINGS.pitchUp, [...DEFAULT_KEYMAP.pitchUp]);
    assert.deepEqual(cloneBindings({ pitchUp: ['KeyI'] }).pitchDown, [...DEFAULT_BINDINGS.pitchDown],
        'and a map missing a binding is filled from the one the game ships');
});

/**
 * A keymap carrying the two instructions is a keymap that can write one into
 * the input state, and the whole reason they are bound apart is that neither is
 * a control surface - see the comments on `RESET_KEYS` and `LEVEL_OFF_KEYS` in
 * js/input-map.js.
 */
test('the keymap handed to the input is the control surfaces and nothing else', () => {
    const bindings = defaultBindings();
    const keymap = keymapFor(bindings);

    assert.deepEqual(Object.keys(keymap), [...CONTROL_NAMES]);
    for (const name of ACTION_BINDINGS) assert.equal(name in keymap, false);

    const input = createInputState();
    for (const name of ACTION_BINDINGS) {
        for (const code of bindings[name]) {
            assert.equal(applyKeyToInput(input, code, true, keymap), null,
                `${code} works an instruction rather than a surface`);
        }
    }
    assert.deepEqual(input, createInputState());
});

test('a rebound control is the control the new key writes', () => {
    const bindings = defaultBindings();
    rebind(bindings, 'pitchUp', 'KeyI');

    const input = createInputState();
    const keymap = keymapFor(bindings);

    assert.equal(applyKeyToInput(input, 'KeyI', true, keymap), 'pitchUp');
    assert.equal(input.pitchUp, true);
    assert.equal(applyKeyToInput(input, 'KeyW', true, keymap), null,
        'and the key it used to be on writes nothing');
});

test('the aircraft is handed the surfaces and both key lists in one reading', () => {
    const bindings = defaultBindings();
    rebind(bindings, RESET_BINDING, 'KeyX');

    const handed = aircraftBindings(bindings);
    assert.deepEqual(Object.keys(handed), ['keymap', 'resetKeys', 'levelOffKeys']);
    assert.deepEqual(handed.resetKeys, ['KeyX']);
    assert.deepEqual(handed.levelOffKeys, [...LEVEL_OFF_KEYS]);
    assert.deepEqual(handed.keymap, keymapFor(bindings));
});

test('a map from somewhere else is read binding by binding', () => {
    const read = resolveBindings({ pitchUp: ['KeyI'], nothingOfTheSort: ['KeyZ'] });

    assert.deepEqual(read.pitchUp, ['KeyI'], 'what it named is kept');
    assert.deepEqual(read.pitchDown, [...DEFAULT_BINDINGS.pitchDown],
        'and what it did not name keeps the key the game put it on');
    assert.equal('nothingOfTheSort' in read, false, 'a binding this version has no row for is not one');

    assert.deepEqual(resolveBindings({ pitchUp: 'KeyI' }).pitchUp, [...DEFAULT_BINDINGS.pitchUp],
        'a value that is not a list of codes is not a binding');
    assert.deepEqual(resolveBindings({ pitchUp: ['', null, 'KeyI'] }).pitchUp, ['KeyI'],
        'and the codes inside one are read on their own as well');
    assert.deepEqual(resolveBindings(), defaultBindings());
});

/**
 * One key on two controls is the state the panel refuses, and a stored map is
 * not a better reason to allow it than a key press is. The first binding to
 * name the key keeps it; a binding emptied that way is given back whichever of
 * its own default keys are still free, so what comes out is flyable rather than
 * a map with a hole in it.
 */
test('a stored map that put one key on two controls is read with one of them keeping it', () => {
    const read = resolveBindings({ pitchUp: ['KeyW'], pitchDown: ['KeyW'] });

    assert.deepEqual(read.pitchUp, ['KeyW']);
    assert.deepEqual(read.pitchDown, [...DEFAULT_BINDINGS.pitchDown],
        'the binding that lost the key falls back on the keys it shipped with');

    const codes = BINDING_NAMES.flatMap(name => read[name]);
    assert.equal(new Set(codes).size, codes.length, 'and nothing comes out on two bindings');

    const emptied = resolveBindings({ pitchUp: ['KeyS', 'ArrowDown'], pitchDown: [] });
    assert.deepEqual(emptied.pitchUp, ['KeyS', 'ArrowDown']);
    assert.deepEqual(emptied.pitchDown, [], 'with no free default left, the row is left empty to be rebound');
});

test('a stored reset on no key is read as the pilot leaving it there', () => {
    assert.deepEqual(resolveBindings({ [RESET_BINDING]: [] })[RESET_BINDING], []);
    assert.deepEqual(resolveBindings({ pitchUp: [] }).pitchUp, [...DEFAULT_BINDINGS.pitchUp],
        'while a surface emptied by a stored map is given its own keys back');
});

test('a map is remembered for the next session', () => {
    const storage = fakeStorage();
    const bindings = defaultBindings();
    rebind(bindings, 'pitchUp', 'KeyI');
    clearBinding(bindings, RESET_BINDING);

    assert.equal(writeKeyBindings(storage, bindings), true);
    assert.ok(KEY_BINDINGS_STORAGE_KEY.startsWith('pilot-matter.'));

    const read = readKeyBindings(storage);
    assert.deepEqual(read.pitchUp, ['KeyI']);
    assert.deepEqual(read[RESET_BINDING], []);
});

test('a storage with nothing in it, one that throws, or one that lies reads as the defaults', () => {
    assert.deepEqual(readKeyBindings(null), defaultBindings());
    assert.deepEqual(readKeyBindings(fakeStorage()), defaultBindings());
    assert.deepEqual(
        readKeyBindings(fakeStorage({ [KEY_BINDINGS_STORAGE_KEY]: 'not json' })), defaultBindings());
    assert.deepEqual(
        readKeyBindings(fakeStorage({ [KEY_BINDINGS_STORAGE_KEY]: '"a string"' })), defaultBindings());
    assert.deepEqual(readKeyBindings({ getItem() { throw new Error('denied'); } }), defaultBindings());
});

test('a storage that refuses the write costs the map its memory and nothing else', () => {
    const bindings = defaultBindings();
    assert.equal(writeKeyBindings(null, bindings), false);
    assert.equal(writeKeyBindings({ setItem() { throw new Error('full'); } }, bindings), false);
    assert.deepEqual(bindings, defaultBindings(), 'and the flight goes on with the map it had');
});
