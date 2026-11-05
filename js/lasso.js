/**
 * The lasso - the second tile on the palette, which is a mode with ten tools of
 * its own rather than a tool, and the selection those tools draw.
 *
 * The ten are shapes of the vocabulary in `js/shapes.js`, which Extrude draws
 * from as well: what a gesture comes to is written there once, and the lasso
 * declares which shapes it offers, under its own names and with its own art.
 * A tool is drawn only once the kind it draws is one
 * `js/environment/footprints.js` can read - the rule the palette keeps for its
 * own tiles - and all ten now are.
 *
 * A shape meets a selection already there one of three ways, read once at the
 * press: added to it with `shift`, cut out of it with `alt`, or drawn inside it
 * with neither - and with nothing selected, a shape is simply the selection.
 * `shift` pressed again once a drag is under way is the other thing the key
 * means: it keeps a box square and an ellipse round.
 *
 * Pure module with no DOM or Three.js dependency, so what a gesture comes to
 * can be unit tested in Node.
 */

import { isFootprint, combineFootprints, footprintSampler, footprintBounds } from './environment/footprints.js';
import { BUILDER_ART } from './build-tools.js';
import {
    SHAPE_DRAG, SHAPE_CLICKS, MIN_REGION as SHAPE_MIN_REGION, modeTools, shapeBuilt, shapeFootprint, reshapeShape
} from './shapes.js';

/** What the lasso's panel is headed, in the artwork's words. */
export const LASSO_HEADING = 'LASSO SELECT TOOLS';

/** The two gestures every lasso tool is one of: the vocabulary's own. */
export const LASSO_DRAG   = SHAPE_DRAG;
export const LASSO_CLICKS = SHAPE_CLICKS;

/**
 * The lasso's art: the whole sub-palette as the artwork draws it, from which
 * each tile's icon is cut by a view of its own box. One file rather than ten,
 * because the ten single-tool exports are the same panel with one tile lit.
 */
export const LASSO_ART = `${BUILDER_ART}/lasso-tools.svg`;

/** The rows the artwork groups the ten into, in its order. */
export const LASSO_ROWS = Object.freeze(['row-shapes-1', 'row-shapes-2', 'row-polygons', 'row-curves']);

/**
 * The ten, in the artwork's order, each a shape of the vocabulary under the name
 * its tile carries, the row it sits in, and the box its icon is drawn in on
 * `LASSO_ART` - measured off the art, a little padding round the icon and none
 * of its label, which the page writes instead. The kind each draws, its
 * gesture and its own fields are the shape's; see `SHAPES`.
 */
export const LASSO_TOOLS = modeTools([
    { id: 'free',            label: 'FREE SELECT',            row: 'row-shapes-1', art: [24.1, 97.64, 29.23, 26.1] },
    { id: 'rectangle',       label: 'RECTANGLE SELECT',       row: 'row-shapes-1', art: [101.61, 94.73, 39.61, 29.43] },
    { id: 'ellipse',         label: 'ELLIPSE SELECT',         row: 'row-shapes-1', art: [189.46, 94.73, 37.61, 29.43] },
    { id: 'round-rect',      label: 'ROUND RECT. SELECT',     row: 'row-shapes-2', art: [20.47, 159.79, 52.76, 31.36] },
    { id: 'triangle',        label: 'TRIANGLE SELECT',        row: 'row-shapes-2', art: [121.82, 159.79, 42.25, 31.35] },
    { id: 'star',            label: 'STAR SELECT',            row: 'row-shapes-2', art: [205.85, 156.1, 33.6, 34.35] },
    { id: 'polygon',         label: 'POLYGON SELECT',         row: 'row-polygons', art: [56.79, 223.71, 52.55, 30.11] },
    { id: 'polyline',        label: 'POLYLINE SELECT',        row: 'row-polygons', art: [143.38, 223.71, 52.55, 32.11] },
    { id: 'curved-polygon',  label: 'CURVED POLYGON SELECT',  row: 'row-curves',   art: [46.57, 290.68, 45.35, 27.81] },
    { id: 'curved-polyline', label: 'CURVED POLYLINE SELECT', row: 'row-curves',   art: [166.16, 286.41, 49.22, 37.69] }
]);

/** The tool a lasso starts on: Free Select, the first the artwork draws. */
export const DEFAULT_LASSO_TOOL = 'free';

export function lassoTool(id) {
    return LASSO_TOOLS.find(tool => tool.id === id) ?? null;
}

/** True for a lasso tool whose kind of region can be drawn today. */
export function lassoToolBuilt(id) {
    const tool = lassoTool(id);
    return tool != null && shapeBuilt(tool.shape);
}

/**
 * The sub-palette as it is drawn: the artwork's rows, each holding the tools
 * in it that are built, and a row left with none of them left out.
 */
export function lassoRows() {
    return LASSO_ROWS
        .map(row => ({ row, tools: LASSO_TOOLS.filter(tool => tool.row === row && lassoToolBuilt(tool.id)) }))
        .filter(row => row.tools.length > 0);
}

/** A tool's icon: the art, viewed through the tool's own box. */
export function lassoToolArt(id) {
    const tool = lassoTool(id);
    return tool ? `${LASSO_ART}#svgView(viewBox(${tool.art.join(',')}))` : null;
}

