import test from 'node:test';
import assert from 'node:assert/strict';
import {
    dockContent, draftHolderFor, canvasElements, DOCK_SELECT, DOCK_DRAFT, DOCK_ACCEPT, DOCK_CANCEL, SELECT_HEADING
} from '../js/build-panel.js';
import {
    createBuildState, openBuildMode, beginCanvas, startDraft, acceptDraft, BUILD_FROM_TITLE
} from '../js/build-mode.js';
import {
    createBuildCamera, orbitBuildCamera, zoomBuildCamera, buildCameraPosition, readCameraFields,
    writeCameraField, cameraFieldRanges, nudgeBuildCamera, wrapDegrees, CAMERA_NUDGES,
    DEFAULT_FOV, FOV_LOW, FOV_HIGH, MIN_PITCH, MAX_PITCH, CANVAS_PITCH
} from '../js/build-camera.js';
import { BUILD_TOOLS, toolForElement, toolPlacement } from '../js/build-tools.js';
import { rangeRows, stepRow, rowValue } from '../js/properties-panel.js';
import { rowKey, fieldFigure } from '../js/panel-view.js';
import { getElement } from '../js/environment/elements.js';
import { getEnvironment } from '../js/environment/presets.js';
import { DEFAULT_SIZE } from '../js/environment/elements.js';

function onCanvas() {
    const state = createBuildState();
    openBuildMode(state, BUILD_FROM_TITLE);
    beginCanvas(state, 'highlands');
    return state;
}

const POOL = { type: 'water', config: { level: 300, flatten: 1 }, footprint: { kind: 'disc', x: 0, z: 0, radius: 900 } };
const near = (a, b, within = 1e-6) => Math.abs(a - b) <= within;

// --- What the dock shows -----------------------------------------------------------

test('there is no dock off a canvas', () => {
    const state = createBuildState();
    assert.equal(dockContent(state, { camera: createBuildCamera(DEFAULT_SIZE) }), null);

    openBuildMode(state, BUILD_FROM_TITLE);
    assert.equal(dockContent(state, { camera: createBuildCamera(DEFAULT_SIZE) }), null, 'and none on the picker');
});

/**
 * Select's own panel is the camera written out, under the start tour's own
 * heading, with the rows that slide the view and nothing to accept.
 */
test('with Select live the dock is the camera written out', () => {
    const shown = dockContent(onCanvas(), { camera: createBuildCamera(DEFAULT_SIZE), fov: DEFAULT_FOV });

    assert.equal(shown.kind, DOCK_SELECT);
    assert.equal(shown.heading, 'SELECTION MODE');
    assert.equal(SELECT_HEADING, 'SELECTION MODE');
    assert.deepEqual(shown.rows.map(entry => entry.row.label), [
        'CAMERA X', 'CAMERA Y', 'CAMERA Z', 'TARGET X', 'TARGET Y', 'TARGET Z',
        'ROTATE X', 'ROTATE Y', 'ZOOM', 'FIELD OF VIEW'
    ]);
    assert.deepEqual(shown.nudges.map(nudge => nudge.label), ['PAN X', 'PAN Y', 'MOVE FORWARD', 'MOVE RIGHT']);
    assert.deepEqual(shown.actions, [], 'the camera is never pending, so there is nothing to accept');
    assert.ok(shown.rows.every(entry => entry.live));
});

test('with an edit in hand the dock is that edit, headed as its tool\'s panel, with its accept and cancel', () => {
    const state = onCanvas();
    startDraft(state, POOL);
    const shown = dockContent(state, { camera: createBuildCamera(DEFAULT_SIZE) });

    assert.equal(shown.kind, DOCK_DRAFT);
    assert.equal(shown.heading, 'BUILD WATER');
    assert.deepEqual(shown.rows.map(entry => entry.row.label), ['LEVEL', 'COLOR LIGHT', 'COLOR DARK', 'FLATTEN']);
    assert.deepEqual(shown.actions, [DOCK_ACCEPT, DOCK_CANCEL]);
    assert.equal(shown.rows.find(entry => entry.name === 'level').value, 300, 'reading what the edit holds');
});

test('an edit of an element no tool places yet is headed by the element', () => {
    const state = onCanvas();
    startDraft(state, { type: 'forest', config: {} });
    assert.equal(dockContent(state, {}).heading, 'BUILD FOREST');
});

test('a live tool with no panel yet shows nothing', () => {
    const state = onCanvas();
    state.tool = 'lasso';
    assert.equal(dockContent(state, { camera: createBuildCamera(DEFAULT_SIZE) }), null);
});

