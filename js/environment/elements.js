/**
 * Environment elements - the world as data.
 *
 * Every element in the registry declares the ranges it can be configured
 * through and the generator that draws it, so adding a landform is a registry
 * entry rather than another bespoke terrain pass. Nothing here places an
 * asset: an element is an algorithm that reads and writes a height and colour
 * field, which is what lets the same element render at any resolution and be
 * reconfigured without new art.
 *
 * The whole module is pure. It works on a plain field of typed arrays with no
 * DOM or Three.js dependency, so every generator can be unit tested in Node
 * and the same field can be handed to any renderer.
 */

import { fbm, hash, shapeHeight, smoothstep, mountainBump } from '../terrain-math.js';
import { mountainCount } from '../mountains.js';

// The field the bundled simulator builds: a 16000-unit square sampled on a
// 200-segment grid, which is one vertex every 80 units.
export const DEFAULT_SIZE     = 16000;
export const DEFAULT_SEGMENTS = 200;

/**
 * The order elements are applied in, whatever order a preset happens to list
 * them, so an element never has to know what a preset put beside it.
 *
 * The landforms are shaped first, then the ground cover is laid over them in
 * the order it layers - a dune sea sits on top of the sand band rather than
 * being repainted flat by it - then water fills what is left below its line,
 * then the cuts and the built things, and snow settles last on top of
 * everything else.
 */
export const ELEMENT_ORDER = [
    'mountain', 'canyon',
    'grass', 'sand', 'desert', 'water',
    'river', 'forest', 'town',
    'snow',
    // The strip is cut last, over whatever else claimed the ground, because a
    // runway is the one thing in the world that is kept clear.
    'runway'
];

// --- The field ------------------------------------------------------------

/**
 * A height and colour field. Vertex order matches a plane sampled row by row
 * from the low z edge to the high one, which is the order a renderer walks its
 * grid in, so no index translation is needed on the way out.
 *
 * A field also carries the strips cut into it. A runway is ground like anything
 * else, but it is the one piece of ground the flight model has to be able to
 * ask about by name - where it is, which way it runs, and how far it reaches -
 * so the generator leaves a record of each one beside the heights it wrote.
 */
export function createField({ size = DEFAULT_SIZE, segments = DEFAULT_SEGMENTS } = {}) {
    const stride = Math.max(2, Math.round(segments)) + 1;
    const count  = stride * stride;

    return {
        size,
        segments: stride - 1,
        stride,
        count,
        step: size / (stride - 1),
        height: new Float32Array(count),
        color: new Float32Array(count * 3),
        runways: []
    };
}

export function fieldX(field, index) {
    return -field.size / 2 + (index % field.stride) * field.step;
}

export function fieldZ(field, index) {
    return -field.size / 2 + Math.floor(index / field.stride) * field.step;
}

export function paint(field, index, color) {
    const at = index * 3;
    field.color[at]     = color[0];
    field.color[at + 1] = color[1];
    field.color[at + 2] = color[2];
}

export function readColor(field, index) {
    const at = index * 3;
    return [field.color[at], field.color[at + 1], field.color[at + 2]];
}

/** Blends a colour into a vertex, leaving what is already there showing through. */
export function mixColor(field, index, color, amount) {
    const t = clamp(amount, 0, 1);
    if (t <= 0) return;

    const at = index * 3;
    field.color[at]     += (color[0] - field.color[at])     * t;
    field.color[at + 1] += (color[1] - field.color[at + 1]) * t;
    field.color[at + 2] += (color[2] - field.color[at + 2]) * t;
}

/**
 * How steep the ground is at a vertex, as the height climbed across one cell
 * over the width of that cell: 0 on the flat and 1 on a 45 degree face.
 */
export function slopeAt(field, index) {
    const { stride } = field;
    const row = Math.floor(index / stride);
    const col = index % stride;
    const here = field.height[index];

    const dx = field.height[row * stride + Math.min(col + 1, stride - 1)] - here;
    const dz = field.height[Math.min(row + 1, stride - 1) * stride + col] - here;

    return Math.sqrt(dx * dx + dz * dz) / field.step;
}

/**
 * Height sampled anywhere in the field rather than at a vertex, bilinearly
 * between the four vertices around the point. Outside the field reads as sea
 * level, the way the world's edge does.
 */
export function sampleHeight(field, x, z) {
    const half = field.size / 2;
    const nx = (x + half) / field.size;
    const nz = (z + half) / field.size;
    if (nx < 0 || nx > 1 || nz < 0 || nz > 1) return 0;

    const seg = field.segments;
    const fx = nx * seg, fz = nz * seg;
    const ix = Math.floor(fx), iz = Math.floor(fz);
    const ux = fx - ix,       uz = fz - iz;

    const at = (row, col) => field.height[Math.min(row, seg) * field.stride + Math.min(col, seg)];

    const h00 = at(iz, ix),     h10 = at(iz, ix + 1);
    const h01 = at(iz + 1, ix), h11 = at(iz + 1, ix + 1);

    return h00 + (h10 - h00) * ux + (h01 - h00) * uz + (h00 - h10 - h01 + h11) * ux * uz;
}

