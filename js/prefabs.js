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
 * can hit. `plinth` is the colour of the plinth it stands on where the ground
 * falls away under it - a park's is grass, so it reads as a terrace.
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
export const RECIPE_FIELDS = Object.freeze(['parts', 'solid', 'plinth']);

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

// --- The catalogue ---------------------------------------------------------------------

/**
 * The colours the catalogue is painted in, named for what they are, so a row
 * of houses reads as one street rather than as a dozen guesses at brick.
 */
const PAINT = Object.freeze({
    cream: 0xe8dcc0, render: 0xd9d2c3, white: 0xeeece6, brick: 0xa4553f, brickDark: 0x7d3f30, sandstone: 0xc9b083,
    concrete: 0xb9b4aa, concreteDark: 0x857f76, slate: 0x4f565c, tile: 0x8c3b2e, roofGrey: 0x5c6166,
    glass: 0x5f7f99, glassLight: 0x9fbdd1, glassDark: 0x3e5568, window: 0x9cc3d6, door: 0x4a3426,
    steel: 0x8a9399, steelDark: 0x5d666c, rust: 0x8a5a3c, red: 0xb5332b, yellow: 0xe0b040, blue: 0x3f6fa8,
    green: 0x4f8a4a, grass: 0x6a9a48, grassDark: 0x56853c, hedge: 0x3f6b35, leaf: 0x4e7d3a, leafDark: 0x3c6630,
    trunk: 0x6b4a32, water: 0x4f86b0, sand: 0xd8c38f, paving: 0xc8c2b4, gravel: 0xb3aa98, path: 0xc9b896, line: 0xf4f4f0
});

const box = (size, at, color, extra = {}) => ({ shape: 'box', size, at, color, ...extra });
const wedge = (size, at, color, extra = {}) => ({ shape: 'wedge', size, at, color, ...extra });
const cylinder = (radius, height, at, color, extra = {}) => ({ shape: 'cylinder', radius, height, at, color, ...extra });
const cone = (radius, height, at, color, extra = {}) => ({ shape: 'cone', radius, height, at, color, ...extra });

/**
 * A band of windows round a block at every floor from `from` to `to`, each a
 * little proud of the walls, which is what makes a box read as a building of
 * so many storeys rather than a box.
 */
function bands([w, d], [x, z], from, to, floor, color, proud = 0.15) {
    const parts = [];
    for (let y = from + floor * 0.35; y + floor * 0.45 <= to + 1e-9; y += floor) {
        parts.push(box([w + proud * 2, floor * 0.45, d + proud * 2], [x, Number(y.toFixed(3)), z], color));
    }
    return parts;
}

/** A block of storeys: its walls, and a band of windows at every floor. */
function block([w, h, d], [x, y, z], wall, glazing, floor = 3.6) {
    return [box([w, h, d], [x, y, z], wall), ...bands([w, d], [x, z], y, y + h, floor, glazing)];
}

/** A round block of storeys: a drum, and a ring of windows at every floor. */
function drum(radius, height, [x, y, z], wall, glazing, floor = 3.6) {
    const parts = [cylinder(radius, height, [x, y, z], wall, { segments: 16 })];
    for (let at = y + floor * 0.35; at + floor * 0.45 <= y + height + 1e-9; at += floor) {
        parts.push(cylinder(radius + 0.15, floor * 0.45, [x, Number(at.toFixed(3)), z], glazing, { segments: 16 }));
    }
    return parts;
}

/**
 * A house's front: a door and windows on the wall facing `+z`, `front` metres
 * out from the middle, each an inset a hair proud of the wall.
 */
function front(z, doors = [], windows = [], { door = PAINT.door, glazing = PAINT.window } = {}) {
    return [
        ...doors.map(x => box([1.1, 2.1, 0.12], [x, 0, z + 0.02], door)),
        ...windows.map(([x, y]) => box([1.3, 1.1, 0.1], [x, y, z + 0.02], glazing))
    ];
}

/**
 * A tree, `height` tall: a trunk and a crown, pointed or round. Kept to a few
 * sides, since a park plants dozens of them.
 */
