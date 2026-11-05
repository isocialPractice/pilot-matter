/**
 * Extrude - the one tool with stages: shapes drawn on the ground, the region
 * they come to levelled and pulled up, then its surfaces coloured.
 *
 * Its shapes are the vocabulary's, seven of the ten the lasso draws, under the
 * artwork's names and cut from its panel; see `js/shapes.js`. What Extrude does
 * with a region is its own: it lifts it, where the lasso selects it.
 *
 * The stages are where a draft has got to, carried on the draft beside the
 * placement because the panel, its one button, the gumball and the pointer all
 * read it:
 *
 * | Stage | The button | What is happening |
 * | --- | --- | --- |
 * | drawing | `EXTRUDE`, enabled once the region covers ground | Shapes are added to the region, as many as wanted |
 * | extruding | `EDIT EXTRUSION` | The region is levelled and raised, and the gumball's blue arrow sets its height |
 * | surfaces | `APPLY`, and `BACK` | The gumball is put away; a click on the top or the wall points the panel at its colour |
 *
 * Pure module with no DOM or Three.js dependency, so the stages can be unit
 * tested in Node.
 */

import { BUILDER_ART } from './build-tools.js';
import { modeTools } from './shapes.js';

/** What Extrude's panel is headed, in the artwork's words. */
export const EXTRUDE_HEADING = 'EXTRUDE SHAPE';

/**
 * Extrude's art: its whole panel as the artwork draws it, from which each
 * shape's icon is cut by a view of its own box, as the lasso's are.
 */
export const EXTRUDE_ART = `${BUILDER_ART}/extrude-tools.svg`;

/** The rows the artwork groups the seven into: `DRAW SHAPE` in two, then `DRAW CURVE / CUSTOM SHAPE`. */
export const EXTRUDE_ROWS = Object.freeze(['row-shapes-1', 'row-shapes-2', 'row-curves']);

/**
 * The seven, in the artwork's order, each a shape of the vocabulary under the
 * name its tile carries - a Circle is the lasso's ellipse, and a Polycurve its
 * curved polyline - with the box its icon is drawn in on `EXTRUDE_ART`.
 */
export const EXTRUDE_TOOLS = modeTools([
    { id: 'rectangle', shape: 'rectangle',       label: 'RECTANGLE', row: 'row-shapes-1', art: [22.5, 116.4, 51.4, 42.4] },
    { id: 'circle',    shape: 'ellipse',         label: 'CIRCLE',    row: 'row-shapes-1', art: [107.4, 116.4, 42.4, 42.4] },
    { id: 'triangle',  shape: 'triangle',        label: 'TRIANGLE',  row: 'row-shapes-1', art: [183.3, 115.6, 48.1, 43.2] },
    { id: 'polygon',   shape: 'polygon',         label: 'POLYGON',   row: 'row-shapes-2', art: [56, 203.3, 51.3, 41.6] },
    { id: 'star',      shape: 'star',            label: 'STAR',      row: 'row-shapes-2', art: [140.9, 200.9, 45.6, 43.6] },
    { id: 'polyline',  shape: 'polyline',        label: 'POLYLINE',  row: 'row-curves',   art: [45.4, 297.2, 49.7, 32.6] },
    { id: 'polycurve', shape: 'curved-polyline', label: 'POLYCURVE', row: 'row-curves',   art: [144.2, 299.3, 65.2, 27.3] }
]);

/** The shape Extrude starts on: Rectangle, the first the artwork draws. */
export const DEFAULT_EXTRUDE_TOOL = 'rectangle';

export function extrudeTool(id) {
    return EXTRUDE_TOOLS.find(tool => tool.id === id) ?? null;
}

/** The panel's rows of tiles: the artwork's rows, each holding its shapes. */
export function extrudeRows() {
    return EXTRUDE_ROWS
        .map(row => ({ row, tools: EXTRUDE_TOOLS.filter(tool => tool.row === row) }))
        .filter(row => row.tools.length > 0);
}

