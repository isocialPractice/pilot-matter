/**
 * Mountains — randomly places mountain bumps on an existing terrain.
 *
 * Density: 1 mountain per 10% of terrain area, i.e. ~10% surface coverage.
 * Each mountain is a smooth radial bump (smoothstep falloff) added on top
 * of the base fbm terrain, updating both vertex positions and colours.
 */

function heightToColor(h) {
    if (h < 4)   return [0.10, 0.25, 0.65];
    if (h < 12)  return [0.75, 0.68, 0.48];
    if (h < 130) { const t = h / 130;        return [0.22 + t*0.12, 0.42 + t*0.10, 0.12]; }
    if (h < 300) { const t = (h-130) / 170;  return [0.40 + t*0.20, 0.35 + t*0.10, 0.25 + t*0.10]; }
    const t = Math.min(1, (h-300) / 100);
    return [0.55 + t*0.45, 0.55 + t*0.45, 0.60 + t*0.40];
}

/**
 * Mountain count for ~10% area coverage of a square terrain.
 * Pure function (no Three.js) so the formula can be unit tested in Node.
 * count = (size^2 * coverage) / (pi * avgRadius^2), floored at 5.
 */
export function mountainCount(size, coverage = 0.10, avgRadius = 750) {
    const avgArea     = Math.PI * avgRadius * avgRadius;
    const terrainArea = size * size;
    return Math.max(5, Math.round(terrainArea * coverage / avgArea));
}

export function addMountains(terrain) {
    const { size, maxHeight } = terrain;

    // --- Calculate mountain count for ~10% area coverage ---
    const avgRadius = 750;                        // average mountain radius (units)
    const count     = mountainCount(size, 0.10, avgRadius); // 14-15 for a 16000-unit terrain

    // --- Place mountains randomly, keeping them away from the terrain edge ---
    const margin = size * 0.10;
    const half   = size / 2 - margin;

    const mountains = [];
    for (let i = 0; i < count; i++) {
        mountains.push({
            x:      (Math.random() * 2 - 1) * half,
            z:      (Math.random() * 2 - 1) * half,
            radius: 400  + Math.random() * 700,   // 400 – 1100 units wide
            peak:   180  + Math.random() * 320    // 180 – 500 units tall
        });
    }

    // --- Apply bumps to every terrain vertex ---
    const geo    = terrain.mesh.geometry;
    const pos    = geo.attributes.position;
    const colors = geo.attributes.color;

    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);

        let added = 0;
        for (const m of mountains) {
            const dx   = x - m.x;
            const dz   = z - m.z;
            const dist = Math.sqrt(dx*dx + dz*dz);
            if (dist >= m.radius) continue;

            // Smoothstep falloff — sharp enough to read as a mountain
            const t  = 1 - dist / m.radius;
            const st = t * t * (3 - 2 * t);
            added   += m.peak * st;
        }

        if (added > 0) {
            const newH = pos.getY(i) + added;
            pos.setY(i, newH);
            terrain.heightData[i] = newH;

            const [r, g, b] = heightToColor(newH);
            colors.setXYZ(i, r, g, b);
        }
    }

    pos.needsUpdate    = true;
    colors.needsUpdate = true;
    geo.computeVertexNormals();

    console.log(`Mountains: placed ${count} mountains (~10% coverage)`);
}
