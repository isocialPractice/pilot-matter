import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
    ELEMENTS, ELEMENTS_BY_ID, ELEMENT_ORDER,
    DEFAULT_SIZE, DEFAULT_SEGMENTS,
    createField, fieldX, fieldZ, paint, readColor, mixColor, slopeAt, sampleHeight,
    createRandom, pick, span, scalar, gradient, gated, blend,
    resolveConfig, applyBase, applyElement, orderPlacements,
    getElement, isElementId, carveProfile,
    isOnRunway, waterSurface, clearRunwayGround, RUNWAY_FREEBOARD
} from '../js/environment/elements.js';
import {
    buildEnvironment, getEnvironment, environmentIds, environmentElements
} from '../js/environment/presets.js';

const smallField = () => createField({ size: 4000, segments: 40 });

// --- The field ------------------------------------------------------------

test('a field samples a square grid, one vertex more than it has segments', () => {
    const field = createField({ size: 1000, segments: 10 });
    assert.equal(field.stride, 11);
    assert.equal(field.count, 121);
    assert.equal(field.height.length, 121);
    assert.equal(field.color.length, 363);
    assert.equal(field.step, 100);
});

test('the corners of the field are the corners of the world', () => {
    const field = createField({ size: 1000, segments: 10 });
    assert.equal(fieldX(field, 0), -500);
    assert.equal(fieldZ(field, 0), -500);
    assert.equal(fieldX(field, field.count - 1), 500);
    assert.equal(fieldZ(field, field.count - 1), 500);
});

test('x walks across a row and z walks down the rows', () => {
    const field = createField({ size: 1000, segments: 10 });
    assert.equal(fieldX(field, 1), -400, 'the next vertex is one step along');
    assert.equal(fieldZ(field, 1), -500, 'and still on the first row');
    assert.equal(fieldZ(field, field.stride), -400, 'a whole row on is one step down');
});

test('a colour written to a vertex is the colour read back off it', () => {
    const field = smallField();
    paint(field, 3, [0.25, 0.5, 0.75]);
    const [r, g, b] = readColor(field, 3);
    assert.ok(Math.abs(r - 0.25) < 1e-6);
    assert.ok(Math.abs(g - 0.5) < 1e-6);
    assert.ok(Math.abs(b - 0.75) < 1e-6);
});

test('mixing a colour in leaves what was there showing through', () => {
    const field = smallField();
    paint(field, 0, [0, 0, 0]);
    mixColor(field, 0, [1, 1, 1], 0.5);
    assert.ok(Math.abs(readColor(field, 0)[0] - 0.5) < 1e-6);

    mixColor(field, 0, [1, 1, 1], 0);
    assert.ok(Math.abs(readColor(field, 0)[0] - 0.5) < 1e-6, 'mixing nothing in changes nothing');
});

test('flat ground has no slope and a wall has a lot of it', () => {
    const field = createField({ size: 1000, segments: 10 });
    assert.equal(slopeAt(field, 0), 0);

    field.height[1] = field.step;
    assert.ok(slopeAt(field, 0) >= 1, 'a step as wide as it is tall is a 45 degree face');
});

test('a height sampled between vertices lands between their heights', () => {
    const field = createField({ size: 1000, segments: 10 });
    field.height.fill(0);
    field.height[0] = 0;
    field.height[1] = 100;

    const between = sampleHeight(field, -450, -500);
    assert.ok(between > 0 && between < 100, `${between} should be between the two vertices`);
    assert.equal(sampleHeight(field, -900, 0), 0, 'outside the world reads as sea level');
});

// --- Randomness -----------------------------------------------------------

test('one seed is one world, and two seeds are two', () => {
    const draw = (seed) => {
        const random = createRandom(seed);
        return Array.from({ length: 8 }, () => random());
    };

    assert.deepEqual(draw(42), draw(42));
    assert.notDeepEqual(draw(42), draw(43));
});

test('the values a stream hands out are in range', () => {
    const random = createRandom(7);
    for (let i = 0; i < 500; i++) {
        const value = random();
        assert.ok(value >= 0 && value < 1, `${value} is not a fraction`);
    }
});

