/**
 * The environment file - a built world as one JSON file, written and read back.
 *
 * A world built in the builder is a description rather than a mesh: the
 * environment it was built on, that environment's own elements as they were
 * kept, and the placements committed over them. So it is saved as that
 * description, and a file read back is a world the builder could have kept:
 *
 *     {
 *       "format": "pilot-matter.environment",
 *       "version": 1,
 *       "name": "Sample Valley",
 *       "savedAt": "2026-11-05T12:00:00.000Z",
 *       "base": "highlands",
 *       "elements": [ { "id": "mountain-0", "type": "mountain", "config": {} } ],
 *       "placements": [ { "type": "mountain", "config": { "at": [0, 0] }, "seed": 7 } ],
 *       "start": { "at": [1200, -800], "heading": 90, "heightFeet": 1000 },
 *       "plane": "bush"
 *     }
 *
 * `start` and `plane` are the world's own flight, and either may be left out:
 * a world with no start point opens where every world does, and one with no
 * plane is flown in the trainer.
 *
 * `schemas/environment.schema.json` is the same format as JSON Schema, for
 * whoever writes one of these by hand or by another program.
 *
 * Reading never throws. A file is refused whole, with a list of what is wrong
 * with it, the first named - a world half read is a world nobody built. What
 * is not refused is held to what the builder allows: every range a file sets
 * is clamped to its bounds as a panel would clamp it.
 *
 * Nothing in a file is run. It is parsed as JSON and checked, and what is
 * kept is data the generators read.
 *
 * Pure module with no DOM or Three.js dependency, so the format can be tested
 * in Node.
 */

import { ELEMENTS_BY_ID, getElement, resolveConfig, resolvePoint } from './environment/elements.js';
import { BUILDER_ENVIRONMENTS, getEnvironment } from './environment/presets.js';
import { ERASE_TYPE, ERASE_RANGES } from './environment/erase.js';
import { isFootprint } from './environment/footprints.js';
import { GROUP_TYPE, GROUP_RANGES } from './templates.js';
import { elementRow } from './element-editor.js';
import { SHADE_RANGE } from './properties-panel.js';
import { cleanStartPoint } from './start-point.js';
import { isPlaneId } from './planes.js';
import { readAsset, assetForFile, assetsUsed, refAsset, ASSET_FILE_LIMIT } from './asset-fit.js';
import { OBJECT_TYPE, OBJECT_RANGES } from './objects.js';
import { readRecipe } from './prefabs.js';

/** What a file says it is, so a JSON file that is something else is refused by name. */
export const ENVIRONMENT_FORMAT = 'pilot-matter.environment';

/** The version of the format this build writes, and the newest it reads. */
export const ENVIRONMENT_VERSION = 1;

/** What a saved environment's file name ends in. */
export const ENVIRONMENT_FILE_SUFFIX = '.pilot-matter.json';

/**
 * The most a file may hold, in characters, checked before it is parsed - so a
 * file that is not an environment and is very large is refused without being
 * read into memory as one.
 */
export const ENVIRONMENT_FILE_LIMIT = 50 * 1024 * 1024;

/** The longest a world's name may be. */
export const ENVIRONMENT_NAME_LIMIT = 60;

/** The fields a file may carry at its top, the first three of which it must. */
export const DOCUMENT_FIELDS = Object.freeze([
    '$schema', 'format', 'version', 'name', 'savedAt', 'base', 'elements', 'placements', 'start', 'plane', 'assets'
]);
export const DOCUMENT_REQUIRED = Object.freeze(['format', 'version', 'base']);

/** The fields a start point carries in a file. */
export const START_FIELDS = Object.freeze(['at', 'heading', 'heightFeet']);

/** The fields an element's row carries in a file. Its label and note are read off the element. */
export const ROW_FIELDS = Object.freeze(['id', 'type', 'config', 'base', 'shades']);

