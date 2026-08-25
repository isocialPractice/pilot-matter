/**
 * Configuration - the simulator's start state as one object rather than as
 * constants scattered through the flight code. Pure module with no DOM or
 * Three.js dependency, so a configured start can be read, checked, and unit
 * tested in Node.
 *
 * The start is written the way a pilot reads it, in knots, feet, feet per
 * minute, degrees on the card, and percent of lever travel. Turning those into
 * the world units the flight model works in is `js/flight-state.js`, which is
 * the only place that conversion happens.
 *
 * Every field is declared twice over: once as the value it opens on, in
 * `DEFAULT_CONFIG`, and once as what it is allowed to be, in `START_FIELDS`.
 * The second is what lets the settings panel offer the field without knowing
 * anything about flight: a field carries its own range, its own step, and its
 * own units, so a new one is a line here rather than a widget there.
 *
 * The rest of the simulator's defaults are declared beside the code that reads
 * them - the world's size and its elements by the element registry, the flight
 * options by the settings panel - because those are not the start state and
 * moving them here would only put one more file between a value and its use.
 */

import { CAMERA_MODES } from './camera-math.js';

/**
 * The two conditions a flight can open in. Airborne is the one the simulator
 * has always started in, and the one every other start field is written for. A
 * runway takeoff throws most of those fields away: an aircraft held on the
 * ground has no airspeed, no altitude, and no climb of its own to set.
 */
export const START_FLYING  = 'flying';
export const START_TAKEOFF = 'takeoff';

export const START_MODES = Object.freeze([
    {
        value: START_FLYING,
        label: 'START OFF FLYING',
        note: 'already up, in the climb set below'
    },
    {
        value: START_TAKEOFF,
        label: 'RUNWAY TAKEOFF',
        note: 'stopped on the runway, throttle at idle'
    }
]);

// The condition a takeoff is held in until the pilot moves the lever: stopped
// at the threshold, engine idling, nose level, on the strip's own bearing.
export const TAKEOFF_THROTTLE_PERCENT = 0;

/**
 * A field that is one of two conditions rather than a value, and one that is
 * simply on or off. Both are chosen rather than stepped, which is what the
 * settings panel reads them off to know how to draw them.
 */
export const CHOICE_FIELD = 'choice';
export const TOGGLE_FIELD = 'toggle';

/**
 * The condition every flight opens in, and the one Reset Flight puts it back
 * into. Frozen, because it is the floor every other start is measured from: a
 * caller changing a start changes its own copy, not this.
 */
export const DEFAULT_CONFIG = Object.freeze({
    start: Object.freeze({
        startMode:        START_FLYING,
        runway:           true,
        airspeedKnots:    80,
        altitudeFeet:     1390,
        verticalSpeedFpm: 1260,
        headingDegrees:   0,
        throttlePercent:  20,
        cameraMode:       CAMERA_MODES[0]
    })
});

/**
 * The start state as fields that can be offered and set, each carrying what it
 * may hold.
 *
 * A field is either stepped through a range - `min`, `max`, and the `step` a
 * key press moves it by - or chosen from a list of `values`, which is the same
 * pair of shapes the settings panel's other options come in.
 *
 * `unit` is written after the number exactly as given, its own spacing
 * included, so a reading is punctuated where it should be rather than where a
 * rule about units would put it. `pad` is the width a reading is zero-filled
 * to, the way a compass card is read, and `signed` marks a reading that shows
 * its `+` so a climb cannot be misread as a descent.
 */
