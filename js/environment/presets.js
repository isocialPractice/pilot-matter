/**
 * Assembled environments - worlds put together out of the elements in
 * `elements.js`, each one a name, a seed, the ground it is drawn on, and the
 * elements placed over it. Nothing here is a mesh or a file: an environment is
 * a description, and the field it becomes is generated from that description
 * every time it is flown.
 *
 * Five of them are worlds to choose between, offered by the settings panel. The
 * rest are the thin worlds the game modes open over, which are not offered
 * because a mode brings its own ground with it.
 *
 * Pure module with no DOM or Three.js dependency, so the presets and the field
 * they build can be unit tested in Node.
 */

import {
    createField, createRandom, applyBase, applyElement, orderPlacements,
    DEFAULT_SIZE, DEFAULT_SEGMENTS
} from './elements.js';

/**
 * The world the simulator has always generated, and the one a fresh install
 * starts on: fBm ground, peaks over about a tenth of it, and the water, sand,
 * grass, and snow bands the height ramp has always drawn.
 */
const highlands = {
    id: 'highlands',
    label: 'HIGHLANDS',
    description: 'fBm ground under scattered peaks, with snow above 300',
    seed: 20260822,
    base: { maxHeight: 480, scale: 3.5 },
    elements: [
        { type: 'mountain', config: { height: [180, 500], radius: [400, 1100] } },
        { type: 'grass',    config: { band: [12, 130] } },
        { type: 'sand',     config: { band: [4, 12] } },
        { type: 'water',    config: { level: 4 } },
        { type: 'snow',     config: { line: 300, coverage: 0.9, slope: 1.1 } }
    ]
};

/**
 * Low green country a river runs the whole width of, with forest either side
 * of it. The gentlest of the five to fly, and the one that shows what the
 * river's windiness and width ranges do.
 */
const riverBasin = {
    id: 'river-basin',
    label: 'RIVER BASIN',
    description: 'A meandering river through low forested country',
    seed: 51423,
    base: { maxHeight: 300, scale: 2.6, offsetX: 41, offsetZ: 17 },
    elements: [
        { type: 'mountain', config: { count: 6, height: [120, 260], radius: [700, 1600], girth: 0.5 } },
        { type: 'grass',    config: { band: [6, 200], color: { light: [0.42, 0.60, 0.20], dark: [0.14, 0.30, 0.10] } } },
        { type: 'sand',     config: { band: [2, 6] } },
        { type: 'water',    config: { level: 2 } },
        { type: 'river',    config: { windiness: 0.85, width: [140, 420], depth: [16, 44] } },
        { type: 'forest',   config: { count: 12, size: [600, 1800], density: 0.7, treeHeight: [18, 40], band: [8, 220] } },
        { type: 'snow',     config: { line: 260, coverage: 0.5, slope: 0.8 } }
    ]
};

/**
 * A high plateau cut by branching canyons, with a bare sand and rock palette.
 * The walls are steep and the floors are flat, which makes it the one to fly
 * low through.
 */
const canyonCountry = {
    id: 'canyon-country',
    label: 'CANYON COUNTRY',
    description: 'A branching canyon system cut into a high plateau',
    seed: 90210,
    base: { maxHeight: 620, scale: 4.2, offsetX: -63, offsetZ: 88 },
    elements: [
        { type: 'mountain', config: { count: 9, height: [200, 420], radius: [500, 1200], girth: 0.8 } },
        { type: 'canyon',   config: { depth: [180, 380], width: [260, 620], steepness: 0.75, branches: 3, windiness: 0.45 } },
        { type: 'grass',    config: { band: [40, 150], color: { light: [0.46, 0.48, 0.22], dark: [0.24, 0.28, 0.14] } } },
        { type: 'sand',     config: { band: [0, 40], color: { light: [0.80, 0.62, 0.42], dark: [0.48, 0.31, 0.20] } } },
        // The canyon floors are dry: this is the one world with no water in it,
        // and a lake at the bottom of every cut would be a flooded one.
        { type: 'river',    config: { windiness: 0.7, width: [70, 150], depth: [6, 16] } },
        { type: 'snow',     config: { line: 460, coverage: 0.7, slope: 0.7 } }
    ]
};

/**
 * A dune sea broken by a handful of rock outcrops, with one river cut through
 * it and palm groves along the low ground either side. Flat, bright, and the
 * easiest place to see what the dune spacing range does.
 */
const duneSea = {
    id: 'dune-sea',
    label: 'DUNE SEA',
    description: 'Wind-blown dunes and rock outcrops, cut by one desert river',
    seed: 774411,
    base: { maxHeight: 240, scale: 2.1, offsetX: 128, offsetZ: -74 },
    elements: [
        { type: 'mountain', config: { count: 5, height: [160, 340], radius: [420, 900], girth: 0.35 } },
        { type: 'desert',   config: { duneHeight: [18, 64], spacing: 620, coverage: 0.95 } },
        { type: 'sand',     config: { band: [0, 120] } },
        { type: 'river',    config: { windiness: 0.7, width: [110, 260], depth: [12, 30],
                                      color: { light: [0.30, 0.62, 0.62], dark: [0.06, 0.26, 0.34] } } },
        { type: 'forest',   config: { count: 3, size: [400, 800], density: 0.75, treeHeight: [14, 26], band: [10, 55] } },
        { type: 'snow',     config: { line: 320, coverage: 0.25, slope: 0.5 } }
    ]
};

/**
 * A wide lake with a town on its shore and forested hills behind it. The one
 * with something built on it, and the only place the town element's grid,
 * density, and building height ranges show up.
 */
