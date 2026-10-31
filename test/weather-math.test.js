import test from 'node:test';
import assert from 'node:assert/strict';
import {
    PRECIPITATION, PRECIPITATION_IDS, PRECIPITATION_MOST, DEFAULT_PRECIPITATION,
    isPrecipitationId, precipitationAt,
    RAIN_BOX, RAIN_CLEARANCE, RAIN_SPEED, RAIN_SHEAR, MAX_STEP,
    CLOUD_SPREAD, CLOUD_CEILING, CLOUD_WIDTH, CLOUD_DRIFT, CLOUD_WIND, CLOUD_ASPECT,
    STRIKE_GAP, STRIKE_LENGTH, FLASH_SKY, FLASH_AMBIENT,
    weatherStep, wrap, overLens, SEED_ATTEMPTS,
    createDrops, seedDrop, advanceDrops,
    createCloudDeck, driftClouds,
    createStrikes, advanceStrikes, strikeFlash, strikeGap,
    flashedSky, flashedAmbient, litShade, celestialAt,
    CELESTIAL_DISTANCE, CELESTIAL_SIZE
} from '../js/weather-math.js';
import { daylightAt, sunPositionAt, NIGHT_ELEVATION } from '../js/day-night.js';

/** A `random` that walks a list, so a draw can be put where the test wants it. */
function scripted(values) {
    let at = 0;
    return () => values[at++ % values.length];
}

// --- What a condition asks for --------------------------------------------

test('the three conditions are a clear sky, a cloudy one, and a storm', () => {
    assert.deepEqual(PRECIPITATION_IDS, ['clear', 'cloudy', 'stormy']);
    assert.equal(DEFAULT_PRECIPITATION, 'clear', 'a world opens in the clear');

    for (const id of PRECIPITATION_IDS) {
        assert.equal(isPrecipitationId(id), true);
        assert.equal(precipitationAt(id), PRECIPITATION[id]);
    }
});

// Each condition is more weather than the one before it, in every effect it
// has. Written as a test because the table is the one place the dial's order
// means anything: a `cloudy` with less cloud than `clear` would read as a dial
// that does nothing until it is turned all the way.
test('each condition is more weather than the one before it', () => {
    const steps = PRECIPITATION_IDS.map(id => PRECIPITATION[id]);

    for (let i = 1; i < steps.length; i++) {
        assert.ok(steps[i].clouds       >= steps[i - 1].clouds);
        assert.ok(steps[i].cloudOpacity >= steps[i - 1].cloudOpacity);
        assert.ok(steps[i].rainDrops    >= steps[i - 1].rainDrops);
    }

    assert.equal(steps[0].clouds, 0, 'a clear sky has nothing in it');
    assert.equal(steps[0].rainDrops, 0);
    assert.equal(steps[0].lightning, false);
    assert.equal(steps.at(-1).lightning, true, 'and only a storm has lightning in it');
});

// The layer builds to this and draws down to the condition in force, so a
// figure short of the worst weather would be a storm with some of its rain
// missing and nothing to say so.
test('the most of each effect is the most any condition asks for', () => {
    for (const id of PRECIPITATION_IDS) {
        assert.ok(PRECIPITATION_MOST.clouds    >= PRECIPITATION[id].clouds);
        assert.ok(PRECIPITATION_MOST.rainDrops >= PRECIPITATION[id].rainDrops);
    }

    assert.equal(PRECIPITATION_MOST.clouds,
        Math.max(...PRECIPITATION_IDS.map(id => PRECIPITATION[id].clouds)));
    assert.equal(PRECIPITATION_MOST.rainDrops,
        Math.max(...PRECIPITATION_IDS.map(id => PRECIPITATION[id].rainDrops)));
});

test('a condition from somewhere else reads as a clear sky rather than throwing', () => {
    for (const id of ['sunny', 'hail', '', null, undefined, 0]) {
        assert.equal(isPrecipitationId(id), false);
        assert.equal(precipitationAt(id), PRECIPITATION.clear,
            `${JSON.stringify(id)} is not a condition this world has`);
    }
});

// --- A frame of it --------------------------------------------------------

/**
 * A delta long enough to mean the tab was hidden is clamped rather than
 * applied, and this is the claim behind that: unclamped, one such frame falls
 * a drop further than the whole box is deep and drifts the deck past its own
 * wrap, so the layer teleports on the frame a machine comes back to life.
 */