export const START_FIELDS = Object.freeze([
    {
        id: 'startMode',
        label: 'START STATE',
        note: 'the condition a flight opens in',
        kind: CHOICE_FIELD,
        default: DEFAULT_CONFIG.start.startMode,
        values: START_MODES
    },
    {
        id: 'runway',
        label: 'RUNWAY',
        note: 'whether the generated world has a strip to land on',
        kind: TOGGLE_FIELD,
        default: DEFAULT_CONFIG.start.runway,
        values: [
            { value: true,  label: 'ON'  },
            { value: false, label: 'OFF' }
        ]
    },
    {
        id: 'airspeedKnots',
        label: 'START AIRSPEED',
        note: 'the airspeed the flight opens at',
        default: DEFAULT_CONFIG.start.airspeedKnots,
        min: 0, max: 200, step: 5,
        unit: ' KTS'
    },
    {
        id: 'altitudeFeet',
        label: 'START ALTITUDE',
        note: 'the height above sea level the flight opens at',
        default: DEFAULT_CONFIG.start.altitudeFeet,
        min: 0, max: 8000, step: 10,
        unit: ' FT'
    },
    {
        id: 'verticalSpeedFpm',
        label: 'START CLIMB',
        note: 'the climb or descent the flight opens in',
        default: DEFAULT_CONFIG.start.verticalSpeedFpm,
        min: -2000, max: 3000, step: 20,
        unit: ' FT/MIN',
        signed: true
    },
    {
        id: 'headingDegrees',
        label: 'START HEADING',
        note: 'the bearing the nose opens on',
        default: DEFAULT_CONFIG.start.headingDegrees,
        min: 0, max: 355, step: 5,
        unit: ' DEG',
        pad: 3
    },
    {
        id: 'throttlePercent',
        label: 'START THROTTLE',
        note: 'the lever setting the flight opens with',
        default: DEFAULT_CONFIG.start.throttlePercent,
        min: 0, max: 100, step: 5,
        unit: '%'
    },
    {
        id: 'cameraMode',
        label: 'START CAMERA',
        note: 'the view the flight opens in',
        default: DEFAULT_CONFIG.start.cameraMode,
        values: CAMERA_MODES.map(mode => ({ value: mode, label: mode }))
    }
]);

export const START_FIELD_IDS = Object.freeze(START_FIELDS.map(field => field.id));

/** The field answering to an id, or null when nothing does. */
export function startField(id) {
    return START_FIELDS.find(field => field.id === id) ?? null;
}

/**
 * True when a field can be left holding this value: one of its listed values,
 * or a number inside its range and on one of its steps. A reading between two
 * steps is refused rather than snapped, because a value this module never
 * offered is a value from somewhere else.
 */
export function isStartValue(id, value) {
    const field = startField(id);
    if (!field) return false;
    if (field.values) return field.values.some(entry => entry.value === value);

    return Number.isFinite(value)
        && value >= field.min
        && value <= field.max
        && Number.isInteger((value - field.min) / field.step);
}

/**
 * The nearest value a field can actually hold to the one asked for: clamped
 * into its range and put on one of its steps.
 *
 * `isStartValue` refuses a reading between two steps rather than snapping it,
 * because a value from nowhere is a value from nowhere. This is for the other
 * case: a caller working a reading out - a game mode placing a flight, a host
 * converting from its own units - which wants the nearest setting the field
 * offers rather than to be told the arithmetic came out between two of them.
 */
export function snapStartValue(id, value) {
    const field = startField(id);
    if (!field) return value;
    if (field.values) return isStartValue(id, value) ? value : field.default;

    const number = Number(value);
    if (!Number.isFinite(number)) return field.default;

    const stepped = field.min + Math.round((number - field.min) / field.step) * field.step;
    return Math.min(Math.max(stepped, field.min), field.max);
}

/** A fresh copy of the start every flight opens in. */
export function startDefaults() {
    return { ...DEFAULT_CONFIG.start };
}

/** True for a start that opens stopped on a runway rather than already flying. */
export function startsOnRunway(start = {}) {
    return start.startMode === START_TAKEOFF;
}

/**
 * True while the runway toggle is held on by the start that needs one. A
 * takeoff cannot be rolled out of a world with no strip in it, so the choice is
 * the start state's rather than the pilot's for as long as that start is set.
 */
export function runwayForced(start = {}) {
    return startsOnRunway(start);
}

/** Whether the world a start asks for is generated with a strip in it. */
export function runwayWanted(start = {}) {
    return runwayForced(start) || start.runway === true;
}

/**
 * A start state from values that came from somewhere else - a stored choice, a
 * host's options, a panel. Every field is checked on its own and falls back to
 * its default alone, so one value this version cannot read does not cost the
 * others theirs.
 *
 * The one field that is not read on its own is the runway, which a takeoff
 * turns on whatever it was stored as: a start that asked to roll out of a world
 * with no strip in it is not a start anything could honour.
 */
export function resolveStart(values = {}) {
    const start = startDefaults();
    for (const field of START_FIELDS) {
        if (isStartValue(field.id, values[field.id])) start[field.id] = values[field.id];
    }
    if (runwayForced(start)) start.runway = true;
    return start;
}
