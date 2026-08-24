import test from 'node:test';
import assert from 'node:assert/strict';
import {
    DEFAULT_CONFIG,
    START_FIELDS,
    START_FIELD_IDS,
    startField,
    isStartValue,
    startDefaults,
    resolveStart
} from '../js/config.js';
import { CAMERA_MODES } from '../js/camera-math.js';

const ranged = () => START_FIELDS.filter(field => !field.values);

test('the configured start is the one the simulator has always opened on', () => {
    assert.deepEqual(DEFAULT_CONFIG.start, {
        airspeedKnots: 80,
        altitudeFeet: 1390,
        verticalSpeedFpm: 1260,
        headingDegrees: 0,
        throttlePercent: 20,
        cameraMode: 'CHASE'
    });
});

// The defaults are the floor every other start is measured from, so nothing
// that reads one should be able to write to it by accident.
test('the defaults cannot be edited by whatever is holding them', () => {
    assert.throws(() => { DEFAULT_CONFIG.start.airspeedKnots = 200; }, TypeError);
    assert.throws(() => { DEFAULT_CONFIG.start = {}; }, TypeError);
    assert.equal(DEFAULT_CONFIG.start.airspeedKnots, 80);
});

test('every field of the start is one the start declares a default for', () => {
    assert.deepEqual(START_FIELD_IDS, Object.keys(DEFAULT_CONFIG.start));
    for (const field of START_FIELDS) {
        assert.equal(field.default, DEFAULT_CONFIG.start[field.id],
            `${field.id} should open on the same value in both places`);
        assert.ok(field.label.length > 0, `${field.id} needs a label to be read by`);
        assert.ok(field.note.length > 0, `${field.id} needs a note saying what it sets`);
    }
});

test('a field is either stepped along a range or chosen from a list, never both', () => {
    for (const field of START_FIELDS) {
        if (field.values) {
            assert.equal(field.min, undefined, `${field.id} is a list, so it has no range`);
            assert.ok(field.values.length > 1, `${field.id} needs settings to choose between`);
            continue;
        }
        assert.ok(Number.isFinite(field.min) && Number.isFinite(field.max),
            `${field.id} needs both ends of its range`);
        assert.ok(field.max > field.min, `${field.id} needs a range with width to it`);
        assert.ok(field.step > 0, `${field.id} needs a step to move by`);
    }
});

// Every step is walked to from the low end, so a step that did not divide the
// range would leave settings the field could never actually be left on.
test('every value a range field can hold is one of its own steps', () => {
    for (const field of ranged()) {
        assert.ok(Number.isInteger((field.max - field.min) / field.step),
            `${field.id} has a range its own step cannot reach the end of`);
        assert.ok(isStartValue(field.id, field.default),
            `${field.id} opens on a value it is not allowed to hold`);
    }
});

test('the camera a flight opens in is one the C key cycles through', () => {
    const camera = startField('cameraMode');
    assert.deepEqual(camera.values.map(entry => entry.value), CAMERA_MODES);
    assert.ok(CAMERA_MODES.includes(DEFAULT_CONFIG.start.cameraMode));
});

test('a field answers to its own id and to nothing else', () => {
    assert.equal(startField('airspeedKnots').id, 'airspeedKnots');
    assert.equal(startField('a-field-from-another-version'), null);
    assert.equal(isStartValue('a-field-from-another-version', 1), false);
});

test('a value inside the range and on a step is one the field can hold', () => {
    assert.equal(isStartValue('airspeedKnots', 100), true);
    assert.equal(isStartValue('altitudeFeet', 0), true, 'the low end is a setting like any other');
    assert.equal(isStartValue('verticalSpeedFpm', -2000), true, 'so is a descent');
});

test('a value off the range, off a step, or not a number at all is refused', () => {
    assert.equal(isStartValue('airspeedKnots', 205), false, 'past the fast end');
    assert.equal(isStartValue('airspeedKnots', -5), false, 'past the slow end');
    assert.equal(isStartValue('airspeedKnots', 82), false, 'between two steps');
    assert.equal(isStartValue('airspeedKnots', '80'), false, 'a reading written as text');
    assert.equal(isStartValue('airspeedKnots', NaN), false);
    assert.equal(isStartValue('cameraMode', 'PERISCOPE'), false, 'a view there is no camera for');
});

test('a fresh copy of the defaults is fresh, so one start never poisons the next', () => {
    const first = startDefaults();
    first.airspeedKnots = 200;
    assert.equal(startDefaults().airspeedKnots, 80);
});

test('a start from somewhere else keeps what it can and defaults what it cannot', () => {
    const start = resolveStart({
        airspeedKnots: 120,
        altitudeFeet: 82,
        cameraMode: 'ORBIT',
        throttlePercent: 'wide open',
        somethingElseEntirely: 7
    });

    assert.equal(start.airspeedKnots, 120, 'a value it can read is kept');
    assert.equal(start.cameraMode, 'ORBIT');
    assert.equal(start.altitudeFeet, DEFAULT_CONFIG.start.altitudeFeet,
        'a height between two steps reads as the configured one');
    assert.equal(start.throttlePercent, DEFAULT_CONFIG.start.throttlePercent,
        'and one field it cannot read does not cost the others theirs');
    assert.equal(start.somethingElseEntirely, undefined, 'a start holds start fields and nothing else');
});

test('a start of nothing at all is the configured start', () => {
    assert.deepEqual(resolveStart(), startDefaults());
    assert.deepEqual(resolveStart({}), startDefaults());
});
