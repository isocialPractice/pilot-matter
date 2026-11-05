/**
 * Free paint, Paint panel, Brush sizing, Strokes land as they are drawn and
 * Paint blending - the element that lays a colour and no height, the panel it
 * is chosen on, the brush measured in pixels and laid in world units, the
 * stroke shown as the region it will cover while it is drawn, and the blend
 * that keeps the ground's own lightness under the colour.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createField, applyElement, applyBase, getElement, isElementId, resolveConfig, readColor, paint, fieldX, fieldZ,
    nearestColor, tintColor, luminance, LUMA, color, scalar, ELEMENT_ORDER, DEFAULT_SIZE
} from '../js/environment/elements.js';
import { applyFootprintedElement } from '../js/environment/footprinted.js';
import { footprintWeight, placeFootprint, DEFAULT_FEATHER } from '../js/environment/footprints.js';
import {
    buildTool, isPaintTool, isStrokeTool, isCoverTool, isBuiltTool, isChoosableTool, PAINT_BRUSH, PAINT_ELEMENT_ROWS,
    SOFT_EDGE, paintStamp, strokeStamp, coverStamp, defaultBrush, toolBrush, toolElementRows, toolPlacement
} from '../js/build-tools.js';
import {
    createBuildState, openBuildMode, beginCanvas, chooseBuildTool, strokeValues, setStrokeValues, layStroke,
    acceptDraft, buildDraft, committedPlacements, draftPending, resetBrush, brushIsDefault, eyeDropperArmed,
    toggleEyeDropper, dropEyeDropper, takeEyeDropperColor, requestLeave, answerConfirm, CONFIRM_STAY, BUILD_FROM_TITLE
} from '../js/build-mode.js';
import {
    dockContent, strokeRanges, strokeHolderFor, PAINT_SECTIONS, DOCK_PAINT, DOCK_DEFAULT_BRUSH, DOCK_ACCEPT, DOCK_CANCEL
} from '../js/build-panel.js';
import {
    rangeRows, rowValue, rowValueLabel, writeRowValue, stepRow, isTypedRow, typedRowValue, rangeNotice, coarseStep,
    readsAsPercent, COLOR_SWATCHES, PICKER_STOPS, PICKER_SHADES, pickerColor, hexColor, parseHex, sameColor,
    HEX_NOTICE, COARSE_POINTS
} from '../js/properties-panel.js';
import { fieldFigure, pickerBandStyle } from '../js/panel-view.js';
import { strokeRibbon, paintTrailColour, fillRegion } from '../js/build-overlay.js';
import { placementAt } from '../js/build-select.js';
import { gumballKind, GUMBALL_FLAT } from '../js/gumball.js';
import { templateBuilt, offeredTemplates } from '../js/templates.js';

const near = (a, b, within = 1e-6) => Math.abs(a - b) <= within;

function onCanvas(tool = 'paint') {
    const state = createBuildState();
    openBuildMode(state, BUILD_FROM_TITLE);
    beginCanvas(state, 'highlands');
    if (tool) chooseBuildTool(state, tool);
    return state;
}

/** A field of real ground: the base noise, coloured as the rock it is, with grass laid over its low half. */
function groundField(segments = 40) {
    const field = createField({ size: DEFAULT_SIZE, segments });
    applyBase(field, { maxHeight: 600 });
    applyElement(field, { type: 'grass', config: { band: [0, 200] } });
    return field;
}

const LINE = [[-3000, 0], [3000, 0]];

// --- Free paint: the element ---------------------------------------------------------

test('paint is in the registry: a colour, an opacity read as a percentage, and a blend', () => {
    assert.equal(isElementId('paint'), true);
    const { ranges } = getElement('paint');
    assert.deepEqual(Object.keys(ranges), ['color', 'opacity', 'blend']);
    assert.deepEqual(ranges.color, { kind: 'color', default: [0, 0, 0] });
    assert.deepEqual(ranges.opacity, { kind: 'scalar', low: 0, high: 1, default: 1, percent: true });
    assert.deepEqual(ranges.blend.values, ['tint', 'normal']);
    assert.equal(ranges.blend.default, 'tint', 'the blend that keeps the ground\'s lightness, unless asked otherwise');
});

test('paint is the last colour laid: after snow, and before the strip, which is cut last', () => {
    const at = ELEMENT_ORDER.indexOf('paint');
    assert.equal(ELEMENT_ORDER[at - 1], 'snow');
    assert.equal(ELEMENT_ORDER[at + 1], 'runway');
    assert.equal(ELEMENT_ORDER.at(-1), 'runway');
});

test('a colour range resolves to three channels held to what a channel holds, or the declared colour', () => {
    const element = { ranges: { color: color([0.2, 0.4, 0.6]) } };
    assert.deepEqual(resolveConfig(element, {}).color, [0.2, 0.4, 0.6]);
    assert.deepEqual(resolveConfig(element, { color: [1.5, -1, 0.5] }).color, [1, 0, 0.5]);
    for (const given of [[1, 0], 'red', [NaN, 0, 0], null, { r: 1 }]) {
        assert.deepEqual(resolveConfig(element, { color: given }).color, [0.2, 0.4, 0.6], JSON.stringify(given));
    }
    const resolved = resolveConfig(element, {}).color;
    resolved[0] = 9;
    assert.deepEqual(element.ranges.color.default, [0.2, 0.4, 0.6], 'and the declaration is never handed out to be written');
    assert.deepEqual(color('teal').default, [0, 0, 0], 'a declaration that is not a colour declares black');
    assert.deepEqual(color([0.1, 0.2, 0.3], { when: { blend: 'normal' } }).when, { blend: 'normal' });
});