/** The types a placement may be: an element, an erase batch, a template's group, or an object standing on the ground. */
export function placementTypes() {
    return [...ELEMENTS_BY_ID.keys(), ERASE_TYPE, GROUP_TYPE, OBJECT_TYPE];
}

/** The longest a prefab's name may be. */
export const PREFAB_NAME_LIMIT = 60;

/** The environments a world may be built on: the builder's canvases. */
export function baseIds() {
    return BUILDER_ENVIRONMENTS.map(environment => environment.id);
}

// --- Writing ---------------------------------------------------------------------

/** A world's name, trimmed and held to its length, or '' for none. */
export function cleanName(name) {
    return typeof name === 'string' ? name.trim().replace(/\s+/g, ' ').slice(0, ENVIRONMENT_NAME_LIMIT).trim() : '';
}

/** The name a world is saved under when it is given none: the environment it was built on. */
export function defaultEnvironmentName(base) {
    const label = getEnvironment(base).label ?? 'Environment';
    return label.toLowerCase().replace(/\b[a-z]/g, letter => letter.toUpperCase());
}

/**
 * The document a built world is saved as. `world` is what the builder keeps -
 * `{ environment, placements, world }`, as `builtWorld` hands it back: the
 * environment built on, the committed placements, and the environment's own
 * rows - and its `start` and `plane` when it has them. Every part is copied, so
 * the document shares nothing with the world.
 *
 * `library` is the loaded assets the page holds. Every one the world uses - an
 * object referring to it, a runway drawn as it, the plane flown as it - is
 * carried in the file's `assets`, its bytes as base64, so the file opens on a
 * computer that never loaded it.
 */
export function environmentDocument(world, { name = '', savedAt = new Date().toISOString(), library = [] } = {}) {
    const base = getEnvironment(world?.environment).id;
    const start = cleanStartPoint(world?.start);
    const used = assetsUsed(world);
    const assets = used.map(id => library.find(asset => asset.id === id)).filter(Boolean).map(assetForFile);
    return {
        format: ENVIRONMENT_FORMAT,
        version: ENVIRONMENT_VERSION,
        name: cleanName(name) || defaultEnvironmentName(base),
        savedAt: String(savedAt),
        base,
        elements: (world?.world ?? []).map(row => ({
            id: row.id,
            type: row.type,
            config: withoutDrawn(structuredClone(row.config ?? {})),
            base: withoutDrawn(structuredClone(row.base ?? row.config ?? {})),
            shades: structuredClone(row.shades ?? {})
        })),
        placements: (world?.placements ?? []).map(placement => withoutDrawnDeep(structuredClone(placement))),
        ...(start ? { start } : {}),
        ...(isPlaneId(world?.plane) || assets.some(asset => asset.id === refAsset(world?.plane)) ? { plane: world.plane } : {}),
        ...(assets.length > 0 ? { assets } : {})
    };
}

/** A document as the text of its file: indented, so a person can read it. */
export function environmentText(document) {
    return `${JSON.stringify(document, null, 2)}\n`;
}

