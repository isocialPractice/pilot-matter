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
import { bearingToDirection } from '../units.js';

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
 * then the cuts and the built things, and snow settles on top of everything
 * else. Paint is the last colour laid, over snow and all, because a stroke is
 * the pilot's last word on what colour the ground is.
 */
export const ELEMENT_ORDER = [
    'mountain', 'canyon',
    'grass', 'sand', 'desert', 'water',
    'river', 'forest', 'town',
    'snow',
    'paint',
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
 *
 * `originX` and `originZ` are where the middle of the square sits in the world,
 * which is what lets a field be one tile of a larger assembly rather than the
 * whole of a world. Everything below works in world coordinates rather than in
 * the tile's own, so an element straddling an origin is drawn from the same
 * arithmetic wherever the tile was laid, and the noise the ground is shaped from
 * runs on across the join instead of starting again at it.
 */
export function createField({
    size = DEFAULT_SIZE, segments = DEFAULT_SEGMENTS, originX = 0, originZ = 0
} = {}) {
    const stride = Math.max(2, Math.round(segments)) + 1;
    const count  = stride * stride;

    return {
        size,
        segments: stride - 1,
        stride,
        count,
        step: size / (stride - 1),
        originX,
        originZ,
        height: new Float32Array(count),
        color: new Float32Array(count * 3),
        runways: [],
        // The water laid on it, for a renderer that wants to move the surface
        // rather than draw it as painted ground: `{ level, line }`. `level` is
        // the sea's, one height for the whole field, or null where there is
        // no sea. `line` is one height a vertex - the line the water at that
        // vertex rests at: the sea's level wherever the sea reaches, a drawn
        // body's own line where one was drawn, and NaN where it is dry - so a
        // vertex is wet where it lies at or under its own line.
        water: null,
        // Which vertices the last join moved, as a flag each, for a renderer
        // lighting the strip of a tile that moved rather than the whole plane
        // of it. Null until something is settled against this field.
        seam: null
    };
}

/**
 * A field to draw on without touching the one it was copied from: the heights,
 * the colours, the strips and the water record each its own, everything else -
 * the size, the sampling, the origin - read off the original.
 *
 * It is how an element is drawn only where a footprint reaches. The element is
 * run on a copy as the whole-world algorithm it was written as, and the copy is
 * blended back through the footprint, so no generator has to know a footprint
 * exists.
 */
export function cloneField(field) {
    return {
        ...field,
        height:  new Float32Array(field.height),
        color:   new Float32Array(field.color),
        runways: [...field.runways],
        water:   field.water ? { ...field.water, line: field.water.line ? new Float32Array(field.water.line) : null } : null,
        seam:    field.seam?.slice ? field.seam.slice() : field.seam ?? null
    };
}

export function fieldX(field, index) {
    return field.originX - field.size / 2 + (index % field.stride) * field.step;
}

export function fieldZ(field, index) {
    return field.originZ - field.size / 2 + Math.floor(index / field.stride) * field.step;
}

/** The square a field covers, in the world rather than in its own coordinates. */
export function fieldBounds(field) {
    const half = field.size / 2;
    return {
        minX: field.originX - half, maxX: field.originX + half,
        minZ: field.originZ - half, maxZ: field.originZ + half
    };
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
 * The colour of the vertex nearest a point of the world, or null for a point
 * the field does not reach. Nearest rather than blended, because what reads a
 * colour off the ground - the eye dropper - wants a colour that is there, not
 * one mixed out of four that are.
 */
export function nearestColor(field, x, z) {
    const half = field.size / 2;
    const col = Math.round((x - field.originX + half) / field.step);
    const row = Math.round((z - field.originZ + half) / field.step);
    if (!(col >= 0 && col <= field.segments && row >= 0 && row <= field.segments)) return null;
    return readColor(field, row * field.stride + col);
}

// --- Colour blending ---------------------------------------------------------

/** Rec. 709's luminance weights, which is how light the eye reads a colour as. */
export const LUMA = Object.freeze([0.2126, 0.7152, 0.0722]);

export function luminance(c) {
    return c[0] * LUMA[0] + c[1] * LUMA[1] + c[2] * LUMA[2];
}

/**
 * The paint colour carrying the ground's own lightness: the hue and the
 * saturation the pilot picked, at the luminance the ground already had.
 *
 * A stroke laid this way keeps the shading the terrain had - a gradient's
 * pale and deep ends, a lit slope and a shadowed one - so a painted hillside
 * still reads as a hillside. Mixing straight to the colour, which is what
 * `mixColor` does, replaces that shading with a flat patch, and a flat patch is
 * what makes a painted world look wrong.
 *
 * The luminance is set by shifting every channel by the same amount and then,
 * where that takes a channel past what a channel holds, drawing the colour in
 * toward its own grey until it fits - the Color blend of the W3C's compositing
 * spec - so the result has the ground's luminance exactly, the paint's hue,
 * and as much of its saturation as that lightness can carry. Scaling the paint
 * to the luminance instead loses it: a deep blue scaled up to a pale ground is
 * clipped back to the deep blue it was. A colour with no hue - black, white,
 * a grey - comes out as the ground's own grey.
 */
export function tintColor(ground, paint) {
    const target = luminance(ground);
    const shift  = target - luminance(paint);
    const moved  = paint.map(channel => channel + shift);

    const low  = Math.min(...moved);
    const high = Math.max(...moved);
    let scale = 1;
    if (low < 0)  scale = Math.min(scale, target / (target - low));
    if (high > 1) scale = Math.min(scale, (1 - target) / (high - target));
    return moved.map(channel => clamp(target + (channel - target) * scale, 0, 1));
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
    const nx = (x - field.originX + half) / field.size;
    const nz = (z - field.originZ + half) / field.size;
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

/**
 * The seed one tile of an assembly is generated from. A tile keeps the seed of
 * the description it was built from and mixes its place in the grid into it, so
 * neighbouring tiles are the same world without being the same ground, and the
 * tile at a given place is that ground every time it is laid.
 *
 * The middle tile is the description itself, untouched, so a world laid as one
 * square of a grid and the same world laid on its own are the same ground.
 */
export function tileSeed(seed = 1, x = 0, z = 0) {
    // Halves are kept because an assembly of an even number of tiles is centred
    // on a join rather than on a tile, which puts every origin on a half.
    const gx = Math.round(x * 2) | 0;
    const gz = Math.round(z * 2) | 0;
    return (Math.trunc(seed) + tileMix(gx, gz)) >>> 0;
}

/**
 * What a place in the grid contributes to the seed laid there: nothing at the
 * middle, and a well spread value everywhere else.
 *
 * The two coordinates are stirred together rather than combined, because a
 * combination is only as good as its symmetries. Multiplying each by a constant
 * and taking one against the other reads as scattered but is not: it gives the
 * same answer at a place and at its opposite, which would fold an endless world
 * in half about its middle and lay the same ground out twice.
 */
function tileMix(gx, gz) {
    if (gx === 0 && gz === 0) return 0;

    let h = (Math.imul(gx, 0x27d4eb2d) + Math.imul(gz, 0x165667b1) + 0x9e3779b9) | 0;
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    return (h ^ (h >>> 15)) >>> 0;
}

// --- Configurable ranges --------------------------------------------------

/**
 * The options every range kind takes as its last argument.
 *
 * `when` gates the range on a field holding one of a list of values -
 * `{ useLength: true }`, `{ shape: ['polygon', 'star'] }` - and a key written
 * `ctx.<name>` reads a fact about the session the panel is handed rather than a
 * field: `{ 'ctx.lasso': false }`. A panel draws a range whose gate is shut
 * disabled and keeps its value, so opening the gate again gives back what was
 * there rather than the default. Generation never reads a gate: what a range
 * resolves to is the same either way.
 *
 * `percent` says a fraction is read as a percentage - an opacity of 0.4 is
 * `40%` on a panel, and 40 is what is typed for it - and `slider` that a panel
 * draws a slider beside the figure, for a value set by eye: a brush's size.
 * Neither changes what the range resolves to.
 *
 * Added to a range only when given, so a range declared without one is the
 * object it always was.
 */
function rangeOptions({ when, percent, slider } = {}) {
    return {
        ...(when != null && typeof when === 'object' ? { when } : {}),
        ...(percent === true ? { percent: true } : {}),
        ...(slider === true ? { slider: true } : {})
    };
}

/** A pair of bounds an element generates between, such as a peak height. */
export function span(low, high, defaultLow, defaultHigh, options) {
    return { kind: 'span', low, high, default: [defaultLow, defaultHigh], ...rangeOptions(options) };
}

/** A single configurable value, such as a density or a snow line. */
export function scalar(low, high, value, options) {
    return { kind: 'scalar', low, high, default: value, ...rangeOptions(options) };
}

/** A base hue given as its light and its dark end, blended across in between. */
export function gradient(light, dark, options) {
    return { kind: 'gradient', default: { light, dark }, ...rangeOptions(options) };
}

/**
 * One of a list, which is what a shape, a brush tip and a registered asset all
 * are. Named for what `js/config.js` already calls it, `CHOICE_FIELD`, so the
 * project is converging on one vocabulary for a field a panel offers rather
 * than keeping two.
 *
 * The values are what a placement holds - strings or numbers, never objects -
 * so a placement stays JSON-shaped: an asset is offered by its id, not by the
 * mesh. A default not in the list is the first value.
 */
export function choice(values, defaultValue, options) {
    const list = Object.freeze([...(values ?? [])]);
    return {
        kind: 'choice',
        values: list,
        default: list.includes(defaultValue) ? defaultValue : list[0],
        ...rangeOptions(options)
    };
}

/**
 * A pair of bounds a switch turns on, such as a footprint an element otherwise
 * works out for itself.
 *
 * This is a span and a question about whether to use it, which is a different
 * thing from either on its own. A span always applies, so the only way to say
 * "leave this alone" with one is to find a value that happens to mean nothing -
 * and a generator that reads 0 as "no opinion" cannot be asked for 0. A switch
 * of its own says it outright, which is what lets an element declare a range it
 * only sometimes takes and go on drawing what it always drew when it is off.
 *
 * Off by default, so a declaration adds a range to an element without changing
 * any world already described: every preset written before the range existed
 * resolves to the same ground it always did.
 */
export function gated(low, high, defaultLow, defaultHigh, on = false, options) {
    return { kind: 'gated', low, high, default: { on, range: [defaultLow, defaultHigh] }, ...rangeOptions(options) };
}

/**
 * A switch with no bounds behind it: a mode an element is either in or not.
 *
 * This is the half of `gated` the comment above calls "a different thing from
 * either on its own" - the question without the span. A mode that reaches
 * across several ranges at once has no pair of its own to carry, and saying it
 * with a scalar instead would be declaring a dial from 0 to 1 that only ever
 * means two things: every value between them would be a setting the element
 * cannot be in, reachable by typing one in.
 *
 * Off by default, for the reason `gated` is: a mode added to an element leaves
 * every world already described exactly as it was.
 */
export function toggle(on = false, options) {
    return { kind: 'toggle', low: 0, high: 1, default: on === true, ...rangeOptions(options) };
}

/**
 * One flat colour, as `[r, g, b]` from 0 to 1: what a brush lays.
 *
 * Not a gradient. A gradient is for an element that covers ground it has to
 * stay recognisable across, which is why its ends are only lightened and
 * darkened along their own hue; a brush stroke is the one colour the pilot
 * picked, anywhere on the wheel, so it is chosen rather than stepped.
 */
export function color(rgb, options) {
    return { kind: 'color', default: rgbOf(rgb, [0, 0, 0]), ...rangeOptions(options) };
}

/** Three channels held to what a channel holds, or `fallback` for anything that is not three numbers. */
function rgbOf(given, fallback) {
    return Array.isArray(given) && given.length === 3 && given.every(Number.isFinite)
        ? given.map(channel => clamp(channel, 0, 1))
        : [...fallback];
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
 *
 * A configuration may also carry `at`, the point an element was dropped on,
 * which is kept beside the ranges rather than among them - see `resolvePoint`.
 */
export function resolveConfig(element, overrides = {}) {
    const given  = overrides ?? {};
    const config = {};
    for (const [name, range] of Object.entries(element.ranges)) {
        config[name] = resolveRange(range, given[name]);
    }

    const at = resolvePoint(given.at);
    if (at) config.at = at;

    // What a footprint settled at each vertex of the tile being drawn - a drawn
    // body of water's line, and how far in from its bank each vertex is. Not a
    // range, and carried like `at`: no panel sets it and no preset carries
    // one, and a generator that reads it checks it is the field's own size.
    if (given.drawn != null && typeof given.drawn === 'object') config.drawn = given.drawn;
    return config;
}

/**
 * One of the arrays a footprint settled for a generator, by name, or null for
 * one it did not settle or that is not one value a vertex of this field.
 */
export function drawnValues(config, name, field) {
    const values = config?.drawn?.[name];
    return values != null && typeof values.length === 'number' && values.length === field.count ? values : null;
}

/**
 * The point an element was dropped on, as `[x, z]` in the square's own frame -
 * measured from its middle, so the same point lands in the same place on every
 * tile of a world - or null for anything that is not a pair of finite numbers.
 *
 * Not a range. A click sets it rather than a panel, so it has no row to be
 * drawn as and no bounds to be clamped into; it is carried through beside the
 * ranges, and only a generator that reads it is moved by it. No preset carries
 * one, so every preset is the ground it always was.
 */
export function resolvePoint(given) {
    return Array.isArray(given) && given.length === 2 && given.every(Number.isFinite)
        ? [given[0], given[1]]
        : null;
}

/**
 * An offset taken to the nearest repeat of a square `size` wide, so a distance
 * measured with it is measured to the closest of a pattern's copies. A size of
 * 0 leaves the offset as it is.
 */
export function wrapOffset(offset, size = 0) {
    return size > 0 ? offset - size * Math.round(offset / size) : offset;
}

function resolveRange(range, given) {
    if (range.kind === 'gradient') {
        const value = { ...range.default, ...(given ?? {}) };
        return { light: [...value.light], dark: [...value.dark] };
    }

    if (range.kind === 'span') {
        const pair = Array.isArray(given) && given.length === 2 ? given : range.default;
        return clampPair(pair, range, range.default);
    }

    // A mode is on when it was asked for and off otherwise, which includes
    // every value that is not an answer to the question: a preset carrying a
    // number, a string or a null where a mode belongs has not asked for the
    // mode, and reading one of those as "on" would put a world into a mode it
    // never named. `true` is the whole of the asking.
    if (range.kind === 'toggle') {
        return given == null ? range.default : given === true;
    }

    // A choice is one of its values or its default: a value that is not on the
    // list is not a choice the element offers, and taking it would put the
    // element into a state nothing declared.
    if (range.kind === 'choice') {
        return range.values.includes(given) ? given : range.default;
    }

    // A colour is three channels, each held to what a channel holds; anything
    // else is not a colour, and the declared one stands.
    if (range.kind === 'color') {
        return rgbOf(given, range.default);
    }

    // A gated range is written either way round: `{ on, range }` says both
    // halves, and a bare pair says the range and means it - a caller that
    // troubled to name bounds is asking for them to be used, and reading that
    // as "off, but here are some numbers" would be answering a question nobody
    // asked. An `on` with no range beside it takes the declared one.
    if (range.kind === 'gated') {
        const asked = Array.isArray(given) ? { on: true, range: given } : given;
        const pair  = Array.isArray(asked?.range) && asked.range.length === 2
            ? asked.range : range.default.range;

        return {
            on: asked == null ? range.default.on : asked.on === true,
            range: clampPair(pair, range, range.default.range)
        };
    }

    return clampNumber(given, range, range.default);
}

/** A pair of bounds, each inside what was declared and the low end below the high. */
function clampPair(pair, range, fallback) {
    const low  = clampNumber(pair[0], range, fallback[0]);
    const high = clampNumber(pair[1], range, fallback[1]);
    return low <= high ? [low, high] : [high, low];
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
        girth:  scalar(0, 1, 0),
        // The girth said as the pair of bounds a peak draws its own out of,
        // rather than as the one value every peak in the element shares.
        //
        // The scalar above stays, and that is the answer to the question this
        // range was queued with - what an ungated `girth` means once the scalar
        // is gone. It does not go: six presets configure `girth` as a number,
        // and a gated range holds an `{ on, range }` with nowhere for that
        // number to live, so changing the kind underneath them would quietly
        // redraw six described worlds. What this declares instead is the
        // relationship `width` already has with `radius` - the live range is
        // what the switch gives way to when it is off, and the pair is the same
        // quantity said outright.
        //
        // On, each peak draws a girth of its own from the pair, which is the
        // random algorithm the range was asked for: a deck of peaks stretched
        // by varying amounts rather than by one. Off, the scalar is read as it
        // always was, and a preset that never heard of the switch draws the
        // ground it always drew.
        girthRange: gated(0, 1, 0.2, 0.9),
        // The footprint said outright, as the two axes of the ellipse a peak
        // is drawn on, rather than left to `radius` and `girth` to arrive at.
        // Each is switched on by itself, and off each gives way to what was
        // always there: `width` to `radius`, and `length` to `radius` stretched
        // by `girth`. So a peak is round, stretched by a random amount, or
        // exactly the footprint it was asked for, and the first two are what
        // the simulator has always drawn.
        length: gated(100, 7000, 900, 2400),
        width:  gated(100, 3000, 400, 1100),
        // The footprint randomized at once: the mode that says "randomize the
        // lot within the bounds they declare" instead of asking for the
        // switches to be found and thrown.
        //
        // It reads `length` and `width` as on without writing to them, so
        // turning it off puts the element back on whatever each switch was left
        // saying rather than on what the mode did to them. Two rather than
        // three, and `girthRange` is the one left alone: under the mode
        // `length` holds the long axis, so a girth - either form of it - has
        // nothing left to decide either way. That is the precedence already in
        // force rather than a rule the mode invents, and it is the same answer
        // a pilot gets from setting a length and a girth by hand.
        //
        // The rotation the mode is named for is already applied to every peak
        // and always has been, so this does not switch it on - it is the half
        // of the mode that was there before the mode was.
        bulk: toggle()
    },

    generate(field, config, random) {
        const peaks = mountainPeaks(field, config, random);
        // A peak dropped at a point is measured to the nearest repeat of the
        // square, so one dropped near an edge carries on across the seam into
        // the next tile rather than stopping at it.
        const wrap  = config.at ? field.size : 0;

        for (let i = 0; i < field.count; i++) {
            const x = fieldX(field, i);
            const z = fieldZ(field, i);

            let added = 0;
            for (const m of peaks) {
                added += mountainBump(
                    ellipticalDistance(wrapOffset(x - m.x, wrap), wrapOffset(z - m.z, wrap), m.angle, m.stretch),
                    m.radius,
                    m.peak
                );
            }

            if (added > 0) field.height[i] += added;
        }

        return peaks.length;
    }
};

/**
 * The peaks a mountain lays out on a field: where each stands, the radius and
 * stretch of the ellipse it is drawn on, the angle that ellipse is turned to,
 * and how high it stands. The mountain's generator draws its bumps from these,
 * and a pick reads them back to find a placed mountain under the pointer - the
 * ground has no mountain in it to hit, only height, so the peaks are worked
 * out again from the same configuration and the same stream.
 *
 * Takes from `random` exactly what the generator does, six draws a peak, so a
 * caller handed a placement's own stream reads the peaks that placement drew.
 */
export function mountainPeaks(field, config, random) {
    // A mountain dropped at a point is one peak standing on it: the click
    // said where and how many, so the count is not read.
    const at     = config.at ?? null;
    const total  = at ? 1 : config.count > 0 ? Math.round(config.count) : mountainCount(field.size);
    const half   = field.size / 2 - field.size * 0.10;
    const peaks  = [];

    // The bulk mode read once rather than per peak, and as the two answers
    // it gives rather than as itself, so the loop below reads one question
    // per axis whichever way the mode is set. The third question is asked
    // of `girthRange` alone: the mode reaches the two axes said outright,
    // and under it `long` is already true, so there is no girth left to
    // draw whatever that switch says.
    const wide    = config.bulk || config.width.on;
    const long    = config.bulk || config.length.on;
    const stretch = config.girthRange.on;

    for (let i = 0; i < total; i++) {
        // Every value is drawn in the order it has always been drawn in,
        // and each gate spends exactly the one draw the value it replaces
        // spent: a gated range is read with `pick` where `radius` was read
        // with `pick`, and in place of the single `random()` the girth
        // stretch took. So turning a gate on changes that peak's footprint
        // and nothing else about the world - every peak after it stands
        // where it stood, because the stream it is laid out from is the
        // same length whichever way the gates are set.
        //
        // Six draws a peak, and the bulk mode is no exception: it answers
        // two of the three questions below rather than adding a question
        // of its own, so a world laid in the mode has its peaks in the same
        // places as the same world laid out of it.
        //
        // A peak dropped at a point spends the two draws its place would
        // have taken and stands where it was dropped, so it takes from the
        // stream exactly what a peak laid out of it does.
        const drawnX = field.originX + (random() * 2 - 1) * half;
        const drawnZ = field.originZ + (random() * 2 - 1) * half;
        const x = at ? field.originX + at[0] : drawnX;
        const z = at ? field.originZ + at[1] : drawnZ;

        // The footprint, as the two axes of the ellipse the bump is drawn
        // on. Held as a radius and a stretch rather than as the pair,
        // because that is what `ellipticalDistance` measures with, and
        // because an ungated peak then works out to the exact peak it
        // always was rather than one that rounds to it.
        const across = wide
            ? pick(random, config.width.range)
            : pick(random, config.radius);

        const peak  = pick(random, config.height);
        const angle = random() * Math.PI * 2;

        // Three ways to the long axis and one draw whichever is taken: the
        // length asked for outright, a girth drawn out of its own bounds,
        // or the single girth stretched by the generator's own spread.
        // The order is what gives a range said outright the last word over
        // one the generator is working out for itself.
        const along = long
            ? pick(random, config.length.range)
            : across * (1 + (stretch
                ? pick(random, config.girthRange.range)
                : config.girth * (0.4 + random())));

        peaks.push({ x, z, radius: across, peak, angle, stretch: along / across });
    }

    return peaks;
}

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
        const centerX = field.originX + (random() * 2 - 1) * drift;
        const centerZ = field.originZ + (random() * 2 - 1) * drift;
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

/**
 * How wide a clump of a ground cover laid at part density is, roughly, in
 * world units: the size of the noise its coverage is drawn through. A few
 * cells of the default sampling across, so a clump reads as a clump rather
 * than as speckle.
 */
export const CLUMP_SIZE = 520;

/**
 * The noise the clumps are drawn through, at each tenth of the way through
 * its values: where 10%, 20% and so on of the ground falls below. A density
 * is turned into a threshold through these, so at 0.5 half of a stroke is
 * covered and at 0.9 nine tenths of it, rather than whatever share of the
 * ground the noise's own bunching about its middle happened to put under the
 * figure. Measured off `clumpNoise` across a canvas.
 */
export const CLUMP_DECILES = Object.freeze([0, 0.313, 0.372, 0.417, 0.457, 0.496, 0.535, 0.574, 0.62, 0.681, 1]);

/** How soft a clump's edge is, in the noise's own units: eased across this, rather than cut. */
const CLUMP_EDGE = 0.05;

/**
 * How much of a ground cover lies at a vertex, from its `density`: all of it
 * at 1, none at 0, and between them clumps - where a noise value falls under
 * the threshold the density comes to, eased across a soft edge.
 *
 * The noise is keyed on the **canvas's** coordinates, the vertex's place with
 * the tile's origin taken off, rather than on the seeded stream: drawn from
 * the stream, the clumps would rearrange themselves every time a tile was
 * drawn again, and grass that moves when the aircraft flies back over it is
 * grass the pilot notices. And it repeats a field's width apart, as the canvas
 * does, so a clump drawn over a seam carries on across it.
 *
 * At a density of 1 - every preset's - it is exactly 1 without the noise
 * being asked, so the ground every world was drawn with is unchanged.
 */
export function coverAt(field, index, density = 1) {
    if (!(density < 1)) return 1;
    if (!(density > 0)) return 0;

    const cells = Math.max(1, Math.round(field.size / CLUMP_SIZE));
    const u = ((fieldX(field, index) - field.originX) / field.size + 0.5) * cells;
    const v = ((fieldZ(field, index) - field.originZ) / field.size + 0.5) * cells;
    return smoothstep((clumpThreshold(density) - clumpNoise(u, v, cells)) / CLUMP_EDGE + 0.5);
}

/** The noise value a density keeps the ground under, read off the deciles. */
function clumpThreshold(density) {
    const at = clamp(density, 0, 1) * 10;
    const below = Math.min(Math.floor(at), 9);
    return CLUMP_DECILES[below] + (CLUMP_DECILES[below + 1] - CLUMP_DECILES[below]) * (at - below);
}

/**
 * Three octaves of value noise over a lattice that repeats every `cells`
 * cells, so the noise at one edge of the canvas is the noise at the other.
 * Exported so its deciles can be measured.
 */
export function clumpNoise(u, v, cells) {
    let total = 0, amp = 0.5, weight = 0, freq = 1;
    for (let octave = 0; octave < 3; octave++) {
        total  += amp * tiledValueNoise(u * freq, v * freq, cells * freq);
        weight += amp;
        amp  *= 0.5;
        freq *= 2;
    }
    return total / weight;
}

/** Value noise whose lattice wraps every `period` cells. */
function tiledValueNoise(u, v, period) {
    const iu = Math.floor(u), iv = Math.floor(v);
    const fu = smoothstep(u - iu), fv = smoothstep(v - iv);
    const at = (i, j) => hash(wrapCell(i, period), wrapCell(j, period));
    const a = at(iu, iv), b = at(iu + 1, iv);
    const c = at(iu, iv + 1), d = at(iu + 1, iv + 1);
    return a + (b - a) * fu + (c - a) * fv + (a - b - c + d) * fu * fv;
}

function wrapCell(i, period) {
    return ((i % period) + period) % period;
}

/**
 * A colour laid over a vertex as far as a cover reaches it: painted outright
 * where it lies whole, which is every preset's case, and mixed over what is
 * there where it lies in part.
 */
function layColor(field, index, color, cover) {
    if (cover >= 1) paint(field, index, color);
    else mixColor(field, index, color, cover);
}

/**
 * The ranges a ground cover drawn through a footprint has settled for it on
 * each tile, rather than by the pilot: a cover's band, which is the ground's
 * own relief under the stroke. See `settleFromFootprint` in `footprinted.js`.
 */
const SETTLED_BAND = Object.freeze({ band: 'relief' });

const grass = {
    id: 'grass',
    label: 'Grass',
    ranges: {
        color:   gradient([0.36, 0.55, 0.16], [0.16, 0.31, 0.10]),
        band:    span(0, 2000, 12, 130),
        // How much of the ground it reaches it covers: a mat at 1, clumps
        // with ground between them below.
        density: scalar(0, 1, 1)
    },
    footprintSettles: SETTLED_BAND,

    generate(field, config) {
        return paintBand(field, config.band, config.color, config.density);
    }
};

const sand = {
    id: 'sand',
    label: 'Sand',
    ranges: {
        color:   gradient([0.85, 0.77, 0.55], [0.60, 0.51, 0.33]),
        band:    span(0, 2000, 4, 12),
        density: scalar(0, 1, 1)
    },
    footprintSettles: SETTLED_BAND,

    generate(field, config) {
        return paintBand(field, config.band, config.color, config.density);
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
        flatten: scalar(0, 1, 1),
        // How much of what is under the level the water reaches: a sheet at 1,
        // pools with ground between them below - a marsh.
        density: scalar(0, 1, 1)
    },
    // Drawn through a footprint of its own, water rests at a line the ground
    // under the stroke settles - see `waterLine` in `footprinted.js` - and
    // not at the sea's level, which it never moves; and it is always a sheet.
    footprintSettles: Object.freeze({ drawn: 'waterLine' }),
    footprintIgnores: Object.freeze(['level', 'flatten']),

    generate(field, config) {
        const drawn = drawnValues(config, 'line', field);
        if (drawn) return drawWater(field, config, drawn, drawnValues(config, 'inward', field));

        const { level, flatten, color, density } = config;
        let covered = 0;

        // The surface is left on the field rather than only in the heights, so
        // a renderer can move the water it is drawing without having to work
        // out from the ground alone which of it was water. The sea writes its
        // level into the line everywhere it reaches - which is every vertex
        // but the ground its density left dry - so ground cut below the level
        // after the sea went in is water, as it has always been.
        const record = waterRecord(field);
        record.level = Math.max(level, Number.isFinite(record.level) ? record.level : -Infinity);

        for (let i = 0; i < field.count; i++) {
            const h = field.height[i];
            if (h >= level) {
                raiseLine(record.line, i, level);
                continue;
            }

            const cover = coverAt(field, i, density);
            if (cover <= 0) continue;

            // Deep water is the dark end of the base hue, a shoreline the pale
            // end, so the drop-off reads without a second colour.
            const depth = level <= 0 ? 0 : (level - h) / level;
            layColor(field, i, blend(color, depth), cover);
            field.height[i] = h + (level - h) * flatten * cover;
            raiseLine(record.line, i, level);
            covered++;
        }

        return covered;
    }
};

/**
 * A field's water record with its line, made where it has none: dry - no sea,
 * and no line anywhere - for a field with no water, and the sea's level
 * everywhere for a record that carries a level and no line.
 */
export function waterRecord(field) {
    field.water ??= { level: null, line: null };
    field.water.line ??= new Float32Array(field.count).fill(Number.isFinite(field.water.level) ? field.water.level : NaN);
    return field.water;
}

/** A vertex's line raised to `height`, or set to it where the vertex was dry. */
function raiseLine(line, index, height) {
    line[index] = Number.isFinite(line[index]) ? Math.max(line[index], height) : height;
}

/**
 * Water drawn where a stroke went: cut into the ground to the line the ground
 * under the stroke settled at each vertex, never raised to it, so it lies in
 * the ground as water does rather than as a sheet propped over it; coloured by
 * how far in from its bank a vertex is, pale at the shore and dark in the
 * middle, across its own width; and written into the field's line where it
 * was drawn and nowhere else, leaving the sea's level as it was. Below full
 * density it is pools: where the noise says dry there is no line, and the
 * ground is not cut.
 */
function drawWater(field, { color, density }, line, inward) {
    const record = waterRecord(field);
    let covered = 0;

    for (let i = 0; i < field.count; i++) {
        const at = line[i];
        if (!Number.isFinite(at)) continue;

        const cover = coverAt(field, i, density);
        if (cover <= 0) continue;

        const h = field.height[i];
        field.height[i] = h + (Math.min(at, h) - h) * cover;
        layColor(field, i, blend(color, inward ? inward[i] : 1), cover);
        raiseLine(record.line, i, at);
        covered++;
    }

    return covered;
}

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
                x: field.originX + (random() * 2 - 1) * half,
                z: field.originZ + (random() * 2 - 1) * half,
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
        const centerX = field.originX + (random() * 2 - 1) * half;
        const centerZ = field.originZ + (random() * 2 - 1) * half;
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
        color:    gradient([1, 1, 1], [0.70, 0.74, 0.84]),
        // Whether snow lies at a point at all, where `coverage` is how thickly
        // it lies wherever it does: every point at 1, drifts below.
        density:  scalar(0, 1, 1)
    },
    // Drawn through a footprint of its own, snow's line is put just under the
    // stroke's lowest ground, so nothing in it is turned away for lying low,
    // and how deep it lies comes from how far in from the stroke's edge a
    // vertex is rather than from how far above the line: thin and shadowed at
    // the edge, white in the middle, on any ground.
    footprintSettles: Object.freeze({ line: 'lowest', drawn: 'inward' }),

    generate(field, config) {
        const band = Math.max(1, config.line * 0.35);
        const inward = drawnValues(config, 'inward', field);
        let settled = 0;

        for (let i = 0; i < field.count; i++) {
            const above = (field.height[i] - config.line) / band;
            if (above <= 0) continue;

            const deep  = inward ? inward[i] : smoothstep(Math.min(above, 1));
            const depth = deep * config.coverage;
            const grip  = config.slope <= 0 ? 0 : 1 - smoothstep(slopeAt(field, i) / config.slope);
            const held  = depth * grip * coverAt(field, i, config.density);
            if (held <= 0) continue;

            mixColor(field, i, blend(config.color, 1 - depth), held);
            settled++;
        }

        return settled;
    }
};

/**
 * Free paint: a colour laid over the ground, and nothing else - no height is
 * written, so a stroke of it is the ground it was laid on in another colour
 * rather than a decal standing over that ground, and there is nothing that
 * could float.
 *
 * It paints the whole field; what keeps a stroke a stroke is the footprint it
 * is drawn through, which feathers it into the ground at its edge.
 */
const freePaint = {
    id: 'paint',
    label: 'Paint',
    ranges: {
        color:   color([0, 0, 0]),
        opacity: scalar(0, 1, 1, { percent: true }),
        // How the colour meets the ground: `tint` takes the colour's hue at
        // the ground's own lightness - see `tintColor` - and `normal` lays the
        // colour as it is, for the times a flat patch is what is wanted: a
        // black that is black, or an apron in the strip's own grey.
        blend:   choice(['tint', 'normal'], 'tint')
    },

    generate(field, config) {
        if (!(config.opacity > 0)) return 0;
        const tint = config.blend === 'tint';

        for (let i = 0; i < field.count; i++) {
            mixColor(field, i, tint ? tintColor(readColor(field, i), config.color) : config.color, config.opacity);
        }
        return field.count;
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

// And what a unit inside another strip's stand-off costs. Steeper than the
// band's, because a second strip landing on the first is a world the mode
// cannot be played in at all, while a strip a little outside its height band is
// only a harder approach.
const RUNWAY_CROWDING_PENALTY = 12;

// Where the paint goes, as fractions of the half width and the half length: a
// stripe down each shoulder, and a bar across each threshold.
const RUNWAY_SHOULDER  = 0.78;
const RUNWAY_THRESHOLD = 0.9;

// The centreline a strip carries when asked: its half-width as a share of the
// strip's, and the length of each dash and each gap between them.
const RUNWAY_CENTRELINE = 0.04;
const RUNWAY_DASH       = 300;

// How far a strip is lifted clear of a water line it would otherwise be cut
// under, in world units. Small on purpose: enough that the surface is not drawn
// over the paving, and little enough that the apron eases into the shore rather
// than standing the strip on a plinth.
export const RUNWAY_FREEBOARD = 2;

/**
 * The elements a strip was cut clear of, and the ground it was cut to.
 *
 * The strip is applied last, over whatever else claimed the ground, and
 * levelling that ground is enough for everything that is drawn as a height: a
 * grove, a town, a dune all go under the grader. The one thing that does not is
 * a surface read back off the finished field afterwards - the water, which is
 * the vertices lying under its own line rather than the heights it wrote. A
 * strip graded at or below that line comes back out of the field as water, and
 * a flight starts from the bottom of a lake.
 *
 * So the strip is moved clear of it instead: cut above the line rather than
 * left to be drawn under it. A runway is the one surface a flight depends on
 * existing, so it is the one piece of ground an element may not be placed onto.
 * What it was moved clear of is carried on the strip, because a panel that let
 * an element onto the runway has to be able to say which one.
 */
export function clearRunwayGround(field, elevation, strip = null) {
    const line = waterUnder(field, strip);
    if (!Number.isFinite(line) || elevation > line) return { elevation, cleared: [] };

    return { elevation: line + RUNWAY_FREEBOARD, cleared: ['water'] };
}

/**
 * The highest water a strip would lie in: the sea's level, and - given where
 * the strip lies - the highest line of any water drawn under it, so a strip
 * laid across a pond drawn on a hill is lifted clear of the pond rather than
 * of a sea a long way below it. -Infinity where there is no water at all.
 */
function waterUnder(field, strip) {
    const record = field.water;
    let highest = Number.isFinite(record?.level) ? record.level : -Infinity;
    const line = record?.line;
    if (line == null || strip == null) return highest;

    // A strip handed in by its bearing alone is given the axis it runs along.
    const laid = Number.isFinite(strip.alongX) ? strip : { ...strip, ...runwayDirection(Number(strip.heading) || 0) };
    for (let i = 0; i < field.count; i++) {
        if (!(line[i] > highest)) continue;
        if (isOnRunway(laid, fieldX(field, i), fieldZ(field, i))) highest = line[i];
    }
    return highest;
}

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
        // How far this strip has to stand off any strip already laid in the
        // same world, in world units. Zero is no rule at all, which is the
        // case every world with one strip in it is, and is why a world that
        // never asks for a second strip is laid exactly as it always was.
        separation: scalar(0, 12000, 0),
        color: gradient([0.32, 0.32, 0.34], [0.11, 0.11, 0.13]),
        mark:  gradient([0.95, 0.95, 0.92], [0.70, 0.72, 0.70]),
        // A dashed line down the middle of the strip, which a commercial strip
        // carries. Off by default, so every preset's strip is the one it was.
        centreline: toggle(false)
    },

    generate(field, config, random) {
        if (config.at) return placeStrip(field, config);

        const length = pick(random, config.length);
        const width  = pick(random, config.width);
        const site   = chooseRunwaySite(field, config, length, width, random);
        if (!site) return null;

        // The strips of a world are an ordered list, and a mode that asks a
        // pilot to land at one and then at the next needs to be able to say
        // which is which. The number is the order they were laid in, which is
        // the order the placements ask for them.
        const index = field.runways.length;
        const strip = { ...site, ...clearRunwayGround(field, site.elevation, { ...site, length, width }), length, width, index };
        gradeRunway(field, strip, config);
        field.runways.push(strip);
        return strip;
    }
};

/**
 * A strip placed where it was asked for rather than where the site search
 * found room: centred on `at`, in the square's own frame like a dropped
 * mountain's, and laid along the bearing its `heading` names - the low end of
 * the span, which a placed strip writes as the one number it is. Its length and
 * width are the low ends of theirs the same way.
 *
 * Its height is measured under its own footprint on the tile it lands on, as
 * the search measures a site, because the built tile is a pattern and every
 * copy of the strip sits on different ground; it is lifted clear of any water
 * under it, the sea's or a drawn body's. `band` and `separation` are the
 * search's rules and are not consulted: a pilot who puts a strip on a ridge
 * gets a strip on a ridge. It takes nothing from the seeded stream, so placing
 * one moves nothing else in the world.
 *
 * Recorded `placed`, which is what puts a flight that starts on a runway on it
 * rather than on the strip the search found - see `getRunway` in
 * `js/terrain.js`.
 */
function placeStrip(field, config) {
    const [x, z] = config.at;
    const length = config.length[0];
    const width  = config.width[0];
    const heading = config.heading[0];
    const site = { x: field.originX + x, z: field.originZ + z, heading, ...runwayDirection(heading) };

    const elevation = measureRunwayGround(field, site, length, width).mean;
    const index = field.runways.length;
    const strip = {
        ...site, ...clearRunwayGround(field, elevation, { ...site, length, width }),
        length, width, index, placed: true
    };
    gradeRunway(field, strip, config);
    field.runways.push(strip);
    return strip;
}

// --- Reading a strip ------------------------------------------------------

/**
 * The strip a flight that starts on a runway opens on, of a world's strips:
 * the last one the pilot placed, when there is one - the order a pilot builds
 * a runway and then resets the flight to fly it - and otherwise the first,
 * which is the strip the site search found. Null for a world with none.
 */
export function flightStrip(strips = []) {
    return strips.findLast(strip => strip?.placed === true) ?? strips[0] ?? null;
}

/**
 * The unit vector a strip runs along, from the bearing it was laid on. North is
 * the world's +Z axis, which is the same north the compass card counts from, so
 * a strip on 000 runs the way a flight starting on 000 is already pointing -
 * and a strip on any other bearing runs the way a flight on that bearing is
 * pointing, which is what `bearingToDirection` is for. The frame lives in
 * `js/units.js` beside `headingToYaw` rather than being written out again here,
 * because the two have to agree for a landing to line up on the strip it is
 * scored against.
 */
export function runwayDirection(heading) {
    const { x, z } = bearingToDirection(heading);
    return { alongX: x, alongZ: z };
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

// --- Tiles and their seams ------------------------------------------------

/**
 * How far a correction at a seam is eased back into the ground either side of
 * it, in vertices. Wide enough that a join is a slope rather than a step, and
 * narrow enough that what an element drew a tile in from the edge is left
 * alone.
 */
export const SEAM_BLEND = 3;

/**
 * The four sides of a tile, each read off a vertex's index: the line it lies on
 * along that side, and how far in from that side it is.
 */
const SEAM_SIDES = [
    { id: 'minX', line: (field, i) => Math.floor(i / field.stride), depth: (field, i) => i % field.stride },
    { id: 'maxX', line: (field, i) => Math.floor(i / field.stride), depth: (field, i) => field.stride - 1 - i % field.stride },
    { id: 'minZ', line: (field, i) => i % field.stride, depth: (field, i) => Math.floor(i / field.stride) },
    { id: 'maxZ', line: (field, i) => i % field.stride, depth: (field, i) => field.stride - 1 - Math.floor(i / field.stride) }
];

// What a seam carries per vertex: the height, and the three channels of the
// colour, which is the whole of what a tile shows at its edge.
const SEAM_CHANNELS = 4;

/**
 * Matches an assembly of fields to each other everywhere they meet.
 *
 * The ground a tile is shaped on already runs on across a join, because it is
 * noise read off the world rather than off the tile. What does not is what the
 * elements drew: a peak that ended at one tile's edge knows nothing about the
 * ground its neighbour laid against it. So every place two or more tiles put a
 * vertex is settled on one height and one colour - the average of what they all
 * had there - and each tile is walked back to what it was over the next few
 * vertices in, which leaves the join seamless without flattening the country
 * behind it.
 *
 * A vertex where four tiles meet is matched once, against all four, rather than
 * twice against two of them, so a corner closes as cleanly as an edge does.
 *
 * Every field is read before any is written, so no tile is matched against
 * ground another match has already moved. Running it twice changes nothing the
 * first run did not: fields that already agree have nothing to average.
 *
 * Returns how many shared vertices were settled.
 */
export function matchEdges(fields = [], { blend = SEAM_BLEND } = {}) {
    const tiles = fields.filter(field => field && field.count > 0);
    if (tiles.length < 2) return 0;

    const ease = Math.max(1, Math.round(blend));
    const shared = new Map();

    for (const field of tiles) {
        for (const index of boundaryIndices(field)) {
            const key = `${seamKey(fieldX(field, index))}|${seamKey(fieldZ(field, index))}`;
            const standing = shared.get(key);
            if (standing) standing.push({ field, index });
            else shared.set(key, [{ field, index }]);
        }
    }

    const corrections = new Map(tiles.map(field => [field, seamCorrections(field)]));
    let matched = 0;

    for (const group of shared.values()) {
        if (group.length < 2) continue;
        matched++;

        const target = averageVertex(group);
        for (const { field, index } of group) {
            recordSeam(corrections.get(field), field, index, target);
        }
    }

    // Each tile keeps the vertices its own correction reached, because the
    // renderer has to draw that tile again and would otherwise light all 201 by
    // 201 vertices of it to find the three the join moved.
    if (matched > 0) {
        for (const field of tiles) field.seam = applySeams(field, corrections.get(field), ease);
    }

    return matched;
}

/** Every vertex on the outside of a field, which is all a neighbour can touch. */
function boundaryIndices(field) {
    const found = [];
    for (let i = 0; i < field.count; i++) if (onBoundary(field, i)) found.push(i);
    return found;
}

/** Whether a vertex is on the outside of a field. */
function onBoundary(field, index) {
    const { stride } = field;
    const col = index % stride;
    const row = Math.floor(index / stride);

    return col === 0 || col === stride - 1 || row === 0 || row === stride - 1;
}

/**
 * Where a vertex stands, as a key two tiles agree on. Rounded, because two
 * tiles reach the same place by different arithmetic and a join should not turn
 * on the last bit of a float.
 */
function seamKey(value) {
    return Math.round(value * 1000) / 1000;
}

function seamCorrections(field) {
    const lines = {};
    for (const side of SEAM_SIDES) {
        lines[side.id] = {
            held: new Uint8Array(field.stride),
            delta: new Float32Array(field.stride * SEAM_CHANNELS)
        };
    }
    return lines;
}

/** The one height and colour a place several tiles all reach should hold. */
function averageVertex(group) {
    const values = new Float32Array(SEAM_CHANNELS);

    for (const { field, index } of group) {
        values[0] += field.height[index];
        for (let c = 0; c < 3; c++) values[c + 1] += field.color[index * 3 + c];
    }

    for (let c = 0; c < SEAM_CHANNELS; c++) values[c] /= group.length;
    return values;
}

/** What one tile has to move to reach the settled value, on every side it is on. */
function recordSeam(corrections, field, index, target) {
    for (const side of SEAM_SIDES) {
        if (side.depth(field, index) !== 0) continue;

        const line = corrections[side.id];
        const at = side.line(field, index) * SEAM_CHANNELS;

        line.held[side.line(field, index)] = 1;
        line.delta[at] = target[0] - field.height[index];
        for (let c = 0; c < 3; c++) {
            line.delta[at + 1 + c] = target[c + 1] - field.color[index * 3 + c];
        }
    }
}

/**
 * Eases each side's corrections back into the tile.
 *
 * A vertex takes the correction of the seam it is nearest, worn down by how far
 * in from that seam it is: all of it on the join, none of it a few vertices
 * back. A vertex near two seams at once - the corner of an assembly - takes what
 * both of them are asking for, weighted by how near it is to each, and wears the
 * result down by whichever of the two it is nearer. On the corner itself both
 * seams are asking for the same thing at full strength, which is what makes a
 * corner close as exactly as an edge does.
 *
 * Returns which vertices it moved, as a flag each. Recorded while the pass is
 * running rather than worked out from the sides afterwards: a side's correction
 * is held per line, so the vertices it reaches are a band down part of a side
 * rather than the whole of one, and the only place that is known exactly is
 * here.
 */
function applySeams(field, corrections, ease) {
    const moved = new Uint8Array(field.count);

    for (let i = 0; i < field.count; i++) {
        let weight = 0;
        let nearest = 0;
        let height = 0;
        const color = [0, 0, 0];

        for (const side of SEAM_SIDES) {
            const depth = side.depth(field, i);
            if (depth >= ease) continue;

            const line = corrections[side.id];
            const on = side.line(field, i);
            if (!line.held[on]) continue;

            const share = 1 - depth / ease;
            const at = on * SEAM_CHANNELS;

            weight += share;
            nearest = Math.max(nearest, share);
            height += line.delta[at] * share;
            for (let c = 0; c < 3; c++) color[c] += line.delta[at + 1 + c] * share;
        }

        if (weight <= 0) continue;

        const eased = nearest / weight;
        field.height[i] += height * eased;
        for (let c = 0; c < 3; c++) field.color[i * 3 + c] += color[c] * eased;
        moved[i] = 1;
    }

    return moved;
}

/**
 * The vertices the last join moved, as a flag each, or null for a field nothing
 * has been settled against - which is a field drawn whole.
 *
 * A renderer reads this to light the strip of a tile a join moved rather than
 * the whole plane of it. A tile is 201 by 201 vertices and a join moves three
 * in from an edge, so the difference is the cost of generating a tile against
 * the cost of redrawing a band of one.
 */
export function seamBand(field) {
    const moved = field?.seam;
    return moved && moved.length === field.count ? moved : null;
}

// --- The water surface ----------------------------------------------------

/**
 * The water a world settled with, as the vertices lying at or under the level
 * it was laid at, with the height and colour each of them rests at and how far
 * out from the bank it is.
 *
 * Read off the finished field rather than recorded while it was being drawn, so
 * ground that was claimed back after the water went down - a strip graded over
 * a shallow, a town levelled onto a shore - is not still being moved as though
 * it were water. A world with no water in it has no surface at all.
 */
export function waterSurface(field) {
    const level = Number.isFinite(field.water?.level) ? field.water.level : null;
    const line  = field.water?.line ?? null;

    // A tile with drawn water and no sea has a line and no level, so the line
    // is looked for before a tile is called dry. A line of NaN is under
    // nothing, so a vertex is wet only where some water reached it.
    if (line == null && level == null) return null;

    const found = [];
    for (let i = 0; i < field.count; i++) {
        if (field.height[i] <= (line ? line[i] : level)) found.push(i);
    }
    if (found.length === 0) return null;

    const count = found.length;
    const wet = new Uint8Array(field.count);
    for (const index of found) wet[index] = 1;

    const surface = {
        level,
        count,
        vertices: Int32Array.from(found),
        x:     new Float32Array(count),
        z:     new Float32Array(count),
        rest:  new Float32Array(count),
        color: new Float32Array(count * 3),
        open:  new Float32Array(count),
        // Which of them lie on the outside of the field, which is the only
        // water a tile can share with the tile laid beside it. Recorded here
        // rather than worked out again, so settling an assembly reads the
        // vertices of a join instead of every vertex under the level.
        edge: null,
        // What this tile alone makes of how open each of those places is,
        // recorded once and never written after. `open` is what the water is
        // drawn with and what `matchWater` settles; this is what it settles
        // *from*, so a place comes out at what the tiles sharing it make of it
        // between them however the block around it was assembled. Settling
        // from `open` would read a value an earlier pass had already settled
        // and weight whichever tile was laid first.
        alone: null
    };

    const rim = [];
    for (let i = 0; i < count; i++) {
        const index = surface.vertices[i];
        surface.x[i]    = fieldX(field, index);
        surface.z[i]    = fieldZ(field, index);
        surface.rest[i] = field.height[index];
        surface.open[i] = openness(field, wet, index);
        for (let c = 0; c < 3; c++) surface.color[i * 3 + c] = field.color[index * 3 + c];
        if (onBoundary(field, index)) rim.push(i);
    }
    surface.edge = Int32Array.from(rim);

    // One smoothing pass over the shoreline, so the water eases up to the bank
    // across a couple of vertices rather than dropping to nothing at the last
    // one. Read off the first pass and written after it, so a vertex is eased
    // against what its neighbours were rather than against what they became.
    const slot = new Int32Array(field.count).fill(-1);
    for (let i = 0; i < count; i++) slot[surface.vertices[i]] = i;

    const eased = new Float32Array(count);
    for (let i = 0; i < count; i++) {
        let total = surface.open[i];
        let counted = 1;

        for (const at of neighboursOf(field, surface.vertices[i])) {
            if (at < 0 || slot[at] < 0) continue;
            total += surface.open[slot[at]];
            counted++;
        }

        eased[i] = total / counted;
    }
    surface.open.set(eased);

    // Taken after the easing pass, so what a join settles from is the openness
    // this tile would have drawn the place with and not a reading from part way
    // through working it out.
    surface.alone = Float32Array.from(surface.open);

    return surface;
}

/**
 * Settles an assembly's water everywhere two or more of its tiles call the same
 * place water, which is the other half of what `matchEdges` does for the land.
 *
 * The ground either side of a join already meets exactly, and the water resting
 * on it is read off that settled ground - so the height it rests at and the
 * colour it is painted agree to the last bit. What does not agree is `open`:
 * `openness` counts a water vertex's four neighbours and takes the one off the
 * field as water, which keeps each tile from drawing a shoreline down the join,
 * but the neighbour that is *on* the field is a different vertex on each side of
 * the line. `animateWater` multiplies both the swell and the glint by it, so the
 * same place rides a different wave and throws back a different amount of light
 * depending on which tile drew it.
 *
 * Takes the surfaces rather than the fields, keyed by the rounded position
 * `matchEdges` keys a vertex by, so the two passes agree on what counts as the
 * same place. A vertex only one tile calls water is left exactly as it is:
 * averaging it against a tile that calls it land would move the bank.
 *
 * Settles from `alone` and writes `open`, which is what makes the value a place
 * comes out at independent of the order the ground was laid in. A world is not
 * settled once - it is laid a tile at a time, and a tile laid later moves a
 * neighbour's ground, has that neighbour's surface read off it again, and
 * settles the join a second time - so a pass that averaged `open` would be
 * averaging a fresh reading against one an earlier pass had already settled,
 * and would weight whichever tile was laid first. `alone` is written once by
 * `waterSurface` and never after, so every pass over a place averages the same
 * numbers and arrives at the same answer.
 *
 * Returns how many shared vertices were settled.
 */
export function matchWater(surfaces = []) {
    const wet = surfaces.filter(surface =>
        surface && surface.count > 0 && surface.edge && surface.alone);
    if (wet.length < 2) return 0;

    const shared = new Map();
    for (const surface of wet) {
        for (const i of surface.edge) {
            const key = `${seamKey(surface.x[i])}|${seamKey(surface.z[i])}`;
            const standing = shared.get(key);
            if (standing) standing.push({ surface, i });
            else shared.set(key, [{ surface, i }]);
        }
    }

    let matched = 0;
    for (const group of shared.values()) {
        if (group.length < 2) continue;
        matched++;

        // Settled as each group is read rather than after all of them, which is
        // safe here where it is not in `matchEdges`: the pass reads `alone` and
        // writes `open`, so nothing written here is a value any group has still
        // to read - and a vertex stands in one place and so belongs to one
        // group in any case.
        let total = 0;
        for (const { surface, i } of group) total += surface.alone[i];

        const open = total / group.length;
        for (const { surface, i } of group) surface.open[i] = open;
    }

    return matched;
}

/** The four vertices around one, with -1 where the field runs out. */
function neighboursOf(field, index) {
    const { stride } = field;
    const col = index % stride;
    const row = Math.floor(index / stride);

    return [
        col > 0 ? index - 1 : -1,
        col < stride - 1 ? index + 1 : -1,
        row > 0 ? index - stride : -1,
        row < stride - 1 ? index + stride : -1
    ];
}

/**
 * How far from the bank a water vertex is: nothing at a vertex with dry ground
 * beside it, and all of it out in open water. The water is held to the bank it
 * meets, which is what keeps a wave from lapping over the shoreline.
 */
function openness(field, wet, index) {
    const neighbours = neighboursOf(field, index);

    let open = 0;
    for (const at of neighbours) {
        // The edge of the field reads as more water rather than as a bank, so
        // an assembly's tiles do not each draw a shoreline down their join.
        if (at < 0 || wet[at]) open++;
    }

    return open / neighbours.length;
}

// --- The registry ---------------------------------------------------------

export const ELEMENTS = [
    mountain, canyon, desert, grass, sand, water, river, forest, town, snow, freePaint, runway
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

/**
 * How far a point is from a peak's middle, measured on the ellipse the peak is
 * drawn on: 1 radius along its turned long axis is `stretch` radii out. A
 * mountain's bump and a pick of it both measure with this, so the ground a
 * pick finds a mountain on is the ground the mountain raised.
 */
export function ellipticalDistance(dx, dz, angle, stretch) {
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
        // The course is laid out in the tile's own coordinates and set down in
        // the world's, so a river runs the width of the tile it was drawn for
        // wherever that tile was laid.
        path.push(alongX
            ? { x: field.originX + along,  z: field.originZ + across }
            : { x: field.originX + across, z: field.originZ + along });
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
            x: clamp(origin.x + (cos * t * reach) - sin * wander,
                     field.originX - half, field.originX + half),
            z: clamp(origin.z + (sin * t * reach) + cos * wander,
                     field.originZ - half, field.originZ + half)
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

function paintBand(field, [low, high], color, density = 1) {
    const range = Math.max(high - low, 1e-6);
    let painted = 0;

    for (let i = 0; i < field.count; i++) {
        const h = field.height[i];
        if (h < low || h > high) continue;

        const cover = coverAt(field, i, density);
        if (cover <= 0) continue;
        layColor(field, i, blend(color, (h - low) / range), cover);
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
 * has instead of getting no runway at all. A site too near a strip already laid
 * is charged the same way and for the same reason - a world that asks for two
 * strips gets two however tight the ground is, rather than getting one and a
 * failure.
 */
function chooseRunwaySite(field, config, length, width, random) {
    const reach = field.size / 2 - length / 2 - field.step * 2;
    if (reach <= 0) return null;

    const [floor, ceiling] = config.band;
    let best = null;

    for (let i = 0; i < RUNWAY_SITES; i++) {
        const heading = pick(random, config.heading);
        const site = {
            x: field.originX + (random() * 2 - 1) * reach,
            z: field.originZ + (random() * 2 - 1) * reach,
            heading,
            ...runwayDirection(heading)
        };

        const ground  = measureRunwayGround(field, site, length, width);
        const outside = Math.max(0, floor - ground.low) + Math.max(0, ground.high - ceiling);
        const crowded = crowding(field.runways, site, config.separation ?? 0);
        const score   = ground.spread
            + outside * RUNWAY_BAND_PENALTY
            + crowded * RUNWAY_CROWDING_PENALTY;

        if (best && score >= best.score) continue;
        best = { ...site, elevation: ground.mean, spread: ground.spread, score };
    }

    return best;
}

/**
 * How far inside its stand-off a candidate site falls, taking the worst of the
 * strips already laid. Zero once it is clear of all of them, which is every
 * site in a world that asked for no separation at all.
 *
 * Measured centre to centre, which is the reading a separation is easiest to
 * mean: a pilot asking for strips two miles apart is asking about the flight
 * between them rather than about the gap between their thresholds.
 */
function crowding(runways, site, separation) {
    if (!(separation > 0)) return 0;

    let worst = 0;
    for (const strip of runways ?? []) {
        const gap = Math.hypot(site.x - strip.x, site.z - strip.z);
        worst = Math.max(worst, separation - gap);
    }

    return worst;
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

        // The centreline: dashes down the middle, short of the threshold
        // bars, at least a vertex wide however fine the strip is drawn.
        const centre = config.centreline === true
            && reachCross <= Math.max(field.step * 0.6, halfWidth * RUNWAY_CENTRELINE)
            && reachAlong / halfLength < RUNWAY_THRESHOLD - 0.05
            && Math.floor((along + halfLength) / RUNWAY_DASH) % 2 === 0;

        paint(field, i, centre
            ? blend(config.mark, 0)
            : painted
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