// --- Randomness -----------------------------------------------------------

/**
 * A seeded stream of values in [0, 1). An environment carries its seed, so the
 * same preset lays out the same world every time it is flown, and two presets
 * that share an element get their own arrangement of it.
 */
export function createRandom(seed = 1) {
    let state = (Math.abs(Math.trunc(seed)) >>> 0) || 0x9e3779b9;

    return function random() {
        state ^= state << 13; state >>>= 0;
        state ^= state >>> 17;
        state ^= state << 5;  state >>>= 0;
        return state / 0x100000000;
    };
}

/** A value somewhere inside a configured range. */
export function pick(random, [low, high]) {
    return low + random() * (high - low);
}

// --- Configurable ranges --------------------------------------------------

/** A pair of bounds an element generates between, such as a peak height. */
export function span(low, high, defaultLow, defaultHigh) {
    return { kind: 'span', low, high, default: [defaultLow, defaultHigh] };
}

/** A single configurable value, such as a density or a snow line. */
export function scalar(low, high, value) {
    return { kind: 'scalar', low, high, default: value };
}

/** A base hue given as its light and its dark end, blended across in between. */
export function gradient(light, dark) {
    return { kind: 'gradient', default: { light, dark } };
}

/**
 * A colour between the light and the dark end of one base hue. Both ends are
 * given as a colour of the same hue, so a gradient walks a base colour from
 * pale to deep rather than crossing the wheel: no element shifts colour
 * dramatically across the ground it covers.
 */
export function blend({ light, dark }, t) {
    const u = clamp(t, 0, 1);
    return [
        light[0] + (dark[0] - light[0]) * u,
        light[1] + (dark[1] - light[1]) * u,
        light[2] + (dark[2] - light[2]) * u
    ];
}

/**
 * Fills an element's configuration in from its declared ranges, taking what a
 * preset asked for where it asked for something and the declared default where
 * it did not. Everything is clamped into the range it was declared with, so a
 * preset cannot configure an element outside what it says it supports.
 */
export function resolveConfig(element, overrides = {}) {
    const config = {};
    for (const [name, range] of Object.entries(element.ranges)) {
        config[name] = resolveRange(range, overrides[name]);
    }
    return config;
}

function resolveRange(range, given) {
    if (range.kind === 'gradient') {
        const value = { ...range.default, ...(given ?? {}) };
        return { light: [...value.light], dark: [...value.dark] };
    }

    if (range.kind === 'span') {
        const pair = Array.isArray(given) && given.length === 2 ? given : range.default;
        const low  = clampNumber(pair[0], range, range.default[0]);
        const high = clampNumber(pair[1], range, range.default[1]);
        return low <= high ? [low, high] : [high, low];
    }

    return clampNumber(given, range, range.default);
}

function clampNumber(value, range, fallback) {
    const number = Number(value);
    return clamp(Number.isFinite(number) ? number : fallback, range.low, range.high);
}

function clamp(value, low, high) {
    return Math.min(Math.max(value, low), high);
}

// --- The base ground ------------------------------------------------------

/**
 * What every environment is drawn on: multi-octave noise remapped into plains
 * and peaks, coloured as bare rock. The elements paint their own ground over
 * the top of it, so whatever no element claims reads as the rock it is.
 */
export const BASE_RANGES = {
    maxHeight: scalar(50, 2000, 480),
    scale:     scalar(0.5, 12, 3.5),
    offsetX:   scalar(-500, 500, 0),
    offsetZ:   scalar(-500, 500, 0),
    rock:      gradient([0.52, 0.46, 0.38], [0.34, 0.31, 0.29])
};

export function applyBase(field, overrides = {}) {
    const config = resolveConfig({ ranges: BASE_RANGES }, overrides);
    const { maxHeight, scale, offsetX, offsetZ, rock } = config;

    for (let i = 0; i < field.count; i++) {
        const nx = fieldX(field, i) / field.size * scale + offsetX;
        const nz = fieldZ(field, i) / field.size * scale + offsetZ;
        const h  = shapeHeight(fbm(nx, nz), maxHeight);

        field.height[i] = h;
        paint(field, i, blend(rock, h / maxHeight));
    }

    return config;
}

// --- Shaping elements -----------------------------------------------------

