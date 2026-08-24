/**
 * Photo mode - `F2` takes a picture of the world and downloads it as a PNG.
 *
 * The picture is the frame the renderer draws, which never held an overlay in
 * the first place: the instruments, the menus, and the warnings are all page
 * elements over the canvas rather than pixels in it. What the key does is take
 * them off the screen for the one frame the picture is taken in, so what was on
 * screen at the shutter is what came out of it. A photo mode whose screen still
 * carried a HUD would be one that quietly lied about the file it wrote.
 *
 * The frame has to be read back before the browser has finished with it: a
 * drawing buffer is cleared once the frame is composited, so the picture is
 * taken in the same pass that drew it rather than on a timer afterwards.
 *
 * The state and the filename are pure and have no DOM or Three.js dependency,
 * so they can be unit tested in Node; `savePhoto` is the one function that
 * touches a page, and it is handed the canvas and the document rather than
 * reaching for them.
 */

export const PHOTO_KEY = 'F2';

// What every picture is named after, before the moment it was taken.
export const PHOTO_NAME = 'pilot-matter';

export function isPhotoKey(code) {
    return code === PHOTO_KEY;
}

export function createPhotoState() {
    return { pending: false, taken: 0 };
}

/** True while a picture has been asked for and not yet taken. */
export function photoPending(state) {
    return state.pending === true;
}

/**
 * Asks for a picture of the next frame. A second ask before the first is taken
 * changes nothing, so a key held down is one photograph rather than one per
 * frame the browser repeats it on.
 *
 * Returns true when this call asked for one.
 */
export function requestPhoto(state) {
    if (state.pending) return false;
    state.pending = true;
    return true;
}

/**
 * Marks the picture taken, whether or not the browser accepted the download:
 * a request that stayed pending would clear the screen of every frame after it.
 *
 * Returns how many have been taken this session.
 */
export function completePhoto(state) {
    state.pending = false;
    return ++state.taken;
}

/**
 * Applies a key event to photo mode. Key releases and auto-repeat are ignored,
 * so holding the key does not fill a downloads folder.
 *
 * Returns true when a picture was asked for.
 */
export function applyPhotoKey(state, code, down, repeat = false) {
    if (!down || repeat || !isPhotoKey(code)) return false;
    return requestPhoto(state);
}

/**
 * What a picture is saved as: the game's name and the moment it was taken, in
 * the local time the pilot was flying in, as one sortable string. Two pictures
 * taken inside the same second share a name and the browser numbers the second
 * one, which is the same thing it does for any other repeated download.
 */
export function photoFilename(stamp = new Date(), name = PHOTO_NAME) {
    const at = stamp instanceof Date ? stamp : new Date(stamp);
    const pad = (value, width = 2) => String(value).padStart(width, '0');

    const date = `${pad(at.getFullYear(), 4)}${pad(at.getMonth() + 1)}${pad(at.getDate())}`;
    const time = `${pad(at.getHours())}${pad(at.getMinutes())}${pad(at.getSeconds())}`;

    return `${name}-${date}-${time}.png`;
}

/**
 * Downloads what a canvas is holding as a PNG, through a link the page clicks
 * for itself and then drops. A canvas that refuses to be read - which is what a
 * frame drawn from somewhere else does - costs the pilot the picture and
 * nothing else, so the flight goes on.
 *
 * Returns true when the download was handed to the browser.
 */
export function savePhoto(canvas, filename = photoFilename(), doc = globalThis.document) {
    try {
        const url = canvas.toDataURL('image/png');
        const link = doc.createElement('a');

        link.href = url;
        link.download = filename;
        doc.body.appendChild(link);
        link.click();
        link.remove();

        return true;
    } catch {
        return false;
    }
}
