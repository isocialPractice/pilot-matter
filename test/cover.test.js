/**
 * Build Grass, Sand, Water and Snow, Cover density, and A stroke's band is its
 * ground - the one cover tool laying a stamp swept along a drag, the clumps a
 * density breaks a stroke into, the band a stroke is drawn across worked out
 * from the ground under it, and the frame a batch of strokes is moved, turned
 * and stretched by.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createField, applyElement, coverAt, clumpNoise, CLUMP_DECILES, CLUMP_SIZE, getElement, fieldX, fieldZ,
    readColor, blend, DEFAULT_SIZE
} from '../js/environment/elements.js';
import {
    applyFootprintedElement, settleFromFootprint, FOOTPRINT_SETTLERS
} from '../js/environment/footprinted.js';
import {
    footprintWeight, footprintBounds, footprintSampler, isFootprint, combineFootprints, placeFootprint,
    moveFootprint, addToPlaced, PLACED_KIND, COMBINE_KIND
} from '../js/environment/footprints.js';
import {
    BUILD_TOOLS, buildTool, isCoverTool, isBuiltTool, isChoosableTool, COVER_BRUSH, COVER_STAMP,
    COVER_ELEMENT_ROWS, coverStamp, toolPlacement, toolBrush
} from '../js/build-tools.js';
import {
    createBuildState, openBuildMode, beginCanvas, chooseBuildTool, coverValues, setCoverValues, layStroke,
    acceptDraft, cancelDraft, buildDraft, committedPlacements, setSelection, confirmOpen, draftPending,
    reviseDraft, BUILD_FROM_TITLE
} from '../js/build-mode.js';
import {
    dockContent, coverRanges, coverHolderFor, panelRanges, DOCK_COVER, DOCK_ACCEPT, DOCK_CANCEL
} from '../js/build-panel.js';
import { boundHandles, handleBinding, dragHandle, gumballCentre, MIN_SCALE } from '../js/gumball.js';
import { stampOutline } from '../js/build-overlay.js';
import { unitsPerPixel, panBuildCamera, createBuildCamera } from '../js/build-camera.js';
import { label, rangeRows, writeRowValue } from '../js/properties-panel.js';

const near = (a, b, within = 1e-6) => Math.abs(a - b) <= within;
const STAMP = { width: 600, depth: 400, corner: 50 };
const LINE  = [[-2000, 0], [2000, 0]];

function onCanvas(tool = 'grass') {
    const state = createBuildState();
    openBuildMode(state, BUILD_FROM_TITLE);
    beginCanvas(state, 'highlands');
    if (tool) chooseBuildTool(state, tool);
    return state;
}

/** A field whose ground climbs from `low` at its west edge to `high` at its east. */
function rampField(low, high, { originX = 0, originZ = 0 } = {}) {
    const field = createField({ size: DEFAULT_SIZE, segments: 100, originX, originZ });
    for (let i = 0; i < field.count; i++) {
        const t = (fieldX(field, i) - originX + DEFAULT_SIZE / 2) / DEFAULT_SIZE;
        field.height[i] = low + (high - low) * t;
    }
    return field;
}

function meanCover(density) {
    const field = createField({ size: DEFAULT_SIZE, segments: 120 });
    let total = 0;
    for (let i = 0; i < field.count; i++) total += coverAt(field, i, density);
    return total / field.count;
}

// --- Cover density ---------------------------------------------------------------------

test('every ground cover declares a density, full by default so every preset is drawn as it was', () => {
    for (const id of ['grass', 'sand', 'water', 'snow']) {
        assert.deepEqual(getElement(id).ranges.density, { kind: 'scalar', low: 0, high: 1, default: 1 }, id);
    }
    const field = createField({ size: DEFAULT_SIZE, segments: 40 });
    for (let i = 0; i < field.count; i++) assert.equal(coverAt(field, i, 1), 1);
    for (let i = 0; i < field.count; i++) assert.equal(coverAt(field, i, 0), 0);
});

test('a density is the share of the ground covered, through deciles measured off the noise', () => {
    for (const density of [0.2, 0.5, 0.8]) {
        const share = meanCover(density);
        assert.ok(Math.abs(share - density) < 0.08, `${density} covers ${share.toFixed(3)}`);
    }
    assert.ok(meanCover(0.3) < meanCover(0.6), 'and more density is more cover');
    assert.equal(CLUMP_DECILES.length, 11);
    assert.ok(CLUMP_DECILES.every((value, i) => i === 0 || value > CLUMP_DECILES[i - 1]), 'rising');
});