test('percent and slider are declared only when asked for, and change nothing a range resolves to', () => {
    assert.deepEqual(scalar(0, 1, 0.5), { kind: 'scalar', low: 0, high: 1, default: 0.5 });
    assert.deepEqual(scalar(0, 1, 0.5, { percent: true, slider: true }),
        { kind: 'scalar', low: 0, high: 1, default: 0.5, percent: true, slider: true });
    assert.deepEqual(scalar(0, 1, 0.5, { percent: 1, slider: 'yes' }), { kind: 'scalar', low: 0, high: 1, default: 0.5 },
        'only `true` asks');
});

test('paint writes no height, anywhere, whatever it is asked for', () => {
    for (const config of [{}, { blend: 'normal', color: [1, 0, 0] }, { opacity: 0.3, color: [0, 0, 1] }]) {
        const field = groundField();
        const before = [...field.height];
        applyElement(field, { type: 'paint', config });
        assert.deepEqual([...field.height], before, JSON.stringify(config));
    }
});

test('at a normal blend paint lays its colour as it is, and at part opacity mixes it over the ground', () => {
    const field = groundField();
    const ground = Array.from({ length: field.count }, (_, i) => readColor(field, i));
    applyElement(field, { type: 'paint', config: { blend: 'normal', color: [1, 0.5, 0] } });
    for (let i = 0; i < field.count; i += 7) {
        assert.ok(readColor(field, i).every((c, k) => near(c, [1, 0.5, 0][k], 1e-6)), `vertex ${i}`);
    }

    const part = groundField();
    applyElement(part, { type: 'paint', config: { blend: 'normal', color: [1, 0.5, 0], opacity: 0.4 } });
    for (let i = 0; i < part.count; i += 7) {
        const expected = ground[i].map((c, k) => c + ([1, 0.5, 0][k] - c) * 0.4);
        assert.ok(readColor(part, i).every((c, k) => near(c, expected[k], 1e-6)), `vertex ${i} at 40%`);
    }

    const none = groundField();
    applyElement(none, { type: 'paint', config: { blend: 'normal', color: [1, 0.5, 0], opacity: 0 } });
    assert.deepEqual([...none.color], ground.flat().map(c => Math.fround(c)), 'and at none, paints nothing');
});

// --- Paint blending ------------------------------------------------------------------

test('the luminance weights are Rec. 709\'s, and a white is lit whole', () => {
    assert.deepEqual([...LUMA], [0.2126, 0.7152, 0.0722]);
    assert.ok(near(luminance([1, 1, 1]), 1));
    assert.equal(luminance([0, 0, 0]), 0);
});

/**
 * The one assertion the plan names: a tinted stroke has the same luminance as
 * the ground it was laid on. Walked over every swatch and a spread of grounds
 * from deep to pale, including the pale ground a deep blue cannot reach by
 * being scaled - which a tint that scaled the paint to the ground's lightness
 * and clipped would leave the deep blue it was.
 */
test('a tinted colour has the ground\'s luminance exactly, whatever was picked and whatever the ground', () => {
    const grounds = [[0.05, 0.08, 0.04], [0.36, 0.55, 0.16], [0.52, 0.46, 0.38], [0.85, 0.77, 0.55], [0.95, 0.95, 0.98], [0, 0, 0], [1, 1, 1]];
    const paints = [...COLOR_SWATCHES.map(swatch => swatch.rgb), [0.2, 0.6, 0.9], [0.5, 0.1, 0.3]];
    for (const ground of grounds) {
        for (const picked of paints) {
            const tinted = tintColor(ground, picked);
            assert.ok(tinted.every(c => c >= 0 && c <= 1), `${tinted} is a colour`);
            assert.ok(near(luminance(tinted), luminance(ground), 1e-9),
                `${picked} on ${ground}: ${luminance(tinted)} against ${luminance(ground)}`);
        }
    }
});

test('a tint keeps the hue that was picked, and as much of its saturation as the ground\'s lightness can carry', () => {
    const grass = [0.36, 0.55, 0.16];
    const blue = tintColor(grass, [0, 0, 1]);
    assert.ok(blue[2] > blue[0] && blue[2] > blue[1], `blue stays the bluest channel: ${blue}`);
    assert.ok(near(blue[0], blue[1]), 'and its red and green stay level, as they were');

    const red = tintColor(grass, [1, 0, 0]);
    assert.ok(red[0] > red[1] && near(red[1], red[2]), `red stays red: ${red}`);

    // A mid-lightness colour on ground of the same lightness is left as it was.
    const mid = [0.6, 0.4, 0.2];
    assert.ok(tintColor(mid, mid).every((c, k) => near(c, mid[k])), 'a colour tinted onto itself is itself');
});

test('a colour with no hue is the ground\'s own grey, so black and white both keep the shading', () => {
    const grass = [0.36, 0.55, 0.16];
    const grey = luminance(grass);
    for (const picked of [[0, 0, 0], [1, 1, 1], [0.5, 0.5, 0.5]]) {
        assert.ok(tintColor(grass, picked).every(c => near(c, grey)), `${picked} on grass`);
    }
});

