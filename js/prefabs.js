/**
 * Prefabs - buildings as recipes of primitives, merged into one coloured mesh.
 *
 * A recipe is a list of parts in the prefab's own frame, in metres: `x` across,
 * `y` up from the ground it stands on, `z` along the way it faces. Each part is
 * a box, a cylinder, a cone or a wedge - a roof's triangular prism - with a
 * colour, and each stands on the point `at` names, its base on that height:
 *
 *     { shape: 'box', size: [8, 3, 10], at: [0, 0, 0], color: 0xe8dcc0 }
 *     { shape: 'wedge', size: [8.6, 2.6, 10.6], at: [0, 3, 0], color: 0x8c3b2e }
 *     { shape: 'cylinder', radius: 4.5, height: 6, at: [0, 14, 0], color: 0x9aa3a8 }
 *     { shape: 'cone', radius: 4.8, height: 2, at: [0, 20, 0], color: 0x6f777c }
 *
 * A part may be turned about its own upright by `turn`, in degrees. A wedge's
 * ridge runs along its length, down the middle or - `ridge: 'edge'` - along its
 * `+x` side, for a single slope. A cylinder may narrow to a `top` radius.
 *
 * The recipe is copied into a placement when one is placed, as a template's
 * members are, so a prefab changed later leaves a world already built as it
 * was. A recipe with `solid: false` - a park - is not something the aircraft
 * can hit.
 *
 * `recipeGeometry` merges a recipe into one list of triangles with a flat
 * normal and a colour at every corner, which `js/object-mesh.js` hands to the
 * renderer as it stands. Every face is wound outward whatever order its corners
 * were listed in, so no wall is drawn inside out.
 *
 * Pure module with no DOM or Three.js dependency.
 */

/** The shapes a part may be. */
export const PREFAB_SHAPES = Object.freeze(['box', 'cylinder', 'cone', 'wedge']);

/** Where a wedge's ridge runs: down its middle, or along its `+x` edge. */
export const WEDGE_RIDGES = Object.freeze(['middle', 'edge']);

/** The most parts a recipe may have. */
export const RECIPE_PART_LIMIT = 400;

/** How far from its middle, in metres, any part of a recipe may stand or reach. */
export const RECIPE_REACH = 500;

/** The sides a cylinder or a cone is drawn with when its part names none, and the fewest and most it may name. */
export const DEFAULT_SEGMENTS = 12;
export const MIN_SEGMENTS = 3;
export const MAX_SEGMENTS = 32;

/** The fields a part may carry, and a recipe. */
export const PART_FIELDS = Object.freeze(['shape', 'at', 'color', 'turn', 'size', 'ridge', 'radius', 'top', 'height', 'segments']);
export const RECIPE_FIELDS = Object.freeze(['parts', 'solid']);

/** The categories a prefab is offered under, in the order Insert City folds them. */
export const PREFAB_CATEGORIES = Object.freeze([
    Object.freeze({ id: 'skylines', label: 'SKYLINES' }),
    Object.freeze({ id: 'factory', label: 'FACTORY' }),
    Object.freeze({ id: 'residential', label: 'RESIDENTIAL' }),
    Object.freeze({ id: 'commercial', label: 'COMMERCIAL' }),
    Object.freeze({ id: 'infrastructure', label: 'INFRASTRUCTURE' }),
    Object.freeze({ id: 'parks', label: 'PARKS' })
]);

function deepFreeze(value) {
    if (value && typeof value === 'object') {
        for (const each of Object.values(value)) deepFreeze(each);
        Object.freeze(value);
    }
    return value;
}

/**
 * The catalogue: each prefab a name, the category it is offered under, the
 * footprint its card says - across by along, in metres - and its recipe.
 */
