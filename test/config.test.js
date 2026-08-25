import test from 'node:test';
import assert from 'node:assert/strict';
import {
    DEFAULT_CONFIG,
    START_FIELDS,
    START_FIELD_IDS,
    START_MODES,
    START_FLYING,
    START_TAKEOFF,
    CHOICE_FIELD,
    TOGGLE_FIELD,
    TAKEOFF_THROTTLE_PERCENT,
    startField,
    isStartValue,
    snapStartValue,
    startDefaults,
    resolveStart,
    startsOnRunway,
    runwayForced,
    runwayWanted
} from '../js/config.js';
import { CAMERA_MODES } from '../js/camera-math.js';

const ranged = () => START_FIELDS.filter(field => !field.values);

test('the configured start is the one the simulator has always opened on', () => {
    assert.deepEqual(DEFAULT_CONFIG.start, {
        startMode: 'flying',
        runway: true,
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

// --- The condition a flight opens in ---------------------------------------

test('a flight opens in one of two conditions, and by default in the air', () => {
    assert.deepEqual(START_MODES.map(mode => mode.value), [START_FLYING, START_TAKEOFF]);
    assert.equal(DEFAULT_CONFIG.start.startMode, START_FLYING);

    for (const mode of START_MODES) {
        assert.ok(mode.label.length > 0, `${mode.value} needs a label to be chosen by`);
        assert.ok(mode.note.length > 0, 'and a line saying what it puts the aircraft in');
    }
});

test('the two conditions are told apart by asking, not by reading the field', () => {
    assert.equal(startsOnRunway({ startMode: START_TAKEOFF }), true);
    assert.equal(startsOnRunway({ startMode: START_FLYING }), false);
    assert.equal(startsOnRunway({}), false);
    assert.equal(startsOnRunway(), false);
});

test('a field that is chosen or toggled says which it is, and is not a range', () => {
    assert.equal(startField('startMode').kind, CHOICE_FIELD);
    assert.equal(startField('runway').kind, TOGGLE_FIELD);
    for (const id of ['startMode', 'runway']) {
        assert.equal(startField(id).min, undefined, `${id} is chosen rather than stepped`);
    }
    assert.equal(startField('airspeedKnots').kind, undefined, 'and a range says nothing about kind');
});

test('the runway toggle is on or off and nothing else', () => {
    assert.equal(isStartValue('runway', true), true);
    assert.equal(isStartValue('runway', false), true);
    assert.equal(isStartValue('runway', 'yes'), false);
    assert.equal(isStartValue('runway', 1), false, 'a box is checked or it is not');
    assert.equal(isStartValue('startMode', 'gliding'), false);
});

// A takeoff cannot be rolled out of a world with no strip in it, so the start
// that needs one owns the box for as long as it is set.
test('a runway takeoff turns the runway on and holds it there', () => {
    assert.equal(runwayForced({ startMode: START_TAKEOFF }), true);
    assert.equal(runwayForced({ startMode: START_FLYING }), false);

    const takeoff = resolveStart({ startMode: START_TAKEOFF, runway: false });
    assert.equal(takeoff.runway, true, 'a stored no is overruled by the start that needs a yes');

    const flying = resolveStart({ startMode: START_FLYING, runway: false });
    assert.equal(flying.runway, false, 'and the pilot has the box back the moment they start off flying');
});

test('whether the world gets a strip is one question with one answer', () => {
    assert.equal(runwayWanted({ startMode: START_FLYING, runway: true }), true);
    assert.equal(runwayWanted({ startMode: START_FLYING, runway: false }), false);
    assert.equal(runwayWanted({ startMode: START_TAKEOFF, runway: false }), true);
    assert.equal(runwayWanted({}), false);
});

test('a takeoff is held at idle, which is a setting the throttle can hold', () => {
    assert.equal(isStartValue('throttlePercent', TAKEOFF_THROTTLE_PERCENT), true);
});

// --- Snapping to a step ----------------------------------------------------

// isStartValue refuses a reading between two steps, because a value from
// nowhere is a value from nowhere. Snapping is for the other case: a reading
// worked out rather than chosen, which wants the nearest setting there is.
test('a worked-out reading is snapped to the nearest step the field offers', () => {
    assert.equal(snapStartValue('airspeedKnots', 82), 80);
    assert.equal(snapStartValue('airspeedKnots', 83), 85);
    assert.equal(snapStartValue('headingDegrees', 359), 355, 'the top of the card is the last step on it');
    assert.equal(snapStartValue('altitudeFeet', 1387), 1390);
    assert.equal(snapStartValue('verticalSpeedFpm', -7), 0);

    for (const id of ['airspeedKnots', 'headingDegrees', 'altitudeFeet', 'verticalSpeedFpm']) {
        for (const value of [-99999, 99999, 0.5, 123.456]) {
            assert.equal(isStartValue(id, snapStartValue(id, value)), true,
                `${id} snapped ${value} to something it cannot hold`);
        }
    }
});

test('a reading with no field, no number, or no place on a list is left or defaulted', () => {
    assert.equal(snapStartValue('a-field-from-another-version', 7), 7, 'nothing to snap it to');
    assert.equal(snapStartValue('airspeedKnots', 'quite fast'), startField('airspeedKnots').default);
    assert.equal(snapStartValue('cameraMode', 'ORBIT'), 'ORBIT', 'a listed value is already on a step');
    assert.equal(snapStartValue('cameraMode', 'PERISCOPE'), startField('cameraMode').default);
});
