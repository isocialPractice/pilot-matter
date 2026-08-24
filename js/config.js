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
 * The condition every flight opens in, and the one Reset Flight puts it back
 * into. Frozen, because it is the floor every other start is measured from: a
 * caller changing a start changes its own copy, not this.
 */
export const DEFAULT_CONFIG = Object.freeze({
    start: Object.freeze({
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

/** A fresh copy of the start every flight opens in. */
export function startDefaults() {
    return { ...DEFAULT_CONFIG.start };
}

/**
 * A start state from values that came from somewhere else - a stored choice, a
 * host's options, a panel. Every field is checked on its own and falls back to
 * its default alone, so one value this version cannot read does not cost the
 * others theirs.
 */
export function resolveStart(values = {}) {
    const start = startDefaults();
    for (const field of START_FIELDS) {
        if (isStartValue(field.id, values[field.id])) start[field.id] = values[field.id];
    }
    return start;
}
