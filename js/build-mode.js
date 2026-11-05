/**
 * Build mode - the interactive environment builder's session: whether it is
 * open, which menu opened it, and which of its screens is showing.
 *
 * The builder is an editor laid over one tile of the world, where ground is
 * shaped by pointing at it rather than by stepping a number in a list. This
 * module is the session that holds while that is happening: the live tool, the
 * edit in hand and what has been committed, the placement picked up again with
 * Select, and the two questions asked before work is settled or the builder is
 * left. What the ground looks like is the generator's, drawn from the
 * placements this holds.
 *
 * There are three ways in - the title screen's entry, the pause menu's entry
 * and the `L` key - and they are one action, because three ways into the same
 * editor are three things that can drift into opening slightly different ones.
 * `from` is what the way out returns to.
 *
 * Pure module with no DOM or Three.js dependency, so the session can be unit
 * tested in Node - and so `js/reserved-keys.js` can read the key the builder
 * opens on without pulling in a renderer to do it.
 */

import {
    SELECT_TOOL, isChoosableTool, buildTool, droppedPlacement, mindsLasso, isStrokeTool, isPaintTool, isEraseTool,
    isExtrudeTool, toolElementRows, toolRanges, defaultBrush, toolPlacement, insertsTemplate, dropsAtClick
} from './build-tools.js';
import {
    DEFAULT_EXTRUDE_TOOL, extrudeTool, EXTRUDE_DRAWING, EXTRUDE_EXTRUDING, EXTRUDE_SURFACES, EXTRUDE_STAGES,
    EXTRUDE_SURFACES_DECLARED
} from './extrude.js';
import {
    templateBuilt, placeTemplate, groupConfig, groupReach, keepStripOnCanvas
} from './templates.js';
import { getElement, isElementId, resolveConfig } from './environment/elements.js';
import { isErase, eraseConfig } from './environment/erase.js';
import {
    footprintWeight, isFootprint, combineFootprints, placeFootprint, addToPlaced
} from './environment/footprints.js';
import {
    DEFAULT_LASSO_TOOL, lassoTool, lassoToolBuilt, isSelection, combineSelection, coversGround, reshapeFootprint
} from './lasso.js';

/**
 * The one name, on the menu entry and on the picker that entry opens. A pilot
 * who chooses one name should land on a screen carrying the same one.
 */
export const BUILDER_LABEL = 'INTERACTIVE ENVIRONMENT BUILDER';

/** The id both menus carry the entry under, so both screens open the same thing. */
export const BUILDER_ENTRY_ID = 'build';

/**
 * `L` for the level editor this is: the key already meant "edit the world", and
 * the builder is what that means now. Every other letter the editor might have
 * wanted already flies the aircraft.
 */
export const BUILDER_OPEN_KEYS = ['KeyL'];

export function isBuilderOpenKey(code) {
    return BUILDER_OPEN_KEYS.includes(code);
}

/**
 * The keys that leave the picker, which are the two every other panel here is
 * left by. The picker is a panel like any other, so it is closed like one.
 */
export const PICKER_CLOSE_KEYS = ['Escape', 'Backspace'];

/**
 * The key that asks to leave a canvas, which is the accept tool's key.
 *
 * One key rather than the picker's two. `Backspace` is kept off the canvas
 * because deleting a placement will want it - on a Mac the key labelled delete
 * is `Backspace` - and a key that leaves the builder in one press is the worst
 * key there is to share with a delete.
 */
export const CANVAS_LEAVE_KEYS = ['Escape'];

export function isPickerCloseKey(code) {
    return PICKER_CLOSE_KEYS.includes(code);
}

export function isCanvasLeaveKey(code) {
    return CANVAS_LEAVE_KEYS.includes(code);
}

/**
 * True for a key that asks to leave the builder from the screen it is on: either
 * close key off the picker, and only `Escape` off a canvas.
 */
export function leavesBuilder(state, code) {
    if (buildModePicking(state)) return isPickerCloseKey(code);
    if (buildModeDrawing(state)) return isCanvasLeaveKey(code);
    return false;
}

/** What the way out returns to, which is whichever menu the builder was opened from. */
export const BUILD_FROM_TITLE = 'title';
export const BUILD_FROM_PAUSE = 'pause';

/**
 * The screens a session is on. The picker is the builder's first screen rather
 * than a gate in front of it - the palette and the dock are already drawn
 * behind it - so leaving the picker leaves the builder.
 */
export const BUILD_PICKER = 'picker';
export const BUILD_CANVAS = 'canvas';

export function createBuildState() {
    return {
        // Where the session is, and null while there is no session. Held as the
        // screen rather than as a pair of flags, because the builder is on
        // exactly one of its screens whenever it is open at all.
        screen: null,
        from: BUILD_FROM_TITLE,
        // The canvas the session is building on, and null until the picker has
        // said which. It is the environment the ground is generated from, so a
        // session carries an id rather than a field.
        environment: null,
        // The tool the canvas is being worked with, and null until there is a
        // canvas to work.
        tool: null,
        // What has been built on the canvas: placements, each JSON-shaped data
        // in the canvas's frame, in the order they were committed. Concatenated
        // onto the environment's own, this is the whole description of the
        // built world, and it goes to `buildEnvironment` through the same door
        // a preset does.
        placements: [],
        // The environment's own elements, as the rows the element editor holds
        // them in - a type, its configuration, and the colours its gradients
        // are measured against - which Select's panel steps across the whole
        // world. Held by the session so a change to them is the canvas's until
        // it is kept, and dropped with the rest of it when it is not.
        world: [],
        // The edit in hand, and null while nothing is pending: a placement
        // being drawn or changed, the index of the committed placement it
        // replaces, or null for one drawn on bare ground, and the tool that
        // began it, or null for one picked up again. A placement picked with
        // Select is a draft standing on it, so the pick and the edit of it are
        // one thing rather than two that could disagree.
        draft: null,
        // The question waiting on the pilot, and null while nothing is asked:
        // which confirm is open, and what goes ahead once it is answered - the
        // tool a change was on its way to, or null for the way out.
        confirm: null,
        // Where each tool's panel was left when its last edit was settled, so
        // the next thing it drops starts from there rather than from the
        // element's defaults.
        toolValues: {},
        // How many placements this canvas has handed a seed, so each one it
        // drops draws from a stream of its own.
        dropped: 0,
        // The region the lasso has drawn, and null while nothing is selected:
        // a footprint in the canvas's frame. It is not a placement - nothing
        // is built from it and nothing keeps it - but session state that
        // outlives the tool that drew it, so a lasso drawn once is the region
        // every tool that minds it works inside, until a deselect.
        selection: null,
        // The lasso tool the selection was drawn with while it is one shape -
        // its fields on the panel reshape it - and null once shapes have been
        // combined into it, when no one tool's fields describe it.
        selectionTool: null,
        // Which of the lasso's ten tools is chosen, and where its fields were
        // left.
        lassoTool: DEFAULT_LASSO_TOOL,
        lassoValues: {},
        // The template Insert Runway is armed with, or null until a card is
        // chosen: the pointer carries nothing and a click places nothing.
        runwayTemplate: null,
        // While an eye dropper is armed, what it fills: true for Free Paint's
        // brush, or the name of the colour an extrusion's surface is painted;
        // the next click on the ground takes the colour there for it.
        dropper: false,
        // Where the popup a right click on the selection opens stands, as the
        // screen point it was opened at, and null while it is shut.
        popup: null,
        // Which of Extrude's shapes is chosen, and where its fields were left.
        extrudeTool: DEFAULT_EXTRUDE_TOOL,
        extrudeValues: {},
        // While a pan is held from inside a tool, `{ overriding, resumes }`:
        // the pointer drives the camera, and the tool it was is the one it
        // goes back to. Null while nothing holds it.
        camera: null,
        // While the builder's settings are open over the canvas, `{ resumes }`:
        // the tool suspended under them, as a held pan suspends it.
        settingsOver: null,
        // The moments a pending draft is kept without being asked about,
        // handed in from the builder's settings - which this module never
        // reads itself, so a session works without them. `all` is over the
        // other three.
        autoAccept: noAutoAccept(),
        // The committed placement auto accept kept last, while nothing else
        // has been committed since, which the next draft it keeps can be
        // joined to. Null once anything else is committed.
        kept: null
    };
}

