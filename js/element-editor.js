/**
 * The element editor - the panel the `L` key opens, listing the elements the
 * world being flown was assembled from and letting each of their declared
 * ranges be moved. Change one and the ground is generated again from the
 * algorithm, which is the whole point of an environment being a description
 * rather than a mesh: there is nothing to re-author, only a number to move.
 *
 * Pure module with no DOM or Three.js dependency. It works on the registry in
 * `js/environment/elements.js` and the presets in `js/environment/presets.js`,
 * and hands back the placements a caller passes to `buildEnvironment`, so what
 * is here can be unit tested in Node and the drawing of it is somebody else's
 * job.
 *
 * The panel is a keyboard menu like the settings panel, so what is listed here
 * is entries rather than widgets and `js/menu.js` moves the cursor over them.
 * An element is a row that opens onto its ranges, and a range is a row stepped
 * along the bounds the registry declared it with - so no edit can ask an
 * element for something it does not support.
 */

import {
    ELEMENTS_BY_ID, getElement, orderPlacements, resolveConfig
} from './environment/elements.js';
import { getEnvironment, environmentElements } from './environment/presets.js';
import { OPTION_LEFT_MARK, OPTION_RIGHT_MARK } from './settings.js';

export const EDITOR_TITLE = 'ELEMENT EDITOR';
export const EDITOR_HEADING = 'PLACED ELEMENTS';

// `L` for the level editor this is the lightest version of. Every other letter
// the panel might have wanted already flies the aircraft.
export const EDITOR_OPEN_KEYS  = ['KeyL'];
export const EDITOR_CLOSE_KEYS = ['Escape', 'Backspace'];

export function isEditorOpenKey(code) {
    return EDITOR_OPEN_KEYS.includes(code);
}

export function isEditorCloseKey(code) {
    return EDITOR_CLOSE_KEYS.includes(code);
}

// What a row of the panel is: an element that opens onto its ranges, one of
// those ranges, the way back to how the preset had it, or the way out.
export const ELEMENT_ENTRY = 'element';
export const RANGE_ENTRY   = 'range';
export const RESTORE_ENTRY = 'restore';
export const BACK_ENTRY    = 'back';

export const EDITOR_RESTORE_ID    = 'restore';
export const EDITOR_RESTORE_LABEL = 'RESTORE THE PRESET';
export const EDITOR_RESTORE_NOTE  = 'put every range back to what the world was assembled with';

export const EDITOR_BACK_ID    = 'back';
export const EDITOR_BACK_LABEL = 'BACK';

// An element reads as the box it is, so a row says whether its ranges are
// showing without having to be under the cursor.
export const ELEMENT_OPEN_MARK  = '[-]';
export const ELEMENT_SHUT_MARK  = '[+]';

// What an element's row says when the world had to hold it off the strip. The
// runway is the one piece of ground a flight depends on existing, so it is the
// one the editor may not edit around - and a range moved until it reached the
// strip has to read as refused rather than as quietly ignored.
export const EDITOR_CLEARED_NOTE = 'held off the runway';

/**
 * How far one press moves a range: a fiftieth of what the range allows, put on
 * the nearest of 1, 2, or 5 times a power of ten, so a peak height in the
 * hundreds moves by fifties and a ratio between nothing and one moves by
 * hundredths. Read off the declared bounds rather than configured, because a
 * step is a property of the range rather than another thing to keep in sync
 * with it.
 */
export const RANGE_STEPS = 50;

export function rangeStep(range) {
    const raw = Math.abs(range.high - range.low) / RANGE_STEPS;
    if (!(raw > 0)) return 1;

    const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
    for (const nice of [1, 2, 5]) {
        if (raw <= nice * magnitude) return nice * magnitude;
    }
    return 10 * magnitude;
}

/**
 * How many decimal places a step is written to, which is also how many the
 * value it moves is rounded back to. A hundredth walked twenty times is not a
 * fifth unless it is put back on its own scale each time, and a readout
 * carrying the arithmetic's dust is a readout nobody trusts.
 */
export function stepPlaces(step) {
    return Math.max(0, -Math.floor(Math.log10(Math.abs(step))));
}

function clamp(value, low, high) {
    return Math.min(Math.max(value, low), high);
}

function moveValue(value, step, low, high) {
    return Number(clamp(value + step, low, high).toFixed(stepPlaces(step)));
}

