import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
    PREFABS, RIBBON_STEP, RIBBON_POINT_LIMIT, CONNECTOR_LIMIT, CONNECTOR_FIELDS, ROAD_WIDTH,
    prefabById, ribbonLine, recipeGeometry, recipeBounds, readRecipe
} from '../js/prefabs.js';
import { placeObject, standingObjects, drapedGeometry, objectFootprint, insideObject, DRAPE_LIFT, obstacleTop } from '../js/objects.js';
import {
    SNAP_DISTANCE, JOIN_DISTANCE, isRoad, roadConnectors, joined, openConnectors, snapRoad, headingGap, wrapHeading
} from '../js/roads.js';
import { bearingToDirection } from '../js/units.js';
import {
    createBuildState, openBuildMode, beginCanvas, chooseBuildTool, acceptDraft, buildDraft, draftPending, setAutoAccept, drawAgain,
    chooseCityPrefab, buildCityPrefab, openCitySection, buildCitySection, cityPlacement, insertObject, committedPlacements
} from '../js/build-mode.js';
import { dockContent, DOCK_CITY, citySection } from '../js/build-panel.js';
import { CITY_TOOL, insertsCity, buildTool } from '../js/build-tools.js';
import { modeType } from '../js/mode-types.js';
import { buildHelpLines } from '../js/controls-help.js';

const source = name => readFileSync(fileURLToPath(new URL(`../js/${name}`, import.meta.url)), 'utf8');
const schema = JSON.parse(readFileSync(new URL('../schemas/environment.schema.json', import.meta.url), 'utf8'));
const near = (a, b, within = 1e-6) => Math.abs(a - b) <= within;

function methodBody(text, name) {
    const match = new RegExp(`^\\s+(?:async\\s+)?${name}\\((?:[^()]|\\([^()]*\\))*\\)\\s*\\{`, 'm').exec(text);
    if (!match) return null;
    const from = match.index + match[0].length - 1;
    let depth = 0;
    for (let at = from; at < text.length; at += 1) {
        if (text[at] === '{') depth += 1;
        if (text[at] === '}') {
            depth -= 1;
            if (depth === 0) return text.slice(from, at + 1);
        }
    }
    return null;
}

// --- The ribbon ---------------------------------------------------------------------------

test('a ribbon\'s line is cut every ten metres or less, and a closed one comes back round to its start', () => {
    const line = ribbonLine([[0, 0], [0, 25], [30, 25]]);
    assert.deepEqual(line[0], [0, 0]);
    assert.deepEqual(line.at(-1), [30, 25]);
    for (let i = 1; i < line.length; i++) {
        assert.ok(Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]) <= RIBBON_STEP + 1e-9, 'no piece longer than a step');
    }
    assert.equal(line.length, 3 + 1 + 3, 'twenty-five metres in three, thirty in three');
    const ring = ribbonLine([[0, 0], [20, 0], [20, 20], [0, 20]], true);
    assert.equal(ring.length, 8, 'round and back, its start not written twice');
    assert.equal(RIBBON_STEP, 10);
});

test('a ribbon is a flat strip its width across, facing up, lying where its line runs', () => {
    const part = { shape: 'ribbon', points: [[0, -20], [0, 20]], width: 12, at: [0, 0, 0], color: 0x45494d };
    const shape = recipeGeometry({ parts: [part] });
    assert.equal(shape.count / 3, 2 * 4, 'two triangles to each of its four pieces');
    for (let i = 0; i < shape.count; i++) {
        assert.equal(shape.positions[i * 3 + 1], 0, 'flat');
        assert.ok(near(shape.normals[i * 3 + 1], 1), 'facing up');
    }
    assert.deepEqual(recipeBounds({ parts: [part] }), { minX: -6, maxX: 6, minZ: -20, maxZ: 20, top: 0 });
    const lifted = recipeBounds({ parts: [{ ...part, at: [0, 0.03, 0], width: 0.3 }] });
    assert.ok(near(lifted.top, 0.03) && near(lifted.maxX, 0.15), 'a dash a hair over the road, as narrow as it says');
    const ring = recipeGeometry({ parts: [{ ...part, points: [[0, 0], [20, 0], [20, 20], [0, 20]], width: 4, closed: true }] });
    for (let i = 0; i < ring.count; i++) assert.ok(near(ring.normals[i * 3 + 1], 1), 'a closed ring faces up all round');
});