/**
 * Opens the builder, remembering what opened it.
 *
 * On its picker the first time, and straight onto the built world every time
 * after that. `built` is the world an earlier session kept - `{ environment,
 * placements, world }` - and with one the session opens on its canvas with every
 * placement it had already committed, each still one that can be picked up and
 * changed: a pilot who comes back to their world wants their world, not a
 * choice of six and a blank canvas. With none, which is a world nothing has
 * been built on, it opens on the picker to choose what to start from.
 *
 * Starting again from another base is choosing another world in the settings,
 * which lets go of what was built on the old one, so the builder opens on the
 * picker again.
 */
export function openBuildMode(state, from = BUILD_FROM_TITLE, built = null) {
    state.screen = BUILD_PICKER;
    state.from = from === BUILD_FROM_PAUSE ? BUILD_FROM_PAUSE : BUILD_FROM_TITLE;
    state.environment = null;
    state.tool = null;
    state.confirm = null;

    if (built != null) beginCanvas(state, built.environment, built.placements, built.world);
    return state;
}

/** Leaves the builder, for whichever menu opened it. */
export function closeBuildMode(state) {
    state.screen = null;
    state.environment = null;
    state.tool = null;
    state.confirm = null;
    return state;
}

// --- The two confirms ---------------------------------------------------------

/** The question asked with an edit in hand: keep it, or drop it. */
export const ACCEPT_EDITS = 'accept-edits';

/** The question asked with nothing in hand: keep what was built, and leave. */
export const SAVE_AND_EXIT = 'save-and-exit';

/**
 * What each confirm is headed, in the artwork's own words. The original tour
 * wrote the second as "Do you want to keep the current built environment?";
 * the panel drawn for it says `SAVE AND EXIT MODE`, and the artwork settles it.
 */
export const CONFIRM_HEADINGS = Object.freeze({
    [ACCEPT_EDITS]: 'ACCEPT EDITS',
    [SAVE_AND_EXIT]: 'SAVE AND EXIT MODE'
});

/**
 * The answers a confirm takes: its two buttons, and calling it off - which is
 * `Escape`, or a click anywhere but the confirm. Anything that is not one of
 * the two buttons calls it off, so an answer that means nothing never commits
 * or drops anything.
 */
export const CONFIRM_YES  = 'yes';
export const CONFIRM_NO   = 'no';
export const CONFIRM_STAY = 'stay';

/**
 * The two buttons, as the entries of the menu a confirm is drawn and walked
 * as. `YES` first, so a confirm opens on it and `Enter` keeps the work.
 */
export const CONFIRM_ENTRIES = Object.freeze([
    Object.freeze({ id: CONFIRM_YES, label: 'YES' }),
    Object.freeze({ id: CONFIRM_NO,  label: 'NO' })
]);

/** How an edit was settled, as `answerConfirm` reports it. */
export const ACCEPTED  = 'accepted';
export const CANCELLED = 'cancelled';

/**
 * Asks to leave the builder. The accept tool, `Escape` and the picker's `BACK`
 * all come here.
 *
 * One function, for the reason there is one way in: three ways out are three
 * things that can drift into asking different questions. Each asks the one
 * question that applies, read off `draftPending` again on every ask:
 *
 * - **Off the picker** it leaves. Nothing has been built there to keep, and the
 *   picker is a panel, closed like one.
 * - **With an edit in hand** it asks `ACCEPT EDITS`. Either answer settles the
 *   edit and stays: committing work never doubles as leaving, so a pilot who
 *   wants to keep this batch and go on building is never made to answer No to
 *   a question about saving.
 * - **With nothing in hand** it asks `SAVE AND EXIT MODE`, whether or not
 *   anything was built - a session with nothing built meets it like any other.
 *   A placement picked and not changed is nothing in hand: there is no edit in
 *   it to keep or drop.
 *
 * So leaving by keyboard is `Escape` to ask and `Enter` on `YES`, and never one
 * press. With a confirm already open it asks nothing: `Escape` then calls that
 * one off, which is the caller's to do through `answerConfirm`.
 *
 * Returns what to do - `{ leave: true }` or `{ confirm }` naming the confirm
 * now open - or null for a session that is not open, or already asking.
 */
export function requestLeave(state) {
    if (!buildModeShowing(state) || confirmOpen(state)) return null;
    if (buildModePicking(state)) return { leave: true };

    // With auto accept on for leaving, the edit in hand is kept without the
    // first question, and the way out goes straight to the second. It never
    // skips that one: leaving is the confirm that keeps a pilot's work.
    if (editPending(state) && autoAccepts(state, 'exit')) autoKeep(state);

    const ask = editPending(state) ? ACCEPT_EDITS : SAVE_AND_EXIT;
    state.confirm = { ask, then: null };
    return { confirm: ask };
}

/** True while a confirm is waiting on the pilot, which holds every other change still. */
export function confirmOpen(state) {
    return state?.confirm != null;
}

/** The confirm waiting on the pilot - `ACCEPT_EDITS` or `SAVE_AND_EXIT` - or null. */
export function buildConfirm(state) {
    return state?.confirm?.ask ?? null;
}

/**
 * Answers the confirm that is open.
 *
 * `ACCEPT EDITS` settles the edit in hand - `YES` commits it, `NO` drops it -
 * and then does what it was asked on the way to: changes the tool a palette
 * click named, picks the placement a click with Select landed on, or, asked by
 * the way out, returns to the editor with the panel where it was left. `SAVE AND EXIT MODE` leaves either way: `YES` keeping what
 * was built, `NO` dropping it for the world the session opened on.
 *
 * Calling a confirm off settles nothing. The edit is still in hand, the tool
 * is still the one it was, and the canvas is still open.
 *
 * Returns what the caller has to do: `{ leave: true, keep, environment,
 * placements, world }` for the way out - the world to keep, read before the
 * session closes - `{ settled, tool, picked }` for an edit settled,
 * `{ stay: true }` for a confirm called off, or null when nothing was asked.
 */
export function answerConfirm(state, answer) {
    const asked = state?.confirm;
    if (asked == null) return null;
    state.confirm = null;
    // The popup was shut by the question, whatever it was asked by.
    state.popup = null;

    if (answer !== CONFIRM_YES && answer !== CONFIRM_NO) return { stay: true };

    if (asked.ask === SAVE_AND_EXIT) {
        return {
            leave: true,
            keep: answer === CONFIRM_YES,
            environment: state.environment,
            placements: committedPlacements(state),
            world: worldRows(state)
        };
    }

    if (answer === CONFIRM_YES) acceptDraft(state);
    else cancelDraft(state);

    const tool = asked.then?.tool;
    if (tool != null && tool !== state.tool && isChoosableTool(tool)) {
        state.tool = tool;
        state.dropper = false;
    }

    const pick = asked.then?.pick;
    if (Number.isInteger(pick)) pickUpPlacement(state, pick);

    return { settled: answer === CONFIRM_YES ? ACCEPTED : CANCELLED, tool: state.tool, picked: pickedIndex(state) };
}

/**
 * What the accept tool will ask if it is pressed now, as the name it carries.
 * "Invalid" in the walkthroughs never means a disabled tool: it stays live and
 * asks the question that applies, and its name says which before it is
 * pressed. `Escape` asks the same question, so the name says what that will
 * ask too.
 */
export function acceptToolName(state) {
    return editPending(state) && !autoAccepts(state, 'exit') ? 'Accept edits' : 'Save and exit';
}

// --- The draft and the built world --------------------------------------------

/**
 * A placement taken as the session's own: copied, so nothing the caller does
 * to the one it handed in afterwards reaches the draft or the committed list.
 * A placement is JSON-shaped, so a structured clone is the whole of a copy.
 */
function own(placement) {
    return structuredClone(placement);
}

/** True while a draft is held - something drawn, or a placement picked up. */
export function draftPending(state) {
    return state?.draft != null;
}

