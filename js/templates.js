/**
 * Runway templates - what Insert Runway places: a strip, or an airport, as a
 * group of placements the element registry already draws.
 *
 * Nothing new draws an airport. A template is a recipe of elements, laid out in
 * its own frame - world units from its middle, a heading of 0 running north -
 * and placed in the world as one placement of type `group`, carrying where it
 * stands, which way it runs, how long and how wide its strip is, and its
 * members:
 *
 *     { type: 'group', template: 'basic-runway',
 *       config: { at: [x, z], heading, length, width }, members: [ ... ] }
 *
 * The members are copied in when a template is placed rather than looked up by
 * its id when the world is built, so a template improved later leaves every
 * world built with the old one exactly as it was - the same reason a placement
 * is data rather than a reference to code. A group is expanded into its
 * members, turned and moved into place, only when the ground is generated.
 *
 * Pure module with no DOM or Three.js dependency, so a template and what it
 * expands into can be unit tested in Node.
 */

import { getElement, isElementId, scalar, resolveConfig, wrapOffset } from './environment/elements.js';
import { bearingToDirection } from './units.js';

/** The placement type a template is placed as. */
export const GROUP_TYPE = 'group';

/** The strip's own grey, which an airport's apron is painted in at a normal blend: a flat patch is what an apron is. */
const APRON = Object.freeze({ color: [0.24, 0.24, 0.26], opacity: 1, blend: 'normal' });

/** A building's two surfaces: a pale roof and a darker wall. */
const BUILDING = Object.freeze({ topColor: [0.6, 0.59, 0.56], wallColor: [0.36, 0.35, 0.34] });

/**
 * How soft a building's edge is, in world units: half a cell of the sampling,
 * so its wall is the steepest the ground can draw rather than a slope.
 */
const BUILDING_EDGE = 40;

/**
 * The four templates, in the order the panel draws them, each its card's name.
 *
 * The two runways are a `runway` each, the commercial one longer and wider and
 * carrying its centreline. The two airports are a strip with an apron beside it
 * - a `paint` lot in the strip's grey - and buildings beyond the apron, each an
 * `extrude` lot levelled to its own ground and raised. A template is offered
 * once every element its members are is in the registry, so the panel never
 * offers a card that places part of what it shows.
 *
 * A lot is laid out from the strip rather than from the template's middle:
 * `side` it stands on, `gap` from the paved edge to its near side, `across`
 * and `length` its size, and `along` where its middle is along the strip from
 * the strip's middle. So a lot keeps its distance from the paving as the strip
 * is widened, rather than being paved over.
 */
export const RUNWAY_TEMPLATES = Object.freeze([
    {
        id: 'basic-runway', label: 'BASIC RUNWAY', length: 2400, width: 240,
        members: [{ type: 'runway', role: 'strip', config: { at: [0, 0], heading: [0, 0] } }]
    },
    {
        id: 'commercial', label: 'COMMERCIAL', length: 3600, width: 360,
        members: [{ type: 'runway', role: 'strip', config: { at: [0, 0], heading: [0, 0], centreline: true } }]
    },
    {
        id: 'basic-airport', label: 'BASIC AIRPORT', length: 2400, width: 240,
        members: [
            { type: 'runway',  role: 'strip',    config: { at: [0, 0], heading: [0, 0] } },
            { type: 'paint',   role: 'apron',    lot: { side: 1, gap: 60,  across: 360, along: 0,    length: 900 }, config: { ...APRON } },
            { type: 'extrude', role: 'hangar',   lot: { side: 1, gap: 480, across: 240, along: -300, length: 320, feather: BUILDING_EDGE }, config: { height: 45, ...BUILDING } },
            { type: 'extrude', role: 'terminal', lot: { side: 1, gap: 480, across: 240, along: 160,  length: 400, feather: BUILDING_EDGE }, config: { height: 35, ...BUILDING } },
            { type: 'extrude', role: 'tower',    lot: { side: 1, gap: 480, across: 160, along: 560,  length: 160, feather: BUILDING_EDGE }, config: { height: 90, ...BUILDING } }
        ]
    },
    {
        id: 'commercial-airport', label: 'COMMERCIAL AIRPORT', length: 3600, width: 360,
        members: [
            { type: 'runway',  role: 'strip',    config: { at: [0, 0], heading: [0, 0], centreline: true } },
            { type: 'paint',   role: 'apron',    lot: { side: 1, gap: 80,  across: 600, along: 0,    length: 1600 }, config: { ...APRON } },
            { type: 'extrude', role: 'terminal', lot: { side: 1, gap: 760, across: 320, along: 0,    length: 900, feather: BUILDING_EDGE }, config: { height: 50, ...BUILDING } },
            { type: 'extrude', role: 'hangar',   lot: { side: 1, gap: 760, across: 320, along: -820, length: 400, feather: BUILDING_EDGE }, config: { height: 60, ...BUILDING } },
            { type: 'extrude', role: 'hangar',   lot: { side: 1, gap: 760, across: 320, along: 820,  length: 400, feather: BUILDING_EDGE }, config: { height: 60, ...BUILDING } },
            { type: 'extrude', role: 'tower',    lot: { side: 1, gap: 760, across: 160, along: 1200, length: 160, feather: BUILDING_EDGE }, config: { height: 120, ...BUILDING } }
        ]
    }
].map(template => Object.freeze(template)));