test('part density is clumps with soft edges, not speckle and not a stair', () => {
    const field = createField({ size: DEFAULT_SIZE, segments: 200 });
    const covers = Array.from({ length: field.count }, (_, i) => coverAt(field, i, 0.5));
    assert.ok(covers.some(c => c === 0) && covers.some(c => c === 1), 'bare ground and whole clumps');
    const soft = covers.filter(c => c > 0.05 && c < 0.95).length / covers.length;
    assert.ok(soft > 0.05 && soft < 0.4, `with an eased edge between them, a share of the ground rather than a line: ${soft.toFixed(3)}`);

    // A neighbour in a clump is mostly the same as the vertex beside it.
    let same = 0;
    for (let i = 0; i < field.count - 1; i++) if ((covers[i] > 0.5) === (covers[i + 1] > 0.5)) same++;
    assert.ok(same / field.count > 0.8, 'clumps a few cells across');
    assert.ok(CLUMP_SIZE > field.step * 3);
});

test('the clumps are keyed on the canvas, the same on every tile and across the seam', () => {
    const middle = createField({ size: DEFAULT_SIZE, segments: 50 });
    const east   = createField({ size: DEFAULT_SIZE, segments: 50, originX: DEFAULT_SIZE, originZ: -DEFAULT_SIZE });
    for (let i = 0; i < middle.count; i += 7) assert.equal(coverAt(middle, i, 0.5), coverAt(east, i, 0.5));

    const cells = Math.round(DEFAULT_SIZE / CLUMP_SIZE);
    for (const v of [0, 3.3, 17.8]) assert.equal(clumpNoise(0, v, cells), clumpNoise(cells, v, cells), 'the noise repeats a canvas apart');
    const stride = middle.stride;
    for (let row = 0; row < stride; row += 5) {
        assert.equal(coverAt(middle, row * stride, 0.5), coverAt(middle, row * stride + stride - 1, 0.5), 'west edge meets east');
    }
});

test('a cover at part density leaves ground showing, and at none touches nothing', () => {
    for (const type of ['grass', 'sand']) {
        const ground = rampField(20, 100);
        const before = new Float32Array(ground.color);
        const half = rampField(20, 100);
        applyElement(half, { type, config: { band: [0, 200], density: 0.5 } });
        let painted = 0, bare = 0;
        for (let i = 0; i < half.count; i++) {
            const same = readColor(half, i).every((c, k) => c === before[i * 3 + k]);
            if (same) bare++; else painted++;
        }
        assert.ok(painted > half.count * 0.3 && bare > half.count * 0.3, `${type}: ${painted} painted, ${bare} bare`);

        const none = rampField(20, 100);
        applyElement(none, { type, config: { band: [0, 200], density: 0 } });
        assert.deepEqual(none.color, before, `${type} at no density paints nothing`);
    }

    const full = rampField(20, 100);
    applyElement(full, { type: 'grass', config: { band: [0, 200], density: 1 } });
    for (let i = 0; i < full.count; i += 13) {
        const expected = blend(getElement('grass').ranges.color.default, (full.height[i] - 0) / 200).map(c => Math.fround(c));
        assert.deepEqual(readColor(full, i), expected, 'whole cover is the band painted outright, as every preset paints it');
    }
});

test('water at part density is pools, and snow at none settles nowhere', () => {
    const marsh = rampField(-60, -10);
    applyElement(marsh, { type: 'water', config: { level: 4, density: 0.5 } });
    const lifted = Array.from(marsh.height).filter(h => near(h, 4, 1e-3)).length;
    const kept   = Array.from(marsh.height).filter(h => h < -9).length;
    assert.ok(lifted > marsh.count * 0.2 && kept > marsh.count * 0.2, `${lifted} under water, ${kept} left dry`);
    const ground = rampField(-60, -10);
    const between = Array.from(marsh.height).filter((h, i) => h > ground.height[i] + 0.5 && h < 4 - 0.5).length;
    assert.ok(between > marsh.count * 0.03, `and a pool's edge lifted part of the way, as far as the water reaches: ${between}`);

    const sheet = rampField(-60, -10);
    applyElement(sheet, { type: 'water', config: { level: 4 } });
    assert.ok(Array.from(sheet.height).every(h => near(h, 4, 1e-3)), 'at the default, a still sheet as the sea has always been');

    const peaks = rampField(800, 900);
    const before = new Float32Array(peaks.color);
    applyElement(peaks, { type: 'snow', config: { line: 300, density: 0 } });
    assert.deepEqual(peaks.color, before);
});