/**
 * True while there is work in hand that a question has to settle, which is the
 * one predicate every confirm reads: a placement drawn on bare ground, or a
 * picked one changed since it was picked.
 *
 * A pick nothing has been done to is not an edit. It is the placement as it
 * was committed, being looked at, and a question about keeping or dropping it
 * would be a question with the same answer either way - so it is let go
 * without one.
 */
export function editPending(state) {
    if (!draftPending(state)) return false;

    const picked = pickedIndex(state);
    if (picked == null) return true;
    return !samePlacement(state.draft.placement, state.placements[picked]);
}

/**
 * True for two placements that draw the same ground: the same element, seed and
 * footprint, and the same configuration once each is resolved against the
 * ranges the element declares - so a value the panel wrote out in full, or
 * stepped away and back again, is no change.
 */
export function samePlacement(a, b) {
    if (a == null || b == null) return a == null && b == null;
    return placementKey(a) === placementKey(b);
}

/** A placement written down so two can be compared: its configuration as the generator reads it. */
function placementKey(placement) {
    const config = isElementId(placement.type)
        ? resolveConfig(getElement(placement.type), placement.config)
        : isErase(placement) ? eraseConfig(placement) : placement.config ?? null;
    return JSON.stringify([placement.type, placement.seed ?? null, placement.footprint ?? null, config]);
}

/** The committed placement the draft stands on - the one picked - or null. */
export function pickedIndex(state) {
    const replaces = state?.draft?.replaces;
    return Number.isInteger(replaces) ? replaces : null;
}

/**
 * The placements a pick looks through: the committed ones, each as it stands
 * right now - the one picked with whatever has been done to it, so the reach a
 * click is measured against is the ground on the canvas. Indexed as the
 * committed list is, which is what a pick hands back.
 */
export function pickablePlacements(state) {
    return builtPlacements(state).slice(0, state?.placements?.length ?? 0);
}

/**
 * A click with Select on the canvas: `index` is the committed placement under
 * it, or null for bare ground.
 *
 * - **On a placement** it picks it, replacing whatever was picked before - the
 *   placement becomes the draft, so the dock draws its rows with the accept
 *   and cancel that settle them, and the ground it stands for is redrawn as
 *   they move.
 * - **On the placement already picked** it keeps it. A pick that let go on a
 *   second click would be one a pilot loses by clicking to be sure.
 * - **On bare ground** it lets go of the pick. A live lasso is a different
 *   selection, which only Deselect clears, and a click here never touches it.
 *
 * A pick that was changed is work in hand, so before it is let go of - for
 * another placement or for bare ground - `ACCEPT EDITS` is asked, with what
 * the click was on its way to held until it is answered. A pick nothing was
 * done to is let go without asking.
 *
 * Refused off a canvas, with a confirm open, and for any tool but Select.
 *
 * Returns `{ picked }` for the placement now picked, or null when the click
 * let go of it; `{ confirm }` when `ACCEPT EDITS` is now asking; or null when
 * nothing changed.
 */
export function selectPlacement(state, index = null) {
    if (!buildModeDrawing(state) || confirmOpen(state) || state.tool !== SELECT_TOOL) return null;

    const target = Number.isInteger(index) && index >= 0 && index < state.placements.length ? index : null;
    const picked = pickedIndex(state);

    if (target != null && target === picked) return null;
    if (target == null && !draftPending(state)) return null;

    if (editPending(state)) {
        state.confirm = { ask: ACCEPT_EDITS, then: { pick: target } };
        return { confirm: ACCEPT_EDITS };
    }

    state.draft = null;
    if (target != null) pickUpPlacement(state, target);
    return { picked: target };
}

/** The placement being drawn or changed, and null while nothing is pending. */
export function buildDraft(state) {
    return draftPending(state) ? state.draft.placement : null;
}

/** What has been committed, as a copy a caller can read without changing it. */
export function committedPlacements(state) {
    return (state?.placements ?? []).map(own);
}

/**
 * Begins an edit on bare ground: a placement drawn by a tool, which commits as
 * a new one. Refused off a canvas, with a confirm open, while another edit is
 * pending - that one has to be accepted or cancelled first - and for anything
 * that is not a placement.
 *
 * `tool` is the tool that drew it, whose panel the next draft it draws starts
 * from once this one is settled.
 */
export function startDraft(state, placement, tool = null) {
    if (!buildModeDrawing(state) || confirmOpen(state) || draftPending(state) || !isPlacement(placement)) return false;

    state.draft = { placement: own(placement), replaces: null, tool };
    return true;
}

/**
 * A click on the ground with a tool that drops what it builds there.
 *
 * With nothing in hand, it begins an edit at the click: the tool's placement,
 * started from where its panel was left, with a seed of its own. With the
 * tool's own edit already in hand, that edit is put down again at the click
 * instead - the mountain in hand moves, rather than a second one appearing or
 * the first being kept or dropped without being asked about. Keeping it is the
 * panel's `ACCEPT`, or the accept tool's `ACCEPT EDITS`.
 *
 * Refused off a canvas, with a confirm open, for a live tool that does not
 * drop, for a point that is not on the ground, and with an edit in hand that
 * this tool did not begin.
 *
 * With a selection live, a tool that minds the lasso is clipped to it: the
 * placement carries the selection as its `clip`, copied as it stands, and is
 * drawn only where the selection reaches - so a mountain dropped inside a lasso
 * is cut at the lasso's edge. A click outside the selection drops nothing,
 * since all of what it dropped would be cut away. `size` is the canvas's
 * width, which the selection repeats at.
 *
 * Returns true when an edit was begun or moved.
 */
export function dropDraft(state, point, { size = 0 } = {}) {
    if (!buildModeDrawing(state) || confirmOpen(state)) return false;

    const tool      = buildTool(state.tool);
    const placement = droppedPlacement(tool, state.toolValues?.[tool?.id], point);
    if (placement == null) return false;

    const clip = mindsLasso(tool.id) ? state.selection : null;
    if (clip != null && !(footprintWeight(clip, point.x, point.z, size) > 0)) return false;

    if (draftPending(state)) {
        const draft = state.draft;
        if (draft.tool !== tool.id || draft.replaces != null) return false;
        draft.placement.config = { ...draft.placement.config, at: placement.config.at };
        return true;
    }

    placement.seed = placementSeed(state.dropped);
    if (clip != null) placement.clip = own(clip);
    if (!startDraft(state, placement, tool.id)) return false;
    state.dropped += 1;
    return true;
}

/**
 * A seed for the `n`th placement a canvas drops, mixed so that neighbouring
 * counts give unrelated streams - a seed of 1, 2 or 3 taken as it is would
 * start the generator on draws close to nothing.
 */
export function placementSeed(n = 0) {
    let h = Math.imul((Math.trunc(n) + 1) >>> 0, 0x9e3779b1) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
    return (h ^ (h >>> 16)) >>> 0;
}

/**
 * The values a tool's next draft starts from: its panel as the last edit it
 * began was left, or nothing for a tool whose panel has not been used on this
 * canvas, which starts from the element's defaults.
 */
export function toolStartValues(state, tool) {
    return own(state?.toolValues?.[tool] ?? {});
}

/**
 * Keeps where a tool's panel was left as its edit is settled, kept or dropped
 * alike - a pilot who drops a mountain, sets it up and cancels it to try
 * somewhere else wants the next one set up the same way. The point it was
 * dropped on is the click's, not the panel's, so it is left behind.
 */
function rememberToolValues(state) {
    const { placement, tool } = state.draft;
    if (tool == null) return;

    // Laid over what the panel held rather than in place of it, so a tool's
    // own rows - the cover tool's brush, which no placement carries - are
    // kept with the element's.
    const values = { ...(state.toolValues?.[tool] ?? {}), ...own(placement.config ?? {}) };
    delete values.at;
    state.toolValues = { ...state.toolValues, [tool]: values };
}

// --- Insert Runway -------------------------------------------------------------

/** The template Insert Runway is armed with, or null before a card is chosen. */
export function buildRunwayTemplate(state) {
    return templateBuilt(state?.runwayTemplate) ? state.runwayTemplate : null;
}

