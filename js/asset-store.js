/**
 * What the browser keeps between sessions that is too large for localStorage -
 * in IndexedDB, database `pilot-matter`:
 *
 * - store `assets`, the loaded models, so a model loaded once is there after a
 *   reload;
 * - store `worlds`, the one world the builder last kept, under a key of its
 *   own, so the world flown after a reload is still the one that was built.
 *
 * localStorage cannot hold either: its few megabytes are shared with every
 * setting the page keeps, and a world carries the models it uses. IndexedDB
 * holds a file's bytes as they are.
 *
 * The kept world is held as the text of its environment file rather than as
 * the world itself, for the reason `js/loaded-world.js` holds the loaded world
 * that way: it is read back through `readEnvironmentDocument` every time, so a
 * kept world some later version would refuse is refused here too rather than
 * trusted for having been kept.
 *
 * Every call answers rather than throws: a browser with no IndexedDB, or one
 * refusing it, keeps nothing and lists nothing, and the page goes on with the
 * assets and the world it has in hand.
 */

export const ASSET_DATABASE = 'pilot-matter';
export const ASSET_STORE = 'assets';
export const WORLD_STORE = 'worlds';

/**
 * Version 2 adds `worlds` beside `assets`. The upgrade creates whichever store
 * is missing and touches neither's contents, so a browser holding assets kept
 * by version 1 still has them.
 */
export const ASSET_DATABASE_VERSION = 2;

/** The key the one kept world is held under, there being only ever the last one. */
export const KEPT_WORLD_KEY = 'kept';

/** The fields a kept asset holds - its bytes among them - and nothing the page works out from them again. */
export const KEPT_FIELDS = Object.freeze([
    'id', 'hash', 'name', 'format', 'bytes', 'raw', 'triangles', 'scale', 'up', 'facing', 'color', 'height', 'uses', 'fliesLike', 'section', 'added'
]);

/** The database, opened, or null where the browser will not open it. */
function openDatabase(idb = globalThis.indexedDB) {
    return new Promise(resolve => {
        if (!idb) return resolve(null);
        let request;
        try {
            request = idb.open(ASSET_DATABASE, ASSET_DATABASE_VERSION);
        } catch {
            return resolve(null);
        }
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(ASSET_STORE)) db.createObjectStore(ASSET_STORE, { keyPath: 'id' });
            if (!db.objectStoreNames.contains(WORLD_STORE)) db.createObjectStore(WORLD_STORE, { keyPath: 'id' });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
        request.onblocked = () => resolve(null);
    });
}

/**
 * One request against a store, answered as a promise of its result, or
 * `fallback` where it fails - a store the database does not hold among the
 * failures, since a transaction against a missing store throws where it is
 * opened.
 */
async function withStore(name, mode, work, fallback, idb) {
    const db = await openDatabase(idb);
    if (!db) return fallback;
    return new Promise(resolve => {
        try {
            const transaction = db.transaction(name, mode);
            const request = work(transaction.objectStore(name));
            transaction.oncomplete = () => { db.close(); resolve(request?.result ?? true); };
            transaction.onerror = () => { db.close(); resolve(fallback); };
            transaction.onabort = () => { db.close(); resolve(fallback); };
        } catch {
            db.close();
            resolve(fallback);
        }
    });
}

/** Every asset kept, oldest first - [] where nothing is or nothing can be. */
export async function readKeptAssets({ idb } = {}) {
    const all = await withStore(ASSET_STORE, 'readonly', store => store.getAll(), [], idb);
    return (Array.isArray(all) ? all : [])
        .map(record => ({ ...record, bytes: record.bytes instanceof Uint8Array ? record.bytes : new Uint8Array(record.bytes ?? []) }))
        .sort((a, b) => (a.added ?? 0) - (b.added ?? 0));
}

/** Keeps an asset, replacing one kept under its id. True where it was kept. */
export async function keepAsset(asset, { idb, now = Date.now() } = {}) {
    const record = {};
    for (const field of KEPT_FIELDS) if (asset[field] !== undefined) record[field] = asset[field];
    record.added = asset.added ?? now;
    record.bytes = asset.bytes instanceof Uint8Array ? asset.bytes : new Uint8Array(asset.bytes ?? []);
    const done = await withStore(ASSET_STORE, 'readwrite', store => store.put(record), false, idb);
    return done !== false;
}

/** Lets an asset go. True where it is gone. */
export async function forgetAsset(id, { idb } = {}) {
    const done = await withStore(ASSET_STORE, 'readwrite', store => store.delete(id), false, idb);
    return done !== false;
}

// --- The world the builder kept -------------------------------------------

/**
 * The text of the world the builder last kept, or null for none - and for a
 * browser that will not open the database.
 *
 * It is text rather than a world because that is what is kept: the caller
 * reads it back through the environment file's own reader, so nothing here has
 * to know what a world is made of.
 */
export async function readKeptWorld({ idb } = {}) {
    const record = await withStore(WORLD_STORE, 'readonly', store => store.get(KEPT_WORLD_KEY), null, idb);
    const text = record && typeof record === 'object' ? record.text : null;
    return typeof text === 'string' ? text : null;
}

/**
 * Keeps the text of a world as the one the browser holds, replacing whatever
 * was kept before - there being one kept world rather than a library of them,
 * which is the file on the pilot's own computer.
 *
 * True where it was kept. A browser refusing the write costs the world its
 * place across a reload and nothing else: it is still the world being flown
 * until then.
 */
export async function keepWorld(text, { idb, now = Date.now() } = {}) {
    if (typeof text !== 'string') return false;
    const record = { id: KEPT_WORLD_KEY, text, kept: now };
    const done = await withStore(WORLD_STORE, 'readwrite', store => store.put(record), false, idb);
    return done !== false;
}

/** Lets the kept world go, for a flight put back on a preset as it is. True where it is gone. */
export async function forgetKeptWorld({ idb } = {}) {
    const done = await withStore(WORLD_STORE, 'readwrite', store => store.delete(KEPT_WORLD_KEY), false, idb);
    return done !== false;
}
