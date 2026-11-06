/**
 * The loaded assets the browser keeps - in IndexedDB, database `pilot-matter`,
 * store `assets` - so a model loaded once is there after a reload.
 *
 * localStorage cannot hold a model: its few megabytes are shared with every
 * setting the page keeps. IndexedDB holds a file's bytes as they are.
 *
 * Every call answers rather than throws: a browser with no IndexedDB, or one
 * refusing it, keeps nothing and lists nothing, and the page goes on with the
 * assets it has in hand.
 */

export const ASSET_DATABASE = 'pilot-matter';
export const ASSET_STORE = 'assets';
export const ASSET_DATABASE_VERSION = 1;

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
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
        request.onblocked = () => resolve(null);
    });
}

/** One request against the store, answered as a promise of its result, or `fallback` where it fails. */
async function withStore(mode, work, fallback, idb) {
    const db = await openDatabase(idb);
    if (!db) return fallback;
    return new Promise(resolve => {
        try {
            const transaction = db.transaction(ASSET_STORE, mode);
            const request = work(transaction.objectStore(ASSET_STORE));
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
    const all = await withStore('readonly', store => store.getAll(), [], idb);
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
    const done = await withStore('readwrite', store => store.put(record), false, idb);
    return done !== false;
}

/** Lets an asset go. True where it is gone. */
export async function forgetAsset(id, { idb } = {}) {
    const done = await withStore('readwrite', store => store.delete(id), false, idb);
    return done !== false;
}