test('a road\'s recipe is read whole or refused: its ribbons, its drape and its connectors', () => {
    const good = prefabById('road-t-junction').recipe;
    assert.deepEqual(readRecipe(good).problems, []);
    const problems = (extra, part = {}) => readRecipe({ ...good, parts: [{ ...good.parts[0], ...part }], ...extra }, 'r').problems;
    assert.deepEqual(problems({}, { points: [[0, 0]] }), [`r.parts[0]: points is not a line of 2 to ${RIBBON_POINT_LIMIT} points`]);
    assert.deepEqual(problems({}, { points: [[0, 0], [0, 'far']] }), [`r.parts[0]: points is not a line of 2 to ${RIBBON_POINT_LIMIT} points`]);
    assert.deepEqual(problems({}, { width: 0 }), ['r.parts[0]: width is not a length']);
    assert.deepEqual(problems({}, { closed: 'yes' }), ['r.parts[0]: closed is not true or false']);
    assert.deepEqual(problems({ drape: 1 }), ['r: drape is not true or false']);
    assert.deepEqual(problems({ connectors: 'ends' }), [`r: connectors is not a list of up to ${CONNECTOR_LIMIT}`]);
    assert.deepEqual(problems({ connectors: Array(CONNECTOR_LIMIT + 1).fill({ at: [0, 0], heading: 0 }) }), [`r: connectors is not a list of up to ${CONNECTOR_LIMIT}`]);
    assert.deepEqual(problems({ connectors: [{ at: [0], heading: 0 }] }), ['r.connectors[0]: at is not a point']);
    assert.deepEqual(problems({ connectors: [{ at: [0, 0], heading: 'north' }] }), ['r.connectors[0]: heading is not a number']);
    assert.deepEqual(problems({ connectors: [{ at: [0, 0], heading: 0, lanes: 2 }] }), ['r.connectors[0]: lanes is not a field a connector has']);
    assert.deepEqual(problems({ connectors: [7] }), ['r.connectors[0]: not a connector']);
    assert.deepEqual(CONNECTOR_FIELDS, Object.keys(schema.$defs.recipe.properties.connectors.items.properties));
    assert.equal(schema.$defs.recipe.properties.connectors.maxItems, CONNECTOR_LIMIT);
});

// --- The pieces -----------------------------------------------------------------------------

test('every piece joins at its open ends: a straight at two, a T at three, a crossroads and a roundabout at four, a dead end at one', () => {
    const ends = id => prefabById(id).recipe.connectors.length;
    assert.deepEqual(['road-straight', 'road-curve', 'road-t-junction', 'road-crossroads', 'road-roundabout', 'road-dead-end'].map(ends), [2, 2, 3, 4, 4, 1]);
    assert.equal(ROAD_WIDTH, 12);
});

test('every connector is at an end of the carriageway, leading out of the piece', () => {
    for (const prefab of PREFABS.filter(each => each.kind === 'road')) {
        const placed = placeObject(prefab.id, [0, 0]);
        const [standing] = standingObjects([placed]);
        for (const connector of roadConnectors(placed)) {
            const out = bearingToDirection(connector.heading);
            assert.equal(insideObject(standing, connector.x - out.x * 1, connector.z - out.z * 1), true, `${prefab.id}: just inside the piece behind its end`);
            assert.equal(insideObject(standing, connector.x + out.x * 1, connector.z + out.z * 1), false, `${prefab.id}: and nothing of it ahead`);
            const across = { x: -out.z, z: out.x };
            assert.equal(insideObject(standing, connector.x - out.x + across.x * (ROAD_WIDTH / 2 - 0.5), connector.z - out.z + across.z * (ROAD_WIDTH / 2 - 0.5)), true,
                `${prefab.id}: a carriageway's width across it`);
        }
    }
});

