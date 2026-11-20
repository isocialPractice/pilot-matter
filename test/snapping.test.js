import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createBuilderSettingsState, adjustBuilderSetting, resetBuilderSettings, builderSnapSizes,
    BUILDER_OPTIONS, SNAPPING_GROUP, GRID_SIZE_OPTION, SNAP_ANGLE_OPTION, GRID_SIZES, SNAP_ANGLES
} from '../js/builder-settings.js';
import {
    createBuildState, openBuildMode, beginCanvas, loadCanvas, buildSnap, toggleBuildSnap, buildSnapSteps,
    SNAP_GRID, SNAP_ANGLE, SNAP_KINDS, BUILD_FROM_TITLE
} from '../js/build-mode.js';
import { snapTo, dragHandle, MIN_SCALE } from '../js/gumball.js';
import { snapGridRuns, snapGridStep, SNAP_GRID_CELLS, SNAP_GRID_LEAST_PIXELS } from '../js/build-overlay.js';
import { placeObject } from '../js/objects.js';
import { prefabsIn } from '../js/prefabs.js';

const SIZE = 16000;
const PREFAB = prefabsIn('residential')[0].id;

function onCanvas() {
    const state = createBuildState();
    openBuildMode(state, BUILD_FROM_TITLE);
    beginCanvas(state, 'highlands');
    return state;
}

// --- The sizes, which are the builder's own settings ---------------------------------

test('the two sizes are rows of the builder\'s settings, starting at 10 metres and 15 degrees', () => {
    const snapping = BUILDER_OPTIONS.filter(option => option.group === SNAPPING_GROUP);
    assert.deepEqual(snapping.map(option => option.id), [GRID_SIZE_OPTION, SNAP_ANGLE_OPTION]);
    assert.deepEqual(snapping.map(option => option.default), [10, 15]);

    const state = createBuilderSettingsState();
    assert.deepEqual(builderSnapSizes(state), { grid: 10, angle: 15 });
});

test('either size is stepped along what it offers, and reset puts both back', () => {
    const state = createBuilderSettingsState();
    adjustBuilderSetting(state, GRID_SIZE_OPTION, 1);
    adjustBuilderSetting(state, SNAP_ANGLE_OPTION, -1);

    assert.equal(builderSnapSizes(state).grid, GRID_SIZES[2].value, 'on one place along the sizes');
    assert.equal(builderSnapSizes(state).angle, SNAP_ANGLES[0].value, 'and back one along the angles');

    resetBuilderSettings(state);
    assert.deepEqual(builderSnapSizes(state), { grid: 10, angle: 15 });
});

test('a settings state that is not one still answers with the sizes a snap starts at', () => {
    assert.deepEqual(builderSnapSizes(null), { grid: 10, angle: 15 });
    assert.deepEqual(builderSnapSizes({ values: {} }), { grid: 10, angle: 15 });
});

// --- The switches, which are the session's ---------------------------------------------

test('both snaps start off on a canvas, and are both off off one', () => {
    assert.deepEqual(buildSnap(createBuildState()), { grid: false, angle: false });
    assert.deepEqual(buildSnap(onCanvas()), { grid: false, angle: false });
});

test('either switch is turned over on its own', () => {
    const state = onCanvas();
    assert.equal(toggleBuildSnap(state, SNAP_GRID), true);
    assert.deepEqual(buildSnap(state), { grid: true, angle: false });

    assert.equal(toggleBuildSnap(state, SNAP_ANGLE), true);
    assert.deepEqual(buildSnap(state), { grid: true, angle: true });

    assert.equal(toggleBuildSnap(state, SNAP_GRID), true);
    assert.deepEqual(buildSnap(state), { grid: false, angle: true });
});

test('a switch is refused off a canvas, and for a name that is neither of the two', () => {
    assert.equal(toggleBuildSnap(createBuildState(), SNAP_GRID), false);
    assert.equal(toggleBuildSnap(onCanvas(), 'everything'), false);
    assert.deepEqual(SNAP_KINDS, [SNAP_GRID, SNAP_ANGLE]);
});

test('a canvas opened afresh, or one a world was loaded over, opens with both off', () => {
    const state = onCanvas();
    toggleBuildSnap(state, SNAP_GRID);
    toggleBuildSnap(state, SNAP_ANGLE);

    loadCanvas(state, { environment: 'lakeside', placements: [], world: [] }, 'Sample Valley');
    assert.deepEqual(buildSnap(state), { grid: false, angle: false });
});

/**
 * The session holds the switch and the settings hold the size, and this is
 * where the two meet: a switch that is off is a step of nothing, which is how
 * `dragHandle` reads "do not snap".
 */
test('what a drag snaps to is the switch read against the size', () => {
    const state = onCanvas();
    const sizes = { grid: 25, angle: 45 };

    assert.deepEqual(buildSnapSteps(state, sizes), { grid: 0, angle: 0 }, 'both off is nothing to snap to');

    toggleBuildSnap(state, SNAP_GRID);
    assert.deepEqual(buildSnapSteps(state, sizes), { grid: 25, angle: 0 });

    toggleBuildSnap(state, SNAP_ANGLE);
    assert.deepEqual(buildSnapSteps(state, sizes), { grid: 25, angle: 45 });
});

