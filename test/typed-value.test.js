import test from 'node:test';
import assert from 'node:assert/strict';
import {
    TYPED_COMMIT_KEYS, TYPED_CANCEL_KEYS, TYPED_ERASE_KEYS, TYPED_MAX, TYPED_CARET,
    typedCharacter, startsTypedValue, extendTypedValue, parseTypedValue,
    typedValueLabel, readTypedKey
} from '../js/typed-value.js';

// --- Which key types what --------------------------------------------------

/**
 * Read off the code rather than off `event.key`, the way every other key in this
 * game is read: a layout that puts the digits somewhere else still reports
 * `Digit4` for the key with 4 on it.
 */
test('a digit is read off the key that carries it, on either row of them', () => {
    for (let digit = 0; digit <= 9; digit += 1) {
        assert.equal(typedCharacter(`Digit${digit}`), String(digit));
        assert.equal(typedCharacter(`Numpad${digit}`), String(digit),
            'the numpad is the same keys again for a pilot who reaches for it');
    }
});

test('a sign and a point are the other two characters a figure is made of', () => {
    assert.equal(typedCharacter('Minus'), '-');
    assert.equal(typedCharacter('NumpadSubtract'), '-');
    assert.equal(typedCharacter('Period'), '.');
    assert.equal(typedCharacter('NumpadDecimal'), '.');
});

test('every other key types nothing at all', () => {
    for (const code of ['KeyA', 'KeyW', 'Enter', 'Escape', 'Space', 'ArrowLeft', 'F1', '']) {
        assert.equal(typedCharacter(code), null, `${code} is not part of a figure`);
    }
    assert.equal(typedCharacter(null), null);
    assert.equal(typedCharacter(5), null, 'a code is a string, and anything else is not a key');
});

/**
 * A decimal point does not start a pilot typing. It is a legal character inside
 * a figure and a plausible stray press on a panel being read rather than set,
 * and a row that went into typing on it would answer the next press as a digit
 * instead of as whatever the pilot aimed it at.
 */
test('a digit or a sign starts a figure, and a point does not', () => {
    assert.equal(startsTypedValue('Digit8'), true);
    assert.equal(startsTypedValue('Numpad0'), true);
    assert.equal(startsTypedValue('Minus'), true, 'a climb can be a descent, so the sign starts one');
    assert.equal(startsTypedValue('Period'), false);
    assert.equal(startsTypedValue('NumpadDecimal'), false);
    assert.equal(startsTypedValue('KeyA'), false);
});

// --- How the characters accumulate -----------------------------------------

test('a figure grows by one character at a time', () => {
    assert.equal(extendTypedValue('', '8'), '8');
    assert.equal(extendTypedValue('8', '0'), '80');
    assert.equal(extendTypedValue('13', '9'), '139');
});

/**
 * A figure has one sign and one point, both in one place. Refusing the press
 * leaves the text as it was, which is what keeps the reading on the row
 * something that could still be committed.
 */
test('a sign belongs at the front and a point belongs once', () => {
    assert.equal(extendTypedValue('', '-'), '-');
    assert.equal(extendTypedValue('-', '5'), '-5');
    assert.equal(extendTypedValue('5', '-'), null, 'a sign in the middle of a figure is not one');
    assert.equal(extendTypedValue('-5', '-'), null);

    assert.equal(extendTypedValue('0', '.'), '0.');
    assert.equal(extendTypedValue('0.', '5'), '0.5');
    assert.equal(extendTypedValue('0.5', '.'), null, 'and two points is not a number at all');
    assert.equal(extendTypedValue('', '.'), '.', 'though a point may open one that is extended');
});

test('a figure stops growing somewhere, so a held key cannot fill the row', () => {
    const long = '1'.repeat(TYPED_MAX);
    assert.equal(long.length, TYPED_MAX);
    assert.equal(extendTypedValue(long, '1'), null);
    assert.equal(extendTypedValue(long.slice(1), '1'), long);

    // The widest figures either panel offers have to fit, or the figure cannot
    // be typed at all and the bound is the thing refusing it.
    for (const figure of ['-2000', '8000', '0.015', '200']) {
        assert.ok(figure.length <= TYPED_MAX, `${figure} should fit in a row`);
    }
});

