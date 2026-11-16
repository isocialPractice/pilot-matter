/**
 * Build select - which built placement is under a point of the canvas, and
 * whether a press on it was a click.
 *
 * A built element is not an object in the scene. It is a write into the
 * ground's height and colour, composited with everything else and then let
 * go of, so by the time the canvas is on screen there is no mountain in it -
 * only ground that stands higher in one place. A ray cast at the ground finds
 * a point and never a thing.
 *
 * So a pick is by placement, not by mesh: each committed placement is asked
 * how strongly it reaches the point, through its footprint or, for a mountain
 * dropped at a click, through the peak it stands as - worked out again from
 * its configuration and its own seeded stream, which is the peak the ground
 * was raised by. That is a handful of arithmetic per placement rather than a
 * raycast against anything, so the pointer can be followed every frame.
 *
 * Pure module with no DOM or Three.js dependency, so what a click finds can be
 * unit tested in Node against placements written down for it.
 */

import {
    ELEMENT_ORDER, getElement, isElementId, resolveConfig,
    mountainPeaks, ellipticalDistance, wrapOffset
} from './environment/elements.js';
import { placementRandom } from './environment/footprinted.js';
import { footprintSampler, isFootprint } from './environment/footprints.js';
import { mountainBump } from './terrain-math.js';
import { isGroup, groupStrips, groupLots } from './templates.js';
import { isErase } from './environment/erase.js';
import { isObject, objectFootprint, objectHeight, objectErased, footprintGround } from './objects.js';

/**
 * How strongly a placement has to reach a point for a click there to find it,
 * as a share of its full strength.
 *
 * Not zero: a mountain's slope runs out to nothing at its radius, and the last
 * stretch of it raises the ground by less than a fiftieth of the peak - ground
 * that reads as bare. A click there finds bare ground, and the outline drawn
 * round a placement is drawn at this weight, so what is outlined is exactly
 * what a click inside it would find.
 */
export const PICK_WEIGHT = 0.02;

/**
 * How far a press may travel, in screen pixels, and still be a click.
 *
 * Select's left drag orbits, so every orbit begins as a press on something. A
 * press that moves further than this before it is let go of is an orbit and
 * picks nothing - without it, every orbit would end by picking whatever the
 * pointer stopped over. A finger is given more room than a mouse, because a
 * tap is never quite still.
 */
export const CLICK_TRAVEL = 5;
export const TOUCH_CLICK_TRAVEL = 10;

/** The travel a press may make and stay a click, for the kind of pointer making it. */
export function clickTravel(pointerType) {
    return pointerType === 'touch' ? TOUCH_CLICK_TRAVEL : CLICK_TRAVEL;
}

/**
 * True once a press has travelled too far from where it began to be a click.
 * `from` and `to` are screen points, `{ x, y }`.
 */
export function travelledPast(from, to, pointerType) {
    const dx = (Number(to?.x) || 0) - (Number(from?.x) || 0);
    const dy = (Number(to?.y) || 0) - (Number(from?.y) || 0);
    return Math.hypot(dx, dy) > clickTravel(pointerType);
}

/** A reach that covers nothing, for anything a pick cannot find. */
const NOWHERE = () => 0;

/**
 * How strongly a placement reaches each point of the canvas, as a function of
 * `(x, z)` in the canvas's frame giving 0 where it does not reach and 1 where
 * it is at full strength.
 *
 * - **A footprint** is the region the placement was drawn in, so its weight is
 *   the reach.
 * - **A point**, a mountain dropped at a click, reaches as far as the peak it
 *   stands as: its bump's share of its height, measured on the ellipse it is
 *   drawn on, to the nearest repeat of the square - so a peak dropped by an
 *   edge is found across the seam where its slope carries on.
 * - **Both** reach where both do, which is where the ground was drawn.
 * - **A clip** - the selection a tool that minds the lasso drew inside - is
 *   multiplied in on top, so a mountain cut at a lasso's edge is found only
 *   where it stands.
 *
 * `size` is the canvas's width, which the reach repeats at. A placement with
 * neither - a whole-world element, or one the registry does not hold - covers
 * nothing: it is not somewhere on the canvas to be picked.
 *
 * The peak is read from the placement's own stream, which the builder seeds on
 * every placement it drops; without a seed it would be read from a stream it
 * was never drawn from.
 *
 * A placed template reaches wherever any of its strips does, apron and all,
 * and an airport wherever its apron and buildings do, so it is picked as one
 * wherever a pilot presses on it. An object reaches its footprint, hard-edged,
 * which is the box round the building it stands for.
 */
