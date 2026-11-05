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
 * can read. Triangle, Star and Polygon Select are a `polygon`, and the two
 * curved tools a `path`; until those kinds exist they are declared here with
 * their rows and their art, and the sub-palette does not draw them - the same
 * rule the palette keeps for its own tiles.
 *
 * Pure module with no DOM or Three.js dependency, so what a gesture comes to
 * can be unit tested in Node.
 */

import { FOOTPRINT_KINDS, isFootprint } from './environment/footprints.js';
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
 * chosen tool.
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
        ranges: Object.freeze({ corner: scalar(0, 4000, 600) })
    },
    { id: 'triangle',        label: 'TRIANGLE SELECT',        row: 'row-shapes-2', kind: 'polygon', gesture: LASSO_DRAG,   art: [121.82, 159.79, 42.25, 31.35] },
    { id: 'star',            label: 'STAR SELECT',            row: 'row-shapes-2', kind: 'polygon', gesture: LASSO_DRAG,   art: [205.85, 156.1, 33.6, 34.35] },
    { id: 'polygon',         label: 'POLYGON SELECT',         row: 'row-polygons', kind: 'polygon', gesture: LASSO_DRAG,   art: [56.79, 223.71, 52.55, 30.11] },
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
 */
export function lassoFootprint(id, points = [], values = {}) {
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

    if (usable.length < 2) return null;
    const a = usable[0];
    const b = usable[usable.length - 1];
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
