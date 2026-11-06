/**
 * Environment files on the pilot's computer: written out, and chosen to be
 * read back. The one part of saving and loading that needs a browser - the
 * format, and every check a file is held to, are `js/environment-file.js`'s.
 *
 * Nothing here sends a file anywhere. A file chosen is read in the page, and a
 * file saved is handed to the browser's own dialog, or downloaded where there
 * is none.
 */

import { ENVIRONMENT_FILE_LIMIT } from './environment-file.js';

/** What the save dialog offers a file as, where the browser has one. */
export const ENVIRONMENT_FILE_TYPES = Object.freeze([
    Object.freeze({ description: 'Pilot Matter environment', accept: Object.freeze({ 'application/json': Object.freeze(['.json']) }) })
]);

/** What the file dialog lists when a world is loaded. */
export const ENVIRONMENT_FILE_ACCEPT = '.json,application/json';

/**
 * Writes a world's text to a file named `name`. Where the browser can ask the
 * pilot where to put it and under what name, it asks; elsewhere the file is
 * downloaded under `name`. Must be called from the press that asked for it,
 * which the browser requires of a dialog.
 *
 * Returns `{ saved: true, name }` with the name the file was written under,
 * `{ saved: false, cancelled: true }` when the pilot closed the dialog, or
 * `{ saved: false, error }`.
 */
export async function saveEnvironmentText(name, text, { win = globalThis } = {}) {
    if (typeof win.showSaveFilePicker === 'function') {
        try {
            const handle = await win.showSaveFilePicker({ suggestedName: name, types: ENVIRONMENT_FILE_TYPES });
            const writable = await handle.createWritable();
            await writable.write(text);
            await writable.close();
            return { saved: true, name: handle.name ?? name };
        } catch (error) {
            if (error?.name === 'AbortError') return { saved: false, cancelled: true };
            // A dialog the page is not allowed to open - a frame without the
            // permission, a browser that refuses it - is not a refusal of the
            // save, so the file is downloaded instead.
            if (error?.name !== 'SecurityError' && error?.name !== 'NotAllowedError') return { saved: false, error };
        }
    }

    try {
        const document = win.document;
        const url = win.URL.createObjectURL(new win.Blob([text], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        link.style.display = 'none';
        document.body.append(link);
        link.click();
        link.remove();
        // Let go of the file once the browser has had it.
        win.setTimeout(() => win.URL.revokeObjectURL(url), 30000);
        return { saved: true, name };
    } catch (error) {
        return { saved: false, error };
    }
}

/**
 * Opens the file dialog on `input` for a model, and reads the file chosen as
 * bytes, in the page - nothing is sent anywhere. Resolves `{ name, bytes }`,
 * `{ name, tooLarge: true }` for a file past `limit`, refused before it is
 * read, or null for a dialog closed with nothing chosen.
 */
export function pickAssetFile(input, { accept = '', limit = Infinity } = {}) {
    return new Promise((resolve) => {
        let settled = false;
        const finish = (value) => {
            if (settled) return;
            settled = true;
            input.removeEventListener('change', changed);
            input.removeEventListener('cancel', cancelled);
            resolve(value);
        };
        const cancelled = () => finish(null);
        const changed = async () => {
            const file = input.files?.[0];
            if (!file) return finish(null);
            if (file.size > limit) return finish({ name: file.name, tooLarge: true });
            try {
                finish({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
            } catch {
                finish({ name: file.name, bytes: null });
            }
        };
        input.accept = accept;
        input.value = '';
        input.addEventListener('change', changed);
        input.addEventListener('cancel', cancelled);
        input.click();
    });
}

/**
 * Opens the file dialog on `input` - an `<input type="file">` the page keeps -
 * and reads the file chosen. Must be called from the press that asked for it.
 *
 * Resolves `{ name, text }` for a file read, `{ name, tooLarge: true }` for one
 * larger than an environment may be - refused before it is read - and null for
 * a dialog closed with nothing chosen.
 */
export function pickEnvironmentFile(input) {
    return new Promise((resolve) => {
        let settled = false;
        const finish = (value) => {
            if (settled) return;
            settled = true;
            input.removeEventListener('change', changed);
            input.removeEventListener('cancel', cancelled);
            resolve(value);
        };
        const cancelled = () => finish(null);
        const changed = async () => {
            const file = input.files?.[0];
            if (!file) return finish(null);
            if (file.size > ENVIRONMENT_FILE_LIMIT) return finish({ name: file.name, tooLarge: true });
            try {
                finish({ name: file.name, text: await file.text() });
            } catch {
                finish({ name: file.name, text: null });
            }
        };

        input.accept = ENVIRONMENT_FILE_ACCEPT;
        input.value = '';
        input.addEventListener('change', changed);
        input.addEventListener('cancel', cancelled);
        input.click();
    });
}
