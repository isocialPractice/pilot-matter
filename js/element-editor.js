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
import {
    typedCharacter, startsTypedValue, readTypedKey, typedValueLabel
} from './typed-value.js';

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
    // A range may name its own step, for a row where a fiftieth of the bounds
    // is the wrong press: a switch is two values and has to move between them
    // in one, rather than crawl from off to on in fifty hundredths.
    if (range.step > 0) return range.step;

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

// --- The switch on a gated range -------------------------------------------

/**
 * The row a gated range's switch is drawn as.
 *
 * It is a range like any other so the one stepper, the one typing path and the
 * one clamp all reach it - the panel has no second kind of row, and a switch
 * that needed one would need its own key handling, its own refusal notice and
 * its own place in every test that walks the rows. What it declares instead is
 * a step of its own: without it a press would move a fiftieth of the way from
 * off to on, which is a switch nobody can work.
 */
export const GATE_RANGE = { kind: 'scalar', low: 0, high: 1, default: 0, step: 1 };

/** What the switch reads as, which is a word rather than the number behind it. */
export const GATE_ON_LABEL  = 'ON';
export const GATE_OFF_LABEL = 'OFF';

/** True once the switch has been moved far enough to count as thrown. */
export function gateOn(value) {
    return Number(value) >= 0.5;
}

// --- The rows an element's ranges are drawn as -----------------------------

/**
 * The rows one declared range is drawn as, and what each of them reads and
 * writes in the element's configuration.
 *
 * A span is two rows, because a span is two numbers and the pilot means to
 * move one of them. A gradient is two rows for the same reason, one per end.
 * A gated range is three: the switch, and then the two bounds it turns on.
 * Everything else is one row and one number.
 */