test('a pick lands inside the range it was picked from', () => {
    const random = createRandom(11);
    for (let i = 0; i < 200; i++) {
        const value = pick(random, [12, 34]);
        assert.ok(value >= 12 && value <= 34, `${value} is outside 12 to 34`);
    }
});

// --- Configurable ranges --------------------------------------------------

test('an element left unconfigured gets the defaults it declares', () => {
    const element = { ranges: { size: scalar(0, 10, 4), band: span(0, 100, 10, 20) } };
    assert.deepEqual(resolveConfig(element), { size: 4, band: [10, 20] });
});

test('a configuration outside a declared range is clamped back into it', () => {
    const element = { ranges: { size: scalar(0, 10, 4), band: span(0, 100, 10, 20) } };
    const config = resolveConfig(element, { size: 900, band: [-40, 4000] });
    assert.equal(config.size, 10);
    assert.deepEqual(config.band, [0, 100]);
});

test('a range given the wrong way round is read the right way round', () => {
    const element = { ranges: { band: span(0, 100, 10, 20) } };
    assert.deepEqual(resolveConfig(element, { band: [80, 30] }).band, [30, 80]);
});

test('a configuration that is not a number falls back to the default', () => {
    const element = { ranges: { size: scalar(0, 10, 4), band: span(0, 100, 10, 20) } };
    const config = resolveConfig(element, { size: 'quite big', band: 'wide' });
    assert.equal(config.size, 4);
    assert.deepEqual(config.band, [10, 20]);
});

test('a gradient can be half configured, keeping the end it did not name', () => {
    const element = { ranges: { color: gradient([1, 1, 1], [0, 0, 0]) } };
    const config = resolveConfig(element, { color: { dark: [0.1, 0.2, 0.3] } });
    assert.deepEqual(config.color.light, [1, 1, 1]);
    assert.deepEqual(config.color.dark, [0.1, 0.2, 0.3]);
});

test('a resolved gradient is a copy, so one element cannot recolour another', () => {
    const element = { ranges: { color: gradient([1, 1, 1], [0, 0, 0]) } };
    resolveConfig(element).color.light[0] = 0.5;
    assert.deepEqual(resolveConfig(element).color.light, [1, 1, 1]);
});

// --- The gradient ---------------------------------------------------------

const isColor = (actual, expected, message) => {
    for (let channel = 0; channel < 3; channel++) {
        assert.ok(Math.abs(actual[channel] - expected[channel]) < 1e-9,
            `${message}: ${actual} is not ${expected}`);
    }
};

test('a gradient runs from its light end to its dark end and stops there', () => {
    const ramp = { light: [1, 1, 1], dark: [0, 0.2, 0.4] };
    isColor(blend(ramp, 0), ramp.light, 'the light end');
    isColor(blend(ramp, 1), ramp.dark, 'the dark end');
    isColor(blend(ramp, 2), ramp.dark, 'past the dark end is still the dark end');
    isColor(blend(ramp, -1), ramp.light, 'and before the light end is still the light end');
});

test('no step of a gradient shifts dramatically from the step before it', () => {
    const ramp = { light: [0.85, 0.77, 0.55], dark: [0.55, 0.45, 0.28] };
    let previous = blend(ramp, 0);

    for (let t = 0.05; t <= 1.0001; t += 0.05) {
        const here = blend(ramp, t);
        for (let channel = 0; channel < 3; channel++) {
            assert.ok(Math.abs(here[channel] - previous[channel]) < 0.05,
                `the gradient jumps at ${t.toFixed(2)}`);
        }
        previous = here;
    }
});

// --- The registry ---------------------------------------------------------

test('every element the world is described in terms of is in the registry', () => {
    const expected = [
        'mountain', 'grass', 'sand', 'water', 'river',
        'forest', 'canyon', 'desert', 'town', 'snow', 'runway'
    ];
    for (const id of expected) {
        assert.equal(isElementId(id), true, `${id} should be an element`);
        assert.equal(getElement(id).id, id);
    }
    assert.equal(ELEMENTS.length, expected.length, 'the registry holds these and nothing else');
});

