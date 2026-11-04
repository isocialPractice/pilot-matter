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
import { BUILD_TOOLS, SELECT_TOOL, toolForElement } from './build-tools.js';
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
 * Null for a placement of an element the registry does not hold.
 */
export function draftHolderFor(placement) {
    if (!isElementId(placement?.type)) return null;

    const element = getElement(placement.type);
    const config  = resolveConfig(element, placement.config);
    const shades  = {};
    const base    = {};

    for (const [name, range] of Object.entries(element.ranges)) {
        if (range.kind !== 'gradient') continue;
        shades[name] = { light: 1, dark: 1 };
        base[name] = structuredClone(config[name]);
    }

    return { config, shades, base };
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

        const ranges = getElement(draft.type).ranges;
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