/**
 * A card chosen on Insert Runway's panel: the tool armed with its template.
 * With the tool's own template in hand, the one in hand becomes the new one
 * where it stands and the way it faces - a card is what is placed, so the card
 * pressed is what is there - at the new template's own size.
 *
 * Refused off a canvas, with a confirm open, for Insert Runway not live, and
 * for a template the panel does not offer. Returns true when the card is now
 * chosen.
 */
export function chooseRunwayTemplate(state, id) {
    if (!buildModeDrawing(state) || confirmOpen(state) || !insertsTemplate(state.tool) || !templateBuilt(id)) return false;

    state.runwayTemplate = id;
    const draft = state.draft;
    if (draftPending(state) && draft.tool === state.tool && draft.replaces == null) {
        // A new draft rather than the old one changed, so what the panel
        // steps it through is made again from the template now in hand.
        const { at, heading } = groupConfig(draft.placement);
        state.draft = { ...draft, placement: placeTemplate(id, at, heading) };
    }
    return true;
}

/**
 * A click on the ground with Insert Runway armed: the template placed there,
 * facing `heading` to the nearest ten degrees - the way the view looks, which
 * the caller hands in - or, with the one it placed still in hand, that one put
 * down there instead, facing the way it was turned. Held wholly on a canvas
 * `size` wide, where its strip is drawn.
 *
 * Refused off a canvas, with a confirm open, for Insert Runway not live or not
 * armed, for a point that is not on the ground, and with an edit in hand this
 * tool did not begin. Returns true when a template was placed or moved.
 */
export function insertTemplate(state, point, heading = 0, { size = 0 } = {}) {
    if (!buildModeDrawing(state) || confirmOpen(state) || !insertsTemplate(state.tool)) return false;
    const id = buildRunwayTemplate(state);
    if (id == null || !Number.isFinite(point?.x) || !Number.isFinite(point?.z)) return false;

    if (draftPending(state)) {
        const draft = state.draft;
        if (draft.tool !== state.tool || draft.replaces != null) return false;
        const at = keepStripOnCanvas([point.x, point.z], groupReach(draft.placement), size);
        draft.placement.config = { ...draft.placement.config, at: at.map(value => Math.round(value) || 0) };
        return true;
    }

    const placement = placeTemplate(id, [point.x, point.z], heading);
    placement.config.at = keepStripOnCanvas(placement.config.at, groupReach(placement), size).map(value => Math.round(value) || 0);
    return startDraft(state, placement, state.tool);
}

// --- The stroke tools: the cover tool and Free Paint ------------------------------

/**
 * What a stroke tool's panel holds for the element it lays: the element's
 * ranges and the brush's, each as the pilot last left it on this canvas, or as
 * the tool starts it - the element's defaults, the tool's own `starts` over
 * them, and the brush's defaults - where they have not touched it. A batch in
 * hand was begun from these and is written with them by `setStrokeValues`, so
 * they are its values too.
 *
 * The cover tool's are its density, its stamp and its colour; Free Paint's are
 * its colour, opacity and blend, and its brush; Erase's are its target and its
 * strength, and the same brush. Null for a tool that draws no strokes.
 */
export function strokeValues(state, id = state?.tool) {
    const tool = buildTool(id);
    const ranges = toolRanges(tool);
    if (!isStrokeTool(id) || ranges == null) return null;

    const defaults = resolveConfig({ ranges }, {});
    const values = {
        ...Object.fromEntries(toolElementRows(tool).map(name => [name, defaults[name]])),
        ...(tool.starts ?? {}),
        ...defaultBrush(tool),
        ...own(state?.toolValues?.[id] ?? {})
    };
    return values;
}

/**
 * A stroke tool's panel written: every value kept for the tool's next batch,
 * and the element's into the batch in hand as well - one configuration for
 * the whole batch, so a density raised after three strokes were laid raises it
 * on all three, and a colour changed recolours every stroke of the batch. The
 * brush is not the batch's: it is how the next stroke is drawn, and a stroke
 * laid keeps the size, tip and edge it was laid with.
 *
 * Refused off a canvas, with a confirm open, and for a live tool that draws no
 * strokes. Returns true when the batch in hand changed, which is when the
 * ground has to be drawn again.
 */
export function setStrokeValues(state, values = {}) {
    if (!buildModeDrawing(state) || confirmOpen(state) || !isStrokeTool(state.tool)) return false;

    const id = state.tool;
    state.toolValues = { ...state.toolValues, [id]: { ...(state.toolValues?.[id] ?? {}), ...own(values) } };

    const draft = state.draft;
    if (!draftPending(state) || draft.tool !== id || draft.replaces != null) return false;
    const config = toolPlacement(buildTool(id), own(values)).config;
    if (Object.keys(config).length === 0) return false;
    draft.placement.config = { ...draft.placement.config, ...config };
    return true;
}

/**
 * A stroke let go of: `points`, the ground it was dragged over in the canvas's
 * frame, swept with `stamp`, in world units - its width, depth and corner, and
 * the feather Free Paint's edge sets, or the footprint's own where it sets none.
 *
 * The first stroke begins the tool's batch - its placement from the panel, set
 * down in a frame of its own so the gumball can move, turn and stretch the
 * batch whole - and each stroke after it joins the batch, so the sum of the
 * strokes is the draft and an accept keeps them as one placement.
 *
 * With a selection live the batch is clipped to it, as a dropped mountain is:
 * it carries the selection as it stood when the batch began, and a stroke that
 * reaches none of the selected ground is refused, since all of it would be cut
 * away.
 *
 * With Erase, `alt` held at the press says which way a stroke goes. The first
 * stroke of a batch says what the batch is - one that takes, or with `alt`
 * one that puts back what the batches before it took - and a stroke after it
 * the other way is cut out of the batch's own region rather than added to it,
 * so an overshoot is put right without settling the batch first.
 *
 * Refused off a canvas, with a confirm open, for a live tool that draws no
 * strokes, for a stroke that covers nothing, and with an edit in hand that
 * this tool did not begin. Returns true when the stroke was laid.
 */
export function layStroke(state, points = [], stamp = {}, { size = 0, alt = false } = {}) {
    if (!buildModeDrawing(state) || confirmOpen(state)) return false;

    const tool = buildTool(state.tool);
    if (!isStrokeTool(tool?.id)) return false;

    const stroke = {
        kind: 'stroke',
        // `|| 0` so a point a hair west of the middle is written 0, not -0.
        points: (points ?? []).map(([x, z]) => [Math.round(x) || 0, Math.round(z) || 0]),
        stamp: { width: stamp.width, depth: stamp.depth, corner: stamp.corner }
    };
    if (Number.isFinite(stamp.feather) && stamp.feather >= 0) stroke.feather = stamp.feather;
    if (!isFootprint(stroke)) return false;

    const pending = draftPending(state);
    if (pending && (state.draft.tool !== tool.id || state.draft.replaces != null)) return false;

    const clip = pending ? state.draft.placement.clip ?? null : mindsLasso(tool.id) ? state.selection : null;
    if (clip != null && !coversGround(combineFootprints('intersect', stroke, clip), size)) return false;

    const erasing = isEraseTool(tool.id);
    if (pending) {
        const placement = state.draft.placement;
        const against = erasing && (alt === true) !== (placement.config?.restore === true);
        placement.footprint = addToPlaced(placement.footprint, stroke, against ? 'subtract' : 'union');
        return true;
    }

    const placement = toolPlacement(tool, strokeValues(state, tool.id), placeFootprint(stroke));
    if (erasing && alt === true) placement.config.restore = true;
    if (clip != null) placement.clip = own(clip);
    return startDraft(state, placement, tool.id);
}

/**
 * Free Paint's `DEFAULT`: the brush put back as the tool starts it - a hard
 * round brush 25 pixels across - for the strokes still to come. Refused for a
 * live tool that is not Free Paint. Returns true when the brush changed.
 */
export function resetBrush(state) {
    if (brushIsDefault(state) || confirmOpen(state)) return false;
    if (!isPaintTool(buildModeTool(state))) return false;
    setStrokeValues(state, defaultBrush(buildTool(state.tool)));
    return true;
}