function tree([x, z], height = 9, kind = 'pointed', y = 0.15) {
    const trunk = cylinder(height * 0.035, height * 0.3, [x, y, z], PAINT.trunk, { segments: 5 });
    const crown = kind === 'round'
        ? cylinder(height * 0.3, height * 0.6, [x, y + height * 0.3, z], PAINT.leaf, { top: height * 0.14, segments: 7 })
        : cone(height * 0.26, height * 0.75, [x, y + height * 0.25, z], PAINT.leafDark, { segments: 7 });
    return [trunk, crown];
}

/** A park bench, facing along `+z`, or across when turned. */
function bench([x, z], turn = 0, y = 0.15) {
    return box([1.8, 0.45, 0.6], [x, y, z], PAINT.trunk, turn ? { turn } : {});
}

/** A park's own ground, `w` by `d`, a hair over the ground it lies on. */
function lawn([w, d], color = PAINT.grass) {
    return box([w, 0.15, d], [0, 0, 0], color);
}

/** A strip of path laid over a park's lawn. */
function strip([w, d], [x, z], color = PAINT.path, turn = 0) {
    return box([w, 0.05, d], [x, 0.15, z], color, turn ? { turn } : {});
}

/**
 * The catalogue: each prefab a name, the category it is offered under, the
 * footprint its card says - across by along, in metres - and its recipe. The
 * designs are generic and original, none drawn after any building that
 * stands; the counts are the ones Insert City was asked for.
 */
