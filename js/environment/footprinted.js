/**
 * Footprinted elements - an element drawn only where a footprint reaches.
 *
 * Every generator in `elements.js` is a whole-world algorithm: grass paints an
 * altitude band across the field, water fills everything under a level, a
 * mountain scatters peaks over the whole of it. None of them can be told where
 * to stop, and most of them write `field.height` directly, some of them inside
 * the shaping arithmetic - so gating their writes would mean finding and
 * changing every one, and an element added later would be wrong by omission.
 *
 * So nothing in the registry is changed. The element is run on a copy of the
 * field, exactly as it was written, and the copy is blended back into the field
 * through the footprint's weight: all of it where the weight is 1, none of it
 * where the weight is 0, and in proportion across the feather between. An
 * element added later is clippable without having been written to be.
 *
 * Pure module with no DOM or Three.js dependency, like the generators, so a
 * footprinted placement can be unit tested in Node.
 */

import {
    applyElement, cloneField, fieldX, fieldZ, readColor, mixColor, createRandom, getElement, waterRecord
} from './elements.js';
import { footprintSampler, featherFor, PLACED_KIND, COMBINE_KIND } from './footprints.js';

/**
 * Draws one placement onto a field, through its footprint when it has one.
 *
 * A placement with no footprint is applied exactly as it always was, so every
 * preset and every world built before footprints existed is the same ground.
 *
 * A footprinted one is read in the **canvas's** frame: each vertex has the
 * field's own origin taken off it before it is weighed, and the region repeats
 * a field width apart. So the same placement lands at the same canvas
 * coordinate on every tile of a world, and a region drawn over an edge of the
 * canvas carries on across the opposite one - the built tile is the pattern the
 * world repeats, and the pattern meets itself at every seam.
 *
 * The element is run on the tile being drawn, not once on a canvas and carried:
 * each tile is generated from its own seed, so the ground under a canvas
 * coordinate is different ground on every tile, and anything the element works
 * out from the ground - a level, a band, a slope - has to be worked out from
 * that tile's ground or it is right on one tile in nine.
 *
 * Two things live beside the heights rather than in them, and are carried
 * across from the copy by hand:
 *
 * - **A strip the element cut** is recorded on the field as well as in it,
 *   because the flight model finds a runway by asking for one by name. Every
 *   strip the copy gained is added to the field's.
 * - **The water's line comes across, and its level does not.** A drawn body is
 *   water where it was drawn and nowhere else: its line is carried back
 *   wherever the region reaches, and a renderer finds it there. The level is
 *   the sea's, one height for the whole tile, and raising it to a body drawn on
 *   a hill would lift every strip on the tile clear of a pond far above it.
 *
 * A placement carrying a `seed` draws from a stream of its own rather than from
 * `random` - see `placementRandom`.
 *
 * A placement carrying a `clip` - the selection a tool that minds the lasso was
 * drawn inside - is weighed by it as well: its footprint's weight times the
 * clip's, or the clip's alone for a placement with no footprint of its own. An
 * intersection by multiplying two weights, so a clipped edge stays soft
 * wherever either region's edge was soft, and a placement with no clip costs
 * nothing for the clips other placements carry.
 *
 * An element drawn through a footprint of its own has the ranges it declares
 * in `footprintSettles` worked out here, from the ground the footprint covers
 * on this tile, in place of whatever the placement holds - see
 * `settleFromFootprint`.
 *
 * Returns whatever the element's generator counted, as `applyElement` does.
 */
export function applyFootprintedElement(field, placement, random = createRandom()) {
    random = placementRandom(placement, random);
    if (placement?.footprint == null && placement?.clip == null) return applyElement(field, placement, random);

    const region = placement.footprint != null ? footprintSampler(placement.footprint, field.size) : null;
    const clip   = placement.clip != null ? footprintSampler(placement.clip, field.size) : null;
    const draft = cloneField(field);
    const strips = field.runways.length;

    // Weighed once, before the element is drawn, because the ground under the
    // region is read twice: for what the footprint settles, on the ground as it
    // was, and for the blend back afterwards.
    const weights = new Float32Array(field.count);
    for (let i = 0; i < field.count; i++) {
        const x = fieldX(field, i) - field.originX;
        const z = fieldZ(field, i) - field.originZ;
        weights[i] = (region ? region(x, z) : 1) * (clip ? clip(x, z) : 1);
    }

    // The element is drawn whatever its footprint turns out to cover, so it
    // takes from the seeded stream exactly what it would have taken - a region
    // that covers nothing leaves every placement after it laid out as it was.
    const result = applyElement(draft, settleFromFootprint(field, placement, weights), random);

    for (let i = 0; i < field.count; i++) {
        const weight = weights[i];
        if (weight <= 0) continue;

        field.height[i] += (draft.height[i] - field.height[i]) * weight;
        mixColor(field, i, readColor(draft, i), weight);
    }

    field.runways.push(...draft.runways.slice(strips));
    carryWaterLine(field, draft, weights);

    return result;
}

