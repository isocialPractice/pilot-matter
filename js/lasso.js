/**
 * The lasso - the second tile on the palette, which is a mode with ten tools of
 * its own rather than a tool, and the shapes those tools draw.
 *
 * A tool is a gesture; a footprint kind is what the region it draws turns out
 * to be. Several tools make the same kind by different means - Free Select and
 * Polyline Select are both a `ring`, gathered as the pointer moves or a point a
 * click - so the ten come down to a handful of kinds and to two ways of
 * drawing: a **drag**, pressed, moved and let go, and **a click per vertex**,
 * closed by clicking the first point again or the last one twice.
 *
 * A tool is drawn only once the kind it draws is one `js/environment/footprints.js`
 * can read - the rule the palette keeps for its own tiles - and all ten now are.
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

import {
    FOOTPRINT_KINDS, isFootprint, combineFootprints, footprintSampler, footprintBounds, flattenPath
} from './environment/footprints.js';
import { scalar } from './environment/elements.js';
import { BUILDER_ART } from './build-tools.js';

/** What the lasso's panel is headed, in the artwork's words. */
export const LASSO_HEADING = 'LASSO SELECT TOOLS';

/** The two gestures every lasso tool is one of. */
export const LASSO_DRAG   = 'drag';
export const LASSO_CLICKS = 'clicks';

/**
 * The lasso's art: the whole sub-palette as the artwork draws it, from which
 * each tile's icon is cut by a view of its own box. One file rather than ten,
 * because the ten single-tool exports are the same panel with one tile lit.
 */
export const LASSO_ART = `${BUILDER_ART}/lasso-tools.svg`;

/** The rows the artwork groups the ten into, in its order. */
export const LASSO_ROWS = Object.freeze(['row-shapes-1', 'row-shapes-2', 'row-polygons', 'row-curves']);

/**
 * The ten, in the artwork's order, each with the name its tile carries, the row
 * it sits in, the footprint kind it draws, its gesture, and the box its icon is
 * drawn in on `LASSO_ART` - measured off the art, a little padding round the
 * icon and none of its label, which the page writes instead.
 *
 * `ranges` are the tool's own fields, drawn under the tiles while it is the
 * chosen tool, and `fields` says which value of the region each one is - so a
 * value changed after the region is drawn reshapes the region, rather than
 * asking for it to be drawn again.
 */
export const LASSO_TOOLS = Object.freeze([
    { id: 'free',            label: 'FREE SELECT',            row: 'row-shapes-1', kind: 'ring',    gesture: LASSO_DRAG,   art: [24.1, 97.64, 29.23, 26.1] },
    { id: 'rectangle',       label: 'RECTANGLE SELECT',       row: 'row-shapes-1', kind: 'rect',    gesture: LASSO_DRAG,   art: [101.61, 94.73, 39.61, 29.43] },
    { id: 'ellipse',         label: 'ELLIPSE SELECT',         row: 'row-shapes-1', kind: 'ellipse', gesture: LASSO_DRAG,   art: [189.46, 94.73, 37.61, 29.43] },
    {
        id: 'round-rect', label: 'ROUND RECT. SELECT', row: 'row-shapes-2', kind: 'rect', gesture: LASSO_DRAG,
        art: [20.47, 159.79, 52.76, 31.36],
        // How round the corners are, in world units: the radius of the arc
        // each corner is cut to, held to half the shorter side when it is drawn.
        ranges: Object.freeze({ corner: scalar(0, 4000, 600) }),
        fields: Object.freeze({ corner: 'corner' })
    },
    { id: 'triangle',        label: 'TRIANGLE SELECT',        row: 'row-shapes-2', kind: 'polygon', gesture: LASSO_DRAG,   art: [121.82, 159.79, 42.25, 31.35], sides: 3 },
    {
        id: 'star', label: 'STAR SELECT', row: 'row-shapes-2', kind: 'polygon', gesture: LASSO_DRAG,
        art: [205.85, 156.1, 33.6, 34.35],
        // How many points it has, and how far in between them it is drawn,
        // as a share of how far out the points reach.
        ranges: Object.freeze({
            numberOfPoints: Object.freeze({ ...scalar(3, 12, 5), step: 1 }),
            starRatio: scalar(0.1, 0.9, 0.45)
        }),
        fields: Object.freeze({ numberOfPoints: 'sides', starRatio: 'inner' })
    },
    {
        id: 'polygon', label: 'POLYGON SELECT', row: 'row-polygons', kind: 'polygon', gesture: LASSO_DRAG,
        art: [56.79, 223.71, 52.55, 30.11],
        ranges: Object.freeze({ numberOfSides: Object.freeze({ ...scalar(3, 12, 6), step: 1 }) }),
        fields: Object.freeze({ numberOfSides: 'sides' })
    },
    { id: 'polyline',        label: 'POLYLINE SELECT',        row: 'row-polygons', kind: 'ring',    gesture: LASSO_CLICKS, art: [143.38, 223.71, 52.55, 32.11] },
    { id: 'curved-polygon',  label: 'CURVED POLYGON SELECT',  row: 'row-curves',   kind: 'path',    gesture: LASSO_CLICKS, art: [46.57, 290.68, 45.35, 27.81] },
    { id: 'curved-polyline', label: 'CURVED POLYLINE SELECT', row: 'row-curves',   kind: 'path',    gesture: LASSO_CLICKS, art: [166.16, 286.41, 49.22, 37.69] }
].map(tool => Object.freeze(tool)));