const lakeside = {
    id: 'lakeside',
    label: 'LAKESIDE',
    description: 'A town on the shore of a wide lake, under forested hills',
    seed: 313370,
    base: { maxHeight: 420, scale: 3.0, offsetX: -19, offsetZ: 205 },
    elements: [
        { type: 'mountain', config: { count: 10, height: [200, 460], radius: [500, 1300] } },
        { type: 'grass',    config: { band: [26, 180] } },
        { type: 'sand',     config: { band: [18, 26] } },
        { type: 'water',    config: { level: 18, flatten: 1 } },
        { type: 'river',    config: { windiness: 0.4, width: [90, 220], depth: [10, 24] } },
        { type: 'forest',   config: { count: 9, size: [500, 1400], density: 0.55, band: [26, 240] } },
        { type: 'town',     config: { grid: 340, density: 0.6, buildingHeight: [18, 78], extent: [1100, 2000] } },
        { type: 'snow',     config: { line: 340, coverage: 0.85, slope: 1.0 } }
    ]
};

export const ENVIRONMENTS = [highlands, riverBasin, canyonCountry, duneSea, lakeside];

export const DEFAULT_ENVIRONMENT_ID = highlands.id;

// --- The worlds the game modes are flown over ------------------------------

/**
 * Low rolling country with room to see a long way, and the world a landing is
 * practised over. Deliberately thin: four elements and a gentle base, so what
 * the pilot has to read is the ground around the strip rather than a forest
 * between them and it.
 */
const openCountry = {
    id: 'open-country',
    label: 'OPEN COUNTRY',
    description: 'Low rolling ground under a wide sky, with one strip cut into it',
    seed: 6180339,
    base: { maxHeight: 220, scale: 2.2 },
    runway: { length: [2800, 3400], width: [280, 340] },
    elements: [
        { type: 'mountain', config: { count: 4, height: [110, 220], radius: [900, 1900] } },
        { type: 'grass',    config: { band: [4, 200] } },
        { type: 'sand',     config: { band: [1, 4] } },
        { type: 'water',    config: { level: 1 } }
    ]
};

/**
 * A shallow valley with the sky left clear above it, which is what a course of
 * loops needs: room to turn between one gate and the next, and nothing standing
 * up into the line between them.
 */
const loopValley = {
    id: 'loop-valley',
    label: 'LOOP VALLEY',
    description: 'A shallow valley with clear air over it, for a course of loops',
    seed: 2718281,
    base: { maxHeight: 260, scale: 1.8 },
    elements: [
        { type: 'mountain', config: { count: 5, height: [140, 300], radius: [1000, 2100], girth: 0.4 } },
        { type: 'grass',    config: { band: [6, 240] } },
        { type: 'water',    config: { level: 3 } }
    ]
};

/**
 * The worlds a game mode opens over. They are kept out of `ENVIRONMENTS`
 * because they are not worlds to choose between: a mode brings its own ground
 * with it, and offering it in the settings panel would be offering half a game.
 */
export const MODE_ENVIRONMENTS = [openCountry, loopValley];

export const OPEN_COUNTRY_ID = openCountry.id;
export const LOOP_VALLEY_ID  = loopValley.id;

const LISTED = new Map(ENVIRONMENTS.map(environment => [environment.id, environment]));
const BY_ID  = new Map(
    [...ENVIRONMENTS, ...MODE_ENVIRONMENTS].map(environment => [environment.id, environment])
);

/**
 * True for a world the settings panel offers. A game mode's world is not one of
 * them, so a stored setting can never leave a free flight parked in a world that
 * only makes sense with an objective over it.
 */
export function isEnvironmentId(id) {
    return LISTED.has(id);
}

/** The named environment, or the default one for a name nothing answers to. */
export function getEnvironment(id = DEFAULT_ENVIRONMENT_ID) {
    return BY_ID.get(id) ?? BY_ID.get(DEFAULT_ENVIRONMENT_ID);
}

export function environmentIds() {
    return ENVIRONMENTS.map(environment => environment.id);
}

/**
 * The elements an environment is drawn from, with a runway added when one was
 * asked for and the preset does not already lay one down itself. The strip is
 * configured from the preset where it says something about the runway it wants,
 * and from the caller over the top of that, which is what lets a game mode make
 * the strip smaller as it gets harder to find.
 */
export function environmentElements(environment, runway = false) {
    const elements = environment.elements ?? [];
    if (!runway || elements.some(placement => placement.type === 'runway')) return elements;

    return [
        ...elements,
        { type: 'runway', config: { ...environment.runway, ...(runway === true ? {} : runway) } }
    ];
}

/**
 * Generates the height and colour field for an environment. The elements are
 * applied in the pipeline's own order rather than the order the preset lists
 * them, so a preset is a set of elements rather than a sequence to get right.
 *
 * `runway` asks for a strip in the generated world: `true` for the one the
 * preset would lay down on its own, or a configuration to lay one down with.
 * Left off, the world has no landable strip in it at all.
 *
 * `seed` builds the same description as a different world, which is what lets
 * one preset stand behind several stages of a game mode without any of them
 * being the same ground twice.
 */
export function buildEnvironment(environment = getEnvironment(), options = {}) {
    const { runway = false, base, elements, seed, ...size } = options;
    const field  = createField({ size: DEFAULT_SIZE, segments: DEFAULT_SEGMENTS, ...size });
    const random = createRandom(seed ?? environment.seed);

    applyBase(field, { ...environment.base, ...base });
    for (const placement of orderPlacements(elements ?? environmentElements(environment, runway))) {
        applyElement(field, placement, random);
    }

    return field;
}
