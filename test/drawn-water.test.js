/**
 * Water drawn above the sea, Drawn water lies in the ground, and Drawn snow
 * settles where it is drawn - the water line kept a vertex at a time beside the
 * sea's one level, drawn water resting at the lowest bank of its stroke and cut
 * into the ground to it, and drawn snow's line put under its stroke with its
 * depth running in from the stroke's edge.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createField, cloneField, applyElement, waterSurface, clearRunwayGround, fieldX, fieldZ, readColor,
    getElement, RUNWAY_FREEBOARD
} from '../js/environment/elements.js';
import {
    applyFootprintedElement, settleFromFootprint, bankMeasure, strokeWays, WATER_SINK, SNOW_UNDER
} from '../js/environment/footprinted.js';
import { footprintSampler, placeFootprint, combineFootprints } from '../js/environment/footprints.js';
import { WAVE } from '../js/water.js';
import { panelRanges } from '../js/build-panel.js';

const SIZE = 8000;
const near = (a, b, within = 1e-3) => Math.abs(a - b) <= within;

/** A field whose ground is `height(x, z)` in the world's own coordinates. */
function ground(height, { originX = 0, originZ = 0, size = SIZE, segments = 100 } = {}) {
    const field = createField({ size, segments, originX, originZ });
    for (let i = 0; i < field.count; i++) field.height[i] = height(fieldX(field, i), fieldZ(field, i));
    return field;
}

/** The vertex of a field at a place in its own canvas frame. */
function vertexAt(field, x, z) {
    const col = Math.round((x + field.size / 2) / field.step);
    const row = Math.round((z + field.size / 2) / field.step);
    return row * field.stride + col;
}

function weightsOf(field, footprint) {
    const weigh = footprintSampler(footprint, field.size);
    return Float32Array.from({ length: field.count }, (_, i) => weigh(fieldX(field, i) - field.originX, fieldZ(field, i) - field.originZ));
}

// A stroke east along the middle, 800 wide, down ground that falls east and rises north.
const STREAM = { kind: 'stroke', points: [[-2500, 0], [2500, 0]], stamp: { width: 800, depth: 400, corner: 0 } };
const SLOPE  = (x, z) => 100 + 0.1 * z - 0.02 * x;
const WATER  = { type: 'water', config: { density: 1 }, footprint: STREAM };

// --- Water drawn above the sea ---------------------------------------------------------------

test('the sea writes its level into the line everywhere it reaches, so the surface is the one it always was', () => {
    const field = ground((x, z) => -60 + 0.02 * (x + SIZE / 2));
    applyElement(field, { type: 'water', config: { level: 4 } });
    assert.equal(field.water.level, 4);
    assert.ok(field.water.line.every(at => at === 4), 'its level on every vertex, under it or not');

    const surface = waterSurface(field);
    const under = Array.from(field.height).filter(h => h <= 4).length;
    assert.equal(surface.count, under, 'the vertices at or under the level, as before');
    assert.equal(surface.level, 4);
});

test('the sea at part density leaves its dry ground with no line, and the surface leaves it out', () => {
    const field = ground(() => -40);
    applyElement(field, { type: 'water', config: { level: 4, density: 0.5 } });
    const dry = Array.from(field.water.line).filter(at => Number.isNaN(at)).length;
    assert.ok(dry > field.count * 0.2 && dry < field.count * 0.8, `${dry} left dry`);
    assert.equal(waterSurface(field).count, field.count - dry);
});

test('a line is read before a tile is called dry, and a level alone is still a sea', () => {
    const field = ground(() => 50);
    assert.equal(waterSurface(field), null, 'no water at all');

    field.water = { level: null, line: new Float32Array(field.count).fill(NaN) };
    field.water.line[vertexAt(field, 0, 0)] = 60;
    const surface = waterSurface(field);
    assert.equal(surface.count, 1, 'drawn water with no sea is water');
    assert.equal(surface.level, null);

    const old = ground(() => 50);
    old.water = { level: 60 };
    assert.equal(waterSurface(old).count, old.count, 'a record with a level and no line reads as the sea everywhere');
});

test('a copy of a field has its own line', () => {
    const field = ground(() => -10);
    applyElement(field, { type: 'water', config: { level: 4 } });
    const copy = cloneField(field);
    copy.water.line[0] = 99;
    assert.equal(field.water.line[0], 4);
});

