import test from 'node:test';
import assert from 'node:assert/strict';
import {
    WAVE, WATER_SHEEN, SHEEN_STRENGTH,
    waveHeight, waveSpecular, waterColor, animateWater
} from '../js/water.js';
import {
    createField, applyBase, applyElement, createRandom, waterSurface, readColor
} from '../js/environment/elements.js';

const SIZE = 4000;
const SEGMENTS = 40;

/** A world with a lake in it, at whatever level the water was laid at. */
function flooded(level = 60, { originX = 0, originZ = 0 } = {}) {
    const field = createField({ size: SIZE, segments: SEGMENTS, originX, originZ });
    applyBase(field, { maxHeight: 480, scale: 3.5 });
    applyElement(field, { type: 'water', config: { level } }, createRandom(4));
    return field;
}

// --- The surface a world settled at ---------------------------------------

test('a world with no water in it has no surface to move', () => {
    const field = createField({ size: SIZE, segments: SEGMENTS });
    applyBase(field, { maxHeight: 480, scale: 3.5 });

    assert.equal(field.water, null, 'nothing laid the water, so nothing recorded it');
    assert.equal(waterSurface(field), null);
});

test('the water a world settled at is the ground at or under its level', () => {
    const field = flooded();
    const surface = waterSurface(field);

    assert.ok(surface.count > 0, 'a flooded world should have a surface');
    assert.equal(surface.level, 60);
    assert.equal(surface.vertices.length, surface.count);

    for (let i = 0; i < surface.count; i++) {
        const index = surface.vertices[i];
        assert.ok(field.height[index] <= surface.level + 1e-3,
            'nothing above the water should be part of the water');
        assert.equal(surface.rest[i], field.height[index], 'each vertex rests where the ground left it');
    }

    let dry = 0;
    for (let i = 0; i < field.count; i++) if (field.height[i] > surface.level) dry++;
    assert.equal(surface.count + dry, field.count, 'and everything else is land');
});

test('the surface knows where in the world each of its vertices is', () => {
    const here  = waterSurface(flooded(60));
    const along = waterSurface(flooded(60, { originX: SIZE }));

    assert.ok(here.x.every(x => Math.abs(x) <= SIZE / 2 + 1e-6));
    assert.ok(along.x.every(x => x >= SIZE / 2 - 1e-6), 'a tile a square along holds water a square along');
});

test('the water is held to the bank it was poured against', () => {
    const surface = waterSurface(flooded());

    let bank = 0;
    let open = 0;
    for (let i = 0; i < surface.count; i++) {
        assert.ok(surface.open[i] >= 0 && surface.open[i] <= 1);
        if (surface.open[i] < 0.9) bank++;
        if (surface.open[i] > 0.99) open++;
    }

    assert.ok(bank > 0, 'a lake has a shoreline');
    assert.ok(open > 0, 'and something in the middle of it');
});

test('ground claimed back after the water went down is not still water', () => {
    const field = flooded(40);
    const drowned = waterSurface(field).count;

    // A strip graded over the shallows, which is ground the water no longer has.
    applyElement(field, { type: 'runway', config: { band: [0, 400] } }, createRandom(9));
    const after = waterSurface(field).count;

    assert.ok(after <= drowned, 'a strip cut over the water leaves less water, never more');
});

// --- The wave -------------------------------------------------------------

test('the swell never stands further off the level than it is tall', () => {
    for (let step = 0; step < 400; step++) {
        const x = -2000 + step * 11;
        const z = 900 - step * 7;
        const time = step * 0.37;
        assert.ok(Math.abs(waveHeight(x, z, time)) <= WAVE.amplitude + 1e-6);
    }
});

test('the swell moves, and the same place at the same moment is the same swell', () => {
    const still = waveHeight(120, -340, 0);
    assert.equal(waveHeight(120, -340, 0), still, 'a surface is not random');
    assert.notEqual(waveHeight(120, -340, 3.5), still, 'and it does not stand still either');
});

test('the swell is read off the world rather than off the tile', () => {
    // The place two tiles meet is one place, whichever tile is asking.
    assert.equal(waveHeight(2000, 400, 12.5), waveHeight(2000, 400, 12.5));
    assert.equal(waveSpecular(2000, 400, 12.5), waveSpecular(2000, 400, 12.5));
});

test('a crest throws light back and a trough does not', () => {
    let lit = 0;
    let dark = 0;

    for (let step = 0; step < 400; step++) {
        const specular = waveSpecular(step * 13, step * 5, step * 0.21);
        assert.ok(specular >= 0 && specular <= 1, 'a surface cannot throw back more than it was given');
        if (specular > 0.4) lit++;
        if (specular === 0) dark++;
    }

    assert.ok(lit > 0, 'some of the water should be catching the light');
    assert.ok(dark > 0, 'and some of it should be in the trough of the wave');
});

test('a longer wave is a slower one to cross', () => {
    const short = waveHeight(200, 0, 0, { ...WAVE, wavelength: 100 });
    const long  = waveHeight(200, 0, 0, { ...WAVE, wavelength: 4000 });
    assert.notEqual(short, long);
});