// --- A stroke's band is its ground ------------------------------------------------------------

const STROKE = { kind: 'stroke', points: [[-3000, 0], [3000, 0]], stamp: { width: 3000, depth: 1000, corner: 0 } };

test('grass drawn with a footprint is graded across the ground under it rather than its declared band', () => {
    const field = rampField(300, 700);
    const plain = rampField(300, 700);
    applyFootprintedElement(field, { type: 'grass', config: { density: 1 }, footprint: STROKE });

    const weigh = footprintSampler(STROKE, field.size);
    const whole = [];
    for (let i = 0; i < field.count; i++) {
        if (weigh(fieldX(field, i), fieldZ(field, i)) >= 1) whole.push(i);
    }
    assert.ok(whole.length > 100);
    assert.ok(whole.every(i => readColor(field, i).some((c, k) => c !== plain.color[i * 3 + k])),
        'all of the ground under it painted, though all of it is above the 130 the band declares');

    const west = whole.reduce((a, b) => (fieldX(field, a) < fieldX(field, b) ? a : b));
    const east = whole.reduce((a, b) => (fieldX(field, a) > fieldX(field, b) ? a : b));
    assert.ok(readColor(field, west)[1] > readColor(field, east)[1] + 0.1, 'pale on its low ground, dark on its high');
});

test('sand drawn on ground well above its eight-unit band still shows', () => {
    const field = rampField(200, 260);
    const plain = rampField(200, 260);
    applyFootprintedElement(field, { type: 'sand', config: {}, footprint: STROKE });
    const changed = Array.from({ length: field.count }, (_, i) => i).filter(i => field.color[i * 3] !== plain.color[i * 3]);
    assert.ok(changed.length > 100);
});

test('the band is worked out on each tile, from that tile\'s own ground under the stroke', () => {
    const placement = { type: 'grass', config: {}, footprint: STROKE };
    const weights = field => {
        const weigh = footprintSampler(STROKE, field.size);
        return Float32Array.from({ length: field.count }, (_, i) => weigh(fieldX(field, i) - field.originX, fieldZ(field, i) - field.originZ));
    };
    const low  = rampField(100, 200);
    const high = rampField(900, 1500, { originX: DEFAULT_SIZE });
    const [a0, a1] = settleFromFootprint(low, placement, weights(low)).config.band;
    const [b0, b1] = settleFromFootprint(high, placement, weights(high)).config.band;
    assert.ok(a0 >= 100 && a1 <= 200 && a0 < a1);
    assert.ok(b0 >= 900 && b1 <= 1500 && b0 < b1);

    const w = weights(low);
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < low.count; i++) if (w[i] > 0) { min = Math.min(min, low.height[i]); max = Math.max(max, low.height[i]); }
    assert.deepEqual([a0, a1], [min, max], 'the lowest and highest ground the stroke reaches at all');
});

test('only a footprint of its own settles anything', () => {
    const field = rampField(300, 700);
    const all = new Float32Array(field.count).fill(1);
    const clipped = { type: 'grass', config: {}, clip: STROKE };
    assert.equal(settleFromFootprint(field, clipped, all), clipped, 'a clip alone settles nothing');
    const preset = { type: 'grass', config: {} };
    assert.equal(settleFromFootprint(field, preset, all), preset);
    const drawnHill = { type: 'mountain', config: {}, footprint: STROKE };
    assert.equal(settleFromFootprint(field, drawnHill, all), drawnHill, 'nor an element that declares nothing settled');
    assert.equal(FOOTPRINT_SETTLERS.relief(field, new Float32Array(field.count)), null, 'and a region on no vertex settles nothing');
    assert.deepEqual(getElement('grass').footprintSettles, { band: 'relief' });
    assert.deepEqual(getElement('sand').footprintSettles, { band: 'relief' });
});

// --- A region set down in a frame -----------------------------------------------------------------

const SAMPLES = [];
for (let x = -4000; x <= 4000; x += 400) for (let z = -2000; z <= 2000; z += 400) SAMPLES.push([x, z]);

