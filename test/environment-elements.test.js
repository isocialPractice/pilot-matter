import test from 'node:test';
import assert from 'node:assert/strict';
import {
    ELEMENTS, ELEMENTS_BY_ID, ELEMENT_ORDER,
    DEFAULT_SIZE, DEFAULT_SEGMENTS,
    createField, fieldX, fieldZ, paint, readColor, mixColor, slopeAt, sampleHeight,
    createRandom, pick, span, scalar, gradient, blend,
    resolveConfig, applyBase, applyElement, orderPlacements,
    getElement, isElementId, carveProfile
} from '../js/environment/elements.js';

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
            assert.ok(['span', 'scalar', 'gradient'].includes(range.kind),
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