/** True while Free Paint's brush is the one it starts with, which is when `DEFAULT` is lit. */
export function brushIsDefault(state) {
    if (!isPaintTool(buildModeTool(state))) return false;
    const values = strokeValues(state);
    return Object.entries(defaultBrush(buildTool(state.tool))).every(([name, value]) => values[name] === value);
}

// --- The eye dropper ------------------------------------------------------------

/** True where an eye dropper can be armed: Free Paint, and an extrusion at its surfaces. */
function dropperOffered(state) {
    return isPaintTool(buildModeTool(state)) || (extrudeStage(state) === EXTRUDE_SURFACES && extrudeDraft(state));
}

/** True while an eye dropper is armed, so a click on the ground takes a colour rather than doing what the tool does. */
export function eyeDropperArmed(state) {
    return Boolean(state?.dropper) && dropperOffered(state) && !confirmOpen(state);
}

/**
 * An eye dropper pressed: armed, or with it armed, put down again. Free
 * Paint's fills the brush; an extrusion's surfaces' fills the colour `name`
 * - `topColor` or `wallColor`, the row it was pressed on. Refused anywhere
 * else. Returns whether it is armed.
 */
export function toggleEyeDropper(state, name = null) {
    if (!dropperOffered(state) || confirmOpen(state)) return false;
    if (eyeDropperArmed(state)) {
        state.dropper = false;
        return false;
    }
    state.dropper = isPaintTool(buildModeTool(state))
        ? true
        : Object.values(EXTRUDE_SURFACES_DECLARED).includes(name) ? name : 'topColor';
    return true;
}

/** Puts the eye dropper down without taking anything. Returns true when it was armed. */
export function dropEyeDropper(state) {
    const armed = eyeDropperArmed(state);
    if (state) state.dropper = false;
    return armed;
}

/**
 * The eye dropper's click: `rgb`, the colour of the ground under it, made the
 * brush's colour - and the batch in hand's, as a colour chosen any other way
 * is - or the extrusion's surface's, and the dropper put down. Refused while
 * it is not armed and for anything that is not a colour. Returns true when
 * the colour was taken.
 */
export function takeEyeDropperColor(state, rgb) {
    if (!eyeDropperArmed(state)) return false;
    if (!Array.isArray(rgb) || rgb.length !== 3 || !rgb.every(Number.isFinite)) return false;
    const fills = state.dropper;
    const color = rgb.map(channel => Math.min(Math.max(channel, 0), 1));
    state.dropper = false;
    if (typeof fills === 'string') reviseDraft(state, { config: { [fills]: color } });
    else setStrokeValues(state, { color });
    return true;
}

/**
 * Picks a committed placement up again to change it.
 *
 * The draft is a copy and the original stays in the committed list, which is
 * what makes cancelling an edit put the original back rather than delete it:
 * there was never a moment it was out of the list. `replaces` records which
 * one the draft stands on, so accepting swaps it rather than adding a second.
 */
export function pickUpPlacement(state, index) {
    if (!buildModeDrawing(state) || confirmOpen(state) || draftPending(state)) return false;
    if (!Number.isInteger(index) || index < 0 || index >= state.placements.length) return false;

    state.draft = { placement: own(state.placements[index]), replaces: index, tool: null };
    return true;
}

/**
 * Changes the edit in hand: the values the panel steps go into its `config`,
 * merged over what is there, and a new `footprint` replaces the old one. The
 * draft survives the change - it is the same edit, standing on the same
 * placement - which is what lets a value be stepped and stepped again before
 * anything is committed.
 */
export function reviseDraft(state, { config, footprint } = {}) {
    if (!draftPending(state)) return false;

    const placement = state.draft.placement;
    if (config != null) placement.config = { ...placement.config, ...own(config) };
    if (footprint !== undefined) placement.footprint = footprint == null ? undefined : own(footprint);
    if (placement.footprint === undefined) delete placement.footprint;
    return true;
}

/**
 * Commits the edit in hand, always. A draft on bare ground is added to the
 * committed list; one standing on a committed placement takes that
 * placement's place, so a changed mountain is one mountain and not two.
 *
 * Returns the placement committed, or null when nothing was pending.
 */
export function acceptDraft(state) {
    if (!draftPending(state)) return null;

    rememberToolValues(state);
    // Anything committed this way ends the run auto accept was keeping, so
    // nothing kept after it is joined to what came before it.
    state.kept = null;

    const { placement, replaces } = state.draft;
    if (replaces != null && replaces >= 0 && replaces < state.placements.length) {
        state.placements[replaces] = placement;
    } else {
        state.placements.push(placement);
    }

    state.draft = null;
    return own(placement);
}

/**
 * Drops the edit in hand, always. Nothing committed is touched: a draft on bare
 * ground is gone, and one standing on a committed placement leaves that
 * placement exactly as it was committed, because it never left the list.
 *
 * Returns true when there was something to drop.
 */
export function cancelDraft(state) {
    if (!draftPending(state)) return false;
    rememberToolValues(state);
    state.draft = null;
    return true;
}

/**
 * The placements the canvas is drawn from right now: everything committed,
 * with the edit in hand shown where it stands - in place of the placement it
 * replaces, or after the rest when it is new - so what is on screen is what an
 * accept would keep.
 */
export function builtPlacements(state) {
    const shown = committedPlacements(state);
    // An extrusion still being drawn is not ground yet: its region is shown
    // over the canvas, and nothing is levelled or raised until it is lifted.
    if (!draftPending(state) || state.draft.stage === EXTRUDE_DRAWING) return shown;

    const { placement, replaces } = state.draft;
    if (replaces != null && replaces >= 0 && replaces < shown.length) shown[replaces] = own(placement);
    else shown.push(own(placement));
    return shown;
}

/**
 * The environment's own elements as the session holds them, copied: the rows
 * Select's panel steps, which the way out hands back to be kept.
 */
export function worldRows(state) {
    return (state?.world ?? []).map(own);
}

/**
 * The environment's own elements as placements - a type and a configuration
 * each - which is what the canvas is drawn from beneath what is built.
 */
export function worldPlacements(state) {
    return (state?.world ?? []).map(row => ({ type: row.type, config: own(row.config ?? {}) }));
}

/** True for something shaped like a placement: a type, and a config if it has one. */
function isPlacement(placement) {
    return placement != null
        && typeof placement === 'object'
        && typeof placement.type === 'string'
        && placement.type !== ''
        && (placement.config == null || typeof placement.config === 'object');
}

export function buildModeShowing(state) {
    return state?.screen != null;
}

/** Which menu the way out returns to, and null while nothing is open. */
export function buildModeFrom(state) {
    return buildModeShowing(state) ? state.from : null;
}

/** True while the picker is the screen, which is the one modal screen the builder has. */
export function buildModePicking(state) {
    return state?.screen === BUILD_PICKER;
}

/** True once a canvas is being built, which is the builder over the world itself. */
export function buildModeDrawing(state) {
    return state?.screen === BUILD_CANVAS;
}

/** The canvas being built, and null while the picker has not said which. */
export function buildModeEnvironment(state) {
    return buildModeDrawing(state) ? state.environment : null;
}

/**
 * Opens the canvas on a chosen environment, which is what the picker's `START`
 * does.
 *
 * `kept` is what an earlier session built on this environment and kept, which
 * the canvas opens with already committed - so a session that saves keeps
 * what the one before it saved as well as its own, rather than a canvas that
 * did not show the earlier work quietly replacing it. Anything in it that is
 * not a placement is left out.
 *
 * `world` is the environment's own elements as the rows the element editor
 * holds - its preset, or the preset as it was changed and kept - which the
 * canvas is drawn from beneath what is built, and Select's panel changes.
 *
 * Refused for a session that is not open, so a canvas can never be begun from
 * under a screen that is not the picker.
 */