test('a region set down in a frame of its own weighs exactly as it did, its middle where it stood', () => {
    const stroke = { kind: 'stroke', points: [[1000, 300], [3000, 900]], stamp: STAMP };
    const placed = placeFootprint(stroke);
    assert.equal(placed.kind, PLACED_KIND);
    assert.deepEqual([placed.angle, placed.scaleX, placed.scaleZ], [0, 1, 1]);
    assert.deepEqual([placed.x, placed.z], [2000, 600]);
    for (const [x, z] of SAMPLES) assert.ok(near(footprintWeight(placed, x, z), footprintWeight(stroke, x, z)), `${x},${z}`);
    const [framed, bare] = [footprintBounds(placed), footprintBounds(stroke)];
    for (const side of ['minX', 'maxX', 'minZ', 'maxZ']) assert.ok(near(framed[side], bare[side], 1e-9), `a frame adds no feather of its own: ${side}`);
    assert.equal(placeFootprint({ kind: 'disc', radius: 0 }), null);
});

test('a frame moved, turned or stretched moves, turns or stretches its region about its middle', () => {
    const placed = placeFootprint({ kind: 'stroke', points: LINE, stamp: STAMP });
    const moved = { ...placed, x: 500, z: -700 };
    for (const [x, z] of SAMPLES) assert.ok(near(footprintWeight(moved, x + 500, z - 700), footprintWeight(placed, x, z)));

    const turned = { ...placed, angle: Math.PI / 2 };
    assert.equal(footprintWeight(turned, 0, 1900), 1, 'a stroke along x lies along z');
    assert.equal(footprintWeight(turned, 1900, 0), 0);

    const wide = { ...placed, scaleX: 2 };
    assert.equal(footprintWeight(wide, 3900, 0), 1, 'twice as long');
    assert.equal(footprintWeight(placed, 3900, 0), 0);
    assert.ok(footprintBounds(wide).maxX >= 3900);

    for (const frame of [turned, wide, { ...placed, angle: 0.6, scaleZ: 1.7 }]) {
        const square = footprintBounds(frame);
        for (const [x, z] of SAMPLES) {
            if (footprintWeight(frame, x, z) > 0) assert.ok(x >= square.minX && x <= square.maxX && z >= square.minZ && z <= square.maxZ);
        }
    }
    assert.equal(isFootprint({ ...placed, scaleX: 0 }), false, 'and a frame that flattens it to nothing is no region');
});

test('a frame turns its region the way a box is turned, which only a shape with no symmetry shows', () => {
    // An L: a long leg east, then a short one north. Its middle is 1000, 500.
    const ell = placeFootprint({ kind: 'stroke', points: [[0, 0], [2000, 0], [2000, 1000]], stamp: { width: 400, depth: 400, corner: 0 }, feather: 0 });
    assert.deepEqual([ell.x, ell.z], [1000, 500]);
    const turned = { ...ell, angle: Math.PI / 2 };
    assert.equal(footprintWeight(turned, 1500, 0), 1, 'the long leg turned to run along z');
    assert.equal(footprintWeight(turned, 1000, 1500), 1, 'and the short leg across the far end of it');
    assert.equal(footprintWeight(turned, 1000, -500), 0, 'not across the near end, where a turn the other way puts it');

    const box = { kind: 'rect', x: 1000, z: 500, width: 2000, depth: 10, angle: Math.PI / 2, corner: 0, feather: 0 };
    assert.equal(footprintWeight(box, 1000, 1400), 1, 'the way a box with the same angle turns');
});

test('a frame over a seam carries on across it', () => {
    const placed = placeFootprint({ kind: 'stroke', points: [[7800, 0]], stamp: { width: 800, depth: 800, corner: 0 } });
    assert.equal(footprintSampler(placed, DEFAULT_SIZE)(-7900, 0), footprintWeight(placed, 8100, 0));
    assert.ok(footprintSampler(placed, DEFAULT_SIZE)(-7900, 0) > 0);
});

test('every kind is moved without being drawn again', () => {
    const kinds = [
        { kind: 'disc', x: 100, z: 200, radius: 900 },
        { kind: 'rect', x: 0, z: 0, width: 1200, depth: 800, angle: 0.3, corner: 50 },
        { kind: 'ellipse', x: 0, z: 0, radiusX: 900, radiusZ: 500, angle: 0.2 },
        { kind: 'polygon', x: 0, z: 0, radius: 1000, sides: 5 },
        { kind: 'ring', points: [[0, 0], [1500, 0], [0, 1500]] },
        { kind: 'stroke', points: LINE, stamp: STAMP },
        { kind: 'path', points: [[0, 0], [1500, 0], [1500, 1500], [0, 1500]] },
        combineFootprints('subtract', { kind: 'disc', x: 0, z: 0, radius: 1500 }, { kind: 'disc', x: 0, z: 0, radius: 500 }),
        placeFootprint({ kind: 'stroke', points: LINE, stamp: STAMP })
    ];
    for (const footprint of kinds) {
        const moved = moveFootprint(footprint, 300, -450);
        for (const [x, z] of SAMPLES) {
            assert.ok(near(footprintWeight(moved, x + 300, z - 450), footprintWeight(footprint, x, z), 1e-9), `${footprint.kind} at ${x},${z}`);
        }
    }
});

