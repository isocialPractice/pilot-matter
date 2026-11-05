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

/**
 * The four templates, in the order the panel draws them, each its card's name.
 *
 * The two runways are a `runway` each, the commercial one longer and wider and
 * carrying its centreline. The two airports are laid out from a `paint` apron
 * and `extrude` buildings beside their strips, which the registry does not
 * draw yet: each is declared here with the elements it waits on, and is
 * offered once every one of them is in the registry - so the panel never
 * offers a card that places part of what it shows.
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
    { id: 'basic-airport',      label: 'BASIC AIRPORT',      length: 2400, width: 240, waitsOn: ['paint', 'extrude'], members: [] },
    { id: 'commercial-airport', label: 'COMMERCIAL AIRPORT', length: 3600, width: 360, waitsOn: ['paint', 'extrude'], members: [] }
].map(template => Object.freeze(template)));

/** One template by its id, or null. */
export function runwayTemplate(id) {
    return RUNWAY_TEMPLATES.find(template => template.id === id) ?? null;
}

/** True for a template every element of which the registry draws, which is one the panel offers. */
export function templateBuilt(id) {
    const template = runwayTemplate(id);
    if (template == null) return false;
    const types = [...(template.waitsOn ?? []), ...template.members.map(member => member.type)];
    return template.members.length > 0 && types.every(isElementId);
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

/** How far a placed group's strip reaches from its middle, whichever way it is turned. */
export function groupReach(group) {
    const { length, width } = groupConfig(group);
    return stripReach(length, width);
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
 * where the group stands, a strip given the group's length and width, every
 * strip laid along the group's heading plus its own, and each held wholly on a
 * canvas `size` wide.
 */
export function expandGroup(group, size = 0) {
    if (!isGroup(group)) return [];
    const { at, heading, length, width } = groupConfig(group);
    const axis = bearingToDirection(heading);
    const across = { x: axis.z, z: -axis.x };

    return group.members.map(member => {
        const config = { ...(member.config ?? {}) };
        const [u, v] = Array.isArray(config.at) ? config.at : [0, 0];
        // The template's frame runs north at a heading of 0: `v` is along the
        // strip and `u` across it, so a member keeps its place beside the strip
        // whichever way the group is turned.
        let place = [at[0] + across.x * u + axis.x * v, at[1] + across.z * u + axis.z * v];

        if (member.type === 'runway') {
            const own = Array.isArray(config.heading) ? Number(config.heading[0]) || 0 : 0;
            const bearing = (((heading + own) % 360) + 360) % 360;
            place = keepStripOnCanvas(place, stripReach(length, width), size);
            Object.assign(config, { heading: [bearing, bearing], length: [length, length], width: [width, width] });
        }

        config.at = place;
        return { type: member.type, config };
    });
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
