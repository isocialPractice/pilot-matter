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
import { footprintSampler, isFootprint, footprintBounds } from './environment/footprints.js';
import { mountainBump } from './terrain-math.js';
import { isGroup, groupStrips, groupLots } from './templates.js';
import { isErase } from './environment/erase.js';
import { isObject, objectFootprint, objectHeight, erasedObjects, footprintGround } from './objects.js';
import { placementPickable } from './outliner.js';
import { canvasPickBounds } from './build-picking.js';

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
    // Hidden or locked, it is not on the canvas to be found: what is not drawn
    // cannot be clicked on, and a lock is exactly a refusal to be picked. The
    // outline is traced at this weight too, so neither is outlined either.
    if (!placementPickable(placement)) return NOWHERE;
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

/**
 * The peak a mountain dropped at a point stands as - worked out again from its
 * configuration and its own seeded stream, which is the peak the ground was
 * raised by - or null for anything else.
 */
function pointPeak(placement, size) {
    if (placement?.type !== 'mountain') return null;

    const config = resolveConfig(getElement(placement.type), placement.config);
    if (config.at == null) return null;

    const [peak] = mountainPeaks({ size, originX: 0, originZ: 0 }, config, placementRandom(placement));
    return peak != null && peak.radius > 0 ? peak : null;
}

/** The reach of a mountain dropped at a point, or null for anything else. */
function pointReach(placement, size) {
    const peak = pointPeak(placement, size);
    if (peak == null) return null;

    const wrap = Number(size) > 0 ? Number(size) : 0;
    return (x, z) => mountainBump(
        ellipticalDistance(wrapOffset(x - peak.x, wrap), wrapOffset(z - peak.z, wrap), peak.angle, peak.stretch),
        peak.radius,
        1
    );
}

// --- What a placement covers -------------------------------------------------------

/**
 * The square of canvas a placement covers: `{ minX, maxX, minZ, maxZ }`, or
 * null for one that covers nothing in particular - a whole-world element, or a
 * type the registry does not hold.
 *
 * It is the square round the same reach a pick is measured against, read
 * cheaply: a footprint's own box, a peak's ellipse, the boxes of every strip
 * and lot a placed template stands for, an object's footprint. Its one use is
 * framing - `F` turns the view onto what is selected - so a square a little
 * larger than the thing is right where a tight one would cost a contour trace.
 *
 * A clip narrows it, since a mountain cut at a lasso's edge is only where it
 * stands; a clip that leaves nothing answers null, which is what the reach
 * says of it too.
 */
export function placementBounds(placement, size = 0) {
    if (!isPlacementShaped(placement)) return null;

    if (isObject(placement)) return footprintBounds(objectFootprint(placement));
    if (isGroup(placement)) {
        return unionBounds([...groupStrips(placement, size), ...groupLots(placement, size)].map(footprintBounds));
    }

    const own = isFootprint(placement.footprint)
        ? footprintBounds(placement.footprint)
        : peakBounds(pointPeak(placement, size));
    if (own == null) return null;

    const clip = isFootprint(placement.clip) ? footprintBounds(placement.clip) : null;
    return clip ? intersectBounds(own, clip) : own;
}

/** True for something `placementBounds` can read a square off at all. */
function isPlacementShaped(placement) {
    return placement != null && (isObject(placement) || isGroup(placement) || isElementId(placement.type) || isErase(placement));
}

/**
 * The square of canvas every placement in a list covers together, or null for
 * a list in which none covers anything - an empty canvas, whose framing is the
 * canvas itself.
 */
export function placementsBounds(placements = [], size = 0) {
    return unionBounds((placements ?? []).map(placement => placementBounds(placement, size)));
}

/** The square round a peak's ellipse: its radius, stretched along whichever way it is turned. */
function peakBounds(peak) {
    if (peak == null) return null;
    const reach = peak.radius * Math.max(1, Number(peak.stretch) || 1);
    return { minX: peak.x - reach, maxX: peak.x + reach, minZ: peak.z - reach, maxZ: peak.z + reach };
}

