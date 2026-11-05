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
    pickedIndex, worldPlacements, selectionLive, buildLassoTool, lassoValues, strokeValues, buildRunwayTemplate,
    brushIsDefault, eyeDropperArmed
} from './build-mode.js';
import { isGroup, groupConfig, GROUP_RANGES, offeredTemplates, runwayTemplate } from './templates.js';
import { LASSO_HEADING, lassoRows, lassoTool, lassoToolArt, lassoToolName } from './lasso.js';
import {
    BUILD_TOOLS, SELECT_TOOL, toolForElement, derivedValues, buildTool, isCoverTool, isPaintTool, isEraseTool,
    isStrokeTool, toolRanges, COVER_BRUSH, PAINT_BRUSH, insertsTemplate
} from './build-tools.js';
import { isErase, ERASE_RANGES } from './environment/erase.js';

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

/** What the dock shows with Insert Runway live: its templates as cards, and the one in hand's rows. */
export const DOCK_RUNWAY = 'runway';

/** What the dock shows with Free Paint live: its colour, its brush and the brush's properties, each a section. */
export const DOCK_PAINT = 'paint';

/** What the dock shows with Erase live: what it takes and how much, and its brush. */
export const DOCK_ERASE = 'erase';

/** What the dock shows for a tool with no panel of its own yet while something is selected: its heading over `DESELECT`. */
export const DOCK_TOOL = 'tool';

/**
 * Free Paint's three sections, in the artwork's order, and the ranges each
 * holds: the colour under `COLOR SELECTION`; the brush's tip and edge under
 * `BRUSH SELECTION`, beneath the `DEFAULT` card that puts the brush back; and
 * the opacity, size and blend under `BRUSH PROPERTIES`.
 */
export const PAINT_SECTIONS = Object.freeze([
    Object.freeze({ id: 'paint-color', heading: 'COLOR SELECTION',  ranges: Object.freeze(['color']) }),
    Object.freeze({ id: 'paint-brush', heading: 'BRUSH SELECTION',  ranges: Object.freeze(['tip', 'edge']) }),
    Object.freeze({ id: 'paint-props', heading: 'BRUSH PROPERTIES', ranges: Object.freeze(['opacity', 'size', 'blend']) })
]);

/** The card on Free Paint's panel that puts the brush back as the tool starts it. */
export const DOCK_DEFAULT_BRUSH = Object.freeze({ id: 'default-brush', label: 'DEFAULT' });

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
    // A placed template's own rows - its heading and its strip's length and
    // width - which have no gradient to hold as shades.
    if (isGroup(placement)) {
        const { heading, length, width } = groupConfig(placement);
        return { config: { heading, length, width }, shades: {}, base: {} };
    }
    // An erase batch's own two, what it takes and how much of it.
    if (isErase(placement)) {
        return { config: resolveConfig({ ranges: ERASE_RANGES }, placement.config), shades: {}, base: {} };
    }
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
    if (isGroup(placement)) return { ...GROUP_RANGES };
    if (isErase(placement)) return { ...ERASE_RANGES };
    if (!isElementId(placement?.type)) return {};

    const element = getElement(placement.type);
    const ranges = { ...element.ranges };

    // A range a footprint settles - a ground cover's band, which is the
    // ground's own relief under the stroke, or drawn snow's line - is worked
    // out on every tile it is drawn on, and one a body drawn through a
    // footprint does not read - drawn water's level and flatten - is not
    // read at all, so a figure for either here would be one the drawing
    // ignores.
    if (placement.footprint != null) {
        for (const name of Object.keys(element.footprintSettles ?? {})) delete ranges[name];
        for (const name of element.footprintIgnores ?? []) delete ranges[name];
    }

    if (placement.config?.at == null) return ranges;

    for (const name of Object.keys(derivedValues(toolForElement(placement.type)))) delete ranges[name];
    return ranges;
}