/**
 * The water line the element left on its copy, carried back wherever the
 * region reaches - and only there, so water drawn through a footprint is water
 * where it was drawn and nowhere else on the tile. The sea's level is never
 * carried: it is one height for the whole tile, and a drawn body raising it
 * would flood every vertex below its line.
 *
 * Across the feather the ground eases from where it was toward the line, so
 * the shore needs nothing of its own: only the vertices that reach the line
 * are wet.
 */
function carryWaterLine(field, draft, weights) {
    const drawn = draft.water?.line;
    if (drawn == null) return;

    const line = waterRecord(field).line;
    for (let i = 0; i < field.count; i++) {
        if (weights[i] > 0) line[i] = drawn[i];
    }
}

/** How far under the lowest bank drawn water rests, so it shows at the bank it is held by rather than lying level with it. */
export const WATER_SINK = 1.5;

/** How far under a stroke's lowest ground drawn snow's line is put, so nothing in the stroke is turned away for lying low. */
export const SNOW_UNDER = 1;

/**
 * The ways a footprint's strokes went, in the canvas's frame, each with half
 * its stamp's width and half its depth in the same units: what drawn water and
 * drawn snow measure across. Strokes set down in a frame are set down with it,
 * their widths stretched by it; a combination's strokes are both parts' but
 * what a cut takes away. A footprint with no strokes in it has none.
 */
export function strokeWays(footprint) {
    const ways = [];

    const walk = (fp, place, scale) => {
        if (fp == null || typeof fp !== 'object') return;

        if (fp.kind === 'stroke') {
            const width = Number(fp.stamp?.width), depth = Number(fp.stamp?.depth);
            if (!(width > 0) || !(depth > 0)) return;
            const points = (Array.isArray(fp.points) ? fp.points : [])
                .filter(point => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]))
                .map(([x, z]) => place(x, z));
            if (points.length > 0) ways.push({ points, half: width / 2 * scale, end: depth / 2 * scale });
            return;
        }

        if (fp.kind === PLACED_KIND) {
            const x = Number(fp.x), z = Number(fp.z), angle = Number(fp.angle) || 0;
            const sx = fp.scaleX ?? 1, sz = fp.scaleZ ?? 1;
            if (!Number.isFinite(x) || !Number.isFinite(z) || !(sx > 0) || !(sz > 0)) return;
            const cos = Math.cos(angle), sin = Math.sin(angle);
            walk(fp.of, (u, v) => place(x + u * sx * cos - v * sz * sin, z + u * sx * sin + v * sz * cos), scale * Math.sqrt(sx * sz));
            return;
        }

        if (fp.kind === COMBINE_KIND) {
            walk(fp.a, place, scale);
            if (fp.op !== 'subtract') walk(fp.b, place, scale);
        }
    };

    walk(footprint, (x, z) => [x, z], 1);
    return ways;
}

/** A way walked again at even steps of `spacing`, first point and last kept. */
function resample(points, spacing) {
    if (points.length < 2) return points.map(point => [...point]);
    const out = [[...points[0]]];
    for (let i = 1; i < points.length; i++) {
        const [ax, az] = points[i - 1], [bx, bz] = points[i];
        const length = Math.hypot(bx - ax, bz - az);
        const steps = Math.max(1, Math.ceil(length / spacing));
        for (let k = 1; k <= steps; k++) out.push([ax + (bx - ax) * k / steps, az + (bz - az) * k / steps]);
    }
    return out;
}

/**
 * Where across a drawn stroke each vertex of the tile lies, and how low its
 * banks are there: the measure drawn water and drawn snow are laid by.
 *
 * Each way is walked at half a cell's spacing, and at every step the lowest
 * ground within half the stroke's width is found - the lowest bank of the
 * stroke's cross-section there. Every vertex then takes the bank of the point
 * of the way it lies across from, read between the two steps either side of
 * it: so every vertex across a stroke sees the same lowest bank and water lies
 * level across it, along it the line runs on between steps with no step of its
 * own for the swell to show, and it follows the ground down - a stroke down a
 * slope is a stream, not a trench cut to the level of its lowest end. A pass
 * smoothing the banks along the way as well was measured and dropped: read
 * between steps half a cell apart, the line came out no more even for it.
 * `inward` is how far in from the stroke's edge a vertex is, 1 on its middle
 * and 0 at either side.
 *
 * Only this tile's own vertices are searched: at an edge the lowest bank is
 * looked for among them, and the ground running on across the seam is the
 * next tile's to find. A stroke over the seam is measured at each of its
 * repeats that reaches the tile.
 *
 * A footprint with no strokes - a disc of water, a box - is a pond: one bank,
 * the lowest ground it reaches, and `inward` its weight.
 */
