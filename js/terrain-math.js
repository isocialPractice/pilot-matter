/**
 * Terrain math - the pure functions the procedural world is built from:
 * value noise, fractal Brownian motion, the plains/peaks height curve, the
 * smoothstep radial bump that shapes a mountain, and the height-to-colour
 * ramp. No DOM or Three.js dependencies, so every function here can be unit
 * tested in Node.
 */

// fBm layering constants. Each octave halves the amplitude and multiplies
// the frequency by a non-integer lacunarity, which keeps the lattice of one
// octave from lining up with the next and showing as a grid.
export const OCTAVES = 7;
export const GAIN = 0.5;
export const LACUNARITY = 2.1;

// Noise below this value becomes flat plains and water, above it becomes
// peaks. Matches the remap curve in shapeHeight.
export const PLAINS_THRESHOLD = 0.38;

/**
 * Deterministic pseudo-random value in [0, 1) for a lattice point. The same
 * (x, y) always hashes to the same value, which is what makes the terrain
 * reproducible for a given coordinate.
 */
export function hash(x, y) {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
}

/**
 * Value noise: bilinear blend of the four surrounding lattice hashes, with
 * the blend weights eased by smoothstep so cell boundaries are not visible.
 * Returns a value in [0, 1).
 */
export function smoothNoise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const ux = smoothstep(x - ix);
    const uy = smoothstep(y - iy);
    const a = hash(ix,   iy),   b = hash(ix+1, iy);
    const c = hash(ix,   iy+1), d = hash(ix+1, iy+1);
    return a + (b-a)*ux + (c-a)*uy + (a-b-c+d)*ux*uy;
}

/**
 * Fractal Brownian motion: octaves of value noise summed at halving
 * amplitude and rising frequency, normalised back into [0, 1). Low octaves
 * carve valleys and ranges, high octaves add surface detail.
 */
export function fbm(x, y, octaves = OCTAVES) {
    let v = 0, amp = 0.5, freq = 1, max = 0;
    for (let i = 0; i < octaves; i++) {
        v   += amp * smoothNoise(x * freq, y * freq);
        max += amp;
        amp  *= GAIN;
        freq *= LACUNARITY;
    }
    return max === 0 ? 0 : v / max;
}

/**
 * Smoothstep easing, clamped to [0, 1]: flat at both ends, steepest in the
 * middle. Used for noise blending and for mountain falloff.
 */
export function smoothstep(t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return t * t * (3 - 2 * t);
}

/**
 * Remaps raw [0, 1) noise into a world height. Values under the plains
 * threshold are compressed into wide low ground, values over it are pushed
 * up a power curve into steep peaks. The result never exceeds maxHeight.
 */
export function shapeHeight(noise, maxHeight) {
    const h = noise < PLAINS_THRESHOLD
        ? noise * 0.25
        : 0.095 + Math.pow((noise - PLAINS_THRESHOLD) / (1 - PLAINS_THRESHOLD), 1.4) * 0.9;
    return Math.min(Math.max(h, 0), 1) * maxHeight;
}

/**
 * Height a smoothstep radial bump adds at a given distance from its centre.
 * Full peak at the centre, zero at and beyond the radius, so bumps blend
 * into the surrounding terrain instead of ending in a cliff.
 */
export function mountainBump(distance, radius, peak) {
    if (radius <= 0 || distance >= radius) return 0;
    return peak * smoothstep(1 - Math.max(distance, 0) / radius);
}

/**
 * Vertex colour for a world height, as [r, g, b] in the 0-1 range: water,
 * sand, grass, rock, then snow. Shared by the base terrain and the mountain
 * pass so a peak is coloured exactly like ground of the same height.
 */
export function heightToColor(h) {
    if (h < 4)   return [0.10, 0.25, 0.65];
    if (h < 12)  return [0.75, 0.68, 0.48];
    if (h < 130) { const t = h / 130;       return [0.22 + t*0.12, 0.42 + t*0.10, 0.12]; }
    if (h < 300) { const t = (h-130) / 170; return [0.40 + t*0.20, 0.35 + t*0.10, 0.25 + t*0.10]; }
    const t = Math.min(1, (h-300) / 100);
    return [0.55 + t*0.45, 0.55 + t*0.45, 0.60 + t*0.40];
}
