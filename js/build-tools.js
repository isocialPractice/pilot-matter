/**
 * Build tools - the tools the builder's palette is drawn from, in the order the
 * palette's art stacks them, which of them are built, and the mark each tile
 * carries. The tour gave twelve; the palette's art since adds Insert City,
 * Insert Plane and the SAVE / LOAD bar across its foot.
 *
 * The palette draws only tools that work. A tile that does nothing is a row
 * that does nothing with a picture on it, and the pause menu already drops the
 * builder's own entry rather than show one of those. So the palette started as
 * Select and the accept tool, and each tool joins `BUILT_TOOLS` in the commit
 * that makes it work, taking the place in the column the twelve give it.
 *
 * Pure module with no DOM or Three.js dependency, so which tiles are drawn,
 * and in what order, can be unit tested in Node.
 */

import { scalar, choice } from './environment/elements.js';
import { DEFAULT_FEATHER, FEATHER_SHARE } from './environment/footprints.js';
import { ERASE_TYPE, placementRanges } from './environment/erase.js';
import { mode, modeIs } from './mode-types.js';

/** The navigation state, and the tool a canvas opens on. */
export const SELECT_TOOL = 'select';

/**
 * The last tile, which is a way out rather than a mode: choosing it asks to
 * leave, and it never becomes the live tool.
 */
export const ACCEPT_TOOL = 'accept';

/**
 * The bar across the palette's foot, under its tiles: SAVE / LOAD, where a
 * built world is written to a file and a saved one or a model is read back.
 */
export const FILES_TOOL = 'files';

/** Insert Plane: which plane a world is flown in, and where a flight on it starts. */
export const PLANE_TOOL = 'plane';

/** Insert City: buildings, roads and parks, placed from the catalogue's cards. */
export const CITY_TOOL = 'city';

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
 * not in the registry yet names it in the commit that adds
 * it, and the panel's conformance test holds it to the registry from then on.
 *
 * `heading` is what the tool's panel is headed, in the artwork's own words -
 * `SELECTION MODE`, `BUILD MOUNTAINS`, `INSERT RUNWAY` - where the artwork has
 * drawn one.
 *
 * `drops` marks a tool that places at a click rather than by dragging: the
 * point clicked is the placement's `at`. `derived` holds the values the tool's
 * own gesture settles, which its panel leaves off rather than showing and
 * ignoring - a mountain dropped at a click is one mountain, so its count is
 * the click's and not the pilot's to set to twelve and wonder why they got one.
 *
 * `cover` marks the cover tool: one tool, declared once for each of the four
 * ground covers it is pointed at, that lays its element by dragging the
 * `COVER_BRUSH` stamp along the ground. `starts` is what its panel starts at
 * on a canvas before the pilot has moved it - a cover's density is the
 * element's 1, which every preset draws with, and the tool's own figure is
 * the walkthroughs': clumps of grass and sand at a half, and water and snow
 * whole, so a line of either is not drawn with gaps.
 *
 * `modes` is what each of a tool's sections does, as a mode type - see
 * `js/mode-types.js`. Insert Runway's is `Insert asset<runway>`: it places a
 * template, chosen on its panel as a card, at a click - a whole strip or
 * airport rather than one element - see `js/templates.js`. Insert City and
 * Insert Plane insert, and the SAVE / LOAD bar loads and saves.
 *
 * `bar` marks the SAVE / LOAD bar: drawn across both of the palette's columns
 * at its foot, under the way out, as text in the art's colours rather than as
 * a mark - the art draws its words in a font the page does not load.
 *
 * `extrudes` marks Extrude, the one tool whose draft is not finished by a
 * single gesture: shapes are drawn into a region, which is then lifted - see
 * `js/extrude.js`.
 *
 * `paint` marks Free Paint, the other tool that draws by dragging: it lays
 * `paint` with the `PAINT_BRUSH` rather than a cover with the cover tool's
 * stamp. `erase` marks Erase, which drags the same brush and lays nothing: its
 * strokes are an erase batch, cut out of what was laid before them when the
 * ground is built - see `js/environment/erase.js` - so its `element` is the
 * batch's type rather than one of the registry's. The three are the stroke
 * tools, and share every gesture.
 */
