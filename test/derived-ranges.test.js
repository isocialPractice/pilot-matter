/**
 * Derived ranges are hidden - nothing a tool's placement shows on the panel
 * is a figure the ground is built without. A range its footprint already
 * determines is taken off the panel, and every row left on it is held to
 * this: stepped either way, it changes the ground the placement draws.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEnvironment } from '../js/environment/presets.js';
import { placeFootprint } from '../js/environment/footprints.js';
import { getElement, DEFAULT_SEGMENTS } from '../js/environment/elements.js';
import { draftHolderFor, panelRanges } from '../js/build-panel.js';
import { panelRows, rangeRows, stepRow } from '../js/properties-panel.js';
import { placeTemplate } from '../js/templates.js';

const ENV = { id: 'derived', seed: 9, base: { maxHeight: 500, scale: 3 }, elements: [] };
const STROKE = placeFootprint({
    kind: 'stroke', points: [[-3000, -500], [0, 600], [3000, -200]], stamp: { width: 1600, depth: 1600, corner: 800 }
});
const BOX = placeFootprint({ kind: 'rect', x: 0, z: 0, width: 3000, depth: 2000, angle: 0, corner: 0 });

/** A placement of each kind a tool makes: a stroke for each cover and paint, a box lifted, a mountain dropped, the runway templates. */
const MADE = [
    { type: 'grass',   config: { density: 0.5 }, footprint: STROKE },
    { type: 'sand',    config: { density: 0.5 }, footprint: STROKE },
    { type: 'water',   config: { density: 0.6 }, footprint: STROKE },
    { type: 'snow',    config: { density: 0.6 }, footprint: STROKE },
    { type: 'paint',   config: { color: [0.8, 0.2, 0.2] }, footprint: STROKE },
    { type: 'extrude', config: {}, footprint: BOX },
    { type: 'mountain', config: { at: [0, 0], count: 1 }, seed: 12345 },
    placeTemplate('basic-runway', [0, 0], 0),
    placeTemplate('basic-airport', [0, 0], 0)
];

// Fine enough that a footprint's feathered band always has vertices in it -
// coarser, and a wall's colour can fall between them and read as ignored.
const SEGMENTS = DEFAULT_SEGMENTS / 2;
const build = placement => buildEnvironment(ENV, { segments: SEGMENTS, elements: [placement] });
const same = (a, b) => a.height.every((h, i) => Math.abs(h - b.height[i]) < 1e-4)
    && a.color.every((c, i) => Math.abs(c - b.color[i]) < 1e-5);
const named = placement => placement.template ? `${placement.type}:${placement.template}` : placement.type;

/**
 * The two holders a row is judged between when stepped `step` presses - the
 * ground as it was, and as the step leaves it - or null where the row does
 * not step that way. A switch and the bounds it opens are read through each
 * other: a switch turned on with its bounds where they were draws the same
 * ground, so one is moved with it; and a bound behind a switch that is off is
 * read with the switch on, since off is what the switch is for.
 */
function stepped(holder, ranges, entry, step) {
    const rows = rangeRows(entry.name, ranges[entry.name]);
    const from = structuredClone(holder);
    if (entry.row.gated) {
        const gate = rows.find(row => row.gate);
        if (gate) stepRow(from, entry.name, gate, 1);
    }
    const moved = structuredClone(from);
    if (!stepRow(moved, entry.name, entry.row, step)) return null;
    if (entry.row.gate) for (const row of rows.filter(each => each.gated)) stepRow(moved, entry.name, row, -5);
    return [from, moved];
}

for (const placement of MADE) {
    test(`every row ${named(placement)}'s panel shows changes the ground it draws`, () => {
        const ranges = panelRanges(placement);
        const holder = draftHolderFor(placement);
        const drawn = held => build({ ...placement, config: { ...placement.config, ...held.config } });
        const live = panelRows(ranges, holder, {}).filter(entry => entry.live);
        assert.ok(live.length > 0, 'it shows something');

        for (const entry of live) {
            const tries = [5, -5].map(step => stepped(holder, ranges, entry, step)).filter(Boolean);
            assert.ok(tries.length > 0, `${entry.row.label} steps`);
            const read = tries.some(([from, moved]) => !same(drawn(from), drawn(moved)));
            assert.ok(read, `${named(placement)} ${entry.row.label} is shown and changes nothing`);
        }
    });
}

test('what a footprint settles is off the panel, and an extrusion\'s level with it', () => {
    const extrusion = panelRanges(MADE.find(placement => placement.type === 'extrude'));
    assert.equal('level' in extrusion, false, 'the mean of the ground the footprint covers');
    assert.ok(['height', 'flatten', 'topColor', 'wallColor', 'blend'].every(name => name in extrusion));
    assert.deepEqual(getElement('extrude').footprintSettles, { level: 'mean', drawn: 'edge' });

    const water = panelRanges(MADE.find(placement => placement.type === 'water'));
    assert.equal('level' in water, false, 'drawn water\'s level');
    assert.equal('count' in panelRanges(MADE.find(placement => placement.type === 'mountain')), false, 'a dropped mountain is one');
});