/** Every square in a list taken together, the nulls dropped, or null for nothing left. */
function unionBounds(boxes) {
    const read = (boxes ?? []).filter(box => box != null);
    if (read.length === 0) return null;
    return {
        minX: Math.min(...read.map(box => box.minX)),
        maxX: Math.max(...read.map(box => box.maxX)),
        minZ: Math.min(...read.map(box => box.minZ)),
        maxZ: Math.max(...read.map(box => box.maxZ))
    };
}

/** Where two squares overlap, or null where they do not. */
function intersectBounds(a, b) {
    const box = {
        minX: Math.max(a.minX, b.minX), maxX: Math.min(a.maxX, b.maxX),
        minZ: Math.max(a.minZ, b.minZ), maxZ: Math.min(a.maxZ, b.maxZ)
    };
    return box.maxX > box.minX && box.maxZ > box.minZ ? box : null;
}

/**
 * What `F` frames, as a square of canvas: the placement picked with Select,
 * else the region the lasso has selected, else everything built on the canvas,
 * else the canvas itself - which is always something to look at.
 *
 * Read in that order because that is the order of how particular the answer
 * is: a pick is one thing the pilot pointed at, a selection is a region they
 * drew, and with neither the question is "show me the work".
 */
export function framedBounds({ picked = null, selection = null, placements = [], size = 0 } = {}) {
    if (picked != null) {
        const box = placementBounds(picked, size);
        if (box != null) return box;
    }
    if (isFootprint(selection)) {
        const box = footprintBounds(selection);
        if (box != null) return box;
    }
    return placementsBounds(placements, size) ?? canvasPickBounds(size);
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
    return footprintBox(footprint, objectHeight(placement), groundAt);
}

/**
 * The box a footprint stands in, reaching `height` over the highest ground
 * under it - `objectBox` with the footprint already in hand, which is how
 * `objectRayAt` builds one it has just decided the ray could enter.
 *
 * It is the reading of the ground that costs: `footprintGround` samples
 * `STAND_SAMPLES` by `STAND_SAMPLES` points, so this is 25 reads of the
 * terrain for one box and the reason a box is built as late as it can be.
 */
