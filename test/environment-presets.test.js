import test from 'node:test';
import assert from 'node:assert/strict';
import {
    ENVIRONMENTS, DEFAULT_ENVIRONMENT_ID, BUILDER_ENVIRONMENTS, BLANK_CANVAS_ID,
    getEnvironment, environmentIds, isEnvironmentId, buildEnvironment
} from '../js/environment/presets.js';
import { isElementId, DEFAULT_SIZE, DEFAULT_SEGMENTS } from '../js/environment/elements.js';

// Every preset is built at a coarser resolution than the simulator flies, so
// the suite checks the same worlds without spending a second a piece on them.
const build = (environment) => buildEnvironment(environment, { size: 4000, segments: 40 });

test('there are five environments to pick between', () => {
    assert.equal(ENVIRONMENTS.length, 5);
    assert.deepEqual(environmentIds(), ENVIRONMENTS.map(environment => environment.id));
    assert.equal(new Set(environmentIds()).size, 5, 'two worlds answering to one id is one too many');
});

test('every environment can be named, described, and reproduced', () => {
    for (const environment of ENVIRONMENTS) {
        assert.ok(environment.label.length > 0, `${environment.id} needs a label for the menu`);
        assert.ok(environment.description.length > 0, `${environment.id} needs a line saying what it is`);
        assert.equal(Number.isFinite(environment.seed), true, `${environment.id} needs a seed`);
        assert.ok(environment.elements.length > 0, `${environment.id} is an empty world`);
    }
});

test('every environment is assembled out of elements that exist', () => {
    for (const environment of ENVIRONMENTS) {
        for (const placement of environment.elements) {
            assert.equal(isElementId(placement.type), true,
                `${environment.id} places a "${placement.type}", which is not an element`);
        }
    }
});

test('the default environment is one of the five', () => {
    assert.equal(isEnvironmentId(DEFAULT_ENVIRONMENT_ID), true);
    assert.equal(getEnvironment(DEFAULT_ENVIRONMENT_ID).id, DEFAULT_ENVIRONMENT_ID);
});

test('a world nothing answers to falls back to the one a first flight gets', () => {
    assert.equal(getEnvironment('atlantis').id, DEFAULT_ENVIRONMENT_ID);
    assert.equal(getEnvironment().id, DEFAULT_ENVIRONMENT_ID);
    assert.equal(isEnvironmentId('atlantis'), false);
});

test('every environment builds ground that can be flown over', () => {
    for (const environment of ENVIRONMENTS) {
        const field = build(environment);

        assert.equal(field.height.length, field.count);
        for (let i = 0; i < field.count; i++) {
            assert.equal(Number.isFinite(field.height[i]), true,
                `${environment.id} has a vertex with no height at ${i}`);
        }
    }
});

test('every environment is painted all over, in colours a renderer can use', () => {
    for (const environment of ENVIRONMENTS) {
        const field = build(environment);

        for (let i = 0; i < field.color.length; i++) {
            const channel = field.color[i];
            assert.ok(channel >= 0 && channel <= 1,
                `${environment.id} has a colour channel of ${channel} at ${i}`);
        }
        assert.ok([...field.color].some(channel => channel > 0), `${environment.id} is unpainted`);
    }
});

test('no two environments are the same world under two names', () => {
    const shapes = ENVIRONMENTS.map(environment => [...build(environment).height].join(','));
    assert.equal(new Set(shapes).size, ENVIRONMENTS.length);
});

test('an environment built twice is the same world twice', () => {
    for (const environment of ENVIRONMENTS) {
        assert.deepEqual([...build(environment).height], [...build(environment).height],
            `${environment.id} is a different place every time it is flown`);
    }
});

test('the ground has relief to fly over rather than being a flat sheet', () => {
    for (const environment of ENVIRONMENTS) {
        const heights = [...build(environment).height];
        const spread = Math.max(...heights) - Math.min(...heights);
        assert.ok(spread > 10, `${environment.id} is flat, with ${spread} units of relief`);
    }
});

test('an environment built at the simulator size fills the field it is flown on', () => {
    const field = buildEnvironment(getEnvironment(), { size: DEFAULT_SIZE, segments: 20 });
    assert.equal(field.size, DEFAULT_SIZE);
    assert.equal(field.segments, 20);
    assert.notEqual(DEFAULT_SEGMENTS, undefined);
});

// --- The canvas the builder starts from nothing on -------------------------

/**
 * Blank Canvas sits beside `ENVIRONMENTS` rather than in it.
 *
 * Everything in that list is a world the settings panel offers to fly, and is
 * named by `test/docs.test.js` and `test/site.test.js` as one. Flat green
 * country is a poor thing to fly over - it is a thing to build on - so the
 * builder's list is the five plus the one and the panel's is still the five.
 */
test('the blank canvas is beside the five rather than one of them', () => {
    assert.equal(ENVIRONMENTS.length, 5, 'the worlds to fly are still the five');
    assert.equal(BUILDER_ENVIRONMENTS.length, 6, 'and the canvases to build on are those plus one');
    assert.deepEqual(BUILDER_ENVIRONMENTS.slice(0, 5), ENVIRONMENTS,
        'in the order the registry already holds them');
    assert.equal(BUILDER_ENVIRONMENTS[5].id, BLANK_CANVAS_ID);

    assert.equal(isEnvironmentId(BLANK_CANVAS_ID), false, 'the panel does not offer it');
    assert.ok(!environmentIds().includes(BLANK_CANVAS_ID), 'and the documentation is not held to it');
});

// It is still a world, so everything that generates one has to be able to find
// it by name - which is the one thing being beside the list could have cost.
test('the blank canvas is a world something can be generated from', () => {
    assert.equal(getEnvironment(BLANK_CANVAS_ID).id, BLANK_CANVAS_ID);

    const canvas = getEnvironment(BLANK_CANVAS_ID);
    assert.ok(canvas.label.length > 0, 'it needs a label for the card');
    assert.ok(canvas.description.length > 0, 'and a line saying what it is');
    assert.equal(Number.isFinite(canvas.seed), true, 'and a seed, so it is the same canvas every time');
});

/**
 * Flat, and ground rather than a plane.
 *
 * `maxHeight` bottoms out at 50 and `scale` at 0.5, so this is the least shape
 * the base can be given: a roll of at most 50 units across 16000. It is flat at
 * anything the aircraft flies at and still has a normal to catch the light,
 * which a sheet with no relief in it would not.
 */
test('the blank canvas is flat ground rather than a flat sheet', () => {
    const field = build(getEnvironment(BLANK_CANVAS_ID));
    const heights = [...field.height];
    const spread = Math.max(...heights) - Math.min(...heights);

    assert.ok(spread > 0, 'it is ground, with some relief to light');
    assert.ok(spread <= 50, `and flat, with ${spread} units of it`);
});

test('the blank canvas has nothing on it but the grass over the ground', () => {
    const canvas = getEnvironment(BLANK_CANVAS_ID);

    assert.deepEqual(canvas.elements.map(placement => placement.type), ['grass']);

    const field = build(canvas);
    assert.equal(field.runways.length, 0, 'nothing is prepared to arrive on');
    assert.equal(field.water, null, 'and there is nothing to fly it round');
    assert.ok([...field.color].some(channel => channel > 0), 'the ground is painted');
});
