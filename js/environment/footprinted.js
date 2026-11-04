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
    applyElement, cloneField, fieldX, fieldZ, readColor, mixColor, createRandom
} from './elements.js';
import { footprintSampler } from './footprints.js';

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
 * - **The water's level is not moved.** A drawn body is water where it was
 *   drawn and nowhere else, and the level a renderer animates is the sea's,
 *   reaching every vertex under it across the whole tile. Raising it to a body
 *   drawn on a hill would flood the tile below that line. The body's own ground
 *   and colour come across; giving it a surface of its own is the per-vertex
 *   water line, which arrives with drawn water.
 *
 * A placement carrying a `seed` draws from a stream of its own rather than from
 * `random` - see `placementRandom`.
 *
 * Returns whatever the element's generator counted, as `applyElement` does.
 */
export function applyFootprintedElement(field, placement, random = createRandom()) {
    random = placementRandom(placement, random);
    if (placement?.footprint == null) return applyElement(field, placement, random);

    const weigh = footprintSampler(placement.footprint, field.size);
    const draft = cloneField(field);
    const strips = field.runways.length;

    // The element is drawn whatever its footprint turns out to cover, so it
    // takes from the seeded stream exactly what it would have taken - a region
    // that covers nothing leaves every placement after it laid out as it was.
    const result = applyElement(draft, placement, random);

    for (let i = 0; i < field.count; i++) {
        const weight = weigh(fieldX(field, i) - field.originX, fieldZ(field, i) - field.originZ);
        if (weight <= 0) continue;

        field.height[i] += (draft.height[i] - field.height[i]) * weight;
        mixColor(field, i, readColor(draft, i), weight);
    }

    field.runways.push(...draft.runways.slice(strips));

    return result;
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
