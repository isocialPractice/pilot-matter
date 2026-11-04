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
 * Pure module with no DOM or Three.js dependency, so what the dock shows for a
 * session can be unit tested in Node and the drawing of it is
 * `js/panel-view.js`'s job.
 */

import {
    buildModeDrawing, buildModeTool, draftPending, buildDraft, builtPlacements
} from './build-mode.js';
import { BUILD_TOOLS, SELECT_TOOL, toolForElement, derivedValues } from './build-tools.js';
import { cameraFieldRanges, readCameraFields, CAMERA_NUDGES } from './build-camera.js';
import { panelRows, label } from './properties-panel.js';
import { getElement, isElementId, resolveConfig } from './environment/elements.js';
import { environmentElements } from './environment/presets.js';

/** What the dock is showing: the camera, or an edit in hand. */
export const DOCK_SELECT = 'select';
export const DOCK_DRAFT  = 'draft';

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

    const ranges = { ...getElement(placement.type).ranges };
    if (placement.config?.at == null) return ranges;

    for (const name of Object.keys(derivedValues(toolForElement(placement.type)))) delete ranges[name];
    return ranges;
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
 */
export function dockContent(state, { camera = null, fov, holder = null, context = {} } = {}) {
    if (!buildModeDrawing(state)) return null;

    if (draftPending(state)) {
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
            actions: [DOCK_ACCEPT, DOCK_CANCEL]
        };
    }

    if (buildModeTool(state) === SELECT_TOOL && camera != null) {
        const ranges = cameraFieldRanges(camera);
        const held   = { config: readCameraFields(camera, fov) };
        return {
            kind: DOCK_SELECT,
            heading: SELECT_HEADING,
            ranges,
            holder: held,
            rows: panelRows(ranges, held, context),
            nudges: CAMERA_NUDGES,
            actions: []
        };
    }

    return null;
}

/**
 * The placements a canvas is drawn from: the environment's own, then what has
 * been built on it with the edit in hand shown where it stands - so what is on
 * the canvas is what accepting would keep, and a value moved on the panel is
 * the ground moving under it.
 */
export function canvasElements(environment, state) {
    return [...environmentElements(environment, false), ...builtPlacements(state)];
}
