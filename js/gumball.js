/**
 * The gumball - the widget drawn at the centre of the placement in hand, whose
 * handles move it, raise it, spread it and turn it by dragging.
 *
 * The artwork declares two of them, as `gumball-Heights-*.svg` for an element
 * that stands to a height - a mountain - and `gumball-Flat-*.svg` for one that
 * lies on the ground, and names every handle by an id. Those ids are the
 * authority here: `move-uniform` is the centre, `move`, `move-2` and `move-3`
 * the three arrows, `scale-grassy` and `scale-mount` the dot and the tick each
 * arrow of the Heights gumball carries, `scale-x/y/z` the squares at the end
 * of the dashed lines, and `rotate-red/green/blue` the arcs.
 *
 * **A handle is a second way into the schema, not a second place an edit is
 * registered.** Each one is bound to one declared value - a range the element
 * declares, the point it was dropped on, or its footprint - and a drag writes
 * that value and nothing else, clamped where the panel clamps it. So a drag
 * and a typed number cannot disagree: the dock shows the number the drag
 * moved, and a handle bound to nothing the placement owns is not drawn at all.
 *
 * The art is drawn in the frame it was mocked up in, with its blue axis up.
 * The simulator's frame is `js/units.js`'s - +Y up, north on +Z, east on -X -
 * and the art is translated into it here, once: red is east, green is north,
 * blue is up. Nothing inward carries the art's reading.
 *
 * Pure module with no DOM or Three.js dependency: the screen geometry is
 * worked out from projected axes it is handed, so where each handle is drawn,
 * which one a press lands on, and what a drag writes can all be unit tested
 * in Node.
 */

import { bearingToDirection } from './units.js';
import { getElement, isElementId, wrapOffset } from './environment/elements.js';
import { rangeStep, stepPlaces } from './properties-panel.js';
import { GROUP_TYPE, GROUP_RANGES, isGroup, groupReach, keepStripOnCanvas } from './templates.js';

/** The gumball an element is drawn with: one that stands to a height, or one that lies flat. */
export const GUMBALL_HEIGHTS = 'heights';
export const GUMBALL_FLAT    = 'flat';

/** A unit vector with the floating dust of a sine taken off it, so east is -1, 0 and not -1, 6e-17. */
function axis(x, y, z) {
    const clean = v => (Math.abs(v) < 1e-12 ? 0 : v);
    return Object.freeze({ x: clean(x), y: clean(y), z: clean(z) });
}

const EAST  = bearingToDirection(90);
const NORTH = bearingToDirection(0);

/**
 * The art's three axes in the simulator's frame, by the colour the art draws
 * each in. Read off `bearingToDirection` rather than written out, so the one
 * compass frame the simulator has is the one the gumball is in.
 */
export const GUMBALL_AXES = Object.freeze({
    red:   axis(EAST.x, 0, EAST.z),
    green: axis(NORTH.x, 0, NORTH.z),
    blue:  axis(0, 1, 0)
});

/** The art's own colours for the three axes. */
export const AXIS_COLOURS = Object.freeze({ red: '#fa2020', green: '#20fa20', blue: '#2020fa' });

/**
 * Every handle the two gumballs declare, by the id the art gives it, with the
 * axis it is drawn on, the kind of handle it is, and which gumballs carry it.
 *
 * - `centre` - the white circle, which moves the element over the ground.
 * - `arrow` - moves it along its axis; the blue one raises a Heights element,
 *   because an element with a height that is lifted gets taller rather than
 *   floating off the ground.
 * - `spread` - the dot on each Heights axis, `scale-grassy`: the ground the
 *   element spreads over, which is a mountain's `radius`.
 * - `stand` - the tick on each Heights axis, `scale-mount`: what it stands to,
 *   which is a mountain's `height`.
 * - `extent` - the square at the end of each dashed line: the footprint's size
 *   along that axis.
 * - `turn` - the arcs: the footprint turned about the axis.
 */
const BOTH = Object.freeze([GUMBALL_HEIGHTS, GUMBALL_FLAT]);
const TALL = Object.freeze([GUMBALL_HEIGHTS]);