test('an element is data: ranges to configure it and a generator to draw it', () => {
    for (const element of ELEMENTS) {
        assert.ok(element.label.length > 0, `${element.id} needs a label`);
        assert.equal(typeof element.generate, 'function', `${element.id} needs a generator`);

        const names = Object.keys(element.ranges);
        assert.ok(names.length > 0, `${element.id} should declare what can be configured about it`);
        for (const [name, range] of Object.entries(element.ranges)) {
            assert.ok(['span', 'scalar', 'gradient', 'gated'].includes(range.kind),
                `${element.id}.${name} is not a range`);
        }
    }
});

test('asking for an element that does not exist says so', () => {
    assert.throws(() => getElement('volcano'), /Unknown environment element/);
    assert.equal(isElementId('volcano'), false);
});

test('the pipeline names every element, so none is left with nowhere to run', () => {
    assert.deepEqual([...ELEMENT_ORDER].sort(), [...ELEMENTS_BY_ID.keys()].sort());
});

test('elements are applied in the pipeline order, whatever order they are listed', () => {
    const listed = [{ type: 'snow' }, { type: 'water' }, { type: 'mountain' }, { type: 'grass' }];
    assert.deepEqual(
        orderPlacements(listed).map(placement => placement.type),
        ['mountain', 'grass', 'water', 'snow']
    );
    assert.deepEqual(listed.map(placement => placement.type),
        ['snow', 'water', 'mountain', 'grass'], 'the preset itself is left alone');
});

// --- The base ground ------------------------------------------------------

test('the base ground is inside the height it was given and is coloured all over', () => {
    const field = smallField();
    const config = applyBase(field, { maxHeight: 300 });

    assert.equal(config.maxHeight, 300);
    for (let i = 0; i < field.count; i++) {
        assert.ok(field.height[i] >= 0 && field.height[i] <= 300, `vertex ${i} is off the scale`);
    }
    assert.ok(field.color.every(channel => channel > 0), 'no vertex should be left unpainted');
});

test('two base offsets are two different pieces of ground', () => {
    const here = smallField(), there = smallField();
    applyBase(here, {});
    applyBase(there, { offsetX: 120 });
    assert.notDeepEqual([...here.height], [...there.height]);
});

// --- The generators -------------------------------------------------------

// Tall enough ground for every element to have somewhere to draw, the snow
// line at 300 included.
const shaped = (id, config) => {
    const field = smallField();
    applyBase(field, { maxHeight: 600 });
    const before = { height: [...field.height], color: [...field.color] };
    applyElement(field, { type: id, config }, createRandom(99));
    return { field, before: before.height, colorBefore: before.color };
};

test('every element changes the world it is placed in', () => {
    for (const element of ELEMENTS) {
        const { field, before, colorBefore } = shaped(element.id);
        const movedGround = before.some((height, i) => Math.abs(height - field.height[i]) > 1e-6);
        const movedColour = colorBefore.some((channel, i) => Math.abs(channel - field.color[i]) > 1e-6);
        assert.ok(movedGround || movedColour, `${element.id} drew nothing`);
    }
});

test('mountains raise the ground rather than lowering it', () => {
    const { field, before } = shaped('mountain', { count: 6, height: [100, 200] });
    let raised = 0;
    for (let i = 0; i < field.count; i++) {
        assert.ok(field.height[i] >= before[i] - 1e-6, `vertex ${i} was dug out by a mountain`);
        if (field.height[i] > before[i] + 1e-6) raised++;
    }
    assert.ok(raised > 0, 'a mountain pass that raises nothing has placed no mountains');
});

test('a canyon cuts down into the ground and never builds it up', () => {
    const { field, before } = shaped('canyon', { depth: [80, 120], branches: 2 });
    let cut = 0;
    for (let i = 0; i < field.count; i++) {
        assert.ok(field.height[i] <= before[i] + 1e-6, `vertex ${i} was raised by a canyon`);
        if (field.height[i] < before[i] - 1e-6) cut++;
    }
    assert.ok(cut > 0, 'a canyon that cuts nothing is not a canyon');
});