test('a size that is not a size is no step, so a switch on cannot snap to nothing', () => {
    const state = onCanvas();
    toggleBuildSnap(state, SNAP_GRID);
    toggleBuildSnap(state, SNAP_ANGLE);

    for (const sizes of [{}, { grid: 0, angle: 0 }, { grid: -10, angle: 'quarter' }, { grid: NaN, angle: null }]) {
        assert.deepEqual(buildSnapSteps(state, sizes), { grid: 0, angle: 0 }, JSON.stringify(sizes));
    }
});

// --- Putting a value on the grid ---------------------------------------------------------

test('a value is put on the nearest multiple, and a step of nothing leaves it alone', () => {
    assert.equal(snapTo(1234, 10), 1230);
    assert.equal(snapTo(1236, 10), 1240);
    assert.equal(snapTo(1235, 10), 1240, 'a half lands on the one away from zero, as rounding does');
    assert.equal(snapTo(-1234, 10), -1230);
    assert.equal(snapTo(37, 25), 25);
    assert.equal(snapTo(1234, 0), 1234);
    assert.equal(snapTo(1234, -10), 1234);
});

test('a multiple at nothing is written as nothing, never as a minus nothing', () => {
    assert.equal(Object.is(snapTo(-2, 10), 0), true);
    assert.equal(Object.is(snapTo(0, 10), 0), true);
});

// --- What a drag of a handle lands on -----------------------------------------------------

const mountain = () => ({ type: 'mountain', config: { at: [1234, -567], height: [300, 500], radius: [1500, 2500] }, seed: 1 });
const batch = () => ({
    type: 'grass',
    config: { density: 1 },
    footprint: { kind: 'placed', x: 1234, z: -567, scaleX: 1, scaleZ: 1, angle: 0.3, of: { kind: 'disc', x: 0, z: 0, radius: 800 } }
});

test('a move with the grid on lands the placement on a line of it, wherever it was before', () => {
    const drag = { ground: { dx: 300, dz: 300 } };
    const free = dragHandle(mountain(), 'move-uniform', drag, { size: SIZE });
    assert.deepEqual(free.config.at, [1534, -267], 'free, it follows the ground exactly');

    const snapped = dragHandle(mountain(), 'move-uniform', drag, { size: SIZE, snap: { grid: 100 } });
    assert.deepEqual(snapped.config.at, [1500, -300], 'snapped, it lands on the hundred');
    for (const value of snapped.config.at) assert.ok(Number.isInteger(value / 100), `${value} is on the grid`);
});

test('a slide along one axis snaps too, and stays on its axis', () => {
    const drag = { ground: { dx: 260, dz: 260 } };
    const snapped = dragHandle(mountain(), 'move-3', drag, { size: SIZE, snap: { grid: 50 } });
    assert.ok(Number.isInteger(snapped.config.at[0] / 50), 'the slide lands on the fifty');
    assert.equal(snapped.config.at[1], -550, 'the red arrow runs east, so z lands on the grid where it stood');
});

test('a batch\'s frame snaps as a point does, since a footprint carries its own middle', () => {
    const snapped = dragHandle(batch(), 'move-uniform', { ground: { dx: 300, dz: 300 } }, { size: SIZE, snap: { grid: 100 } });
    assert.equal(snapped.footprint.x, 1500);
    assert.equal(snapped.footprint.z, -300);
});

test('a turn with the angle on lands on a multiple of it, in degrees', () => {
    const object = placeObject(PREFAB, [0, 0], { heading: 0 });
    const turn = { turn: 50 * Math.PI / 180 };

    assert.equal(dragHandle(object, 'rotate-blue', turn, { size: SIZE }).config.heading, 50);
    assert.equal(dragHandle(object, 'rotate-blue', turn, { size: SIZE, snap: { angle: 15 } }).config.heading, 45);
    assert.equal(dragHandle(object, 'rotate-blue', { turn: -Math.PI / 2 }, { size: SIZE, snap: { angle: 15 } }).config.heading, 270,
        'and comes round the card rather than reading minus ninety');
});

test('a footprint\'s angle is snapped in degrees and written back in radians', () => {
    const snapped = dragHandle(batch(), 'rotate-blue', { turn: 0.2 }, { size: SIZE, snap: { angle: 15 } });
    const degrees = snapped.footprint.angle * 180 / Math.PI;
    assert.ok(Math.abs(degrees - Math.round(degrees / 15) * 15) < 1e-9, `${degrees} is a multiple of 15`);
    assert.equal(Math.round(degrees), 30, 'the 0.3 radians it stood at plus 0.2 is nearest 30 degrees');
});

test('a turn with the angle off is written exactly as it was turned, down to the radian', () => {
    const turned = dragHandle(batch(), 'rotate-blue', { turn: 0.2 }, { size: SIZE, snap: { angle: 0 } });
    assert.equal(turned.footprint.angle, 0.5);
});