test('a road is laid over the ground: no plinth, flown over, every corner on the ground under it', () => {
    const placed = placeObject('road-straight', [100, 50], { heading: 30 });
    assert.equal(isRoad(placed), true);
    assert.equal(isRoad(placeObject('cottage', [0, 0])), false);
    const slope = (x, z) => x * 0.2 - z * 0.1;
    const standing = standingObjects([placed, placeObject('cottage', [500, 0])], { groundAt: slope });
    assert.equal(standing[0].drape, true);
    assert.equal(standing[1].drape, false);
    assert.equal(obstacleTop(standing, 100, 50), null, 'flown over');

    const laid = drapedGeometry(standing, slope);
    const flat = recipeGeometry(placed.recipe);
    assert.equal(laid.count, flat.count, 'only the road, every corner of it');
    for (let i = 0; i < laid.count; i++) {
        const [x, y, z] = [laid.positions[i * 3], laid.positions[i * 3 + 1], laid.positions[i * 3 + 2]];
        assert.ok(near(y, slope(x, z) + DRAPE_LIFT + flat.positions[i * 3 + 1], 1e-3), 'on the ground under it, its own height on top');
        assert.ok(laid.normals[i * 3 + 1] > 0.9, 'and facing up off a gentle slope');
    }
    // Every corner inside its footprint, turned to its heading as the footprint is.
    const footprint = objectFootprint(placed);
    for (let i = 0; i < laid.count; i++) {
        const dx = laid.positions[i * 3] - footprint.x, dz = laid.positions[i * 3 + 2] - footprint.z;
        const u = dx * Math.cos(-footprint.angle) - dz * Math.sin(-footprint.angle);
        const v = dx * Math.sin(-footprint.angle) + dz * Math.cos(-footprint.angle);
        assert.ok(Math.abs(u) <= footprint.width / 2 + 1e-3 && Math.abs(v) <= footprint.depth / 2 + 1e-3, 'laid where its footprint is, the way it faces');
    }
    assert.equal(drapedGeometry([], slope).count, 0);
});

// --- Joining ---------------------------------------------------------------------------------

test('a connector is where its piece puts it, turned and scaled with it, and two meeting face to face are joined', () => {
    const placed = placeObject('road-straight', [100, 50], { heading: 90, scale: 1.5 });
    const [ahead, behind] = roadConnectors(placed);
    const way = bearingToDirection(90);
    assert.ok(near(ahead.x, 100 + way.x * 30) && near(ahead.z, 50 + way.z * 30), 'twenty metres out, half again');
    assert.equal(ahead.heading, 90);
    assert.equal(behind.heading, 270);
    assert.deepEqual(roadConnectors(placeObject('cottage', [0, 0])), []);

    assert.equal(joined({ x: 0, z: 0, heading: 0 }, { x: 0.5, z: 0, heading: 182 }), true);
    assert.equal(joined({ x: 0, z: 0, heading: 0 }, { x: JOIN_DISTANCE + 0.1, z: 0, heading: 180 }), false, 'too far apart');
    assert.equal(joined({ x: 0, z: 0, heading: 0 }, { x: 0, z: 0, heading: 90 }), false, 'not facing each other');
    assert.equal(headingGap(350, 10), 20);
    assert.equal(wrapHeading(-90), 270);
});

test('an end another road meets is not open', () => {
    const first = placeObject('road-straight', [0, 0]);
    assert.equal(openConnectors([first]).length, 2);
    const second = snapRoad(placeObject('road-straight', [0, 45]), [first]).placement;
    const open = openConnectors([first, second]);
    assert.equal(open.length, 2, 'the two ends that meet are closed');
    assert.deepEqual(open.map(connector => Math.round(connector.z)).sort((a, b) => a - b), [-20, 60], 'and the far ends are what is left');
    assert.deepEqual(open.map(connector => connector.placement).sort(), [0, 1]);
    assert.deepEqual(openConnectors([placeObject('cottage', [0, 0])]), []);
});

