/**
 * Mountain density - how many peaks a terrain of a given size needs to cover a
 * share of its surface. Pure module with no DOM or Three.js dependency, so the
 * formula can be unit tested in Node.
 *
 * The peaks themselves are drawn by the mountain element in
 * `js/environment/elements.js`, which calls this for the count a preset gets
 * when it does not name one of its own.
 */

/**
 * Mountain count for a share of the area of a square terrain.
 * count = (size^2 * coverage) / (pi * avgRadius^2), floored at 5.
 */
export function mountainCount(size, coverage = 0.10, avgRadius = 750) {
    const avgArea     = Math.PI * avgRadius * avgRadius;
    const terrainArea = size * size;
    return Math.max(5, Math.round(terrainArea * coverage / avgArea));
}