// --- Colour ----------------------------------------------------------------

/**
 * How far either end of a gradient can be moved, as a multiple of the colour
 * the preset laid it down in.
 *
 * A colour is stepped along its own hue rather than around the wheel: the
 * arrow keys lighten and darken an end of a gradient and nothing else. Two
 * keys cannot walk a colour wheel and leave an element recognisable, and the
 * gradient helper exists precisely so no element shifts colour dramatically
 * across the ground it covers - an editor that let one do it with two presses
 * would be undoing the thing it is editing.
 */
export const SHADE_RANGE = { kind: 'scalar', low: 0.2, high: 2, default: 1 };

/** A colour lightened or darkened, kept inside what a colour channel holds. */
export function shadeColor(color, shade) {
    return color.map(channel => clamp(channel * shade, 0, 1));
}

// --- The rows an element's ranges are drawn as -----------------------------

/**
 * The rows one declared range is drawn as, and what each of them reads and
 * writes in the element's configuration.
 *
 * A span is two rows, because a span is two numbers and the pilot means to
 * move one of them. A gradient is two rows for the same reason, one per end.
 * Everything else is one row and one number.
 */
export function rangeRows(name, range) {
    if (range.kind === 'span') {
        return [
            { part: 'min', label: `${label(name)} MIN`, range, at: 0 },
            { part: 'max', label: `${label(name)} MAX`, range, at: 1 }
        ];
    }

    if (range.kind === 'gradient') {
        return [
            { part: 'light', label: `${label(name)} LIGHT`, range: SHADE_RANGE, shade: 'light' },
            { part: 'dark',  label: `${label(name)} DARK`,  range: SHADE_RANGE, shade: 'dark'  }
        ];
    }

    return [{ part: 'value', label: label(name), range }];
}

/** A range's name as the panel writes it: `treeHeight` reads as `TREE HEIGHT`. */
export function label(name) {
    return name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toUpperCase();
}

// --- The world being edited ------------------------------------------------

/**
 * The elements an environment places, as the editor holds them: every range
 * resolved to a concrete value, in the order the pipeline applies them, and
 * copied rather than referenced so editing a world never edits the preset it
 * was described by.
 *
 * A gradient is held as the shade either end is being drawn at rather than as
 * the colour itself, so the colour the preset chose stays the thing the row is
 * measured against however far it has been moved.
 */
export function editorElements(environment, runway = false) {
    const placed = orderPlacements(environmentElements(environment, runway))
        .filter(placement => ELEMENTS_BY_ID.has(placement.type));

    return placed.map((placement, at) => {
        const element = getElement(placement.type);
        return {
            id: `${placement.type}-${at}`,
            type: placement.type,
            label: label(placement.type),
            note: elementNote(element),
            open: false,
            config: resolveConfig(element, placement.config),
            base: resolveConfig(element, placement.config),
            shades: shadeDefaults(element)
        };
    });
}

/** What an element's row says about it: the ranges it can be moved along. */
function elementNote(element) {
    const names = Object.keys(element.ranges).map(label);
    return names.length > 0 ? names.join(', ').toLowerCase() : 'nothing to configure';
}

function shadeDefaults(element) {
    const shades = {};
    for (const [name, range] of Object.entries(element.ranges)) {
        if (range.kind === 'gradient') shades[name] = { light: 1, dark: 1 };
    }
    return shades;
}

export function createEditorState(environmentId, runway = false) {
    const state = {
        open: false,
        environmentId: null,
        runway: null,
        elements: [],
        // The element types the generated world had to hold off the strip, as
        // the strip itself reported them. Filled in by the caller after the
        // ground is built, because only the built ground knows.
        cleared: [],
        entries: []
    };

    setEditorWorld(state, environmentId, runway);
    return state;
}

/**
 * Puts the editor on a world.
 *
 * Edits belong to the world they were made on: choosing another environment,
 * or turning the strip on, is a different set of elements, and carrying a
 * mountain's height range across to it would be carrying it onto ground that
 * never had that mountain. So a different world empties the panel and fills it
 * again from the preset, and the same world leaves the pilot's edits alone.
 *
 * Returns true when the panel was rebuilt.
 */
export function setEditorWorld(state, environmentId, runway = false) {
    const wanted = getEnvironment(environmentId).id;
    const strip  = runway === true;

    if (state.environmentId === wanted && state.runway === strip) return false;

    state.environmentId = wanted;
    state.runway = strip;
    state.elements = editorElements(getEnvironment(wanted), strip);
    syncEditorEntries(state);

    return true;
}

