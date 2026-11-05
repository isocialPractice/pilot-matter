/**
 * The dock - what the panel down the right of a canvas shows.
 *
 * There is one panel, generated from declared ranges by
 * `js/properties-panel.js`, and this is the decision of what it is pointed at:
 * the edit in hand when there is one, with the accept and cancel that settle
 * it, and otherwise the live tool's own panel - Select's being the camera
 * written out, so a gesture is read back and a typed value is written. A tool
 * draws no panel of its own; it is pointed at.
 *
 * Select's panel is the camera and then what is being looked at, in sections
 * beneath it: the placement picked, with the accept and cancel that settle it,
 * or with nothing picked the environment's own elements - the rows the element
 * editor holds, changed across the whole world - each folded under its own
 * heading until it is opened. One editor with two scopes, so a committed batch
 * and the world it stands on are changed the same way.
 *
 * Pure module with no DOM or Three.js dependency, so what the dock shows for a
 * session can be unit tested in Node and the drawing of it is
 * `js/panel-view.js`'s job.
 */

import {
    buildModeDrawing, buildModeTool, draftPending, buildDraft, builtPlacements,
    pickedIndex, worldPlacements, selectionLive, buildLassoTool, lassoValues, coverValues
} from './build-mode.js';
import { LASSO_HEADING, lassoRows, lassoTool, lassoToolArt, lassoToolName } from './lasso.js';
import {
    BUILD_TOOLS, SELECT_TOOL, toolForElement, derivedValues, buildTool, isCoverTool, COVER_BRUSH
} from './build-tools.js';

/** The palette's lasso tile, whose panel is its own ten tools rather than an element's ranges. */
const LASSO_TOOL = 'lasso';
import { cameraFieldRanges, readCameraFields, CAMERA_NUDGES } from './build-camera.js';
import { panelRows, label } from './properties-panel.js';
import { getElement, isElementId, resolveConfig } from './environment/elements.js';
import { environmentElements } from './environment/presets.js';

/** What the dock is showing: the camera, or an edit in hand. */
export const DOCK_SELECT = 'select';
export const DOCK_DRAFT  = 'draft';

/** A section of Select's panel holding one of the environment's own elements. */
export const DOCK_WORLD  = 'world';

/** What the dock shows with the lasso live: its tools, and the chosen one's fields. */
export const DOCK_LASSO = 'lasso';

/** What the dock shows with the cover tool live: its brush and its element's rows, and the batch's accept and cancel while one is in hand. */
export const DOCK_COVER = 'cover';

/** The answer that drops the selection, there only while something is selected. */
export const DOCK_DESELECT = Object.freeze({ id: 'deselect', label: 'DESELECT' });

/** The id of the section holding the placement picked with Select. */
export const PICK_SECTION = 'pick';

/** The id of the section holding the environment's own element at `index`. */
export function worldSection(index) {
    return `world-${index}`;
}

/** The two answers an edit in hand is settled by, pinned under its rows. */
export const DOCK_ACCEPT = Object.freeze({ id: 'accept', label: 'ACCEPT' });
export const DOCK_CANCEL = Object.freeze({ id: 'cancel', label: 'CANCEL' });

/** Select's heading, which is the start tour's own: the camera is what Select edits. */
export const SELECT_HEADING = BUILD_TOOLS.find(tool => tool.id === SELECT_TOOL).heading;

/**
 * What a draft is edited through: its configuration resolved against the
 * ranges its element declares, and each gradient held as the shade its ends are
 * drawn at against the colours they were when the edit began - so a gradient
 * end is stepped along its own hue, the way the element editor steps one.
 *
 * The point a placement was dropped on is the click's rather than the panel's,
 * so the holder leaves it out, and a value stepped never puts the placement
 * back where it was first dropped after a click has moved it.
 *
 * Null for a placement of an element the registry does not hold.
 */
export function draftHolderFor(placement) {
    if (!isElementId(placement?.type)) return null;

    const element = getElement(placement.type);
    const config  = resolveConfig(element, placement.config);
    const shades  = {};
    const base    = {};
    delete config.at;

    for (const [name, range] of Object.entries(element.ranges)) {
        if (range.kind !== 'gradient') continue;
        shades[name] = { light: 1, dark: 1 };
        base[name] = structuredClone(config[name]);
    }

    return { config, shades, base };
}