test('each stroke joins the batch: one frame round one union while the frame is untouched', () => {
    const first  = { kind: 'stroke', points: LINE, stamp: STAMP };
    const second = { kind: 'stroke', points: [[0, 2000], [0, 3000]], stamp: STAMP };
    const batch = addToPlaced(placeFootprint(first), second);
    assert.equal(batch.kind, PLACED_KIND);
    assert.equal(batch.of.kind, COMBINE_KIND);
    assert.equal(batch.of.a.kind, 'stroke', 'the old frame taken off rather than kept inside the new');
    for (const [x, z] of [[0, 0], [0, 2500], [1900, 0], [0, -1000]]) {
        assert.ok(near(footprintWeight(batch, x, z), Math.max(footprintWeight(first, x, z), footprintWeight(second, x, z))));
    }

    const turned = { ...placeFootprint(first), angle: Math.PI / 2 };
    const kept = addToPlaced(turned, second);
    assert.equal(kept.of.a.kind, PLACED_KIND, 'a frame the gumball changed is kept whole');
    assert.equal(footprintWeight(kept, 0, 1500), 1, 'so the turn it made stays made');
    assert.deepEqual(addToPlaced(null, first), placeFootprint(first));
    assert.equal(addToPlaced(turned, { kind: 'disc', radius: 0 }), turned, 'and a stroke of nothing adds nothing');
});

// --- The cover tool -------------------------------------------------------------------------

test('the cover tool is declared once for each of the four covers, and is on the palette for grass and sand', () => {
    const covers = BUILD_TOOLS.filter(tool => isCoverTool(tool.id));
    assert.deepEqual(covers.map(tool => [tool.id, tool.element, tool.starts.density]), [
        ['grass', 'grass', 0.5], ['sand', 'sand', 0.5], ['water', 'water', 1], ['snow', 'snow', 1]
    ]);
    assert.ok(isBuiltTool('grass') && isBuiltTool('sand'));
    assert.ok(!isBuiltTool('water') && !isBuiltTool('snow'), 'water and snow wait to be drawn where they were drawn');
    assert.ok(covers.every(tool => tool.mindsLasso));
    assert.equal(isCoverTool('mountain'), false);
    assert.deepEqual(toolBrush(buildTool('grass')), COVER_BRUSH);
    assert.deepEqual(toolBrush(buildTool('mountain')), {});
});

test('the brush is the artwork\'s three rows, in pixels, written to the stamp\'s depth, width and corner', () => {
    assert.deepEqual(Object.keys(COVER_BRUSH).map(label), ['BUILD HEIGHT', 'BUILD WIDTH', 'CORNER RADIUS']);
    assert.deepEqual(COVER_STAMP, { buildHeight: 'depth', buildWidth: 'width', cornerRadius: 'corner' });
    assert.deepEqual(COVER_ELEMENT_ROWS, ['density', 'color']);

    assert.deepEqual(coverStamp({ buildWidth: 60, buildHeight: 40, cornerRadius: 10 }, 20), { width: 1200, depth: 800, corner: 200 });
    assert.deepEqual(coverStamp({}, 2), { width: 120, depth: 80, corner: 20 }, 'the brush\'s defaults');
    assert.deepEqual(coverStamp({ buildWidth: 60, buildHeight: 40, cornerRadius: 200 }, 1), { width: 60, depth: 40, corner: 20 },
        'a corner no rounder than half the shorter side');
    assert.deepEqual(coverStamp({ buildWidth: 10, buildHeight: 10, cornerRadius: 0 }, 0.01), { width: 1, depth: 1, corner: 0 },
        'and never less than a unit across');
    assert.deepEqual(coverStamp({ buildWidth: 30, buildHeight: 20, cornerRadius: 0 }, -5), { width: 30, depth: 20, corner: 0 });
});

