import test from 'node:test';
import assert from 'node:assert/strict';
import {
    ELEMENT_ORDER,
    createField,
    createRandom,
    applyElement,
    resolveConfig,
    getElement,
    sampleHeight,
    slopeAt,
    fieldX,
    fieldZ,
    runwayDirection,
    runwayPoint,
    runwayOffsets,
    isOnRunway,
    runwayThresholds,
    nearestRunway
} from '../js/environment/elements.js';
import {
    ENVIRONMENTS, MODE_ENVIRONMENTS, buildEnvironment, environmentElements
} from '../js/environment/presets.js';

const runway = getElement('runway');

/** A world with some relief in it, for the strip to have to find ground in. */
function rolling({ segments = 96, size = 16000 } = {}) {
    const field = createField({ size, segments });
    for (let i = 0; i < field.count; i++) {
        const x = fieldX(field, i), z = fieldZ(field, i);
        field.height[i] = 120
            + 90 * Math.sin(x / 2600) * Math.cos(z / 3100)
            + 40 * Math.sin((x + z) / 900);
    }
    return field;
}

function place(field, config = {}, seed = 7) {
    return applyElement(field, { type: 'runway', config }, createRandom(seed));
}

// --- Reading a strip -------------------------------------------------------

test('a strip runs on the bearing it was laid on, counted from north', () => {
    assert.deepEqual(round(runwayDirection(0)),   { alongX: 0,  alongZ: 1  }, 'north is +Z');
    assert.deepEqual(round(runwayDirection(90)),  { alongX: 1,  alongZ: 0  }, 'east is +X');
    assert.deepEqual(round(runwayDirection(180)), { alongX: 0,  alongZ: -1 });
    assert.deepEqual(round(runwayDirection(270)), { alongX: -1, alongZ: 0  });
});

test('a place on a strip and a place in the world are the same reading twice', () => {
    const strip = { x: 400, z: -900, ...runwayDirection(35), length: 3000, width: 300 };

    for (const [along, across] of [[0, 0], [900, 60], [-1200, -140], [1500, 150]]) {
        const at = runwayPoint(strip, along, across);
        const back = runwayOffsets(strip, at.x, at.z);
        assert.ok(Math.abs(back.along - along) < 1e-9, 'the run back along should come back');
        assert.ok(Math.abs(back.across - across) < 1e-9, 'and so should the run across');
    }
});

test('the strip is the paved rectangle and nothing beyond it', () => {
    const strip = { x: 0, z: 0, ...runwayDirection(0), length: 2000, width: 200 };

    assert.equal(isOnRunway(strip, 0, 0), true, 'the middle of it');
    assert.equal(isOnRunway(strip, 99, 999), true, 'a corner of it');
    assert.equal(isOnRunway(strip, 101, 0), false, 'a step off the side');
    assert.equal(isOnRunway(strip, 0, 1001), false, 'a step past the end');
    assert.equal(isOnRunway(strip, 101, 0, 20), true, 'unless the margin reaches it');
    assert.equal(isOnRunway(null, 0, 0), false, 'and a world with no strip has nowhere on one');
});

test('a strip has two ends, each with the bearing a takeoff from it runs on', () => {
    const strip = { x: 0, z: 0, heading: 90, ...runwayDirection(90), length: 2000, width: 200 };
    const [first, second] = runwayThresholds(strip);

    assert.ok(Math.abs(first.x + 1000) < 1e-9, 'the first end is a half length back down the strip');
    assert.equal(first.heading, 90);
    assert.ok(Math.abs(second.x - 1000) < 1e-9);
    assert.equal(second.heading, 270, 'and the other end is flown the opposite way');

    // Rolling from the first threshold on its own bearing runs onto the strip.
    const rolled = runwayPoint(strip, -1000 + 300);
    assert.equal(isOnRunway(strip, rolled.x, rolled.z), true);
});

test('the nearest strip is the nearest one, and no strip at all is null', () => {
    const near = { x: 100, z: 0 };
    const far  = { x: 6000, z: 0 };

    assert.equal(nearestRunway([near, far], 0, 0), near);
    assert.equal(nearestRunway([near, far], 5900, 0), far);
    assert.equal(nearestRunway([], 0, 0), null);
    assert.equal(nearestRunway(undefined, 0, 0), null);
});