test('water drawn on high ground is water where it was drawn, and the valley beside it stays dry', () => {
    // A hill at 300 with the stroke along its top, and a valley at 50 to the north.
    const field = ground((x, z) => (z > 2000 ? 50 : 300));
    applyElement(field, { type: 'water', config: { level: 4 } });
    applyFootprintedElement(field, WATER);

    assert.equal(field.water.level, 4, 'the sea\'s level is not raised to it');
    const surface = waterSurface(field);
    const wet = new Set(surface.vertices);
    assert.ok(wet.has(vertexAt(field, 0, 0)), 'the stroke is water');
    assert.ok(!wet.has(vertexAt(field, 0, 3000)), 'and the valley below the stroke\'s line is not');
    assert.ok(near(field.water.line[vertexAt(field, 0, 0)], 300 - WATER_SINK));
    assert.ok(field.height[vertexAt(field, 0, 0)] < 300 - 1, 'cut a little into even flat ground, so the water shows at its bank');
});

test('a strip across drawn water is lifted clear of it, and one elsewhere is not lifted to it', () => {
    const field = ground(() => 300);
    applyElement(field, { type: 'water', config: { level: 4 } });
    applyFootprintedElement(field, WATER);
    const line = field.water.line[vertexAt(field, 0, 0)];

    const across = { x: 0, z: 0, heading: 0, length: 2000, width: 200 };
    assert.deepEqual(clearRunwayGround(field, line - 5, across), { elevation: line + RUNWAY_FREEBOARD, cleared: ['water'] });

    const away = { x: 0, z: 3000, heading: 0, length: 1000, width: 200 };
    assert.deepEqual(clearRunwayGround(field, line - 5, away), { elevation: line - 5, cleared: [] }, 'the sea is far below it');
    assert.deepEqual(clearRunwayGround(field, 2, away), { elevation: 4 + RUNWAY_FREEBOARD, cleared: ['water'] }, 'and the sea is still cleared');
});

test('a strip searched for on ground drawn water covers is laid clear of the water', () => {
    // A pond over the whole square, so wherever the search puts the strip it is in it.
    const field = ground(() => 300);
    applyFootprintedElement(field, { type: 'water', config: {}, footprint: { kind: 'disc', x: 0, z: 0, radius: SIZE } });
    const line = field.water.line[vertexAt(field, 0, 0)];
    applyElement(field, { type: 'runway', config: {} });
    const [strip] = field.runways;
    assert.ok(strip.elevation > line && strip.cleared.includes('water'), `laid at ${strip.elevation} over water at ${line}`);
});

test('a sea recorded by its level alone stays the sea everywhere once water is drawn on it', () => {
    const field = ground(() => 300);
    field.water = { level: 400 };
    applyFootprintedElement(field, WATER);
    assert.equal(field.water.line[vertexAt(field, 0, 3000)], 400, 'off the stroke, still under the sea');
    assert.equal(waterSurface(field).count, field.count);
});

test('a second sea leaves the first where it was, the higher of the two standing', () => {
    const field = ground(() => -30);
    applyElement(field, { type: 'water', config: { level: 12 } });
    applyElement(field, { type: 'water', config: { level: 4 } });
    assert.equal(field.water.level, 12);
    assert.ok(field.water.line.every(at => at === 12));
});

test('values settled for a field of another size are not read, and the element is drawn as it would be without them', () => {
    const plain = ground(() => -30);
    const odd = ground(() => -30);
    applyElement(plain, { type: 'water', config: { level: 4 } });
    applyElement(odd, { type: 'water', config: { level: 4, drawn: { line: new Float32Array(3), inward: new Float32Array(3) } } });
    assert.deepEqual(odd.height, plain.height);
    assert.equal(odd.water.level, 4);
});

// --- Drawn water lies in the ground ------------------------------------------------------------

test('across a stroke the line is level, though the ground rises across it', () => {
    const field = ground(SLOPE);
    applyFootprintedElement(field, WATER);
    for (const x of [-1600, 0, 1600]) {
        const across = [-240, -160, 0, 160, 240].map(z => field.water.line[vertexAt(field, x, z)]);
        assert.ok(across.every(at => near(at, across[0])), `level across at ${x}: ${across.map(a => a.toFixed(2))}`);
    }
});

