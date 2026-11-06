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
import {
    rangePlaces, label, rowValue, rangeEntryText,
    writeRowValue, stepRow, isTypedRow, typedRowValue, rangeNotice, panelRows, coarseStep
} from './properties-panel.js';
import {
    typedCharacter, startsTypedValue, readTypedKey, typedValueLabel
} from './typed-value.js';

// The row builder this editor was the first home of lives in
// `js/properties-panel.js` now, so every panel that edits declared ranges is
// drawn from one place. It is published from here as well, under the names it
// always had, so nothing that read it off the editor has to know it moved.
export {
    RANGE_STEPS, FRACTION_STEP, rangeStep, rangePlaces, stepPlaces, SHADE_RANGE, shadeColor,
    GATE_RANGE, GATE_ON_LABEL, GATE_OFF_LABEL, gateOn,
    rangeRows, label, rowValue, rowValueLabel, rangeEntryText, typedRowValue, rangeNotice
} from './properties-panel.js';

export const EDITOR_TITLE = 'ELEMENT EDITOR';
export const EDITOR_HEADING = 'PLACED ELEMENTS';

// The panel has no key of its own. `L` was it, and `L` now opens the
// interactive environment builder - which is the editor this was the lightest
// version of, and the one place both scopes of editing the world belong. The
// panel is still what moves an environment's ranges across the whole world, and
// the builder is where it is reached from; `BUILDER_OPEN_KEYS` in
// `js/build-mode.js` is where the key itself lives now.
export const EDITOR_CLOSE_KEYS = ['Escape', 'Backspace'];

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

    return placed.map((placement, at) => elementRow(placement.type, at, placement.config));
}

/**
 * One of an environment's elements as the editor holds it: what is read off
 * the element - its label and its note - and the configuration it is drawn
 * with, every range resolved, beside the configuration a gradient's shade is
 * measured from and the shades either end is drawn at. A saved world's rows
 * are read back through this, so a row from a file is a row the editor made.
 *
 * `id` is the row's own, kept where it has one, so a world saved and read back
 * is the rows it was; `at` names it where it has none.
 */