test('the panel starts at the tool\'s own figures, and carries what the pilot left it at', () => {
    const state = onCanvas('grass');
    const values = coverValues(state);
    assert.equal(values.density, 0.5);
    assert.deepEqual(values.color, getElement('grass').ranges.color.default);
    assert.deepEqual([values.buildHeight, values.buildWidth, values.cornerRadius], [40, 60, 10]);
    assert.deepEqual(Object.keys(values).sort(), ['buildHeight', 'buildWidth', 'color', 'cornerRadius', 'density']);
    assert.equal(coverValues(state, 'mountain'), null);

    assert.equal(setCoverValues(state, { ...values, density: 0.8, buildWidth: 90 }), false, 'nothing in hand to change');
    assert.equal(coverValues(state).density, 0.8);
    assert.equal(coverValues(state).buildWidth, 90);
    assert.equal(coverValues(state, 'sand').density, 0.5, 'each cover its own');
});

test('a stroke begins the batch, and each stroke after it joins it as one placement', () => {
    const state = onCanvas('grass');
    assert.equal(layStroke(state, [[-2000.4, 10.6], [2000, 0]], STAMP, { size: DEFAULT_SIZE }), true);
    const first = buildDraft(state);
    assert.equal(first.type, 'grass');
    assert.deepEqual(first.config, { density: 0.5, color: getElement('grass').ranges.color.default },
        'the element\'s rows and nothing else: no brush, and no band the stroke settles');
    assert.equal(first.footprint.kind, PLACED_KIND);
    assert.deepEqual(first.footprint.of.points.map(([x, z]) => [x + first.footprint.x, z + first.footprint.z]), [[-2000, 11], [2000, 0]],
        'points kept to the whole unit');
    assert.deepEqual(first.footprint.of.stamp, STAMP);

    assert.equal(layStroke(state, [[0, 3000]], STAMP, { size: DEFAULT_SIZE }), true);
    const batch = buildDraft(state).footprint;
    assert.equal(batch.of.kind, COMBINE_KIND);
    assert.equal(footprintWeight(batch, 0, 0), 1);
    assert.equal(footprintWeight(batch, 0, 3000), 1);

    const kept = acceptDraft(state);
    assert.equal(committedPlacements(state).length, 1, 'two strokes, one placement');
    assert.deepEqual(kept.footprint, batch);
});

test('a panel edit changes the whole batch in hand; the brush only the strokes still to come', () => {
    const state = onCanvas('grass');
    layStroke(state, LINE, STAMP, { size: DEFAULT_SIZE });
    layStroke(state, [[0, 3000]], STAMP, { size: DEFAULT_SIZE });
    const footprint = buildDraft(state).footprint;

    assert.equal(setCoverValues(state, { density: 0.9 }), true);
    assert.equal(buildDraft(state).config.density, 0.9);
    assert.equal(setCoverValues(state, { buildWidth: 200 }), true, 'a write with a batch in hand is the batch');
    assert.deepEqual(buildDraft(state).footprint, footprint, 'a stroke laid keeps the size it was laid at');
    assert.equal('buildWidth' in buildDraft(state).config, false);
    assert.equal(coverValues(state).density, 0.9, 'the panel reads the batch');

    acceptDraft(state);
    assert.equal(coverValues(state).density, 0.9, 'and the next batch starts where the panel was left');
    assert.equal(coverValues(state).buildWidth, 200, 'brush and all');
    layStroke(state, LINE, STAMP, { size: DEFAULT_SIZE });
    assert.equal(buildDraft(state).config.density, 0.9);
    assert.equal(committedPlacements(state)[0].config.density, 0.9);
    setCoverValues(state, { density: 0.3 });
    assert.equal(committedPlacements(state)[0].config.density, 0.9, 'a panel edit stops at the batch in hand');
});

test('a batch cancelled leaves nothing, and the panel as it was', () => {
    const state = onCanvas('sand');
    setCoverValues(state, { density: 0.7 });
    layStroke(state, LINE, STAMP, { size: DEFAULT_SIZE });
    assert.equal(cancelDraft(state), true);
    assert.equal(committedPlacements(state).length, 0);
    assert.equal(coverValues(state).density, 0.7);
});

test('a stroke after the gumball moved the batch joins it without undoing the move', () => {
    const state = onCanvas('grass');
    layStroke(state, LINE, STAMP, { size: DEFAULT_SIZE });
    const frame = buildDraft(state).footprint;
    reviseDraft(state, { footprint: { ...frame, angle: Math.PI / 2 } });
    layStroke(state, [[3000, 3000]], STAMP, { size: DEFAULT_SIZE });
    const batch = buildDraft(state).footprint;
    assert.equal(footprintWeight(batch, 0, 1800), 1, 'the first stroke still turned');
    assert.equal(footprintWeight(batch, 3000, 3000), 1, 'and the second where it was drawn');
});