export const GUMBALL_HANDLES = Object.freeze([
    { id: 'move-uniform',   kind: 'centre', axis: null,    sets: BOTH },
    { id: 'move-3',         kind: 'arrow',  axis: 'red',   sets: BOTH },
    { id: 'move-2',         kind: 'arrow',  axis: 'green', sets: BOTH },
    { id: 'move',           kind: 'arrow',  axis: 'blue',  sets: BOTH },
    { id: 'scale-grassy-3', kind: 'spread', axis: 'red',   sets: TALL },
    { id: 'scale-grassy-2', kind: 'spread', axis: 'green', sets: TALL },
    { id: 'scale-grassy',   kind: 'spread', axis: 'blue',  sets: TALL },
    { id: 'scale-mount-3',  kind: 'stand',  axis: 'red',   sets: TALL },
    { id: 'scale-mount-2',  kind: 'stand',  axis: 'green', sets: TALL },
    { id: 'scale-mount',    kind: 'stand',  axis: 'blue',  sets: TALL },
    { id: 'scale-x',        kind: 'extent', axis: 'red',   sets: BOTH },
    { id: 'scale-y',        kind: 'extent', axis: 'green', sets: BOTH },
    { id: 'scale-z',        kind: 'extent', axis: 'blue',  sets: BOTH },
    { id: 'rotate-red',     kind: 'turn',   axis: 'red',   sets: BOTH },
    { id: 'rotate-green',   kind: 'turn',   axis: 'green', sets: BOTH },
    { id: 'rotate-blue',    kind: 'turn',   axis: 'blue',  sets: BOTH }
].map(handle => Object.freeze(handle)));

/** One handle by its id, or null. */
export function gumballHandle(id) {
    return GUMBALL_HANDLES.find(handle => handle.id === id) ?? null;
}

/** The gumball an element is drawn with: Heights for one that declares a height span, Flat otherwise. */
export function gumballKind(type) {
    // A placed runway lies flat, as every strip does.
    if (type === GROUP_TYPE) return GUMBALL_FLAT;
    if (!isElementId(type)) return null;
    return getElement(type).ranges.height?.kind === 'span' ? GUMBALL_HEIGHTS : GUMBALL_FLAT;
}

/** The handles a gumball carries, in the order the art lists them. */
export function gumballHandles(kind) {
    return GUMBALL_HANDLES.filter(handle => handle.sets.includes(kind));
}

// --- What each handle is bound to -------------------------------------------------

/**
 * A footprint's size along each ground axis, by kind: what a square handle
 * scales. A region set down in a frame - a batch of strokes - is sized by the
 * frame's two stretches, which grow the whole batch about its middle.
 */
const EXTENTS = Object.freeze({
    disc:    Object.freeze({ red: 'radius',  green: 'radius' }),
    ellipse: Object.freeze({ red: 'radiusX', green: 'radiusZ' }),
    rect:    Object.freeze({ red: 'width',   green: 'depth' }),
    placed:  Object.freeze({ red: 'scaleX',  green: 'scaleZ' })
});

/** The footprint kinds that carry an angle, which the blue arc turns. */
const TURNED = Object.freeze(['ellipse', 'rect', 'placed']);

/** What a placed runway's squares size: its strip's width across, and its length along. */
const GROUP_EXTENTS = Object.freeze({ red: 'width', green: 'length' });

/**
 * The least a frame may be stretched to along an axis: a twentieth, past which
 * a batch is a line too thin to see, let alone to take hold of again.
 */
export const MIN_SCALE = 0.05;

/** The least a footprint's extent may be scaled down to, by what it is: a stretch, or a size in world units. */
function extentFloor(name) {
    return name === 'scaleX' || name === 'scaleZ' ? MIN_SCALE : MIN_EXTENT;
}

/** True for a span an element declares under this name. */
function spanOf(type, name) {
    const range = getElement(type).ranges[name];
    return range?.kind === 'span' ? range : null;
}

/**
 * What a handle writes on this placement, or null for a handle bound to
 * nothing the placement owns - which is then not drawn.
 *
 * - `from: 'point'` writes `config.at`, the point a placement was dropped on.
 * - `from: 'footprint'` writes the named field of its footprint.
 * - `from: 'config'` writes a range the element declares, `name`, held to the
 *   bounds the declaration gives.
 *
 * `mode` is how a drag becomes a value: `place` follows the ground under the
 * pointer, `slide` follows it along one axis, `raise` moves a span up or down
 * whole, `scale` stretches a value from the centre, and `turn` turns it.
 */