test('a piece snaps to the nearest open end within reach, end to end, and not otherwise', () => {
    const straight = placeObject('road-straight', [0, 0]);
    const curve = placeObject('road-curve', [-10, 32], { heading: 10 });
    const snap = snapRoad(curve, [straight]);
    assert.ok(snap, 'within reach');
    const joinedUp = roadConnectors(snap.placement)[snap.from];
    assert.ok(joined(joinedUp, snap.to), 'its end meets the open one, facing it');
    assert.ok(near(snap.to.x, 0) && near(snap.to.z, 20));
    assert.deepEqual(curve.config, { at: [-10, 32], heading: 10, scale: 1 }, 'the piece handed over is untouched');

    assert.equal(snapRoad(placeObject('road-curve', [200, 200]), [straight]), null, 'nothing in reach');
    assert.equal(SNAP_DISTANCE, 30);
    assert.equal(snapRoad(placeObject('cottage', [0, 25]), [straight]), null, 'a house does not snap');

    const second = snapRoad(placeObject('road-straight', [0, 45]), [straight]).placement;
    const third = snapRoad(placeObject('road-straight', [0, 28]), [straight, second]);
    assert.ok(third == null || Math.abs(third.to.z) > 30, 'never to an end already met');
});

test('pieces snapped one to the next make a road that closes: four curves are a loop', () => {
    const local = prefabById('road-curve').recipe.connectors;
    let placed = [placeObject('road-curve', [0, 0])];
    for (let i = 0; i < 3; i++) {
        const [open] = openConnectors(placed).filter(connector => connector.placement === placed.length - 1 && connector.index === 1);
        // Where its first end would meet that one exactly, then dropped a few
        // metres off it: the snap puts it back.
        const heading = wrapHeading(open.heading + 180 - local[0].heading);
        const angle = heading * Math.PI / 180;
        const [lx, lz] = local[0].at;
        const exact = [open.x - (lx * Math.cos(angle) - lz * Math.sin(angle)), open.z - (lx * Math.sin(angle) + lz * Math.cos(angle))];
        const next = snapRoad(placeObject('road-curve', [exact[0] + 2, exact[1] - 3], { heading }), placed);
        assert.ok(near(next.placement.config.at[0], exact[0], 1e-3) && near(next.placement.config.at[1], exact[1], 1e-3), `piece ${i + 2} put back`);
        placed = [...placed, next.placement];
    }
    assert.equal(openConnectors(placed).length, 0, 'every end met');
});

// --- Insert City ------------------------------------------------------------------------------

/** A builder open on a canvas, with Insert City live. */
function cityCanvas() {
    const state = createBuildState();
    openBuildMode(state);
    beginCanvas(state, 'blank-canvas', [], []);
    assert.equal(chooseBuildTool(state, CITY_TOOL), true);
    return state;
}

test('Insert City is `Insert asset<city>`, and a tool a canvas is worked with', () => {
    assert.equal(insertsCity(CITY_TOOL), true);
    assert.equal(insertsCity('runway'), false);
    assert.deepEqual(buildTool(CITY_TOOL).modes.map(modeType), ['Insert asset<city>']);
});

test('its panel is a folding section for each category, one open at a time, each a grid of the category\'s cards', () => {
    const state = cityCanvas();
    let shown = dockContent(state, {});
    assert.equal(shown.kind, DOCK_CITY);
    assert.equal(shown.heading, 'INSERT CITY');
    assert.deepEqual(shown.sections.map(section => section.heading), ['SKYLINES', 'FACTORY', 'RESIDENTIAL', 'COMMERCIAL', 'INFRASTRUCTURE', 'PARKS']);
    assert.ok(shown.sections.every(section => section.folds && section.kind === DOCK_CITY));
    assert.deepEqual(shown.sections.filter(section => section.open).map(section => section.id), [citySection('skylines')], 'the first open to begin with');
    assert.ok(shown.sections.filter(section => !section.open).every(section => section.shapes.length === 0), 'and no cards drawn under the shut ones');

    assert.equal(openCitySection(state, 'infrastructure'), true);
    shown = dockContent(state, {});
    assert.deepEqual(shown.sections.filter(section => section.open).map(section => section.category), ['infrastructure'], 'opening one shuts the other');
    const rows = shown.sections.find(section => section.open).shapes;
    assert.deepEqual(rows.map(row => row.row), ['infrastructure', 'roads'], 'the buildings first, then the roads');
    assert.deepEqual(rows[0].tools.map(card => card.label), ['POWER STATION', 'WATER TOWER', 'SUBSTATION', 'FIRE STATION', 'HOSPITAL'], 'and no road among the buildings');
    assert.deepEqual(rows[1].tools.map(card => card.label), ['STRAIGHT', 'CURVE', 'T-JUNCTION', 'CROSSROADS', 'ROUNDABOUT', 'DEAD END']);
    assert.ok(rows.flatMap(row => row.tools).every(card => card.art === null && !card.live), 'named cards, none armed');

    assert.equal(openCitySection(state, 'infrastructure'), true);
    assert.equal(buildCitySection(state), null, 'pressed again, it shuts');
    assert.equal(openCitySection(state, 'monuments'), false);
});