test('a frame is taken forwards and short', () => {
    assert.equal(weatherStep(0.016), 0.016);
    assert.equal(weatherStep(MAX_STEP), MAX_STEP);
    assert.equal(weatherStep(4), MAX_STEP, 'a stalled frame is clamped, not applied');

    for (const dt of [0, -1, NaN, undefined, null, 'x']) {
        assert.equal(weatherStep(dt), 0, `${JSON.stringify(dt)} moves nothing`);
    }

    assert.ok(RAIN_SPEED * MAX_STEP < RAIN_BOX.height,
        'a clamped frame cannot fall a drop through the floor');
    assert.ok(CLOUD_DRIFT * MAX_STEP < CLOUD_SPREAD,
        'or drift the deck past its own wrap');
});

test('a value is folded back into the span it belongs to, however far out it is', () => {
    assert.equal(wrap(0, 100), 0);
    assert.equal(wrap(40, 100), 40, 'inside the span is left where it is');
    assert.equal(wrap(-40, 100), -40);

    assert.equal(wrap(120, 100), -80, 'past one end comes back at the other');
    assert.equal(wrap(-120, 100), 80);
    assert.equal(wrap(4321, 100), -79, 'however many spans out it has drifted');

    for (const value of [999, -999, 1e6]) {
        assert.ok(Math.abs(wrap(value, 100)) <= 100, `${value} folds inside the span`);
    }

    assert.equal(wrap(5, 0), 0, 'and a span with no width folds everything to nothing');
});

// --- The cloud deck -------------------------------------------------------

test('a deck is laid inside its spread, under its ceiling, and mirrored both ways', () => {
    const deck = createCloudDeck(PRECIPITATION.stormy.clouds);

    assert.equal(deck.length, PRECIPITATION.stormy.clouds);

    for (const cloud of deck) {
        assert.ok(Math.abs(cloud.x) <= CLOUD_SPREAD, 'inside the spread');
        assert.ok(Math.abs(cloud.z) <= CLOUD_SPREAD);
        assert.ok(cloud.y >= CLOUD_CEILING.base, 'at or above the ceiling it is hung from');
        assert.ok(cloud.y <= CLOUD_CEILING.base + CLOUD_CEILING.spread);
        assert.ok(cloud.width >= CLOUD_WIDTH.base);
        assert.ok(cloud.width <= CLOUD_WIDTH.base + CLOUD_WIDTH.spread);
        assert.ok(Math.abs(cloud.height - cloud.width / CLOUD_ASPECT) < 1e-9,
            'and as tall as a cloud of that width is');
        assert.ok(cloud.facing === 1 || cloud.facing === -1);
    }

    assert.ok(deck.some(cloud => cloud.facing === -1), 'with some of them mirrored');
    assert.ok(deck.some(cloud => cloud.facing === 1), 'and some of them not');
});

test('a deck of no clouds is no clouds rather than a crash', () => {
    for (const count of [0, -4, NaN, undefined, 'x']) {
        assert.deepEqual(createCloudDeck(count), [], `${JSON.stringify(count)} lays nothing`);
    }
    assert.equal(createCloudDeck(2.7).length, 2, 'and a fraction of a cloud is not laid');
});

test('the deck drifts downwind at the rate it declares', () => {
    const deck = [{ x: 0, y: 700, z: 0, width: 400, height: 250, facing: 1 }];

    driftClouds(deck, MAX_STEP);
    assert.ok(Math.abs(deck[0].x - CLOUD_WIND.x * CLOUD_DRIFT * MAX_STEP) < 1e-9);
    assert.ok(Math.abs(deck[0].z - CLOUD_WIND.z * CLOUD_DRIFT * MAX_STEP) < 1e-9);
    assert.equal(deck[0].y, 700, 'and a deck is a ceiling rather than a column');

    assert.ok(Math.abs(Math.hypot(CLOUD_WIND.x, CLOUD_WIND.z) - 1) < 1e-9,
        'the wind is a direction, so the rate is the drift rather than a share of it');
});

/**
 * The claim the whole deck rests on: it is wrapped around the aircraft rather
 * than laid out in the world, so however far the aircraft has flown there is
 * still sky over it. Flown a hundred spreads out, a deck that was positioned
 * in world space would be a hundred spreads behind.
 */
test('the deck wraps around the aircraft however far it has flown', () => {
    const deck = createCloudDeck(40);

    for (const at of [{ x: 0, z: 0 }, { x: 250_000, z: -80_000 }, { x: -1e6, z: 1e6 }]) {
        driftClouds(deck, 0.016, at);

        for (const cloud of deck) {
            assert.ok(Math.abs(cloud.x - at.x) <= CLOUD_SPREAD,
                `a cloud should stay within the spread of ${at.x}, not at ${cloud.x}`);
            assert.ok(Math.abs(cloud.z - at.z) <= CLOUD_SPREAD);
        }
    }
});