test('painted with a tint, a ground keeps its own light and shade, where a normal blend flattens it', () => {
    const tinted = groundField();
    const ground = Array.from({ length: tinted.count }, (_, i) => readColor(tinted, i));
    applyElement(tinted, { type: 'paint', config: { color: [0.8, 0.1, 0.1] } });

    const normal = groundField();
    applyElement(normal, { type: 'paint', config: { color: [0.8, 0.1, 0.1], blend: 'normal' } });

    const spread = field => {
        const lit = Array.from({ length: field.count }, (_, i) => luminance(readColor(field, i)));
        return Math.max(...lit) - Math.min(...lit);
    };
    const own = Math.max(...ground.map(luminance)) - Math.min(...ground.map(luminance));
    assert.ok(own > 0.05, `the ground has shading to keep: ${own}`);
    assert.ok(near(spread(tinted), own, 1e-5), `tinted, all of it: ${spread(tinted)} of ${own}`);
    assert.ok(spread(normal) < 1e-6, 'a normal blend at full opacity is one flat colour');
    for (let i = 0; i < tinted.count; i += 11) {
        assert.ok(near(luminance(readColor(tinted, i)), luminance(ground[i]), 1e-5), `vertex ${i}`);
    }
});

// --- Free paint through a stroke --------------------------------------------------------

test('a paint stroke colours the ground only where its footprint reaches, and moves no ground at all', () => {
    const field = groundField(80);
    const before = { height: [...field.height], color: [...field.color] };
    const stroke = { kind: 'stroke', points: LINE, stamp: { width: 1200, depth: 1200, corner: 600 }, feather: 0 };
    applyFootprintedElement(field, { type: 'paint', config: { color: [0, 0, 1], blend: 'normal' }, footprint: placeFootprint(stroke) });

    assert.deepEqual([...field.height], before.height, 'not one height moved');
    let inside = 0, outside = 0;
    for (let i = 0; i < field.count; i++) {
        const w = footprintWeight(stroke, fieldX(field, i), fieldZ(field, i), field.size);
        const was = before.color.slice(i * 3, i * 3 + 3);
        const now = readColor(field, i);
        if (w <= 0) {
            assert.ok(now.every((c, k) => near(c, was[k], 1e-6)), `vertex ${i} is outside and was painted`);
            outside++;
        } else if (w >= 1) {
            assert.ok(now.every((c, k) => near(c, [0, 0, 1][k], 1e-6)), `vertex ${i} is inside and was not`);
            inside++;
        }
    }
    assert.ok(inside > 20 && outside > 1000, `${inside} inside, ${outside} outside`);
});

test('a paint placement is picked by its stroke, lies on the Flat gumball, and the airports still wait on Extrude', () => {
    const stroke = { kind: 'stroke', points: LINE, stamp: { width: 1200, depth: 1200, corner: 600 } };
    const placement = { type: 'paint', config: {}, footprint: placeFootprint(stroke) };
    assert.equal(placementAt([placement], 0, 0, DEFAULT_SIZE), 0, 'on the stroke');
    assert.equal(placementAt([placement], 0, 4000, DEFAULT_SIZE), null, 'and nowhere off it');
    assert.equal(gumballKind('paint'), GUMBALL_FLAT);
    assert.equal(templateBuilt('basic-airport'), false, 'an apron is paint, and the buildings beside it are Extrude\'s');
    assert.deepEqual(offeredTemplates().map(template => template.id), ['basic-runway', 'commercial']);
});

test('the colour nearest a point is read off the vertex nearest it, and off the field is nothing', () => {
    const field = createField({ size: 1000, segments: 10, originX: 2000, originZ: -500 });
    paint(field, 3 * field.stride + 4, [0.1, 0.2, 0.3]);
    // Vertex (col 4, row 3) stands at x = 2000 - 500 + 400, z = -500 - 500 + 300.
    assert.deepEqual(nearestColor(field, 1900 + 30, -700 - 40).map(c => Math.round(c * 10) / 10), [0.1, 0.2, 0.3]);
    assert.deepEqual(nearestColor(field, 1900 + 60, -700), readColor(field, 3 * field.stride + 5), 'past halfway is the next');
    assert.equal(nearestColor(field, 1000, -500), null, 'past the west edge');
    assert.equal(nearestColor(field, 2000, 100), null, 'past the north edge');
    assert.notEqual(nearestColor(field, 1500, -1000), null, 'and a corner is on it');
});

// --- The paint tool ----------------------------------------------------------------------

test('Free Paint is built: on the palette, choosable, and a stroke tool beside the cover tool', () => {
    const tool = buildTool('paint');
    assert.equal(tool.element, 'paint');
    assert.equal(tool.heading, 'FREE PAINT');
    assert.equal(tool.mindsLasso, true);
    assert.equal(isBuiltTool('paint'), true);
    assert.equal(isChoosableTool('paint'), true);
    assert.equal(isPaintTool('paint'), true);
    assert.equal(isStrokeTool('paint'), true);
    assert.equal(isCoverTool('paint'), false, 'it is not a cover: no density, and its own brush');
    for (const id of ['grass', 'sand', 'water', 'snow']) assert.equal(isStrokeTool(id), true, id);
    for (const id of ['select', 'lasso', 'mountain', 'runway', 'erase', 'hammer']) {
        assert.equal(isStrokeTool(id), false, id);
        assert.equal(isPaintTool(id), false, id);
    }
});

