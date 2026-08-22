import test from 'node:test';
import assert from 'node:assert/strict';
import {
    ENVIRONMENTS, DEFAULT_ENVIRONMENT_ID,
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