test('a batch drawn inside a selection carries it, and a stroke it would cut all of away is refused', () => {
    const state = onCanvas('grass');
    const box = { kind: 'rect', x: 0, z: 0, width: 4000, depth: 4000, angle: 0, corner: 0 };
    setSelection(state, box);
    assert.equal(layStroke(state, [[6000, 6000]], STAMP, { size: DEFAULT_SIZE }), false, 'outside the selection');
    assert.equal(draftPending(state), false);
    assert.equal(layStroke(state, [[0, 0]], STAMP, { size: DEFAULT_SIZE }), true);
    assert.deepEqual(buildDraft(state).clip, box);
    assert.equal(layStroke(state, [[-6000, 6000]], STAMP, { size: DEFAULT_SIZE }), false, 'and a later stroke outside it too');
    assert.equal(layStroke(state, [[1500, 0]], STAMP, { size: DEFAULT_SIZE }), true);
});

test('a stroke is refused for any tool but the cover tool, under a question, and for a stamp of nothing', () => {
    const mountain = onCanvas('mountain');
    assert.equal(layStroke(mountain, LINE, STAMP), false);

    const empty = onCanvas('grass');
    assert.equal(layStroke(empty, LINE, { width: 0, depth: 300, corner: 0 }), false);
    assert.equal(layStroke(empty, [], STAMP), false);

    const asking = onCanvas('grass');
    layStroke(asking, LINE, STAMP);
    chooseBuildTool(asking, 'sand');
    assert.equal(confirmOpen(asking), true, 'a tool change with a batch in hand asks first');
    assert.equal(layStroke(asking, [[0, 3000]], STAMP), false);
    assert.equal(setCoverValues(asking, { density: 0.1 }), false);

    const off = createBuildState();
    assert.equal(layStroke(off, LINE, STAMP), false);
});

// --- Its panel ------------------------------------------------------------------------------

test('the cover tool\'s panel is there from the moment it is chosen, in the artwork\'s rows', () => {
    const state = onCanvas('grass');
    const shown = dockContent(state, { camera: createBuildCamera(DEFAULT_SIZE) });
    assert.equal(shown.kind, DOCK_COVER);
    assert.equal(shown.heading, 'BUILD GRASS');
    assert.deepEqual(shown.rows.map(entry => entry.row.label),
        ['DENSITY', 'BUILD HEIGHT', 'BUILD WIDTH', 'CORNER RADIUS', 'COLOR LIGHT', 'COLOR DARK']);
    assert.equal(shown.rows[0].value, 0.5);
    assert.deepEqual(shown.actions, [], 'nothing to accept before a stroke');

    layStroke(state, LINE, STAMP);
    assert.deepEqual(dockContent(state, {}).actions, [DOCK_ACCEPT, DOCK_CANCEL], 'and the batch\'s accept and cancel once there is one');
    assert.equal(dockContent(onCanvas('sand'), {}).heading, 'BUILD SAND');
    assert.deepEqual(coverRanges('mountain'), {});
});

test('its holder steps the colour as shades of where it began', () => {
    const state = onCanvas('grass');
    const holder = coverHolderFor(state);
    assert.deepEqual(Object.keys(holder.config), Object.keys(coverRanges('grass')));
    assert.deepEqual(holder.shades, { color: { light: 1, dark: 1 } });
    assert.deepEqual(holder.base.color, holder.config.color);
    assert.equal(coverHolderFor(onCanvas('mountain')), null);

    const [, darker] = rangeRows('color', getElement('grass').ranges.color);
    const began = structuredClone(holder.config.color.dark);
    writeRowValue(holder, 'color', darker, 1.2);
    writeRowValue(holder, 'color', darker, 1.2);
    assert.deepEqual(holder.config.color.dark, began.map(c => Math.min(c * 1.2, 1)),
        'written twice at 120% is 120% of where it began, not 144%');
});

test('a batch picked again shows no band, which its strokes settle', () => {
    const drawn = { type: 'grass', config: {}, footprint: placeFootprint({ kind: 'stroke', points: LINE, stamp: STAMP }) };
    assert.deepEqual(Object.keys(panelRanges(drawn)), ['color', 'density']);
    assert.deepEqual(Object.keys(panelRanges({ type: 'grass', config: {} })), ['color', 'band', 'density'], 'a preset\'s grass keeps its band');
});