export function bankMeasure(field, weights, footprint) {
    const count = field.count;
    const bank   = new Float32Array(count).fill(NaN);
    const inward = new Float32Array(count);

    const ways = strokeWays(footprint);
    if (ways.length === 0) {
        const low = FOOTPRINT_SETTLERS.relief({ field, weights })?.[0];
        if (low == null) return { bank, inward };
        for (let i = 0; i < count; i++) {
            if (weights[i] > 0) { bank[i] = low; inward[i] = weights[i]; }
        }
        return { bank, inward };
    }

    const { size, step, stride } = field;
    const half = size / 2;
    const nearest = new Float32Array(count).fill(Infinity);
    const owner   = new Int32Array(count).fill(-1);
    const at      = new Int32Array(count);
    const walked  = [];
    const feather = featherFor(step);

    // The cells of the tile within `radius` of a point in the canvas's frame,
    // each with how far off it is.
    const around = (x, z, radius, visit) => {
        const c0 = Math.max(0, Math.ceil((x - radius + half) / step));
        const c1 = Math.min(stride - 1, Math.floor((x + radius + half) / step));
        const r0 = Math.max(0, Math.ceil((z - radius + half) / step));
        const r1 = Math.min(stride - 1, Math.floor((z + radius + half) / step));
        for (let row = r0; row <= r1; row++) {
            const dz = -half + row * step - z;
            for (let col = c0; col <= c1; col++) {
                const away = Math.hypot(-half + col * step - x, dz);
                if (away <= radius) visit(row * stride + col, away);
            }
        }
    };

    for (const way of ways) {
        const reach = Math.max(way.half, way.end) + feather;
        const xs = way.points.map(point => point[0]), zs = way.points.map(point => point[1]);
        const [minX, maxX, minZ, maxZ] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];

        for (const [i, j] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]]) {
            const sx = i * size, sz = j * size;
            if (maxX + sx + reach < -half || minX + sx - reach > half || maxZ + sz + reach < -half || minZ + sz - reach > half) continue;

            const samples = resample(way.points.map(([x, z]) => [x + sx, z + sz]), step / 2);
            // NaN for a step whose cross-section finds none of this tile's ground.
            const lows = samples.map(([x, z]) => {
                let low = Infinity;
                around(x, z, way.half, index => { if (field.height[index] < low) low = field.height[index]; });
                return Number.isFinite(low) ? low : NaN;
            });

            const id = walked.push({ samples, lows, half: way.half }) - 1;
            samples.forEach(([x, z], k) => {
                around(x, z, reach, (index, away) => {
                    if (away >= nearest[index]) return;
                    nearest[index] = away;
                    owner[index] = id;
                    at[index] = k;
                });
            });
        }
    }

    // Each vertex read off the way at the point it lies across from, between
    // the two steps either side of that point, rather than off the nearer step:
    // so every vertex across a stroke at the same place along it is given the
    // same bank, whichever step a tie happened to fall to, and the line runs
    // on smoothly along the way rather than in steps half a cell long.
    for (let index = 0; index < count; index++) {
        const id = owner[index];
        if (id < 0) continue;

        const { samples, lows, half: across } = walked[id];
        const k = at[index];
        const x = -half + (index % stride) * step, z = -half + Math.floor(index / stride) * step;
        const [px, pz] = samples[k];

        let other = k, t = 0;
        for (const next of [k + 1, k - 1]) {
            if (next < 0 || next >= samples.length) continue;
            const dx = samples[next][0] - px, dz = samples[next][1] - pz;
            const lengthSq = dx * dx + dz * dz;
            const share = lengthSq > 0 ? ((x - px) * dx + (z - pz) * dz) / lengthSq : 0;
            if (share > 0) { other = next; t = Math.min(share, 1); break; }
        }

        const onX = px + (samples[other][0] - px) * t, onZ = pz + (samples[other][1] - pz) * t;
        const a = lows[k], b = lows[other];
        bank[index] = Number.isFinite(a) && Number.isFinite(b) ? a + (b - a) * t : Number.isFinite(a) ? a : b;
        inward[index] = Math.min(Math.max(1 - Math.hypot(x - onX, z - onZ) / across, 0), 1);
    }

    return { bank, inward };
}