export function placementReach(placement, size = 0) {
    if (isObject(placement)) {
        const footprint = objectFootprint(placement);
        return footprint ? footprintSampler(footprint, size) : NOWHERE;
    }
    if (isGroup(placement)) {
        const strips = [...groupStrips(placement, size), ...groupLots(placement, size)].map(strip => footprintSampler(strip, size));
        return strips.length > 0 ? (x, z) => Math.max(...strips.map(weigh => weigh(x, z))) : NOWHERE;
    }
    // An erase batch is picked by the ground its strokes covered, as a cover
    // batch is, so it can be picked up again to change what it takes.
    if (!isElementId(placement?.type) && !isErase(placement)) return NOWHERE;

    const region = isFootprint(placement.footprint) ? footprintSampler(placement.footprint, size) : null;
    const point  = pointReach(placement, size);
    const clip   = isFootprint(placement.clip) ? footprintSampler(placement.clip, size) : null;

    const own = region && point ? (x, z) => region(x, z) * point(x, z) : region ?? point;
    if (own == null) return NOWHERE;
    return clip ? (x, z) => own(x, z) * clip(x, z) : own;
}

/** The reach of a mountain dropped at a point, or null for anything else. */
function pointReach(placement, size) {
    if (placement.type !== 'mountain') return null;

    const config = resolveConfig(getElement(placement.type), placement.config);
    if (config.at == null) return null;

    const [peak] = mountainPeaks({ size, originX: 0, originZ: 0 }, config, placementRandom(placement));
    if (peak == null || !(peak.radius > 0)) return null;

    const wrap = Number(size) > 0 ? Number(size) : 0;
    return (x, z) => mountainBump(
        ellipticalDistance(wrapOffset(x - peak.x, wrap), wrapOffset(z - peak.z, wrap), peak.angle, peak.stretch),
        peak.radius,
        1
    );
}

/**
 * The box an object stands in, in the canvas's frame: `{ x, z, width, depth,
 * angle, bottom, top }` - its footprint, which is its recipe's reach across and
 * along, scaled and turned to its heading, standing on the ground under it and
 * reaching to the height of its highest part. Null for a placement that is no
 * object, or whose recipe holds nothing.
 *
 * `groundAt(x, z)` is the ground, read through `footprintGround` - the same
 * reading `standingObjects` stands the building by, so the box is where the
 * building was drawn rather than near it.
 *
 * It reaches down to the lowest ground under the footprint rather than to the
 * height it stands at, because that is what is drawn: the plinth fills the gap
 * between the two on a slope, and a click on the plinth is a click on the
 * building it holds up.
 */
export function objectBox(placement, groundAt = () => 0) {
    if (!isObject(placement)) return null;
    const footprint = objectFootprint(placement);
    if (footprint == null) return null;

    const { stand, base } = footprintGround(footprint, groundAt);
    return {
        x: footprint.x,
        z: footprint.z,
        width: footprint.width,
        depth: footprint.depth,
        angle: footprint.angle,
        bottom: base,
        top: stand + objectHeight(placement)
    };
}

/**
 * How far along a ray it enters a box, or null where it never does.
 *
 * The slab test, in the box's own frame: the ray is turned back by the box's
 * angle so the box is square to the axes, and the stretch of ray inside each
 * pair of faces is intersected with the other two. A ray that starts inside
 * answers 0, which is the camera being inside the building.
 *
 * `origin` and `direction` are `{ x, y, z }` in the canvas's frame; the
 * direction need not be of unit length, and the distance comes back in its
 * lengths rather than in world units - which is all a nearest-first comparison
 * between boxes needs.
 */