export const BUILD_TOOLS = Object.freeze([
    { id: SELECT_TOOL, label: 'SELECT',          hint: 'Look around the canvas',                      mindsLasso: false, heading: 'SELECTION MODE' },
    { id: 'lasso',     label: 'LASSO',           hint: 'Draw a region the tools below are clipped to', mindsLasso: false },
    { id: 'mountain',  label: 'MOUNTAIN',        hint: 'Drop a mountain at a click',                  mindsLasso: true,  element: 'mountain', heading: 'BUILD MOUNTAINS', drops: true, derived: Object.freeze({ count: 1 }) },
    { id: 'grass',     label: 'GRASS',           hint: 'Lay grass by dragging',                       mindsLasso: true,  element: 'grass', heading: 'BUILD GRASS', cover: true, starts: Object.freeze({ density: 0.5 }) },
    { id: 'sand',      label: 'SAND',            hint: 'Lay sand by dragging',                        mindsLasso: true,  element: 'sand', heading: 'BUILD SAND', cover: true, starts: Object.freeze({ density: 0.5 }) },
    { id: 'water',     label: 'WATER',           hint: 'Lay water by dragging',                       mindsLasso: true,  element: 'water', heading: 'BUILD WATER', cover: true, starts: Object.freeze({ density: 1 }) },
    { id: 'snow',      label: 'SNOW',            hint: 'Lay snow by dragging',                        mindsLasso: true,  element: 'snow', heading: 'BUILD SNOW', cover: true, starts: Object.freeze({ density: 1 }) },
    { id: 'runway',    label: 'RUNWAY',          hint: 'Place a runway or an airport',                mindsLasso: false, element: 'runway', heading: 'INSERT RUNWAY', modes: Object.freeze([mode('insert', 'asset', 'runway')]) },
    { id: 'paint',     label: 'FREE PAINT',      hint: 'Brush a colour onto the ground',              mindsLasso: true,  element: 'paint', heading: 'FREE PAINT', paint: true },
    { id: 'erase',     label: 'ERASE',           hint: 'Take an element away through a stroke',       mindsLasso: true,  element: ERASE_TYPE, heading: 'ERASE', erase: true },
    { id: 'extrude',   label: 'EXTRUDE',         hint: 'Draw a shape and pull it up',                 mindsLasso: true,  element: 'extrude', heading: 'EXTRUDE SHAPE', extrudes: true },
    { id: CITY_TOOL,   label: 'INSERT CITY',     hint: 'Place buildings, roads and parks',            mindsLasso: false, heading: 'INSERT CITY', modes: Object.freeze([mode('insert', 'asset', 'city')]) },
    { id: PLANE_TOOL,  label: 'INSERT PLANE',    hint: 'Choose the plane, and where a flight starts', mindsLasso: false, heading: 'INSERT PLANE', modes: Object.freeze([mode('insert', 'asset', 'flight:plane'), mode('insert', 'config', 'flight:start-point')]) },
    { id: ACCEPT_TOOL, label: 'ACCEPT AND EXIT', hint: 'Leave the builder (Esc)',                     mindsLasso: false },
    { id: FILES_TOOL,  label: 'SAVE / LOAD',     hint: 'Save this world to a file, or load one',      mindsLasso: false, heading: 'SAVE / LOAD', bar: true, modes: Object.freeze([mode('save', 'data', 'file'), mode('load', 'data', 'file'), mode('load', 'data', 'asset')]) }
].map(tool => Object.freeze(tool)));

/**
 * Where the builder's art is served from: tracked in the repository, beside
 * `js/`, at the same relative address on the site and under `npm run serve`.
 * Nothing the page or the code draws is read from anywhere else.
 */
export const BUILDER_ART = 'assets/builder';

/**
 * The mark a tool's tile carries: the artwork's own, copied into the
 * repository under the tool's id. Every tile has one, built or not, so a tool
 * joining the palette brings no art with it. Null for a name that is no tool,
 * and for the SAVE / LOAD bar, which is its words.
 */
export function toolMark(id) {
    return isBuildTool(id) && !isPaletteBar(id) ? `${BUILDER_ART}/${id}.svg` : null;
}

/** True for the bar drawn across the palette's foot rather than as a tile. */
export function isPaletteBar(id) {
    return buildTool(id)?.bar === true;
}

/** What each of a tool's sections does, as mode types, in the order its panel draws them. */
export function toolModes(id) {
    return buildTool(id)?.modes ?? [];
}

/** True for a tool one of whose sections is the verb, the kind and, where one is asked, the subject given. */
export function toolDoes(id, verb, kind, subject = null) {
    return toolModes(id).some(type => modeIs(type, verb, kind, subject));
}

/**
 * A tool's name as a tile says it to a pointer resting on it and to a screen
 * reader - its label in the case the rest of the page's sentences are in.
 */
export function toolName(id) {
    const label = buildTool(id)?.label ?? '';
    return label.charAt(0) + label.slice(1).toLowerCase();
}

