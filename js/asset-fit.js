/**
 * Loaded assets - models a pilot loads from their own computer, and where
 * each one may go.
 *
 * A model is read in the page and never sent anywhere. Once it is read, the
 * builder asks how to take it - how large a unit of it is, which way is up,
 * which way it faces - and this module works out, from its bounds alone, which
 * insert menus it fits:
 *
 * | Use    | Fits when                                                        |
 * | ------ | ---------------------------------------------------------------- |
 * | PLANE  | longest side 3 to 90 m, height under half of it                  |
 * | CITY   | footprint up to 600 m a side, height up to 900 m                 |
 * | RUNWAY | 600 to 5000 m long, 80 to 600 m across and no wider than a       |
 * |        | quarter of its length, no taller than 2% of it                    |
 *
 * A runway's length and width are the strip's own: a runway asset is placed
 * over a real strip of its size, so an asset is only offered as a runway at a
 * size a strip can be built at - 600 to 8000 m long and 80 to 600 m across,
 * with the length held tighter still by the table above.
 *
 * An asset is known by the SHA-256 of its bytes, so the same file loaded
 * twice, or carried in two environment files, is one asset.
 *
 * Pure module with no DOM or Three.js dependency.
 */

import { isPlaneId, planeIds, DEFAULT_PLANE_ID } from './planes.js';
import { PREFAB_CATEGORIES } from './prefabs.js';
import { GROUP_TYPE, GROUP_RANGES, arrivalHeading } from './templates.js';

/** The formats an asset may be read from, each with the uses it can be put to and whether it brings its own colours. */
export const ASSET_FORMATS = Object.freeze({
    glb:  Object.freeze({ id: 'glb', label: 'glTF binary', uses: Object.freeze(['plane', 'city', 'runway']), colours: true, binary: true }),
    gltf: Object.freeze({ id: 'gltf', label: 'glTF', uses: Object.freeze(['plane', 'city', 'runway']), colours: true, binary: false }),
    obj:  Object.freeze({ id: 'obj', label: 'OBJ', uses: Object.freeze(['plane', 'city', 'runway']), colours: false, binary: false }),
    stl:  Object.freeze({ id: 'stl', label: 'STL', uses: Object.freeze(['plane', 'city', 'runway']), colours: false, binary: true }),
    svg:  Object.freeze({ id: 'svg', label: 'SVG plan', uses: Object.freeze(['city']), colours: false, binary: false })
});

/** What the file dialog offers. */
export const ASSET_FILE_ACCEPT = '.glb,.gltf,.obj,.stl,.svg';

/** The largest file read, in bytes, and the most triangles a model may have. */
export const ASSET_FILE_LIMIT = 25 * 1024 * 1024;
export const ASSET_TRIANGLE_LIMIT = 300000;

/** The uses an asset may be put to, in the order the step lists them. */
export const ASSET_USES = Object.freeze(['plane', 'city', 'runway']);

/** Which way is up in a model's own units, and which way a model's nose points. */
export const ASSET_UPS = Object.freeze(['y', 'z']);
export const ASSET_FACINGS = Object.freeze(['+z', '-z', '+x', '-x']);

/** A model longer than this many of its own units is taken as drawn in millimetres. */
export const MILLIMETRE_GUESS = 2000;

/** The longest a loaded asset's name may be, and the colour and height a model with none is drawn at. */
export const ASSET_NAME_LIMIT = 60;
export const ASSET_COLOR = 0x9aa3a8;
export const ASSET_HEIGHT = 12;

/** What an asset reference is written as, wherever a card's id or a plane's id stands for one. */
export const ASSET_REF = 'asset:';

/** The format a file's name says it is, or null for one no format answers to. */
export function assetFormat(fileName) {
    const match = /\.([a-z0-9]+)$/i.exec(String(fileName ?? ''));
    const ext = match?.[1]?.toLowerCase();
    return ext && ASSET_FORMATS[ext] ? ext : null;
}