const mountain = {
    id: 'mountain',
    label: 'Mountain',
    ranges: {
        // A count of 0 asks for the density the terrain has always used:
        // enough peaks to cover about a tenth of the ground.
        count:  scalar(0, 200, 0),
        height: span(20, 1200, 180, 500),
        radius: span(100, 3000, 400, 1100),
        // Girth stretches a peak along an axis of its own. At 0 the bump is
        // the round one the simulator has always drawn.
        girth:  scalar(0, 1, 0)
    },

    generate(field, config, random) {
        const total  = config.count > 0 ? Math.round(config.count) : mountainCount(field.size);
        const half   = field.size / 2 - field.size * 0.10;
        const peaks  = [];

        for (let i = 0; i < total; i++) {
            peaks.push({
                x:       (random() * 2 - 1) * half,
                z:       (random() * 2 - 1) * half,
                radius:  pick(random, config.radius),
                peak:    pick(random, config.height),
                angle:   random() * Math.PI * 2,
                stretch: 1 + config.girth * (0.4 + random())
            });
        }

        for (let i = 0; i < field.count; i++) {
            const x = fieldX(field, i);
            const z = fieldZ(field, i);

            let added = 0;
            for (const m of peaks) {
                added += mountainBump(
                    ellipticalDistance(x - m.x, z - m.z, m.angle, m.stretch),
                    m.radius,
                    m.peak
                );
            }

            if (added > 0) field.height[i] += added;
        }

        return peaks.length;
    }
};

const canyon = {
    id: 'canyon',
    label: 'Canyon',
    ranges: {
        depth:     span(10, 600, 90, 240),
        width:     span(60, 1400, 200, 480),
        // How much of the half width is flat floor: the higher the value, the
        // less of the cut is spent on the walls and the steeper they read.
        steepness: scalar(0, 0.95, 0.6),
        // How far across the world the cut runs, as a fraction of its width.
        length:    scalar(0.2, 1, 0.9),
        branches:  scalar(0, 4, 1),
        windiness: scalar(0, 1, 0.35)
    },

    generate(field, config, random) {
        const paths = [meanderPath(field, config.windiness, config.length, random)];

        for (let i = 0; i < Math.round(config.branches); i++) {
            paths.push(branchPath(field, paths[0], config.windiness, random));
        }

        const courses = paths.map(path => widenPath(path, config.width, random));

        for (let i = 0; i < field.count; i++) {
            const near = nearestOnCourses(courses, fieldX(field, i), fieldZ(field, i));
            if (!near) continue;

            const cut = carveProfile(near.distance / (near.width / 2), config.steepness);
            if (cut > 0) field.height[i] -= depthAt(config, near) * cut;
        }

        return courses.length;
    }
};

const desert = {
    id: 'desert',
    label: 'Desert',
    ranges: {
        duneHeight: span(2, 200, 16, 52),
        spacing:    scalar(120, 4000, 900),
        // How much of the world the dune sea covers.
        coverage:   scalar(0.1, 1, 0.6),
        color:      gradient([0.85, 0.77, 0.55], [0.55, 0.45, 0.28])
    },

    generate(field, config, random) {
        const half    = field.size / 2;
        const radius  = half * (0.35 + config.coverage * 0.8);
        const drift   = half * (1 - config.coverage) * 0.6;
        const centerX = (random() * 2 - 1) * drift;
        const centerZ = (random() * 2 - 1) * drift;
        const angle   = random() * Math.PI * 2;
        const cos = Math.cos(angle), sin = Math.sin(angle);
        const [low, high] = config.duneHeight;

        for (let i = 0; i < field.count; i++) {
            const x = fieldX(field, i);
            const z = fieldZ(field, i);
            const fade = smoothstep(1 - Math.hypot(x - centerX, z - centerZ) / radius);
            if (fade <= 0) continue;

            // The crests run along one axis and wander off it, so a dune sea
            // reads as wind-blown rather than as corrugated iron.
            const wander = fbm(x / (config.spacing * 3), z / (config.spacing * 3), 3) * 4;
            const along  = (x * cos + z * sin) / config.spacing;
            const ridge  = 0.5 - 0.5 * Math.cos(along * Math.PI * 2 + wander);
            const crest  = low + (high - low) * fbm(x / (config.spacing * 6), z / (config.spacing * 6), 4);

            field.height[i] += crest * ridge * fade;
            mixColor(field, i, blend(config.color, 1 - ridge), fade);
        }

        return radius;
    }
};

// --- Ground cover ---------------------------------------------------------

const grass = {
    id: 'grass',
    label: 'Grass',
    ranges: {
        color: gradient([0.36, 0.55, 0.16], [0.16, 0.31, 0.10]),
        band:  span(0, 2000, 12, 130)
    },

    generate(field, config) {
        return paintBand(field, config.band, config.color);
    }
};

const sand = {
    id: 'sand',
    label: 'Sand',
    ranges: {
        color: gradient([0.85, 0.77, 0.55], [0.60, 0.51, 0.33]),
        band:  span(0, 2000, 4, 12)
    },

    generate(field, config) {
        return paintBand(field, config.band, config.color);
    }
};

const water = {
    id: 'water',
    label: 'Water Body',
    ranges: {
        level:   scalar(0, 600, 4),
        color:   gradient([0.22, 0.46, 0.74], [0.05, 0.15, 0.42]),
        // How much of the basin is pulled up to a flat surface. At 1 the water
        // is a still sheet; at 0 it is only a colour over the ground.
        flatten: scalar(0, 1, 1)
    },

    generate(field, config) {
        const { level, flatten, color } = config;
        let covered = 0;

        for (let i = 0; i < field.count; i++) {
            const h = field.height[i];
            if (h >= level) continue;

            // Deep water is the dark end of the base hue, a shoreline the pale
            // end, so the drop-off reads without a second colour.
            const depth = level <= 0 ? 0 : (level - h) / level;
            paint(field, i, blend(color, depth));
            field.height[i] = h + (level - h) * flatten;
            covered++;
        }

        return covered;
    }
};