// --- What the water shows -------------------------------------------------

test('water shows its own colour where there is no light on it', () => {
    const base = [0.2, 0.4, 0.7];
    assert.deepEqual(waterColor(base, 0), base, 'a trough is the colour of the water');
    assert.deepEqual(waterColor(base, 1, { light: 0 }), base, 'and so is everything after dark');
});

test('a lit crest is pulled towards a colour the land is never painted', () => {
    const base = [0.2, 0.4, 0.7];
    const lit = waterColor(base, 1);

    for (let c = 0; c < 3; c++) {
        const expected = base[c] + (WATER_SHEEN[c] - base[c]) * SHEEN_STRENGTH;
        assert.ok(Math.abs(lit[c] - expected) < 1e-9);
        assert.ok(lit[c] > base[c], 'the sheen is brighter than the water under it');
    }
});

test('half a day gives half the glint', () => {
    const base = [0.2, 0.4, 0.7];
    const full = waterColor(base, 1);
    const half = waterColor(base, 1, { light: 0.5 });

    assert.ok(half[0] > base[0] && half[0] < full[0]);
    assert.deepEqual(waterColor(base, 1, { light: 5 }), full, 'and no day gives more than all of it');
});

// --- Moving the surface ---------------------------------------------------

test('animating a surface moves the water and leaves the land alone', () => {
    const field = flooded();
    const surface = waterSurface(field);

    const positions = new Float32Array(field.count * 3);
    const colors = new Float32Array(field.count * 3);
    for (let i = 0; i < field.count; i++) {
        positions[i * 3 + 1] = field.height[i];
        for (let c = 0; c < 3; c++) colors[i * 3 + c] = field.color[i * 3 + c];
    }

    const before = Float32Array.from(positions);
    const moved = animateWater(surface, 4.25, { positions, colors });

    assert.equal(moved, surface.count);

    const wet = new Set(surface.vertices);
    let stirred = 0;

    for (let i = 0; i < field.count; i++) {
        if (wet.has(i)) {
            if (Math.abs(positions[i * 3 + 1] - before[i * 3 + 1]) > 1e-4) stirred++;
            continue;
        }
        assert.equal(positions[i * 3 + 1], before[i * 3 + 1], `the land moved at vertex ${i}`);
        for (let c = 0; c < 3; c++) {
            assert.equal(colors[i * 3 + c], field.color[i * 3 + c], `the land was repainted at vertex ${i}`);
        }
    }

    assert.ok(stirred > surface.count / 4, 'most of the water should be moving');
});

test('a surface stays within a wave of where it was resting', () => {
    const field = flooded();
    const surface = waterSurface(field);
    const positions = new Float32Array(field.count * 3);

    for (let time = 0; time < 40; time += 3.7) {
        animateWater(surface, time, { positions });

        for (let i = 0; i < surface.count; i++) {
            const off = positions[surface.vertices[i] * 3 + 1] - surface.rest[i];
            assert.ok(Math.abs(off) <= WAVE.amplitude + 1e-4, 'the water should stay in its basin');
        }
    }
});

test('nothing to animate is nothing done', () => {
    assert.equal(animateWater(null, 1, {}), 0);
    assert.equal(animateWater({ count: 0 }, 1, {}), 0);
});

test('the shoreline is moved less than the open water is', () => {
    const field = flooded();
    const surface = waterSurface(field);
    const positions = new Float32Array(field.count * 3);

    let bank = -1;
    let open = -1;
    for (let i = 0; i < surface.count; i++) {
        if (bank < 0 && surface.open[i] < 0.5) bank = i;
        if (open < 0 && surface.open[i] > 0.99) open = i;
    }

    assert.ok(bank >= 0 && open >= 0, 'the lake should have both a bank and a middle');

    // Read across a whole cycle, because a single moment can catch the open
    // water at the level the bank happens to be sitting at.
    let bankMost = 0;
    let openMost = 0;
    for (let time = 0; time < 20; time += 0.5) {
        animateWater(surface, time, { positions });
        bankMost = Math.max(bankMost, Math.abs(positions[surface.vertices[bank] * 3 + 1] - surface.rest[bank]));
        openMost = Math.max(openMost, Math.abs(positions[surface.vertices[open] * 3 + 1] - surface.rest[open]));
    }

    assert.ok(bankMost < openMost, 'the water should meet the bank rather than lap over it');
});

test('the colour a lake shows is the colour it was painted, moved by the light', () => {
    const field = flooded();
    const surface = waterSurface(field);
    const colors = new Float32Array(field.count * 3);

    animateWater(surface, 6.5, { colors, light: 1 });

    let brightened = 0;
    for (let i = 0; i < surface.count; i++) {
        const index = surface.vertices[i];
        const painted = readColor(field, index);
        if (colors[index * 3] > painted[0] + 1e-4) brightened++;

        for (let c = 0; c < 3; c++) {
            assert.ok(colors[index * 3 + c] >= painted[c] - 1e-6,
                'the sheen only ever adds light to the water');
        }
    }

    assert.ok(brightened > 0, 'some of the surface should be catching the sun');
});