export function handleBinding(handleOrId, placement) {
    const handle = typeof handleOrId === 'string' ? gumballHandle(handleOrId) : handleOrId;
    const kind = gumballKind(placement?.type);
    if (handle == null || kind == null || !handle.sets.includes(kind)) return null;

    const footprint = placement.footprint;
    const where = footprint != null && Number.isFinite(footprint.x) && Number.isFinite(footprint.z)
        ? { from: 'footprint', name: ['x', 'z'] }
        : Array.isArray(placement.config?.at)
            ? { from: 'point', name: 'at' }
            : null;

    switch (handle.kind) {
        case 'centre':
            return where && { ...where, mode: 'place' };
        case 'arrow':
            if (handle.axis !== 'blue') return where && { ...where, mode: 'slide', axis: handle.axis };
            return kind === GUMBALL_HEIGHTS && spanOf(placement.type, 'height')
                ? { from: 'config', name: 'height', mode: 'raise' }
                : null;
        case 'spread':
            return spanOf(placement.type, 'radius') ? { from: 'config', name: 'radius', mode: 'scale' } : null;
        case 'stand':
            return spanOf(placement.type, 'height') ? { from: 'config', name: 'height', mode: 'scale' } : null;
        case 'extent': {
            // A placed runway is sized by its strip: across it, and along it.
            if (isGroup(placement)) {
                const strip = GROUP_EXTENTS[handle.axis];
                return strip ? { from: 'config', name: strip, mode: 'scale' } : null;
            }
            const name = EXTENTS[footprint?.kind]?.[handle.axis];
            return name && Number.isFinite(footprint[name]) ? { from: 'footprint', name, mode: 'scale' } : null;
        }
        case 'turn':
            if (handle.axis === 'blue' && isGroup(placement)) return { from: 'config', name: 'heading', mode: 'turn' };
            return handle.axis === 'blue' && TURNED.includes(footprint?.kind)
                ? { from: 'footprint', name: 'angle', mode: 'turn' }
                : null;
        default:
            return null;
    }
}

/** The handles a placement's gumball draws: the ones its gumball carries that are bound to something it owns. */
export function boundHandles(placement) {
    const kind = gumballKind(placement?.type);
    if (kind == null) return [];
    return gumballHandles(kind).filter(handle => handleBinding(handle, placement) != null);
}

/**
 * Where a placement's gumball stands on the ground, in the canvas's frame:
 * the middle of its footprint, or the point it was dropped on. Null for one
 * that is nowhere in particular.
 */
export function gumballCentre(placement) {
    const footprint = placement?.footprint;
    if (footprint != null && Number.isFinite(footprint.x) && Number.isFinite(footprint.z)) {
        return { x: footprint.x, z: footprint.z };
    }
    const at = placement?.config?.at;
    return Array.isArray(at) && at.every(Number.isFinite) ? { x: at[0], z: at[1] } : null;
}

// --- What a drag writes -------------------------------------------------------------

/** How many screen pixels a raise takes to cross the whole of a range. */
export const RAISE_PIXELS = 400;

/** How many screen pixels stretch a value by a factor of e. */
export const SCALE_PIXELS = 160;

/** The least a footprint may be scaled down to along an axis, in world units. */
export const MIN_EXTENT = 20;

/** A number kept to the precision a range is stepped in, so a dragged value reads as a typed one would. */
function stepped(range, value) {
    return Number(value.toFixed(stepPlaces(rangeStep(range))));
}

function clamp(value, low, high) {
    return Math.min(Math.max(value, low), high);
}

/**
 * A span moved up or down whole, by `by`, and held inside the bounds it was
 * declared with: the move stops where either end would leave them, so the gap
 * between the two ends is kept.
 */
export function raiseSpan(pair, by, range) {
    const [low, high] = pair;
    const move = clamp(Number(by) || 0, range.low - low, range.high - high);
    return [stepped(range, low + move), stepped(range, high + move)];
}

/**
 * A span stretched from nothing by `factor`, held inside its bounds: the
 * factor stops where either end would leave them, so both ends keep their
 * proportion to each other.
 */