/** A shape's icon: the art, viewed through the shape's own box. */
export function extrudeToolArt(id) {
    const tool = extrudeTool(id);
    return tool ? `${EXTRUDE_ART}#svgView(viewBox(${tool.art.join(',')}))` : null;
}

/** A shape's name as a sentence says it: `Rectangle`. */
export function extrudeToolName(id) {
    const label = extrudeTool(id)?.label ?? '';
    return label.charAt(0) + label.slice(1).toLowerCase();
}

// --- The stages -----------------------------------------------------------------------

export const EXTRUDE_DRAWING   = 'drawing';
export const EXTRUDE_EXTRUDING = 'extruding';
export const EXTRUDE_SURFACES  = 'surfaces';

/** The id of the one button the stages share. */
export const EXTRUDE_STAGE_ACTION = 'extrude-stage';

/** What the one button says at each stage, and the stage it takes the draft on to. */
export const EXTRUDE_STAGES = Object.freeze({
    [EXTRUDE_DRAWING]:   Object.freeze({ label: 'EXTRUDE',        next: EXTRUDE_EXTRUDING }),
    [EXTRUDE_EXTRUDING]: Object.freeze({ label: 'EDIT EXTRUSION', next: EXTRUDE_SURFACES }),
    [EXTRUDE_SURFACES]:  Object.freeze({ label: 'APPLY',          next: EXTRUDE_EXTRUDING })
});

/**
 * The element's ranges each stage's panel carries: none while drawing, when the
 * panel is the shapes and the chosen one's own fields; the height and how flat
 * the top is while extruding; and the two surfaces' colours and how they meet
 * the ground - narrowed to the one surface clicked, once one is; see
 * `surfaceRows`.
 */
export const EXTRUDE_STAGE_ROWS = Object.freeze({
    [EXTRUDE_DRAWING]:   Object.freeze([]),
    [EXTRUDE_EXTRUDING]: Object.freeze(['height', 'flatten']),
    [EXTRUDE_SURFACES]:  Object.freeze(['topColor', 'wallColor', 'blend'])
});

/**
 * The two surfaces a heightfield extrusion has - the top, which its footprint
 * wholly covers, and the wall, the band at its edge - and the colour each is
 * painted, which is what a click on one points the panel at. There are two,
 * not a face to each side: nothing in a heightfield tells the north wall from
 * the south one.
 */
export const EXTRUDE_SURFACES_DECLARED = Object.freeze({ top: 'topColor', wall: 'wallColor' });

/** The rows the surfaces panel carries with a surface clicked: its colour, and the blend both surfaces share. */
export function surfaceRows(surface) {
    const color = EXTRUDE_SURFACES_DECLARED[surface];
    return color ? [color, 'blend'] : [...EXTRUDE_STAGE_ROWS[EXTRUDE_SURFACES]];
}

/**
 * How much of the footprint a point under the top has: the whole of it. A
 * footprint's weight eases to exactly 1 a feather inside its edge, and the
 * `extrude` element paints every vertex short of that the wall's colour.
 */
export const TOP_WEIGHT = 1;

/**
 * Which surface the extrusion's footprint makes a point with weight `weight`:
 * the top where the footprint wholly covers it, the wall across the band at
 * its edge, and neither off it - as the `extrude` element paints them.
 */
export function surfaceAt(weight) {
    if (!(weight > 0)) return null;
    return weight >= TOP_WEIGHT ? 'top' : 'wall';
}

/** The answer beside `APPLY` that comes back from the surfaces with the colours as they were. */
export const EXTRUDE_BACK = Object.freeze({ id: 'extrude-back', label: 'BACK' });

/**
 * The one button as a stage shows it: its label, and whether it can be pressed
 * - which while drawing is once the region covers some ground, and at every
 * other stage always.
 */
export function extrudeStageAction(stage, ready = false) {
    const at = EXTRUDE_STAGES[stage] ?? EXTRUDE_STAGES[EXTRUDE_DRAWING];
    const enabled = stage !== EXTRUDE_DRAWING && EXTRUDE_STAGES[stage] != null ? true : ready === true;
    return { id: EXTRUDE_STAGE_ACTION, label: at.label, disabled: !enabled };
}