/**
 * A size is read against the bounds its own range declares, and a grid has
 * nothing to say about it: snapping a radius to the grid would put a mountain's
 * spread on a multiple of 10 metres for no reason anybody asked for.
 */
test('a snap reaches the moves and the turns and leaves every size alone', () => {
    const grabbed = mountain();
    const snap = { grid: 100, angle: 15 };
    const free = dragHandle(grabbed, 'scale-grassy', { along: 40 }, { size: SIZE });
    const held = dragHandle(grabbed, 'scale-grassy', { along: 40 }, { size: SIZE, snap });
    assert.deepEqual(held, free);

    const raised = dragHandle(grabbed, 'move', { along: 40 }, { size: SIZE, snap });
    assert.deepEqual(raised, dragHandle(grabbed, 'move', { along: 40 }, { size: SIZE }), 'and a raise of a span as well');

    const stretched = dragHandle(batch(), 'scale-x', { along: -40 }, { size: SIZE, snap });
    assert.deepEqual(stretched, dragHandle(batch(), 'scale-x', { along: -40 }, { size: SIZE }));
    assert.ok(stretched.footprint.scaleX > MIN_SCALE, 'a stretch of a frame, held where it always was');
});

// --- The grid drawn round the pointer -------------------------------------------------------

test('the grid is lines of points on the grid, read off the point snapped to it', () => {
    const runs = snapGridRuns({ x: 1234, z: -567 }, 100);
    const lines = 2 * (2 * SNAP_GRID_CELLS + 1);
    assert.equal(runs.length, lines, 'a line each way for every cell either side of the pointer');

    for (const run of runs) {
        assert.equal(run.length, 2 * SNAP_GRID_CELLS + 1, 'with a point at every crossing, so it drapes over the ground');
        for (const [x, z] of run) {
            assert.ok(Number.isInteger(x / 100), `${x} is on the grid`);
            assert.ok(Number.isInteger(z / 100), `${z} is on the grid`);
        }
    }
});

test('the grid stands still while the pointer crosses a cell, and steps over when it leaves it', () => {
    const first = snapGridRuns({ x: 1200, z: 0 }, 100)[0];
    assert.deepEqual(snapGridRuns({ x: 1240, z: 0 }, 100)[0], first, 'the same grid within the cell');
    assert.notDeepEqual(snapGridRuns({ x: 1260, z: 0 }, 100)[0], first, 'and the next one past it');
});

test('a step of nothing draws no grid, and neither does no pointer', () => {
    assert.deepEqual(snapGridRuns({ x: 0, z: 0 }, 0), []);
    assert.deepEqual(snapGridRuns({ x: 0, z: 0 }, -10), []);
    assert.deepEqual(snapGridRuns(null, 100), []);
});

test('the grid is bounded by its cells however it is asked for, so a frame cannot be spent drawing it', () => {
    assert.equal(snapGridRuns({ x: 0, z: 0 }, 100, 0).length, 2 * 3, 'a cell count of nothing still draws one either side');
    assert.equal(snapGridRuns({ x: 0, z: 0 }, 100, 2).length, 2 * 5);
});

/**
 * The step a cell is drawn at, which is not always the step a drag snaps to.
 * Measured in Chromium: at the hold's distance one screen pixel is 27 units,
 * so a 10 metre grid came to 36 lit pixels at the middle of the screen.
 */
test('the grid is drawn coarser than it snaps where a cell would be too small to see', () => {
    assert.equal(snapGridStep(10, 0.5), 10, 'close in, drawn exactly as it snaps');
    assert.equal(snapGridStep(10, 10 / SNAP_GRID_LEAST_PIXELS), 10, 'and at a cell of exactly the pixels it wants, still');
    assert.equal(snapGridStep(10, 1), 20, 'a cell of ten pixels is under the floor, so the first doubling past it');
    assert.equal(snapGridStep(10, 2), 40);
    assert.equal(snapGridStep(10, 27), 640,
        'and at the hold\'s distance, 64 times the step - a cell of 24 pixels, where a 10 metre one was a speck');
});

test('every line the grid draws is a line a snapped move lands on', () => {
    for (const across of [0, 0.5, 2, 7, 27, 400]) {
        const drawn = snapGridStep(10, across);
        assert.ok(Number.isInteger(drawn / 10), `${drawn} is a multiple of the step`);
        assert.ok(drawn >= 10, 'and never finer than it');
    }
});

test('a step of nothing is drawn at nothing, whatever the view is', () => {
    assert.equal(snapGridStep(0, 27), 0);
    assert.equal(snapGridStep(-10, 27), 0);
    assert.deepEqual(snapGridRuns({ x: 0, z: 0 }, snapGridStep(0, 27)), []);
});

test('a view that says nothing leaves the grid at the step it snaps to', () => {
    assert.equal(snapGridStep(10), 10);
    assert.equal(snapGridStep(10, NaN), 10);
    assert.equal(snapGridStep(10, 27, 0), 10, 'and so does asking for a cell of no pixels at all');
});