// --- The rain -------------------------------------------------------------

test('a drop is seeded across the box, at the height it was given', () => {
    const drops = createDrops(400);
    assert.equal(drops.length, 400 * 3);

    for (let i = 0; i < 400; i++) {
        const at = i * 3;
        assert.ok(Math.abs(drops[at])     <= RAIN_BOX.width / 2);
        assert.ok(Math.abs(drops[at + 2]) <= RAIN_BOX.depth / 2);
        assert.ok(Math.abs(drops[at + 1]) <= RAIN_BOX.height / 2, 'and inside the box it falls in');
    }
});

test('a height is measured off the floor of the box, so the ceiling is its depth', () => {
    const drops = new Float32Array(3);

    seedDrop(drops, 0, RAIN_BOX.height);
    assert.equal(drops[1], RAIN_BOX.height / 2, 'the ceiling');

    seedDrop(drops, 0, 0);
    assert.equal(drops[1], -RAIN_BOX.height / 2, 'and the floor');
});

/**
 * No drop is ever seeded over the lens, because a drop a unit from the camera
 * fills half the frame and reads as a smear rather than as rain.
 *
 * The second half is the one worth a test of its own: the branch this came
 * from redrew until it found a clear place, which never ends for a `random`
 * that keeps answering the middle of the box. That is not a hypothetical - it
 * is every stubbed `random` a test might hand it.
 */
test('a drop is never seeded over the lens, and looking for a place always ends', () => {
    const drops = createDrops(600);
    for (let i = 0; i < 600; i++) {
        assert.equal(overLens(drops[i * 3], drops[i * 3 + 2]), false);
    }

    const stuck = new Float32Array(3);
    seedDrop(stuck, 0, 100, () => 0.5);
    assert.equal(overLens(stuck[0], stuck[2]), false,
        'a random stuck in the middle of the box still lands a drop clear of the lens');
    assert.equal(Math.abs(stuck[0]), RAIN_CLEARANCE, 'pushed exactly clear of it');

    assert.ok(SEED_ATTEMPTS > 1, 'and the push is a last resort rather than the method');
});

test('what counts as over the lens is the near box and nothing wider', () => {
    assert.equal(overLens(0, 0), true);
    assert.equal(overLens(RAIN_CLEARANCE - 0.01, RAIN_CLEARANCE - 0.01), true);
    assert.equal(overLens(RAIN_CLEARANCE, 0), false, 'the clearance itself is clear');
    assert.equal(overLens(0, -RAIN_CLEARANCE), false);
    assert.equal(overLens(-120, 0), false, 'and straight ahead is not over the lens');
    assert.equal(overLens(0, 120), false);
});

test('rain falls at the speed it declares and shears at the rate it declares', () => {
    const drops = new Float32Array([100, 0, 100]);

    advanceDrops(drops, 0.02, () => 0.9);
    assert.ok(Math.abs(drops[1] - -RAIN_SPEED * 0.02) < 1e-4, 'fallen');
    assert.ok(Math.abs(drops[0] - (100 + RAIN_SHEAR * 0.02)) < 1e-4, 'and drifted');
});

test('a drop that has run out of box comes back at the ceiling', () => {
    const drops = new Float32Array([80, -RAIN_BOX.height / 2 + 0.5, 80]);

    advanceDrops(drops, MAX_STEP);
    assert.equal(drops[1], RAIN_BOX.height / 2, 'back at the top rather than through the floor');
});

/**
 * The shear walks a drop sideways across the whole width, so one seeded clear
 * of the lens drifts into it eventually. Those are re-seeded at the height
 * they had got to, which is what keeps a storm from reading as a windscreen
 * nobody wiped - and the height is the part a re-seed can quietly lose.
 */
test('a drop sheared over the lens is moved aside without being dropped back to the top', () => {
    const height = 40;
    const drops  = new Float32Array([RAIN_CLEARANCE - 0.5, height, 4]);

    advanceDrops(drops, 0.004, () => 0.8);

    assert.equal(overLens(drops[0], drops[2]), false, 'moved out of the way');
    assert.ok(Math.abs(drops[1] - (height - RAIN_SPEED * 0.004)) < 1e-3,
        'and left at the height it had fallen to');
});