/** True when the world had to hold an element off the strip it cut. */
export function heldOffRunway(state, type) {
    return (state.cleared ?? []).includes(type);
}

/**
 * Records which elements the generated world held off the strip, so the panel
 * can say which one was refused rather than leaving a range that looks applied
 * and is not.
 *
 * Returns true when what is held changed, which is the caller's cue to draw the
 * panel again.
 */
export function setEditorClearance(state, cleared = []) {
    const held = [...new Set(cleared ?? [])].filter(type => ELEMENTS_BY_ID.has(type));
    const was  = state.cleared ?? [];
    if (held.length === was.length && held.every(type => was.includes(type))) return false;

    state.cleared = held;
    syncEditorEntries(state);
    return true;
}

/** Every range back to what the world was assembled with, edits and all. */
export function restoreEditor(state) {
    for (const element of state.elements) {
        element.config = structuredCloneConfig(element.base);
        element.shades = resetShades(element.shades);
    }
    syncEditorEntries(state);
    return state;
}

function structuredCloneConfig(config) {
    const copy = {};
    for (const [name, value] of Object.entries(config)) {
        if (Array.isArray(value)) copy[name] = [...value];
        else if (value && typeof value === 'object') {
            copy[name] = { light: [...value.light], dark: [...value.dark] };
        } else copy[name] = value;
    }
    return copy;
}

function resetShades(shades) {
    const reset = {};
    for (const name of Object.keys(shades)) reset[name] = { light: 1, dark: 1 };
    return reset;
}

export function editorShowing(state) {
    return state.open === true;
}

export function openEditor(state) {
    const changed = !state.open;
    state.open = true;
    syncEditorEntries(state);
    return changed;
}

export function closeEditor(state) {
    const changed = state.open;
    state.open = false;
    return changed;
}

// --- The panel's rows ------------------------------------------------------

export function rowId(elementId, name, part) {
    return `${elementId}:${name}:${part}`;
}

/** What a range row is currently reading, in the element's configuration. */
export function rowValue(element, name, row) {
    if (row.shade) return element.shades[name][row.shade];
    if (row.at != null) return element.config[name][row.at];
    return element.config[name];
}

/**
 * What the panel writes beside a range: the reading, kept to the precision the
 * step moves it by, and a shade as the percentage of the preset's colour it is
 * being drawn at.
 */
export function rowValueLabel(row, value) {
    if (row.shade) return `${Math.round(value * 100)}%`;
    return value.toFixed(stepPlaces(rangeStep(row.range)));
}

export function elementEntryText(element) {
    return `${element.open ? ELEMENT_OPEN_MARK : ELEMENT_SHUT_MARK} ${element.label}`;
}

export function rangeEntryText(entry) {
    return `${entry.label}  ${OPTION_LEFT_MARK} ${entry.valueLabel} ${OPTION_RIGHT_MARK}`;
}

/**
 * The panel's rows: every element the world places, the ranges of whichever of
 * them are open, the way back to the preset, and the way out.
 *
 * Only an open element's ranges are listed. Five worlds place up to eight
 * elements declaring five ranges each, and a panel that listed all of them at
 * once would be a panel nobody could find anything in.
 */
export function editorEntries(state) {
    const entries = [];

    for (const element of state.elements) {
        entries.push({
            kind: ELEMENT_ENTRY,
            id: element.id,
            element: element.id,
            label: element.label,
            note: heldOffRunway(state, element.type)
                ? `${EDITOR_CLEARED_NOTE}  ·  ${element.note}`
                : element.note,
            current: element.open,
            text: elementEntryText(element)
        });

        if (!element.open) continue;

        for (const [name, range] of Object.entries(getElement(element.type).ranges)) {
            for (const row of rangeRows(name, range)) {
                const value = rowValue(element, name, row);
                const entry = {
                    kind: RANGE_ENTRY,
                    id: rowId(element.id, name, row.part),
                    element: element.id,
                    name,
                    row,
                    label: row.label,
                    note: '',
                    value,
                    valueLabel: rowValueLabel(row, value),
                    current: false
                };
                entry.text = rangeEntryText(entry);
                entries.push(entry);
            }
        }
    }

    entries.push({
        kind: RESTORE_ENTRY, id: EDITOR_RESTORE_ID,
        label: EDITOR_RESTORE_LABEL, note: EDITOR_RESTORE_NOTE, current: false
    });
    entries.push({
        kind: BACK_ENTRY, id: EDITOR_BACK_ID, label: EDITOR_BACK_LABEL, note: '', current: false
    });

    return entries;
}