test('the carve profile is a flat floor, a wall, and untouched ground past it', () => {
    assert.equal(carveProfile(0, 0.6), 1, 'the middle of the channel is the full cut');
    assert.equal(carveProfile(0.5, 0.6), 1, 'and so is the rest of the floor');
    assert.equal(carveProfile(1, 0.6), 0, 'the far bank is not cut at all');
    assert.equal(carveProfile(2, 0.6), 0);

    const wall = carveProfile(0.8, 0.6);
    assert.ok(wall > 0 && wall < 1, 'the wall is what runs between the two');
    assert.ok(carveProfile(0.7, 0.6) > carveProfile(0.9, 0.6), 'and it eases out, not in');
});

test('a steeper canyon spends less of its channel on the walls', () => {
    assert.ok(carveProfile(0.7, 0.8) > carveProfile(0.7, 0.2));
});

test('water fills its basins to one level and paints them', () => {
    const field = smallField();
    applyBase(field, { maxHeight: 300 });
    applyElement(field, { type: 'water', config: { level: 40, flatten: 1 } }, createRandom(3));

    let wet = 0;
    for (let i = 0; i < field.count; i++) {
        assert.ok(field.height[i] >= 40 - 1e-3, `vertex ${i} is still below the water line`);
        if (Math.abs(field.height[i] - 40) < 1e-3) wet++;
    }
    assert.ok(wet > 0, 'a water level nothing reaches is not a water body');
});

test('water left unflattened is a colour rather than a surface', () => {
    const field = smallField();
    applyBase(field, { maxHeight: 300 });
    const before = [...field.height];
    applyElement(field, { type: 'water', config: { level: 40, flatten: 0 } }, createRandom(3));
    assert.deepEqual([...field.height], before);
});

test('snow settles above its line and nowhere below it', () => {
    const field = smallField();
    applyBase(field, { maxHeight: 400 });
    const before = [...field.color];
    applyElement(field, { type: 'snow', config: { line: 200, coverage: 1, slope: 3 } }, createRandom(5));

    for (let i = 0; i < field.count; i++) {
        if (field.height[i] > 200) continue;
        for (let channel = 0; channel < 3; channel++) {
            assert.equal(field.color[i * 3 + channel], before[i * 3 + channel],
                `snow settled on vertex ${i}, which is below the line`);
        }
    }
});

test('a town levels the ground it is built on', () => {
    const field = smallField();
    applyBase(field, { maxHeight: 300 });
    const before = [...field.height];
    applyElement(field, { type: 'town', config: { grid: 200, density: 0.5 } }, createRandom(17));

    assert.notDeepEqual([...field.height], before, 'a town that changes nothing has not been built');
});

test('an element placed twice from the same seed draws the same thing twice', () => {
    const first  = shaped('mountain', { count: 8 });
    const second = shaped('mountain', { count: 8 });
    assert.deepEqual([...first.field.height], [...second.field.height]);
});

test('the field the simulator flies over is the size the terrain declares', () => {
    assert.equal(DEFAULT_SIZE, 16000);
    assert.equal(DEFAULT_SEGMENTS, 200);
});

// --- The strip is ground nothing else may be placed on ---------------------

/**
 * The strip is cut last, over whatever else claimed the ground, and levelling
 * is enough for everything drawn as a height. The one thing it is not enough
 * for is a surface read back off the finished field afterwards: the water is
 * the vertices lying under its own line, so a strip graded at or below that
 * line comes back out of the field as water and a flight starts from the
 * bottom of a lake.
 */
test('a strip the water settled on is cut clear of it', () => {
    const field = createField({ size: 1000, segments: 10 });
    field.water = { level: 40 };

    const cut = clearRunwayGround(field, 12);
    assert.ok(cut.elevation > 40, `the strip is cut at ${cut.elevation}, above the water at 40`);
    assert.equal(cut.elevation, 40 + RUNWAY_FREEBOARD);
    assert.deepEqual(cut.cleared, ['water'], 'and says which element it was cut clear of');
});

test('a strip already above the water line is left where the ground put it', () => {
    const field = createField({ size: 1000, segments: 10 });
    field.water = { level: 4 };

    assert.deepEqual(clearRunwayGround(field, 42), { elevation: 42, cleared: [] });
});

