/**
 * The day-night cycle - what colour the sky is, how much sun there is, and
 * where it is coming from, as a function of the time of day.
 *
 * A world lit one way all flight is a world with one hour in it. This turns that
 * hour into a day: the light warms and cools, the sky and the fog it fades to go
 * with it rather than after it, and the sun walks across the sky instead of
 * hanging in one corner of it.
 *
 * The whole cycle is written as a handful of moments and read as the blend
 * between the two either side of the one being asked for, which is what keeps
 * a sunrise a gradual thing rather than a switch thrown at a threshold. Noon is
 * the light the simulator has always been drawn in, so a flight at midday is
 * lit exactly as it was before there was a cycle at all.
 *
 * Pure module with no DOM or Three.js dependency: the phase, the colours, and
 * the sun's place are all arithmetic, so they can be unit tested in Node and
 * driven by any renderer.
 */

/**
 * How long a full day takes, in seconds. Long enough that a flight is not flown
 * through three sunsets, short enough that a pilot who takes off in the dark
 * does not stay there.
 */
export const CYCLE_LENGTH = 900;

/** The phase a flight opens at: mid-morning, with the day ahead of it. */
export const CYCLE_START = 0.36;

/**
 * The day as the moments it is read between. Phase runs 0 to 1 over a whole
 * day, from midnight through dawn at a quarter, noon at a half, and dusk at
 * three quarters.
 *
 * `sky` is what the world fades to and what the fog is tinted with, `sun` the
 * directional light everything is modelled by, and `ambient` the fill that
 * keeps the unlit side of a hill from being a silhouette. `daylight` is how much
 * day there is at all, which is what anything else keyed to the sun reads:
 * water only glints while there is something to glint with.
 */
export const DAY_STOPS = Object.freeze([
    {
        at: 0,    label: 'NIGHT',
        sky:     [0.020, 0.035, 0.086],
        sun:     { color: [0.42, 0.52, 0.78], intensity: 0.12 },
        ambient: { color: [0.22, 0.30, 0.50], intensity: 0.34 },
        daylight: 0.05
    },
    {
        at: 0.21, label: 'FIRST LIGHT',
        sky:     [0.28, 0.26, 0.40],
        sun:     { color: [0.85, 0.55, 0.52], intensity: 0.35 },
        ambient: { color: [0.36, 0.36, 0.52], intensity: 0.44 },
        daylight: 0.25
    },
    {
        at: 0.27, label: 'DAWN',
        sky:     [0.72, 0.48, 0.42],
        sun:     { color: [1, 0.62, 0.40], intensity: 0.80 },
        ambient: { color: [0.50, 0.46, 0.54], intensity: 0.56 },
        daylight: 0.55
    },
    {
        at: 0.36, label: 'MORNING',
        sky:     [0.54, 0.74, 0.90],
        sun:     { color: [1, 0.90, 0.76], intensity: 1.10 },
        ambient: { color: [0.54, 0.66, 0.80], intensity: 0.66 },
        daylight: 0.9
    },
    {
        // Midday is the light the world was drawn in before it had a day.
        at: 0.5,  label: 'NOON',
        sky:     [0.529, 0.808, 0.922],
        sun:     { color: [1, 0.957, 0.878], intensity: 1.3 },
        ambient: { color: [0.541, 0.675, 0.812], intensity: 0.7 },
        daylight: 1
    },
    {
        at: 0.66, label: 'AFTERNOON',
        sky:     [0.58, 0.74, 0.88],
        sun:     { color: [1, 0.90, 0.74], intensity: 1.12 },
        ambient: { color: [0.55, 0.65, 0.78], intensity: 0.66 },
        daylight: 0.9
    },
    {
        at: 0.75, label: 'DUSK',
        sky:     [0.86, 0.50, 0.30],
        sun:     { color: [1, 0.56, 0.30], intensity: 0.72 },
        ambient: { color: [0.52, 0.44, 0.48], intensity: 0.54 },
        daylight: 0.5
    },
    {
        at: 0.83, label: 'NIGHTFALL',
        sky:     [0.16, 0.16, 0.30],
        sun:     { color: [0.62, 0.52, 0.70], intensity: 0.28 },
        ambient: { color: [0.30, 0.32, 0.50], intensity: 0.42 },
        daylight: 0.2
    }
]);

