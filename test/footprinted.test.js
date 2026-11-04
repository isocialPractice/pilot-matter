import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createField, applyBase, applyElement, createRandom, cloneField, fieldX, fieldZ,
    readColor, ELEMENTS, DEFAULT_SIZE
} from '../js/environment/elements.js';
import { footprintWeight } from '../js/environment/footprints.js';
import { applyFootprintedElement } from '../js/environment/footprinted.js';
import { buildEnvironment, getEnvironment } from '../js/environment/presets.js';

const SIZE = 4000;
const SEGMENTS = 40;

/** A square of fBm ground with nothing on it yet, laid wherever it is asked to be. */
function ground({ originX = 0, originZ = 0 } = {}) {
    const field = createField({ size: SIZE, segments: SEGMENTS, originX, originZ });
    applyBase(field, { maxHeight: 480, scale: 3.5 });
    return field;
}

/**
 * Water raised over everything, which changes every vertex it is drawn over -
 * the ground under it is lifted to its level and painted - so where it reached
 * and where it did not can both be read off the field.
 */
const FLOOD = { type: 'water', config: { level: 600, flatten: 1 } };

const near = (a, b, within = 1e-3) => Math.abs(a - b) <= within;

test('a placement with no footprint is drawn exactly as it always was', () => {
    for (const placement of [FLOOD, { type: 'mountain', config: { count: 8 } }, { type: 'grass', config: { band: [0, 200] } }]) {
        const plain = ground();
        const through = ground();

        applyElement(plain, placement, createRandom(11));
        applyFootprintedElement(through, placement, createRandom(11));

        assert.deepEqual(through.height, plain.height, `${placement.type} should be the same ground`);
        assert.deepEqual(through.color, plain.color, `${placement.type} should be the same colour`);
    }
});

/**
 * The whole of the compositor in one reading: where the footprint weighs 1 the
 * field is the element drawn across everything, where it weighs 0 it is the
 * ground as it was, and across the feather it is somewhere between the two.
 */
test('inside the footprint is the whole element, outside is the ground as it was', () => {
    const footprint = { kind: 'disc', x: 300, z: -400, radius: 900, feather: 240 };
    const before = ground();
    const whole  = ground();
    const drawn  = ground();

    applyElement(whole, FLOOD, createRandom(3));
    applyFootprintedElement(drawn, { ...FLOOD, footprint }, createRandom(3));

    let inside = 0, outside = 0, between = 0;
    for (let i = 0; i < drawn.count; i++) {
        const weight = footprintWeight(footprint, fieldX(drawn, i), fieldZ(drawn, i), SIZE);

        if (weight === 1) {
            inside++;
            assert.ok(near(drawn.height[i], whole.height[i]), `vertex ${i} is covered and should be the element`);
            assert.deepEqual(readColor(drawn, i), readColor(whole, i));
        } else if (weight === 0) {
            outside++;
            assert.equal(drawn.height[i], before.height[i], `vertex ${i} is outside and should be untouched`);
            assert.deepEqual(readColor(drawn, i), readColor(before, i));
        } else {
            between++;
            const low = Math.min(before.height[i], whole.height[i]);
            const high = Math.max(before.height[i], whole.height[i]);
            assert.ok(drawn.height[i] >= low - 1e-3 && drawn.height[i] <= high + 1e-3,
                `vertex ${i} in the feather should lie between the ground and the element`);
        }
    }

    assert.ok(inside > 0 && outside > 0 && between > 0,
        `the footprint should cover some, miss some and feather some: ${inside}, ${outside}, ${between}`);
});

test('the feather is a blend in proportion to the weight', () => {
    const footprint = { kind: 'disc', x: 0, z: 0, radius: 1200, feather: 800 };
    const before = ground();
    const whole  = ground();
    const drawn  = ground();

    applyElement(whole, FLOOD, createRandom(5));
    applyFootprintedElement(drawn, { ...FLOOD, footprint }, createRandom(5));

    for (let i = 0; i < drawn.count; i++) {
        const weight = footprintWeight(footprint, fieldX(drawn, i), fieldZ(drawn, i), SIZE);
        const expected = before.height[i] + (whole.height[i] - before.height[i]) * weight;
        assert.ok(near(drawn.height[i], expected), `vertex ${i} at weight ${weight}`);
    }
});

/**
 * The element is drawn whatever its footprint covers, so it takes from the
 * seeded stream exactly what it would have taken. Every placement after it is
 * laid out the same whether or not this one was clipped.
 */
