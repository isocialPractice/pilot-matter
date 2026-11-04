/**
 * Build tools - the twelve tools the builder's palette is drawn from, in the
 * order the tour gives them, and which of them are built.
 *
 * The palette draws only tools that work. A tile that does nothing is a row
 * that does nothing with a picture on it, and the pause menu already drops the
 * builder's own entry rather than show one of those. So the palette starts as
 * Select and the accept tool, and each tool joins `BUILT_TOOLS` in the commit
 * that makes it work, taking the place in the column the twelve give it.
 *
 * Pure module with no DOM or Three.js dependency, so which tiles are drawn,
 * and in what order, can be unit tested in Node.
 */

/** The navigation state, and the tool a canvas opens on. */
export const SELECT_TOOL = 'select';

/**
 * The twelfth tool, which is a way out rather than a mode: choosing it asks to
 * leave, and it never becomes the live tool.
 */
export const ACCEPT_TOOL = 'accept';

/**
 * The twelve, in the tour's order, each with the name its tile carries, the
 * line a pointer resting on the tile reads, and whether it minds the lasso.
 *
 * Names are text until the marks the builder ships are in the repository.
 * `mindsLasso` is the tour's own column: a tool that minds it is drawn only
 * inside a live selection, and one that does not - Select, the lasso itself,
 * the runway and the way out - is the same with a selection as without one.
 *
 * `element` is the registry element a tool places, whose declared ranges are
 * its panel: nothing is restated here, so a range added to the element appears
 * on the tool's panel without this file being opened. A tool whose element is
 * not in the registry yet - paint, extrude - names it in the commit that adds
 * it, and the panel's conformance test holds it to the registry from then on.
 *
 * `heading` is what the tool's panel is headed, in the artwork's own words -
 * `SELECTION MODE`, `BUILD MOUNTAINS`, `INSERT RUNWAY` - where the artwork has
 * drawn one.
 */
export const BUILD_TOOLS = Object.freeze([
    { id: SELECT_TOOL, label: 'SELECT',          hint: 'Look around the canvas',                      mindsLasso: false, heading: 'SELECTION MODE' },
    { id: 'lasso',     label: 'LASSO',           hint: 'Draw a region the tools below are clipped to', mindsLasso: false },
    { id: 'mountain',  label: 'MOUNTAIN',        hint: 'Drop a mountain at a click',                  mindsLasso: true,  element: 'mountain', heading: 'BUILD MOUNTAINS' },
    { id: 'grass',     label: 'GRASS',           hint: 'Lay grass by dragging',                       mindsLasso: true,  element: 'grass', heading: 'BUILD GRASS' },
    { id: 'sand',      label: 'SAND',            hint: 'Lay sand by dragging',                        mindsLasso: true,  element: 'sand', heading: 'BUILD SAND' },
    { id: 'water',     label: 'WATER',           hint: 'Lay water by dragging',                       mindsLasso: true,  element: 'water', heading: 'BUILD WATER' },
    { id: 'snow',      label: 'SNOW',            hint: 'Lay snow by dragging',                        mindsLasso: true,  element: 'snow', heading: 'BUILD SNOW' },
    { id: 'runway',    label: 'RUNWAY',          hint: 'Place a runway or an airport',                mindsLasso: false, element: 'runway', heading: 'INSERT RUNWAY' },
    { id: 'paint',     label: 'FREE PAINT',      hint: 'Brush a colour onto the ground',              mindsLasso: true },
    { id: 'erase',     label: 'ERASE',           hint: 'Take an element away through a stroke',       mindsLasso: true },
    { id: 'extrude',   label: 'EXTRUDE',         hint: 'Draw a shape and pull it up',                 mindsLasso: true },
    { id: ACCEPT_TOOL, label: 'ACCEPT AND EXIT', hint: 'Leave the builder (Esc)',                     mindsLasso: false }
].map(tool => Object.freeze(tool)));

/** True for a tool drawn only inside a live selection, which is the tour's lasso column. */
export function mindsLasso(id) {
    return BUILD_TOOLS.find(tool => tool.id === id)?.mindsLasso === true;
}

export const BUILD_TOOL_IDS = Object.freeze(BUILD_TOOLS.map(tool => tool.id));

/**
 * The tools that work today. A tool is added here in the commit that makes it
 * work, and not before, so the palette never offers one that does nothing.
 */
export const BUILT_TOOLS = Object.freeze([SELECT_TOOL, ACCEPT_TOOL]);

/** True for one of the twelve. */
export function isBuildTool(id) {
    return BUILD_TOOL_IDS.includes(id);
}

/** True for a tool that works, which is a tool the palette draws. */
export function isBuiltTool(id, built = BUILT_TOOLS) {
    return isBuildTool(id) && built.includes(id);
}

/**
 * True for a tool that can be the live one. The accept tool is built and drawn,
 * but it is a way out rather than a mode, so it is never what a canvas is being
 * worked with.
 */
export function isChoosableTool(id, built = BUILT_TOOLS) {
    return isBuiltTool(id, built) && id !== ACCEPT_TOOL;
}

/**
 * The tiles the palette draws: the built tools, in the twelve's order. The
 * accept tool is last of the twelve, so it is last here too, at the foot of the
 * column, wherever the tools between are added.
 */
export function paletteTools(built = BUILT_TOOLS) {
    return BUILD_TOOLS.filter(tool => built.includes(tool.id));
}

/** The tool that places an element, or null for an element no tool places yet. */
export function toolForElement(type) {
    return BUILD_TOOLS.find(tool => tool.element != null && tool.element === type) ?? null;
}

/**
 * The placement a tool makes from what its panel is holding.
 *
 * The one place a panel's values become a build argument. The panel collects,
 * this splits, and the generator the registry already has draws - so a tool
 * that renders no panel of its own also builds down no path of its own, and an
 * edit that fails to register fails in one place for every tool.
 *
 * A tool lists in `shapes` the values that describe what its pointer drew - a
 * stamp's width, a brush's tip - and those go to the footprint, laid over what
 * was drawn. Everything else is the element's configuration.
 */
export function toolPlacement(tool, values = {}, drawn = null) {
    const config = {};
    const shape  = {};

    for (const [name, value] of Object.entries(values ?? {})) {
        (tool?.shapes?.includes(name) ? shape : config)[name] = value;
    }

    const placement = { type: tool?.element, config };
    if (drawn != null || Object.keys(shape).length > 0) placement.footprint = { ...(drawn ?? {}), ...shape };
    return placement;
}
