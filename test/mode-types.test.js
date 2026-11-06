import test from 'node:test';
import assert from 'node:assert/strict';
import {
    MODE_VERBS, MODE_KINDS, mode, modeType, parseModeType, isModeType, modeIs
} from '../js/mode-types.js';

test('a mode type is a verb, a kind and a subject, written as the builder\'s plan writes it', () => {
    assert.deepEqual(MODE_VERBS, ['insert', 'load', 'save']);
    assert.deepEqual(MODE_KINDS, ['asset', 'config', 'data']);
    assert.equal(modeType(mode('insert', 'asset', 'runway')), 'Insert asset<runway>');
    assert.equal(modeType(mode('insert', 'config', 'flight:start-point')), 'Insert config<flight:start-point>');
    assert.equal(modeType(mode('load', 'data', 'file')), 'Load data<file>');
    assert.equal(modeType(mode('save', 'data', 'file')), 'Save data<file>');
});

test('a mode type written is read back as the type it was written from', () => {
    for (const written of [
        'Insert asset<runway>', 'Insert asset<flight:plane>', 'Insert config<flight:start-point>',
        'Insert asset<city>', 'Load data<file>', 'Save data<file>', 'Load data<asset>'
    ]) {
        const type = parseModeType(written);
        assert.ok(isModeType(type), written);
        assert.equal(modeType(type), written, 'and written again the same');
    }
    assert.deepEqual(parseModeType('  Insert asset<runway>  '), { verb: 'insert', kind: 'asset', subject: 'runway' }, 'the space around it is no part of it');
});

test('anything that is not a mode type reads as none, and writes as nothing', () => {
    for (const text of [
        '', null, undefined, 'insert asset<runway>', 'INSERT asset<runway>', 'Insert Asset<runway>',
        'Insert asset<Runway>', 'Insert asset<>', 'Insert asset runway', 'Insert  asset<runway>',
        'Remove asset<runway>', 'Insert model<runway>', 'Insert asset<run way>', 'Insert asset<flight:>',
        'Insert asset<flight:plane:jet>', 'Insert asset<runway>>', 'Model Type: Save data<file>'
    ]) {
        assert.equal(parseModeType(text), null, String(text));
    }
    for (const type of [null, {}, { verb: 'insert', kind: 'asset' }, { verb: 'drop', kind: 'asset', subject: 'x' },
        { verb: 'insert', kind: 'asset', subject: '9lives' }]) {
        assert.equal(modeType(type), '', JSON.stringify(type));
        assert.equal(isModeType(type), false);
    }
});

test('a declaration that is no mode type is refused when it is made, and one that is is frozen', () => {
    assert.throws(() => mode('insert', 'asset', 'Runway'), /Not a mode type/);
    assert.throws(() => mode('place', 'asset', 'runway'), /Not a mode type/);
    assert.throws(() => mode('insert', 'thing', 'runway'), /Not a mode type/);
    assert.ok(Object.isFrozen(mode('insert', 'asset', 'runway')));
});

test('a mode type is asked about by its verb and kind, and its subject where one is asked', () => {
    const runway = mode('insert', 'asset', 'runway');
    assert.equal(modeIs(runway, 'insert', 'asset'), true);
    assert.equal(modeIs(runway, 'insert', 'asset', 'runway'), true);
    assert.equal(modeIs(runway, 'insert', 'asset', 'city'), false);
    assert.equal(modeIs(runway, 'insert', 'config'), false);
    assert.equal(modeIs(runway, 'load', 'asset'), false);
    assert.equal(modeIs(null, 'insert', 'asset'), false);
});