export function scaleSpan(pair, factor, range) {
    const [low, high] = pair;
    let f = Number.isFinite(factor) && factor > 0 ? factor : 1;
    if (low > 0) f = Math.max(f, range.low / low);
    if (high > 0) f = Math.min(f, range.high / high);
    const ends = [clamp(low * f, range.low, range.high), clamp(high * f, range.low, range.high)];
    return [stepped(range, Math.min(ends[0], ends[1])), stepped(range, Math.max(ends[0], ends[1]))];
}

/**
 * What a drag of a handle writes on the placement it was grabbed from, as the
 * changes to make: `{ config, footprint }`, each holding only what changed, or
 * null for a handle bound to nothing.
 *
 * Always worked out from the placement as it was grabbed and the drag as a
 * whole - never step by step from the last move - so a drag carried away and
 * brought back puts the placement back exactly where it was.
 *
 * `drag` is what the pointer did:
 *
 * - `ground` - `{ dx, dz }`, how far the ground point under the pointer has
 *   moved, in world units, which the centre and the ground arrows follow.
 * - `along` - how many screen pixels the pointer has moved along the handle's
 *   own axis as it is drawn, which raising and scaling read.
 * - `turn` - how far, in radians, the pointer has swept round the centre.
 * - `uniform` - `shift` held at the press: a scale handle stretches every value
 *   the placement's scale handles are bound to, by the same factor.
 *
 * `size` is the canvas's width, which a point is kept inside, wrapping round.
 */
export function dragHandle(placement, handleOrId, drag = {}, { size = 0 } = {}) {
    const handle  = typeof handleOrId === 'string' ? gumballHandle(handleOrId) : handleOrId;
    const binding = handleBinding(handle, placement);
    if (binding == null) return null;

    const changes = { config: {}, footprint: null };
    const along   = Number(drag.along) || 0;

    if (binding.mode === 'place' || binding.mode === 'slide') {
        let dx = Number(drag.ground?.dx) || 0;
        let dz = Number(drag.ground?.dz) || 0;
        if (binding.mode === 'slide') {
            const direction = GUMBALL_AXES[binding.axis];
            const reach = dx * direction.x + dz * direction.z;
            dx = reach * direction.x;
            dz = reach * direction.z;
        }

        const centre = gumballCentre(placement);
        const x = keepOnCanvas(centre.x + dx, size);
        const z = keepOnCanvas(centre.z + dz, size);
        // A placed runway is held wholly on the canvas, where its strip is.
        const [px, pz] = isGroup(placement) ? keepStripOnCanvas([x, z], groupReach(placement), size) : [x, z];
        if (binding.from === 'point') changes.config.at = [Math.round(px) || 0, Math.round(pz) || 0];
        else changes.footprint = { ...placement.footprint, x, z };
        return changes;
    }

    if (binding.mode === 'raise') {
        const range = spanOf(placement.type, binding.name);
        const by = along * (range.high - range.low) / RAISE_PIXELS;
        changes.config[binding.name] = raiseSpan(currentSpan(placement, binding.name, range), by, range);
        return changes;
    }

    if (binding.mode === 'scale') {
        const factor = Math.exp(along / SCALE_PIXELS);
        const scaled = drag.uniform ? scaleHandles(placement) : [binding];
        for (const each of scaled) {
            if (each.from === 'config' && isGroup(placement)) {
                const range = GROUP_RANGES[each.name];
                const held = Number(placement.config?.[each.name]);
                const value = Math.min(Math.max((Number.isFinite(held) ? held : range.default) * factor, range.low), range.high);
                changes.config[each.name] = stepped(range, value);
            } else if (each.from === 'config') {
                const range = spanOf(placement.type, each.name);
                changes.config[each.name] = scaleSpan(currentSpan(placement, each.name, range), factor, range);
            } else {
                changes.footprint ??= { ...placement.footprint };
                changes.footprint[each.name] = Math.max(placement.footprint[each.name] * factor, extentFloor(each.name));
            }
        }
        if (changes.footprint == null) delete changes.footprint;
        return changes;
    }

    if (binding.mode === 'turn' && binding.from === 'config') {
        // A heading turns the way a box's angle does, in whole degrees round
        // the card.
        const heading = (Number(placement.config?.heading) || 0) + (Number(drag.turn) || 0) * 180 / Math.PI;
        changes.config.heading = ((Math.round(heading) % 360) + 360) % 360;
        return changes;
    }

    if (binding.mode === 'turn') {
        const angle = (Number(placement.footprint.angle) || 0) + (Number(drag.turn) || 0);
        changes.footprint = { ...placement.footprint, angle };
        return changes;
    }

    return null;
}