export const PREFABS = deepFreeze([
    {
        id: 'cottage',
        label: 'COTTAGE',
        category: 'residential',
        footprint: [8.6, 10.6],
        recipe: {
            parts: [
                { shape: 'box', size: [8, 3, 10], at: [0, 0, 0], color: 0xe8dcc0 },
                { shape: 'wedge', size: [8.6, 2.6, 10.6], at: [0, 3, 0], color: 0x8c3b2e },
                { shape: 'box', size: [0.8, 1.8, 0.8], at: [2.2, 4.2, -2.5], color: 0x7a5a48 },
                { shape: 'box', size: [1.1, 2.1, 0.12], at: [0, 0, 5.02], color: 0x4a3426 },
                { shape: 'box', size: [1.2, 1, 0.1], at: [-2.4, 1.2, 5.02], color: 0x9cc3d6 },
                { shape: 'box', size: [1.2, 1, 0.1], at: [2.4, 1.2, 5.02], color: 0x9cc3d6 }
            ]
        }
    },
    {
        id: 'water-tower',
        label: 'WATER TOWER',
        category: 'infrastructure',
        footprint: [9.6, 9.6],
        recipe: {
            parts: [
                { shape: 'box', size: [0.5, 14, 0.5], at: [-3, 0, -3], color: 0x6f777c },
                { shape: 'box', size: [0.5, 14, 0.5], at: [3, 0, -3], color: 0x6f777c },
                { shape: 'box', size: [0.5, 14, 0.5], at: [-3, 0, 3], color: 0x6f777c },
                { shape: 'box', size: [0.5, 14, 0.5], at: [3, 0, 3], color: 0x6f777c },
                { shape: 'cylinder', radius: 4.5, height: 6, at: [0, 14, 0], color: 0x9aa3a8 },
                { shape: 'cone', radius: 4.8, height: 2, at: [0, 20, 0], color: 0x6f777c }
            ]
        }
    }
]);

const BY_ID = new Map(PREFABS.map(prefab => [prefab.id, prefab]));

/** A prefab by its id, or null. */
export function prefabById(id) {
    return BY_ID.get(id) ?? null;
}

/** The prefabs offered under a category, in catalogue order. */
export function prefabsIn(category) {
    return PREFABS.filter(prefab => prefab.category === category);
}

/** A recipe copied out of its prefab, to be carried by a placement: nothing shared, nothing frozen. */
export function copyRecipe(recipe) {
    return structuredClone(recipe);
}

/** What a recipe is known by, so placements of the same recipe can be drawn as one mesh. */
export function recipeKey(recipe) {
    return JSON.stringify(recipe);
}

/** True for a recipe the aircraft can hit: everything but one marked `solid: false`. */
export function recipeSolid(recipe) {
    return recipe?.solid !== false;
}

// --- Geometry -----------------------------------------------------------------------

/**
 * A part as the convex faces its solid is bounded by, each a list of corners
 * in the part's own frame - its base on `y = 0`, its middle on the upright -
 * listed in either winding.
 */