test('a card arms it, and a click places that card as the edit in hand - a second click moving it', () => {
    const state = cityCanvas();
    assert.equal(insertObject(state, { x: 0, z: 0 }), false, 'nothing armed, nothing placed');
    assert.equal(chooseCityPrefab(state, 'cathedral'), false);
    assert.equal(chooseCityPrefab(state, 'hotel'), true);
    assert.equal(buildCityPrefab(state), 'hotel');
    assert.equal(dockContent(state, {}).sections.flatMap(section => section.shapes.flatMap(row => row.tools)).filter(card => card.live).length, 0,
        'the hotel\'s card pressed where its section is open');
    openCitySection(state, 'commercial');
    assert.deepEqual(dockContent(state, {}).sections.flatMap(section => section.shapes.flatMap(row => row.tools)).filter(card => card.live).map(card => card.id), ['hotel']);

    assert.equal(insertObject(state, { x: 100, z: 200 }, 40), true);
    assert.equal(draftPending(state), true);
    assert.deepEqual(buildDraft(state).config, { at: [100, 200], heading: 40, scale: 1 });
    const shown = dockContent(state, {});
    assert.deepEqual(shown.rows.map(row => row.row.label), ['HEADING', 'SCALE'], 'its own rows lead the panel');
    assert.deepEqual(shown.actions.map(action => action.id), ['accept', 'cancel']);

    assert.equal(insertObject(state, { x: 300, z: 400 }, 0), true);
    assert.deepEqual(buildDraft(state).config, { at: [300, 400], heading: 40, scale: 1 }, 'moved, still facing the way it was turned');
    assert.equal(chooseCityPrefab(state, 'office-block'), true);
    assert.equal(buildDraft(state).prefab, 'office-block', 'another card is the piece in hand, where it stood');
    assert.deepEqual(buildDraft(state).config.at, [300, 400]);

    acceptDraft(state);
    assert.equal(committedPlacements(state).length, 1);
});

test('a road placed near an open end snaps to it, and with shift is placed where it is', () => {
    const state = cityCanvas();
    chooseCityPrefab(state, 'road-straight');
    insertObject(state, { x: 0, z: 0 }, 0);
    acceptDraft(state);

    const preview = cityPlacement(state, { x: 4, z: 46 }, 0);
    assert.equal(preview.snapped, true);
    assert.deepEqual(preview.placement.config.at, [0, 40]);
    assert.equal(cityPlacement(state, { x: 4, z: 46 }, 0, { free: true }).snapped, false, 'shift: free');
    assert.deepEqual(cityPlacement(state, { x: 4, z: 46 }, 0, { free: true }).placement.config.at, [4, 46]);
    assert.equal(cityPlacement(state, { x: 400, z: 400 }, 0).snapped, false, 'out of reach: free');

    insertObject(state, { x: 4, z: 46 }, 0);
    assert.deepEqual(buildDraft(state).config.at, [0, 40], 'the click places it snapped');
    insertObject(state, { x: 9, z: -48 }, 0);
    assert.deepEqual(buildDraft(state).config.at, [0, -40], 'and moving it snaps it again, to the other end');
    insertObject(state, { x: 9, z: -48 }, 0, { free: true });
    assert.deepEqual(buildDraft(state).config.at, [9, -48]);

    chooseCityPrefab(state, 'cottage');
    assert.equal(cityPlacement(state, { x: 4, z: 26 }, 0).snapped, false, 'a house never snaps');
    assert.deepEqual(cityPlacement(state, { x: 4.04, z: 46.06 }, 0).placement.config.at, [4, 46.1], 'placed to a tenth of a metre');
    assert.deepEqual(cityPlacement(state, { x: -0.0000007, z: 12 }, 0).placement.config.at, [0, 12], 'never a negative nought');
});