export function beginCanvas(state, environmentId, kept = [], world = []) {
    if (!buildModePicking(state)) return false;
    if (typeof environmentId !== 'string' || environmentId === '') return false;

    state.screen = BUILD_CANVAS;
    state.environment = environmentId;
    // Select is the navigation state, so a canvas opens on looking at it.
    state.tool = SELECT_TOOL;
    state.placements = (Array.isArray(kept) ? kept : []).filter(isPlacement).map(own);
    state.world = (Array.isArray(world) ? world : []).filter(isPlacement).map(own);
    state.draft = null;
    state.confirm = null;
    // A canvas's panels start from the elements' defaults, and its seeds
    // count on from what it opened with, so a kept placement and a new one
    // do not start from the same stream.
    state.toolValues = {};
    state.dropped = state.placements.length;
    // A canvas opens with nothing selected and the lasso on its first tool.
    state.selection = null;
    state.selectionTool = null;
    state.lassoTool = DEFAULT_LASSO_TOOL;
    state.lassoValues = {};
    state.runwayTemplate = null;
    state.dropper = false;
    state.popup = null;
    state.extrudeTool = DEFAULT_EXTRUDE_TOOL;
    state.extrudeValues = {};
    state.camera = null;
    state.settingsOver = null;
    state.kept = null;
    return true;
}

/** The tool the canvas is being worked with, and null while there is no canvas. */
export function buildModeTool(state) {
    return buildModeDrawing(state) ? state.tool : null;
}

/**
 * Makes a tool the live one.
 *
 * Refused off a canvas, with a confirm open, for a tool that is not built, and
 * for the accept tool, which is a way out rather than a mode. Choosing the tool
 * already live is not a change and is answered as one.
 *
 * With an edit pending it asks first. Changing tools decides what happens to
 * the work on the one being left - kept, or dropped - and that is the pilot's
 * to answer, so `ACCEPT EDITS` opens with the tool chosen held as what goes
 * ahead once it is answered, and the tool does not change yet: the panel stays
 * the one the edit is on until the answer changes both. A live selection is
 * not an edit, so leaving the lasso with one drawn will ask nothing - and nor
 * is a placement picked and left as it was, which is let go as the tool
 * changes.
 *
 * With auto accept on for changing tool, the edit is kept without the
 * question - as if `ACCEPT EDITS` had been answered `YES` - and the tool
 * changes. No tool is chosen while the live one is suspended, by a held pan
 * or by the builder's settings over the canvas.
 *
 * Returns true when the live tool changed, and false when it did not - which,
 * with an edit pending, is because `ACCEPT EDITS` is now asking.
 */
export function chooseBuildTool(state, id) {
    if (!buildModeDrawing(state) || confirmOpen(state) || !isChoosableTool(id)) return false;
    if (state.tool === id || toolSuspended(state)) return false;

    if (editPending(state)) {
        if (!autoAccepts(state, 'tool')) {
            state.confirm = { ask: ACCEPT_EDITS, then: { tool: id } };
            return false;
        }
        autoKeep(state);
    }

    state.draft = null;
    state.tool = id;
    state.dropper = false;
    state.popup = null;
    return true;
}

// --- The camera from inside a tool -------------------------------------------------

/**
 * The camera taken from inside a tool: a pan held with the tool live, the
 * pointer driving the view rather than the tool until it is let go.
 *
 * It is an override rather than a tool, and not a change of one, because a
 * change of tool settles the draft - commits it, or asks whether to - and
 * moving the view in the middle of drawing a shape must do neither. So the
 * tool is suspended rather than changed: the draft, a shape half drawn, the
 * selection and the values are left as they are, nothing asks, and the tool
 * it was is the one it goes back to. Select's camera is its own, so nothing
 * overrides it.
 *
 * Refused off a canvas, with a question open, with Select live, and while
 * already held. Returns true when it is held.
 */
export function holdCamera(state) {
    const tool = buildModeTool(state);
    if (tool == null || tool === SELECT_TOOL || confirmOpen(state) || toolSuspended(state)) return false;
    state.camera = { overriding: true, resumes: tool };
    return true;
}

/** True while a pan held from inside a tool is driving the camera. */
export function cameraHeld(state) {
    return state?.camera?.overriding === true && buildModeDrawing(state);
}

/**
 * The pan let go of: the tool it suspended is live again, as it was. Returns
 * that tool, or null when nothing was held.
 */
export function releaseCamera(state) {
    if (!cameraHeld(state)) {
        if (state) state.camera = null;
        return null;
    }
    const { resumes } = state.camera;
    state.camera = null;
    return resumes;
}

/**
 * The builder's settings opened over the canvas. They are modal, and they
 * suspend the live tool the way a held pan does: nothing is committed or
 * cancelled, the draft is still the draft when they close, and the tool is
 * the tool it was - opening a screen must never be what accepts a half-drawn
 * stroke. A setting changed there applies from the next event on, so auto
 * accept turned on keeps nothing already in hand.
 *
 * Refused off a canvas, with a question open, and while the tool is already
 * suspended. The popup is shut. Returns true when the tool is suspended.
 */
export function suspendForSettings(state) {
    const tool = buildModeTool(state);
    if (tool == null || confirmOpen(state) || toolSuspended(state)) return false;
    state.settingsOver = { resumes: tool };
    state.popup = null;
    return true;
}

/** True while the builder's settings are open over the canvas. */
export function settingsOver(state) {
    return state?.settingsOver != null && buildModeDrawing(state);
}

/**
 * The builder's settings closed over the canvas: the tool they suspended is
 * live again, as it was. Returns that tool, or null when none was suspended.
 */
export function resumeFromSettings(state) {
    if (!settingsOver(state)) {
        if (state) state.settingsOver = null;
        return null;
    }
    const { resumes } = state.settingsOver;
    state.settingsOver = null;
    return resumes;
}

/** True while the live tool is suspended - by a held pan, or by the builder's settings over the canvas. */
export function toolSuspended(state) {
    return cameraHeld(state) || settingsOver(state);
}

// --- Auto accept ---------------------------------------------------------------------

/**
 * The moments a pending draft can be kept without being asked about: the next
 * press that draws, the way out, and another tool. `all` turns every one on.
 */
export const AUTO_ACCEPT_MOMENTS = Object.freeze(['draw', 'exit', 'tool']);

/** Nothing kept without asking, which is where a session starts. */
function noAutoAccept() {
    return { all: false, draw: false, exit: false, tool: false };
}

/**
 * The moments auto accept covers, handed in from the builder's settings:
 * `{ all, draw, exit, tool }`, anything not plainly on being off. It changes
 * what the next event does and nothing in hand. Returns what it holds now.
 */
export function setAutoAccept(state, moments = {}) {
    const next = noAutoAccept();
    for (const key of Object.keys(next)) next[key] = moments?.[key] === true;
    state.autoAccept = next;
    return { ...next };
}

/** True when a pending draft is kept without being asked about at `moment`. */
export function autoAccepts(state, moment) {
    const set = state?.autoAccept;
    if (set == null || !AUTO_ACCEPT_MOMENTS.includes(moment)) return false;
    return set.all === true || set[moment] === true;
}

/**
 * A press that draws again while a draft is pending - a stroke begun, a
 * mountain dropped, a runway placed, a shape begun with an extrusion lifted:
 * with auto accept on for drawing, the draft is kept first, so what is drawn
 * now starts one of its own. Nothing is kept on a release, so a stroke just
 * drawn stays editable until the next press.
 *
 * Only by a tool that draws - Select picks and the lasso selects - whose draft
 * the one in hand is, a change of tool having settled any other. An extrusion
 * still being drawn is not kept - its
 * shapes are one region until `EXTRUDE` lifts it - nor one at its surfaces,
 * where a press chooses a surface. Nothing is kept with the eye dropper armed,
 * under a question, or with the tool suspended. Returns true when it kept the
 * draft.
 */
export function drawAgain(state) {
    const tool = buildModeTool(state);
    if (!autoAccepts(state, 'draw') || !draftPending(state) || confirmOpen(state) || toolSuspended(state)) return false;
    if (eyeDropperArmed(state)) return false;

    const draws = isStrokeTool(tool) || dropsAtClick(tool) || insertsTemplate(tool)
        || (isExtrudeTool(tool) && state.draft.stage === EXTRUDE_EXTRUDING);
    if (!draws) return false;

    autoKeep(state);
    return true;
}