function partFaces(part) {
    if (part.shape === 'box' || part.shape === 'wedge') {
        const [w, h, d] = part.size;
        const x = w / 2, z = d / 2;
        const base = [[-x, 0, -z], [x, 0, -z], [x, 0, z], [-x, 0, z]];
        if (part.shape === 'box') {
            const top = base.map(([px, , pz]) => [px, h, pz]);
            return [
                base, top,
                [base[0], base[1], top[1], top[0]],
                [base[1], base[2], top[2], top[1]],
                [base[2], base[3], top[3], top[2]],
                [base[3], base[0], top[0], top[3]]
            ];
        }
        // The ridge down the middle makes two slopes; along the +x edge, the
        // second slope stands upright and is that side's wall.
        const ridgeX = part.ridge === 'edge' ? x : 0;
        const front = [ridgeX, h, -z], back = [ridgeX, h, z];
        return [
            base,
            [[-x, 0, -z], [-x, 0, z], back, front],
            [[x, 0, -z], [x, 0, z], back, front],
            [[-x, 0, -z], [x, 0, -z], front],
            [[-x, 0, z], [x, 0, z], back]
        ];
    }

    const sides = Number.isInteger(part.segments) ? part.segments : DEFAULT_SEGMENTS;
    const bottom = part.radius;
    const top = part.shape === 'cone' ? 0 : (Number.isFinite(part.top) ? part.top : part.radius);
    const ring = (radius, y) => Array.from({ length: sides }, (_, i) => {
        const angle = i / sides * Math.PI * 2;
        return [Math.cos(angle) * radius, y, Math.sin(angle) * radius];
    });
    const low = ring(bottom, 0);
    const faces = [low];
    if (top > 0) {
        const high = ring(top, part.height);
        faces.push(high);
        for (let i = 0; i < sides; i++) {
            const j = (i + 1) % sides;
            faces.push([low[i], low[j], high[j], high[i]]);
        }
    } else {
        const tip = [0, part.height, 0];
        for (let i = 0; i < sides; i++) faces.push([low[i], low[(i + 1) % sides], tip]);
    }
    return faces;
}