/** Every distinct value a placement's scale handles are bound to, which a uniform scale stretches together. */
function scaleHandles(placement) {
    const seen = new Set();
    const bindings = [];
    for (const handle of boundHandles(placement)) {
        const binding = handleBinding(handle, placement);
        if (binding.mode !== 'scale') continue;
        const key = `${binding.from}:${binding.name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        bindings.push(binding);
    }
    return bindings;
}

/** A span as the placement holds it, or as its declaration defaults it when the placement says nothing. */
function currentSpan(placement, name, range) {
    const held = placement.config?.[name];
    return Array.isArray(held) && held.length === 2 && held.every(Number.isFinite) ? held : range.default.slice();
}

/** A point kept on a canvas `size` wide, coming in at the opposite edge when it is carried off one. */
function keepOnCanvas(value, size) {
    return size > 0 ? wrapOffset(value, size) : value;
}

/**
 * Turns a press on a handle into a drag, or refuses it. `ctrl` and a press on
 * the centre is left unbound: the art's walkthrough gave it a meaning on one
 * gumball that made the centre mean two things, and the centre means move on
 * both. `uniform` is `shift` held at the press, read once there.
 */
export function pressHandle(id, { ctrlKey = false, shiftKey = false } = {}) {
    const handle = gumballHandle(id);
    if (handle == null) return null;
    if (handle.kind === 'centre' && ctrlKey) return null;
    return { handle: handle.id, uniform: Boolean(shiftKey) };
}

// --- On the screen -------------------------------------------------------------------

/** How long, in screen pixels, the longest of the three axes is drawn. */
export const GUMBALL_PIXELS = 78;

/** How near, in screen pixels, a press must land to a handle to take it. */
export const HANDLE_REACH = 7;

/**
 * Where each handle is drawn, for a gumball whose centre is at `centre` on the
 * screen and whose axes run along `axes` - each a screen vector for one unit
 * of that axis in the world, as the camera projects it.
 *
 * The longest axis is drawn `GUMBALL_PIXELS` long and the other two shortened
 * in proportion, so the widget reads as lying in the scene: an axis pointing
 * at the camera is short. Along each axis, as the art places them, the dot is a
 * quarter of the way out, the tick a little past half, and the arrowhead at
 * the end; the dashed line runs the other way to its square, and the arcs join
 * the far ends of the three dashed lines.
 *
 * `handles` are the ones to lay out - the bound ones - and nothing else is.
 */
export function gumballLayout(centre, axes, handles) {
    const lengths = ['red', 'green', 'blue'].map(name => Math.hypot(axes[name]?.x ?? 0, axes[name]?.y ?? 0));
    const longest = Math.max(...lengths);
    if (!(longest > 0)) return { centre, axes: {}, handles: [] };

    const k = GUMBALL_PIXELS / longest;
    const out = {};
    for (const name of ['red', 'green', 'blue']) {
        out[name] = { x: (axes[name]?.x ?? 0) * k, y: (axes[name]?.y ?? 0) * k };
    }

    const at = (name, share) => ({ x: centre.x + out[name].x * share, y: centre.y + out[name].y * share });
    const laid = [];

    for (const handle of handles) {
        const name = handle.axis;
        switch (handle.kind) {
            case 'centre':
                laid.push({ id: handle.id, kind: 'centre', axis: null, at: { ...centre }, radius: 6 });
                break;
            case 'arrow':
                laid.push({ id: handle.id, kind: 'arrow', axis: name, from: at(name, 0.12), to: at(name, 1) });
                break;
            case 'spread':
                laid.push({ id: handle.id, kind: 'spread', axis: name, at: at(name, 0.25), radius: 5 });
                break;
            case 'stand': {
                const mid = at(name, 0.56);
                const across = unitNormal(out[name]);
                laid.push({
                    id: handle.id, kind: 'stand', axis: name,
                    from: { x: mid.x - across.x * 7, y: mid.y - across.y * 7 },
                    to:   { x: mid.x + across.x * 7, y: mid.y + across.y * 7 }
                });
                break;
            }
            case 'extent':
                laid.push({ id: handle.id, kind: 'extent', axis: name, from: { ...centre }, at: at(name, -1), half: 5 });
                break;
            case 'turn':
                laid.push({ id: handle.id, kind: 'turn', axis: name, points: arcPoints(centre, out, name) });
                break;
        }
    }

    return { centre, axes: out, handles: laid };
}

/** A unit vector at right angles to a screen vector. */
function unitNormal(v) {
    const length = Math.hypot(v.x, v.y) || 1;
    return { x: -v.y / length, y: v.x / length };
}

/**
 * The arc for turning about an axis: a quarter circle joining the far ends of
 * the other two axes' dashed lines, at a little over half their length.
 */
function arcPoints(centre, out, name) {
    const [a, b] = ['red', 'green', 'blue'].filter(other => other !== name);
    const points = [];
    for (let i = 0; i <= 12; i++) {
        const t = (i / 12) * (Math.PI / 2);
        const c = Math.cos(t) * -0.6;
        const s = Math.sin(t) * -0.6;
        points.push({ x: centre.x + out[a].x * c + out[b].x * s, y: centre.y + out[a].y * c + out[b].y * s });
    }
    return points;
}

/**
 * The handle a press at a screen point lands on, or null. The small handles
 * are asked first - the centre, the dots, the ticks, the squares - so a press
 * on one sitting over an arrow's shaft takes it rather than the arrow.
 */
export function gumballHit(layout, x, y) {
    const order = ['centre', 'spread', 'stand', 'extent', 'arrow', 'turn'];
    const handles = [...(layout?.handles ?? [])].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));

    for (const handle of handles) {
        if (handle.kind === 'centre' || handle.kind === 'spread') {
            if (Math.hypot(x - handle.at.x, y - handle.at.y) <= handle.radius + HANDLE_REACH / 2) return handle.id;
        } else if (handle.kind === 'extent') {
            if (Math.abs(x - handle.at.x) <= handle.half + 3 && Math.abs(y - handle.at.y) <= handle.half + 3) return handle.id;
        } else if (handle.kind === 'stand' || handle.kind === 'arrow') {
            if (segmentDistance(handle.from, handle.to, x, y) <= HANDLE_REACH) return handle.id;
        } else if (handle.kind === 'turn') {
            for (let i = 1; i < handle.points.length; i++) {
                if (segmentDistance(handle.points[i - 1], handle.points[i], x, y) <= HANDLE_REACH - 1) return handle.id;
            }
        }
    }
    return null;
}

/** How far a point is from a segment, in screen pixels. */
function segmentDistance(from, to, x, y) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const span = dx * dx + dy * dy;
    const t = span > 0 ? clamp(((x - from.x) * dx + (y - from.y) * dy) / span, 0, 1) : 0;
    return Math.hypot(x - (from.x + dx * t), y - (from.y + dy * t));
}

/**
 * How far along a handle's own axis, as drawn, the pointer has moved between
 * two screen points - the reading a raise and a scale take. Outward is
 * positive whichever way the handle sits: a square is drawn at the far end of
 * its dashed line, on the other side of the centre from its arrow, so pulling
 * it away from the centre stretches the footprint as pulling a dot does. A
 * handle with no axis reads nothing.
 */
export function alongAxis(layout, handleId, from, to) {
    const handle = gumballHandle(handleId);
    const v = handle?.axis ? layout?.axes?.[handle.axis] : null;
    const length = v ? Math.hypot(v.x, v.y) : 0;
    if (!(length > 0)) return 0;
    const reading = ((to.x - from.x) * v.x + (to.y - from.y) * v.y) / length;
    return handle.kind === 'extent' ? -reading : reading;
}

/**
 * How far the pointer has swept round the centre between two screen points,
 * in radians, the way the ground turns under a camera looking down: the
 * screen's y runs down, so a sweep that looks anticlockwise turns the ground
 * anticlockwise seen from above.
 */
export function sweepAround(centre, from, to) {
    const before = Math.atan2(from.y - centre.y, from.x - centre.x);
    const after  = Math.atan2(to.y - centre.y, to.x - centre.x);
    let turn = before - after;
    while (turn > Math.PI) turn -= 2 * Math.PI;
    while (turn < -Math.PI) turn += 2 * Math.PI;
    return turn;
}