/** An asset's name from its file's: the extension off, held to its length. */
export function assetName(fileName) {
    const base = String(fileName ?? '').replace(/\.[a-z0-9]+$/i, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
    return (base || 'Asset').slice(0, ASSET_NAME_LIMIT).trim();
}

/** The id an asset goes by: drawn from the hash of its bytes, so the same bytes are always the same asset. */
export function assetId(hash) {
    return `a-${String(hash).slice(0, 16)}`;
}

/** An id a card or a plane carries for an asset, and the asset's id back out of one. */
export function assetRef(id) {
    return `${ASSET_REF}${id}`;
}
export function refAsset(ref) {
    return typeof ref === 'string' && ref.startsWith(ASSET_REF) ? ref.slice(ASSET_REF.length) : null;
}

/** True for an id the way assets are named. */
export function isAssetId(id) {
    return typeof id === 'string' && /^a-[0-9a-f]{16}$/.test(id);
}

// --- Size and fit ---------------------------------------------------------------------

/**
 * A model's size in metres - `{ width, height, depth }`: across, up and along -
 * from its size in its own units, `{ x, y, z }`, its scale, and which of its
 * axes is up.
 */
export function fitSize(raw, { scale = 1, up = 'y' } = {}) {
    const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
    const x = Math.abs(Number(raw?.x) || 0) * s, y = Math.abs(Number(raw?.y) || 0) * s, z = Math.abs(Number(raw?.z) || 0) * s;
    return up === 'z' ? { width: x, height: z, depth: y } : { width: x, height: y, depth: z };
}

/**
 * The scale a model is first taken at. glTF is drawn in metres by its own
 * definition, so a glTF is taken as it is - a runway thousands of metres long
 * included. A format that says nothing of its units is taken as millimetres
 * when it is long enough to have been drawn in them, and as metres otherwise.
 */
export function guessScale(raw, format = null) {
    if (format === 'glb' || format === 'gltf') return 1;
    const longest = Math.max(Math.abs(Number(raw?.x) || 0), Math.abs(Number(raw?.y) || 0), Math.abs(Number(raw?.z) || 0));
    return longest > MILLIMETRE_GUESS ? 0.001 : 1;
}

/** The axis a format is first taken as up along: Z for an STL, which is usually drawn so, and Y for every other. */
export function guessUp(format) {
    return format === 'stl' ? 'z' : 'y';
}

/** The way a model is first taken as facing: along its longest side across the ground. A plan is taken as drawn. */
export function guessFacing(raw, up = 'y', format = null) {
    if (format === 'svg') return '+z';
    const size = fitSize(raw, { up });
    return size.width > size.depth ? '+x' : '+z';
}

/** A model's size once it is turned to face along its own `+z`: across and along swap for a model facing along `x`. */
export function facedSize(size, facing = '+z') {
    return facing === '+x' || facing === '-x' ? { width: size.depth, height: size.height, depth: size.width } : { ...size };
}

const metres = value => `${Math.round(value * 10) / 10} m`;

/**
 * The longest a runway asset may be. Shorter than `GROUP_RANGES.length.high`,
 * which is what the strip itself may be built to, on purpose: 5 km is past
 * every runway there is, and a model longer than that is a model whose units
 * were guessed wrong rather than an aerodrome.
 */
export const RUNWAY_LENGTH_LIMIT = 5000;

/**
 * Where a model of a size, in metres and facing along `+z`, may go, as
 * `{ plane, city, runway }`, each `{ fits, reason }` - the reason saying, where
 * it does not fit, which bound it is past.
 *
 * A runway's bounds are the strip's own, because `placeAssetRunway` builds a
 * real strip of the asset's size and a strip can only be built between
 * `GROUP_RANGES.width.low` and `.high`. Held to a quarter of the length as
 * well, which is the shape of a runway rather than a limit of the strip. Before
 * the two were the same figures they disagreed both ways without warning: a 600
 * by 20 m model was given an 80 m strip, so the landable ground was four times
 * the model a pilot could see, and a 5000 by 1200 m one was given a 600 m
 * strip, so the model's edges hung over ground that was not runway.
 */
export function assetFit(size) {
    const { width, height, depth } = size;
    const longest = Math.max(width, depth);
    const plane = longest < 3 ? `too small for a plane: ${metres(longest)} long, the least is 3 m`
        : longest > 90 ? `too large for a plane: ${metres(longest)} long, the most is 90 m`
        : height >= longest / 2 ? `too tall for a plane: ${metres(height)} high, under half its length`
        : null;
    const city = Math.max(width, depth) > 600 ? `too large for the city: ${metres(Math.max(width, depth))} a side, the most is 600 m`
        : height > 900 ? `too tall for the city: ${metres(height)} high, the most is 900 m`
        : !(longest > 0) ? 'nothing to place' : null;
    const runway = !(width > 0) || !(depth > 0) ? 'nothing to place'
        : depth < GROUP_RANGES.length.low ? `too short for a runway: ${metres(depth)} long, the least is ${GROUP_RANGES.length.low} m`
        : depth > RUNWAY_LENGTH_LIMIT ? `too long for a runway: ${metres(depth)} long, the most is ${RUNWAY_LENGTH_LIMIT} m`
        : width < GROUP_RANGES.width.low ? `too narrow for a runway: ${metres(width)} across, the least is ${GROUP_RANGES.width.low} m`
        : width > GROUP_RANGES.width.high ? `too wide for a runway: ${metres(width)} across, the most is ${GROUP_RANGES.width.high} m`
        : width > depth / 4 ? `too wide for a runway: ${metres(width)} across, no more than a quarter of its length`
        : height > depth * 0.02 ? `too tall for a runway: ${metres(height)} high, no more than 2% of its length`
        : null;
    return {
        plane: { fits: plane == null, reason: plane },
        city: { fits: city == null, reason: city },
        runway: { fits: runway == null, reason: runway }
    };
}

/** The Insert City section an asset of a height is first offered under. */
export function suggestSection(height) {
    if (height >= 50) return 'skylines';
    if (height >= 15) return 'commercial';
    return 'residential';
}

// --- The step after loading ------------------------------------------------------------

/**
 * The step a read model starts at: everything guessed from its file and its
 * bounds. `raw` is its size in its own units; `triangles`, how many it has.
 */
export function assetDraft({ fileName, format, raw, triangles = 0, hash, bytes = null }) {
    const scale = guessScale(raw, format);
    const up = guessUp(format);
    const facing = guessFacing(raw, up, format);
    const draft = {
        id: assetId(hash), hash, name: assetName(fileName), format, bytes, raw: { x: raw.x, y: raw.y, z: raw.z }, triangles,
        scale, up, facing, color: ASSET_COLOR, height: ASSET_HEIGHT,
        uses: { plane: false, city: false, runway: false }, fliesLike: DEFAULT_PLANE_ID, section: 'residential'
    };
    return settleDraft(draft);
}

/**
 * A step's draft as it stands once something in it changed: its size worked
 * out again, a use that no longer fits switched off, and every use it fits
 * switched on the first time it is worked out.
 */
export function settleDraft(draft, { first = !draft.settled } = {}) {
    const size = assetSize(draft);
    const fit = assetFit(size);
    const uses = {};
    for (const use of ASSET_USES) {
        const offered = ASSET_FORMATS[draft.format]?.uses.includes(use) && fit[use].fits;
        uses[use] = offered && (first ? true : draft.uses?.[use] === true);
    }
    const section = first ? suggestSection(size.height) : draft.section;
    return { ...draft, uses, section, size, fit: offeredFit(draft.format, fit), settled: true };
}

/** A fit with the uses a format cannot be put to refused, by name. */
function offeredFit(format, fit) {
    const offered = ASSET_FORMATS[format]?.uses ?? [];
    const out = {};
    for (const use of ASSET_USES) {
        out[use] = offered.includes(use) ? fit[use] : { fits: false, reason: `an ${ASSET_FORMATS[format]?.label ?? format} is a plan, so it is only a building` };
    }
    return out;
}

/** An asset's size in metres, facing along its own `+z`, as its draft or record says. */
export function assetSize(asset) {
    const raw = asset?.raw ?? { x: 0, y: 0, z: 0 };
    // A plan lies in its own x and y, which are across and along the ground,
    // and is extruded to the height the step asked for, whatever its units.
    if (asset?.format === 'svg') {
        const s = Number.isFinite(asset.scale) && asset.scale > 0 ? asset.scale : 1;
        return facedSize({ width: Math.abs(raw.x) * s, height: Number(asset.height) || ASSET_HEIGHT, depth: Math.abs(raw.y) * s }, asset.facing);
    }
    return facedSize(fitSize(raw, { scale: asset?.scale, up: asset?.up }), asset?.facing);
}

/** True when a draft has any use switched on, which is what lets it be added. */
export function draftUsable(draft) {
    return ASSET_USES.some(use => draft?.uses?.[use] === true);
}

/** Why a draft's uses are off where they are, one line, or '' where every one fits. */
export function fitReasons(draft) {
    return ASSET_USES.filter(use => !draft?.fit?.[use]?.fits).map(use => `${use.toUpperCase()}: ${draft.fit[use].reason}`).join('; ');
}

// --- Placing one ---------------------------------------------------------------------------

/** The recipe a placed asset carries: a reference to the stored model, and its size - never a copy of the model. */
export function assetRecipe(asset, { solid = true } = {}) {
    const { width, height, depth } = asset.size ?? assetSize(asset);
    const round = value => Math.round(value * 1000) / 1000;
    return { asset: asset.id, size: [round(width), round(height), round(depth)], ...(solid ? {} : { solid: false }) };
}

/** A building asset placed at a point, as an object whose recipe refers to it. */
export function placeAssetObject(asset, at, { heading = 0, scale = 1 } = {}) {
    if (!Array.isArray(at) || at.length !== 2 || !at.every(Number.isFinite)) return null;
    return { type: 'object', prefab: assetRef(asset.id), recipe: assetRecipe(asset), config: { at: [at[0], at[1]], heading, scale } };
}

/**
 * A runway asset placed: a group whose strip is a real runway of the asset's
 * length and width - so landing, scoring and takeoff work on it unchanged -
 * with the asset drawn as an object over it, which is how it looks.
 *
 * The figures are still held to `GROUP_RANGES`, which is what a strip can be
 * built at, but `assetFit` refuses an asset outside them, so the hold is a
 * guard rather than a silent resize: a runway offered here is a runway whose
 * strip is the size the model is, to the metre.
 */
export function placeAssetRunway(asset, at, heading = 0) {
    if (!Array.isArray(at) || at.length !== 2 || !at.every(Number.isFinite)) return null;
    const size = asset.size ?? assetSize(asset);
    const clamp = (value, range) => Math.min(Math.max(Math.round(value), range.low), range.high);
    return {
        type: GROUP_TYPE,
        template: assetRef(asset.id),
        config: {
            at: [Math.round(at[0]) || 0, Math.round(at[1]) || 0], heading: arrivalHeading(heading),
            length: clamp(size.depth, GROUP_RANGES.length), width: clamp(size.width, GROUP_RANGES.width)
        },
        members: [
            { type: 'runway', config: { at: [0, 0] } },
            { type: 'object', prefab: assetRef(asset.id), recipe: { ...assetRecipe(asset), solid: false }, config: { at: [0, 0] } }
        ]
    };
}

/** The assets of a library a use offers, in the order they were added - and for the city, the ones under a section. */
export function assetsFor(library = [], use, section = null) {
    return (library ?? []).filter(asset => asset?.uses?.[use] === true && (section == null || asset.section === section));
}

/** An asset in a library by its id or a reference to it, or null. */
export function libraryAsset(library = [], idOrRef) {
    const id = refAsset(idOrRef) ?? idOrRef;
    return (library ?? []).find(asset => asset.id === id) ?? null;
}

/** Every asset id a world refers to: its objects' recipes, its groups' members, and its plane. */
export function assetsUsed(world) {
    const used = new Set();
    const visit = placement => {
        if (placement?.recipe?.asset) used.add(placement.recipe.asset);
        for (const member of placement?.members ?? []) visit(member);
    };
    for (const placement of world?.placements ?? []) visit(placement);
    const plane = refAsset(world?.plane);
    if (plane) used.add(plane);
    return [...used];
}

/** A world with every placement - and its plane - that refers to an asset taken away. */
export function withoutAsset(world, id) {
    const refers = placement => placement?.recipe?.asset === id || (placement?.members ?? []).some(refers);
    return {
        ...world,
        placements: (world?.placements ?? []).filter(placement => !refers(placement)),
        ...(refAsset(world?.plane) === id ? { plane: null } : {})
    };
}

// --- Carried in a file ---------------------------------------------------------------------

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Bytes as base64 text, which is how an environment file carries a model. */
export function toBase64(bytes) {
    const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes ?? []);
    let out = '';
    for (let i = 0; i < data.length; i += 3) {
        const a = data[i], b = data[i + 1], c = data[i + 2];
        out += BASE64[a >> 2] + BASE64[((a & 3) << 4) | ((b ?? 0) >> 4)]
            + (b === undefined ? '=' : BASE64[((b & 15) << 2) | ((c ?? 0) >> 6)])
            + (c === undefined ? '=' : BASE64[c & 63]);
    }
    return out;
}