const river = {
    id: 'river',
    label: 'River',
    ranges: {
        color: gradient([0.26, 0.50, 0.76], [0.06, 0.18, 0.46]),
        // How far the course is allowed to wander off a straight run.
        windiness: scalar(0, 1, 0.55),
        width:     span(40, 900, 100, 280),
        depth:     span(2, 200, 14, 36)
    },

    generate(field, config, random) {
        const path = meanderPath(field, config.windiness, 1, random);
        const course = widenPath(path, config.width, random);

        const [shallow, deep] = config.depth;
        let wetted = 0;

        for (let i = 0; i < field.count; i++) {
            const near = nearestOnCourses([course], fieldX(field, i), fieldZ(field, i));
            if (!near) continue;

            const across = near.distance / (near.width / 2);
            const cut = carveProfile(across, 0.25);
            if (cut <= 0) continue;

            field.height[i] -= (shallow + (deep - shallow) * near.deep) * cut;
            mixColor(field, i, blend(config.color, cut), cut);
            wetted++;
        }

        return wetted;
    }
};

const forest = {
    id: 'forest',
    label: 'Forest',
    ranges: {
        treeHeight: span(2, 200, 16, 38),
        // How tightly the trees pack, from a clearing to a closed canopy.
        density:    scalar(0, 1, 0.6),
        size:       span(150, 6000, 700, 1700),
        count:      scalar(1, 60, 6),
        color:      gradient([0.18, 0.42, 0.14], [0.05, 0.19, 0.07]),
        // The heights trees will grow between: nothing below the shoreline and
        // nothing above the treeline.
        band:       span(0, 2000, 10, 260)
    },

    generate(field, config, random) {
        const half   = field.size / 2 - field.size * 0.08;
        const groves = [];

        for (let i = 0; i < Math.round(config.count); i++) {
            groves.push({
                x: (random() * 2 - 1) * half,
                z: (random() * 2 - 1) * half,
                radius: pick(random, config.size),
                // Three lobes at frequencies that share no common multiple, so
                // the outline never closes back on itself as a rosette. The
                // weights are kept small enough that the shape stays a lobed
                // blob: a forest has an uneven edge, not arms.
                lobes: [
                    { turns: 2, phase: random() * Math.PI * 2, weight: 0.22 },
                    { turns: 3, phase: random() * Math.PI * 2, weight: 0.13 },
                    { turns: 5, phase: random() * Math.PI * 2, weight: 0.07 }
                ]
            });
        }

        const [low, high] = config.treeHeight;
        const [floor, ceiling] = config.band;
        let planted = 0;

        for (let i = 0; i < field.count; i++) {
            const h = field.height[i];
            if (h < floor || h > ceiling) continue;

            const x = fieldX(field, i);
            const z = fieldZ(field, i);

            let cover = 0;
            for (const grove of groves) {
                cover = Math.max(cover, groveCover(grove, x, z));
            }
            if (cover <= 0) continue;

            // Where the trees stand: slow noise across the grove, thresholded
            // by the density, so a sparse forest is clearings between stands
            // and a dense one is a closed canopy. The noise is generated from
            // the ground itself, so the same forest grows back the same way
            // every time the field is rebuilt.
            const scatter = fbm(x * SCATTER_SCALE, z * SCATTER_SCALE, 3);
            const stand = cover * smoothstep((scatter - (1 - config.density)) * 6 + 0.5);
            if (stand <= 0) continue;

            // The canopy is a mass rather than a scatter of spikes: it reaches
            // the full height range where the stand is closed and eases to
            // nothing at the clearings and the outline.
            field.height[i] += (low + (high - low) * stand) * stand;
            mixColor(field, i, blend(config.color, cover), Math.min(1, stand * 1.4));
            planted++;
        }

        return planted;
    }
};

