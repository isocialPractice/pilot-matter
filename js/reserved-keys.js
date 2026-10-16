/**
 * Reserved keys - the keys the game already reads for itself, which are
 * therefore not the key map's to take.
 *
 * `rebind` in `js/key-bindings.js` refuses a key another row holds, and for a
 * long time that was the whole of what it refused: the ten bindings in the map.
 * Every key the game reads outside that map was invisible to it, so a control
 * surface could be bound onto one and one press then did both things - an
 * aircraft that paused itself when it rolled right, with nothing on the row to
 * say so. Two listeners read the one press and neither knows of the other, so
 * the refusal belongs here, before a key with two meanings can be written into
 * the map at all.
 *
 * Each key lives beside the thing it works, which is right: `PAUSE_KEY` belongs
 * to the pause and not to a list of keys somewhere else. So this module gathers
 * them by importing them rather than by writing the codes out again. A second
 * copy of `'KeyP'` is how such a list comes to disagree with `js/pause.js`, and
 * it disagrees silently, which is the failure this whole module is about.
 *
 * The camera key is the one that had no constant to import: it was a literal
 * inside the camera's own listener, and a list built from constants cannot see
 * a key that is not one, so it was the key of this kind that the first reading
 * of the problem missed. It is `CAMERA_CYCLE_KEY` in `js/camera-math.js` now,
 * beside the mode names, because `js/camera.js` pulls in a renderer and nothing
 * in here may.
 *
 * Pure module with no DOM or Three.js dependency, like every module it reads a
 * key from.
 */

import { HUD_TOGGLE_KEY }    from './hud-visibility.js';
import { PAUSE_KEY }         from './pause.js';
import { HELP_KEY }          from './controls-help.js';
import { MUTE_KEY }          from './audio.js';
import { SETTINGS_OPEN_KEYS } from './settings.js';
import { EDITOR_OPEN_KEYS }  from './element-editor.js';
import { PHOTO_KEY }         from './photo.js';
import { CAMERA_CYCLE_KEY }  from './camera-math.js';

/**
 * What each reserved key is already doing, in the words a refused row reads
 * with: the panel writes `P IS PAUSE` the way it already writes
 * `W IS PITCH UP`, so a pilot reads one sentence in both cases.
 *
 * Built on first use rather than at module load, and that is not a style
 * choice. `js/controls-help.js` imports this module's neighbour
 * `js/key-bindings.js` for its own key labels, and `js/key-bindings.js` imports
 * this module, so the three are a cycle. A top-level list naming `HELP_KEY`
 * reads it before `js/controls-help.js` has initialized it whenever that module
 * is the one entered first - which `test/controls-help.test.js` does - and the
 * whole suite dies on `Cannot access 'HELP_KEY' before initialization`. A
 * function body runs after every module in the graph is evaluated, so reading
 * the constants from in here is always safe.
 */
function reservedRoles() {
    return [
        { role: 'INSTRUMENTS',    codes: [HUD_TOGGLE_KEY] },
        { role: 'PAUSE',          codes: [PAUSE_KEY] },
        { role: 'CONTROL LIST',   codes: [HELP_KEY] },
        { role: 'MUTE',           codes: [MUTE_KEY] },
        { role: 'SETTINGS',       codes: [...SETTINGS_OPEN_KEYS] },
        { role: 'ELEMENT EDITOR', codes: [...EDITOR_OPEN_KEYS] },
        { role: 'PHOTO',          codes: [PHOTO_KEY] },
        { role: 'CAMERA',         codes: [CAMERA_CYCLE_KEY] }
    ];
}

// Worked out once and held, because `rebind` asks on every press and the answer
// cannot change: each constant is read at module load by the module that owns
// it and nothing rewrites it afterwards.
let roleByCode = null;

function reservedIndex() {
    if (roleByCode == null) {
        roleByCode = new Map();
        for (const { role, codes } of reservedRoles()) {
            for (const code of codes) {
                if (typeof code === 'string' && code.length > 0 && !roleByCode.has(code)) {
                    roleByCode.set(code, role);
                }
            }
        }
    }

    return roleByCode;
}

/**
 * Every key the game reads for itself, as the codes it reads them on.
 *
 * A list rather than the constants themselves because a caller wants the
 * question "is this key spoken for" answered once, and because a role that is
 * one key today is two the day a second way to open the settings is added -
 * which is why the roles above carry lists rather than codes.
 */
export function reservedKeys() {
    return Object.freeze([...reservedIndex().keys()]);
}

/** What a reserved key is already doing, or null for a key the game ignores. */
export function reservedRole(code) {
    return reservedIndex().get(code) ?? null;
}

/** True for a key the game reads for itself, which no row may take. */
export function isReservedKey(code) {
    return reservedIndex().has(code);
}