export function rangeRows(name, range) {
    if (range.kind === 'span') {
        return [
            { part: 'min', label: `${label(name)} MIN`, range, at: 0 },
            { part: 'max', label: `${label(name)} MAX`, range, at: 1 }
        ];
    }

    // The switch is listed above the bounds it governs, so a reader meets the
    // question before the two answers to it. The bounds stay listed while it is
    // off: a pilot setting a footprint sets the numbers and then turns it on as
    // often as the other way round, and a pair of rows that appeared and
    // disappeared under the cursor would move every row below them.
    if (range.kind === 'gated') {
        return [
            { part: 'on',  label: label(name),           range: GATE_RANGE, gate: true },
            { part: 'min', label: `${label(name)} MIN`,  range, gated: true, at: 0 },
            { part: 'max', label: `${label(name)} MAX`,  range, gated: true, at: 1 }
        ];
    }

    // A mode is the switch and nothing else, so it is the gate row without the
    // two bounds under it. `bare` is what says the switch is the whole value
    // rather than one half of a pair: everything else about the row - the step
    // of 1, the word it reads as, the notice it refuses a figure with - is the
    // gate's, because a switch is a switch whatever it is switching.
    if (range.kind === 'toggle') {
        return [{ part: 'on', label: label(name), range: GATE_RANGE, gate: true, bare: true }];
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
        // Which row is being typed into, what has been typed, and the bounds a
        // refused press was measured against. Emptied when the panel opens and
        // when it closes, so a figure left unfinished is never what the next
        // digit pressed at the panel carries on from.
        typing: null,
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
    // A different world is a different set of rows, so a figure being typed into
    // one of the old ones has nowhere left to land.
    state.typing = null;
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
    // Putting the preset back is the opposite of setting a figure by hand, so a
    // figure half typed when it is asked for is given up on rather than left to
    // be committed over the world that has just been restored.
    state.typing = null;
    syncEditorEntries(state);
    return state;
}

function structuredCloneConfig(config) {
    const copy = {};
    for (const [name, value] of Object.entries(config)) {
        if (Array.isArray(value)) copy[name] = [...value];
        // Read before the gradient below rather than after it. A resolved
        // gradient and a resolved gated range are both plain objects, so the
        // last branch cannot be "an object, therefore a gradient" any more -
        // read that way a gated range is copied by spreading a `light` that is
        // not there, which throws rather than copying the wrong thing.
        else if (Array.isArray(value?.range)) copy[name] = { on: value.on, range: [...value.range] };
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
    state.typing = null;
    syncEditorEntries(state);
    return changed;
}

export function closeEditor(state) {
    const changed = state.open;
    state.open = false;
    state.typing = null;
    syncEditorEntries(state);
    return changed;
}

// --- The panel's rows ------------------------------------------------------

export function rowId(elementId, name, part) {
    return `${elementId}:${name}:${part}`;
}

/** What a range row is currently reading, in the element's configuration. */
export function rowValue(element, name, row) {
    if (row.shade) return element.shades[name][row.shade];
    // Both read before `row.at`, which a gated bound carries too: a gated
    // range holds its pair one level in, under `range`, so reading it as a span
    // would read the `on` and the `range` as the two bounds.
    if (row.gate) {
        return (row.bare ? element.config[name] : element.config[name].on) ? 1 : 0;
    }
    if (row.gated) return element.config[name].range[row.at];
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
    if (row.gate) return gateOn(value) ? GATE_ON_LABEL : GATE_OFF_LABEL;
    return value.toFixed(stepPlaces(rangeStep(row.range)));
}

export function elementEntryText(element) {
    return `${element.open ? ELEMENT_OPEN_MARK : ELEMENT_SHUT_MARK} ${element.label}`;
}

export function rangeEntryText(entry) {
    // A row being typed into is not being stepped, so the marks that say it is
    // come off while the typing is in hand - the same reading the settings
    // panel gives a row of its own being typed into.
    if (entry.typing) return `${entry.label}  ${entry.valueLabel}`;
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
                const value  = rowValue(element, name, row);
                const id     = rowId(element.id, name, row.part);
                const typing = state.typing?.id === id ? state.typing : null;
                const entry = {
                    kind: RANGE_ENTRY,
                    id,
                    element: element.id,
                    name,
                    row,
                    label: row.label,
                    note: '',
                    value,
                    typing: typing != null,
                    valueLabel: typing
                        ? (typing.notice ?? typedValueLabel(typing.text))
                        : rowValueLabel(row, value),
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

    writeRowValue(element, name, row, moved);
    syncEditorEntries(state);
    return element.id;
}

/**
 * Writes one number into the element behind the row that holds it, whichever
 * way the pilot arrived at it.
 *
 * A span cannot be crossed over itself: raising a minimum stops at the maximum
 * and lowering a maximum stops at the minimum, because a range whose ends have
 * swapped is a range the generator has to guess about. A gradient end is held as
 * the shade it is being drawn at, and the colour is worked out from the one the
 * preset laid down, so the preset stays the thing the row is measured against.
 *
 * It is one function rather than a branch in each caller because the stepper and
 * the typing both end here: a typed figure that skipped the span rule would be a
 * way of writing a crossed-over range that stepping cannot produce.
 */
function writeRowValue(element, name, row, value) {
    if (row.shade) {
        element.shades[name][row.shade] = value;
        element.config[name][row.shade] = shadeColor(element.base[name][row.shade], value);
        return;
    }

    if (row.gate) {
        const on = gateOn(value);
        if (row.bare) element.config[name] = on;
        else element.config[name].on = on;
        return;
    }

    if (row.gated) {
        writePair(element.config[name].range, row.at, value);
        return;
    }

    if (row.at != null) {
        writePair(element.config[name], row.at, value);
        return;
    }

    element.config[name] = value;
}

/** One end of a pair of bounds, held to the other so the pair cannot cross. */
function writePair(pair, at, value) {
    pair[at] = at === 0 ? Math.min(value, pair[1]) : Math.max(value, pair[0]);
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

// --- Typing a number into a row --------------------------------------------

/**
 * The value a typed figure stands for, in the units the row reads in.
 *
 * Every row but a gradient end reads the number it holds, so the figure is the
 * value. A gradient end reads as the percentage of the preset's colour it is
 * being drawn at, so a pilot typing 150 at a row reading 150% means a shade of
 * 1.5 - the figure on screen is the figure they are answering.
 */
export function typedRowValue(row, typed) {
    if (!Number.isFinite(typed)) return null;
    return row?.shade ? typed / 100 : typed;
}

/**
 * True for a row a figure can be typed into, which is any row holding a range.
 * An element's own row, the way back to the preset and the way out hold no
 * number, so a digit pressed at one of them means nothing.
 */
export function isTypedEditorRow(state, id) {
    return editorEntry(state, id)?.kind === RANGE_ENTRY;
}

/** The row being typed into, or null while none is. */
export function typedEditorRow(state) {
    return state?.typing?.id ?? null;
}

/** What has been typed into it so far, or null while nothing is being typed. */
export function typedEditorText(state) {
    return state?.typing?.text ?? null;
}

/**
 * What the row says when a press is refused: the bounds the range was declared
 * with, written the way the row writes a value, so a gradient end is refused
 * against percentages and a height against feet.
 */
export function rangeNotice(row) {
    const range = row?.range;
    if (!range) return '';
    return `${rowValueLabel(row, range.low)} TO ${rowValueLabel(row, range.high)}`;
}

/**
 * Starts a pilot typing into a row, taking the key they started with as the
 * first character of the figure. Returns the row, or null for a key that types
 * nothing or a row that holds no range.
 */
export function beginTypedEditorValue(state, id, code) {
    if (!startsTypedValue(code) || !isTypedEditorRow(state, id)) return null;

    state.typing = { id, text: typedCharacter(code), notice: null };
    syncEditorEntries(state);
    return id;
}

/** Gives up on the figure, leaving the range on the value it already had. */
export function cancelTypedEditorValue(state) {
    const id = state?.typing?.id ?? null;
    if (id == null) return null;

    state.typing = null;
    syncEditorEntries(state);
    return id;
}

/**
 * Applies a key press to the row being typed into.
 *
 * Returns what the press came to, as `{ result, element, value }`: `typed` and
 * `erased` for a figure still being written, `applied` for one taken - carrying
 * the element whose ground has to be drawn again - `refused` for one outside the
 * bounds the range declared, and `cancelled` for the way out. A refused figure
 * leaves the row typing, so the next press carries on from what is there.
 *
 * Null when no row is being typed into, and null for a key that means nothing to
 * one, which the caller then reads however it would have otherwise.
 */
export function applyTypedEditorKey(state, code) {
    const typing = state?.typing;
    if (typing == null) return null;

    const read = readTypedKey(typing.text, code);
    if (read == null) return null;

    if (read.action === 'cancel') {
        cancelTypedEditorValue(state);
        return { result: 'cancelled', element: null, value: null };
    }

    if (read.action === 'commit') {
        const entry = editorEntry(state, typing.id);
        const row   = entry?.row;
        const value = typedRowValue(row, read.value);
        const range = row?.range;

        // The bounds the stepper is held to, rather than a second reading of
        // them: `moveValue` clamps every press to this pair and rounds it to the
        // places the step moves in, so a figure outside them is one no amount of
        // stepping could have reached.
        if (value == null || !range || value < range.low || value > range.high) {
            typing.notice = rangeNotice(row);
            syncEditorEntries(state);
            return { result: 'refused', element: null, value: read.value };
        }

        const element = editorElement(state, entry.element);
        if (!element) {
            cancelTypedEditorValue(state);
            return { result: 'cancelled', element: null, value: null };
        }

        const places = stepPlaces(rangeStep(range));
        const held   = rowValue(element, entry.name, row);
        const taken  = Number(value.toFixed(places));

        state.typing = null;
        writeRowValue(element, entry.name, row, taken);
        syncEditorEntries(state);

        // The element only comes back where the ground actually changed, so a
        // figure typed in that the row was already on costs no world rebuild -
        // the same answer the stepper gives for a press that moved nothing.
        return {
            result: 'applied',
            element: rowValue(element, entry.name, row) === held ? null : element.id,
            value: taken
        };
    }

    typing.text = read.text;
    typing.notice = null;
    syncEditorEntries(state);
    return { result: read.action, element: null, value: null };
}
