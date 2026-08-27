import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
    CYCLE_LENGTH, CYCLE_START, DAY_STOPS, SUN_DISTANCE, NIGHT_ELEVATION,
    createDayNight, advanceDayNight, daylightAt, sunPositionAt, wrapPhase, clockAt
} from '../js/day-night.js';

const NOON = 0.5;

// The sky the world is drawn in is declared beside the renderer that draws it,
// which imports Three.js and so cannot be loaded here. Reading the colour off
// the source keeps the two honest without a renderer.
const skySource = readFileSync(fileURLToPath(new URL('../js/sky.js', import.meta.url)), 'utf8');
const SKY_COLOR = Number(skySource.match(/SKY_COLOR\s*=\s*(0x[0-9a-f]+)/i)[1]);

/** A colour as the integer a renderer is given, for comparing with the old sky. */
function packed([r, g, b]) {
    const channel = (value) => Math.round(Math.min(Math.max(value, 0), 1) * 255);
    return (channel(r) << 16) | (channel(g) << 8) | channel(b);
}

// --- The day itself -------------------------------------------------------

test('a day is a length and an hour to open on', () => {
    const cycle = createDayNight();
    assert.equal(cycle.length, CYCLE_LENGTH);
    assert.equal(cycle.phase, CYCLE_START);
});

test('a day that was asked for nonsense runs for the length it always did', () => {
    assert.equal(createDayNight({ length: 0 }).length, CYCLE_LENGTH);
    assert.equal(createDayNight({ length: -60 }).length, CYCLE_LENGTH);
    assert.equal(createDayNight({ length: 'noon' }).length, CYCLE_LENGTH);
    assert.equal(createDayNight({ phase: 'noon' }).phase, 0);
});

test('a whole day passes in the time the day was given', () => {
    const cycle = createDayNight({ length: 100, phase: 0 });

    advanceDayNight(cycle, 25);
    assert.ok(Math.abs(cycle.phase - 0.25) < 1e-9, 'a quarter of the day is a quarter of the way through it');

    advanceDayNight(cycle, 75);
    assert.ok(Math.abs(cycle.phase) < 1e-9, 'and the whole of it comes back round to where it started');
});

test('a flight that is not flying is a day that is not passing', () => {
    const cycle = createDayNight({ length: 100, phase: 0.4 });
    advanceDayNight(cycle, 0);
    assert.equal(cycle.phase, 0.4);
    advanceDayNight(cycle, NaN);
    assert.equal(cycle.phase, 0.4, 'a step that is not a number is not a step');
});

test('an hour outside the day is the hour inside it that it amounts to', () => {
    assert.equal(wrapPhase(1.25), 0.25);
    assert.ok(Math.abs(wrapPhase(-0.25) - 0.75) < 1e-9);
    assert.equal(wrapPhase(3), 0);
    assert.equal(wrapPhase('half past'), 0);
});

// --- The light ------------------------------------------------------------

test('midday is the light the world was drawn in before it had a day', () => {
    const noon = daylightAt(NOON);
    assert.equal(packed(noon.sky), SKY_COLOR, 'the sky at noon is the sky the world always had');
    assert.equal(noon.sun.intensity, 1.3);
    assert.equal(noon.ambient.intensity, 0.7);
    assert.equal(noon.daylight, 1);
});

test('the day gets to every hour of itself', () => {
    for (const stop of DAY_STOPS) {
        const light = daylightAt(stop.at);
        assert.deepEqual(light.sky, stop.sky, `${stop.label} should be drawn as itself`);
        assert.equal(light.sun.intensity, stop.sun.intensity);
        assert.equal(light.label, stop.label);
    }
});

test('the light between two hours is between the two of them', () => {
    const [dusk, nightfall] = [DAY_STOPS[6], DAY_STOPS[7]];
    const between = daylightAt((dusk.at + nightfall.at) / 2);

    for (let c = 0; c < 3; c++) {
        const low = Math.min(dusk.sky[c], nightfall.sky[c]);
        const high = Math.max(dusk.sky[c], nightfall.sky[c]);
        assert.ok(between.sky[c] >= low && between.sky[c] <= high,
            'a sky halfway between two hours should be between the two skies');
    }

    assert.ok(between.daylight < dusk.daylight, 'and the day should be going out rather than coming in');
    assert.ok(between.daylight > nightfall.daylight);
});

test('midnight is one place rather than a seam', () => {
    const before = daylightAt(0.9999);
    const after  = daylightAt(0.0001);

    for (let c = 0; c < 3; c++) {
        assert.ok(Math.abs(before.sky[c] - after.sky[c]) < 0.02,
            'the sky either side of midnight should be the same sky');
    }
    assert.ok(Math.abs(before.daylight - after.daylight) < 0.02);
});

test('there is more day at noon than at midnight, and none of it is out of range', () => {
    assert.ok(daylightAt(0.5).daylight > daylightAt(0).daylight);

    for (let step = 0; step < 200; step++) {
        const light = daylightAt(step / 200);
        assert.ok(light.daylight >= 0 && light.daylight <= 1, 'daylight is a fraction of a day');
        assert.ok(light.sun.intensity > 0, 'there is always something to see by');

        for (const channel of [...light.sky, ...light.sun.color, ...light.ambient.color]) {
            assert.ok(channel >= 0 && channel <= 1, 'every colour stays a colour');
        }
    }
});

// --- The sun --------------------------------------------------------------

test('the sun crosses the sky rather than hanging in a corner of it', () => {
    const morning = sunPositionAt(0.35);
    const noon    = sunPositionAt(NOON);
    const evening = sunPositionAt(0.65);

    assert.ok(noon.y > morning.y && noon.y > evening.y, 'the sun is highest at midday');
    assert.ok(morning.x > 0 && evening.x < 0, 'and it rises on one side and sets on the other');
    assert.ok(Math.abs(noon.x) < 1e-9);
});

test('the sun is held over the horizon so the ground keeps its shape after dark', () => {
    const midnight = sunPositionAt(0);
    assert.ok(Math.abs(midnight.y - SUN_DISTANCE * NIGHT_ELEVATION) < 1e-6);
    assert.ok(midnight.y > 0);
});

test('the sun is thrown as far as it was asked to be', () => {
    const at = sunPositionAt(0.5, 300);
    assert.ok(Math.abs(at.y - 300) < 1e-6);
});

// --- Reading the time -----------------------------------------------------

test('the hour of the day reads as a clock', () => {
    assert.equal(clockAt(0), '00:00');
    assert.equal(clockAt(0.25), '06:00');
    assert.equal(clockAt(0.5), '12:00');
    assert.equal(clockAt(0.75), '18:00');
    assert.equal(clockAt(1), '00:00', 'the end of the day is the start of the next one');
});