export function elementRow(type, at, config, { base = config, shades = null, id = null } = {}) {
    const element = getElement(type);
    return {
        id: typeof id === 'string' && id !== '' ? id : `${type}-${at}`,
        type,
        label: label(type),
        note: elementNote(element),
        open: false,
        config: resolveConfig(element, config),
        base: resolveConfig(element, base),
        shades: { ...shadeDefaults(element), ...(shades ?? {}) }
    };
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
        // The world the rows are of and a free flight is drawn on. It is the
        // world the settings chose, except after the builder kept one built
        // on a canvas the settings do not offer - Blank Canvas - when it is
        // that canvas, since that is the ground the build was made on.
        environmentId: null,
        // The world the settings last chose, which is what says whether a
        // choice made there is a different world. Held apart from the one
        // above so that a setting applied for any other reason - the weather,
        // the units - is never read as a new world and never lets go of a
        // build kept on a canvas the settings cannot name.
        chosen: null,
        runway: null,
        elements: [],
        // What the builder built on this world and was told to keep, as the
        // placements it committed - drawn after the world's own elements and
        // held apart from them, because a built mountain dropped at a click is
        // a placement with a point and a seed of its own rather than a row of
        // ranges the panel steps.
        built: [],
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
 * What the builder kept goes with the environment rather than with the strip:
 * another environment drops it, being ground it was never built on, while
 * turning the strip on or off keeps it - the strip is laid after it, and a
 * start state changed in the settings is no reason to lose a built mountain.
 *
 * "Another environment" is another than the settings last chose, read off
 * `chosen` rather than off the world the editor is on. The two differ after a
 * build on Blank Canvas is kept, which the settings cannot name, and asking
 * the editor's own world would read every setting applied after it as a new
 * world and let go of the build.
 *
 * Returns true when the panel was rebuilt.
 */
export function setEditorWorld(state, environmentId, runway = false) {
    const wanted = getEnvironment(environmentId).id;
    const strip  = runway === true;

    if (state.chosen === wanted && state.runway === strip) return false;

    if (state.chosen !== wanted) {
        state.built = [];
        state.environmentId = wanted;
    }
    state.chosen = wanted;
    state.runway = strip;
    state.elements = editorElements(getEnvironment(state.environmentId), strip);
    // A different world is a different set of rows, so a figure being typed into
    // one of the old ones has nowhere left to land.
    state.typing = null;
    syncEditorEntries(state);

    return true;
}

/**
 * Keeps what the builder built: the world goes back to the environment the
 * canvas was opened on, as that environment describes it - which is the ground
 * the canvas was drawn on - with the placements the session committed laid
 * over it. What was kept before is replaced, because the canvas opened with it
 * already committed and so what it hands back is the whole of the built world.
 *
 * `runway` is whether the start wants a strip, which is the flight's to say
 * rather than the canvas's: the canvas is drawn without one, and the flight
 * searches for one after everything built is down.
 *
 * `chosen` is the world the settings hold once the build is kept, which is the
 * canvas's own for a world they offer - the caller chooses it there first -
 * and the one they held before for a canvas they do not. The build is kept
 * until the settings choose another.
 *
 * `world` is the environment's own rows as the canvas left them - Select's
 * panel steps them across the whole world - and they become the editor's rows,
 * with the strip's row after them when the start wants one. Without them the
 * rows are the preset's again.
 */
export function keepBuiltWorld(
    state, environmentId, runway = false, placements = [], chosen = environmentId, world = null
) {
    const wanted = getEnvironment(environmentId).id;

    state.environmentId = wanted;
    state.chosen = getEnvironment(chosen).id;
    state.runway = runway === true;
    state.elements = Array.isArray(world)
        ? [
            ...world.filter(row => row?.type !== 'runway' && ELEMENTS_BY_ID.has(row?.type))
                .map(row => ({ ...structuredClone(row), open: false })),
            ...editorElements(getEnvironment(wanted), state.runway).filter(row => row.type === 'runway')
        ]
        : editorElements(getEnvironment(wanted), state.runway);
    state.built = (Array.isArray(placements) ? placements : []).map(placement => structuredClone(placement));
    state.typing = null;
    syncEditorEntries(state);
    return state;
}

/**
 * Lets go of what the builder kept, and of the world it was kept under, so the
 * next `setEditorWorld` puts the editor on the settings' world afresh - its
 * preset's rows, nothing built - even the world the build was made on. Which is
 * what choosing a preset over a world loaded from a file asks: that preset as
 * it is.
 */
export function releaseBuiltWorld(state) {
    state.built = [];
    state.chosen = null;
    state.runway = null;
    return state;
}

/**
 * What the builder kept on a world, as a copy, and nothing for any other world
 * - which is what a canvas opened on that world starts with already committed.
 */
export function keptPlacements(state, environmentId) {
    if (state.environmentId == null || state.environmentId !== getEnvironment(environmentId).id) return [];
    return (state.built ?? []).map(placement => structuredClone(placement));
}

/**
 * The built world the builder goes back to - the canvas a build was kept on,
 * every placement kept on it, and its own rows as they were kept, as copies -
 * or null while nothing built is kept, which is when the builder opens on its
 * picker instead.
 */
export function builtWorld(state) {
    if (state?.environmentId == null || !(state.built?.length > 0)) return null;
    return {
        environment: state.environmentId,
        placements: keptPlacements(state, state.environmentId),
        world: canvasWorld(state, state.environmentId)
    };
}

/**
 * The environment's own rows a canvas on it opens with, as copies: the rows
 * the editor is holding when it is on that world - the preset as it was last
 * changed and kept - and the preset's own otherwise. The strip is not among
 * them: a canvas is drawn without one, and the flight lays its own.
 */
export function canvasWorld(state, environmentId) {
    const wanted = getEnvironment(environmentId).id;
    const rows = state?.environmentId === wanted
        ? state.elements
        : editorElements(getEnvironment(wanted), false);
    return rows
        .filter(row => row.type !== 'runway')
        .map(row => ({ ...structuredClone(row), open: false }));
}

/**
 * The world a free flight is drawn on: the one the editor is on, which is the
 * settings' choice or the canvas a build on it was kept on - and the settings'
 * own choice whenever the editor has not been put on it yet, so a world chosen
 * there is never flown as the one before it.
 */
export function flownEnvironment(state, chosen) {
    const wanted = getEnvironment(chosen).id;
    return state?.chosen === wanted && state.environmentId != null ? state.environmentId : wanted;
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

export function elementEntryText(element) {
    return `${element.open ? ELEMENT_OPEN_MARK : ELEMENT_SHUT_MARK} ${element.label}`;
}

/**
 * The panel's rows: every element the world places, the ranges of whichever of
 * them are open, the way back to the preset, and the way out.
 *
 * Only an open element's ranges are listed. Five worlds place up to eight
 * elements declaring five ranges each, and a panel that listed all of them at
 * once would be a panel nobody could find anything in.
 *
 * The rows themselves are the properties panel's - `panelRows` over the ranges
 * the element declares and the values it holds - and this decorates them with
 * the ids, the typing and the text this menu draws. A row whose range is gated
 * shut is listed held, which the menu draws dimmed and a press does not move.
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

        for (const { name, row, value, valueLabel, live } of panelRows(getElement(element.type).ranges, element)) {
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
                    : valueLabel,
                current: false
            };
            // Only a row gated shut carries the mark, so a row with no gate is
            // the entry it always was.
            if (!live) entry.locked = true;
            entry.text = rangeEntryText(entry);
            entries.push(entry);
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
 * A row gated shut does not move: its value is held where it was until the
 * gate opens again.
 *
 * Returns the id of the element that changed, so the caller knows the ground
 * has to be drawn again, and null when nothing moved.
 */
export function adjustEditorRange(state, id, step, { coarse = false } = {}) {
    if (!step) return null;

    const entry = editorEntry(state, id);
    if (entry?.kind !== RANGE_ENTRY || entry.locked) return null;

    const element = editorElement(state, entry.element);
    if (!element) return null;

    if (!stepRow(element, entry.name, entry.row, coarse ? coarseStep(entry.row, step) : step)) return null;

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
    return [
        ...state.elements.map(element => ({
            type: element.type,
            config: structuredCloneConfig(element.config)
        })),
        ...(state.built ?? []).map(placement => structuredClone(placement))
    ];
}

// --- Typing a number into a row --------------------------------------------

/**
 * True for a row a figure can be typed into, which is any row holding a number
 * that is live. An element's own row, the way back to the preset and the way
 * out hold no number, a choice holds one of a list, and a row gated shut is
 * held - so a digit pressed at any of them means nothing.
 */
export function isTypedEditorRow(state, id) {
    const entry = editorEntry(state, id);
    return entry?.kind === RANGE_ENTRY && !entry.locked && isTypedRow(entry.row);
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

        const places = rangePlaces(range);
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