test('a world with no water in it has nothing to cut the strip clear of', () => {
    const field = createField({ size: 1000, segments: 10 });
    assert.deepEqual(clearRunwayGround(field, 42), { elevation: 42, cleared: [] });

    field.water = { level: NaN };
    assert.deepEqual(clearRunwayGround(field, 42), { elevation: 42, cleared: [] });
});

/**
 * And the whole of it holds where it matters: in every world, with every range
 * of every element pushed to the end of what the element editor can ask for,
 * the strip comes out of the generator as dry ground.
 */
test('no element the editor can move reaches the strip', () => {
    for (const id of environmentIds()) {
        const environment = getEnvironment(id);
        // The strip the editor lists, as the generator would lay it down: an
        // element list handed over replaces the preset's, so the runway has to
        // be in the list rather than asked for beside it.
        const placements = environmentElements(environment, true);

        for (const placement of placements) {
            if (placement.type === 'runway') continue;
            const element = getElement(placement.type);

            for (const [name, range] of Object.entries(element.ranges)) {
                if (range.kind === 'gradient') continue;

                const config = { ...resolveConfig(element, placement.config) };
                // A gated range is pushed to its widest with the gate thrown,
                // because that is the strongest thing the panel can ask for -
                // left off it asks for nothing at all, and the one range the
                // editor can open furthest would go untested.
                config[name] = range.kind === 'gated' ? { on: true, range: [range.low, range.high] }
                    : range.kind === 'span' ? [range.low, range.high]
                    : range.high;

                const field = buildEnvironment(environment, {
                    runway: true,
                    elements: placements.map(entry =>
                        entry === placement ? { type: entry.type, config } : entry)
                });

                const strip = field.runways[0];
                assert.ok(strip, `${id} with ${placement.type}.${name} wide open should still have a strip`);

                const wet = new Set(Array.from(waterSurface(field)?.vertices ?? []));
                const on = [...Array(field.count).keys()]
                    .filter(i => isOnRunway(strip, fieldX(field, i), fieldZ(field, i)));

                assert.ok(on.length > 0, `${id} with ${placement.type}.${name} wide open should draw a strip`);
                assert.equal(on.filter(i => wet.has(i)).length, 0,
                    `${id}: ${placement.type}.${name} at its limit put water on the strip`);
                assert.ok(on.every(i => Math.abs(field.height[i] - field.height[on[0]]) < 0.01),
                    `${id}: ${placement.type}.${name} at its limit left the strip uneven`);
            }
        }
    }
});

// --- A range a switch turns on --------------------------------------------

/**
 * The fourth range kind, and the one the other three could not express: a pair
 * of bounds that only sometimes applies.
 *
 * A span always applies, so saying "leave this alone" with one means finding a
 * value that happens to mean nothing - and then the generator cannot be asked
 * for that value. The switch says it outright instead.
 */
test('a gated range declares a pair of bounds and a switch that is off', () => {
    const range = gated(100, 7000, 900, 2400);

    assert.equal(range.kind, 'gated');
    assert.equal(range.low, 100);
    assert.equal(range.high, 7000);
    assert.deepEqual(range.default, { on: false, range: [900, 2400] });
});

// Off by default is what lets a range be added to an element without moving
// any world already described by a preset written before it existed.
test('a gated range resolves to off and its declared bounds when nothing asks', () => {
    const element = { ranges: { length: gated(100, 7000, 900, 2400) } };

    assert.deepEqual(resolveConfig(element, {}), { length: { on: false, range: [900, 2400] } });
    assert.deepEqual(resolveConfig(element, { length: undefined }),
        { length: { on: false, range: [900, 2400] } });
});

