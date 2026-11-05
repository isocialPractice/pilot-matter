/**
 * The shape vocabulary - every shape a pointer can draw on the ground, built
 * once, for every mode that draws shapes to declare the ones it offers.
 *
 * A shape is a gesture and the footprint kind it comes to. Several make the
 * same kind by different means - Free and Polyline are both a `ring`, gathered
 * as the pointer moves or a point a click - so they come down to a handful of
 * kinds and two ways of drawing: a **drag**, pressed, moved and let go, and
 * **a click per vertex**, closed by clicking the first point again or the last
 * one twice.
 *
 * The lasso offers ten of them and Extrude seven, and the two differ in what
 * they do with the region rather than in how it is drawn: the lasso makes it
 * the selection, Extrude lifts it. So a shape is written here once, a mode
 * names the ones it offers with its own label and art for each, and a shape
 * added later is offered by whichever mode declares it without being written
 * twice.
 *
 * Pure module with no DOM or Three.js dependency, so what a gesture comes to
 * can be unit tested in Node.
 */

import { FOOTPRINT_KINDS, flattenPath } from './environment/footprints.js';
import { scalar } from './environment/elements.js';

/** The two gestures every shape is drawn with. */
export const SHAPE_DRAG   = 'drag';
export const SHAPE_CLICKS = 'clicks';

/**
 * Every shape, each with the footprint kind it draws and its gesture.
 *
 * `ranges` are a shape's own fields, drawn on a mode's panel while it is the
 * chosen shape, and `fields` says which value of the region each one is - so a
 * value changed after the region is drawn reshapes the region rather than
 * asking for it to be drawn again. `sides` fixes the corners of a figure that
 * has no field for them.
 */
export const SHAPES = Object.freeze([
    { id: 'free',      kind: 'ring',    gesture: SHAPE_DRAG },
    { id: 'rectangle', kind: 'rect',    gesture: SHAPE_DRAG },
    { id: 'ellipse',   kind: 'ellipse', gesture: SHAPE_DRAG },
    {
        id: 'round-rect', kind: 'rect', gesture: SHAPE_DRAG,
        // How round the corners are, in world units: the radius of the arc
        // each corner is cut to, held to half the shorter side when it is drawn.
        ranges: Object.freeze({ corner: scalar(0, 4000, 600) }),
        fields: Object.freeze({ corner: 'corner' })
    },
    { id: 'triangle',  kind: 'polygon', gesture: SHAPE_DRAG, sides: 3 },
    {
        id: 'star', kind: 'polygon', gesture: SHAPE_DRAG,
        // How many points it has, and how far in between them it is drawn,
        // as a share of how far out the points reach.
        ranges: Object.freeze({
            numberOfPoints: Object.freeze({ ...scalar(3, 12, 5), step: 1 }),
            starRatio: scalar(0.1, 0.9, 0.45)
        }),
        fields: Object.freeze({ numberOfPoints: 'sides', starRatio: 'inner' })
    },
    {
        id: 'polygon', kind: 'polygon', gesture: SHAPE_DRAG,
        ranges: Object.freeze({ numberOfSides: Object.freeze({ ...scalar(3, 12, 6), step: 1 }) }),
        fields: Object.freeze({ numberOfSides: 'sides' })
    },
    { id: 'polyline',        kind: 'ring', gesture: SHAPE_CLICKS },
    { id: 'curved-polygon',  kind: 'path', gesture: SHAPE_CLICKS, closed: true },
    { id: 'curved-polyline', kind: 'path', gesture: SHAPE_CLICKS, closed: false }
].map(shape => Object.freeze(shape)));

/** One shape by its id, or null. */
export function shape(id) {
    return SHAPES.find(each => each.id === id) ?? null;
}

/** True for a shape whose kind of region can be drawn today. */
export function shapeBuilt(id) {
    const found = shape(id);
    return found != null && FOOTPRINT_KINDS.includes(found.kind);
}

/**
 * A mode's tools: each a shape the vocabulary holds, under the mode's own id,
 * label, row and art - so a tool reads as the shape it draws and the mode's
 * name for it at once. A tool naming a shape the vocabulary does not hold is
 * left out.
 */
export function modeTools(declared = []) {
    return Object.freeze(declared
        .filter(tool => shape(tool.shape ?? tool.id) != null)
        .map(tool => Object.freeze({ ...shape(tool.shape ?? tool.id), ...tool, shape: tool.shape ?? tool.id })));
}

// --- What a gesture comes to -------------------------------------------------------

/**
 * The least a drawn shape may measure across, in world units, and still be a
 * region rather than a slip of the pointer: a box dragged a few pixels draws
 * nothing rather than a sliver.
 */
export const MIN_REGION = 40;

/** Two points nearer than this are one point, in world units. */
const SAME_POINT = 1;

/**
 * The region a shape draws, from the ground points its gesture gave - `{ x, z }`
 * each, in the canvas's frame - and the values on its panel. Null for anything
 * that is not a region: a ring of fewer than three distinct points or no area,
 * a box or an ellipse thinner than `MIN_REGION`, or a shape whose kind cannot
 * be drawn yet.
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
 *   for a closed one, and joined straight back to its start for an open one.
 *
 * `square` - `shift` pressed once the drag is under way - keeps a box square
 * and an ellipse round, sized to the longer way the drag went.
 */
export function shapeFootprint(id, points = [], values = {}, { square = false } = {}) {
    const tool = shape(id);
    if (tool == null || !shapeBuilt(id)) return null;

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
        const path = { kind: 'path', points: ring, closed: tool.closed === true };
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

/**
 * A region a shape drew, reshaped by the values on its panel: each field the
 * shape declares written to the value of the region it stands for, so six
 * sides set to seven is the heptagon in the same place rather than a hexagon to
 * draw again. A rounded box's corner is held to half its shorter side, as it
 * was when it was drawn. Null for a region the shape did not draw.
 */
export function reshapeShape(footprint, id, values = {}) {
    const tool = shape(id);
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