export function rayEntersBox(origin, direction, box) {
    if (box == null) return null;

    const cos = Math.cos(-box.angle), sin = Math.sin(-box.angle);
    const dx = (Number(origin?.x) || 0) - box.x;
    const dz = (Number(origin?.z) || 0) - box.z;

    // The ray in the box's frame: across its width, up, and along its depth.
    const from = [
        dx * cos - dz * sin,
        (Number(origin?.y) || 0) - box.bottom,
        dx * sin + dz * cos
    ];
    const along = [
        (Number(direction?.x) || 0) * cos - (Number(direction?.z) || 0) * sin,
        Number(direction?.y) || 0,
        (Number(direction?.x) || 0) * sin + (Number(direction?.z) || 0) * cos
    ];
    const half = [box.width / 2, (box.top - box.bottom) / 2, box.depth / 2];
    const middle = [0, (box.top - box.bottom) / 2, 0];

    let near = 0;
    let far = Infinity;
    for (let axis = 0; axis < 3; axis++) {
        const low = middle[axis] - half[axis];
        const high = middle[axis] + half[axis];
        if (Math.abs(along[axis]) < 1e-12) {
            // Parallel to this pair of faces: inside them or never.
            if (from[axis] < low || from[axis] > high) return null;
            continue;
        }
        const first = (low - from[axis]) / along[axis];
        const second = (high - from[axis]) / along[axis];
        near = Math.max(near, Math.min(first, second));
        far = Math.min(far, Math.max(first, second));
        if (near > far) return null;
    }

    // A box behind the ray is already answered: `near` never falls below 0, so
    // a box whose far face is behind the origin leaves `near > far` and is
    // refused inside the loop. There is nothing left here for a test of the
    // far face to catch, which a mutation run on 11.16.2026 is what showed -
    // `return near` on its own passed the whole suite.
    return near;
}

/**
 * The object a ray meets, as its index in `placements`, or null where it meets
 * none - the nearest where it meets several, so a ray crossing two picks the
 * one in front of the other.
 *
 * This is asked before the ground, and it is what lets a tall building be
 * picked where it is seen. A pick by ground point ends the ray on the ground
 * and asks what reaches there, so a click on a tower's upper floors is answered
 * with whatever stands on the ground behind it, or with nothing - the roof of
 * a 200 unit tower is 200 units from the ground its own click lands on.
 *
 * An object erased by a later batch is not there to be picked, which is the
 * same reading `standingObjects` makes of the list.
 *
 * `groundAt(x, z)` is the ground each box stands on; `size` is the canvas's
 * width, which an erase batch's region wraps across.
 */
export function objectRayAt(placements, origin, direction, { groundAt = () => 0, size = 0 } = {}) {
    const list = Array.isArray(placements) ? placements : [];
    let best = null;

    list.forEach((placement, index) => {
        if (!isObject(placement)) return;
        if (objectErased(placement, list.slice(index + 1), size)) return;
        const distance = rayEntersBox(origin, direction, objectBox(placement, groundAt));
        if (distance == null) return;
        // Nearer wins, and a tie goes to the later committed, which is the one
        // drawn over the other - the same way `placementAt` breaks one.
        if (best == null || distance <= best.distance) best = { index, distance };
    });

    return best?.index ?? null;
}

/**
 * The placement under a point of the canvas, as its index in `placements`, or
 * null for bare ground.
 *
 * Where two reach the point, the one on top wins, which is the one reaching it
 * most strongly - a small peak on the slope of a large one is picked near its
 * own top, where it stands out of the slope, and the large one everywhere
 * else. A tie goes to the later in `ELEMENT_ORDER`, which is the one drawn
 * over the other - an object after every element, standing over them all - and
 * between two of a type to the later committed, which is drawn after the
 * first.
 */
export function placementAt(placements, x, z, size = 0) {
    let best = null;

    (placements ?? []).forEach((placement, index) => {
        const weight = placementReach(placement, size)(x, z);
        if (!(weight >= PICK_WEIGHT)) return;

        // An object stands on whatever ground is under it, so it is over all
        // of it, and picked first where both reach.
        const order = isObject(placement) ? ELEMENT_ORDER.length : ELEMENT_ORDER.indexOf(placement.type);
        if (best == null || weight > best.weight || (weight === best.weight && order >= best.order)) {
            best = { index, weight, order };
        }
    });

    return best?.index ?? null;
}
