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
 *       "placements": [ { "type": "mountain", "config": { "at": [0, 0] }, "seed": 7 } ]
 *     }
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
import { GROUP_TYPE } from './templates.js';
import { elementRow } from './element-editor.js';
import { SHADE_RANGE } from './properties-panel.js';

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
export const DOCUMENT_FIELDS = Object.freeze(['$schema', 'format', 'version', 'name', 'savedAt', 'base', 'elements', 'placements']);
export const DOCUMENT_REQUIRED = Object.freeze(['format', 'version', 'base']);

/** The fields an element's row carries in a file. Its label and note are read off the element. */
export const ROW_FIELDS = Object.freeze(['id', 'type', 'config', 'base', 'shades']);

/** The types a placement may be: an element, an erase batch, or a template's group. */
export function placementTypes() {
    return [...ELEMENTS_BY_ID.keys(), ERASE_TYPE, GROUP_TYPE];
}

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
 * rows. Every part is copied, so the document shares nothing with the world.
 */
export function environmentDocument(world, { name = '', savedAt = new Date().toISOString() } = {}) {
    const base = getEnvironment(world?.environment).id;
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
        placements: (world?.placements ?? []).map(placement => withoutDrawnDeep(structuredClone(placement)))
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
 * a world in, or null for a file refused. `problems` says why, first problem
 * first. Never throws.
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

        if (problems.length > 0) return refused();
        return {
            ok: true,
            world: { environment: document.base, placements, world: rows },
            name: cleanName(name) || defaultEnvironmentName(document.base),
            savedAt,
            problems
        };
    } catch (error) {
        problems.push(`the file could not be read: ${error?.message ?? error}`);
        return refused();
    }
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

    if (type === GROUP_TYPE) {
        if (typeof read.template !== 'string' || read.template === '') problems.push(`${where}: template is not named`);
        for (const key of ['heading', 'length', 'width']) {
            if (config[key] != null && !Number.isFinite(config[key])) problems.push(`${where}: ${key} is not a number`);
        }
        read.members = readPlacements(read.members ?? [], `${where}.members`, problems, false);
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