const town = {
    id: 'town',
    label: 'Town',
    ranges: {
        // The size of one block, street included.
        grid:           scalar(80, 900, 320),
        // How many blocks of the grid are built on rather than left open.
        density:        scalar(0, 1, 0.55),
        buildingHeight: span(4, 300, 16, 64),
        extent:         span(300, 6000, 900, 1900),
        color:          gradient([0.62, 0.60, 0.58], [0.30, 0.29, 0.30]),
        street:         gradient([0.42, 0.41, 0.39], [0.24, 0.24, 0.24])
    },

    generate(field, config, random) {
        const half    = field.size / 2 - field.size * 0.15;
        const centerX = (random() * 2 - 1) * half;
        const centerZ = (random() * 2 - 1) * half;
        const radius  = pick(random, config.extent);

        // A town sits on the ground it was built on rather than pouring its
        // blocks down a hillside, so the site is levelled to its own average.
        const ground = averageHeight(field, centerX, centerZ, radius);
        const grid   = config.grid;
        const plot   = grid * 0.62;
        const margin = (grid - plot) / 2;
        const [low, high] = config.buildingHeight;
        let built = 0;

        for (let i = 0; i < field.count; i++) {
            const x = fieldX(field, i);
            const z = fieldZ(field, i);
            const fade = smoothstep((radius - Math.hypot(x - centerX, z - centerZ)) / (radius * 0.4));
            if (fade <= 0) continue;

            field.height[i] += (ground - field.height[i]) * fade;
            mixColor(field, i, blend(config.street, 0.5), fade * 0.85);

            const cellX = Math.floor((x - centerX) / grid);
            const cellZ = Math.floor((z - centerZ) / grid);
            if (hash(cellX + 0.37, cellZ + 0.71) >= config.density) continue;

            const insideX = (x - centerX) - cellX * grid;
            const insideZ = (z - centerZ) - cellZ * grid;
            const onPlot = insideX > margin && insideX < grid - margin
                        && insideZ > margin && insideZ < grid - margin;
            if (!onPlot) continue;

            const storeys = hash(cellX + 5.13, cellZ + 2.41);
            field.height[i] = ground + (low + (high - low) * storeys) * fade;
            mixColor(field, i, blend(config.color, storeys), fade);
            built++;
        }

        return built;
    }
};

const snow = {
    id: 'snow',
    label: 'Snow',
    ranges: {
        // The altitude snow starts settling at.
        line:     scalar(0, 2000, 300),
        coverage: scalar(0, 1, 0.9),
        // The steepest ground snow will hold on to: past it a face is bare.
        slope:    scalar(0, 3, 0.9),
        color:    gradient([1, 1, 1], [0.70, 0.74, 0.84])
    },

    generate(field, config) {
        const band = Math.max(1, config.line * 0.35);
        let settled = 0;

        for (let i = 0; i < field.count; i++) {
            const above = (field.height[i] - config.line) / band;
            if (above <= 0) continue;

            const depth = smoothstep(Math.min(above, 1)) * config.coverage;
            const grip  = config.slope <= 0 ? 0 : 1 - smoothstep(slopeAt(field, i) / config.slope);
            const held  = depth * grip;
            if (held <= 0) continue;

            mixColor(field, i, blend(config.color, 1 - depth), held);
            settled++;
        }

        return settled;
    }
};

// --- The strip ------------------------------------------------------------

// How many sites are weighed before one is built on, and how densely each of
// them is measured. A candidate is judged on the ground under the whole strip
// rather than under its middle, because what makes a runway landable is that
// the far end is where the near end said it would be.
const RUNWAY_SITES  = 64;
const RUNWAY_ALONG  = 9;
const RUNWAY_ACROSS = 3;

// What a site is charged, per world unit, for the part of it that lies outside
// the band a strip may be built in. Charged rather than refused, so a world
// whose ground never quite fits the band still gets a runway - the flattest one
// going - instead of silently getting none.
const RUNWAY_BAND_PENALTY = 4;

// Where the paint goes, as fractions of the half width and the half length: a
// stripe down each shoulder, and a bar across each threshold.
const RUNWAY_SHOULDER  = 0.78;
const RUNWAY_THRESHOLD = 0.9;

const runway = {
    id: 'runway',
    label: 'Runway',
    ranges: {
        length: span(600, 8000, 2200, 3400),
        width:  span(80, 600, 220, 320),
        // The bearing the strip is laid along, in degrees off north. The whole
        // circle by default, so a world gets the heading its ground suits
        // rather than one chosen for it in advance.
        heading: span(0, 359, 0, 359),
        // The ground a strip may be built on: nothing under the shoreline, and
        // nothing up where an approach would be flown into a mountainside.
        band: span(0, 2000, 20, 400),
        // How far the graded ground reaches past the paved strip, in strip
        // widths, easing back into the ground it was cut into.
        apron: scalar(0, 3, 1.1),
        color: gradient([0.32, 0.32, 0.34], [0.11, 0.11, 0.13]),
        mark:  gradient([0.95, 0.95, 0.92], [0.70, 0.72, 0.70])
    },

    generate(field, config, random) {
        const length = pick(random, config.length);
        const width  = pick(random, config.width);
        const site   = chooseRunwaySite(field, config, length, width, random);
        if (!site) return null;

        const strip = { ...site, length, width };
        gradeRunway(field, strip, config);
        field.runways.push(strip);
        return strip;
    }
};

// --- Reading a strip ------------------------------------------------------

/**
 * The unit vector a strip runs along, from the bearing it was laid on. North is
 * the world's +Z axis, which is the same north the compass card counts from, so
 * a strip on 000 runs the way a flight starting on 000 is already pointing.
 */