test('every drop stays inside the box however long it rains', () => {
    const drops = createDrops(300);

    for (let frame = 0; frame < 400; frame++) advanceDrops(drops, MAX_STEP);

    for (let i = 0; i < 300; i++) {
        const at = i * 3;
        assert.ok(Math.abs(drops[at])     <= RAIN_BOX.width / 2 + 1e-3, 'inside the width');
        assert.ok(Math.abs(drops[at + 1]) <= RAIN_BOX.height / 2 + 1e-3, 'inside the height');
        assert.ok(Math.abs(drops[at + 2]) <= RAIN_BOX.depth / 2 + 1e-3, 'inside the depth');
        assert.equal(overLens(drops[at], drops[at + 2]), false, 'and never over the lens');
    }
});

test('an empty rain box is a frame that does nothing', () => {
    const drops = createDrops(0);
    assert.equal(drops.length, 0);
    assert.equal(advanceDrops(drops, 0.016).length, 0);
});

// --- Lightning ------------------------------------------------------------

test('a storm opens waiting rather than striking', () => {
    const strikes = createStrikes(() => 0.5);

    assert.equal(strikes.remaining, 0);
    assert.equal(strikes.flash, 0);
    assert.ok(strikes.next >= STRIKE_GAP.min && strikes.next <= STRIKE_GAP.max);
});

test('a gap is somewhere between the two it is declared with', () => {
    assert.equal(strikeGap(() => 0), STRIKE_GAP.min);
    assert.equal(strikeGap(() => 1), STRIKE_GAP.max);
    assert.ok(strikeGap(() => 0.5) > STRIKE_GAP.min);
    assert.ok(STRIKE_GAP.min < STRIKE_GAP.max, 'and the pair is a range rather than a pair');
});

/**
 * A strike is a decaying envelope with a flicker on it, so one reads as two or
 * three stutters rather than as a single clean fade. Both halves are pinned:
 * the decay, which is what makes it a strike, and the flicker, which is what
 * makes it lightning rather than a lamp.
 */
test('a strike decays, and flickers on the way down', () => {
    assert.equal(strikeFlash(0), 0, 'a strike that is over is no flash at all');
    assert.ok(strikeFlash(STRIKE_LENGTH) > 0, 'and a fresh one is a flash');

    const readings = [];
    for (let left = STRIKE_LENGTH; left > 0; left -= STRIKE_LENGTH / 24) {
        readings.push(strikeFlash(left));
    }

    assert.ok(readings.every(level => level >= 0 && level <= 1), 'inside a share of a full flash');

    const rises = readings.filter((level, i) => i > 0 && level > readings[i - 1]).length;
    assert.ok(rises >= 2, 'a strike that only ever dimmed would be a fade rather than a flicker');
    assert.ok(readings.at(-1) < readings[0], 'and it is on its way out all the same');
});

test('a storm strikes, flashes, and goes quiet again', () => {
    const strikes = createStrikes(() => 0);
    assert.equal(strikes.next, STRIKE_GAP.min);

    // Waiting: no flash, however many frames go by.
    let frames = 0;
    while (advanceStrikes(strikes, MAX_STEP) === 0 && strikes.remaining === 0) {
        assert.ok(++frames < 10_000, 'a storm should get round to striking');
    }

    assert.equal(strikes.remaining, STRIKE_LENGTH, 'the strike is scheduled');
    assert.equal(strikes.flash, 0, 'and flashes from the frame after, as the branch had it');

    const lit = advanceStrikes(strikes, MAX_STEP, () => 0);
    assert.ok(lit > 0, 'then it is a flash');

    // Running it out leaves nothing behind: the layer hands the sky whatever
    // comes back here every frame, so a level left standing is a sky stuck
    // bright until the next strike.
    for (let i = 0; i < 40; i++) advanceStrikes(strikes, MAX_STEP, () => 0);
    assert.equal(strikes.remaining, 0, 'the strike is spent');
    assert.ok(strikes.next > 0, 'and the next one is waiting rather than due');
});

test('a stalled frame cannot skip a strike entirely', () => {
    const strikes = createStrikes(() => 0);
    strikes.remaining = STRIKE_LENGTH;

    // One enormous delta: unclamped it would run the whole strike out in a
    // frame, which is a storm that flashes nothing on a machine that stuttered.
    advanceStrikes(strikes, 30);
    assert.ok(strikes.remaining > 0, 'the strike is still running');
    assert.ok(strikes.remaining >= STRIKE_LENGTH - MAX_STEP);
});

// --- The flash over the sky ----------------------------------------------