test('a gated range is clamped and uncrossed the way a span is', () => {
    const element = { ranges: { length: gated(100, 7000, 900, 2400) } };

    assert.deepEqual(resolveConfig(element, { length: { on: true, range: [0, 99999] } }),
        { length: { on: true, range: [100, 7000] } }, 'neither end leaves what was declared');

    assert.deepEqual(resolveConfig(element, { length: { on: true, range: [2400, 900] } }),
        { length: { on: true, range: [900, 2400] } }, 'and a pair handed over backwards is read');

    assert.deepEqual(resolveConfig(element, { length: { on: true, range: ['x', undefined] } }),
        { length: { on: true, range: [900, 2400] } }, 'a bound that is not a number falls back');
});

/**
 * Held against a span rather than written out twice, because the two kinds are
 * two bounds each and should be clamped by one piece of code. Pinned as the
 * comparison it is: a second clamp written beside the first would pass a test
 * that listed the answers and fail this one the day the two drifted - which
 * includes the corners nobody would think to list, like a `null` bound reading
 * as the 0 it converts to rather than as nothing at all.
 */
test('a gated range and a span answer the same question the same way', () => {
    const asSpan  = { ranges: { h: span(100, 7000, 900, 2400) } };
    const asGated = { ranges: { h: gated(100, 7000, 900, 2400) } };

    for (const pair of [
        [0, 99999], [2400, 900], ['x', undefined], ['x', null], [100, 100], [7000, 1],
        [-5, 5], [NaN, 3000], [1200, 1200]
    ]) {
        assert.deepEqual(
            resolveConfig(asGated, { h: { on: true, range: pair } }).h.range,
            resolveConfig(asSpan, { h: pair }).h,
            `${JSON.stringify(pair)} should clamp the same whichever kind holds it`);
    }
});

test('a bare pair of bounds means the gate is on, because naming them asks for them', () => {
    const element = { ranges: { length: gated(100, 7000, 900, 2400) } };

    assert.deepEqual(resolveConfig(element, { length: [600, 1800] }),
        { length: { on: true, range: [600, 1800] } });

    assert.deepEqual(resolveConfig(element, { length: { on: true } }),
        { length: { on: true, range: [900, 2400] } },
        'and a gate thrown with no bounds beside it takes the declared ones');
});

// The gate is an answer rather than a value, so anything short of yes is no.
// A string, a 1, or a missing key all have to come out the same way, or a
// generator reading `config.length.on` branches on truthiness it was never
// handed.
test('the gate is held as an answer, so only a yes turns it on', () => {
    const element = { ranges: { length: gated(100, 7000, 900, 2400) } };

    for (const given of [true]) {
        assert.equal(resolveConfig(element, { length: { on: given } }).length.on, true);
    }

    for (const given of [false, 1, 'yes', 'true', null, 0, undefined]) {
        const held = resolveConfig(element, { length: { on: given } }).length.on;
        assert.equal(held, false, `an \`on\` of ${JSON.stringify(given)} is not a yes`);
        assert.equal(typeof held, 'boolean', 'and what is held is always an answer');
    }
});

// --- What the mountain's footprint gates do to the ground ------------------

/** Every peak one mountain configuration lays, as the generator works them out. */
function peaksFrom(config = {}, seed = 7) {
    const element = getElement('mountain');
    const field   = createField({ size: 8000, segments: 24 });
    const laid    = [];

    // The peaks are not handed back, so they are read off the ground: a run
    // with the same seed and the same count lays them in the same places, and
    // the heights are what the footprint changes. Reading the field is what
    // makes these tests about the world rather than about the arithmetic.
    element.generate(field, resolveConfig(element, { count: 6, ...config }), createRandom(seed));
    for (let i = 0; i < field.count; i++) laid.push(field.height[i]);

    return laid;
}

// The reason the gates are read where they are read, and the one claim that
// makes them safe to add: a world that turns neither on is the world that was
// always drawn, to the last vertex. Each gate spends exactly the one draw the
// value it replaces spent, so the stream is the same length either way.
test('with both gates off a mountain is the mountain the simulator always drew', () => {
    const always = peaksFrom({});

    assert.deepEqual(peaksFrom({ length: { on: false, range: [200, 300] } }), always,
        'bounds set behind a switch that is off change nothing');
    assert.deepEqual(peaksFrom({ width: { on: false, range: [200, 300] } }), always,
        'on either gate');
    assert.ok(always.some(height => height > 0), 'and the test is reading real ground');
});