/**
 * The ranges a placement's panel shows: every range its element declares, in
 * the order it declares them, less the ones the click settled when the
 * placement was dropped at one - a dropped mountain is one mountain, so its
 * count is the click's and the panel leaves it off rather than offering a
 * figure that would be ignored. A placement that was not dropped shows every
 * range, count and all.
 *
 * The mountain declares sixteen rows and the artwork draws six. The six are
 * the first six it declares, so they lead the panel in the artwork's order,
 * and the ranges added since - a girth drawn from a pair, the footprint said
 * outright, the mode that randomizes it - follow them down the scroll: one
 * dropped peak is still one peak those shape. The count is the one of the six
 * the click takes.
 */
export function panelRanges(placement) {
    if (!isElementId(placement?.type)) return {};

    const element = getElement(placement.type);
    const ranges = { ...element.ranges };

    // A range a footprint settles - a ground cover's band, which is the
    // ground's own relief under the stroke - is worked out on every tile it is
    // drawn on, so a figure for it here would be one the drawing ignores.
    if (placement.footprint != null) {
        for (const name of Object.keys(element.footprintSettles ?? {})) delete ranges[name];
    }

    if (placement.config?.at == null) return ranges;

    for (const name of Object.keys(derivedValues(toolForElement(placement.type)))) delete ranges[name];
    return ranges;
}

/**
 * The cover tool's panel, in the artwork's order: `DENSITY`, then the brush's
 * three - `BUILD HEIGHT`, `BUILD WIDTH`, `CORNER RADIUS` - then the colour's
 * two ends. The rest of what the element declares is not the pilot's here; see
 * `COVER_ELEMENT_ROWS`.
 */
export function coverRanges(id) {
    const tool = buildTool(id);
    if (!isCoverTool(id) || !isElementId(tool.element)) return {};

    const declared = getElement(tool.element).ranges;
    return { density: declared.density, ...COVER_BRUSH, color: declared.color };
}

/**
 * What the cover tool's panel is stepped through: its values - see
 * `coverValues` - with each gradient held as the shade its ends are drawn at
 * against the colours they were when the holder was made, as a draft's are.
 * Null for a tool that is not the cover tool.
 */
export function coverHolderFor(state, id = state?.tool) {
    const values = coverValues(state, id);
    if (values == null) return null;

    const config = {};
    for (const name of Object.keys(coverRanges(id))) config[name] = structuredClone(values[name]);
    return { config, shades: { color: { light: 1, dark: 1 } }, base: { color: structuredClone(config.color) } };
}

/**
 * What the dock shows for a session, or null for nothing.
 *
 * With an edit in hand it is that edit's rows - the ranges its element
 * declares, through `holder` - headed the way its tool's panel is, with the
 * accept and the cancel that settle it. With none, and Select live, it is the
 * camera's fields and the rows that slide the view, read off `camera` and
 * `fov`. A tool with no panel yet shows nothing. Off a canvas there is no dock.
 *
 * `context` is what a range's `ctx` gate reads - whether a selection is live.
 *
 * With Select live the camera is the dock's first part and `sections` follow
 * it, each `{ id, kind, heading, holder, rows, open, folds }`: the placement
 * picked, under `SELECTED` and its element's name, or with nothing picked one
 * section for each of the environment's own elements, folded shut unless its
 * index is in `open`. A section's rows each carry the section's id, and its
 * holder is what a row in it writes: the edit in hand's holder for the pick,
 * and the session's own row for an element of the world - so a value stepped
 * there is the world changed, and the canvas is drawn again from it.
 */