/** True for a tool drawn only inside a live selection, which is the tour's lasso column. */
export function mindsLasso(id) {
    return BUILD_TOOLS.find(tool => tool.id === id)?.mindsLasso === true;
}

export const BUILD_TOOL_IDS = Object.freeze(BUILD_TOOLS.map(tool => tool.id));

/**
 * The tools that work today. A tool is added here in the commit that makes it
 * work, and not before, so the palette never offers one that does nothing.
 *
 * Grass, sand, water and snow are the cover tool, each drawn where its stroke
 * went: a cover's band, drawn water's line and drawn snow's line are all
 * worked out from the ground under the stroke rather than held at a height a
 * stroke would usually miss. Insert Runway places the templates whose every
 * element the registry draws - the two runways today, and the airports once
 * the airports, laid out from strips, paint and extrusions. Free Paint lays a
 * colour and no height, through the same stroke as the covers, and Erase takes
 * elements away through it. Extrude lifts a region drawn from its shapes, or
 * the selection, in stages - see `js/extrude.js`.
 */
export const BUILT_TOOLS = Object.freeze([SELECT_TOOL, 'lasso', 'mountain', 'grass', 'sand', 'water', 'snow', 'runway', 'paint', 'erase', 'extrude', CITY_TOOL, PLANE_TOOL, ACCEPT_TOOL, FILES_TOOL]);

/** True for one of the builder's tools. */
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
 * The tiles the palette draws: the built tools, in the art's order. The accept
 * tool is the last tile, at the foot of the column, wherever the tools between
 * are added; the SAVE / LOAD bar, once built, comes after it, across the foot.
 */
export function paletteTools(built = BUILT_TOOLS) {
    return BUILD_TOOLS.filter(tool => built.includes(tool.id));
}

/** The tool that places an element, or null for an element no tool places yet. */
export function toolForElement(type) {
    return BUILD_TOOLS.find(tool => tool.element != null && tool.element === type) ?? null;
}

/** One of the twelve by its id, or null. */
export function buildTool(id) {
    return BUILD_TOOLS.find(tool => tool.id === id) ?? null;
}

/** True for a tool that places what it builds at a click on the ground. */
export function dropsAtClick(id) {
    return buildTool(id)?.drops === true;
}

/**
 * The cover tool's brush: the stamp a stroke is swept with, as its panel's
 * first rows after `DENSITY`. Measured in screen pixels while it is drawn, and
 * written to the stroke in world units once it is laid, at the scale the
 * ground was under the press - so a stamp is the size on the glass the pilot
 * set it to however far off the view stands, and a stroke laid does not change
 * size when the camera moves afterwards.
 *
 * Named for the artwork's rows. `BUILD HEIGHT` is not an altitude - a cover
 * has none - but the stamp's reach along the stroke, so it is written to the
 * stamp's `depth`, the name the footprint already gives that axis; see
 * `COVER_STAMP`.
 */
export const COVER_BRUSH = Object.freeze({
    buildHeight:  Object.freeze(scalar(10, 400, 40)),
    buildWidth:   Object.freeze(scalar(10, 400, 60)),
    cornerRadius: Object.freeze(scalar(0, 200, 10))
});

/** Which of the stamp's three a brush row writes. */
export const COVER_STAMP = Object.freeze({ buildHeight: 'depth', buildWidth: 'width', cornerRadius: 'corner' });

/**
 * The element's ranges the cover tool's panel carries - the same two for every
 * cover it is pointed at - and so the whole of what a batch's configuration
 * holds. The rest stay at what the element declares: a cover's band is settled
 * by the stroke, and water's level and flatten and snow's line, coverage and
 * slope are not the pilot's here.
 */
export const COVER_ELEMENT_ROWS = Object.freeze(['density', 'color']);

/** True for Insert Runway, which places a template chosen on its panel. */
export function insertsTemplate(id) {
    return toolDoes(id, 'insert', 'asset', 'runway');
}

/** True for the tool a chosen card of the catalogue is placed with - `Insert asset<city>`. */
export function insertsCity(id) {
    return toolDoes(id, 'insert', 'asset', 'city');
}

/** True for the tool a click on the canvas places the start point with - `Insert config<flight:start-point>`. */
export function placesStartPoint(id) {
    return toolDoes(id, 'insert', 'config', 'flight:start-point');
}

/** True for the tool a plane is chosen with - `Insert asset<flight:plane>`. */
export function choosesPlane(id) {
    return toolDoes(id, 'insert', 'asset', 'flight:plane');
}