/**
 * A stroke tool's panel, in the artwork's order.
 *
 * The cover tool's is `DENSITY`, then the brush's three - `BUILD HEIGHT`,
 * `BUILD WIDTH`, `CORNER RADIUS` - then the colour's two ends; the rest of what
 * the element declares is not the pilot's here, see `COVER_ELEMENT_ROWS`. Free
 * Paint's is its colour, its brush's tip and edge, then its opacity, size and
 * blend - every range `paint` declares, and the brush between them. Erase's is
 * what it takes and how much - `TARGET`, `ALL` or one element, and `STRENGTH`
 * - then the paint brush it is drawn with.
 */
export function strokeRanges(id) {
    const tool = buildTool(id);
    const declared = toolRanges(tool);
    if (!isStrokeTool(id) || declared == null) return {};

    if (isEraseTool(id)) {
        return { target: declared.target, strength: declared.strength, ...PAINT_BRUSH };
    }
    if (isPaintTool(id)) {
        return {
            color: declared.color, tip: PAINT_BRUSH.tip, edge: PAINT_BRUSH.edge,
            opacity: declared.opacity, size: PAINT_BRUSH.size, blend: declared.blend
        };
    }
    return { density: declared.density, ...COVER_BRUSH, color: declared.color };
}

/**
 * What a stroke tool's panel is stepped through: its values - see
 * `strokeValues` - with each gradient held as the shade its ends are drawn at
 * against the colours they were when the holder was made, as a draft's are. A
 * flat colour, Free Paint's, is chosen rather than shaded, and is held as it
 * is. Null for a tool that draws no strokes.
 */