// --- Building one ----------------------------------------------------------

test('the runway is an element like any other, with ranges and a generator', () => {
    assert.equal(runway.id, 'runway');
    assert.equal(typeof runway.generate, 'function');
    for (const name of ['length', 'width', 'heading', 'band', 'apron']) {
        assert.ok(runway.ranges[name], `a strip should declare its ${name}`);
    }
    assert.ok(ELEMENT_ORDER.includes('runway'), 'and have a place in the pipeline');
});

test('a strip is laid out inside the ranges it was configured with', () => {
    const field = rolling();
    const strip = place(field, { length: [2000, 2200], width: [240, 260], heading: [90, 90] });

    assert.ok(strip.length >= 2000 && strip.length <= 2200);
    assert.ok(strip.width >= 240 && strip.width <= 260);
    assert.ok(Math.abs(strip.heading - 90) < 1e-9, 'a heading range of one bearing is that bearing');
});

test('the field carries the strips cut into it, and nothing when none were', () => {
    const bare = rolling();
    assert.deepEqual(bare.runways, [], 'a fresh field has no strips on it');

    const field = rolling();
    place(field);
    assert.equal(field.runways.length, 1);
    assert.equal(field.runways[0], nearestRunway(field.runways, 0, 0));
});

test('the paved strip comes out level, whatever the ground it was cut into', () => {
    const field = rolling({ segments: 200 });
    const strip = place(field);

    // Every vertex the pavement covers, rather than a bilinear reading between
    // them: what the element writes is heights at vertices, and a sample taken
    // in the outermost cell is a blend with the apron beyond it.
    let paved = 0;
    for (let i = 0; i < field.count; i++) {
        if (!isOnRunway(strip, fieldX(field, i), fieldZ(field, i))) continue;
        assert.ok(Math.abs(field.height[i] - strip.elevation) < 1e-3,
            'a vertex of the pavement should sit at the height the site was measured at');
        paved++;
    }

    assert.ok(paved > 40, `the strip should cover ground to land on, and it covers ${paved} vertices`);
    assert.ok(Math.abs(sampleHeight(field, strip.x, strip.z) - strip.elevation) < 1e-3,
        'and the strip reads as its own height under the wheels');
});

test('the strip is built on the flattest ground the site search found', () => {
    const field = rolling();
    const before = rolling();
    const strip = place(field);

    // Measured on the untouched copy: the point is where the site was chosen,
    // not what grading afterwards did to it.
    const along = [-0.5, -0.25, 0, 0.25, 0.5].map(t => {
        const at = runwayPoint(strip, t * strip.length);
        return sampleHeight(before, at.x, at.z);
    });
    const spread = Math.max(...along) - Math.min(...along);

    assert.ok(spread < 60, `the ground under the strip rolls ${spread.toFixed(0)} units`);
    assert.ok(spread <= strip.spread + 1e-6, 'and the site knows how level it measured');
});

test('the ground either side eases back rather than ending in a cliff', () => {
    const field = rolling();
    const strip = place(field, { apron: 1.2 });

    let steepest = 0;
    for (let i = 0; i < field.count; i++) {
        const { along, across } = runwayOffsets(strip, fieldX(field, i), fieldZ(field, i));
        if (Math.abs(along) > strip.length || Math.abs(across) > strip.width * 4) continue;
        steepest = Math.max(steepest, slopeAt(field, i));
    }

    assert.ok(steepest < 1.4, `the apron rises at ${steepest.toFixed(2)}, which is a wall`);
});

test('the strip is painted so it can be picked out from the air', () => {
    const field = rolling();
    const strip = place(field);

    const middle = colorAt(field, runwayPoint(strip, 0, 0));
    const shoulder = colorAt(field, runwayPoint(strip, 0, strip.width * 0.46));
    const off = colorAt(field, runwayPoint(strip, 0, strip.width * 6));

    assert.ok(brightness(middle) < brightness(shoulder),
        'the shoulder stripe should read paler than the pavement it edges');
    assert.ok(Math.abs(brightness(middle) - brightness(off)) > 0.05,
        'and the pavement should not read as the ground around it');
});

