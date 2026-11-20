/**
 * The outliner's three fields - a placement's own name, and whether it is
 * hidden or locked.
 *
 * They live apart from everything that reads them because everything that
 * reads them lives apart: the dock lists them, the canvas leaves a hidden
 * placement out of what it draws, the pick refuses a hidden or a locked one,
 * `resolveErasures` takes no cut out of a locked one, and the environment file
 * carries all three. Holding them in `js/build-panel.js` would have
 * `js/environment/erase.js` importing the dock to ask whether a placement is
 * locked.
 *
 * **Hidden and locked are building aids, not description.** A hidden placement
 * is still flown - it is only off the canvas while the world is being worked
 * on - and a lock stops the editor's tools reaching a placement rather than
 * saying anything about the ground it draws. The one place that is not quite
 * true is Erase, which is a region cut at the moment the ground is composited
 * rather than at the moment the stroke was laid: a lock lifts the cut a batch
 * was making, and unlocking puts it back. That is the reading that makes a
 * lock reversible, which is what a building aid has to be.
 *
 * Both are carried in the file, so a world opened again is the world as it was
 * being worked on, down to what was folded away.
 *
 * Pure module with no imports at all, so any module may read it.
 */

/**
 * The longest a placement's own name may be. Short, because the dock's rows
 * are 300 pixels wide and a name is read beside the type it is a name for.
 */
export const PLACEMENT_NAME_LIMIT = 40;

/**
 * A name as a placement carries one: trimmed, its runs of space collapsed, and
 * held to its length. `''` for anything that is not a name, which is how a
 * placement with no name of its own is written - the outliner then shows the
 * type's own label instead.
 */
export function cleanPlacementName(name) {
    if (typeof name !== 'string') return '';
    return name.replace(/\s+/g, ' ').trim().slice(0, PLACEMENT_NAME_LIMIT).trim();
}

/** A placement's own name, or `''` for one that has none. */
export function placementName(placement) {
    return cleanPlacementName(placement?.name);
}

/**
 * What a row shows a placement as: its own name, or `fallback` - the type's
 * label - for one never named.
 */
export function placementNamed(placement, fallback = '') {
    return placementName(placement) || fallback;
}

/** True for a placement hidden from the canvas while it is being built. */
export function placementHidden(placement) {
    return placement?.hidden === true;
}

/** True for a placement locked against Select and Erase. */
export function placementLocked(placement) {
    return placement?.locked === true;
}

/**
 * True for a placement a press on the canvas may find: one that is neither
 * hidden - what is not drawn cannot be clicked on - nor locked, which is the
 * whole of what a lock does to a pick.
 */
export function placementPickable(placement) {
    return !placementHidden(placement) && !placementLocked(placement);
}

/**
 * A placement with one of the three fields written, as a copy: `name`,
 * `hidden` or `locked`. A field set to nothing - an empty name, or either box
 * turned off - is deleted rather than written false, so a placement nobody
 * touched and one turned back is the one description, and a file carries only
 * what was actually set.
 */
export function withPlacementField(placement, field, value) {
    const written = { ...placement };
    if (field === 'name') {
        const name = cleanPlacementName(value);
        if (name === '') delete written.name;
        else written.name = name;
        return written;
    }
    if (field !== 'hidden' && field !== 'locked') return written;
    if (value === true) written[field] = true;
    else delete written[field];
    return written;
}