function footprintBox(footprint, height, groundAt) {
    const { stand, base } = footprintGround(footprint, groundAt);
    return {
        x: footprint.x,
        z: footprint.z,
        width: footprint.width,
        depth: footprint.depth,
        angle: footprint.angle,
        bottom: base,
        top: stand + height
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
 * How far along a ray one of its own points stands, in the direction's own
 * lengths - the same lengths `rayEntersBox` answers in, so the two can be
 * compared against each other.
 *
 * `point` is taken to be on the ray, which is what the ground pick hands back:
 * it is projected onto the direction rather than measured straight-line, so a
 * direction of any length answers correctly. A direction of nothing is nowhere
 * along anything and answers `Infinity`, which as a limit refuses no box.
 */
export function rayDistance(origin, direction, point) {
    const dx = Number(direction?.x) || 0;
    const dy = Number(direction?.y) || 0;
    const dz = Number(direction?.z) || 0;
    const square = dx * dx + dy * dy + dz * dz;
    if (!(square > 0)) return Infinity;

    const ox = (Number(point?.x) || 0) - (Number(origin?.x) || 0);
    const oy = (Number(point?.y) || 0) - (Number(origin?.y) || 0);
    const oz = (Number(point?.z) || 0) - (Number(origin?.z) || 0);
    return (ox * dx + oy * dy + oz * dz) / square;
}

/**
 * True where a ray could still enter the box over a footprint, read off the
 * ray's horizontal path alone - and so without reading the ground at all.
 *
 * A box is a footprint extruded upwards, so the ray enters it only where its
 * horizontal path crosses the footprint. The footprint sits inside the circle
 * round its middle of its own half-diagonal, whatever it is turned to, so three
 * comparisons on that circle refuse a footprint the path never reaches:
 *
 * - **Beside the path**, further from the line the ray runs along than its own
 *   half-diagonal.
 * - **Behind the origin**, its whole extent back along the path from where the
 *   ray begins - a ray travels forwards only.
 * - **Past `within`**, further along the path than the ray is allowed to
 *   travel, which is where the ground stops it.
 *
 * Refusing is what matters and it is one-sided on purpose: a footprint the
 * circle lets through may still miss the box, which `rayEntersBox` then says,
 * and nothing the circle refuses could have been entered. That is what makes
 * this safe to ask before the ground is read - it changes which boxes are
 * built, never which one is answered.
 *
 * `within` is in the direction's own lengths, as `rayEntersBox` and
 * `rayDistance` are; the horizontal path covers `hypot(dx, dz)` units of
 * ground per length, which is what converts one to the other.
 */
export function rayNearsFootprint(origin, direction, footprint, within = Infinity) {
    if (footprint == null) return false;
    const reach = Math.hypot(Number(footprint.width) || 0, Number(footprint.depth) || 0) / 2;

    const dx = Number(direction?.x) || 0, dz = Number(direction?.z) || 0;
    const ox = (Number(footprint.x) || 0) - (Number(origin?.x) || 0);
    const oz = (Number(footprint.z) || 0) - (Number(origin?.z) || 0);

    // A ray going straight up or down has a point for its horizontal path, so
    // only a footprint round that point can be entered.
    const flat = Math.hypot(dx, dz);
    if (!(flat > 0)) return Math.hypot(ox, oz) <= reach;

    const across = Math.abs(ox * dz - oz * dx) / flat;
    if (across > reach) return false;

    const along = (ox * dx + oz * dz) / flat;
    if (along < -reach) return false;

    const travel = Number.isFinite(within) ? Math.max(within, 0) * flat : Infinity;
    return along <= travel + reach;
}

/**
 * The object a ray meets, as its index in `placements`, or null where it meets
 * none - the nearest where it meets several, so a ray crossing two picks the
 * one in front of the other.
 *
 * The boxes are what lets a tall building be picked where it is seen. A pick by
 * ground point ends the ray on the ground and asks what reaches there, so a
 * click on a tower's upper floors is answered with whatever stands on the
 * ground behind it, or with nothing - the roof of a 200 unit tower is 200 units
 * from the ground its own click lands on.
 *
 * `within` is how far the ray may travel, in the direction's own lengths: a box
 * entered beyond it is behind something and is not answered. The caller reads
 * the ground first and hands over the distance to it, so ground standing
 * between the camera and a building hides the building - without it a cliff's
 * face picks a tower a thousand units behind it, which at a shallow view is a
 * window 940 units wide for a 200 unit box.
 *
 * It is also what bounds the pass. A box is built only for an object the ray's
 * horizontal path could still reach inside that distance, by
 * `rayNearsFootprint`, because building one reads the ground 25 times - so a
 * canvas's objects cost arithmetic each and its reachable few cost the terrain.
 * Read every box instead and a hover over 300 objects is 7,500 terrain reads a
 * pointer move, which is 52 ms of a frame and was measured at 20 fps.
 *
 * An object erased by a later batch is not there to be picked, which is the
 * same reading `standingObjects` makes of the list, through the same call.
 *
 * `groundAt(x, z)` is the ground each box stands on; `size` is the canvas's
 * width, which an erase batch's region wraps across.
 */
export function objectRayAt(placements, origin, direction, { groundAt = () => 0, size = 0, within = Infinity } = {}) {
    const list = Array.isArray(placements) ? placements : [];
    const erased = erasedObjects(list, size);
    let best = null;

    list.forEach((placement, index) => {
        if (!isObject(placement)) return;
        if (erased.has(index)) return;
        // A hidden or a locked object is not there to be hit, the same reading
        // `placementReach` makes of every other kind of placement.
        if (!placementPickable(placement)) return;

        const footprint = objectFootprint(placement);
        if (!rayNearsFootprint(origin, direction, footprint, within)) return;

        const distance = rayEntersBox(origin, direction, footprintBox(footprint, objectHeight(placement), groundAt));
        if (distance == null || !(distance <= within)) return;
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
