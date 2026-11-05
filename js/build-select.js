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
 */
export function placementReach(placement, size = 0) {
    if (!isElementId(placement?.type)) return NOWHERE;

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
 * The placement under a point of the canvas, as its index in `placements`, or
 * null for bare ground.
 *
 * Where two reach the point, the one on top wins, which is the one reaching it
 * most strongly - a small peak on the slope of a large one is picked near its
 * own top, where it stands out of the slope, and the large one everywhere
 * else. A tie goes to the later in `ELEMENT_ORDER`, which is the one drawn
 * over the other, and between two of a type to the later committed, which is
 * drawn after the first.
 */
export function placementAt(placements, x, z, size = 0) {
    let best = null;

    (placements ?? []).forEach((placement, index) => {
        const weight = placementReach(placement, size)(x, z);
        if (!(weight >= PICK_WEIGHT)) return;

        const order = ELEMENT_ORDER.indexOf(placement.type);
        if (best == null || weight > best.weight || (weight === best.weight && order >= best.order)) {
            best = { index, weight, order };
        }
    });

    return best?.index ?? null;
}