// --- Its gumball ------------------------------------------------------------------------------

test('a batch takes the Flat gumball: moved by its middle, turned by its arc, stretched by its squares', () => {
    const batch = { type: 'grass', config: {}, footprint: placeFootprint({ kind: 'stroke', points: LINE, stamp: STAMP }) };
    assert.deepEqual(gumballCentre(batch), { x: 0, z: 0 });
    assert.ok(boundHandles(batch).length > 0);
    assert.deepEqual(handleBinding('scale-x', batch), { from: 'footprint', name: 'scaleX', mode: 'scale' });
    assert.deepEqual(handleBinding('scale-y', batch), { from: 'footprint', name: 'scaleZ', mode: 'scale' });
    assert.equal(handleBinding('rotate-blue', batch)?.name, 'angle');

    const moved = dragHandle(batch, 'move-uniform', { ground: { dx: 700, dz: -300 } }, { size: DEFAULT_SIZE });
    assert.deepEqual([moved.footprint.x, moved.footprint.z], [700, -300]);
    const turned = dragHandle(batch, 'rotate-blue', { turn: 0.5 });
    assert.equal(turned.footprint.angle, 0.5);
    const grown = dragHandle(batch, 'scale-x', { along: 160 });
    assert.ok(near(grown.footprint.scaleX, Math.E, 1e-9));
    const shrunk = dragHandle(batch, 'scale-x', { along: -10000 });
    assert.equal(shrunk.footprint.scaleX, MIN_SCALE, 'held to a twentieth rather than to twenty units');
    assert.deepEqual(moved.config, {}, 'and none of it touches the batch\'s configuration');
});

// --- On the screen ------------------------------------------------------------------------------

test('the stamp following the pointer is the brush\'s rounded rectangle, on the pointer', () => {
    const outline = stampOutline(400, 300, 60, 40, 10);
    assert.deepEqual(outline[0], outline.at(-1), 'closed');
    const xs = outline.map(p => p.x), ys = outline.map(p => p.y);
    assert.ok(near(Math.min(...xs), 370) && near(Math.max(...xs), 430));
    assert.ok(near(Math.min(...ys), 280) && near(Math.max(...ys), 320));
    assert.ok(!outline.some(p => near(p.x, 370) && near(p.y, 280)), 'its corners rounded off');
    const square = stampOutline(0, 0, 60, 40, 0);
    assert.ok(square.some(p => near(p.x, -30) && near(p.y, -20)), 'and square with no corner');
    const round = stampOutline(0, 0, 60, 40, 500);
    assert.ok(round.every(p => Math.abs(p.y) <= 20 + 1e-9), 'a corner no rounder than the shorter side allows');
    assert.deepEqual(stampOutline(0, 0, 0, 40, 5), []);
});

test('a pixel is the world units it spans at the press, the same arithmetic a pan moves by', () => {
    assert.ok(near(unitsPerPixel(1000, 90, 500), 4));
    assert.ok(near(unitsPerPixel(2000, 90, 500), 8), 'twice as far, twice as much ground');
    const hold = { ...createBuildCamera(DEFAULT_SIZE), pitch: 90, yaw: 0 };
    const panned = panBuildCamera(hold, 10, 0, { viewHeight: 500, fov: 70 });
    const moved = Math.hypot(panned.target.x - hold.target.x, panned.target.z - hold.target.z);
    assert.ok(near(moved, 10 * unitsPerPixel(hold.distance, 70, 500), 1e-6));
});

test('the grass a batch lays is drawn on the canvas where its strokes went', () => {
    const state = onCanvas('grass');
    setCoverValues(state, { density: 1 });
    layStroke(state, LINE, { width: 2000, depth: 1000, corner: 0 });
    const field = rampField(400, 800);
    const plain = rampField(400, 800);
    applyFootprintedElement(field, buildDraft(state));
    const at = (x, z) => {
        const col = Math.round((x + DEFAULT_SIZE / 2) / field.step);
        const row = Math.round((z + DEFAULT_SIZE / 2) / field.step);
        return row * field.stride + col;
    };
    assert.notDeepEqual(readColor(field, at(0, 0)), readColor(plain, at(0, 0)), 'under the stroke');
    assert.deepEqual(readColor(field, at(0, 4000)), readColor(plain, at(0, 4000)), 'and nothing beside it');
});