test('the paint brush is two axes and a size: hard and round, 25 pixels across, as the walkthrough opens on', () => {
    assert.deepEqual(Object.keys(PAINT_BRUSH), ['tip', 'edge', 'size']);
    assert.deepEqual(PAINT_BRUSH.tip.values, ['round', 'square']);
    assert.deepEqual(PAINT_BRUSH.edge.values, ['hard', 'soft']);
    assert.deepEqual(PAINT_BRUSH.size, { kind: 'scalar', low: 5, high: 400, default: 25, slider: true });
    assert.deepEqual(defaultBrush(buildTool('paint')), { tip: 'round', edge: 'hard', size: 25 });
    assert.equal(toolBrush(buildTool('paint')), PAINT_BRUSH);
    assert.deepEqual(toolElementRows(buildTool('paint')), PAINT_ELEMENT_ROWS);
    assert.deepEqual([...PAINT_ELEMENT_ROWS], ['color', 'opacity', 'blend']);
    assert.deepEqual(toolElementRows(buildTool('select')), []);
    assert.ok(Object.isFrozen(PAINT_BRUSH) && Object.values(PAINT_BRUSH).every(Object.isFrozen));
});

// --- Brush sizing -------------------------------------------------------------------------

test('a paint stamp is the brush\'s pixels in world units at the scale under the press', () => {
    assert.deepEqual(paintStamp({ size: 25, tip: 'round', edge: 'hard' }, 32),
        { width: 800, depth: 800, corner: 400, feather: DEFAULT_FEATHER }, 'a round tip is a swept disc');
    assert.deepEqual(paintStamp({ size: 25, tip: 'square', edge: 'hard' }, 32),
        { width: 800, depth: 800, corner: 0, feather: DEFAULT_FEATHER }, 'and a square one has no corner');
    assert.deepEqual(paintStamp({ size: 25, tip: 'round', edge: 'soft' }, 32),
        { width: 800, depth: 800, corner: 400, feather: 800 * SOFT_EDGE }, 'a soft edge eases in across half the width');
    assert.equal(SOFT_EDGE, 0.5);
    assert.equal(paintStamp({ size: 25 }, 3.5).width, 88, 'to the whole unit');
    assert.equal(paintStamp({ size: 5 }, 0.01).width, 1, 'never less than one');
    assert.equal(paintStamp({}, 10).width, 250, 'a brush with no size is the default 25 pixels');
    assert.equal(paintStamp({ size: 'wide' }, 10).width, 250);
    assert.equal(paintStamp({ size: 20 }, 0).width, 20, 'and a scale that is no scale is one unit a pixel');
});

test('the same brush is a different stamp at a different scale, and a stroke laid keeps the one it was laid at', () => {
    const brush = { size: 40, tip: 'round', edge: 'hard' };
    const near_ = paintStamp(brush, 5), far = paintStamp(brush, 50);
    assert.equal(far.width, near_.width * 10, 'ten times the scale, ten times the ground');

    const state = onCanvas();
    assert.equal(layStroke(state, LINE, far, { size: DEFAULT_SIZE }), true);
    const laid = structuredClone(buildDraft(state).footprint);
    setStrokeValues(state, { size: 300 });
    assert.deepEqual(buildDraft(state).footprint, laid, 'a brush resized after leaves the stroke as it was');
    assert.equal(laid.of.stamp.width, 2000);
    assert.equal(laid.of.feather, DEFAULT_FEATHER, 'and the stroke carries the edge it was laid with');
});

test('a stroke tool\'s stamp is its own brush\'s, and a tool that draws no strokes has none', () => {
    const cover = { buildWidth: 60, buildHeight: 40, cornerRadius: 10 };
    assert.deepEqual(strokeStamp(buildTool('grass'), cover, 4), coverStamp(cover, 4));
    assert.deepEqual(strokeStamp(buildTool('paint'), { size: 30 }, 4), paintStamp({ size: 30 }, 4));
    assert.equal(strokeStamp(buildTool('mountain'), {}, 4), null);
    assert.equal(strokeStamp(null, {}, 4), null);
});

test('a paint placement carries the element\'s values and none of the brush\'s', () => {
    const values = { color: [0, 0, 1], opacity: 0.5, blend: 'normal', tip: 'square', edge: 'soft', size: 80 };
    assert.deepEqual(toolPlacement(buildTool('paint'), values, null),
        { type: 'paint', config: { color: [0, 0, 1], opacity: 0.5, blend: 'normal' } });
});

// --- The session ---------------------------------------------------------------------------

test('Free Paint\'s panel starts black, whole, tinted, with the hard round 25 pixel brush', () => {
    const state = onCanvas();
    assert.deepEqual(strokeValues(state), {
        color: [0, 0, 0], opacity: 1, blend: 'tint', tip: 'round', edge: 'hard', size: 25
    });
    assert.equal(brushIsDefault(state), true);
});

