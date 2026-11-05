/**
 * Erase - a stroke that takes elements away rather than laying one.
 *
 * Erase is not an element. It writes nothing to the field: an erase batch is a
 * region cut out of the placements laid before it, and where a placement's
 * weight falls to nothing the ground is as it stood before that element ran -
 * a mountain erased leaves the ground it was raised from, grass erased the
 * ground under the grass, paint erased the colour under the paint. Not paint
 * over it: the ground without it.
 *
 * So it is resolved before anything is applied. `resolveErasures` walks the
 * placements in the order they were committed - the world's own first, then
 * what was built on it - and gives each placement an erase batch reaches a
 * `cut`: the regions taken out of it, which the compositor multiplies into
 * its weight. A batch cuts what was laid before it and nothing laid after, so
 * grass erased and then laid again is grass; and the world's own placements
 * come before anything a session commits, so every one of them is erasable.
 *
 * Pure module with no DOM or Three.js dependency, so the arithmetic can be unit
 * tested in Node.
 */

import { ELEMENTS, choice, scalar, isElementId, getElement } from './elements.js';
import { combineFootprints, isFootprint } from './footprints.js';

/** The type an erase batch is placed as. Not in the registry, and never applied. */
export const ERASE_TYPE = 'erase';

/** The target that takes every element - every one but the strip. */
export const ERASE_ALL = 'all';

/**
 * What a batch can take away: `ALL`, and then every element the registry holds,
 * read off it rather than listed, so an element added later is erasable without
 * this file being opened.
 */
export const ERASE_TARGETS = Object.freeze([ERASE_ALL, ...ELEMENTS.map(element => element.id)]);

/**
 * An erase batch's own ranges, which are its panel's beside the brush: what it
 * takes, and how much of it. A strength below whole thins an element rather than
 * removing it - the cut is `1 - strength * weight`.
 */
export const ERASE_RANGES = Object.freeze({
    target:   Object.freeze(choice(ERASE_TARGETS, ERASE_ALL)),
    strength: Object.freeze(scalar(0, 1, 1, { percent: true }))
});

/** True for an erase batch. */
export function isErase(placement) {
    return placement?.type === ERASE_TYPE;
}

/**
 * The ranges a placement of `type` is configured through: an element's, the
 * erase batch's own, or null for a type that is neither.
 */
export function placementRanges(type) {
    if (type === ERASE_TYPE) return ERASE_RANGES;
    return isElementId(type) ? getElement(type).ranges : null;
}

/**
 * An erase batch's configuration, filled in: its target - `ALL` for one that
 * names none the batch can take - its strength held to 0 to 1, and whether it
 * puts back rather than takes, which `alt` at the press of its first stroke
 * says and no panel row does.
 */
export function eraseConfig(placement) {
    const config = placement?.config ?? {};
    const strength = Number(config.strength);
    return {
        target: ERASE_TARGETS.includes(config.target) ? config.target : ERASE_ALL,
        strength: Number.isFinite(strength) ? Math.min(Math.max(strength, 0), 1) : ERASE_RANGES.strength.default,
        restore: config.restore === true
    };
}

/**
 * True when an erase batch reaches a placement by what it names.
 *
 * `ALL` takes every element but the strip: a runway is the one thing a flight
 * depends on, so it is taken only when `RUNWAY` is the target named. And only a
 * strip that was placed - one carrying `at` - since a strip the site search
 * finds is laid where the search puts it when the world is flown, never on the
 * canvas the stroke was drawn over.
 */
export function erases(batch, placement) {
    const type = placement?.type;
    if (!isElementId(type)) return false;
    const { target } = eraseConfig(batch);
    if (type === 'runway') return target === 'runway' && Array.isArray(placement.config?.at);
    return target === ERASE_ALL || target === type;
}

/** The region an erase batch covers: its footprint, inside the selection it was drawn within. Null for one that covers nothing. */
export function eraseRegion(batch) {
    if (!isFootprint(batch?.footprint)) return null;
    return isFootprint(batch.clip) ? combineFootprints('intersect', batch.footprint, batch.clip) : batch.footprint;
}

/**
 * The placements a world is drawn from, with every erase batch resolved into
 * the placements before it and taken out of the list.
 *
 * A placement an erase batch reaches carries `cut`, the batches that cut it in
 * the order they were committed, each `{ footprint, strength, kept }`: the
 * region taken, how much of it, and the put-back batches after it that hand
 * part of it back, each `{ footprint, strength }`. A put-back batch - laid with
 * `alt` held - is cut out of the regions the batches before it took from the
 * placements it names, by the same arithmetic run the other way:
 *
 *     weight * (1 - strength * taken * (1 - strength' * putBack))
 *
 * The placements are left as drawn otherwise, so anything worked out from a
 * footprint is worked out from it as drawn - a cover's band, drawn water's line
 * - and erasing part of a thing leaves the rest of it exactly as it was. The
 * list is the caller's, untouched; a placement with nothing cut is the same
 * object it was.
 */
export function resolveErasures(placements = []) {
    const list = Array.isArray(placements) ? placements : [];
    const resolved = [];

    list.forEach((placement, at) => {
        if (isErase(placement)) return;

        const cut = [];
        for (let later = at + 1; later < list.length; later++) {
            const batch = list[later];
            if (!isErase(batch)) continue;
            const { strength, restore } = eraseConfig(batch);
            const region = eraseRegion(batch);
            if (restore || !(strength > 0) || region == null || !erases(batch, placement)) continue;

            const kept = [];
            for (let after = later + 1; after < list.length; after++) {
                const back = list[after];
                if (!isErase(back) || !eraseConfig(back).restore || !erases(back, placement)) continue;
                const area = eraseRegion(back);
                const amount = eraseConfig(back).strength;
                if (area != null && amount > 0) kept.push({ footprint: area, strength: amount });
            }
            cut.push({ footprint: region, strength, kept });
        }

        resolved.push(cut.length > 0 ? { ...placement, cut } : placement);
    });

    return resolved;
}