export function runwayDirection(heading) {
    const radians = heading * Math.PI / 180;
    return { alongX: Math.sin(radians), alongZ: Math.cos(radians) };
}

/** A place on a strip, given as how far along it and how far across it lies. */
export function runwayPoint(runway, along, across = 0) {
    return {
        x: runway.x + runway.alongX * along - runway.alongZ * across,
        z: runway.z + runway.alongZ * along + runway.alongX * across
    };
}

/** The same reading the other way round: where a place in the world sits on a strip. */
export function runwayOffsets(runway, x, z) {
    const dx = x - runway.x;
    const dz = z - runway.z;
    return {
        along:   dx * runway.alongX + dz * runway.alongZ,
        across: -dx * runway.alongZ + dz * runway.alongX
    };
}

/**
 * True while a place is over the paved strip. The margin widens the box for a
 * caller that wants to know it is close rather than that it is on.
 */
export function isOnRunway(runway, x, z, margin = 0) {
    if (!runway) return false;
    const { along, across } = runwayOffsets(runway, x, z);
    return Math.abs(along)  <= runway.length / 2 + margin
        && Math.abs(across) <= runway.width  / 2 + margin;
}

/**
 * Both ends of a strip, each with the bearing a takeoff from it runs on. A
 * runway is flown in either direction, so it has two thresholds rather than a
 * start and a finish.
 */
export function runwayThresholds(runway) {
    const reach = runway.length / 2;
    return [
        { ...runwayPoint(runway, -reach), heading: runway.heading },
        { ...runwayPoint(runway,  reach), heading: (runway.heading + 180) % 360 }
    ];
}

/** The strip nearest a place in the world, or null where there is none at all. */
export function nearestRunway(runways, x, z) {
    let best = null;
    let closest = Infinity;

    for (const runway of runways ?? []) {
        const distance = Math.hypot(x - runway.x, z - runway.z);
        if (distance >= closest) continue;
        best = runway;
        closest = distance;
    }

    return best;
}

// --- The registry ---------------------------------------------------------

export const ELEMENTS = [
    mountain, canyon, desert, grass, sand, water, river, forest, town, snow, runway
];

export const ELEMENTS_BY_ID = new Map(ELEMENTS.map(element => [element.id, element]));

export function getElement(id) {
    const element = ELEMENTS_BY_ID.get(id);
    if (!element) throw new Error(`Unknown environment element: ${id}`);
    return element;
}

export function isElementId(id) {
    return ELEMENTS_BY_ID.has(id);
}

/** Every element in the order it is applied, whatever order a preset lists. */
export function orderPlacements(placements = []) {
    return [...placements].sort(
        (a, b) => ELEMENT_ORDER.indexOf(a.type) - ELEMENT_ORDER.indexOf(b.type)
    );
}

/**
 * Draws one element onto the field, with its configuration filled in from the
 * ranges it declares. Returns whatever the generator counted, which is only
 * ever of interest to a test or a log line.
 */
export function applyElement(field, placement, random = createRandom()) {
    const element = getElement(placement.type);
    return element.generate(field, resolveConfig(element, placement.config), random);
}

// --- Shared algorithms ----------------------------------------------------

function ellipticalDistance(dx, dz, angle, stretch) {
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const along  = (dx * cos + dz * sin) / stretch;
    const across = -dx * sin + dz * cos;
    return Math.sqrt(along * along + across * across);
}

/** How many points a path is sampled at: dense enough to read as a curve. */
const PATH_POINTS = 72;

// How quickly the noise that scatters a forest's stands changes across the
// ground, in reciprocal world units: slow enough that a stand covers several
// vertices rather than every other one.
const SCATTER_SCALE = 0.0045;

/**
 * A course across the world, wandering off the straight line it would
 * otherwise run. The wander is three waves whose lengths share no common
 * multiple, so the course never repeats a bend and reads as cut by water
 * rather than drawn with a compass.
 */
function meanderPath(field, windiness, length, random) {
    const half     = field.size / 2;
    const alongX   = random() < 0.5;
    const start    = (random() * 2 - 1) * half * 0.45;
    const run      = clamp(length, 0.2, 1);
    const entry    = -half + (1 - run) * field.size * random();

    const waves = [
        { turns: 0.9 + random() * 0.5, phase: random() * Math.PI * 2, weight: 1.00 },
        { turns: 2.3 + random() * 0.7, phase: random() * Math.PI * 2, weight: 0.45 },
        { turns: 5.1 + random() * 1.3, phase: random() * Math.PI * 2, weight: 0.20 }
    ];

    const path = [];
    for (let i = 0; i <= PATH_POINTS; i++) {
        const t = i / PATH_POINTS;
        const along = entry + t * field.size * run;

        let offset = 0;
        for (const wave of waves) {
            offset += Math.sin(t * Math.PI * 2 * wave.turns + wave.phase) * wave.weight;
        }

        const across = clamp(start + offset * windiness * half * 0.5, -half, half);
        path.push(alongX ? { x: along, z: across } : { x: across, z: along });
    }

    return path;
}

