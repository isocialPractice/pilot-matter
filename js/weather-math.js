/**
 * Weather arithmetic - how much of each effect a condition asks for, where a
 * cloud and a raindrop are next frame, and when the next strike lands.
 *
 * Lifted from the `local-weather` branch, whose own comments say the constants
 * at the top of its weather module are layout rather than palette. That is
 * exactly the half worth having: the deck's ceiling, the rain box and its
 * shear, and the strike timing are a look somebody arrived at, while the
 * branch's palette was resolved once at import from a hand-edited module
 * constant and has no counterpart here. So the numbers travel and the knob
 * does not - the condition is asked for through the settings panel, and the
 * hour of the day comes from the cycle in `js/day-night.js`.
 *
 * Pure module with no DOM or Three.js dependency: a drop's place is a function
 * of where it was and how long the frame took, so the whole of it can be unit
 * tested in Node and driven by any renderer.
 */

import { daylightAt, sunPositionAt } from './day-night.js';

// --- What a condition draws -----------------------------------------------

/**
 * The three conditions a world can be flown in, as the count of each effect
 * they ask for.
 *
 * `clear` rather than the branch's `sunny`, because this world has a night in
 * it: a clear sky at 02:00 is not a sunny one, and the dial would be naming
 * the sun at the hours the sun is not up.
 */
export const PRECIPITATION = Object.freeze({
    clear:  Object.freeze({ clouds:  0, cloudOpacity: 0,    rainDrops:    0, lightning: false }),
    cloudy: Object.freeze({ clouds: 60, cloudOpacity: 0.34, rainDrops:    0, lightning: false }),
    stormy: Object.freeze({ clouds: 95, cloudOpacity: 0.45, rainDrops: 5200, lightning: true  })
});

/** The condition a world is flown in unless something asks for another. */
export const DEFAULT_PRECIPITATION = 'clear';

/** Every condition by name, in the order a dial should step through them. */
export const PRECIPITATION_IDS = Object.freeze(Object.keys(PRECIPITATION));

export function isPrecipitationId(id) {
    return Object.hasOwn(PRECIPITATION, id);
}

/**
 * What a condition draws, or what the clear sky draws for anything that is not
 * a condition. A name from a version that had a condition this one does not is
 * a clear sky rather than a crash.
 */
export function precipitationAt(id) {
    return PRECIPITATION[id] ?? PRECIPITATION[DEFAULT_PRECIPITATION];
}

/**
 * The most of each effect any condition asks for, which is what the renderer
 * builds once and then draws part of.
 *
 * Built to the worst weather rather than to the weather in force, because the
 * condition is a setting a pilot changes mid-flight: a layer that allocated
 * for the condition it was handed would have to throw its sprites away and
 * build 5200 more the frame somebody asked for a storm, which is a stall in
 * the middle of a flight to avoid holding a few hundred kilobytes.
 */
export const PRECIPITATION_MOST = Object.freeze({
    clouds:    Math.max(...PRECIPITATION_IDS.map(id => PRECIPITATION[id].clouds)),
    rainDrops: Math.max(...PRECIPITATION_IDS.map(id => PRECIPITATION[id].rainDrops))
});

// --- Layout ---------------------------------------------------------------

// Rain fills a box around the camera and drops recycle to the top as they
// fall. The clearance keeps them off the lens: a drop seeded a unit from the
// camera fills half the screen and reads as a blob rather than as rain.
export const RAIN_BOX       = Object.freeze({ width: 260, height: 200, depth: 260 });
export const RAIN_CLEARANCE = 18;
export const RAIN_SPEED     = 190;   // world units a second, straight down
export const RAIN_SHEAR     = 55;    // sideways drift, so the storm reads as windy
export const DROP_HEIGHT    = 0.6;
export const RAIN_ASPECT    = 74.3 / 190.72;

// The deck has to sit inside fog range or it fades out before it is ever seen,
// so it is a tight ceiling wrapped around the aircraft rather than a wide
// sparse field.
export const CLOUD_SPREAD  = 3000;
export const CLOUD_CEILING = Object.freeze({ base: 680, spread: 460 });
export const CLOUD_WIDTH   = Object.freeze({ base: 380, spread: 520 });
export const CLOUD_DRIFT   = 26;     // world units a second
export const CLOUD_ASPECT  = 281.76 / 178.25;

/** Which way the deck drifts, as a direction of unit length. */
export const CLOUD_WIND = Object.freeze(unit(1, 0.35));

// Lightning timing, in seconds.
export const STRIKE_GAP    = Object.freeze({ min: 3.5, max: 11 });
export const STRIKE_LENGTH = 0.42;

/**
 * The longest frame the weather is stepped by. A delta longer than this means
 * the tab was hidden or the machine stalled, and applying it would teleport
 * the whole layer in one frame - the deck past its own wrap and every drop
 * through the floor.
 */
export const MAX_STEP = 0.05;

/** A frame's length as the weather is willing to take it: forwards, and short. */
export function weatherStep(dt) {
    const step = Number(dt);
    if (!Number.isFinite(step) || step <= 0) return 0;
    return Math.min(step, MAX_STEP);
}

