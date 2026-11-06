/**
 * Objects on the ground - placements drawn as meshes standing on the ground
 * rather than raised out of it.
 *
 * Everything built so far is ground: an airport's hangar is an extrusion of
 * the heightfield. Ground is sampled every 80 metres, so a house falls between
 * its vertices and a tower is a soft lump. An object is the other kind of
 * placement - a prefab's recipe, copied in, standing where it was put:
 *
 *     { type: 'object', prefab: 'cottage', recipe: { parts: [ ... ] },
 *       config: { at: [x, z], heading, scale } }
 *
 * It is a placement like any other - committed, picked up and changed, saved
 * in the file, repeated on every tile of the endless world at the same point
 * of the canvas - but it changes no ground. `buildEnvironment` leaves it out,
 * and this module lays it out over whatever ground the tile drew:
 *
 * - **It stands on the highest ground under its footprint,** with a plinth
 *   down to the lowest, so no corner is buried and none floats.
 * - **It is solid.** `obstacleTop` is the top of the object over a point, and
 *   anything under it inside the footprint has hit the object: a roof is not
 *   ground to land on. An object whose recipe says `solid: false` - a park -
 *   lies on the ground and is flown over.
 * - **Erase takes it whole,** when a batch that takes everything covers its
 *   middle, as Erase takes a placed runway whole - and a batch putting back
 *   over its middle puts it back.
 *
 * Its footprint is a rectangle round its recipe, turned to its heading and
 * scaled - the region Select picks it by, its outline is drawn round, and the
 * aircraft is tested against.
 *
 * Pure module with no DOM or Three.js dependency.
 */

import { scalar, wrapOffset } from './environment/elements.js';
import { footprintWeight } from './environment/footprints.js';
import { isErase, eraseConfig, eraseRegion, ERASE_ALL } from './environment/erase.js';
import { recipeBounds, recipeKey, recipeSolid, copyRecipe, prefabById } from './prefabs.js';

/** The placement type an object is. */
export const OBJECT_TYPE = 'object';

/** What an object's panel steps: the way it faces and how large it is drawn. */
export const OBJECT_RANGES = Object.freeze({
    heading: Object.freeze({ ...scalar(0, 359, 0), step: 1 }),
    scale: Object.freeze({ ...scalar(0.5, 3, 1), step: 0.1 })
});

/**
 * How strong a batch must be to take an object, or to give one back. Its
 * region need only reach the object's middle at all: a stroke's feathered edge
 * thins the ground it crosses, but a building is there or it is not.
 */
export const OBJECT_ERASE_STRENGTH = 0.5;

/** How many points across and along its footprint the ground under an object is read at. */
export const STAND_SAMPLES = 5;

/** True for an object placement. */
export function isObject(placement) {
    return placement?.type === OBJECT_TYPE;
}

function clamp(value, low, high) {
    return Math.min(Math.max(value, low), high);
}

/** An object's point, heading and scale, filled in and held to what they may be. */
export function objectConfig(placement) {
    const config = placement?.config ?? {};
    const held = (name, value) => {
        const range = OBJECT_RANGES[name];
        return Number.isFinite(value) ? clamp(value, range.low, range.high) : range.default;
    };
    const at = Array.isArray(config.at) && config.at.length === 2 && config.at.every(Number.isFinite) ? [config.at[0], config.at[1]] : [0, 0];
    const heading = Number.isFinite(config.heading) ? ((config.heading % 360) + 360) % 360 : 0;
    return { at, heading: Math.min(heading, OBJECT_RANGES.heading.high), scale: held('scale', config.scale) };
}

/**
 * A prefab placed at a point - its recipe copied in, so the placement keeps
 * the building it was placed as - or null for a prefab there is not.
 */
export function placeObject(prefabId, at, { heading = 0, scale = 1 } = {}) {
    const prefab = prefabById(prefabId);
    if (prefab == null || !Array.isArray(at) || at.length !== 2 || !at.every(Number.isFinite)) return null;
    const placement = { type: OBJECT_TYPE, prefab: prefab.id, recipe: copyRecipe(prefab.recipe), config: { at: [at[0], at[1]], heading, scale } };
    placement.config = { ...placement.config, ...objectConfig(placement) };
    return placement;
}

/**
 * An object's footprint, as a hard-edged rectangle in the canvas's frame: its
 * recipe's reach across and along, scaled, round the middle of that reach,
 * turned to its heading - so the depth runs the way it faces, as a placed
 * runway's strip does. Null for an object with nothing in its recipe.
 */
export function objectFootprint(placement) {
    const bounds = recipeBounds(placement?.recipe);
    if (bounds == null) return null;
    const { at, heading, scale } = objectConfig(placement);
    const angle = heading * Math.PI / 180;
    const cx = (bounds.minX + bounds.maxX) / 2 * scale;
    const cz = (bounds.minZ + bounds.maxZ) / 2 * scale;
    return {
        kind: 'rect',
        x: at[0] + cx * Math.cos(angle) - cz * Math.sin(angle),
        z: at[1] + cx * Math.sin(angle) + cz * Math.cos(angle),
        width: (bounds.maxX - bounds.minX) * scale,
        depth: (bounds.maxZ - bounds.minZ) * scale,
        angle,
        corner: 0,
        feather: 0
    };
}