export const PREFABS = deepFreeze([
    // --- Skylines: each a block of two to five towers ---------------------------------
    {
        id: 'glass-cluster', label: 'GLASS CLUSTER', category: 'skylines', footprint: [60, 50],
        recipe: { parts: [
            box([60, 8, 50], [0, 0, 0], PAINT.concrete),
            ...block([18, 90, 18], [-14, 8, -8], PAINT.glassDark, PAINT.glassLight),
            ...block([16, 70, 16], [12, 8, -6], PAINT.glass, PAINT.glassLight),
            ...block([14, 52, 14], [4, 8, 14], PAINT.glassDark, PAINT.glassLight),
            box([6, 4, 6], [-14, 98, -8], PAINT.steelDark)
        ] }
    },
    {
        id: 'stepped-towers', label: 'STEPPED TOWERS', category: 'skylines', footprint: [52.3, 28.3],
        recipe: { parts: [
            ...block([26, 40, 26], [-12, 0, 0], PAINT.sandstone, PAINT.glassDark),
            ...block([20, 30, 20], [-12, 40, 0], PAINT.sandstone, PAINT.glassDark),
            ...block([14, 25, 14], [-12, 70, 0], PAINT.sandstone, PAINT.glassDark),
            box([6, 8, 6], [-12, 95, 0], PAINT.concreteDark),
            ...block([22, 30, 22], [16, 0, 4], PAINT.concrete, PAINT.glass),
            ...block([16, 25, 16], [16, 30, 4], PAINT.concrete, PAINT.glass),
            ...block([10, 15, 10], [16, 55, 4], PAINT.concrete, PAINT.glass)
        ] }
    },
    {
        id: 'spire-block', label: 'SPIRE BLOCK', category: 'skylines', footprint: [55.3, 29.3],
        recipe: { parts: [
            ...block([22, 100, 22], [0, 0, 0], PAINT.glassDark, PAINT.glassLight, 4),
            cylinder(12, 14, [0, 100, 0], PAINT.steel, { top: 4, segments: 8 }),
            cone(1.4, 32, [0, 114, 0], PAINT.steelDark, { segments: 6 }),
            ...block([14, 50, 14], [-22, 0, 8], PAINT.concrete, PAINT.glass),
            ...block([12, 40, 16], [20, 0, -6], PAINT.sandstone, PAINT.glassDark)
        ] }
    },
    {
        id: 'slab-row', label: 'SLAB ROW', category: 'skylines', footprint: [66.3, 36.3],
        recipe: { parts: [
            ...block([12, 48, 36], [-27, 0, 0], PAINT.concrete, PAINT.glassDark),
            ...block([12, 62, 36], [-9, 0, 0], PAINT.white, PAINT.glass),
            ...block([12, 54, 36], [9, 0, 0], PAINT.concrete, PAINT.glassDark),
            ...block([12, 70, 36], [27, 0, 0], PAINT.white, PAINT.glass)
        ] }
    },
    {
        id: 'mixed-skyline', label: 'MIXED SKYLINE', category: 'skylines', footprint: [63.3, 46.4],
        recipe: { parts: [
            ...block([16, 80, 16], [-24, 0, -10], PAINT.glassDark, PAINT.glassLight),
            ...drum(9, 95, [0, 0, -14], PAINT.glass, PAINT.glassLight),
            cone(9.2, 8, [0, 95, -14], PAINT.steel, { segments: 16 }),
            ...block([18, 40, 18], [22, 0, -8], PAINT.sandstone, PAINT.glassDark),
            ...block([12, 30, 12], [22, 40, -8], PAINT.sandstone, PAINT.glassDark),
            ...block([24, 45, 10], [-18, 0, 16], PAINT.concrete, PAINT.glass),
            ...block([14, 60, 14], [14, 0, 16], PAINT.white, PAINT.glassDark),
            wedge([14.4, 6, 14.4], [14, 60, 16], PAINT.slate)
        ] }
    },

    // --- Factory -------------------------------------------------------------------------
    {
        id: 'sawtooth-mill', label: 'SAWTOOTH MILL', category: 'factory', footprint: [40, 30.08],
        recipe: { parts: [
            box([40, 6, 30], [0, 0, 0], PAINT.brick),
            ...[-16, -8, 0, 8, 16].flatMap(x => [
                wedge([8, 3, 30], [x, 6, 0], PAINT.roofGrey, { ridge: 'edge' }),
                box([0.2, 2.6, 29], [x + 3.9, 6.2, 0], PAINT.glassLight)
            ]),
            box([5, 4, 0.12], [-10, 0, 15.02], PAINT.steelDark),
            box([5, 4, 0.12], [10, 0, 15.02], PAINT.steelDark),
            cylinder(1.6, 24, [14, 0, -11], PAINT.brickDark, { top: 1.1, segments: 10 })
        ] }
    },
    {
        id: 'stack-works', label: 'STACK WORKS', category: 'factory', footprint: [46.3, 29.39],
        recipe: { parts: [
            box([36, 12, 24], [0, 0, 0], PAINT.concrete),
            wedge([24.6, 2, 36.6], [0, 12, 0], PAINT.roofGrey, { turn: 90 }),
            box([10, 7, 10], [23, 0, 4], PAINT.concreteDark),
            box([6, 5, 0.12], [-8, 0, 12.02], PAINT.steelDark),
            box([6, 5, 0.12], [8, 0, 12.02], PAINT.steelDark),
            ...[-10, 0, 10].flatMap(x => [
                cylinder(2.2, 42, [x, 0, -15], PAINT.concreteDark, { top: 1.4, segments: 10 }),
                cylinder(1.65, 2.5, [x, 36, -15], PAINT.red, { segments: 10 }),
                cylinder(1.5, 2.5, [x, 39.5, -15], PAINT.white, { segments: 10 })
            ])
        ] }
    },
    {
        id: 'tank-yard', label: 'TANK YARD', category: 'factory', footprint: [40, 30],
        recipe: { parts: [
            box([40, 0.3, 30], [0, 0, 0], PAINT.concrete),
            ...[-12, 0, 12].flatMap(x => [
                cylinder(6, 10, [x, 0.3, -6], PAINT.steel, { segments: 16 }),
                cone(6.1, 2, [x, 10.3, -6], PAINT.steelDark, { segments: 16 })
            ]),
            box([30, 0.7, 0.7], [0, 3, 2], PAINT.rust),
            box([0.7, 0.7, 6], [-12, 3, 3.5], PAINT.rust),
            box([0.7, 0.7, 6], [12, 3, 3.5], PAINT.rust),
            box([10, 4, 6], [-12, 0.3, 9], PAINT.white),
            box([8, 3, 5], [6, 0.3, 9], PAINT.concreteDark)
        ] }
    },

    // --- Residential -----------------------------------------------------------------------
    {
        id: 'cottage', label: 'COTTAGE', category: 'residential', footprint: [8.6, 10.6],
        recipe: { parts: [
            box([8, 3, 10], [0, 0, 0], PAINT.cream),
            wedge([8.6, 2.6, 10.6], [0, 3, 0], PAINT.tile),
            box([0.8, 1.8, 0.8], [2.2, 4.2, -2.5], 0x7a5a48),
            box([1.1, 2.1, 0.12], [0, 0, 5.02], PAINT.door),
            box([1.2, 1, 0.1], [-2.4, 1.2, 5.02], PAINT.window),
            box([1.2, 1, 0.1], [2.4, 1.2, 5.02], PAINT.window)
        ] }
    },
    {
        id: 'bungalow', label: 'BUNGALOW', category: 'residential', footprint: [14.6, 9.6],
        recipe: { parts: [
            box([14, 3, 9], [0, 0, 0], PAINT.render),
            wedge([9.6, 2.2, 14.6], [0, 3, 0], PAINT.roofGrey, { turn: 90 }),
            box([0.8, 1.6, 0.8], [4, 3.8, -1.5], PAINT.brickDark),
            ...front(4.5, [-3], [[-5.5, 1.1], [1, 1.1], [4.5, 1.1]])
        ] }
    },
    {
        id: 'two-storey-house', label: 'TWO-STOREY HOUSE', category: 'residential', footprint: [15.3, 9.6],
        recipe: { parts: [
            box([10, 6, 9], [0, 0, 0], PAINT.brick),
            wedge([9.6, 3, 10.6], [0, 6, 0], PAINT.tile, { turn: 90 }),
            box([5, 3, 7], [7.5, 0, 1], PAINT.render),
            box([3.6, 2.4, 0.12], [7.5, 0, 4.52], PAINT.white),
            ...front(4.5, [-1.5], [[-3.5, 1.1], [1.5, 1.1], [-3.5, 3.9], [0, 3.9], [3.5, 3.9]])
        ] }
    },
    {
        id: 'terrace-row', label: 'TERRACE ROW', category: 'residential', footprint: [28.6, 9.6],
        recipe: { parts: [
            box([28, 6, 9], [0, 0, 0], PAINT.brick),
            wedge([9.6, 3, 28.6], [0, 6, 0], PAINT.slate, { turn: 90 }),
            ...[-8.4, -2.8, 2.8, 8.4].map(x => box([0.8, 2, 2], [x, 7.4, 0], PAINT.brickDark)),
            ...front(4.5, [-12.2, -6.6, -1, 4.6, 10.2], [-11.2, -5.6, 0, 5.6, 11.2].flatMap(x => [[x + 1.2, 1.1], [x, 3.9]]))
        ] }
    },
    {
        id: 'duplex', label: 'DUPLEX', category: 'residential', footprint: [16.6, 10.6],
        recipe: { parts: [
            box([16, 6, 10], [0, 0, 0], PAINT.render),
            wedge([10.6, 2.8, 16.6], [0, 6, 0], PAINT.tile, { turn: 90 }),
            box([0.9, 2.2, 1.6], [0, 7.6, 0], PAINT.brickDark),
            ...front(5, [-2, 2], [[-5.5, 1.1], [5.5, 1.1], [-5.5, 3.9], [-2.5, 3.9], [2.5, 3.9], [5.5, 3.9]])
        ] }
    },
    {
        id: 'townhouses', label: 'TOWNHOUSES', category: 'residential', footprint: [24.2, 10.4],
        recipe: { parts: [
            ...[[-9, 9, PAINT.brick], [-3, 10, PAINT.cream], [3, 9.5, PAINT.brickDark], [9, 10.5, PAINT.render]].flatMap(([x, h, wall]) => [
                box([6, h, 10], [x, 0, 0], wall),
                wedge([6.2, 2.4, 10.4], [x, h, 0], PAINT.slate),
                ...front(5, [x - 1.4], [[x + 1.4, 1.1], [x - 1.2, 3.9], [x + 1.2, 3.9], [x - 1.2, 6.7], [x + 1.2, 6.7]])
            ])
        ] }
    },
    {
        id: 'low-rise-flats', label: 'LOW-RISE FLATS', category: 'residential', footprint: [30.4, 16.2],
        recipe: { parts: [
            ...block([30, 10, 14], [0, 0, 0], PAINT.brick, PAINT.window, 3.3),
            box([30.4, 0.6, 14.4], [0, 10, 0], PAINT.concreteDark),
            box([6, 0.3, 2], [0, 3, 8], PAINT.concreteDark),
            box([1.8, 2.3, 0.12], [0, 0, 7.02], PAINT.door)
        ] }
    },
    {
        id: 'apartment-block', label: 'APARTMENT BLOCK', category: 'residential', footprint: [36.3, 19.15],
        recipe: { parts: [
            ...block([36, 26, 16], [0, 0, 0], PAINT.render, PAINT.glass, 3.2),
            box([8, 3, 6], [8, 26, 0], PAINT.concreteDark),
            box([4, 4, 4], [-10, 26, 0], PAINT.concreteDark),
            box([8, 0.4, 3], [0, 3, 9.5], PAINT.concreteDark)
        ] }
    },
    {
        id: 'high-rise-flats', label: 'HIGH-RISE FLATS', category: 'residential', footprint: [20.3, 23.15],
        recipe: { parts: [
            ...block([20, 60, 20], [0, 0, 0], PAINT.concrete, PAINT.glassDark, 3),
            box([8, 4, 8], [0, 60, 0], PAINT.concreteDark),
            box([6, 0.4, 3], [0, 3, 11.5], PAINT.concreteDark)
        ] }
    },

    // --- Commercial --------------------------------------------------------------------------
    {
        id: 'corner-shop', label: 'CORNER SHOP', category: 'commercial', footprint: [10.4, 11.8],
        recipe: { parts: [
            box([10, 4.5, 10], [0, 0, 0], PAINT.brick),
            box([10.4, 0.5, 10.4], [0, 4.5, 0], PAINT.concreteDark),
            box([8, 2.4, 0.1], [0, 0.4, 5.02], PAINT.glassLight),
            wedge([1.6, 0.8, 8], [0, 2.8, 5.8], PAINT.green, { ridge: 'edge', turn: -90 }),
            box([6, 0.8, 0.2], [0, 3.6, 5.1], PAINT.yellow)
        ] }
    },
    {
        id: 'high-street-row', label: 'HIGH STREET ROW', category: 'commercial', footprint: [40.2, 13.7],
        recipe: { parts: [
            ...[[-16, 7.5, PAINT.brick, PAINT.red], [-8, 9, PAINT.cream, PAINT.blue], [0, 8, PAINT.brickDark, PAINT.green],
                [8, 10, PAINT.render, PAINT.yellow], [16, 7, PAINT.sandstone, PAINT.red]].flatMap(([x, h, wall, awning]) => [
                box([8, h, 12], [x, 0, 0], wall),
                box([8.2, 0.5, 12.2], [x, h, 0], PAINT.concreteDark),
                box([6.6, 2.6, 0.1], [x, 0.3, 6.02], PAINT.glassLight),
                wedge([1.6, 0.8, 7.4], [x, 3, 6.8], awning, { ridge: 'edge', turn: -90 }),
                box([2.2, 1.6, 0.1], [x - 2, 4.6, 6.02], PAINT.window),
                box([2.2, 1.6, 0.1], [x + 2, 4.6, 6.02], PAINT.window)
            ])
        ] }
    },
    {
        id: 'office-block', label: 'OFFICE BLOCK', category: 'commercial', footprint: [30.3, 28.15],
        recipe: { parts: [
            ...block([30, 40, 24], [0, 0, 0], PAINT.glassDark, PAINT.glassLight, 3.8),
            box([10, 3, 8], [0, 40, -4], PAINT.concreteDark),
            box([12, 0.5, 4], [0, 4, 14], PAINT.steel)
        ] }
    },
    {
        id: 'shopping-centre', label: 'SHOPPING CENTRE', category: 'commercial', footprint: [90.4, 65.2],
        recipe: { parts: [
            box([90, 12, 60], [0, 0, 0], PAINT.concrete),
            box([90.4, 2, 60.4], [0, 8.5, 0], PAINT.glass),
            box([16, 14, 4], [0, 0, 31], PAINT.glassLight),
            box([24, 0.6, 6], [0, 5, 32], PAINT.steel),
            box([10, 2, 0.4], [0, 10, 33.2], PAINT.red),
            box([12, 3, 8], [-25, 12, -10], PAINT.concreteDark),
            box([12, 3, 8], [25, 12, -10], PAINT.concreteDark),
            box([8, 2.5, 6], [0, 12, 12], PAINT.concreteDark)
        ] }
    },
    {
        id: 'hotel', label: 'HOTEL', category: 'commercial', footprint: [44.3, 34.65],
        recipe: { parts: [
            ...block([44, 8, 30], [0, 0, 0], PAINT.sandstone, PAINT.glassDark, 4),
            ...block([36, 40, 16], [0, 8, -4], PAINT.white, PAINT.glass, 3.2),
            box([14, 3, 0.6], [0, 48, 4.3], PAINT.blue),
            box([14, 0.5, 5], [0, 4, 17], PAINT.steel)
        ] }
    },

    // --- Infrastructure: the buildings -----------------------------------------------------------
    {
        id: 'power-station', label: 'POWER STATION', category: 'infrastructure', footprint: [70.3, 60],
        recipe: { parts: [
            box([44, 20, 24], [-14, 0, -12], PAINT.brick),
            wedge([24.6, 4, 44.6], [-14, 20, -12], PAINT.roofGrey, { turn: 90 }),
            ...[[20, -14], [20, 18]].flatMap(([x, z]) => [
                cylinder(14, 26, [x, 0, z], PAINT.concrete, { top: 9.5, segments: 16 }),
                cylinder(9.5, 16, [x, 26, z], PAINT.concrete, { top: 11, segments: 16 })
            ]),
            cylinder(3, 70, [-30, 0, 12], PAINT.concreteDark, { top: 2, segments: 10 }),
            box([12, 8, 10], [-12, 0, 14], PAINT.concreteDark)
        ] }
    },
    {
        id: 'water-tower', label: 'WATER TOWER', category: 'infrastructure', footprint: [9.6, 9.6],
        recipe: { parts: [
            box([0.5, 14, 0.5], [-3, 0, -3], 0x6f777c),
            box([0.5, 14, 0.5], [3, 0, -3], 0x6f777c),
            box([0.5, 14, 0.5], [-3, 0, 3], 0x6f777c),
            box([0.5, 14, 0.5], [3, 0, 3], 0x6f777c),
            cylinder(4.5, 6, [0, 14, 0], 0x9aa3a8),
            cone(4.8, 2, [0, 20, 0], 0x6f777c)
        ] }
    },
    {
        id: 'substation', label: 'SUBSTATION', category: 'infrastructure', footprint: [30, 24],
        recipe: { parts: [
            box([30, 0.2, 24], [0, 0, 0], PAINT.gravel),
            ...[-8, 0, 8].map(x => box([4, 3, 3], [x, 0.2, -4], PAINT.steelDark)),
            ...[[-10, -8], [10, -8], [-10, 0], [10, 0]].map(([x, z]) => box([0.4, 10, 0.4], [x, 0.2, z], PAINT.steel)),
            box([20.4, 0.4, 0.4], [0, 10.2, -8], PAINT.steel),
            box([20.4, 0.4, 0.4], [0, 10.2, 0], PAINT.steel),
            box([8, 3.5, 5], [-9, 0.2, 8], PAINT.brick)
        ] }
    },
    {
        id: 'fire-station', label: 'FIRE STATION', category: 'infrastructure', footprint: [34.2, 18.4],
        recipe: { parts: [
            box([30, 8, 18], [0, 0, 0], PAINT.brick),
            box([30.4, 0.6, 18.4], [0, 8, 0], PAINT.concreteDark),
            ...[-10, 0, 10].map(x => box([6, 5, 0.12], [x, 0, 9.02], PAINT.red)),
            box([4, 18, 4], [17, 0, -5], PAINT.brickDark),
            box([8, 1, 0.2], [0, 6, 9.1], PAINT.white)
        ] }
    },
    {
        id: 'hospital', label: 'HOSPITAL', category: 'infrastructure', footprint: [60.3, 55.15],
        recipe: { parts: [
            ...block([60, 24, 20], [0, 0, 0], PAINT.white, PAINT.glass, 4),
            ...block([20, 18, 40], [0, 0, 20], PAINT.white, PAINT.glass, 4),
            cylinder(7, 0.2, [-18, 24, 0], PAINT.white, { segments: 20 }),
            cylinder(6, 0.25, [-18, 24, 0], PAINT.green, { segments: 20 }),
            box([14, 0.5, 5], [0, 4, 42.5], PAINT.steel)
        ] }
    },

    // --- Parks: nothing with a roof, so nothing the aircraft can hit -----------------------------
    {
        id: 'lawn', label: 'LAWN', category: 'parks', footprint: [60, 60],
        recipe: { solid: false, plinth: PAINT.grassDark, parts: [
            lawn([60, 60]),
            strip([60, 3], [0, 0]), strip([3, 60], [0, 0]),
            ...[[-22, -22], [22, -22], [-22, 22], [22, 22]].flatMap(at => tree(at, 10, 'round')),
            bench([-6, -3]), bench([6, 3]), bench([-3, 6], 90), bench([3, -6], 90)
        ] }
    },
    {
        id: 'woodland', label: 'WOODLAND', category: 'parks', footprint: [70, 70],
        recipe: { solid: false, plinth: PAINT.grassDark, parts: [
            lawn([70, 70], PAINT.grassDark),
            ...[
                [-28, -27], [-15, -30], [-2, -26], [12, -29], [26, -25], [-30, -12], [-17, -14], [-5, -10], [9, -15], [24, -11],
                [-26, 2], [-12, 0], [3, 3], [16, -1], [29, 4], [-29, 16], [-16, 14], [-3, 18], [11, 13], [25, 17],
                [-21, 28], [-7, 29], [8, 27], [22, 29]
            ].flatMap(([x, z], i) => tree([x, z], 9 + (i * 7) % 6, i % 3 === 0 ? 'round' : 'pointed')),
            strip([2.5, 70], [0, 0], PAINT.path, 20)
        ] }
    },
    {
        id: 'pond-park', label: 'POND PARK', category: 'parks', footprint: [70, 60],
        recipe: { solid: false, plinth: PAINT.grassDark, parts: [
            lawn([70, 60]),
            strip([46, 3], [0, -21]), strip([46, 3], [0, 21]), strip([3, 45], [-24.5, 0]), strip([3, 45], [24.5, 0]),
            cylinder(16, 0.1, [0, 0.15, 0], PAINT.water, { segments: 24 }),
            ...[[-30, -25], [30, -25], [-30, 25], [30, 25], [-31, 0], [31, 0], [0, -27], [0, 27]].flatMap((at, i) => tree(at, 9, i % 2 ? 'pointed' : 'round')),
            bench([-10, -18]), bench([10, -18]), bench([-10, 18]), bench([10, 18])
        ] }
    },
    {
        id: 'playground', label: 'PLAYGROUND', category: 'parks', footprint: [40, 40],
        recipe: { solid: false, plinth: PAINT.grassDark, parts: [
            lawn([40, 40]),
            box([24, 0.12, 20], [0, 0.15, 0], PAINT.sand),
            box([2.4, 2.4, 2.4], [-7, 0.27, -4], PAINT.red),
            wedge([5, 2.4, 2.4], [-7, 0.27, -0.3], PAINT.yellow, { ridge: 'edge', turn: -90 }),
            ...[[-1, -6], [5, -6], [-1, -2], [5, -2]].map(([x, z]) => box([0.2, 3, 0.2], [x, 0.27, z], PAINT.blue)),
            box([6.2, 0.2, 0.2], [2, 3.27, -6], PAINT.blue),
            box([6.2, 0.2, 0.2], [2, 3.27, -2], PAINT.blue),
            box([0.6, 0.1, 4], [1, 1, -4], PAINT.trunk),
            box([0.6, 0.1, 4], [3, 1, -4], PAINT.trunk),
            box([5, 3, 4], [5, 0.27, 5], PAINT.green),
            cylinder(1.6, 0.4, [-5, 0.27, 6], PAINT.yellow, { segments: 12 }),
            ...tree([-16, -16], 9, 'round'), ...tree([16, 16], 9, 'round'),
            bench([-14, 8], 90), bench([14, -8], 90)
        ] }
    },
    {
        id: 'sports-field', label: 'SPORTS FIELD', category: 'parks', footprint: [110, 74],
        recipe: { solid: false, plinth: PAINT.grassDark, parts: [
            lawn([110, 74]),
            strip([105, 0.12], [0, -34], PAINT.line), strip([105, 0.12], [0, 34], PAINT.line),
            strip([0.12, 68], [-52.5, 0], PAINT.line), strip([0.12, 68], [52.5, 0], PAINT.line),
            strip([0.12, 68], [0, 0], PAINT.line),
            cylinder(9.15, 0.05, [0, 0.15, 0], PAINT.line, { segments: 24 }),
            cylinder(9, 0.07, [0, 0.15, 0], PAINT.grass, { segments: 24 }),
            ...[-1, 1].flatMap(side => [
                strip([0.12, 40.3], [side * 36, 0], PAINT.line),
                strip([16.5, 0.12], [side * 44.25, -20.15], PAINT.line),
                strip([16.5, 0.12], [side * 44.25, 20.15], PAINT.line),
                box([0.12, 2.44, 0.12], [side * 52.5, 0.15, -3.66], PAINT.white),
                box([0.12, 2.44, 0.12], [side * 52.5, 0.15, 3.66], PAINT.white),
                box([0.12, 0.12, 7.44], [side * 52.5, 2.59, 0], PAINT.white)
            ])
        ] }
    },
    {
        id: 'plaza', label: 'PLAZA', category: 'parks', footprint: [50, 50],
        recipe: { solid: false, plinth: PAINT.paving, parts: [
            box([50, 0.3, 50], [0, 0, 0], PAINT.paving),
            cylinder(6, 0.6, [0, 0.3, 0], PAINT.concrete, { segments: 20 }),
            cylinder(5.4, 0.62, [0, 0.3, 0], PAINT.water, { segments: 20 }),
            cylinder(0.6, 2.5, [0, 0.3, 0], PAINT.concrete, { segments: 8 }),
            ...[[-18, -18], [18, -18], [-18, 18], [18, 18]].flatMap(([x, z]) => [
                box([4, 0.8, 4], [x, 0.3, z], PAINT.concreteDark),
                ...tree([x, z], 8, 'round', 1.1)
            ]),
            bench([-9, 0], 90, 0.3), bench([9, 0], 90, 0.3), bench([0, -9], 0, 0.3), bench([0, 9], 0, 0.3)
        ] }
    },
    {
        id: 'formal-garden', label: 'FORMAL GARDEN', category: 'parks', footprint: [60, 60],
        recipe: { solid: false, plinth: PAINT.grassDark, parts: [
            lawn([60, 60]),
            strip([60, 4], [0, 0], PAINT.gravel), strip([4, 60], [0, 0], PAINT.gravel),
            ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].flatMap(([sx, sz]) => [
                box([24, 1.2, 1], [sx * 15, 0.15, sz * 27], PAINT.hedge),
                box([1, 1.2, 24], [sx * 27, 0.15, sz * 15], PAINT.hedge),
                cone(1.2, 3.5, [sx * 15, 0.15, sz * 15], PAINT.hedge, { segments: 8 })
            ]),
            cylinder(3.5, 0.5, [0, 0.15, 0], PAINT.concrete, { segments: 16 }),
            cylinder(3, 0.52, [0, 0.15, 0], PAINT.water, { segments: 16 }),
            bench([-6, 8], 90), bench([6, -8], 90)
        ] }
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
    if (value.plinth != null && !(Number.isInteger(value.plinth) && value.plinth >= 0 && value.plinth <= 0xffffff)) {
        problems.push(`${where}: plinth is not a colour`);
    }
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