test('along a stroke the line follows the ground down: a stream, not a trench cut to its lowest end', () => {
    const field = ground(SLOPE);
    applyFootprintedElement(field, WATER);
    const up = field.water.line[vertexAt(field, -1600, 0)];
    const down = field.water.line[vertexAt(field, 1600, 0)];
    assert.ok(up - down > 50 && up - down < 80, `${up.toFixed(1)} upstream, ${down.toFixed(1)} down`);

    // The lowest ground within half the stroke's width of the way, there - to a
    // cell, since the way is walked at half a cell's spacing and a vertex right
    // on the stroke's edge may fall either side of the half-width.
    const bare = ground(SLOPE);
    const lowestWithin = reach => {
        let lowest = Infinity;
        for (let i = 0; i < bare.count; i++) {
            if (Math.hypot(fieldX(bare, i) + 1600, fieldZ(bare, i)) <= reach) lowest = Math.min(lowest, bare.height[i]);
        }
        return lowest - WATER_SINK;
    };
    const [deepest, shallowest] = [lowestWithin(400), lowestWithin(400 - bare.step)];
    assert.ok(up >= deepest - 0.5 && up <= shallowest + 0.5,
        `at the lowest bank of its cross-section: ${up.toFixed(2)} between ${deepest.toFixed(2)} and ${shallowest.toFixed(2)}`);
    assert.ok(up < SLOPE(-1600, 0) - 25, 'well under the ground on the way itself');
});

test('the ground under the stroke is only ever cut to the line, never raised, and the line never stands above its ground', () => {
    const bare = ground(SLOPE);
    const field = ground(SLOPE);
    applyFootprintedElement(field, WATER);
    const weights = weightsOf(field, STREAM);
    let whole = 0;
    for (let i = 0; i < field.count; i++) {
        assert.ok(field.height[i] <= bare.height[i] + 1e-3, `vertex ${i} raised`);
        const line = field.water.line?.[i];
        if (Number.isFinite(line)) {
            assert.ok(line <= bare.height[i] - WATER_SINK + 1e-3, `vertex ${i}: line over its ground`);
            assert.ok(line < bare.height[i] - 1, `vertex ${i}: a little under even the lowest bank, so it shows there`);
        }
        if (weights[i] >= 1) {
            whole++;
            assert.ok(near(field.height[i], line), `vertex ${i} inside is cut to the line`);
        }
    }
    assert.ok(whole > 100);
    assert.ok(waterSurface(field).count >= whole, 'and every one of them is water');
});

test('drawn water never stands over the ground it sits on, out past the last sample of a deep stamp too', () => {
    // A narrow stamp reaching far past its ends, on ground falling away east:
    // past the last sample the ground is lower than any bank the stroke's
    // cross-sections found.
    const east = x => 100 - 0.02 * x;
    const deep = { kind: 'stroke', points: [[-1500, 0], [1500, 0]], stamp: { width: 400, depth: 1200, corner: 0 } };
    const bare = ground(east);
    const field = ground(east);
    applyFootprintedElement(field, { type: 'water', config: {}, footprint: deep });
    const past = vertexAt(field, 1900, 0);
    assert.ok(Number.isFinite(field.water.line[past]), 'the stamp reaches there');
    assert.ok(field.water.line[past] <= bare.height[past] - WATER_SINK + 1e-3, 'and the water there lies in it');
    for (let i = 0; i < field.count; i++) {
        if (Number.isFinite(field.water.line[i])) assert.ok(field.water.line[i] < bare.height[i], `vertex ${i}`);
    }
});

test('a body with no way through it is a pond, flat at its lowest ground', () => {
    const disc = { kind: 'disc', x: 0, z: 0, radius: 1500 };
    const field = ground(SLOPE);
    applyFootprintedElement(field, { type: 'water', config: {}, footprint: disc });
    const weights = weightsOf(field, disc);
    let lowest = Infinity;
    const bare = ground(SLOPE);
    for (let i = 0; i < field.count; i++) if (weights[i] > 0) lowest = Math.min(lowest, bare.height[i]);
    for (let i = 0; i < field.count; i++) {
        if (weights[i] > 0) assert.ok(near(field.water.line[i], lowest - WATER_SINK), `vertex ${i}`);
    }
});