test('the first paint stroke begins a batch, the next joins it, and the panel\'s colour is the batch\'s', () => {
    const state = onCanvas();
    const stamp = paintStamp({ size: 25, edge: 'soft' }, 20);
    assert.equal(layStroke(state, LINE, stamp, { size: DEFAULT_SIZE }), true);
    const draft = buildDraft(state);
    assert.equal(draft.type, 'paint');
    assert.deepEqual(draft.config, { color: [0, 0, 0], opacity: 1, blend: 'tint' });
    assert.equal(draft.footprint.of.feather, 250, 'a soft brush\'s feather is the stroke\'s');

    assert.equal(layStroke(state, [[0, 2000], [0, 3000]], paintStamp({ size: 25 }, 20), { size: DEFAULT_SIZE }), true);
    assert.equal(buildDraft(state).footprint.of.kind, 'combine', 'two strokes, one batch');

    assert.equal(setStrokeValues(state, { color: [0, 0, 1] }), true, 'a colour chosen is the whole batch\'s');
    assert.deepEqual(buildDraft(state).config.color, [0, 0, 1]);
    assert.equal(setStrokeValues(state, { tip: 'square', size: 90 }), false, 'and the brush only the strokes to come');
    assert.equal('tip' in buildDraft(state).config, false);

    acceptDraft(state);
    assert.equal(committedPlacements(state).length, 1);
    assert.deepEqual(strokeValues(state).color, [0, 0, 1], 'the next batch starts in the colour left');
    assert.equal(strokeValues(state).size, 90);
});

test('a hard stroke carries the sampling\'s feather, and a stamp with no feather leaves the footprint\'s own', () => {
    const state = onCanvas();
    layStroke(state, LINE, { width: 500, depth: 500, corner: 250 }, { size: DEFAULT_SIZE });
    assert.equal('feather' in buildDraft(state).footprint.of, false, 'the cover tool\'s stamps name none');
    const other = onCanvas();
    layStroke(other, LINE, { width: 500, depth: 500, corner: 250, feather: -3 }, { size: DEFAULT_SIZE });
    assert.equal('feather' in buildDraft(other).footprint.of, false, 'and one that is no feather is not written');
});

test('DEFAULT puts the brush back for the strokes to come, and is lit while the brush is the default', () => {
    const state = onCanvas();
    assert.equal(resetBrush(state), false, 'a default brush is not changed by it');
    setStrokeValues(state, { tip: 'square', edge: 'soft', size: 120, color: [1, 0, 0], opacity: 0.5 });
    assert.equal(brushIsDefault(state), false);
    assert.equal(resetBrush(state), true);
    assert.equal(brushIsDefault(state), true);
    const values = strokeValues(state);
    assert.deepEqual([values.tip, values.edge, values.size], ['round', 'hard', 25]);
    assert.deepEqual([values.color, values.opacity], [[1, 0, 0], 0.5], 'the colour and opacity are not the brush\'s');

    setStrokeValues(state, { size: 26 });
    assert.equal(brushIsDefault(state), false, 'one pixel off is not the default');

    const cover = onCanvas('grass');
    assert.equal(resetBrush(cover), false, 'and it is Free Paint\'s alone');
    assert.equal(brushIsDefault(cover), false);
});

// --- The eye dropper -----------------------------------------------------------------------

test('the eye dropper arms, puts down again, and takes a colour into the panel and the batch in hand', () => {
    const state = onCanvas();
    assert.equal(eyeDropperArmed(state), false);
    assert.equal(toggleEyeDropper(state), true);
    assert.equal(eyeDropperArmed(state), true);
    assert.equal(toggleEyeDropper(state), false, 'pressed again, put down');
    assert.equal(eyeDropperArmed(state), false);

    layStroke(state, LINE, paintStamp({}, 20), { size: DEFAULT_SIZE });
    assert.equal(takeEyeDropperColor(state, [0.2, 0.5, 0.1]), false, 'not armed, nothing is taken');
    toggleEyeDropper(state);
    assert.equal(takeEyeDropperColor(state, [0.2, 0.5]), false, 'nor is anything that is not a colour');
    assert.equal(eyeDropperArmed(state), true, 'which leaves it armed');
    assert.equal(takeEyeDropperColor(state, [0.2, 1.4, -0.1]), true);
    assert.deepEqual(strokeValues(state).color, [0.2, 1, 0]);
    assert.deepEqual(buildDraft(state).config.color, [0.2, 1, 0], 'the batch in hand is in it too');
    assert.equal(eyeDropperArmed(state), false, 'and the dropper is put down');

    const empty = onCanvas();
    toggleEyeDropper(empty);
    assert.equal(takeEyeDropperColor(empty, [1, 1, 0]), true, 'with nothing in hand it is the next batch\'s');
    assert.deepEqual(strokeValues(empty).color, [1, 1, 0]);
    assert.equal(draftPending(empty), false);
});

test('the eye dropper is Free Paint\'s, and is put down by a tool change, a new canvas, a question and Escape', () => {
    const select = onCanvas('select');
    assert.equal(toggleEyeDropper(select), false);
    assert.equal(eyeDropperArmed(select), false);
    select.dropper = true;
    assert.equal(eyeDropperArmed(select), false, 'a flag left up under another tool arms nothing there');
    assert.equal(takeEyeDropperColor(select, [1, 0, 0]), false, 'and takes no colour');

    const state = onCanvas();
    toggleEyeDropper(state);
    chooseBuildTool(state, 'grass');
    chooseBuildTool(state, 'paint');
    assert.equal(eyeDropperArmed(state), false, 'coming back to Free Paint finds it put down');

    toggleEyeDropper(state);
    requestLeave(state);
    assert.equal(eyeDropperArmed(state), false, 'a question holds it');
    answerConfirm(state, CONFIRM_STAY);
    assert.equal(eyeDropperArmed(state), true, 'and called off, it is armed as it was');

    assert.equal(dropEyeDropper(state), true, 'Escape puts it down');
    assert.equal(dropEyeDropper(state), false, 'and a second has nothing to put down');

    toggleEyeDropper(state);
    layStroke(state, LINE, paintStamp({}, 20), { size: DEFAULT_SIZE });
    chooseBuildTool(state, 'grass');
    answerConfirm(state, 'yes');
    assert.equal(state.dropper, false, 'a tool change the question let through puts it down');

    const again = onCanvas();
    toggleEyeDropper(again);
    again.screen = 'picker';
    beginCanvas(again, 'lakeside');
    again.tool = 'paint';
    assert.equal(eyeDropperArmed(again), false, 'and a new canvas opens with it down');
});