/** Base64 text back as bytes, or null for text that is not base64. */
export function fromBase64(text) {
    if (typeof text !== 'string' || text.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(text)) return null;
    const pad = text.endsWith('==') ? 2 : text.endsWith('=') ? 1 : 0;
    const out = new Uint8Array(text.length / 4 * 3 - pad);
    let at = 0;
    for (let i = 0; i < text.length; i += 4) {
        const n = [0, 1, 2, 3].map(k => (text[i + k] === '=' ? 0 : BASE64.indexOf(text[i + k])));
        const triple = (n[0] << 18) | (n[1] << 12) | (n[2] << 6) | n[3];
        if (at < out.length) out[at++] = (triple >> 16) & 255;
        if (at < out.length) out[at++] = (triple >> 8) & 255;
        if (at < out.length) out[at++] = triple & 255;
    }
    return out;
}

/** The SHA-256 of some bytes, as hex, through the page's own `crypto.subtle`. */
export async function assetHash(bytes, subtle = globalThis.crypto?.subtle) {
    const digest = await subtle.digest('SHA-256', bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

/** The fields an asset carries in a file. */
export const ASSET_FIELDS = Object.freeze([
    'id', 'name', 'format', 'hash', 'data', 'raw', 'triangles', 'scale', 'up', 'facing', 'color', 'height', 'uses', 'fliesLike', 'section'
]);

/** An asset as an environment file carries it: its settings, and its bytes as base64. */
export function assetForFile(asset) {
    return {
        id: asset.id, name: asset.name, format: asset.format, hash: asset.hash, data: toBase64(asset.bytes),
        raw: { ...asset.raw }, triangles: asset.triangles, scale: asset.scale, up: asset.up, facing: asset.facing,
        color: asset.color, height: asset.height, uses: { ...asset.uses }, fliesLike: asset.fliesLike, section: asset.section
    };
}

/**
 * An asset read back from a file: `{ asset, problems }`, the asset with its
 * bytes decoded and its size worked out, or null with the problems that refuse
 * it, each naming where. Its hash is checked against its bytes by the caller,
 * which has `crypto.subtle` to do it with.
 */
export function readAsset(value, where = 'assets[0]') {
    const problems = [];
    if (value == null || typeof value !== 'object' || Array.isArray(value)) return { asset: null, problems: [`${where}: not an asset`] };
    for (const key of Object.keys(value)) if (!ASSET_FIELDS.includes(key)) problems.push(`${where}: ${key} is not a field an asset has`);
    if (!/^[0-9a-f]{64}$/.test(String(value.hash))) problems.push(`${where}: hash is not a SHA-256`);
    else if (value.id !== assetId(value.hash)) problems.push(`${where}: id is not the one its hash names`);
    if (typeof value.name !== 'string' || value.name.trim() === '' || value.name.length > ASSET_NAME_LIMIT) problems.push(`${where}: name is not a name`);
    if (!ASSET_FORMATS[value.format]) problems.push(`${where}: no format is called ${JSON.stringify(value.format ?? null)}`);
    const bytes = fromBase64(value.data);
    if (bytes == null) problems.push(`${where}: data is not base64`);
    else if (bytes.length > ASSET_FILE_LIMIT) problems.push(`${where}: data is larger than an asset may be`);
    const raw = value.raw;
    if (raw == null || !['x', 'y', 'z'].every(axis => Number.isFinite(raw[axis]) && raw[axis] >= 0)) problems.push(`${where}: raw is not a size`);
    if (!(Number.isFinite(value.scale) && value.scale > 0)) problems.push(`${where}: scale is not a number above nought`);
    if (!ASSET_UPS.includes(value.up)) problems.push(`${where}: up is not y or z`);
    if (!ASSET_FACINGS.includes(value.facing)) problems.push(`${where}: facing is not one of ${ASSET_FACINGS.join(', ')}`);
    if (!Number.isInteger(value.color) || value.color < 0 || value.color > 0xffffff) problems.push(`${where}: color is not a colour`);
    if (!(Number.isFinite(value.height) && value.height > 0)) problems.push(`${where}: height is not a length`);
    if (value.uses == null || !ASSET_USES.every(use => typeof value.uses[use] === 'boolean')) problems.push(`${where}: uses is not a switch for each use`);
    if (!isPlaneId(value.fliesLike)) problems.push(`${where}: fliesLike is not a plane there is`);
    if (!PREFAB_CATEGORIES.some(category => category.id === value.section)) problems.push(`${where}: section is not a section there is`);
    if (problems.length > 0) return { asset: null, problems };

    const asset = {
        id: value.id, hash: value.hash, name: value.name.trim(), format: value.format, bytes, raw: { x: raw.x, y: raw.y, z: raw.z },
        triangles: Number.isFinite(value.triangles) ? value.triangles : 0, scale: value.scale, up: value.up, facing: value.facing,
        color: value.color, height: value.height, uses: { ...value.uses }, fliesLike: value.fliesLike, section: value.section
    };
    return { asset: { ...asset, size: assetSize(asset) }, problems };
}

/** Every plane a world can be flown in - the five, and the plane assets a library holds. */
export function flyablePlanes(library = []) {
    return [...planeIds(), ...assetsFor(library, 'plane').map(asset => assetRef(asset.id))];
}