/** The tool a lasso starts on: Free Select, the first the artwork draws. */
export const DEFAULT_LASSO_TOOL = 'free';

export function lassoTool(id) {
    return LASSO_TOOLS.find(tool => tool.id === id) ?? null;
}

/** True for a lasso tool whose kind of region can be drawn today. */
export function lassoToolBuilt(id) {
    const tool = lassoTool(id);
    return tool != null && FOOTPRINT_KINDS.includes(tool.kind);
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

/**
 * The least a drawn shape may measure across, in world units, and still be a
 * region rather than a slip of the pointer: a box dragged a few pixels selects
 * nothing rather than a sliver.
 */
export const MIN_REGION = 40;

/** Two points nearer than this are one point, in world units. */
const SAME_POINT = 1;

/**
 * The region a lasso tool draws, from the ground points its gesture gave -
 * `{ x, z }` each, in the canvas's frame - and the values on its panel. Null
 * for anything that is not a region: a ring of fewer than three distinct points
 * or no area, a box or an ellipse thinner than `MIN_REGION`, or a tool whose
 * kind cannot be drawn yet.
 *
 * - **A ring** is the points as they came, each one that landed on the one
 *   before it dropped.
 * - **A box** is the two corners a drag spans, square to the canvas, its
 *   corners rounded to the panel's `corner` and held to half its shorter side.
 * - **An ellipse** fills the box a drag spans.
 * - **A regular figure** stands on the press, its first corner where the
 *   pointer is, so the drag sizes it and turns it; its sides and its points'
 *   depth are the panel's.
 * - **A curve** runs smoothly through the points clicked, round the whole loop
 *   for a curved polygon, and joined straight back to its start for a curved
 *   polyline.
 *
 * `square` - `shift` pressed once the drag is under way - keeps a box square
 * and an ellipse round, sized to the longer way the drag went.
 */
export function lassoFootprint(id, points = [], values = {}, { square = false } = {}) {
    const tool = lassoTool(id);
    if (tool == null || !lassoToolBuilt(id)) return null;

    const usable = (points ?? []).filter(p => Number.isFinite(p?.x) && Number.isFinite(p?.z));

    if (tool.kind === 'ring') {
        const ring = [];
        for (const p of usable) {
            const last = ring[ring.length - 1];
            if (last && Math.hypot(p.x - last[0], p.z - last[1]) < SAME_POINT) continue;
            ring.push([p.x, p.z]);
        }
        if (ring.length > 3 && Math.hypot(ring[0][0] - ring.at(-1)[0], ring[0][1] - ring.at(-1)[1]) < SAME_POINT) ring.pop();
        if (ring.length < 3 || Math.abs(ringArea(ring)) < MIN_REGION * MIN_REGION / 2) return null;
        return { kind: 'ring', points: ring };
    }

    if (tool.kind === 'path') {
        const ring = distinct(usable);
        if (ring.length < 3) return null;
        const path = { kind: 'path', points: ring, closed: tool.id === 'curved-polygon' };
        return Math.abs(ringArea(flattenPath(path))) < MIN_REGION * MIN_REGION / 2 ? null : path;
    }

    if (usable.length < 2) return null;
    const a = usable[0];
    let   b = usable[usable.length - 1];

    if (tool.kind === 'polygon') {
        const radius = Math.hypot(b.x - a.x, b.z - a.z);
        if (radius < MIN_REGION / 2) return null;
        const field = name => Number(values?.[name] ?? tool.ranges?.[name]?.default);
        const sides = tool.sides ?? Math.round(field(tool.ranges?.numberOfSides ? 'numberOfSides' : 'numberOfPoints'));
        const inner = tool.ranges?.starRatio ? field('starRatio') : 1;
        return { kind: 'polygon', x: a.x, z: a.z, radius, sides, inner, angle: Math.atan2(b.z - a.z, b.x - a.x) };
    }

    if (square) {
        const side = Math.max(Math.abs(b.x - a.x), Math.abs(b.z - a.z));
        b = { x: a.x + Math.sign(b.x - a.x || 1) * side, z: a.z + Math.sign(b.z - a.z || 1) * side };
    }

    const width = Math.abs(b.x - a.x);
    const depth = Math.abs(b.z - a.z);
    if (width < MIN_REGION || depth < MIN_REGION) return null;

    const x = (a.x + b.x) / 2;
    const z = (a.z + b.z) / 2;

    if (tool.kind === 'rect') {
        const asked = tool.ranges?.corner ? Number(values?.corner ?? tool.ranges.corner.default) : 0;
        const corner = Math.min(Math.max(Number.isFinite(asked) ? asked : 0, 0), Math.min(width, depth) / 2);
        return { kind: 'rect', x, z, width, depth, angle: 0, corner };
    }

    if (tool.kind === 'ellipse') {
        return { kind: 'ellipse', x, z, radiusX: width / 2, radiusZ: depth / 2, angle: 0 };
    }

    return null;
}

/** The points a gesture gave, each one that landed on the one before it dropped. */
function distinct(points) {
    const out = [];
    for (const p of points) {
        const last = out[out.length - 1];
        if (last && Math.hypot(p.x - last[0], p.z - last[1]) < SAME_POINT) continue;
        out.push([p.x, p.z]);
    }
    return out;
}

/** Twice the area a ring encloses, signed by the way it winds. */
function ringArea(ring) {
    let twice = 0;
    for (let i = 0; i < ring.length; i++) {
        const [x1, z1] = ring[i];
        const [x2, z2] = ring[(i + 1) % ring.length];
        twice += x1 * z2 - x2 * z1;
    }
    return twice / 2;
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
 * A region drawn by a tool, reshaped by the values on its panel: each field the
 * tool declares written to the value of the region it stands for, so six sides
 * set to seven is the heptagon in the same place rather than a hexagon to draw
 * again. A rounded box's corner is held to half its shorter side, as it was
 * when it was drawn. Null for a region the tool did not draw.
 */
export function reshapeFootprint(footprint, id, values = {}) {
    const tool = lassoTool(id);
    if (tool == null || footprint == null || footprint.kind !== tool.kind) return null;
    const shaped = { ...footprint };
    for (const [name, field] of Object.entries(tool.fields ?? {})) {
        const value = Number(values?.[name]);
        if (!Number.isFinite(value)) continue;
        shaped[field] = field === 'sides' ? Math.round(value) : value;
    }
    if (shaped.kind === 'rect') shaped.corner = Math.min(Math.max(shaped.corner ?? 0, 0), Math.min(shaped.width, shaped.depth) / 2);
    return shaped;
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
