/**
 * World tiles - the grid the ground is drawn on, so the world has no end to
 * reach.
 *
 * A world used to be one square with nothing outside it. Carrying the aircraft
 * round at the bounds kept the ground from running out, but the edge was still
 * there to be flown at: the seam where the world stopped could be seen, and
 * crossing it moved the flight rather than continuing it.
 *
 * So the square is not the world any more - it is one tile of it. The ground is
 * laid on an endless grid of them, each tile the same description of a world
 * seeded from its own place in that grid, and the tiles around the aircraft are
 * drawn out past everything the camera can see. Fly at the edge and another
 * tile is already there; there is nothing left to reach.
 *
 * This module is the arithmetic of that grid and nothing else: which tile a
 * place is in, where that tile sits, and which tiles have to be drawn for an
 * aircraft somewhere in it. Pure, with no DOM or Three.js dependency, so the
 * grid can be unit tested in Node.
 */

/**
 * How far past the aircraft the ground has to run, in world units. Matched to
 * the far plane the world is drawn to rather than to the fog in front of it,
 * because the fog is a setting the pilot can turn down and the far plane is
 * not: ground that reaches as far as the camera can see is ground with no
 * visible end whatever the air is doing.
 */
export const TILE_REACH = 12000;

/**
 * How far past that a tile is kept before it is released. A tile the aircraft
 * has just left would otherwise be dropped and generated again every time it
 * crossed back over the line, so the line it is dropped at sits outside the
 * line it is drawn at.
 */
export const TILE_KEEP = 2000;

/** Which tile a coordinate falls in on one axis. Tile `i` is centred on `i * size`. */
function indexOn(value, size) {
    if (!Number.isFinite(value) || !Number.isFinite(size) || size <= 0) return 0;
    return Math.round(value / size) | 0;
}

/** The tile of the grid a world position falls in. */
export function tileIndexAt(x, z, size) {
    return { x: indexOn(x, size), z: indexOn(z, size) };
}

/** A tile's place in the grid as a key two callers agree on. */
export function tileKey(index) {
    return `${index.x},${index.z}`;
}

/** True for two places in the grid that are the same place. */
export function sameTile(a, b) {
    return a != null && b != null && a.x === b.x && a.z === b.z;
}

/** True for the tile the world is centred on, which is the one a flight opens over. */
export function isHomeTile(index) {
    return index != null && index.x === 0 && index.z === 0;
}

/** Where the middle of a tile sits in the world. */
export function tileCenter(index, size) {
    return { x: index.x * size, z: index.z * size };
}

/** The square a tile covers, in world coordinates. */
export function tileBounds(index, size) {
    const half = size / 2;
    const middle = tileCenter(index, size);
    return {
        minX: middle.x - half, maxX: middle.x + half,
        minZ: middle.z - half, maxZ: middle.z + half
    };
}

/**
 * Every tile the ground has to be drawn on for an aircraft at a point: the one
 * it is over, and every one the square of `reach` around it touches.
 *
 * Nearest first, measured from tile centre to the point, so a caller drawing
 * them a few at a time draws the ground the aircraft is closest to needing
 * before the ground beyond it.
 *
 * The set is never wider than three tiles on an axis while the reach is inside
 * a tile and a half, which is what bounds how much world can be drawn at once.
 */
export function tilesInReach(x, z, size, reach = TILE_REACH) {
    if (!Number.isFinite(size) || size <= 0) return [{ x: 0, z: 0 }];

    const span = Math.max(reach, 0);
    const lowX  = indexOn(x - span, size), highX = indexOn(x + span, size);
    const lowZ  = indexOn(z - span, size), highZ = indexOn(z + span, size);

    const tiles = [];
    for (let iz = lowZ; iz <= highZ; iz++) {
        for (let ix = lowX; ix <= highX; ix++) tiles.push({ x: ix, z: iz });
    }

    return tiles.sort((a, b) => reachDistance(a, x, z, size) - reachDistance(b, x, z, size));
}

/** How far a point is from the middle of a tile, squared - only the order is used. */
function reachDistance(index, x, z, size) {
    const middle = tileCenter(index, size);
    const dx = middle.x - x, dz = middle.z - z;
    return dx * dx + dz * dz;
}

/**
 * True while a tile is close enough to be worth keeping drawn. Wider than the
 * reach it was drawn at, so a tile is not released the moment the aircraft
 * turns away from it and generated again the moment it turns back.
 */
export function tileWorthKeeping(index, x, z, size, reach = TILE_REACH, keep = TILE_KEEP) {
    const bounds = tileBounds(index, size);
    const span   = Math.max(reach, 0) + Math.max(keep, 0);

    return bounds.minX <= x + span && bounds.maxX >= x - span
        && bounds.minZ <= z + span && bounds.maxZ >= z - span;
}
