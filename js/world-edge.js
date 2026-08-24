/**
 * World edge - what happens when the aircraft reaches the end of the ground.
 *
 * The world is a square of terrain with nothing outside it: past the bounds the
 * height sampler answers zero, so an aircraft flown far enough finds itself
 * over an infinite flat nothing that the fog had been promising was more world.
 * Rather than fence the pilot in, the world is carried round: crossing an edge
 * puts the aircraft back in over the opposite one, at the same distance past it,
 * at the same altitude, and on the same heading. The edge can be flown at, and
 * flown over, and never reached.
 *
 * Only the horizontal position moves. Altitude, attitude, airspeed, and heading
 * are the flight, and a flight that changed when the map ran out would be a
 * fence with extra steps.
 *
 * Pure module with no DOM or Three.js dependency, so the crossing can be unit
 * tested in Node.
 */

/**
 * A value carried back inside a span, at the same distance past the far end as
 * it went out over the near one.
 *
 * A value already inside is returned untouched, its edges included: sitting
 * exactly on the boundary is still inside the world, and a position that has
 * only reached the edge has not crossed it. A span with no width to it, or a
 * value that is not a number, is left alone rather than divided by zero.
 */
export function wrapValue(value, low, high) {
    const span = high - low;
    if (!Number.isFinite(value) || !Number.isFinite(span) || span <= 0) return value;
    if (value >= low && value <= high) return value;

    return low + (((value - low) % span) + span) % span;
}

/** True when a point is past one of the world's edges. */
export function isOutsideBounds(bounds, x, z) {
    return x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ;
}

/**
 * A position carried back inside the world's bounds, with `wrapped` saying
 * whether it had to be. The two axes are carried independently, so a corner
 * crossed diagonally comes back in at the opposite corner rather than at
 * whichever edge was crossed first.
 */
export function wrapPosition(bounds, x, z) {
    if (!bounds || !isOutsideBounds(bounds, x, z)) return { x, z, wrapped: false };

    const wrappedX = wrapValue(x, bounds.minX, bounds.maxX);
    const wrappedZ = wrapValue(z, bounds.minZ, bounds.maxZ);

    return { x: wrappedX, z: wrappedZ, wrapped: wrappedX !== x || wrappedZ !== z };
}
