/**
 * The loaded world - the one world a file brought that the browser keeps.
 *
 * The file is the library: a pilot keeps their worlds as files, and the
 * browser holds only the last one loaded, so it is still the world chosen
 * after a reload. It is kept as the file's own text, under a key of its own,
 * and read back through `readEnvironmentDocument` every time - so a kept world
 * that some later version would refuse is refused here too, rather than
 * trusted for having been kept.
 *
 * Pure module with no DOM or Three.js dependency; the storage is handed in.
 */

import { readEnvironmentDocument } from './environment-file.js';
import { getEnvironment } from './environment/presets.js';

/** Where the browser keeps the last world a file brought. */
export const LOADED_WORLD_STORAGE_KEY = 'pilot-matter.environment';

/**
 * A file's text read as the world it brings: `{ name, base, world, text }`,
 * `world` the shape the builder keeps a world in - or null for text that is no
 * environment.
 */
export function loadedWorldFrom(text) {
    return loadedWorldOf(text).loaded;
}

/**
 * A file's text read as the world it brings, and why not where it does not:
 * `{ loaded, problems }`, `loaded` null and the problems first first for text
 * that is no environment.
 */
export function loadedWorldOf(text) {
    const read = readEnvironmentDocument(text);
    if (!read.ok) return { loaded: null, problems: read.problems };
    return { loaded: { name: read.name, base: read.world.environment, world: read.world, text }, problems: [] };
}

/** The world the browser keeps, or null for none - or for one that no longer reads. */
export function readLoadedWorld(storage) {
    try {
        const text = storage?.getItem(LOADED_WORLD_STORAGE_KEY);
        return typeof text === 'string' ? loadedWorldFrom(text) : null;
    } catch {
        return null;
    }
}

/**
 * Keeps a file's text as the world the browser holds. A storage that refuses
 * it - too full to hold a large world - costs the world its place across a
 * reload and nothing else: it is still the world in use until then.
 *
 * Returns true when it was kept.
 */
export function writeLoadedWorld(storage, text) {
    try {
        storage?.setItem(LOADED_WORLD_STORAGE_KEY, text);
        return storage != null;
    } catch {
        return false;
    }
}

/**
 * The loaded world as the settings list draws it: its name in the list's
 * capitals, and a note saying what it is and what it was built on.
 */
export function loadedWorldEntry(loaded) {
    if (loaded == null) return null;
    return {
        label: loaded.name.toUpperCase(),
        note: `loaded from a file, built on ${getEnvironment(loaded.base).label}`
    };
}