/** How tall an object stands over the ground it was set on, its scale and all. */
export function objectHeight(placement) {
    const bounds = recipeBounds(placement?.recipe);
    return bounds == null ? 0 : Math.max(bounds.top, 0) * objectConfig(placement).scale;
}

/**
 * True when the erase batches after an object take it: the last batch whose
 * region reaches its middle decides, an erase of everything taking it and a
 * put-back giving it back. `later` is the placements committed after it, in
 * order.
 */
export function objectErased(placement, later = [], size = 0) {
    const { at } = objectConfig(placement);
    let taken = false;
    for (const batch of later) {
        if (!isErase(batch)) continue;
        const { target, strength, restore } = eraseConfig(batch);
        const region = eraseRegion(batch);
        if (region == null || !(strength >= OBJECT_ERASE_STRENGTH)) continue;
        if (!restore && target !== ERASE_ALL) continue;
        if (!(footprintWeight(region, at[0], at[1], size) > 0)) continue;
        taken = !restore;
    }
    return taken;
}

/** The corners and the inside of a footprint, as `STAND_SAMPLES` by `STAND_SAMPLES` points. */
function footprintPoints(footprint) {
    const points = [];
    const cos = Math.cos(footprint.angle), sin = Math.sin(footprint.angle);
    for (let i = 0; i < STAND_SAMPLES; i++) {
        for (let j = 0; j < STAND_SAMPLES; j++) {
            const u = (i / (STAND_SAMPLES - 1) - 0.5) * footprint.width;
            const v = (j / (STAND_SAMPLES - 1) - 0.5) * footprint.depth;
            points.push([footprint.x + u * cos - v * sin, footprint.z + u * sin + v * cos]);
        }
    }
    return points;
}

/**
 * The objects a tile draws, standing on its ground: every object placement in
 * `placements` that no later batch erased, each laid out as
 *
 *     { key, recipe, prefab, x, z, yaw, scale, stand, base, top, footprint, solid, plinth }
 *
 * where `x` and `z` are the point it stands at in the world, `yaw` the turn
 * that faces it along its heading, `stand` the highest ground under its
 * footprint and `base` the lowest - the plinth runs between them - `top` the
 * height of its highest part, `footprint` its rectangle in the world, and
 * `plinth` the colour its recipe asks its plinth be, or null for the usual.
 *
 * `groundAt(x, z)` is the tile's ground, in the world; `originX` and `originZ`
 * are where the tile's middle is, which every canvas point is measured from;
 * `size` is the canvas's width, which an erase batch's region wraps across.
 */
export function standingObjects(placements = [], { groundAt = () => 0, originX = 0, originZ = 0, size = 0 } = {}) {
    const list = Array.isArray(placements) ? placements : [];
    const standing = [];

    list.forEach((placement, index) => {
        if (!isObject(placement)) return;
        if (objectErased(placement, list.slice(index + 1), size)) return;
        const footprint = objectFootprint(placement);
        if (footprint == null) return;

        const { at, heading, scale } = objectConfig(placement);
        const world = { ...footprint, x: footprint.x + originX, z: footprint.z + originZ };
        const heights = footprintPoints(world).map(([x, z]) => Number(groundAt(x, z)) || 0);
        const stand = Math.max(...heights);
        const base = Math.min(...heights);

        standing.push({
            key: recipeKey(placement.recipe),
            recipe: placement.recipe,
            prefab: placement.prefab ?? null,
            x: at[0] + originX,
            z: at[1] + originZ,
            yaw: -heading * Math.PI / 180,
            scale,
            stand,
            base,
            top: stand + objectHeight(placement),
            footprint: world,
            solid: recipeSolid(placement.recipe),
            plinth: Number.isInteger(placement.recipe?.plinth) ? placement.recipe.plinth : null
        });
    });

    return standing;
}

/** True for a point inside a standing object's footprint. */
export function insideObject(object, x, z) {
    const { footprint } = object;
    const dx = x - footprint.x, dz = z - footprint.z;
    const cos = Math.cos(-footprint.angle), sin = Math.sin(-footprint.angle);
    const u = dx * cos - dz * sin;
    const v = dx * sin + dz * cos;
    return Math.abs(u) <= footprint.width / 2 && Math.abs(v) <= footprint.depth / 2;
}

/**
 * The top of the solid object over a point - the highest, where two overlap -
 * or null where there is none. Below it, inside the footprint, is inside the
 * object: a wall, or a roof come down on.
 */
export function obstacleTop(objects = [], x, z) {
    let top = null;
    for (const object of objects ?? []) {
        if (!object.solid || !insideObject(object, x, z)) continue;
        if (top == null || object.top > top) top = object.top;
    }
    return top;
}

/** The point an object stands at, kept on a canvas `size` wide. */
export function keepObjectOnCanvas(at, size = 0) {
    return size > 0 ? at.map(value => wrapOffset(value, size)) : at;
}