/** The name a world's file is saved under: its name in lower case with hyphens, and the suffix. */
export function environmentFileName(name) {
    const slug = cleanName(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return `${slug || 'environment'}${ENVIRONMENT_FILE_SUFFIX}`;
}

// --- Reading ---------------------------------------------------------------------

/**
 * A file's text read back as a world: `{ ok, world, name, savedAt, problems }`.
 * `world` is `{ environment, placements, world }`, the shape the builder keeps
 * a world in - with `start` and `plane` when the file has them, and `assets`,
 * the models it carries, each with its bytes decoded - or null for a file
 * refused. `problems` says why, first problem first. Never throws.
 *
 * Nothing a file carries is run: a model's bytes are only decoded here, and
 * read later by the page's loaders, never put into the document.
 */
export function readEnvironmentDocument(text) {
    const problems = [];
    const refused = () => ({ ok: false, world: null, name: '', savedAt: '', problems });

    try {
        if (typeof text !== 'string') {
            problems.push('the file is not text');
            return refused();
        }
        if (text.length > ENVIRONMENT_FILE_LIMIT) {
            problems.push(`the file is larger than an environment file may be (${Math.round(ENVIRONMENT_FILE_LIMIT / 1048576)} MB)`);
            return refused();
        }

        let document;
        try {
            document = JSON.parse(text);
        } catch {
            problems.push('the file is not JSON');
            return refused();
        }

        if (!isObject(document)) {
            problems.push('the file is not an environment file: it holds no object');
            return refused();
        }
        if (document.format !== ENVIRONMENT_FORMAT) {
            problems.push(`the file is not an environment file: its format is not "${ENVIRONMENT_FORMAT}"`);
            return refused();
        }
        if (!Number.isInteger(document.version) || document.version < 1) {
            problems.push('version: not a version this format has had');
            return refused();
        }
        if (document.version > ENVIRONMENT_VERSION) {
            problems.push(`version: the file was saved by a newer Pilot Matter (version ${document.version}; this reads ${ENVIRONMENT_VERSION})`);
            return refused();
        }

        for (const key of Object.keys(document)) {
            if (!DOCUMENT_FIELDS.includes(key)) problems.push(`${key}: not a field an environment file has`);
        }
        if (document.$schema != null && typeof document.$schema !== 'string') problems.push('$schema: not text');

        const name = document.name ?? '';
        if (typeof name !== 'string') problems.push('name: not text');
        else if (name.trim().length > ENVIRONMENT_NAME_LIMIT) problems.push(`name: longer than ${ENVIRONMENT_NAME_LIMIT} characters`);

        const savedAt = document.savedAt ?? '';
        if (typeof savedAt !== 'string') problems.push('savedAt: not text');

        if (!baseIds().includes(document.base)) {
            problems.push(`base: no environment the builder offers is called ${JSON.stringify(document.base ?? null)}`);
        }

        const rows = readRows(document.elements, problems);
        const placements = readPlacements(document.placements, 'placements', problems, true);
        const start = readStart(document.start, problems);
        const assets = readAssets(document.assets, problems);
        const carried = new Set(assets.map(asset => asset.id));
        const planeAsset = refAsset(document.plane);
        if (document.plane != null && !isPlaneId(document.plane) && !(planeAsset && assets.some(asset => asset.id === planeAsset && asset.uses.plane))) {
            problems.push(`plane: no plane is called ${JSON.stringify(document.plane)}`);
        }
        for (const id of assetsUsed({ placements })) {
            if (!carried.has(id)) problems.push(`placements: asset ${id} is used and not carried in assets`);
        }

        if (problems.length > 0) return refused();
        return {
            ok: true,
            world: {
                environment: document.base, placements, world: rows,
                ...(start ? { start } : {}),
                ...(document.plane != null ? { plane: document.plane } : {}),
                ...(assets.length > 0 ? { assets } : {})
            },
            name: cleanName(name) || defaultEnvironmentName(document.base),
            savedAt,
            problems
        };
    } catch (error) {
        problems.push(`the file could not be read: ${error?.message ?? error}`);
        return refused();
    }
}

/**
 * The world's start point, held to where a start point may be, or null for a
 * file with none. Refused for one that is not a point with a heading and a
 * height - a start somewhere nobody said is no start at all.
 */
function readStart(start, problems) {
    if (start == null) return null;
    if (!isObject(start)) {
        problems.push('start: not a start point');
        return null;
    }
    for (const key of Object.keys(start)) {
        if (!START_FIELDS.includes(key)) problems.push(`start: ${key} is not a field a start point has`);
    }
    if (!Array.isArray(start.at) || start.at.length !== 2 || !start.at.every(Number.isFinite)) {
        problems.push('start: at is not a point');
        return null;
    }
    for (const key of ['heading', 'heightFeet']) {
        if (start[key] != null && !Number.isFinite(start[key])) problems.push(`start: ${key} is not a number`);
    }
    return cleanStartPoint(start);
}

/** The most assets a file may carry. */
export const ASSET_COUNT_LIMIT = 64;

/** The models a file carries, each read as an asset - bytes decoded, size worked out - or [] for none. */
function readAssets(assets, problems) {
    if (assets == null) return [];
    if (!Array.isArray(assets) || assets.length > ASSET_COUNT_LIMIT) {
        problems.push(`assets: not a list of up to ${ASSET_COUNT_LIMIT} assets`);
        return [];
    }
    const read = [];
    assets.forEach((value, at) => {
        const { asset, problems: wrong } = readAsset(value, `assets[${at}]`);
        problems.push(...wrong);
        if (asset) read.push(asset);
    });
    const total = read.reduce((sum, asset) => sum + asset.bytes.length, 0);
    if (total > ASSET_FILE_LIMIT * 2) problems.push('assets: more model than one file may carry');
    return read;
}

/** The environment's own rows, each rebuilt as the editor builds one, or [] for none. */
function readRows(rows, problems) {
    if (rows == null) return [];
    if (!Array.isArray(rows)) {
        problems.push('elements: not a list');
        return [];
    }

    const read = [];
    rows.forEach((row, at) => {
        const where = `elements[${at}]`;
        if (!isObject(row)) {
            problems.push(`${where}: not an element`);
            return;
        }
        for (const key of Object.keys(row)) {
            if (!ROW_FIELDS.includes(key)) problems.push(`${where}: ${key} is not a field an element has here`);
        }
        if (!ELEMENTS_BY_ID.has(row.type)) {
            problems.push(`${where}: no element is called ${JSON.stringify(row.type ?? null)}`);
            return;
        }
        if (!isObject(row.config)) problems.push(`${where}: config is not an object`);
        if (row.base != null && !isObject(row.base)) problems.push(`${where}: base is not an object`);
        if (row.id != null && typeof row.id !== 'string') problems.push(`${where}: id is not text`);
        const shades = readShades(row.shades, `${where}.shades`, problems);
        if (!isObject(row.config)) return;

        read.push(elementRow(row.type, at, withoutDrawn(row.config), {
            base: isObject(row.base) ? withoutDrawn(row.base) : withoutDrawn(row.config),
            shades,
            id: typeof row.id === 'string' ? row.id : null
        }));
    });
    return read;
}

/** A row's shades, each end held to what a shade may be, or null for none. */
function readShades(shades, where, problems) {
    if (shades == null) return null;
    if (!isObject(shades)) {
        problems.push(`${where}: not an object`);
        return null;
    }
    const read = {};
    for (const [name, pair] of Object.entries(shades)) {
        if (!isObject(pair) || !Number.isFinite(pair.light) || !Number.isFinite(pair.dark)) {
            problems.push(`${where}.${name}: not a light and a dark shade`);
            continue;
        }
        read[name] = { light: clamp(pair.light, SHADE_RANGE.low, SHADE_RANGE.high), dark: clamp(pair.dark, SHADE_RANGE.low, SHADE_RANGE.high) };
    }
    return read;
}

/**
 * Placements, each checked: a type the builder places, a configuration held
 * to its ranges, regions that are regions, a seed that is a number, and a
 * group's members placements of their own. `groups` is whether a group may be
 * here - a group's members are elements, never another group.
 */
function readPlacements(placements, where, problems, groups) {
    if (placements == null) return [];
    if (!Array.isArray(placements)) {
        problems.push(`${where}: not a list`);
        return [];
    }
    return placements.map((placement, at) => readPlacement(placement, `${where}[${at}]`, problems, groups)).filter(Boolean);
}

function readPlacement(placement, where, problems, groups) {
    if (!isObject(placement)) {
        problems.push(`${where}: not a placement`);
        return null;
    }

    const type = placement.type;
    const allowed = groups ? placementTypes() : placementTypes().filter(each => each !== GROUP_TYPE);
    if (!allowed.includes(type)) {
        problems.push(`${where}: ${type === GROUP_TYPE ? 'a group may not stand inside a group' : `nothing the builder places is called ${JSON.stringify(type ?? null)}`}`);
        return null;
    }
    if (placement.config != null && !isObject(placement.config)) {
        problems.push(`${where}: config is not an object`);
        return null;
    }

    const read = withoutDrawn(structuredClone(placement));
    for (const key of ['footprint', 'clip']) {
        if (read[key] != null && !isFootprint(read[key])) problems.push(`${where}: ${key} is not a region`);
    }
    if (read.seed != null && !Number.isFinite(read.seed)) problems.push(`${where}: seed is not a number`);

    const config = read.config ?? {};
    if (config.at != null && resolvePoint(config.at) == null) problems.push(`${where}: at is not a point`);

    // An object carries the building it was placed as, so the recipe is read
    // as strictly as the rest of the file - a part out of its bounds refuses
    // the file rather than being guessed at - and its point, heading and scale
    // are held to what they may be.
    if (type === OBJECT_TYPE) {
        if (typeof read.prefab !== 'string' || read.prefab === '' || read.prefab.length > PREFAB_NAME_LIMIT) {
            problems.push(`${where}: prefab is not named`);
        }
        const recipe = readRecipe(read.recipe, `${where}.recipe`);
        problems.push(...recipe.problems);
        if (recipe.recipe) read.recipe = recipe.recipe;
        if (config.at == null) problems.push(`${where}: at is missing, so the object stands nowhere`);
        for (const key of ['heading', 'scale']) {
            if (config[key] != null && !Number.isFinite(config[key])) problems.push(`${where}: ${key} is not a number`);
        }
        read.config = clampConfig({ ranges: OBJECT_RANGES }, config);
        return read;
    }

    if (type === GROUP_TYPE) {
        if (typeof read.template !== 'string' || read.template === '') problems.push(`${where}: template is not named`);
        for (const key of ['heading', 'length', 'width']) {
            if (config[key] != null && !Number.isFinite(config[key])) problems.push(`${where}: ${key} is not a number`);
        }
        read.members = readPlacements(read.members ?? [], `${where}.members`, problems, false);
        // Held to the strip's own bounds, as an object's and an element's are.
        // `groupConfig` holds them again when the ground is drawn, so a file
        // left unclamped here drew a clamped strip under a panel and a saved
        // file that both still said the figure the file came with.
        if (read.config != null) read.config = clampConfig({ ranges: GROUP_RANGES }, config);
        return read;
    }

    if (read.config != null) {
        read.config = clampConfig(type === ERASE_TYPE ? { ranges: ERASE_RANGES } : getElement(type), read.config);
    }
    return read;
}

/**
 * A configuration with every range it sets held to its bounds, as a panel
 * would hold it, and every other value it carries - the point it was dropped
 * at, a group's figures - left as it is. Only what is set is touched: a range
 * the file leaves out stays out, to be filled in from the element's default
 * when the ground is drawn, as it is for a world never saved.
 */
function clampConfig(element, config) {
    const resolved = resolveConfig(element, config);
    const held = {};
    for (const [key, value] of Object.entries(config)) {
        if (key === 'drawn') continue;
        held[key] = key in element.ranges || key === 'at' ? resolved[key] : value;
    }
    return held;
}

// --- Helpers -----------------------------------------------------------------------

function isObject(value) {
    return value != null && typeof value === 'object' && !Array.isArray(value);
}

function clamp(value, low, high) {
    return Math.min(Math.max(value, low), high);
}

/**
 * A configuration without what a footprint settled for the generator - a
 * drawn body's line, worked out from the ground each time it is drawn - which
 * is never saved and never taken from a file.
 */
function withoutDrawn(config) {
    if (!isObject(config)) return config;
    const { drawn, ...rest } = config;
    return rest;
}

function withoutDrawnDeep(placement) {
    if (!isObject(placement)) return placement;
    if (isObject(placement.config)) placement.config = withoutDrawn(placement.config);
    if (Array.isArray(placement.members)) placement.members = placement.members.map(withoutDrawnDeep);
    return placement;
}