test('every vertex a stroke narrower than the sampling weighs is given a bank, wherever it runs', () => {
    // A cross-section thinner than a cell holds no vertex of its own, so the
    // bank is read from the ground the sampling does reach. Searched by the
    // stroke's width alone, a stroke 40 across weighed its vertices from a row
    // it ran along and left every one of them dry once it was moved a few
    // units off that row, so the same river drawn a pixel lower drew nothing.
    let weighed = 0;
    for (const offset of [0, 7, 13, 19]) {
        const stroke = { kind: 'stroke', points: [[-2500, offset], [2500, offset]], stamp: { width: 40, depth: 40, corner: 0 } };
        const bare  = ground(SLOPE);
        const field = ground(SLOPE);
        const covered = Array.from(weightsOf(bare, stroke)).filter(weight => weight > 0).length;

        applyFootprintedElement(field, { type: 'water', config: { density: 1 }, footprint: stroke });
        const wet = Array.from(field.water.line).filter(Number.isFinite).length;
        let cut = 0;
        for (let i = 0; i < field.count; i++) if (field.height[i] < bare.height[i] - 1e-6) cut++;

        assert.equal(wet, covered, `${covered} weighed and ${wet} wet, ${offset} off a row of vertices`);
        assert.equal(cut, covered, `and the ground cut to the line at every one of them, ${offset} off a row`);
        weighed += covered;
    }
    assert.ok(weighed > 0, 'a stroke this narrow reaches vertices to be measured at some of those offsets');
});

test('drawn water is pale at its bank and dark in its middle, across its own width', () => {
    const { inward } = bankMeasure(ground(SLOPE), weightsOf(ground(SLOPE), STREAM), STREAM);
    const field = ground(SLOPE);
    assert.ok(inward[vertexAt(field, 0, 0)] > 0.9, 'about 1 on the way the drag went');
    assert.ok(inward[vertexAt(field, 0, 320)] < 0.25, 'and near nothing at a side');
    assert.equal(inward[vertexAt(field, 0, 2000)], 0, 'and nothing off it');

    applyFootprintedElement(field, WATER);
    const middle = readColor(field, vertexAt(field, 0, 0));
    const side   = readColor(field, vertexAt(field, 0, 240));
    assert.ok(middle[1] < side[1] - 0.05, `darker in the middle: ${middle[1].toFixed(3)} against ${side[1].toFixed(3)}`);
});

test('the line is worked out on each tile, from that tile\'s own ground under the stroke', () => {
    const low  = ground(SLOPE);
    const high = ground((x, z) => SLOPE(x - SIZE, z) + 500, { originX: SIZE });
    applyFootprintedElement(low, WATER);
    applyFootprintedElement(high, WATER);
    const at = vertexAt(low, 0, 0);
    assert.ok(near(high.water.line[at] - low.water.line[at], 500, 1), 'the same stroke on ground 500 higher rests 500 higher');
});

test('a stroke over a seam rests at a line either side of it that steps less than the swell is high', () => {
    // One ground running on across the seam, sampled as two tiles side by side.
    const fall = (x, z) => 200 + 0.1 * z - 0.002 * x;
    const over = { kind: 'stroke', points: [[SIZE / 2 - 2000, 0], [SIZE / 2 + 2000, 0]], stamp: { width: 800, depth: 400, corner: 0 } };
    const west = ground(fall);
    const east = ground(fall, { originX: SIZE });
    applyFootprintedElement(west, { ...WATER, footprint: over });
    applyFootprintedElement(east, { ...WATER, footprint: over });

    let compared = 0;
    for (const z of [-160, -80, 0, 80, 160]) {
        const leaving = west.water.line[vertexAt(west, SIZE / 2, z)];
        const arriving = east.water.line[vertexAt(east, -SIZE / 2, z)];
        assert.ok(Number.isFinite(leaving) && Number.isFinite(arriving));
        assert.ok(Math.abs(leaving - arriving) < WAVE.amplitude, `at ${z}: ${leaving.toFixed(2)} against ${arriving.toFixed(2)}`);
        compared++;
    }
    assert.equal(compared, 5);
});