/** A side course leaving a trunk part way along it and running off at an angle. */
function branchPath(field, trunk, windiness, random) {
    const origin = trunk[Math.floor(random() * (trunk.length - 1)) + 1];
    const angle  = (random() < 0.5 ? -1 : 1) * (Math.PI / 4 + random() * Math.PI / 4);
    const reach  = field.size * (0.15 + random() * 0.25);
    const half   = field.size / 2;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const phase = random() * Math.PI * 2;

    const path = [];
    for (let i = 0; i <= PATH_POINTS; i++) {
        const t = i / PATH_POINTS;
        const wander = Math.sin(t * Math.PI * 2 * 1.7 + phase) * windiness * reach * 0.25;

        path.push({
            x: clamp(origin.x + (cos * t * reach) - sin * wander, -half, half),
            z: clamp(origin.z + (sin * t * reach) + cos * wander, -half, half)
        });
    }

    return path;
}

/**
 * Turns a course into the stretches between its points, giving each point its
 * own width, varied gradually along the run so neighbouring stretches never
 * differ dramatically, and its own share of the depth range.
 *
 * Each stretch carries the box it can reach, which is what keeps a query over
 * forty thousand vertices from measuring every one of them against every
 * stretch of every course in the world.
 */
function widenPath(path, [low, high], random) {
    const phase = random() * Math.PI * 2;
    const turns = 1.3 + random() * 1.4;

    path.forEach((point, index) => {
        const t = index / (path.length - 1);
        const swell = 0.5 - 0.5 * Math.cos(t * Math.PI * 2 * turns + phase);
        point.width = low + (high - low) * swell;
        point.deep  = swell;
    });

    const stretches = [];
    for (let i = 1; i < path.length; i++) {
        const from = path[i - 1], to = path[i];
        const reach = Math.max(from.width, to.width) / 2;
        stretches.push({
            from, to,
            minX: Math.min(from.x, to.x) - reach, maxX: Math.max(from.x, to.x) + reach,
            minZ: Math.min(from.z, to.z) - reach, maxZ: Math.max(from.z, to.z) + reach
        });
    }

    return stretches;
}

/**
 * The nearest stretch of any course to a place in the world, or null when no
 * stretch is wide enough to reach it.
 */
function nearestOnCourses(courses, x, z) {
    let best = null;

    for (const stretches of courses) {
        for (const stretch of stretches) {
            if (x < stretch.minX || x > stretch.maxX) continue;
            if (z < stretch.minZ || z > stretch.maxZ) continue;

            const near = nearestOnStretch(stretch.from, stretch.to, x, z);
            if (near.distance > near.width / 2) continue;
            if (best && near.distance >= best.distance) continue;
            best = near;
        }
    }

    return best;
}

/**
 * The closest point of one stretch of path, with the width and the depth of
 * that stretch read across it. Measured against the stretch rather than the
 * points it runs between, so a channel is a ribbon rather than a string of
 * circles at the places the course happened to be sampled.
 */
function nearestOnStretch(from, to, x, z) {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const lengthSquared = dx * dx + dz * dz;
    const along = lengthSquared <= 0
        ? 0
        : clamp(((x - from.x) * dx + (z - from.z) * dz) / lengthSquared, 0, 1);

    return {
        distance: Math.hypot(x - (from.x + dx * along), z - (from.z + dz * along)),
        width: from.width + (to.width - from.width) * along,
        deep:  from.deep  + (to.deep  - from.deep)  * along
    };
}

/**
 * How much of the full cut is taken out at a distance across the channel,
 * measured in half widths. Everything inside the steepness fraction is floor,
 * and the rest eases back up to the ground either side, so a higher steepness
 * spends less of the channel on its walls and reads as a sharper cut.
 */
export function carveProfile(across, steepness) {
    if (across >= 1) return 0;
    const floor = clamp(steepness, 0, 0.95);
    if (across <= floor) return 1;
    return 1 - smoothstep((across - floor) / (1 - floor));
}

function depthAt(config, near) {
    const [low, high] = config.depth;
    return low + (high - low) * near.deep;
}

/**
 * How much of a grove reaches a place, from 1 at its middle out to 0 at an
 * outline that is lobed rather than round, so a forest has an edge that reads
 * as one that grew.
 */
function groveCover(grove, x, z) {
    const dx = x - grove.x;
    const dz = z - grove.z;
    const distance = Math.hypot(dx, dz);
    if (distance > grove.radius * 1.5) return 0;

    const bearing = Math.atan2(dz, dx);
    let outline = 1;
    for (const lobe of grove.lobes) {
        outline += Math.sin(bearing * lobe.turns + lobe.phase) * lobe.weight;
    }

    // The stand is full out to most of its radius and only fades at the edge,
    // so a grove is a wood with a ragged boundary rather than a smudge that is
    // only ever solid at one point in the middle of it.
    const edge = grove.radius * Math.max(outline, 0.3);
    return distance >= edge ? 0 : smoothstep((edge - distance) / (edge * 0.45));
}