/**
 * A draft auto accept keeps - at the next press that draws, the way out or
 * another tool - joined to the placement it kept just before when nothing
 * about it changed, and committed as a placement of its own otherwise.
 *
 * Accepting by hand, a batch of strokes is one placement; kept stroke by
 * stroke, it would be one placement a stroke, each a copy of the field on
 * every tile it is drawn on. So a stroke tool's draft is joined to the
 * placement auto accept kept last - the same element, the same configuration
 * once resolved and the same clip, with nothing committed between - its
 * footprint added to that one's as a union, which is the ground a batch
 * accepted by hand would have drawn while the configuration held still. A
 * placement starts only where the pilot changed something, which is where
 * Select needs to tell two apart. A stroke tool's alone: a mountain, a runway
 * or an extrusion is one thing where it stands, and an extrusion is levelled
 * to the mean of the ground it covers, which a union would change.
 *
 * Returns the placement the draft was kept as, or null with none in hand.
 */
function autoKeep(state) {
    const draft = state.draft;
    if (draft == null) return null;

    const last = state.placements.length - 1;
    if (state.kept === last && last >= 0 && joinsKept(draft, state.placements[last])) {
        rememberToolValues(state);
        const into = state.placements[last];
        into.footprint = addToPlaced(into.footprint, own(draft.placement.footprint));
        state.draft = null;
        return own(into);
    }

    // A pick changed and kept carries no tool, so it starts no run.
    const kept = acceptDraft(state);
    state.kept = isStrokeTool(draft.tool) ? state.placements.length - 1 : null;
    return kept;
}

/**
 * True when a draft can be joined to the placement auto accept kept: one of
 * the same element, configuration and clip. Only a stroke tool's batch is
 * ever kept as one to join, and an element is drawn by one tool, so a draft
 * of the same element is that tool's too - with a footprint, as a stroke
 * tool's always has.
 */
function joinsKept(draft, placement) {
    const made = draft.placement;
    return samePlacement({ ...made, footprint: null }, { ...placement, footprint: null })
        && JSON.stringify(made.clip ?? null) === JSON.stringify(placement.clip ?? null);
}

// --- The selection, and the lasso that draws it -----------------------------------

/** True while a region is selected. */
export function selectionLive(state) {
    return state?.selection != null;
}

/** The region selected, as a copy, or null. */
export function buildSelection(state) {
    return selectionLive(state) ? own(state.selection) : null;
}

/**
 * Makes a drawn region the selection, in place of any before it. Refused off a
 * canvas, with a confirm open, and for anything that is not a region - a
 * lasso that came to no region selects nothing rather than everything.
 *
 * A selection is not an edit: it asks nothing when it is drawn, replaced or
 * dropped, and leaving a canvas with one drawn keeps nothing of it.
 */
export function setSelection(state, footprint, { tool = null } = {}) {
    if (!buildModeDrawing(state) || confirmOpen(state) || !isSelection(footprint)) return false;
    state.selection = own(footprint);
    state.selectionTool = lassoToolBuilt(tool) ? tool : null;
    return true;
}

/**
 * A finished shape drawn into the selection by the op its press latched -
 * added, drawn inside, or cut out - by `tool`, on a canvas `size` wide.
 *
 * With nothing selected a shape that adds is the selection, drawn by its tool,
 * and one that cuts out of nothing leaves nothing. Combined with a selection,
 * the result belongs to no one tool. A result that covers no ground - a shape
 * drawn inside a selection it does not touch, or cut out of the whole of it -
 * leaves nothing selected, since that is what it selects. A shape that came to
 * no region changes nothing.
 *
 * Returns true when the selection changed.
 */
export function drawIntoSelection(state, shape, op, { tool = null, size = 0 } = {}) {
    if (!buildModeDrawing(state) || confirmOpen(state) || !isSelection(shape)) return false;

    const before = state.selection;
    const next = combineSelection(before, shape, op);
    if (next == null || !coversGround(next, size)) {
        if (before == null) return false;
        state.selection = null;
        state.selectionTool = null;
        return true;
    }
    return setSelection(state, next, { tool: before == null ? tool : null });
}

/**
 * Drops the selection, which is the only thing that does: it survives a tool
 * change, so a lasso drawn once is the region every tool after it works in.
 * Returns true when there was one to drop.
 */
export function deselect(state) {
    if (!buildModeDrawing(state) || confirmOpen(state) || !selectionLive(state)) return false;
    state.selection = null;
    state.selectionTool = null;
    state.popup = null;
    return true;
}

// --- Extrude ----------------------------------------------------------------------------

/** The Extrude shape chosen, which the next shape is drawn with. */
export function buildExtrudeTool(state) {
    return extrudeTool(state?.extrudeTool) ? state.extrudeTool : DEFAULT_EXTRUDE_TOOL;
}

/** The chosen Extrude shape's own fields - a star's points, a polygon's sides - as they were left. */
export function extrudeValues(state) {
    const ranges = extrudeTool(buildExtrudeTool(state))?.ranges ?? {};
    const values = {};
    for (const [name, range] of Object.entries(ranges)) values[name] = state?.extrudeValues?.[name] ?? range.default;
    return values;
}

/** Keeps a value moved on the chosen shape's fields, for the next shape it draws. */
export function setExtrudeValues(state, values = {}) {
    const ranges = extrudeTool(buildExtrudeTool(state))?.ranges ?? {};
    const kept = { ...(state.extrudeValues ?? {}) };
    for (const name of Object.keys(ranges)) if (Number.isFinite(values?.[name])) kept[name] = values[name];
    state.extrudeValues = kept;
    return extrudeValues(state);
}

/** True for Extrude's own draft, the extrusion being made - not a committed one picked up again. */
function extrudeDraft(state) {
    return draftPending(state) && isExtrudeTool(state.draft.tool) && state.draft.replaces == null;
}

/**
 * The stage Extrude's draft is at, or `drawing` with Extrude live and nothing
 * in hand yet - see `js/extrude.js`. Null for any other tool.
 */
export function extrudeStage(state) {
    if (!buildModeDrawing(state) || !isExtrudeTool(state.tool)) return null;
    return extrudeDraft(state) ? state.draft.stage ?? EXTRUDE_DRAWING : EXTRUDE_DRAWING;
}

/** True while Extrude is drawing shapes - live, with nothing lifted yet - which is when the pointer draws shapes. */
export function extrudeDrawing(state) {
    return extrudeStage(state) === EXTRUDE_DRAWING && !confirmOpen(state);
}

/**
 * The region Extrude would lift: the draft's, while there is one, and with
 * none the selection, which is a shape Extrude can lift as it stands - so
 * `EXTRUDE` is ready on arrival with a lasso drawn. Null with neither.
 */
export function extrudeRegion(state) {
    if (extrudeDraft(state)) return own(state.draft.placement.footprint);
    if (isExtrudeTool(state?.tool) && selectionLive(state)) return own(state.selection);
    return null;
}

/** True when the region Extrude would lift covers some ground on a canvas `size` wide, which is when `EXTRUDE` can be pressed. */
export function extrudeReady(state, { size = 0 } = {}) {
    const region = extrudeRegion(state);
    return region != null && coversGround(region, size);
}

/**
 * Choosing one of Extrude's shapes. With an extrusion lifted in hand, it is
 * kept - committed, with nothing asked - and Extrude is back at drawing with
 * the shape chosen: picking a shape is how the stages are left, and the
 * question a tool change asks is for leaving a tool, not for changing shape
 * within one. While drawing, the shapes drawn stay, and the next is drawn
 * with the new one.
 *
 * Refused off a canvas, with a confirm open, with Extrude not live, and for a
 * shape Extrude does not offer. Returns true when the shape is now chosen.
 */
export function chooseExtrudeTool(state, id) {
    if (!buildModeDrawing(state) || confirmOpen(state) || !isExtrudeTool(state.tool) || extrudeTool(id) == null) return false;
    if (extrudeDraft(state) && state.draft.stage !== EXTRUDE_DRAWING) acceptDraft(state);
    state.extrudeTool = id;
    return true;
}