// --- The panel ------------------------------------------------------------------------------

test('Free Paint\'s panel is three sections under the artwork\'s headings, one holder behind them all', () => {
    const state = onCanvas();
    const content = dockContent(state, {});
    assert.equal(content.kind, DOCK_PAINT);
    assert.equal(content.heading, 'FREE PAINT');
    assert.deepEqual(content.rows, []);
    assert.deepEqual(content.sections.map(section => section.heading), ['COLOR SELECTION', 'BRUSH SELECTION', 'BRUSH PROPERTIES']);
    assert.deepEqual(content.sections.map(section => section.rows.map(entry => entry.row.label)),
        [['COLOR'], ['TIP', 'EDGE'], ['OPACITY', 'SIZE', 'BLEND']]);
    assert.deepEqual(PAINT_SECTIONS.flatMap(section => section.ranges), Object.keys(strokeRanges('paint')).sort(
        (a, b) => ['color', 'tip', 'edge', 'opacity', 'size', 'blend'].indexOf(a) - ['color', 'tip', 'edge', 'opacity', 'size', 'blend'].indexOf(b)));
    assert.ok(content.sections.every(section => section.holder === content.holder && section.kind === DOCK_PAINT));
    assert.ok(content.sections.every(section => section.rows.every(entry => entry.section === section.id)));
    assert.deepEqual(content.actions, [], 'nothing to settle before a stroke');
    assert.equal(content.dropping, false);

    const brush = content.sections.find(section => section.id === 'paint-brush');
    assert.deepEqual(brush.shapes[0].tools.map(tool => [tool.id, tool.label, tool.live]), [[DOCK_DEFAULT_BRUSH.id, 'DEFAULT', true]]);
    assert.equal(content.sections.filter(section => section.shapes).length, 1, 'DEFAULT is the brush\'s alone');

    setStrokeValues(state, { edge: 'soft' });
    toggleEyeDropper(state);
    const changed = dockContent(state, {});
    assert.equal(changed.sections[1].shapes[0].tools[0].live, false, 'unlit once the brush is changed');
    assert.equal(changed.dropping, true);

    layStroke(state, LINE, paintStamp({}, 20), { size: DEFAULT_SIZE });
    assert.deepEqual(dockContent(state, {}).actions, [DOCK_ACCEPT, DOCK_CANCEL], 'and a batch in hand is settled from it');
});

test('Free Paint\'s holder holds its colour flat, with no shades: it is chosen rather than stepped along a hue', () => {
    const state = onCanvas();
    const holder = strokeHolderFor(state);
    assert.deepEqual(holder.shades, {});
    assert.deepEqual(holder.base, {});
    assert.deepEqual(Object.keys(holder.config), ['color', 'tip', 'edge', 'opacity', 'size', 'blend']);
    holder.config.color[0] = 0.5;
    assert.deepEqual(strokeValues(state).color, [0, 0, 0], 'and is a copy');

    const grass = strokeHolderFor(onCanvas('grass'));
    assert.deepEqual(grass.shades, { color: { light: 1, dark: 1 } }, 'where a cover\'s gradient is shaded, as it was');
});

// --- The colour row ---------------------------------------------------------------------------

test('a colour is one row, read as its hex figure, stepped along the swatches and never typed as a number', () => {
    const range = getElement('paint').ranges.color;
    const [row] = rangeRows('color', range);
    assert.deepEqual(rangeRows('color', range).length, 1);
    assert.equal(row.color, true);
    assert.equal(row.label, 'COLOR');
    assert.equal(isTypedRow(row), false);
    assert.equal(rowValueLabel(row, [0, 0, 0]), '#000000');
    assert.equal(rowValueLabel(row, [0.118, 0.565, 1]), '#1E90FF');
    assert.equal(rangeNotice(row), HEX_NOTICE);

    const holder = { config: { color: [0, 0, 0] } };
    assert.equal(stepRow(holder, 'color', row, 1), true);
    assert.deepEqual(holder.config.color, [0, 0, 1], 'black steps on to blue');
    stepRow(holder, 'color', row, -1);
    stepRow(holder, 'color', row, -1);
    assert.deepEqual(holder.config.color, [1, 1, 1], 'and back past black to white');
    assert.equal(stepRow(holder, 'color', row, -1), false, 'stopping at the first');
    holder.config.color = [0.3, 0.3, 0.3];
    stepRow(holder, 'color', row, 1);
    assert.deepEqual(holder.config.color, [1, 1, 1], 'a colour that is no swatch steps on to the first');
    holder.config.color = [0.3, 0.3, 0.3];
    stepRow(holder, 'color', row, -1);
    assert.deepEqual(holder.config.color, [1, 1, 0], 'and back to the last');
    assert.equal(stepRow(holder, 'color', row, 1), false, 'stopping there');
});