/**
 * How each value a footprint settles is worked out from the ground it covers:
 * by name, as an element's `footprintSettles` names it, from the field before
 * the element is drawn and the region's weight at every vertex of it.
 *
 * - `relief` - the lowest and the highest ground the region reaches, which is
 *   a ground cover's band. Left at its declaration it clips: grass's default
 *   ends at 130, so a stroke up a hillside would stop half way for no reason
 *   the panel shows, and sand's is eight units wide above the waterline, so a
 *   stroke of sand across a field would show nothing at all. Opened to the
 *   whole range it clips nothing, but grades the colour over two thousand
 *   units of height the stroke's ground does not have, so every patch lands
 *   at the light end. The ground's own relief clips nothing inside the stroke
 *   and runs the colour from its low ground to its high, so both ends show on
 *   any slope. Null where the region reaches no vertex, which leaves the
 *   declared value standing for a stroke that draws nothing here anyway.
 * - `lowest` - just under the lowest ground the region reaches, which is drawn
 *   snow's line: a gate rather than a grade, so nothing in the stroke is
 *   turned away for being low. Left at its default of 300, snow drawn on
 *   ground below that - most of a canvas - would settle nowhere.
 * - `waterLine` - drawn water's line at every vertex the region reaches, and
 *   how far in from the bank each is, for `drawn`. Water cannot stand higher
 *   than the lowest ground beside it, or it runs out there, so the line is the
 *   lowest bank of the stroke's cross-section - see `bankMeasure` - a little
 *   under it, and never above the ground at the vertex: the ground under the
 *   stroke is only ever cut to it, so drawn water is a cut into the ground
 *   rather than a sheet propped over it. NaN where the region does not reach.
 * - `inward` - how far in from the stroke's edge every vertex is, for drawn
 *   snow's depth.
 */
export const FOOTPRINT_SETTLERS = Object.freeze({
    relief({ field, weights }) {
        let low = Infinity, high = -Infinity;
        for (let i = 0; i < field.count; i++) {
            if (!(weights[i] > 0)) continue;
            const h = field.height[i];
            if (h < low) low = h;
            if (h > high) high = h;
        }
        return low <= high ? [low, high] : null;
    },

    lowest(context) {
        const relief = FOOTPRINT_SETTLERS.relief(context);
        return relief == null ? null : relief[0] - SNOW_UNDER;
    },

    waterLine(context) {
        const { field, weights } = context;
        const { bank, inward } = context.measure();
        const line = new Float32Array(field.count).fill(NaN);
        for (let i = 0; i < field.count; i++) {
            if (weights[i] > 0 && Number.isFinite(bank[i])) line[i] = Math.min(bank[i], field.height[i]) - WATER_SINK;
        }
        return { line, inward };
    },

    inward(context) {
        return { inward: context.measure().inward };
    }
});

/**
 * The placement as its element is drawn on this tile: its configuration with
 * each range the element says a footprint settles worked out from the ground
 * under the region, here. Worked out by the caller on the tile being drawn,
 * rather than once and carried, because every tile has different ground under
 * the same canvas coordinate - and handed to the generator as an ordinary
 * value, so the generator stays a whole-field function that knows nothing of
 * footprints.
 *
 * Only a placement with a footprint of its own: a clip alone settles nothing,
 * and a placement with neither is drawn as it always was.
 */
export function settleFromFootprint(field, placement, weights) {
    if (placement?.footprint == null) return placement;

    const settles = getElement(placement.type)?.footprintSettles;
    if (settles == null) return placement;

    // What a settler is handed: the ground, the region's weights, and the
    // measure across its strokes, worked out once however many ask for it.
    let measured = null;
    const context = {
        field, weights, placement,
        measure: () => (measured ??= bankMeasure(field, weights, placement.footprint))
    };

    const config = { ...(placement.config ?? {}) };
    for (const [name, how] of Object.entries(settles)) {
        const value = FOOTPRINT_SETTLERS[how]?.(context);
        if (value != null) config[name] = value;
    }
    return { ...placement, config };
}

/**
 * The stream a placement draws from: its own, seeded from its `seed`, when it
 * carries one, and the world's shared `random` when it does not.
 *
 * A preset's placements share one stream, in the order they are applied, which
 * is what makes a described world the same world every time. A placement built
 * on top of one is applied among them by type - a built mountain beside the
 * preset's mountains, before its water and its forest - and taking from the
 * shared stream there would move every draw after it: dropping one mountain
 * would put the preset's forest, town and river somewhere else. Drawing from a
 * stream of its own, it takes nothing the preset's elements were going to
 * draw, so they stay where they were; and it draws the same values on every
 * tile of a world and every time it is drawn, so a built mountain is the same
 * mountain wherever the pattern repeats it.
 *
 * A seed is any finite number. Anything else is no seed, and the placement
 * shares the world's stream as every placement did before seeds existed.
 */
export function placementRandom(placement, random = createRandom()) {
    const seed = placement?.seed;
    return Number.isFinite(seed) ? createRandom(seed) : random;
}