test('a clipped element takes from the seeded stream what an unclipped one does', () => {
    const placement = { type: 'mountain', config: { count: 9 } };

    for (const footprint of [{ kind: 'disc', radius: 400 }, { kind: 'disc', radius: 0 }, { kind: 'cloud' }]) {
        const plainStream = createRandom(21);
        const clippedStream = createRandom(21);

        applyElement(ground(), placement, plainStream);
        applyFootprintedElement(ground(), { ...placement, footprint }, clippedStream);

        assert.equal(clippedStream(), plainStream(), `after a footprint of ${JSON.stringify(footprint)}`);
    }
});

test('a footprint nobody can read draws nothing', () => {
    const before = ground();
    const drawn = ground();

    applyFootprintedElement(drawn, { ...FLOOD, footprint: { kind: 'disc', radius: 0 } }, createRandom(2));

    assert.deepEqual(drawn.height, before.height);
    assert.deepEqual(drawn.color, before.color);
});

/**
 * The sea's level is what a renderer animates, across every vertex under it on
 * the whole tile. A drawn body raising it would flood the tile below its line,
 * so a footprinted water placement leaves the level as it found it.
 */
test('drawn water leaves the sea\'s level where it was', () => {
    const sea = ground();
    applyElement(sea, { type: 'water', config: { level: 4 } }, createRandom(1));
    applyFootprintedElement(sea, { type: 'water', config: { level: 300 }, footprint: { kind: 'disc', radius: 600 } }, createRandom(1));
    assert.deepEqual(sea.water, { level: 4 }, 'the sea is still at 4');

    const dry = ground();
    applyFootprintedElement(dry, { type: 'water', config: { level: 300 }, footprint: { kind: 'disc', radius: 600 } }, createRandom(1));
    assert.equal(dry.water, null, 'and a tile with no sea is not given one by a drawn body');
});

test('a strip cut inside a footprint is recorded on the field it was cut into', () => {
    const big = () => {
        const field = createField({ size: DEFAULT_SIZE, segments: 60 });
        applyBase(field, { maxHeight: 220, scale: 2.2 });
        return field;
    };
    const runway = { type: 'runway', config: {} };

    const plain = big();
    applyElement(plain, runway, createRandom(8));
    assert.ok(plain.runways.length > 0, 'the strip should find somewhere to go');

    const drawn = big();
    applyFootprintedElement(drawn, { ...runway, footprint: { kind: 'rect', width: DEFAULT_SIZE * 2, depth: DEFAULT_SIZE * 2 } }, createRandom(8));
    assert.deepEqual(drawn.runways, plain.runways, 'and be recorded where the flight model asks for it');
});

test('drawing on a copy leaves the field it was copied from alone', () => {
    const field = ground();
    field.runways.push({ x: 1, z: 2 });
    field.water = { level: 4 };

    const draft = cloneField(field);
    draft.height[0] = 9999;
    draft.color[0] = 1;
    draft.runways.push({ x: 3, z: 4 });
    draft.water.level = 500;

    assert.notEqual(field.height[0], 9999);
    assert.notEqual(field.color[0], 1);
    assert.equal(field.runways.length, 1);
    assert.equal(field.water.level, 4);
    assert.equal(draft.size, field.size, 'and the copy is the same square');
    assert.equal(draft.originX, field.originX);
});

/**
 * The point of compositing a copy rather than gating each generator's writes:
 * nothing in the registry knows a footprint exists, so an element added later
 * is clippable without having been written to be.
 */
test('no generator in the registry reads a footprint', () => {
    for (const element of ELEMENTS) {
        // Read as code: the mountain's comments say "footprint" of the ellipse
        // a peak is drawn over, which is its own shape and not a placement's.
        const code = element.generate.toString()
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\/\/.*$/gm, '');
        assert.ok(!/footprint/.test(code), `${element.id} reads a footprint`);
    }
});

test('a world built from a footprinted placement draws it only where it reaches', () => {
    const blank = getEnvironment('blank-canvas');
    const footprint = { kind: 'rect', x: -800, z: 600, width: 1400, depth: 900, angle: 0.4, corner: 200, feather: 0 };

    const bare  = buildEnvironment(blank, { size: SIZE, segments: SEGMENTS, elements: [] });
    const built = buildEnvironment(blank, { size: SIZE, segments: SEGMENTS, elements: [{ ...FLOOD, footprint }] });

    let raised = 0;
    for (let i = 0; i < built.count; i++) {
        const weight = footprintWeight(footprint, fieldX(built, i), fieldZ(built, i), SIZE);
        if (weight === 1) {
            assert.ok(near(built.height[i], 600), `vertex ${i} is inside and should be flooded`);
            raised++;
        } else if (weight === 0) {
            assert.equal(built.height[i], bare.height[i], `vertex ${i} is outside and should be bare ground`);
        }
    }
    assert.ok(raised > 0);
});
