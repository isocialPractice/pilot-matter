/**
 * Moving water - the wave the surface of a world rides on, and the light it
 * throws back off it.
 *
 * The ground is drawn once and lit by the sun; water is the one part of it that
 * is never still, and the one part that shines. Both are done here rather than
 * in a material, because the surface a world settled at is a set of vertices
 * rather than a mesh of its own: the water is the ground, held at a level, and
 * what makes it read as water is that it moves and that it glints while the
 * land around it does neither.
 *
 * Pure module with no DOM or Three.js dependency. The wave is a function of
 * where a point is in the world and what time it is, so two tiles of an
 * assembly work out the same surface at the place they meet without having to
 * agree on anything, and the whole of it can be unit tested in Node.
 */

const TAU = Math.PI * 2;

/**
 * The swell every world's water is drawn with: two trains crossing at an angle,
 * which is what keeps a surface from reading as corrugation running one way.
 *
 * `amplitude` is world units from rest to crest, `wavelength` the distance
 * between crests, and `speed` the number of times a crest passes a point each
 * second. `sheen` is how narrow the glint is: the higher it is, the less of the
 * surface is lit at once and the more the water sparkles rather than glows.
 */
export const WAVE = Object.freeze({
    amplitude:  1.6,
    wavelength: 380,
    speed:      0.08,
    angle:      0.7,
    // The crossing train, as a share of the first and how much shorter and
    // quicker it runs.
    cross:      0.55,
    crossScale: 1.7,
    crossSpeed: 1.35,
    sheen:      3
});

/** The colour the sun leaves on water, which is not a colour the land is ever painted. */
export const WATER_SHEEN = Object.freeze([0.88, 0.95, 1]);

/** How much of that colour the brightest crest shows. */
export const SHEEN_STRENGTH = 0.5;

/**
 * Where a point stands in each of the two trains, in radians. Read off the
 * world rather than off the tile, so the same place is the same point of the
 * same wave however it was reached.
 */
function phases(x, z, time, wave) {
    const k     = TAU / Math.max(wave.wavelength, 1e-6);
    const drift = time * wave.speed * TAU;
    const cos   = Math.cos(wave.angle);
    const sin   = Math.sin(wave.angle);

    return [
        (x * cos + z * sin) * k - drift,
        (z * cos - x * sin) * k * wave.crossScale - drift * wave.crossSpeed
    ];
}

/**
 * How far the surface stands off its resting level at a point, from the crest
 * of the swell to the trough of it. Never further than the amplitude, whatever
 * the two trains are doing.
 */
export function waveHeight(x, z, time, wave = WAVE) {
    const [along, across] = phases(x, z, time, wave);
    const swell = Math.sin(along) + Math.sin(across) * wave.cross;
    return swell / (1 + wave.cross) * wave.amplitude;
}

/**
 * How much of the light a point throws back, from nothing in a trough to all of
 * it on the face of a crest. The faces move with the wave rather than with the
 * water, which is what a moving surface looks like from above.
 */
export function waveSpecular(x, z, time, wave = WAVE) {
    const [along, across] = phases(x, z, time, wave);
    const facing = (Math.cos(along) + Math.cos(across) * wave.cross) / (1 + wave.cross);
    return facing <= 0 ? 0 : Math.pow(facing, wave.sheen);
}

/**
 * The colour water is showing: its own, with the light it is throwing back laid
 * over it. `light` is how much sun there is to throw back, so water goes flat
 * and dark at night rather than glittering under a sky with no sun in it.
 */
export function waterColor(base, specular, { light = 1, sheen = WATER_SHEEN, strength = SHEEN_STRENGTH } = {}) {
    const lit = clamp01(specular) * strength * clamp01(light);
    return [
        base[0] + (sheen[0] - base[0]) * lit,
        base[1] + (sheen[1] - base[1]) * lit,
        base[2] + (sheen[2] - base[2]) * lit
    ];
}

/**
 * Moves a water surface on to a moment in time, writing the height and the
 * colour of every vertex of it into the arrays a renderer is drawing from.
 *
 * `positions` and `colors` are read the way a renderer holds them - three
 * numbers a vertex, in the field's own vertex order - so the surface is written
 * straight into the buffers rather than into something copied out of them.
 *
 * Only the water is touched. Every other vertex of the ground is left exactly
 * as the generator drew it, which is what keeps the land shaded as land while
 * the water on it moves.
 *
 * Returns how many vertices were moved.
 */
export function animateWater(surface, time, { positions, colors, light = 1, wave = WAVE } = {}) {
    if (!surface || surface.count === 0) return 0;

    for (let i = 0; i < surface.count; i++) {
        const at   = surface.vertices[i] * 3;
        const open = surface.open[i];
        const x = surface.x[i];
        const z = surface.z[i];

        // The swell is held down to nothing at the bank, so the water meets the
        // shore it was poured against rather than lapping over it.
        if (positions) positions[at + 1] = surface.rest[i] + waveHeight(x, z, time, wave) * open;

        if (colors) {
            const shown = waterColor(
                [surface.color[i * 3], surface.color[i * 3 + 1], surface.color[i * 3 + 2]],
                waveSpecular(x, z, time, wave) * open,
                { light }
            );
            colors[at]     = shown[0];
            colors[at + 1] = shown[1];
            colors[at + 2] = shown[2];
        }
    }

    return surface.count;
}

function clamp01(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.min(Math.max(number, 0), 1);
}
