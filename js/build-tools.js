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
 * The twelve, in the tour's order, each with the name its tile carries and the
 * line a pointer resting on the tile reads. Names are text until the marks the
 * builder ships are in the repository.
 */
export const BUILD_TOOLS = Object.freeze([
    { id: SELECT_TOOL, label: 'SELECT',          hint: 'Look around the canvas' },
    { id: 'lasso',     label: 'LASSO',           hint: 'Draw a region the tools below are clipped to' },
    { id: 'mountain',  label: 'MOUNTAIN',        hint: 'Drop a mountain at a click' },
    { id: 'grass',     label: 'GRASS',           hint: 'Lay grass by dragging' },
    { id: 'sand',      label: 'SAND',            hint: 'Lay sand by dragging' },
    { id: 'water',     label: 'WATER',           hint: 'Lay water by dragging' },
    { id: 'snow',      label: 'SNOW',            hint: 'Lay snow by dragging' },
    { id: 'runway',    label: 'RUNWAY',          hint: 'Place a runway or an airport' },
    { id: 'paint',     label: 'FREE PAINT',      hint: 'Brush a colour onto the ground' },
    { id: 'erase',     label: 'ERASE',           hint: 'Take an element away through a stroke' },
    { id: 'extrude',   label: 'EXTRUDE',         hint: 'Draw a shape and pull it up' },
    { id: ACCEPT_TOOL, label: 'ACCEPT AND EXIT', hint: 'Leave the builder (Esc)' }
].map(tool => Object.freeze(tool)));

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