/** One template by its id, or null. */
export function runwayTemplate(id) {
    return RUNWAY_TEMPLATES.find(template => template.id === id) ?? null;
}

/** True for a template every element of which the registry draws, which is one the panel offers. */
export function templateBuilt(id) {
    const template = runwayTemplate(id);
    if (template == null) return false;
    return template.members.length > 0 && template.members.every(member => isElementId(member.type));
}

/** The templates the panel offers, in its order. */
export function offeredTemplates() {
    return RUNWAY_TEMPLATES.filter(template => templateBuilt(template.id));
}

/**
 * The rows a placed group's panel shows, beneath the cards: `HEADING`,
 * `LENGTH` and `WIDTH`. The bounds are the strip's own, read off the runway
 * element's declarations, so a group cannot ask its strip for a length the
 * element would clamp. Length and width belong to the strip.
 */
export const GROUP_RANGES = (() => {
    const declared = getElement('runway').ranges;
    return Object.freeze({
        heading: Object.freeze({ ...scalar(0, 359, 0), step: 1 }),
        length:  Object.freeze(scalar(declared.length.low, declared.length.high, 2400)),
        width:   Object.freeze(scalar(declared.width.low, declared.width.high, 240))
    });
})();

/**
 * The heading a template arrives at: the bearing the view looks along, to the
 * nearest ten degrees. A runway is named by its heading in tens of degrees, so
 * one placed while looking along it points the way the pilot is looking and
 * carries a clean number - a view along 47 places a strip at 50.
 */
export function arrivalHeading(bearing = 0) {
    const tens = Math.round((Number(bearing) || 0) / 10) * 10;
    return ((tens % 360) + 360) % 360;
}

/**
 * A template placed: its members copied in, standing at `at` in the canvas's
 * frame and running along `heading`, its strip the template's length and
 * width. Null for a template the panel does not offer.
 */
export function placeTemplate(id, at, heading = 0) {
    const template = runwayTemplate(id);
    if (!templateBuilt(id) || !Array.isArray(at)) return null;
    return {
        type: GROUP_TYPE,
        template: template.id,
        config: { at: [Math.round(at[0]) || 0, Math.round(at[1]) || 0], heading: arrivalHeading(heading), length: template.length, width: template.width },
        members: structuredClone(template.members)
    };
}

/** True for a placed template. */
export function isGroup(placement) {
    return placement?.type === GROUP_TYPE && Array.isArray(placement.members);
}

/** A group's own values, each held to the bounds its row declares. */
export function groupConfig(group) {
    const given = group?.config ?? {};
    const held = (name, value) => {
        const range = GROUP_RANGES[name];
        const number = Number(value);
        return Number.isFinite(number) ? Math.min(Math.max(number, range.low), range.high) : range.default;
    };
    const at = Array.isArray(given.at) && given.at.every(Number.isFinite) ? [given.at[0], given.at[1]] : [0, 0];
    return { at, heading: ((held('heading', given.heading) % 360) + 360) % 360, length: held('length', given.length), width: held('width', given.width) };
}

/**
 * How far a placed group reaches from its middle, whichever way it is turned:
 * its strip, apron and all, or the farthest corner of a lot beside it.
 */
export function groupReach(group) {
    const { length, width } = groupConfig(group);
    let reach = stripReach(length, width);
    for (const member of group?.members ?? []) {
        const lot = lotFrame(member.lot, width);
        if (lot) reach = Math.max(reach, Math.hypot(Math.abs(lot.u) + lot.across / 2, Math.abs(lot.v) + lot.length / 2));
    }
    return reach;
}

/**
 * Where a lot's middle stands in the template's frame - `u` across the strip,
 * `v` along it - and its size, for a strip `width` wide; null for a member that
 * is not laid out as a lot.
 */
