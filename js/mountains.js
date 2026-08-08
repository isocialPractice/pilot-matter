/**
 * Mountains — randomly places mountain bumps on an existing terrain.
 *
 * Density: 1 mountain per 10% of terrain area, i.e. ~10% surface coverage.
 * Each mountain is a smooth radial bump (smoothstep falloff) added on top
 * of the base fbm terrain, updating both vertex positions and colours.
 *
 * Colours come from the shared weather palette so raised vertices match the
 * base terrain under whatever tone render_weather last set.
 */

import { heightToColor } from './weather-style.js';

export function addMountains(terrain) {
    const { size, maxHeight } = terrain;

    // --- Calculate mountain count for ~10% area coverage ---
    const avgRadius     = 750;                              // average mountain radius (units)
    const avgArea       = Math.PI * avgRadius * avgRadius;  // ≈ 1,767,000 sq units
    const terrainArea   = size * size;                      // 256,000,000 sq units
    const coverage      = 0.10;
    const count         = Math.max(5, Math.round(terrainArea * coverage / avgArea)); // ≈ 14-15

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