test('the width gate replaces the radius the footprint was taken from', () => {
    const wide   = peaksFrom({ width: { on: true, range: [2800, 3000] } });
    const narrow = peaksFrom({ width: { on: true, range: [150, 200] } });

    const spread = (heights) => heights.filter(height => height > 1).length;

    assert.ok(spread(wide) > spread(narrow),
        'a peak asked for a wide footprint covers more ground than one asked for a narrow one');
    assert.notDeepEqual(wide, peaksFrom({}), 'and neither is the ungated ground');
});

test('the length gate sets the long axis, independently of the width', () => {
    const base = { width: { on: true, range: [400, 400] } };

    const long  = peaksFrom({ ...base, length: { on: true, range: [3000, 3000] } });
    const short = peaksFrom({ ...base, length: { on: true, range: [400, 400] } });

    assert.notDeepEqual(long, short, 'the long axis is drawn where it was asked for');

    // A peak whose two axes are equal is the round bump, so the stretch the
    // pair comes to has to be exactly 1 rather than near it: this is the
    // assertion that catches a footprint read as a radius and a diameter, or
    // the two axes handed over the wrong way round.
    const round = peaksFrom({ ...base, girth: 0 });
    assert.deepEqual(short, round,
        'a length equal to the width is the round peak a girth of zero draws');
});

// Girth and the gates describe the same axis, so the one that was asked for
// outright has to win. Left the other way round a pilot who set a length would
// watch a random stretch override it.
test('a length asked for outright is not stretched by girth as well', () => {
    const asked = { length: { on: true, range: [2000, 2000] }, width: { on: true, range: [500, 500] } };

    assert.deepEqual(peaksFrom({ ...asked, girth: 0 }), peaksFrom({ ...asked, girth: 1 }),
        'with both axes given, girth has nothing left to say');

    // And with only the width given it still does, because the long axis is
    // then the one the generator is still working out for itself.
    const widthOnly = { width: { on: true, range: [500, 500] } };
    assert.notDeepEqual(peaksFrom({ ...widthOnly, girth: 0 }), peaksFrom({ ...widthOnly, girth: 1 }));
});

/**
 * The ground a seeded mountain run lays, as one value.
 *
 * Recorded rather than worked out, because the claim is about history: the
 * footprint gates were added to an element every preset already places, and the
 * only way to say "no world moved" is to hold the ground against what it was
 * before they existed. A test that compares two runs of the current code
 * instead passes on any change that moves both of them, which is every change
 * to the order the values are drawn in - and the order is exactly what has to
 * hold, because each gate is read in place of the one draw the value it
 * replaces spent.
 *
 * It fails loudly on purpose. If the generator is deliberately changed, this
 * is the test that says which worlds went with it.
 */
const MOUNTAIN_GROUND = 'ebc57bd333deb39f';

function groundFingerprint(config = {}, seed = 7) {
    const element = getElement('mountain');
    const field   = createField({ size: 8000, segments: 24 });

    element.generate(field, resolveConfig(element, config), createRandom(seed));

    const digest = createHash('sha256');
    digest.update(Buffer.from(field.height.buffer, field.height.byteOffset, field.height.byteLength));
    return digest.digest('hex').slice(0, 16);
}

test('the ground a seeded mountain lays is the ground it laid before the gates existed', () => {
    assert.equal(groundFingerprint({ count: 6 }), MOUNTAIN_GROUND,
        'a world placed by a preset written before the footprint gates has to be '
      + 'the same world now: every gate is off by default, and each one spends '
      + 'exactly the draw the value it replaces spent, so the stream is the same '
      + 'length and every peak is laid in the same place');

    // And the gates being off has to be the whole of why, rather than the
    // defaults happening to agree with it: turning one on moves the ground.
    assert.notEqual(groundFingerprint({ count: 6, width: { on: true, range: [150, 200] } }),
        MOUNTAIN_GROUND, 'a gate thrown is a different world, or the gate does nothing');
    assert.notEqual(groundFingerprint({ count: 6, length: { on: true, range: [5000, 6000] } }),
        MOUNTAIN_GROUND);
});