test('drawn water at part density is pools: no line and no cut where the noise says dry', () => {
    const bare = ground(SLOPE);
    const field = ground(SLOPE);
    applyFootprintedElement(field, { ...WATER, config: { density: 0.5 } });
    const weights = weightsOf(field, STREAM);
    let pooled = 0, dry = 0;
    for (let i = 0; i < field.count; i++) {
        if (weights[i] < 1) continue;
        if (Number.isFinite(field.water.line[i])) pooled++;
        else {
            dry++;
            assert.equal(field.height[i], bare.height[i], 'dry ground is not cut');
        }
    }
    assert.ok(pooled > 20 && dry > 20, `${pooled} pooled, ${dry} dry`);
});

test('the ways a footprint\'s strokes went are read through their frames, and not through a cut', () => {
    const turned = { ...placeFootprint(STREAM), angle: Math.PI / 2, scaleX: 2, scaleZ: 0.5 };
    const [way] = strokeWays(turned);
    assert.ok(near(way.points[0][0], 0) && near(way.points[0][1], -5000), 'turned to run along z and stretched along its own length');
    assert.ok(near(way.points.at(-1)[1], 5000));
    assert.ok(near(way.half, 400), 'its width stretched by the frame\'s mean stretch');
    assert.ok(near(strokeWays({ ...placeFootprint(STREAM), scaleX: 2, scaleZ: 2 })[0].half, 800), 'a frame twice the size, a stroke twice as wide');

    const cut = combineFootprints('subtract', STREAM, { kind: 'stroke', points: [[0, 0]], stamp: STREAM.stamp });
    assert.equal(strokeWays(cut).length, 1, 'what a cut takes away is no way water runs');
    assert.equal(strokeWays(combineFootprints('union', STREAM, STREAM)).length, 2);
    assert.deepEqual(strokeWays({ kind: 'disc', radius: 400 }), []);
});

// --- Drawn snow settles where it is drawn -------------------------------------------------------

test('snow drawn on ground far below its line settles, its line put just under the stroke\'s lowest ground', () => {
    const lowGround = (x, z) => 30 + 0.02 * z;
    const bare = ground(lowGround);
    const field = ground(lowGround);
    const snow = { type: 'snow', config: { density: 1 }, footprint: STREAM };

    const settled = settleFromFootprint(bare, snow, weightsOf(bare, STREAM)).config;
    let lowest = Infinity;
    const weights = weightsOf(bare, STREAM);
    for (let i = 0; i < bare.count; i++) if (weights[i] > 0) lowest = Math.min(lowest, bare.height[i]);
    assert.ok(near(settled.line, lowest - SNOW_UNDER));

    applyFootprintedElement(field, snow);
    const middle = readColor(field, vertexAt(field, 0, 0));
    const side   = readColor(field, vertexAt(field, 0, 280));
    const plain  = readColor(bare, vertexAt(bare, 0, 0));
    assert.ok(middle[0] > plain[0] + 0.3, 'white on ground 270 under the 300 snow lies above by default');
    assert.ok(middle[0] > side[0] + 0.1 && side[0] > plain[0], 'deep in the middle, thin at the edge');
});

test('snow drawn along a valley floor is still deepest in its middle, where the ground is lowest', () => {
    // A V along the stroke: measured by how far above its line the ground
    // stands, the middle would be the thinnest snow, lying right on the line.
    const valley = (x, z) => 30 + Math.abs(z) * 0.05;
    const bare = ground(valley);
    const field = ground(valley);
    applyFootprintedElement(field, { type: 'snow', config: { density: 1 }, footprint: STREAM });
    const middle = readColor(field, vertexAt(field, 0, 0));
    const side   = readColor(field, vertexAt(field, 0, 200));
    assert.ok(middle[0] > side[0] + 0.05, `white in the middle, ${middle[0].toFixed(3)}, against ${side[0].toFixed(3)} to the side`);
    assert.ok(middle[0] > readColor(bare, vertexAt(bare, 0, 0))[0] + 0.3);
});

test('a drawn batch picked again shows none of what its strokes settle or its body does not read', () => {
    const footprint = placeFootprint(STREAM);
    assert.deepEqual(Object.keys(panelRanges({ type: 'water', config: {}, footprint })), ['color', 'density']);
    assert.deepEqual(Object.keys(panelRanges({ type: 'snow', config: {}, footprint })), ['coverage', 'slope', 'color', 'density']);
    assert.deepEqual(Object.keys(panelRanges({ type: 'water', config: {} })), Object.keys(getElement('water').ranges), 'the sea keeps all its own');
});
