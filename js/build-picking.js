/**
 * Ground picking - which point of the canvas is under the pointer.
 *
 * Every tool that places, draws or picks something asks one question of the
 * pointer: where on the ground it is pointing. The camera over a canvas is
 * tilted and the ground is not flat, so the answer is where the ray from the
 * camera through the pointer first meets the ground - not where it crosses a
 * plane at sea level, which would put a click aimed at the face of a hill on
 * the flat ground behind it.
 *
 * The ray is marched against the heights the ground is drawn from rather than
 * cast against the mesh drawn from them. The two are the same surface to
 * within a cell's bend, and reading the heights is what lets this be a pure
 * module like the rest of the builder's arithmetic: no DOM and no Three.js, so
 * where a pick lands can be unit tested in Node against ground made up for it.
 */

/** How many times a crossing is halved once it has been bracketed. */
export const PICK_REFINEMENTS = 24;

/** The share of a cell the march moves at a time, so no rise in the ground is stepped over. */
export const PICK_STEP_CELLS = 0.5;

/**
 * Where a ray first meets the ground, or null where it does not.
 *
 * `origin` and `direction` are `{ x, y, z }`; the direction need not be of unit
 * length. `heightAt(x, z)` answers how high the ground stands anywhere.
 *
 * The ray is walked in steps of `step` from its origin until it is at or under
 * the ground, and the step that crossed is then halved down to the crossing.
 * `top` is the highest the ground stands: the stretch of ray above it can meet
 * nothing, so the walk starts where the ray comes down through it, and a ray
 * level with it or climbing away from it misses outright. `maxDistance` is as
 * far as anything is drawn.
 *
 * `bounds`, `{ minX, maxX, minZ, maxZ }`, is the ground that may be picked. A
 * ray that meets the ground outside it misses rather than being moved onto its
 * edge: a point that was not pointed at is not one a tool may be handed.
 */
export function pickGround(origin, direction, heightAt, {
    step = 40, maxDistance = 40000, top = Infinity, bounds = null
} = {}) {
    const length = Math.hypot(direction?.x ?? 0, direction?.y ?? 0, direction?.z ?? 0);
    if (!(length > 0) || !(step > 0) || typeof heightAt !== 'function') return null;

    const dx = direction.x / length, dy = direction.y / length, dz = direction.z / length;
    const at = t => ({ x: origin.x + dx * t, y: origin.y + dy * t, z: origin.z + dz * t });
    const clearance = t => {
        const point = at(t);
        return point.y - heightAt(point.x, point.z);
    };

    let from = 0;
    if (Number.isFinite(top) && origin.y > top) {
        if (dy >= 0) return null;
        from = (origin.y - top) / -dy;
    }

    // A ray that starts under the ground has nothing to say about what it
    // points at - it is a camera inside a hill.
    if (clearance(from) <= 0) return null;

    let before = from;
    for (let t = from + step; t <= maxDistance + step; t += step) {
        const reach = Math.min(t, maxDistance);
        if (clearance(reach) <= 0) {
            const hit = at(refine(clearance, before, reach));
            hit.y = heightAt(hit.x, hit.z);
            return within(hit, bounds) ? hit : null;
        }
        if (reach === maxDistance) break;
        before = reach;
    }

    return null;
}

/**
 * The crossing between two distances along a ray, one above the ground and one
 * at or under it, found by halving the stretch between them.
 */
function refine(clearance, above, under) {
    let high = above, low = under;
    for (let i = 0; i < PICK_REFINEMENTS; i++) {
        const middle = (high + low) / 2;
        if (clearance(middle) > 0) high = middle;
        else low = middle;
    }
    return (high + low) / 2;
}

function within(point, bounds) {
    if (bounds == null) return true;
    return point.x >= bounds.minX && point.x <= bounds.maxX
        && point.z >= bounds.minZ && point.z <= bounds.maxZ;
}

/**
 * The square a canvas covers, which is the ground a pick may land on. A canvas
 * is the home tile, so its own frame and the world's are the same square.
 */
export function canvasPickBounds(size = 0) {
    const half = Math.max(Number(size) || 0, 0) / 2;
    return { minX: -half, maxX: half, minZ: -half, maxZ: half };
}

/** The march step for ground sampled every `cellSize` units. */
export function pickStep(cellSize = 0) {
    const cell = Number(cellSize) > 0 ? Number(cellSize) : 80;
    return cell * PICK_STEP_CELLS;
}

/**
 * Where the pointer is, as the -1 to 1 device coordinates a camera casts a ray
 * through: x across from the left edge, y up from the bottom edge.
 */
export function pointerDevice(clientX, clientY, rect) {
    const width = Math.max(rect?.width ?? 0, 1);
    const height = Math.max(rect?.height ?? 0, 1);
    return {
        x: ((clientX - (rect?.left ?? 0)) / width) * 2 - 1,
        y: 1 - ((clientY - (rect?.top ?? 0)) / height) * 2
    };
}