export function dockContent(state, { camera = null, fov, holder = null, context = {}, open = [] } = {}) {
    if (!buildModeDrawing(state)) return null;

    const select = buildModeTool(state) === SELECT_TOOL && camera != null;
    const picked = pickedIndex(state) != null;

    if (isCoverTool(buildModeTool(state))) return coverContent(state, holder, context);

    if (draftPending(state) && !(select && picked)) {
        const draft = buildDraft(state);
        const held  = holder ?? draftHolderFor(draft);
        if (held == null) return null;

        const ranges = panelRanges(draft);
        return {
            kind: DOCK_DRAFT,
            heading: toolForElement(draft.type)?.heading ?? `BUILD ${label(draft.type)}`,
            ranges,
            holder: held,
            rows: panelRows(ranges, held, context),
            nudges: [],
            actions: [DOCK_ACCEPT, DOCK_CANCEL],
            sections: []
        };
    }

    if (buildModeTool(state) === LASSO_TOOL) return lassoContent(state, context);

    if (!select) return null;

    const ranges = cameraFieldRanges(camera);
    const held   = { config: readCameraFields(camera, fov) };
    const content = {
        kind: DOCK_SELECT,
        heading: SELECT_HEADING,
        ranges,
        holder: held,
        rows: panelRows(ranges, held, context),
        nudges: CAMERA_NUDGES,
        actions: [],
        sections: []
    };

    if (picked) {
        const draft = buildDraft(state);
        const pick  = holder ?? draftHolderFor(draft);
        if (pick != null) {
            content.sections.push(dockSection(
                PICK_SECTION, DOCK_DRAFT, `SELECTED ${label(draft.type)}`, panelRanges(draft), pick, context
            ));
            content.actions = [DOCK_ACCEPT, DOCK_CANCEL];
        }
        return content;
    }

    (state.world ?? []).forEach((row, index) => {
        if (!isElementId(row?.type)) return;
        const section = dockSection(
            worldSection(index), DOCK_WORLD, `WORLD: ${row.label ?? label(row.type)}`,
            getElement(row.type).ranges, row, context, open.includes(index)
        );
        section.folds = true;
        section.index = index;
        content.sections.push(section);
    });

    return content;
}

/**
 * The lasso's panel: its tools in the rows the artwork groups them into - the
 * ones that are built - with the chosen one lit, that tool's own fields under
 * them, and `DESELECT` while a region is selected and not otherwise.
 */
function lassoContent(state, context) {
    const chosen = buildLassoTool(state);
    const ranges = lassoTool(chosen)?.ranges ?? {};
    const holder = { config: lassoValues(state) };
    return {
        kind: DOCK_LASSO,
        heading: LASSO_HEADING,
        shapes: lassoRows().map(({ row, tools }) => ({
            row,
            tools: tools.map(tool => ({
                id: tool.id, label: tool.label, name: lassoToolName(tool.id),
                art: lassoToolArt(tool.id), live: tool.id === chosen
            }))
        })),
        ranges,
        holder,
        rows: panelRows(ranges, holder, context),
        nudges: [],
        actions: selectionLive(state) ? [DOCK_DESELECT] : [],
        sections: []
    };
}

/**
 * The cover tool's panel, there from the moment the tool is chosen rather than
 * from the first stroke, because its brush is how that stroke is drawn: the
 * stamp is set before the drag, not after it. With the tool's batch in hand it
 * is that batch's panel too, with the accept and cancel that settle it.
 */
function coverContent(state, holder, context) {
    const id    = buildModeTool(state);
    const held  = holder ?? coverHolderFor(state, id);
    if (held == null) return null;

    const ranges = coverRanges(id);
    return {
        kind: DOCK_COVER,
        heading: buildTool(id).heading,
        ranges,
        holder: held,
        rows: panelRows(ranges, held, context),
        nudges: [],
        actions: draftPending(state) ? [DOCK_ACCEPT, DOCK_CANCEL] : [],
        sections: []
    };
}

/** One section of the dock: a heading, the holder its rows write, and the rows - none while it is folded. */
function dockSection(id, kind, heading, ranges, holder, context, open = true) {
    return {
        id, kind, heading, holder, open, folds: false,
        rows: open ? panelRows(ranges, holder, context).map(entry => ({ ...entry, section: id })) : []
    };
}

/**
 * The placements a canvas is drawn from: the environment's own - as the
 * session holds them, so a row stepped on Select's panel is the world
 * changing, and as its preset describes them for a session holding none -
 * then what has been built on it with the edit in hand shown where it stands,
 * so what is on the canvas is what accepting would keep, and a value moved on
 * the panel is the ground moving under it.
 */
export function canvasElements(environment, state) {
    const world = state?.world?.length > 0 ? worldPlacements(state) : environmentElements(environment, false);
    return [...world, ...builtPlacements(state)];
}