/** A tool's name as a sentence says it: `Free select`. */
export function lassoToolName(id) {
    const label = lassoTool(id)?.label ?? '';
    return label.charAt(0) + label.slice(1).toLowerCase();
}

// --- What a gesture comes to -------------------------------------------------------

/** The least a drawn shape may measure across, in world units: the vocabulary's. */
export const MIN_REGION = SHAPE_MIN_REGION;

/**
 * The region a lasso tool draws, from the ground points its gesture gave and
 * the values on its panel - the shape's footprint, see `shapeFootprint` - or
 * null for a tool the lasso does not offer and for anything that is not a
 * region.
 */
export function lassoFootprint(id, points = [], values = {}, options = {}) {
    const tool = lassoTool(id);
    return tool ? shapeFootprint(tool.shape, points, values, options) : null;
}

/** How near, in screen pixels, a click must land to a vertex to close the shape on it. */
export const CLOSE_PIXELS = 12;

/**
 * A click with a click-per-vertex tool: the shape being drawn - `{ points,
 * screens }`, the ground points so far and where each was on the screen - with
 * the click added, or closed.
 *
 * A click on the first point closes the shape, and so does a click on the last
 * one again, which is what a double click is: two presses on one spot. Either
 * needs three points before it to close a region; with fewer, a click on a
 * point already placed adds nothing, so a stray double click starts nothing.
 * A click that missed the ground - over the sky - adds nothing either.
 *
 * Returns `{ points, screens, closed }`, a new shape rather than the old one
 * changed.
 */
export function clickVertex(shape, ground, screen) {
    const points  = [...(shape?.points ?? [])];
    const screens = [...(shape?.screens ?? [])];
    const near = target => target != null && screen != null
        && Math.hypot(screen.x - target.x, screen.y - target.y) <= CLOSE_PIXELS;

    if (points.length >= 3 && (near(screens[0]) || near(screens.at(-1)))) {
        return { points, screens, closed: true };
    }
    if (ground == null || screens.some(near)) return { points, screens, closed: false };

    points.push({ x: ground.x, z: ground.z });
    screens.push({ x: screen.x, y: screen.y });
    return { points, screens, closed: false };
}

/** True for a footprint a selection can be: one the region arithmetic can read. */
export function isSelection(footprint) {
    return isFootprint(footprint);
}

// --- A shape against a selection --------------------------------------------------

/** How a shape is combined with the selection, by the key held at its press. */
export const LASSO_ADD      = 'union';
export const LASSO_CUT      = 'subtract';
export const LASSO_WITHIN   = 'intersect';

/**
 * The way a shape meets the selection, read once, at the press: `shift` adds it,
 * `alt` cuts it out, and neither draws it inside - which is the clip every tool
 * that minds the lasso already has. With nothing selected there is nothing to
 * draw inside, so the default is to add, and the shape becomes the selection.
 *
 * Read at the press and never again, so a shape does not change what it does
 * halfway through because a key came up early.
 */
export function lassoOp({ shiftKey = false, altKey = false } = {}, selected = false) {
    if (altKey) return LASSO_CUT;
    if (shiftKey) return LASSO_ADD;
    return selected ? LASSO_WITHIN : LASSO_ADD;
}

/**
 * The selection a shape leaves: the shape itself where nothing was selected and
 * it adds, the two combined by its op where something was, and nothing at all
 * where it cuts out of nothing. Null where the shape is no region.
 */
export function combineSelection(selection, shape, op) {
    if (shape == null) return selection ?? null;
    if (selection == null) return op === LASSO_CUT ? null : shape;
    return combineFootprints(op, selection, shape);
}

/**
 * True for a region that covers any ground on a canvas `size` wide - which a
 * shape drawn inside a selection it does not touch, or one cut out of the
 * whole of it, does not. Sampled across its square rather than weighed
 * everywhere, finely enough that a sliver a few cells wide is found.
 */
export function coversGround(footprint, size = 0) {
    const square = footprintBounds(footprint);
    if (square == null) return false;
    const weigh = footprintSampler(footprint, size);
    const across = 96;
    for (let j = 0; j <= across; j++) {
        for (let i = 0; i <= across; i++) {
            const x = square.minX + (square.maxX - square.minX) * i / across;
            const z = square.minZ + (square.maxZ - square.minZ) * j / across;
            if (weigh(x, z) > 0) return true;
        }
    }
    return false;
}

/**
 * A region drawn by a lasso tool, reshaped by the values on its panel - see
 * `reshapeShape`. Null for a region the tool did not draw.
 */
export function reshapeFootprint(footprint, id, values = {}) {
    const tool = lassoTool(id);
    return tool ? reshapeShape(footprint, tool.shape, values) : null;
}

/**
 * Whether a drag is kept square, from `shift` as it is now and as it was. A
 * `shift` held from the press is the add, latched there, and keeps nothing
 * square; once it has been up, pressing it again does. Returns the drag's new
 * reading, `{ shiftUp, square }`.
 */
export function squareInDrag(drawing, shiftKey) {
    const shiftUp = Boolean(drawing?.shiftUp) || !shiftKey;
    return { shiftUp, square: Boolean(shiftKey) && shiftUp };
}
