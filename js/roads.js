/**
 * Roads - pieces that join end to end.
 *
 * A road piece is an object whose recipe names its `connectors`: each a point
 * in the piece's own frame and the compass heading that leads out of the piece
 * there. A straight has two, a T-junction three, a crossroads and a roundabout
 * four, a dead end one.
 *
 * While a piece is previewed under the pointer, `snapRoad` looks for the open
 * connector of a placed road nearest any of its own. Within `SNAP_DISTANCE` it
 * moves and turns the piece so the two meet end to end - the same point, facing
 * opposite ways - and the click places it there. A connector already met by
 * another is not open, so a road is joined to the end that is free.
 *
 * Headings are compass degrees, as a runway's are, read the way
 * `bearingToDirection` reads them; a piece's own heading turns every connector
 * with it.
 *
 * Pure module with no DOM or Three.js dependency.
 */

import { isObject, objectConfig } from './objects.js';
import { bearingToDirection } from './units.js';

/** How near, in metres, a piece's connector has to come to an open one for the piece to snap to it. */
export const SNAP_DISTANCE = 30;

/** How near two connectors have to be, and how near to facing opposite ways in degrees, to count as joined. */
export const JOIN_DISTANCE = 1;
export const JOIN_TURN = 5;

/** True for a road piece: an object whose recipe names where it joins. */
export function isRoad(placement) {
    return isObject(placement) && Array.isArray(placement.recipe?.connectors) && placement.recipe.connectors.length > 0;
}

/** A compass heading held to 0 up to 360. */
export function wrapHeading(degrees) {
    return ((degrees % 360) + 360) % 360;
}

/** How far apart two headings are, the short way round, in degrees. */
export function headingGap(a, b) {
    const gap = Math.abs(wrapHeading(a) - wrapHeading(b));
    return Math.min(gap, 360 - gap);
}

/** A point in a piece's frame turned to a heading and scaled - where it is from the piece's own point. */
function turned([x, z], heading, scale = 1) {
    const angle = heading * Math.PI / 180;
    return [(x * Math.cos(angle) - z * Math.sin(angle)) * scale, (x * Math.sin(angle) + z * Math.cos(angle)) * scale];
}

/**
 * A road's connectors where they are on the canvas: `{ x, z, heading, index }`
 * each, `heading` the way out of the piece there. Nothing for anything that is
 * not a road.
 */
export function roadConnectors(placement) {
    if (!isRoad(placement)) return [];
    const { at, heading, scale } = objectConfig(placement);
    return placement.recipe.connectors.map((connector, index) => {
        const [dx, dz] = turned(connector.at, heading, scale);
        return { x: at[0] + dx, z: at[1] + dz, heading: wrapHeading(heading + connector.heading), index };
    });
}

/** True for two connectors that meet: the same point, facing opposite ways. */
export function joined(a, b) {
    return Math.hypot(a.x - b.x, a.z - b.z) <= JOIN_DISTANCE && headingGap(a.heading, b.heading + 180) <= JOIN_TURN;
}

/**
 * Every connector of the roads placed that no other road meets, as
 * `{ x, z, heading, index, placement }`, `placement` the road's place in the
 * list.
 */
export function openConnectors(placements = []) {
    const all = [];
    (placements ?? []).forEach((placement, at) => {
        for (const connector of roadConnectors(placement)) all.push({ ...connector, placement: at });
    });
    return all.filter(connector => !all.some(other => other.placement !== connector.placement && joined(connector, other)));
}

/**
 * A piece snapped to the roads placed: moved and turned so whichever of its
 * connectors is nearest an open one meets it end to end, as
 * `{ placement, from, to }` - the piece as it would be placed, which of its
 * connectors joined, and the open one it joined - or null where none of its
 * connectors comes within `reach` of one.
 */
export function snapRoad(placement, placements = [], { reach = SNAP_DISTANCE } = {}) {
    if (!isRoad(placement)) return null;
    const own = roadConnectors(placement);
    let best = null;
    for (const open of openConnectors(placements)) {
        for (const connector of own) {
            const gap = Math.hypot(open.x - connector.x, open.z - connector.z);
            if (gap <= reach && (best == null || gap < best.gap)) best = { gap, from: connector, to: open };
        }
    }
    if (best == null) return null;

    const { scale } = objectConfig(placement);
    const local = placement.recipe.connectors[best.from.index];
    const heading = wrapHeading(best.to.heading + 180 - local.heading);
    const [dx, dz] = turned(local.at, heading, scale);
    const at = [best.to.x - dx, best.to.z - dz].map(value => Number(value.toFixed(3)));
    const snapped = { ...placement, config: { ...placement.config, at, heading: Number(heading.toFixed(3)) } };
    return { placement: snapped, from: best.from.index, to: best.to };
}

/** The direction a connector leads out along, as a unit step on the ground. */
export function connectorDirection(connector) {
    return bearingToDirection(connector.heading);
}