test('with auto accept on for drawing, a click keeps the piece in hand and places another', () => {
    const state = cityCanvas();
    setAutoAccept(state, { draw: true });
    chooseCityPrefab(state, 'bungalow');
    insertObject(state, { x: 0, z: 0 });
    assert.equal(drawAgain(state), true);
    assert.equal(committedPlacements(state).length, 1);
    insertObject(state, { x: 40, z: 0 });
    assert.equal(draftPending(state), true);
});

test('the control list says how a card is placed, and how a road is placed free', () => {
    const lines = buildHelpLines().map(line => line.text);
    assert.ok(lines.includes('Click (Insert city) - Place the Chosen Building, Road or Park'));
    assert.ok(lines.includes('Shift+Click (Insert city) - Place a Road Without Snapping'));
});

// --- The page ---------------------------------------------------------------------------------

test('a row of cards wraps rather than running off the dock, where the canvas would take the press', () => {
    const page = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');
    assert.match(page, /\.dock-shapes \{\s*display: flex;\s*flex-wrap: wrap;/);
});

test('the page places a card at a click, previews it under the pointer, and snaps a road unless shift is held', () => {
    const main = source('main.js');
    assert.match(methodBody(main, 'onCanvasPress'), /else if \(e\.button === 0 && insertsCity\(tool\)\) this\.cityAt\(e\);/);
    assert.match(methodBody(main, 'cityAt'), /insertObject\(this\.builder, point, arrivalHeading\(viewBearing\(this\.buildCamera\)\), \{\s*size: this\.terrain\.size, free: e\.shiftKey\s*\}\)/);
    assert.match(methodBody(main, 'cityPreview'), /free: pointer\.shift === true/);
    assert.match(methodBody(main, 'onCanvasDrag'), /this\.canvasPointer = \{ x: e\.clientX, y: e\.clientY, type: e\.pointerType, shift: e\.shiftKey \};/);
    assert.match(methodBody(main, 'drawBuildOverlay'), /preview\.snapped \? SNAPPED_OUTLINE : DRAWING_OUTLINE/);
    assert.match(methodBody(main, 'onDockShape'), /if \(this\.dockShown\?\.kind === DOCK_CITY\) \{\s*if \(!chooseCityPrefab\(this\.builder, id\)\) return;/);
    assert.match(methodBody(main, 'onDockFold'), /if \(section\.kind === DOCK_CITY\) \{\s*if \(openCitySection\(this\.builder, section\.category\)\) this\.syncDock\(\);\s*return;/);
    assert.match(methodBody(main, 'applyDockValue'), /kind === DOCK_DRAFT \|\| kind === DOCK_RUNWAY \|\| kind === DOCK_CITY/);
});

test('every road a tile carries is laid over its ground as one mesh, pulled toward the camera so it never flickers', () => {
    const mesh = source('object-mesh.js');
    assert.match(mesh, /if \(object\.drape\) continue;/, 'never an instance of a stood recipe');
    assert.match(mesh, /const draped = drapedGeometry\(objects, groundAt\);/);
    assert.match(mesh, /material\.polygonOffset = true;\s*material\.polygonOffsetFactor = -2;\s*material\.polygonOffsetUnits = -2;/);
    assert.match(source('terrain.js'), /objectGroup\(objects, \{ groundAt: \(x, z\) => sampleHeight\(field, x, z\) \}\)/);
});