test('a key that types nothing extends nothing', () => {
    assert.equal(extendTypedValue('8', null), null);
    assert.equal(extendTypedValue('8', typedCharacter('KeyA')), null);
});

// --- What the text comes to --------------------------------------------------

test('a figure comes to the number it reads as', () => {
    assert.equal(parseTypedValue('80'), 80);
    assert.equal(parseTypedValue('1390'), 1390);
    assert.equal(parseTypedValue('-500'), -500);
    assert.equal(parseTypedValue('0.5'), 0.5);
    assert.equal(parseTypedValue('0'), 0, 'zero is a figure, and is not nothing');
    assert.equal(parseTypedValue('000'), 0, 'a heading is padded on screen, so it is typed padded too');
});

/**
 * A sign or a point on its own is a figure the pilot is partway through rather
 * than a figure, so it comes to null and is refused if committed.
 */
test('a figure nobody has finished is not a number yet', () => {
    for (const text of ['', '-', '.', '-.', null, undefined]) {
        assert.equal(parseTypedValue(text), null, `"${text}" holds no digits`);
    }
});

test('a number is what is read, and nothing else is', () => {
    for (const text of ['8e3', '0x10', '1 0', '--1', '1.2.3', 'Infinity']) {
        assert.equal(parseTypedValue(text), null, `"${text}" is not a figure typed at a row`);
    }
});

// --- How the row reads while it is being typed into ------------------------

test('a row being typed into reads what has been typed, and says it is taking more', () => {
    assert.equal(typedValueLabel('13'), `13${TYPED_CARET}`);
    assert.equal(typedValueLabel(''), TYPED_CARET,
        'a pilot who has erased back to nothing is still typing, and the row should say so');
    assert.equal(typedValueLabel(), TYPED_CARET);
});

// --- One key, read against what is already there ---------------------------

test('a digit is read onto the end of the figure', () => {
    assert.deepEqual(readTypedKey('13', 'Digit9'), { action: 'typed', text: '139', value: null });
    assert.deepEqual(readTypedKey('', 'Digit0'), { action: 'typed', text: '0', value: null });
});

test('erasing takes one character off, down to nothing', () => {
    for (const code of TYPED_ERASE_KEYS) {
        assert.deepEqual(readTypedKey('139', code), { action: 'erased', text: '13', value: null });
        assert.deepEqual(readTypedKey('1', code), { action: 'erased', text: '', value: null });
        assert.deepEqual(readTypedKey('', code), { action: 'erased', text: '', value: null },
            'and erasing nothing is still erasing, rather than falling through to the panel');
    }
});

test('committing hands over the number, or nothing where there is not one yet', () => {
    for (const code of TYPED_COMMIT_KEYS) {
        assert.deepEqual(readTypedKey('80', code), { action: 'commit', text: '80', value: 80 });
        assert.deepEqual(readTypedKey('-', code), { action: 'commit', text: '-', value: null });
    }
});

test('cancelling says so and keeps what was typed out of it', () => {
    for (const code of TYPED_CANCEL_KEYS) {
        assert.deepEqual(readTypedKey('80', code), { action: 'cancel', text: '80', value: null });
    }
});

/**
 * A key the figure has no use for comes back null, and the caller then reads it
 * however it would have otherwise. A panel that ate every key while a row was
 * being typed into would be a panel a pilot could not walk away from.
 */
test('a key the figure has no use for is handed back to the panel', () => {
    for (const code of ['KeyW', 'KeyS', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'Space', 'KeyO']) {
        assert.equal(readTypedKey('13', code), null, `${code} belongs to the panel, not to the figure`);
    }
});

test('a character that cannot go where it was pressed is handed back too', () => {
    assert.equal(readTypedKey('13', 'Minus'), null, 'a sign in the middle of a figure is not one');
    assert.equal(readTypedKey('0.5', 'Period'), null);
    assert.equal(readTypedKey('1'.repeat(TYPED_MAX), 'Digit1'), null);
});

test('the text defaults to nothing, so a first press is read against an empty figure', () => {
    assert.deepEqual(readTypedKey(undefined, 'Digit7'), { action: 'typed', text: '7', value: null });
});