/** True for the cover tool, pointed at whichever ground cover it lays. */
export function isCoverTool(id) {
    return buildTool(id)?.cover === true;
}

/**
 * The stamp a cover stroke is laid with, in world units: the brush's pixels at
 * `unitsPerPixel`, the ground's scale under the press, to the whole unit and
 * never less than one. The corner is held to half the shorter side, past which
 * a rounded rectangle has no straight edge left to round.
 */
export function coverStamp(brush = {}, unitsPerPixel = 1) {
    const scale = Number(unitsPerPixel) > 0 ? Number(unitsPerPixel) : 1;
    const stamp = {};
    for (const [row, field] of Object.entries(COVER_STAMP)) {
        const pixels = Number(brush?.[row] ?? COVER_BRUSH[row].default);
        stamp[field] = Math.max(Math.round((Number.isFinite(pixels) ? pixels : COVER_BRUSH[row].default) * scale), field === 'corner' ? 0 : 1);
    }
    stamp.corner = Math.min(stamp.corner, Math.min(stamp.width, stamp.depth) / 2);
    return stamp;
}

/**
 * Free Paint's brush, as the artwork's two groups have it: `TIP` and `EDGE`
 * under `BRUSH SELECTION`, and `SIZE` under `BRUSH PROPERTIES`, beside the
 * element's opacity. Two axes rather than a list of named brushes - the
 * walkthrough's "Hard Round" is `tip: round` with `edge: hard` - so the names
 * are what the axes come to and there are no presets to keep in step with them.
 *
 * `SIZE` is in screen pixels, and laid in world units at the scale under the
 * press, as the cover tool's stamp is. The defaults are the walkthrough's: a
 * hard round brush 25 pixels across, which is the brush `DEFAULT` puts back.
 */
export const PAINT_BRUSH = Object.freeze({
    tip:  Object.freeze(choice(['round', 'square'], 'round')),
    edge: Object.freeze(choice(['hard', 'soft'], 'hard')),
    size: Object.freeze(scalar(5, 400, 25, { slider: true }))
});

/**
 * How far in from its edge a soft brush eases, as a share of its width: a
 * quarter, so a soft stroke is whole across its inner half and fades across
 * the quarter at either side.
 *
 * Read off the hold rather than written as a figure of its own, because the
 * hold is what it is bounded by. A swept stamp's deepest point is half its
 * width in, and `feather` keeps a band to `FEATHER_SHARE` of that - so a
 * quarter of the width is the widest soft edge there is, and every larger
 * share asked for came to the same quarter. It was 0.5 for that reason: the
 * feather asked for was double what was used at every size, and three
 * sentences described the half that never reached the ground.
 */
export const SOFT_EDGE = FEATHER_SHARE / 2;

/**
 * The element's ranges Free Paint's panel carries: the colour under `COLOR
 * SELECTION`, and its opacity and blend under `BRUSH PROPERTIES`. They are
 * the batch's, as a cover's density and colour are.
 */
export const PAINT_ELEMENT_ROWS = Object.freeze(['color', 'opacity', 'blend']);

/** True for Free Paint. */
export function isPaintTool(id) {
    return buildTool(id)?.paint === true;
}

/** True for Extrude. */
export function isExtrudeTool(id) {
    return buildTool(id)?.extrudes === true;
}

/** True for Erase. */
export function isEraseTool(id) {
    return buildTool(id)?.erase === true;
}

/** True for a tool that lays what it lays by dragging a stroke: the cover tool, Free Paint and Erase. */
export function isStrokeTool(id) {
    return isCoverTool(id) || isPaintTool(id) || isEraseTool(id);
}

/** An erase batch's own ranges Erase's panel carries: what it takes, and how much of it. */
export const ERASE_ELEMENT_ROWS = Object.freeze(['target', 'strength']);

/** The element's ranges a stroke tool's panel carries - an erase batch's, for Erase - or none for a tool that is not one. */
export function toolElementRows(tool) {
    if (tool?.cover === true) return COVER_ELEMENT_ROWS;
    if (tool?.paint === true) return PAINT_ELEMENT_ROWS;
    if (tool?.erase === true) return ERASE_ELEMENT_ROWS;
    return [];
}

/**
 * The ranges a tool's placement is configured through: its element's, or an
 * erase batch's for Erase, which places no element. Null for a tool that
 * places nothing.
 */
export function toolRanges(tool) {
    return tool?.element != null ? placementRanges(tool.element) : null;
}

/** A tool's brush as it starts, which is the brush Free Paint's `DEFAULT` puts back. */
export function defaultBrush(tool) {
    return Object.fromEntries(Object.entries(toolBrush(tool)).map(([name, range]) => [name, range.default]));
}