/** Draws the list again from the elements behind it. */
export function syncEditorEntries(state) {
    state.entries = editorEntries(state);
    return state.entries;
}

export function editorEntry(state, id) {
    return state.entries?.find(entry => entry.id === id) ?? null;
}

/** The element a row belongs to, or null for a row that belongs to none. */
export function editorElement(state, id) {
    return state.elements.find(element => element.id === id) ?? null;
}

// --- Working the panel -----------------------------------------------------

/**
 * Steps a range along the bounds it was declared with. Everything else is left
 * alone, so the arrow keys mean nothing on an element's own row or on the way
 * out.
 *
 * A span cannot be crossed over itself: raising a minimum stops at the maximum
 * and lowering a maximum stops at the minimum, because a range whose ends have
 * swapped is a range the generator has to guess about.
 *
 * Returns the id of the element that changed, so the caller knows the ground
 * has to be drawn again, and null when nothing moved.
 */
export function adjustEditorRange(state, id, step) {
    if (!step) return null;

    const entry = editorEntry(state, id);
    if (entry?.kind !== RANGE_ENTRY) return null;

    const element = editorElement(state, entry.element);
    if (!element) return null;

    const { row, name } = entry;
    const range = row.range;
    const moved = moveValue(rowValue(element, name, row), step * rangeStep(range), range.low, range.high);
    if (moved === rowValue(element, name, row)) return null;

    if (row.shade) {
        element.shades[name][row.shade] = moved;
        element.config[name][row.shade] = shadeColor(element.base[name][row.shade], moved);
    } else if (row.at != null) {
        const span = element.config[name];
        span[row.at] = row.at === 0 ? Math.min(moved, span[1]) : Math.max(moved, span[0]);
    } else {
        element.config[name] = moved;
    }

    syncEditorEntries(state);
    return element.id;
}

/**
 * Applies the entry chosen in the panel.
 *
 * What comes back is what the caller has to do about the ground, rather than
 * what happened to the panel: `EDITOR_BACK_ID` when the panel was closed,
 * `EDITOR_RESTORE_ID` when the preset was put back, an element's id when one
 * of its ranges was stepped, and null when the world is unchanged.
 *
 * Opening an element is one of those nulls. The panel is a row longer for it,
 * which the caller draws again either way, but the ground is the ground it
 * already was - and generating the world again to show the same world would
 * cost a stall for nothing.
 *
 * An element's own row has no value to step, so choosing it opens its ranges
 * rather than doing nothing, which is the one thing a row under the cursor
 * should never do.
 *
 * `step` is which way the choice moves a range, for a caller that knows - a
 * click on the left of the row moves it down and a click on the right moves it
 * up, which is what the marks either side of the reading say the row does. A
 * key press knows nothing about halves of a row and takes the default.
 */
export function chooseEditorEntry(state, id, step = 1) {
    if (id === EDITOR_BACK_ID) {
        closeEditor(state);
        return EDITOR_BACK_ID;
    }

    if (id === EDITOR_RESTORE_ID) {
        restoreEditor(state);
        return EDITOR_RESTORE_ID;
    }

    const entry = editorEntry(state, id);
    if (entry?.kind === RANGE_ENTRY) return adjustEditorRange(state, id, step);

    const element = editorElement(state, id);
    if (!element) return null;

    element.open = !element.open;
    syncEditorEntries(state);
    return null;
}

/**
 * The world the panel is describing, as the placements `buildEnvironment`
 * takes. This is the whole of what the editor hands out: the ground is
 * generated from it by the same algorithm that generates a preset's, because
 * an edited world is a description like any other rather than a special case
 * downstream of one.
 *
 * Every configuration is copied on the way out. What a caller is handed is a
 * description of the world as it stands rather than a handle on the panel: the
 * ranges go on being stepped under the arrow keys, and a caller that kept the
 * live object would find the world it recorded changing underneath it.
 */
export function editorPlacements(state) {
    return state.elements.map(element => ({
        type: element.type,
        config: structuredCloneConfig(element.config)
    }));
}