test('a colour written into a row is copied in, held to what a channel holds, and anything else is refused', () => {
    const [row] = rangeRows('color', getElement('paint').ranges.color);
    const holder = { config: { color: [0, 0, 0] } };
    const given = [0.2, 1.3, -0.4];
    writeRowValue(holder, 'color', row, given);
    assert.deepEqual(holder.config.color, [0.2, 1, 0]);
    assert.notEqual(holder.config.color, given);
    for (const value of [[1, 1], 'red', [NaN, 0, 0], null]) {
        writeRowValue(holder, 'color', row, value);
        assert.deepEqual(holder.config.color, [0.2, 1, 0], JSON.stringify(value));
    }
    assert.deepEqual(rowValue(holder, 'color', row), [0.2, 1, 0]);
});

test('the eight swatches are the artwork\'s, in its order, two rows of four', () => {
    assert.deepEqual(COLOR_SWATCHES.map(swatch => swatch.id), ['white', 'black', 'blue', 'green', 'purple', 'orange', 'red', 'yellow']);
    assert.deepEqual(COLOR_SWATCHES.map(swatch => hexColor(swatch.rgb)),
        ['#FFFFFF', '#000000', '#0000FF', '#00FF00', '#FF00FF', '#F15A29', '#FF0000', '#FFFF00']);
    assert.ok(Object.isFrozen(COLOR_SWATCHES) && COLOR_SWATCHES.every(swatch => Object.isFrozen(swatch) && Object.isFrozen(swatch.rgb)));
});

test('a hex figure is six digits or the three short for them, with or without its #, and nothing else', () => {
    assert.deepEqual(parseHex('#FF8000'), [1, 128 / 255, 0]);
    assert.deepEqual(parseHex('ff8000'), [1, 128 / 255, 0]);
    assert.deepEqual(parseHex('  #f80 '), [1, 136 / 255, 0]);
    for (const text of ['', '#', '#12', '#1234', '#12345', '#1234567', '#GG0000', 'red', null, undefined]) {
        assert.equal(parseHex(text), null, String(text));
    }
    for (const swatch of COLOR_SWATCHES) {
        assert.ok(sameColor(parseHex(hexColor(swatch.rgb)), swatch.rgb), swatch.id);
    }
    assert.equal(hexColor([2, -1, 0.5]), '#FF0080', 'a channel past what one holds is written as the most it holds');
    assert.equal(sameColor([0, 0, 0], [0.001, 0, 0]), true, 'two colours a hex figure cannot tell apart are one');
    assert.equal(sameColor([0, 0, 0], [0.01, 0, 0]), false);
    assert.equal(sameColor(null, [0, 0, 0]), false);
});

test('the picker is the greys then once round the hues, each band a share of it on white', () => {
    assert.deepEqual([...PICKER_SHADES], [1, 0.75, 0.5, 0.25]);
    assert.deepEqual(pickerColor(0, 1), [1, 1, 1]);
    assert.deepEqual(pickerColor(1 / (PICKER_STOPS.length - 1), 1), [0, 0, 0]);
    assert.deepEqual(pickerColor(1, 1), [1, 0, 1]);
    assert.deepEqual(pickerColor(2, 1), [1, 0, 1], 'held to the strip');
    assert.deepEqual(pickerColor(-1, 1), [1, 1, 1]);
    const half = pickerColor(1.5 / (PICKER_STOPS.length - 1), 1);
    assert.ok(sameColor(half, [0, 0, 0.5]), `halfway from black to blue: ${half}`);
    assert.ok(sameColor(pickerColor(7 / 8, 0.5), [1, 0.5, 0.5]), 'red at half, the rest white');
    assert.ok(sameColor(pickerColor(1 / 8, 0.25), [0.75, 0.75, 0.75]), 'black at a quarter is a pale grey');
    for (const shade of PICKER_SHADES) {
        for (let u = 0; u <= 1; u += 0.05) {
            const c = pickerColor(u, shade);
            assert.ok(c.every(channel => channel >= 0 && channel <= 1 && near(channel * 255, Math.round(channel * 255), 1e-9)),
                `${u} at ${shade} is a colour a hex figure holds`);
        }
    }
    const style = pickerBandStyle(0.5);
    assert.match(style, /^linear-gradient\(to right, rgb\(255, 255, 255\) 0\.00%, rgb\(128, 128, 128\) 12\.50%/);
    assert.match(style, /rgb\(255, 128, 255\) 100\.00%\)$/);
});

// --- Rows read as a percentage ---------------------------------------------------------------

test('a fraction declared percent reads, types and coarse steps in points, as a gradient end does', () => {
    const [row] = rangeRows('opacity', getElement('paint').ranges.opacity);
    assert.equal(readsAsPercent(row), true);
    assert.equal(rowValueLabel(row, 0.4), '40%');
    assert.equal(typedRowValue(row, 40), 0.4);
    assert.equal(fieldFigure(row, 0.4), 40);
    assert.equal(rangeNotice(row), '0% TO 100%');
    assert.equal(coarseStep(row, 1) * 0.02, COARSE_POINTS / 100, 'ten points a coarse step');

    const holder = { config: { opacity: 1 } };
    stepRow(holder, 'opacity', row, coarseStep(row, -1));
    assert.equal(holder.config.opacity, 0.9);
    stepRow(holder, 'opacity', row, -1);
    assert.equal(holder.config.opacity, 0.88, 'and a plain step a fiftieth');

    const [size] = rangeRows('size', PAINT_BRUSH.size);
    assert.equal(readsAsPercent(size), false);
    assert.equal(rowValueLabel(size, 25), '25');
    const [light] = rangeRows('color', getElement('grass').ranges.color);
    assert.equal(readsAsPercent(light), true, 'and a gradient end still does');
    assert.equal(readsAsPercent(null), false);
});