function paintBand(field, [low, high], color) {
    const range = Math.max(high - low, 1e-6);
    let painted = 0;

    for (let i = 0; i < field.count; i++) {
        const h = field.height[i];
        if (h < low || h > high) continue;
        paint(field, i, blend(color, (h - low) / range));
        painted++;
    }

    return painted;
}

/**
 * Where to build the strip. Sites are drawn from the environment's own seeded
 * stream and the flattest one wins, because what a runway needs is not a
 * particular place but ground that does not move under it.
 *
 * A site outside the band the strip may be built in is charged for the part of
 * it that lies outside rather than thrown away, so the search always comes back
 * with somewhere: a world with no ground inside the band gets the best ground it
 * has instead of getting no runway at all.
 */
function chooseRunwaySite(field, config, length, width, random) {
    const reach = field.size / 2 - length / 2 - field.step * 2;
    if (reach <= 0) return null;

    const [floor, ceiling] = config.band;
    let best = null;

    for (let i = 0; i < RUNWAY_SITES; i++) {
        const heading = pick(random, config.heading);
        const site = {
            x: (random() * 2 - 1) * reach,
            z: (random() * 2 - 1) * reach,
            heading,
            ...runwayDirection(heading)
        };

        const ground  = measureRunwayGround(field, site, length, width);
        const outside = Math.max(0, floor - ground.low) + Math.max(0, ground.high - ceiling);
        const score   = ground.spread + outside * RUNWAY_BAND_PENALTY;

        if (best && score >= best.score) continue;
        best = { ...site, elevation: ground.mean, spread: ground.spread, score };
    }

    return best;
}

/** How level the ground under a candidate strip is, and what height it sits at. */
function measureRunwayGround(field, site, length, width) {
    let low = Infinity, high = -Infinity, total = 0, counted = 0;

    for (let a = 0; a < RUNWAY_ALONG; a++) {
        const along = (a / (RUNWAY_ALONG - 1) - 0.5) * length;

        for (let c = 0; c < RUNWAY_ACROSS; c++) {
            const across = (c / (RUNWAY_ACROSS - 1) - 0.5) * width;
            const at = runwayPoint(site, along, across);
            const h  = sampleHeight(field, at.x, at.z);

            low  = Math.min(low, h);
            high = Math.max(high, h);
            total += h;
            counted++;
        }
    }

    return { low, high, mean: total / counted, spread: high - low };
}

/**
 * Cuts the strip into the ground and paints it. The paved rectangle is levelled
 * dead flat to the site's own height and the apron either side eases back into
 * whatever was there, so a runway sits in the country rather than on a plinth.
 *
 * The paint is a stripe down each shoulder and a bar across each threshold,
 * which is what makes a strip readable from the air as something to aim at
 * rather than as a dark patch of ground.
 */
function gradeRunway(field, runway, config) {
    const halfLength = runway.length / 2;
    const halfWidth  = runway.width / 2;
    const skirt      = runway.width * config.apron;
    const outerAlong = halfLength + skirt;
    const outerCross = halfWidth + skirt;

    for (let i = 0; i < field.count; i++) {
        const { along, across } = runwayOffsets(runway, fieldX(field, i), fieldZ(field, i));
        const reachAlong = Math.abs(along);
        const reachCross = Math.abs(across);
        if (reachAlong > outerAlong || reachCross > outerCross) continue;

        const grade = Math.min(
            edgeFade(reachAlong, halfLength, outerAlong),
            edgeFade(reachCross, halfWidth,  outerCross)
        );
        if (grade <= 0) continue;

        field.height[i] += (runway.elevation - field.height[i]) * grade;

        if (reachAlong > halfLength || reachCross > halfWidth) {
            // The apron is cleared ground rather than pavement: it takes a
            // little of the strip's colour and keeps its own.
            mixColor(field, i, blend(config.color, 0.2), grade * 0.4);
            continue;
        }

        const painted = reachCross / halfWidth >= RUNWAY_SHOULDER
                     || reachAlong / halfLength >= RUNWAY_THRESHOLD;

        paint(field, i, painted
            ? blend(config.mark, reachCross / halfWidth)
            : blend(config.color, 1 - reachCross / halfWidth));
    }
}

/**
 * Full strength inside an inner reach, nothing past an outer one, and eased
 * between the two, for anything that has a hard middle and a soft edge.
 */
function edgeFade(distance, inner, outer) {
    if (distance <= inner) return 1;
    if (distance >= outer) return 0;
    return smoothstep(1 - (distance - inner) / (outer - inner));
}

function averageHeight(field, centerX, centerZ, radius) {
    let total = 0, counted = 0;

    for (let i = 0; i < field.count; i++) {
        const dx = fieldX(field, i) - centerX;
        const dz = fieldZ(field, i) - centerZ;
        if (dx * dx + dz * dz > radius * radius) continue;
        total += field.height[i];
        counted++;
    }

    return counted === 0 ? sampleHeight(field, centerX, centerZ) : total / counted;
}