/**
 * How far the sun is thrown from the middle of the world, and how far off the
 * horizon it is held once it has set. A light that goes under the ground would
 * leave the world lit by the ambient fill alone, which reads as fog rather than
 * as night; kept just above it, the ground still has a shape after dark and it
 * is the colour and the strength of the light that say what time it is.
 */
export const SUN_DISTANCE = 1200;
export const NIGHT_ELEVATION = 0.14;

/** A cycle, started at whatever time of day it should open on. */
export function createDayNight({ length = CYCLE_LENGTH, phase = CYCLE_START } = {}) {
    return {
        length: Number.isFinite(length) && length > 0 ? length : CYCLE_LENGTH,
        phase: wrapPhase(phase)
    };
}

/**
 * Moves the day on by a step of the flight. A frozen flight - paused, or held
 * behind the title screen - is handed no time at all and the day waits with it.
 *
 * Returns the phase now in force.
 */
export function advanceDayNight(state, dt = 0) {
    const step = Number(dt);
    if (Number.isFinite(step) && step !== 0) {
        state.phase = wrapPhase(state.phase + step / state.length);
    }
    return state.phase;
}

/** A phase brought back into the day it belongs to, however far outside it was. */
export function wrapPhase(phase) {
    const value = Number(phase);
    if (!Number.isFinite(value)) return 0;
    return value - Math.floor(value);
}

/**
 * The light at a time of day: the sky, the sun, the fill, and how much day it
 * amounts to. Read as the blend between the moments either side of it, with the
 * last moment of the day running back round into the first, so midnight is one
 * place rather than a seam.
 */
export function daylightAt(phase) {
    const at = wrapPhase(phase);
    const [from, to, t] = straddle(at);

    return {
        phase: at,
        label: t < 0.5 ? from.label : to.label,
        sky:     mixColor(from.sky, to.sky, t),
        sun: {
            color:     mixColor(from.sun.color, to.sun.color, t),
            intensity: mix(from.sun.intensity, to.sun.intensity, t)
        },
        ambient: {
            color:     mixColor(from.ambient.color, to.ambient.color, t),
            intensity: mix(from.ambient.intensity, to.ambient.intensity, t)
        },
        daylight: mix(from.daylight, to.daylight, t)
    };
}

/**
 * Where the sun is at a time of day: up in the east in the morning, overhead at
 * noon, and down in the west by evening. Held a little over the horizon after
 * it sets, so the ground keeps its shape through the night.
 */
export function sunPositionAt(phase, distance = SUN_DISTANCE) {
    // A quarter past midnight is sunrise, which is where the arc starts.
    const angle = (wrapPhase(phase) - 0.25) * Math.PI * 2;

    return {
        x: Math.cos(angle) * distance,
        y: Math.max(Math.sin(angle), NIGHT_ELEVATION) * distance,
        // The arc is tilted off the east-west line rather than run down it, so
        // a slope facing the pilot is never lit dead flat.
        z: distance * 0.33
    };
}

/** The time of day as a clock reading, for anything that shows it. */
export function clockAt(phase) {
    const minutes = Math.round(wrapPhase(phase) * 24 * 60) % (24 * 60);
    const hour = Math.floor(minutes / 60);
    return `${String(hour).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** The two moments a phase falls between, and how far it is between them. */
function straddle(at) {
    const last = DAY_STOPS[DAY_STOPS.length - 1];

    // Before the first moment of the day is after the last one of the day
    // before it, which is the one place the blend runs across midnight.
    if (at < DAY_STOPS[0].at) {
        const span = 1 - last.at + DAY_STOPS[0].at;
        return [last, DAY_STOPS[0], span <= 0 ? 0 : (1 - last.at + at) / span];
    }

    for (let i = DAY_STOPS.length - 1; i >= 0; i--) {
        if (at < DAY_STOPS[i].at) continue;

        const from = DAY_STOPS[i];
        const to   = DAY_STOPS[i + 1] ?? DAY_STOPS[0];
        const span = (DAY_STOPS[i + 1]?.at ?? 1 + DAY_STOPS[0].at) - from.at;
        return [from, to, span <= 0 ? 0 : (at - from.at) / span];
    }

    return [DAY_STOPS[0], DAY_STOPS[0], 0];
}

function mix(from, to, t) {
    return from + (to - from) * t;
}

function mixColor(from, to, t) {
    return [mix(from[0], to[0], t), mix(from[1], to[1], t), mix(from[2], to[2], t)];
}