/**
 * The stamp a paint stroke is laid with, in world units: `SIZE` across and
 * along at `unitsPerPixel`, the ground's scale under the press, to the whole
 * unit and never less than one; a round tip with its corners at half that, so
 * the stroke is a swept disc, and a square one with none.
 *
 * `HARD` is the feather every footprint carries unless it is told otherwise -
 * the sampling's two cells, which is the hardest edge the ground can draw: one
 * inside a cell is a staircase of whole vertices, the cliff the feather exists
 * to keep off. `SOFT` eases across `SOFT_EDGE` of the stamp's width at either
 * side, which is a quarter and is as wide a band as the hold allows.
 *
 * A soft edge is asked for as a figure the hold leaves alone, rather than as
 * one it cuts down: `width * SOFT_EDGE` is exactly `FEATHER_SHARE` of the
 * stamp's reach. A hard edge asks for the sampling's two cells, which the hold
 * does sharpen on a narrow stamp, since the hardest edge the ground can draw
 * is still a band the region has room for. The two therefore come to the same
 * feather at 640 units and under - eight of the ground's cells - where there
 * is no room between the sampling and the hold for the axis to say anything.
 */
export function paintStamp(brush = {}, unitsPerPixel = 1) {
    const scale  = Number(unitsPerPixel) > 0 ? Number(unitsPerPixel) : 1;
    const pixels = Number(brush?.size ?? PAINT_BRUSH.size.default);
    const width  = Math.max(Math.round((Number.isFinite(pixels) ? pixels : PAINT_BRUSH.size.default) * scale), 1);
    return {
        width,
        depth: width,
        corner: brush?.tip === 'square' ? 0 : width / 2,
        feather: brush?.edge === 'soft' ? width * SOFT_EDGE : DEFAULT_FEATHER
    };
}

/** The stamp a stroke tool lays a stroke with, at the scale under the press, or null for a tool that draws no strokes. Erase's brush is the paint brush. */
export function strokeStamp(tool, brush = {}, unitsPerPixel = 1) {
    if (tool?.cover === true) return coverStamp(brush, unitsPerPixel);
    if (tool?.paint === true || tool?.erase === true) return paintStamp(brush, unitsPerPixel);
    return null;
}

/**
 * The values a tool's gesture settles for it, which its panel does not show.
 * Empty for a tool whose panel shows every range its element declares.
 */
export function derivedValues(tool) {
    return { ...(tool?.derived ?? {}) };
}

/**
 * The placement a tool makes from what its panel is holding.
 *
 * The one place a panel's values become a build argument. The panel collects,
 * this splits, and the generator the registry already has draws - so a tool
 * that renders no panel of its own also builds down no path of its own, and an
 * edit that fails to register fails in one place for every tool.
 *
 * A tool with a brush - the cover tool's stamp, or Free Paint's - holds the
 * brush's rows among its values, and they are left off: they say how the
 * pointer draws, in pixels, and the gesture has already turned them into
 * `drawn`, the footprint, in world units. Everything else is the element's
 * configuration.
 */
export function toolPlacement(tool, values = {}, drawn = null) {
    const brush  = toolBrush(tool);
    const config = {};

    for (const [name, value] of Object.entries(values ?? {})) {
        if (!(name in brush)) config[name] = value;
    }

    const placement = { type: tool?.element, config };
    if (drawn != null) placement.footprint = drawn;
    return placement;
}

/** The ranges a tool's pointer draws with, which are its own rather than its element's: the cover tool's stamp, the paint brush - Free Paint's and Erase's - or none. */
export function toolBrush(tool) {
    if (tool?.cover === true) return COVER_BRUSH;
    if (tool?.paint === true || tool?.erase === true) return PAINT_BRUSH;
    return {};
}

/**
 * The placement a tool that drops at a click makes there: its panel's values,
 * then the values its gesture settles, then the point itself as `at` - in the
 * canvas's frame, rounded to a whole unit, so the same click is the same
 * placement written down.
 *
 * Null for a point that is not on the ground, which is a click over the sky or
 * off the canvas, and for a tool that does not drop.
 */
export function droppedPlacement(tool, values = {}, point = null) {
    if (tool?.drops !== true || !Number.isFinite(point?.x) || !Number.isFinite(point?.z)) return null;
    return toolPlacement(tool, {
        ...(values ?? {}),
        ...derivedValues(tool),
        // `|| 0` so a click a hair west of the middle is written 0, not -0.
        at: [Math.round(point.x) || 0, Math.round(point.z) || 0]
    });
}