/** A part's corner turned about its upright by `turn` degrees and stood at `at`. */
function placeCorner(part, [x, y, z]) {
    const angle = (Number(part.turn) || 0) * Math.PI / 180;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    return [x * cos - z * sin + part.at[0], y + part.at[1], x * sin + z * cos + part.at[2]];
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function middleOf(points) {
    const sum = points.reduce((total, p) => [total[0] + p[0], total[1] + p[1], total[2] + p[2]], [0, 0, 0]);
    return sum.map(value => value / points.length);
}

/** An sRGB colour channel as the linear light a renderer's vertex colours are read in. */
function linearChannel(value) {
    return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
}

/** A `0xrrggbb` colour as the three linear channels a vertex colour is written in. */
export function linearColor(hex) {
    return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map(channel => linearChannel(channel / 255));
}

/**
 * A recipe merged into one list of triangles: `positions`, `normals` and
 * `colors`, three numbers to a corner, and `count`, the corners. Each face is
 * turned to face out of its part, and carries the part's colour.
 */
export function recipeGeometry(recipe) {
    const positions = [], normals = [], colors = [];

    for (const part of recipe?.parts ?? []) {
        const faces = partFaces(part).map(face => face.map(corner => placeCorner(part, corner)));
        const centre = middleOf(faces.flat());
        const color = linearColor(part.color);

        for (const face of faces) {
            const facing = cross(sub(face[1], face[0]), sub(face[2], face[0]));
            if (!(Math.hypot(...facing) > 1e-9)) continue;
            const corners = dot(facing, sub(middleOf(face), centre)) < 0 ? [...face].reverse() : face;
            // Worked out again from the corners as they now run, and scaled by
            // its own length: a face turned round starts from another corner,
            // and a narrowing side is no parallelogram.
            const turned = cross(sub(corners[1], corners[0]), sub(corners[2], corners[0]));
            const length = Math.hypot(...turned);
            const normal = turned.map(value => value / length);

            for (let i = 1; i < corners.length - 1; i++) {
                for (const corner of [corners[0], corners[i], corners[i + 1]]) {
                    positions.push(...corner);
                    normals.push(...normal);
                    colors.push(...color);
                }
            }
        }
    }

    return {
        positions: Float32Array.from(positions),
        normals: Float32Array.from(normals),
        colors: Float32Array.from(colors),
        count: positions.length / 3
    };
}

/**
 * How far a recipe reaches: `minX`, `maxX`, `minZ`, `maxZ` and its `top`, in
 * metres in its own frame, read off every corner of every part. Null for a
 * recipe with nothing in it.
 */
export function recipeBounds(recipe) {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, top = -Infinity;
    for (const part of recipe?.parts ?? []) {
        for (const face of partFaces(part)) {
            for (const corner of face) {
                const [x, y, z] = placeCorner(part, corner);
                minX = Math.min(minX, x); maxX = Math.max(maxX, x);
                minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
                top = Math.max(top, y);
            }
        }
    }
    return Number.isFinite(top) ? { minX, maxX, minZ, maxZ, top } : null;
}

// --- Reading a recipe back ------------------------------------------------------------

const positive = value => Number.isFinite(value) && value > 0 && value <= RECIPE_REACH;
const within = value => Number.isFinite(value) && Math.abs(value) <= RECIPE_REACH;

/**
 * A recipe read from somewhere it may have been written by hand: `{ recipe,
 * problems }`, the recipe a copy of what was given, or null with the problems
 * that refuse it, each naming where. Nothing is clamped: a recipe is the shape
 * of a building, and one with a part out of bounds is not a building to guess
 * at.
 */
export function readRecipe(value, where = 'recipe') {
    const problems = [];
    const refuse = () => ({ recipe: null, problems });

    if (value == null || typeof value !== 'object' || Array.isArray(value)) {
        problems.push(`${where}: not a recipe`);
        return refuse();
    }
    for (const key of Object.keys(value)) {
        if (!RECIPE_FIELDS.includes(key)) problems.push(`${where}: ${key} is not a field a recipe has`);
    }
    if (value.solid != null && typeof value.solid !== 'boolean') problems.push(`${where}: solid is not true or false`);
    if (!Array.isArray(value.parts) || value.parts.length === 0) {
        problems.push(`${where}: parts is not a list of parts`);
        return refuse();
    }
    if (value.parts.length > RECIPE_PART_LIMIT) {
        problems.push(`${where}: more than ${RECIPE_PART_LIMIT} parts`);
        return refuse();
    }

    value.parts.forEach((part, at) => {
        const here = `${where}.parts[${at}]`;
        if (part == null || typeof part !== 'object' || Array.isArray(part)) {
            problems.push(`${here}: not a part`);
            return;
        }
        for (const key of Object.keys(part)) {
            if (!PART_FIELDS.includes(key)) problems.push(`${here}: ${key} is not a field a part has`);
        }
        if (!PREFAB_SHAPES.includes(part.shape)) {
            problems.push(`${here}: no shape is called ${JSON.stringify(part.shape ?? null)}`);
            return;
        }
        if (!Array.isArray(part.at) || part.at.length !== 3 || !part.at.every(within)) problems.push(`${here}: at is not a point`);
        if (!Number.isInteger(part.color) || part.color < 0 || part.color > 0xffffff) problems.push(`${here}: color is not a colour`);
        if (part.turn != null && !Number.isFinite(part.turn)) problems.push(`${here}: turn is not a number`);

        if (part.shape === 'box' || part.shape === 'wedge') {
            if (!Array.isArray(part.size) || part.size.length !== 3 || !part.size.every(positive)) problems.push(`${here}: size is not three lengths`);
            if (part.ridge != null && (part.shape !== 'wedge' || !WEDGE_RIDGES.includes(part.ridge))) problems.push(`${here}: ridge is not where a ridge runs`);
        } else {
            if (!positive(part.radius)) problems.push(`${here}: radius is not a length`);
            if (!positive(part.height)) problems.push(`${here}: height is not a length`);
            if (part.top != null && (part.shape !== 'cylinder' || !(Number.isFinite(part.top) && part.top >= 0 && part.top <= RECIPE_REACH))) {
                problems.push(`${here}: top is not a radius`);
            }
            if (part.segments != null && !(Number.isInteger(part.segments) && part.segments >= MIN_SEGMENTS && part.segments <= MAX_SEGMENTS)) {
                problems.push(`${here}: segments is not ${MIN_SEGMENTS} to ${MAX_SEGMENTS} sides`);
            }
        }
    });

    return problems.length > 0 ? refuse() : { recipe: structuredClone(value), problems };
}