/**
 * A shape drawn with Extrude while it is drawing, joined to the region by
 * `op`, which the key held at its press said - see `lassoOp`: with nothing
 * selected, every shape is added, so several drawn before `EXTRUDE` lift as
 * one region, overlaps and all; with a selection live, the region starts as
 * the selection and a shape is drawn inside it, added to it with `shift` or
 * cut out of it with `alt`.
 *
 * The first shape begins the draft: an extrusion of the region, set down in a
 * frame of its own so the gumball can move, turn and stretch it, at the stage
 * of drawing. A shape that leaves the region covering no ground is refused.
 * Returns true when the region changed.
 */
export function drawExtrudeShape(state, shape, op = 'union', { size = 0 } = {}) {
    if (!extrudeDrawing(state) || !isFootprint(shape)) return false;
    const kind = op === 'subtract' || op === 'intersect' ? op : 'union';

    if (extrudeDraft(state)) {
        const placement = state.draft.placement;
        const next = addToPlaced(placement.footprint, shape, kind);
        if (!coversGround(next, size)) return false;
        placement.footprint = next;
        return true;
    }

    const region = combineSelection(selectionLive(state) ? own(state.selection) : null, shape, kind);
    if (region == null || !coversGround(region, size)) return false;
    return beginExtrusion(state, region);
}

/** An extrusion of `region` begun, at the stage of drawing, from where Extrude's panel was left. */
function beginExtrusion(state, region) {
    const tool = buildTool(state.tool);
    const values = { ...resolveConfig({ ranges: toolRanges(tool) }, {}), ...own(state.toolValues?.[tool.id] ?? {}) };
    delete values.level;
    const placement = toolPlacement(tool, values, placeFootprint(region));
    if (!startDraft(state, placement, tool.id)) return false;
    state.draft.stage = EXTRUDE_DRAWING;
    return true;
}

/**
 * Extrude's one button pressed: `EXTRUDE` lifts the region - the draft's, or
 * the selection as it stands - and puts the gumball on it; `EDIT EXTRUSION`
 * puts the gumball away for the surfaces, remembering their colours as they
 * are; `APPLY` comes back from them keeping what was changed. `EXTRUDE` is
 * refused while the region covers no ground.
 *
 * Returns the stage the draft is at now, or null when nothing moved on.
 */
export function pressExtrudeStage(state, { size = 0 } = {}) {
    const stage = extrudeStage(state);
    if (stage == null || confirmOpen(state)) return null;

    if (stage === EXTRUDE_DRAWING) {
        if (!extrudeReady(state, { size })) return null;
        if (!extrudeDraft(state) && !beginExtrusion(state, own(state.selection))) return null;
    }

    const draft = state.draft;
    draft.stage = EXTRUDE_STAGES[stage].next;
    if (draft.stage === EXTRUDE_SURFACES) {
        // What `BACK` puts back: the surfaces as they stood on the way in. An
        // extrusion holds every value from the moment it is begun, so its own
        // are all there is to read.
        const { topColor, wallColor, blend } = draft.placement.config;
        draft.surfacesFrom = { topColor, wallColor, blend };
    } else {
        delete draft.surfacesFrom;
        delete draft.surface;
        state.dropper = false;
    }
    return draft.stage;
}

/** The surface of the extrusion in hand a click has pointed the panel at - `top` or `wall` - or null for neither. */
export function extrudeSurface(state) {
    return extrudeStage(state) === EXTRUDE_SURFACES && extrudeDraft(state) ? state.draft.surface ?? null : null;
}

/**
 * A click on the extrusion at its surfaces: the panel pointed at the surface
 * clicked - `top` or `wall`, as `surfaceAt` reads the footprint there - or, off
 * the extrusion, at both again. It chooses which declared colour the panel
 * edits; nothing in the ground is selected. Refused at any other stage.
 * Returns true when the surface the panel is pointed at changed.
 */
export function chooseExtrudeSurface(state, surface) {
    if (extrudeStage(state) !== EXTRUDE_SURFACES || !extrudeDraft(state) || confirmOpen(state)) return false;
    const next = EXTRUDE_SURFACES_DECLARED[surface] ? surface : null;
    if ((state.draft.surface ?? null) === next) return false;
    state.draft.surface = next;
    state.dropper = false;
    return true;
}

/**
 * `BACK` from the surfaces: back at extruding, with the surfaces as they stood
 * on the way in - the colours changed since dropped, as a cancel drops them,
 * where `APPLY` keeps them. Returns true when it went back.
 */
export function backFromSurfaces(state) {
    if (extrudeStage(state) !== EXTRUDE_SURFACES || !extrudeDraft(state) || confirmOpen(state)) return false;
    const draft = state.draft;
    if (draft.surfacesFrom) draft.placement.config = { ...draft.placement.config, ...own(draft.surfacesFrom) };
    draft.stage = EXTRUDE_EXTRUDING;
    delete draft.surfacesFrom;
    delete draft.surface;
    state.dropper = false;
    return true;
}

// --- The popup a right click on the selection opens ------------------------------

/**
 * A right click on the selection: a small popup at the pointer carrying
 * `DESELECT`, the quick way to drop the selection with no travel to the panel.
 * It is the panel's answer in another place, and goes through `deselect` as
 * that does. `at` is the screen point it opens at; `inside` says the click
 * landed on the selected ground, and off it nothing opens.
 *
 * Refused off a canvas, with a confirm open, and with nothing selected.
 * Returns true when the popup is open.
 */
export function openDeselectPopup(state, at, inside = true) {
    if (!buildModeDrawing(state) || confirmOpen(state) || !selectionLive(state) || inside !== true) return false;
    if (!Number.isFinite(at?.x) || !Number.isFinite(at?.y)) return false;
    state.popup = { x: at.x, y: at.y };
    return true;
}

/** Where the popup stands while it is open, as a copy, and null while it is shut. */
export function deselectPopup(state) {
    return buildModeDrawing(state) && !confirmOpen(state) && selectionLive(state) && state.popup != null
        ? { ...state.popup }
        : null;
}

/** Shuts the popup without dropping anything. Returns true when it was open. */
export function closeDeselectPopup(state) {
    const open = deselectPopup(state) != null;
    if (state) state.popup = null;
    return open;
}

/** The lasso tool chosen, which the next shape is drawn with. */
export function buildLassoTool(state) {
    return buildModeDrawing(state) ? state.lassoTool : null;
}

/** Chooses one of the lasso's tools. Refused for one that is not built. Returns true when it changed. */
export function chooseLassoTool(state, id) {
    if (!buildModeDrawing(state) || confirmOpen(state) || !lassoToolBuilt(id) || state.lassoTool === id) return false;
    state.lassoTool = id;
    return true;
}

/** Where the chosen lasso tool's fields are, filled in from what it declares. */
export function lassoValues(state) {
    const ranges = lassoTool(state?.lassoTool)?.ranges ?? {};
    const values = {};
    for (const [name, range] of Object.entries(ranges)) values[name] = state.lassoValues?.[name] ?? range.default;
    return values;
}

/**
 * Keeps a value moved on the chosen lasso tool's panel, for the next shape it
 * draws - and, while the selection is one shape that tool drew, for that shape
 * too: a hexagon's sides set to seven reshape the hexagon already on the
 * ground rather than waiting for the next to be drawn.
 */
export function setLassoValues(state, values = {}) {
    const ranges = lassoTool(state?.lassoTool)?.ranges ?? {};
    const kept = { ...(state.lassoValues ?? {}) };
    for (const name of Object.keys(ranges)) if (Number.isFinite(values?.[name])) kept[name] = values[name];
    state.lassoValues = kept;

    if (state.selection != null && state.selectionTool === state.lassoTool) {
        const shaped = reshapeFootprint(state.selection, state.lassoTool, lassoValues(state));
        if (shaped != null && isSelection(shaped)) state.selection = shaped;
    }
    return lassoValues(state);
}

/** The lasso tool the selection was drawn with, while it is one shape, or null. */
export function selectionTool(state) {
    return selectionLive(state) ? state.selectionTool : null;
}