/**
 * A gradient is stepped along its own hue, as the element editor steps one: its
 * ends are held as shades of the colours the edit began with.
 */
test('an edit is held with its gradients as shades of the colours it began with', () => {
    const holder = draftHolderFor(POOL);
    assert.equal(holder.config.level, 300);
    assert.deepEqual(holder.shades.color, { light: 1, dark: 1 });
    assert.deepEqual(holder.base.color, holder.config.color);

    const [, darker] = rangeRows('color', getElement('water').ranges.color);
    stepRow(holder, 'color', darker, 5);
    assert.ok(holder.config.color.dark[2] > holder.base.color.dark[2], 'stepped lighter along the dark end\'s own hue');
    assert.equal(draftHolderFor({ type: 'nothing' }), null);
});

/**
 * The canvas is drawn from the environment's own placements and what has been
 * built on it, the edit in hand shown where it stands - so a value moved on
 * the panel is the ground moving under it.
 */
test('the canvas is drawn from the environment and what was built on it', () => {
    const state = onCanvas();
    const environment = getEnvironment('highlands');
    assert.deepEqual(canvasElements(environment, state), environment.elements);

    startDraft(state, POOL);
    assert.deepEqual(canvasElements(environment, state), [...environment.elements, POOL], 'with the edit shown');

    acceptDraft(state);
    assert.deepEqual(canvasElements(environment, state), [...environment.elements, POOL], 'and kept once accepted');
});

// --- The camera written out ---------------------------------------------------------

test('the fields read what the camera is doing', () => {
    const hold = createBuildCamera(DEFAULT_SIZE);
    const fields = readCameraFields(hold, DEFAULT_FOV);
    const { position } = buildCameraPosition(hold);

    assert.deepEqual([fields.cameraX, fields.cameraY, fields.cameraZ], [position.x, position.y, position.z]);
    assert.deepEqual([fields.targetX, fields.targetY, fields.targetZ], [0, 0, 0]);
    assert.equal(fields.rotateX, CANVAS_PITCH);
    assert.equal(fields.zoom, 100, 'the hold is 100% - the whole canvas');
    assert.equal(fields.fieldOfView, 100);
});

/** Select's panel is a readout of the gestures as much as an entry for them. */
test('the fields read back what a gesture just did', () => {
    const turned = orbitBuildCamera(createBuildCamera(DEFAULT_SIZE), 1600, -40);
    const fields = readCameraFields(turned);
    assert.equal(fields.rotateY, wrapDegrees(turned.yaw), 'the yaw, brought round into -180 to 180');
    assert.ok(fields.rotateY >= -180 && fields.rotateY <= 180);
    assert.equal(fields.rotateX, turned.pitch);

    const closer = zoomBuildCamera(createBuildCamera(DEFAULT_SIZE), -300);
    assert.ok(near(readCameraFields(closer).zoom, closer.furthest / closer.distance * 100));
});

test('a field written is the camera moved, held to what the view allows', () => {
    const hold = createBuildCamera(DEFAULT_SIZE);

    assert.equal(writeCameraField(hold, DEFAULT_FOV, 'targetX', 2000).state.target.x, 2000);
    assert.equal(writeCameraField(hold, DEFAULT_FOV, 'targetZ', 99999).state.target.z, DEFAULT_SIZE / 2, 'the target stays over the canvas');
    assert.equal(writeCameraField(hold, DEFAULT_FOV, 'rotateX', 95).state.pitch, MAX_PITCH);
    assert.equal(writeCameraField(hold, DEFAULT_FOV, 'rotateX', 2).state.pitch, MIN_PITCH);
    assert.equal(writeCameraField(hold, DEFAULT_FOV, 'rotateY', 270).state.yaw, -90);
    assert.ok(near(writeCameraField(hold, DEFAULT_FOV, 'zoom', 200).state.distance, hold.furthest / 2), '200% is twice as close');
    assert.equal(writeCameraField(hold, DEFAULT_FOV, 'zoom', 50).state.distance, hold.furthest, 'and no further out than the hold');
    assert.ok(near(writeCameraField(hold, DEFAULT_FOV, 'fieldOfView', 120).fov, 84));
    assert.ok(near(writeCameraField(hold, DEFAULT_FOV, 'fieldOfView', 500).fov, FOV_HIGH / 100 * DEFAULT_FOV));
    assert.ok(near(writeCameraField(hold, DEFAULT_FOV, 'fieldOfView', 1).fov, FOV_LOW / 100 * DEFAULT_FOV));
    assert.equal(writeCameraField(hold, DEFAULT_FOV, 'targetX', 'east').state, hold, 'a figure that is no number moves nothing');
});