test('a flash washes the sky toward the strike colour and leaves the hour under it', () => {
    const dusk = daylightAt(0.75).sky;

    assert.deepEqual(flashedSky(dusk, 0), dusk, 'no strike is the hour, untouched');
    assert.deepEqual(flashedSky(dusk, 1), [...FLASH_SKY], 'a full one is the strike colour');

    const half = flashedSky(dusk, 0.5);
    for (let i = 0; i < 3; i++) {
        assert.ok(Math.abs(half[i] - (dusk[i] + FLASH_SKY[i]) / 2) < 1e-9,
            'and half of one is half way between');
    }

    for (const flash of [-2, 4, NaN, undefined, 'x']) {
        const held = flashedSky(dusk, flash);
        assert.ok(held.every(channel => channel >= 0 && channel <= 1),
            `a flash of ${JSON.stringify(flash)} is still a colour`);
    }
});

test('a flash raises the fill light rather than replacing it', () => {
    const fill = daylightAt(0.1).ambient.intensity;

    assert.equal(flashedAmbient(fill, 0), fill);
    assert.ok(Math.abs(flashedAmbient(fill, 1) - fill * FLASH_AMBIENT) < 1e-9);
    assert.ok(flashedAmbient(fill, 0.5) > fill, 'and any of one is more light than none');
    assert.ok(FLASH_AMBIENT > 1, 'a strike is brighter than the hour it lands in');
});

// --- The hour the weather is drawn in ------------------------------------

/**
 * The body is placed on the arc the key light walks rather than at a fixed
 * position, which is the whole of what the branch's `day` or `night` switch is
 * replaced by: where the body appears and where the light comes from are one
 * answer, so they cannot disagree at any hour.
 */
test('the sky body stands where the light of that hour is coming from', () => {
    for (const phase of [0, 0.15, 0.25, 0.4, 0.5, 0.63, 0.75, 0.9]) {
        const body = celestialAt(phase);
        const at   = sunPositionAt(phase, CELESTIAL_DISTANCE);

        assert.deepEqual(body.at, at, `the body at ${phase} should be on the arc`);
        assert.deepEqual(body.color, daylightAt(phase).sun.color,
            'and drawn in the colour the light at that hour is');
        assert.equal(body.size, CELESTIAL_SIZE);
        assert.equal(body.label, daylightAt(phase).label);
    }
});

test('the body is thrown further out than the light is, and never under the ground', () => {
    assert.ok(CELESTIAL_DISTANCE > 0);

    for (const phase of [0, 0.25, 0.5, 0.75, 0.99]) {
        const body = celestialAt(phase);
        assert.ok(body.at.y >= NIGHT_ELEVATION * CELESTIAL_DISTANCE - 1e-6,
            `the body at ${phase} should stay above the horizon`);
    }

    const near = celestialAt(0.5, { distance: 100, size: 10 });
    assert.ok(Math.hypot(near.at.x, near.at.y, near.at.z) < 200, 'and it can be asked for closer');
    assert.equal(near.size, 10);
});

/**
 * A colour the hour has lit, which is the continuous replacement for the
 * branch's pair of palettes. Noon is the colour as given, midnight is that
 * colour under the fill alone, and nothing in between is a switch.
 */
test('a colour is lit by the hour, fully by day and by the fill after dark', () => {
    const white = [1, 1, 1];

    assert.deepEqual(litShade(white, 0.5), white, 'noon shows a colour as it is');

    const night = litShade(white, 0);
    const fill  = daylightAt(0).ambient.color;
    for (let i = 0; i < 3; i++) {
        assert.ok(night[i] < 1, 'midnight is dimmer than noon');
        assert.ok(night[i] >= fill[i] * 0.999, 'and never dimmer than the fill it is lit by');
    }

    // Monotone across the day, which is the claim that makes it a cycle rather
    // than a pair of settings: no hour is brighter than noon and none darker
    // than midnight.
    const brightness = (phase) => litShade(white, phase).reduce((sum, c) => sum + c, 0);
    assert.ok(brightness(0.5) > brightness(0.36), 'noon is the brightest of them');
    assert.ok(brightness(0.36) > brightness(0.21));
    assert.ok(brightness(0.21) > brightness(0), 'and midnight the dimmest');
});

test('a scripted draw puts a cloud exactly where the layout says it goes', () => {
    const [cloud] = createCloudDeck(1, scripted([0, 1, 0.5, 0.25, 0.9]));

    assert.equal(cloud.width, CLOUD_WIDTH.base, 'the first draw is the width');
    assert.equal(cloud.x, CLOUD_SPREAD, 'then the place across the spread');
    assert.equal(cloud.y, CLOUD_CEILING.base + CLOUD_CEILING.spread * 0.5, 'then the ceiling');
    assert.equal(cloud.z, -CLOUD_SPREAD * 0.5, 'then the place along it');
    assert.equal(cloud.facing, 1, 'and the last draw is which way round it is drawn');
});