test('a strip is asked for or it is not there', () => {
    for (const environment of [...ENVIRONMENTS, ...MODE_ENVIRONMENTS]) {
        const bare = buildEnvironment(environment, { segments: 80 });
        assert.equal(bare.runways.length, 0, `${environment.id} should have no strip unless asked`);

        const withOne = buildEnvironment(environment, { segments: 80, runway: true });
        assert.equal(withOne.runways.length, 1, `${environment.id} should carry the strip it was asked for`);
    }
});

test('a preset that says what strip it wants gets that strip', () => {
    const environment = MODE_ENVIRONMENTS.find(preset => preset.runway);
    const asked = environmentElements(environment, true).at(-1);

    assert.equal(asked.type, 'runway');
    assert.deepEqual(asked.config.length, environment.runway.length,
        'the preset should be able to say how long a strip its world wants');

    // And the caller can say something different about it again.
    const over = environmentElements(environment, { length: [900, 900] }).at(-1);
    assert.deepEqual(over.config.length, [900, 900]);
});

test('a strip is never laid twice over the same world', () => {
    const environment = ENVIRONMENTS[0];
    const elements = environmentElements(
        { ...environment, elements: [...environment.elements, { type: 'runway', config: {} }] },
        true
    );
    assert.equal(elements.filter(placement => placement.type === 'runway').length, 1);
});

test('the strip stays inside the world it was cut into', () => {
    for (const environment of ENVIRONMENTS) {
        const field = buildEnvironment(environment, { segments: 80, runway: true });
        const strip = field.runways[0];
        const half = field.size / 2;

        for (const end of runwayThresholds(strip)) {
            assert.ok(Math.abs(end.x) <= half && Math.abs(end.z) <= half,
                `${environment.id} laid a strip with an end outside the world`);
        }
    }
});

test('a strip is built above the shoreline, where a landing is worth making', () => {
    for (const environment of ENVIRONMENTS) {
        const field = buildEnvironment(environment, { segments: 80, runway: true });
        const strip = field.runways[0];
        const water = environment.elements.find(placement => placement.type === 'water');
        const level = water?.config?.level ?? 0;

        assert.ok(strip.elevation > level,
            `${environment.id} put its strip at ${strip.elevation.toFixed(0)}, under water at ${level}`);
    }
});

test('the same world twice is the same strip twice', () => {
    const first  = buildEnvironment(ENVIRONMENTS[0], { segments: 80, runway: true }).runways[0];
    const second = buildEnvironment(ENVIRONMENTS[0], { segments: 80, runway: true }).runways[0];
    assert.deepEqual(first, second);

    const other = buildEnvironment(ENVIRONMENTS[0], { segments: 80, runway: true, seed: 4242 }).runways[0];
    assert.notDeepEqual(first, other, 'and a different seed is a different world, strip and all');
});

test('a configured strip is clamped into the ranges the element declares', () => {
    const config = resolveConfig(runway, { length: [10, 99999], width: [-40, 4000] });
    assert.ok(config.length[0] >= runway.ranges.length.low);
    assert.ok(config.length[1] <= runway.ranges.length.high);
    assert.ok(config.width[0] >= runway.ranges.width.low);
    assert.ok(config.width[1] <= runway.ranges.width.high);
});

test('a strip longer than the world it is asked for is refused rather than hung off the edge', () => {
    const field = createField({ size: 1200, segments: 24 });
    assert.equal(place(field, { length: [8000, 8000] }), null);
    assert.equal(field.runways.length, 0);
});

function colorAt(field, at) {
    const half = field.size / 2;
    const col = Math.round((at.x + half) / field.step);
    const row = Math.round((at.z + half) / field.step);
    const index = (row * field.stride + col) * 3;
    return [field.color[index], field.color[index + 1], field.color[index + 2]];
}

function brightness([r, g, b]) {
    return (r + g + b) / 3;
}

function round(direction) {
    return {
        alongX: Math.round(direction.alongX * 1e9) / 1e9 + 0,
        alongZ: Math.round(direction.alongZ * 1e9) / 1e9 + 0
    };
}