// --- The sun or the moon --------------------------------------------------

export const CELESTIAL_DISTANCE = 9000;
export const CELESTIAL_SIZE     = 900;

/**
 * Where the sky's body is at an hour and what colour it is drawn in.
 *
 * One body rather than the branch's pair of assets, and that is the whole of
 * what the continuous cycle changes about it. The branch had a `day` or
 * `night` switch, so it could hang a sun on one side of it and a moon on the
 * other; here the hour is a phase and the light at it is a blend, so the body
 * takes the colour of the light the world is already lit by - warm and bright
 * at noon, cold and dim at midnight - and reads as the sun or the moon without
 * anything having to choose which it is.
 *
 * It is placed by the same arc the key light walks, thrown far enough out to
 * sit beyond the ground, so where the body appears and where the light comes
 * from are one answer rather than two that can disagree.
 */
export function celestialAt(phase, { distance = CELESTIAL_DISTANCE, size = CELESTIAL_SIZE } = {}) {
    const light = daylightAt(phase);
    return { at: sunPositionAt(phase, distance), color: light.sun.color, size, label: light.label };
}

/**
 * A colour as the hour lights it, where the colour given is what noon would
 * show.
 *
 * This is the continuous answer to the branch's `day` or `night` switch, which
 * carried one colour for each and nothing in between. What lights a cloud is
 * the fill - sky light, from above and all round - so a colour is walked from
 * itself at full day to the fill's own colour after dark, which leaves the
 * deck a dim blue-grey at midnight rather than a grey nobody turned the lights
 * off on.
 */
export function litShade(color, phase) {
    const light = daylightAt(phase);
    const t = clamp(light.daylight, 0, 1);

    return [
        color[0] * mix(light.ambient.color[0], 1, t),
        color[1] * mix(light.ambient.color[1], 1, t),
        color[2] * mix(light.ambient.color[2], 1, t)
    ];
}

// --- A strike over the sky ------------------------------------------------

/** The colour a strike washes the sky and the fog toward. */
export const FLASH_SKY = Object.freeze([0.86, 0.88, 1]);

/** What the fill light is multiplied by at the top of a strike. */
export const FLASH_AMBIENT = 1.6;

/**
 * The sky colour of an hour with a strike over it. The hour is kept rather
 * than replaced, so a strike at dusk flashes an orange sky toward white and
 * comes back to the dusk it interrupted.
 */
export function flashedSky(sky, flash = 0) {
    const t = clamp(flash, 0, 1);
    return [
        mix(sky[0], FLASH_SKY[0], t),
        mix(sky[1], FLASH_SKY[1], t),
        mix(sky[2], FLASH_SKY[2], t)
    ];
}

/** The fill light of an hour with a strike over it, which is simply more of it. */
export function flashedAmbient(intensity, flash = 0) {
    return intensity * (1 + clamp(flash, 0, 1) * (FLASH_AMBIENT - 1));
}

/** How long until the next strike, which is never the same twice. */
export function strikeGap(random = Math.random) {
    return STRIKE_GAP.min + random() * (STRIKE_GAP.max - STRIKE_GAP.min);
}

/**
 * How bright a strike is, with `remaining` seconds of it left to run: a
 * decaying envelope with a flicker on top, so one strike reads as two or three
 * stutters rather than as a single clean fade.
 */
export function strikeFlash(remaining) {
    const t = clamp(remaining / STRIKE_LENGTH, 0, 1);
    return t * (0.55 + 0.45 * Math.abs(Math.sin(t * Math.PI * 5)));
}

/** A storm waiting on its first strike. */
export function createStrikes(random = Math.random) {
    return { next: strikeGap(random), remaining: 0, flash: 0 };
}

/**
 * Moves a storm on by a frame and returns how much flash is in force.
 *
 * A strike that has just been scheduled flashes from the following frame
 * rather than this one, which is the branch's own order and costs a frame
 * nobody can see: the alternative is a strike whose first frame is its
 * brightest and its last, at a `dt` long enough.
 */
export function advanceStrikes(state, dt, random = Math.random) {
    const step = weatherStep(dt);

    if (state.remaining > 0) {
        state.remaining = Math.max(state.remaining - step, 0);
        state.flash = state.remaining > 0 ? strikeFlash(state.remaining) : 0;
        return state.flash;
    }

    state.next -= step;
    if (state.next <= 0) {
        state.next = strikeGap(random);
        state.remaining = STRIKE_LENGTH;
    }

    state.flash = 0;
    return state.flash;
}

// --- The cloud deck -------------------------------------------------------

/**
 * A deck of clouds, as the places and sizes to draw them at. Plain data rather
 * than sprites, so the arrangement is the renderer's to put on screen and this
 * module's to work out.
 */