/**
 * Where the camera stands is written by keeping the point it turns about and
 * working the orbit out again, so the camera lands where it was asked for.
 */
test('writing where the camera stands keeps the target and stands it there', () => {
    const hold = createBuildCamera(DEFAULT_SIZE);
    const { state } = writeCameraField(hold, DEFAULT_FOV, 'cameraY', 6000);
    const { position, target } = buildCameraPosition(state);

    assert.deepEqual(target, hold.target, 'the target is where it was');
    assert.ok(near(position.y, 6000, 1e-6), `the camera stands at ${position.y}`);
    assert.ok(near(position.z, buildCameraPosition(hold).position.z, 1e-6), 'and the other axes are where they were');
});

test('every camera field draws a row that moves, as any element\'s range does', () => {
    const camera = zoomBuildCamera(createBuildCamera(DEFAULT_SIZE), -200);
    const ranges = cameraFieldRanges(camera);

    for (const [name, range] of Object.entries(ranges)) {
        const rows = rangeRows(name, range);
        assert.equal(rows.length, 1, `${name} is one row`);
        const holder = { config: readCameraFields(camera) };
        const was = rowValue(holder, name, rows[0]);
        assert.ok(stepRow(holder, name, rows[0], 1) || stepRow(holder, name, rows[0], -1), `${name} moves`);
        assert.notEqual(rowValue(holder, name, rows[0]), was);
    }
});

test('the PAN and MOVE rows slide the view a tenth at a press', () => {
    for (const yaw of [0, 90, -135]) {
        const start = { ...createBuildCamera(DEFAULT_SIZE), yaw };
        const walked = nudgeBuildCamera(start, 'moveForward', 1);
        const went = Math.hypot(walked.target.x - start.target.x, walked.target.z - start.target.z);
        assert.ok(near(went, start.distance * 0.1, 1e-6), `MOVE FORWARD at a yaw of ${yaw} went ${went}`);
    }

    const start = createBuildCamera(DEFAULT_SIZE);
    assert.ok(nudgeBuildCamera(start, 'moveRight', 1).target.x > 0);
    assert.ok(nudgeBuildCamera(start, 'moveRight', -1).target.x < 0);
    assert.ok(nudgeBuildCamera(start, 'panX', 1).target.x !== 0);
    assert.ok(nudgeBuildCamera(start, 'panY', 1).target.z !== 0);
    assert.equal(nudgeBuildCamera(start, 'moveForward', 0), start, 'no press is no slide');
    assert.equal(nudgeBuildCamera(start, 'sideways', 1), start);
    assert.deepEqual(CAMERA_NUDGES.map(nudge => nudge.id), ['panX', 'panY', 'moveForward', 'moveRight']);
});

// --- The split and the headings -------------------------------------------------------

test('a tool\'s panel values split into the element\'s config and the footprint it drew', () => {
    const brush = { element: 'grass', shapes: ['width', 'depth'] };
    const drawn = { kind: 'stroke', points: [[0, 0], [100, 0]], stamp: { width: 1, depth: 1 } };

    assert.deepEqual(toolPlacement(brush, { density: 0.5, width: 300, depth: 120 }, drawn), {
        type: 'grass',
        config: { density: 0.5 },
        footprint: { ...drawn, width: 300, depth: 120 }
    });
    assert.deepEqual(toolPlacement({ element: 'water' }, { level: 30 }), { type: 'water', config: { level: 30 } },
        'a tool that drew nothing and shapes nothing makes no footprint');
});

test('the panels the artwork heads are headed the artwork\'s way', () => {
    const headings = Object.fromEntries(BUILD_TOOLS.filter(tool => tool.heading).map(tool => [tool.id, tool.heading]));
    assert.deepEqual(headings, {
        select: 'SELECTION MODE', mountain: 'BUILD MOUNTAINS', grass: 'BUILD GRASS', sand: 'BUILD SAND',
        water: 'BUILD WATER', snow: 'BUILD SNOW', runway: 'INSERT RUNWAY'
    });
    assert.equal(toolForElement('water').id, 'water');
    assert.equal(toolForElement('forest'), null);
});

// --- The view's readings -----------------------------------------------------------------

test('a typed field shows a row in the units the row reads in', () => {
    const [light] = rangeRows('color', getElement('water').ranges.color);
    assert.equal(fieldFigure(light, 1.25), 125, 'a shade as its percentage');

    const [level] = rangeRows('level', getElement('water').ranges.level);
    assert.equal(fieldFigure(level, 312.0000001), 312, 'a number to the places its step moves in');
    assert.equal(rowKey({ name: 'level', row: level }), 'level:value');
});