// --- Strokes land as they are drawn ----------------------------------------------------------

/** True for a point inside a closed outline, by the crossings of a ray east of it. */
function inside(loop, x, z) {
    let within = false;
    for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
        const [xi, zi] = loop[i], [xj, zj] = loop[j];
        if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) within = !within;
    }
    return within;
}

/**
 * The region a stroke is drawn as while it is being made is the region its
 * footprint will hold: walked over a grid round strokes straight, bent back on
 * themselves and pressed once, round and square, a point covered by the
 * footprint is inside the drawing and one it does not reach is outside -
 * except within a hair of the edge, where a curve drawn in straight pieces
 * and the measure disagree by less than the pieces are long.
 */
test('a stroke is drawn as exactly the region its footprint will cover', () => {
    const strokes = [
        { points: [[0, 0], [1200, 0], [1800, 900], [600, 1500]], stamp: { width: 400, depth: 400, corner: 200 } },
        { points: [[0, 0], [1200, 0], [1800, 900], [600, 1500]], stamp: { width: 400, depth: 400, corner: 0 } },
        { points: [[0, 0], [1000, 200], [0, 400]], stamp: { width: 300, depth: 500, corner: 60 } },
        { points: [[500, 500]], stamp: { width: 600, depth: 300, corner: 100 } },
        { points: [[500, 500], [500, 500]], stamp: { width: 600, depth: 300, corner: 0 } }
    ];
    for (const { points, stamp } of strokes) {
        const loops = strokeRibbon({ points, stamp });
        assert.ok(loops.length > 0);
        const footprint = { kind: 'stroke', points, stamp, feather: 0 };
        let checked = 0;
        for (let x = -800; x <= 2800; x += 37) {
            for (let z = -800; z <= 2400; z += 41) {
                const covered = footprintWeight(footprint, x, z) > 0;
                const drawn = loops.some(loop => inside(loop, x, z));
                if (covered === drawn) { checked++; continue; }
                // Off by a sliver: the measure a hair either side of here disagrees.
                const edge = [[6, 0], [-6, 0], [0, 6], [0, -6]].some(([dx, dz]) => (footprintWeight(footprint, x + dx, z + dz) > 0) !== covered);
                assert.ok(edge, `${JSON.stringify(points)} at ${x}, ${z}: covered ${covered}, drawn ${drawn}`);
            }
        }
        assert.ok(checked > 3000);
    }
});

test('every outline of a stroke runs the same way round, so the overlaps are filled once', () => {
    const loops = strokeRibbon({ points: [[0, 0], [1000, 0], [1000, 1000], [0, 0]], stamp: { width: 300, depth: 300, corner: 150 } });
    for (const loop of loops) {
        let area = 0;
        for (let i = 0; i < loop.length; i++) {
            const [x1, z1] = loop[i], [x2, z2] = loop[(i + 1) % loop.length];
            area += x1 * z2 - x2 * z1;
        }
        assert.ok(area > 0, 'anticlockwise');
    }
    assert.deepEqual(strokeRibbon({ points: [], stamp: { width: 10, depth: 10 } }), []);
    assert.deepEqual(strokeRibbon({ points: [[0, 0]], stamp: { width: 0, depth: 10 } }), []);
    assert.deepEqual(strokeRibbon({ points: [[0, NaN]], stamp: { width: 10, depth: 10 } }), []);
    assert.deepEqual(strokeRibbon(), []);
});

test('a paint stroke being drawn is shown in its colour, as solid as its opacity within what lets the ground show', () => {
    assert.equal(paintTrailColour([0, 0, 1], 1), 'rgba(0, 0, 255, 0.70)');
    assert.equal(paintTrailColour([1, 0.5, 0], 0), 'rgba(255, 128, 0, 0.25)');
    assert.equal(paintTrailColour([2, -1, 0], 3), 'rgba(255, 0, 0, 0.70)');
    assert.equal(paintTrailColour(null), 'rgba(0, 0, 0, 0.70)');

    const calls = [];
    const ctx = new Proxy({}, {
        get: (_, name) => (...args) => calls.push([name, ...args]),
        set: (_, name, value) => { calls.push([`=${String(name)}`, value]); return true; }
    });
    fillRegion(ctx, [[{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }], [{ x: 1, y: 1 }, { x: 2, y: 2 }]], 'red');
    assert.deepEqual(calls.map(call => call[0]), ['=fillStyle', 'beginPath', 'moveTo', 'lineTo', 'lineTo', 'closePath', 'fill'],
        'one path, a run too short to enclose anything left out');
    assert.deepEqual(calls.at(-1), ['fill', 'nonzero']);
    calls.length = 0;
    fillRegion(ctx, [], 'red');
    fillRegion(ctx, [[{ x: 0, y: 0 }]], null);
    assert.deepEqual(calls, [], 'and nothing to fill draws nothing');
});