export function strokeHolderFor(state, id = state?.tool) {
    const values = strokeValues(state, id);
    if (values == null) return null;

    const ranges = strokeRanges(id);
    const config = {};
    const shades = {};
    const base   = {};
    for (const [name, range] of Object.entries(ranges)) {
        config[name] = structuredClone(values[name]);
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
 *
 * With Select live the camera is the dock's first part and `sections` follow
 * it, each `{ id, kind, heading, holder, rows, open, folds }`: the placement
 * picked, under `SELECTED` and its element's name, or with nothing picked one
 * section for each of the environment's own elements, folded shut unless its
 * index is in `open`. A section's rows each carry the section's id, and its
 * holder is what a row in it writes: the edit in hand's holder for the pick,
 * and the session's own row for an element of the world - so a value stepped
 * there is the world changed, and the canvas is drawn again from it.
 *
 * While something is selected every panel carries `DESELECT` among its
 * answers, whatever tool is live - the one way to drop the selection that can
 * be seen without knowing it is there. The lasso's panel has it already, where
 * a pilot looks for it first. A tool with no panel of its own yet - Mountain,
 * before a click has dropped one - shows its heading over `DESELECT` alone,
 * since the selection belongs to the session rather than to any one tool.
 */
export function dockContent(state, options = {}) {
    const content = panelContent(state, options);
    if (!buildModeDrawing(state) || !selectionLive(state)) return content;
    if (content == null) {
        const tool = buildTool(buildModeTool(state));
        return {
            kind: DOCK_TOOL, heading: tool?.heading ?? tool?.label ?? '', ranges: {}, holder: { config: {} },
            rows: [], nudges: [], actions: [DOCK_DESELECT], sections: []
        };
    }
    if (content.actions.some(action => action.id === DOCK_DESELECT.id)) return content;
    return { ...content, actions: [...content.actions, DOCK_DESELECT] };
}

/** What the dock shows before the answer every panel gets while something is selected - see `dockContent`. */
function panelContent(state, { camera = null, fov, holder = null, context = {}, open = [] } = {}) {
    if (!buildModeDrawing(state)) return null;

    const select = buildModeTool(state) === SELECT_TOOL && camera != null;
    const picked = pickedIndex(state) != null;

    if (isCoverTool(buildModeTool(state))) return coverContent(state, holder, context, DOCK_COVER);
    if (isEraseTool(buildModeTool(state))) return coverContent(state, holder, context, DOCK_ERASE);
    if (isPaintTool(buildModeTool(state))) return paintContent(state, holder, context);
    if (insertsTemplate(buildModeTool(state))) return runwayContent(state, holder, context);

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
                PICK_SECTION, DOCK_DRAFT, `SELECTED ${placementName(draft)}`, panelRanges(draft), pick, context
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
 * Erase's is drawn the same way, as `kind`.
 */
function coverContent(state, holder, context, kind = DOCK_COVER) {
    const id    = buildModeTool(state);
    const held  = holder ?? strokeHolderFor(state, id);
    if (held == null) return null;

    const ranges = strokeRanges(id);
    return {
        kind,
        heading: buildTool(id).heading,
        ranges,
        holder: held,
        rows: panelRows(ranges, held, context),
        nudges: [],
        actions: draftPending(state) ? [DOCK_ACCEPT, DOCK_CANCEL] : [],
        sections: []
    };
}

/**
 * Free Paint's panel, there from the moment the tool is chosen, as the cover
 * tool's is: the brush is set before the stroke. Its rows are in three
 * sections under the artwork's headings, every one writing the one holder -
 * see `PAINT_SECTIONS` - with `DEFAULT` lit while the brush is the one the
 * tool starts with. With the tool's batch in hand it is that batch's panel
 * too, with the accept and cancel that settle it.
 *
 * `dropping` says the eye dropper is armed, so the panel can show it pressed.
 */
function paintContent(state, holder, context) {
    const id   = buildModeTool(state);
    const held = holder ?? strokeHolderFor(state, id);
    if (held == null) return null;

    const ranges = strokeRanges(id);
    const sections = PAINT_SECTIONS.map(({ id: section, heading, ranges: names }) => {
        const own = Object.fromEntries(names.map(name => [name, ranges[name]]));
        const part = dockSection(section, DOCK_PAINT, heading, own, held, context);
        if (section === 'paint-brush') {
            part.shapes = [{
                row: 'brush',
                tools: [{ ...DOCK_DEFAULT_BRUSH, name: 'Default brush', art: null, live: brushIsDefault(state) }]
            }];
        }
        return part;
    });

    return {
        kind: DOCK_PAINT,
        heading: buildTool(id).heading,
        ranges,
        holder: held,
        rows: [],
        nudges: [],
        actions: draftPending(state) ? [DOCK_ACCEPT, DOCK_CANCEL] : [],
        sections,
        dropping: eyeDropperArmed(state)
    };
}

/**
 * Insert Runway's panel: the templates as cards, the one chosen lit, and once
 * one is placed and in hand, its rows beneath them - `HEADING`, `LENGTH` and
 * `WIDTH` - with the accept and cancel that settle it. The cards are a choice,
 * of what is placed; the rows are the placement's own, edited as any draft's.
 */
function runwayContent(state, holder, context) {
    const chosen = buildRunwayTemplate(state);
    const draft  = draftPending(state) ? buildDraft(state) : null;
    const held   = draft ? holder ?? draftHolderFor(draft) : { config: {} };
    const ranges = draft ? panelRanges(draft) : {};
    return {
        kind: DOCK_RUNWAY,
        heading: buildTool(buildModeTool(state)).heading,
        shapes: [{
            row: 'templates',
            tools: offeredTemplates().map(template => ({
                id: template.id, label: template.label, name: label(template.id), art: null, live: template.id === chosen
            }))
        }],
        ranges,
        holder: held,
        rows: panelRows(ranges, held, context),
        nudges: [],
        actions: draft ? [DOCK_ACCEPT, DOCK_CANCEL] : [],
        sections: []
    };
}

/** What a placement is called on the dock: a placed template by its card's name, and an element by its own. */
function placementName(placement) {
    return isGroup(placement) ? runwayTemplate(placement.template)?.label ?? 'RUNWAY' : label(placement.type);
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