function lotFrame(lot, width) {
    if (lot == null || typeof lot !== 'object') return null;
    const number = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
    const across = Math.max(number(lot.across), 1);
    const length = Math.max(number(lot.length), 1);
    const side = number(lot.side, 1) < 0 ? -1 : 1;
    return { u: side * (width / 2 + Math.max(number(lot.gap), 0) + across / 2), v: number(lot.along), across, length, feather: lot.feather };
}

/**
 * How far a strip of this length and width reaches from its middle, apron and
 * all, whichever way it is turned: what keeps it wholly on the canvas.
 */
function stripReach(length, width) {
    const skirt = width * (getElement('runway').ranges.apron.default);
    return Math.hypot(length / 2 + skirt, width / 2 + skirt);
}

/**
 * A point held far enough in from the canvas's edges that a strip of `reach`
 * standing on it is wholly on the canvas. A strip is graded to the ground of
 * the tile it lands on, and one crossing a seam would be graded half on one
 * tile's ground and half on the next's; held on the canvas, every copy of it
 * is whole on its own tile. With no size, the point is left where it is.
 */
export function keepStripOnCanvas([x, z], reach, size = 0) {
    if (!(Number(size) > 0)) return [x, z];
    const room = Math.max(size / 2 - reach, 0);
    const held = value => Math.min(Math.max(wrapOffset(value, size), -room), room);
    return [held(x), held(z)];
}

/**
 * A group as the placements it stands for, in the canvas's frame: each member
 * turned through the group's heading about the group's middle and moved to
 * where the group stands, a strip given the group's length and width and laid
 * along the group's heading plus its own, a lot set down as a rectangle beside
 * the strip at its distance from the paving, and the whole held on a canvas
 * `size` wide - moved in together, so a lot keeps its place beside its strip.
 */
export function expandGroup(group, size = 0) {
    if (!isGroup(group)) return [];
    const { at, heading, length, width } = groupConfig(group);
    const axis = bearingToDirection(heading);
    const across = { x: axis.z, z: -axis.x };
    const [cx, cz] = keepStripOnCanvas(at, groupReach(group), size);
    // The template's frame runs north at a heading of 0: `v` is along the
    // strip and `u` across it, so a member keeps its place beside the strip
    // whichever way the group is turned.
    const frame = (u, v) => [cx + across.x * u + axis.x * v, cz + across.z * u + axis.z * v];

    return group.members.map(member => {
        const config = { ...(member.config ?? {}) };
        const lot = lotFrame(member.lot, width);
        if (lot) {
            const [x, z] = frame(lot.u, lot.v);
            const footprint = { kind: 'rect', x, z, width: lot.across, depth: lot.length, angle: heading * Math.PI / 180, corner: 0 };
            if (Number.isFinite(lot.feather)) footprint.feather = lot.feather;
            delete config.at;
            return { type: member.type, config, footprint };
        }

        const [u, v] = Array.isArray(config.at) ? config.at : [0, 0];
        if (member.type === 'runway') {
            const own = Array.isArray(config.heading) ? Number(config.heading[0]) || 0 : 0;
            const bearing = (((heading + own) % 360) + 360) % 360;
            Object.assign(config, { heading: [bearing, bearing], length: [length, length], width: [width, width] });
        }

        config.at = frame(u, v);
        return { type: member.type, config };
    });
}

/**
 * Where a placed group's lots lie, as the rectangles its members are drawn
 * through, in the canvas's frame: what an airport's buildings and apron are
 * outlined and picked by beside its strip.
 */
export function groupLots(group, size = 0) {
    return expandGroup(group, size).filter(member => member.footprint != null).map(member => member.footprint);
}

/** Every group in a list of placements expanded into its members, and everything else as it was. */
export function expandGroups(placements = [], size = 0) {
    return placements.flatMap(placement => (isGroup(placement) ? expandGroup(placement, size) : [placement]));
}

/**
 * Where a placed group's strips lie, as rectangle footprints in the canvas's
 * frame: what its outline is drawn round and what a pick of it is measured
 * against. A strip of a runway runs along its heading - the rectangle's depth
 * is its length - and reaches past its paving by its apron.
 */
export function groupStrips(group, size = 0) {
    return expandGroup(group, size)
        .filter(member => member.type === 'runway')
        .map(member => {
            const config = resolveConfig(getElement('runway'), member.config);
            const skirt = config.width[0] * config.apron;
            return {
                kind: 'rect',
                x: config.at[0], z: config.at[1],
                width: config.width[0] + skirt * 2, depth: config.length[0] + skirt * 2,
                angle: config.heading[0] * Math.PI / 180,
                corner: 0
            };
        });
}