export function createCloudDeck(count, random = Math.random) {
    const deck = [];

    for (let i = 0; i < Math.max(Math.trunc(count) || 0, 0); i++) {
        const width = CLOUD_WIDTH.base + random() * CLOUD_WIDTH.spread;
        deck.push({
            x: (random() * 2 - 1) * CLOUD_SPREAD,
            y: CLOUD_CEILING.base + random() * CLOUD_CEILING.spread,
            z: (random() * 2 - 1) * CLOUD_SPREAD,
            width,
            height: width / CLOUD_ASPECT,
            // Every cloud is drawn from one texture, so mirroring half of them
            // on x is the cheapest way to stop a deck reading as one shape
            // repeated across the sky.
            facing: random() < 0.5 ? -1 : 1
        });
    }

    return deck;
}

/**
 * Drifts a deck downwind by a frame, keeping it wrapped around the aircraft so
 * the sky never runs out however far the aircraft has flown since the last
 * frame.
 */
export function driftClouds(deck, dt, { x = 0, z = 0 } = {}, wind = CLOUD_WIND) {
    const drift = weatherStep(dt) * CLOUD_DRIFT;

    for (const cloud of deck) {
        cloud.x = x + wrap(cloud.x + wind.x * drift - x, CLOUD_SPREAD);
        cloud.z = z + wrap(cloud.z + wind.z * drift - z, CLOUD_SPREAD);
    }

    return deck;
}

// --- The rain -------------------------------------------------------------

/**
 * How many times a drop is redrawn looking for a place clear of the lens.
 *
 * The branch redrew until it found one, which terminates with probability one
 * and nothing stronger. The lens box is a fiftieth of the floor, so eight
 * attempts miss it by a part in ten to the fourteenth - and a `random` that
 * keeps answering the same number would redraw for ever. Past the attempts the
 * drop is pushed clear instead, which is a worse place to put a drop and a
 * better thing to do than not return.
 */
export const SEED_ATTEMPTS = 8;

/** True for a place so close to the camera that a drop there fills the frame. */
export function overLens(x, z) {
    return Math.abs(x) < RAIN_CLEARANCE && Math.abs(z) < RAIN_CLEARANCE;
}

/** A rain box with every drop in it, seeded at a height of its own. */
export function createDrops(count, random = Math.random) {
    const total = Math.max(Math.trunc(count) || 0, 0);
    const drops = new Float32Array(total * 3);

    for (let i = 0; i < total; i++) seedDrop(drops, i, random() * RAIN_BOX.height, random);

    return drops;
}

/**
 * Puts one drop somewhere across the box at the height given, measured from
 * the floor of the box rather than from its middle - so a drop handed the
 * box's own height is a drop at the ceiling.
 */
export function seedDrop(drops, index, height, random = Math.random) {
    let x = 0;
    let z = 0;

    for (let attempt = 0; attempt < SEED_ATTEMPTS; attempt++) {
        x = (random() - 0.5) * RAIN_BOX.width;
        z = (random() - 0.5) * RAIN_BOX.depth;
        if (!overLens(x, z)) break;
    }

    if (overLens(x, z)) x = x < 0 ? -RAIN_CLEARANCE : RAIN_CLEARANCE;

    const at = index * 3;
    drops[at]     = x;
    drops[at + 1] = height - RAIN_BOX.height / 2;
    drops[at + 2] = z;
    return drops;
}

/**
 * Falls every drop by a frame, drifts it downwind, and puts the ones that have
 * run out of box back at the top.
 *
 * The shear walks drops sideways across the whole width, so one seeded clear of
 * the lens will eventually drift into it. Those are re-seeded at the height
 * they had reached rather than left to swell across the screen, which keeps a
 * storm from reading as a windscreen nobody wiped.
 */
export function advanceDrops(drops, dt, random = Math.random) {
    const step  = weatherStep(dt);
    const fall  = RAIN_SPEED * step;
    const shear = RAIN_SHEAR * step;
    const floor = -RAIN_BOX.height / 2;
    const count = Math.floor(drops.length / 3);

    for (let i = 0; i < count; i++) {
        const at = i * 3;

        drops[at + 1] -= fall;
        if (drops[at + 1] < floor) {
            seedDrop(drops, i, RAIN_BOX.height, random);
            continue;
        }

        drops[at] = wrap(drops[at] + shear, RAIN_BOX.width / 2);

        if (overLens(drops[at], drops[at + 2])) {
            seedDrop(drops, i, drops[at + 1] + RAIN_BOX.height / 2, random);
        }
    }

    return drops;
}

// --- Arithmetic -----------------------------------------------------------

/** Folds a value back into [-half, half], however far outside it has drifted. */
export function wrap(value, half) {
    const span = half * 2;
    if (!(span > 0)) return 0;
    return value - Math.round(value / span) * span;
}

function unit(x, z) {
    const length = Math.hypot(x, z);
    return length > 0 ? { x: x / length, z: z / length } : { x: 0, z: 0 };
}

function mix(from, to, t) {
    return from + (to - from) * t;
}

function clamp(value, low, high) {
    const number = Number(value);
    return Math.min(Math.max(Number.isFinite(number) ? number : low, low), high);
}
