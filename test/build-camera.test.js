import test from 'node:test';
import assert from 'node:assert/strict';
import {
    canvasCamera, canvasFarPlane,
    CANVAS_PITCH, CANVAS_STANDOFF, CANVAS_FAR, CANVAS_FOG,
    createBuildCamera, buildCameraPosition, orbitBuildCamera, panBuildCamera,
    zoomBuildCamera, moveBuildCamera, reframeBuildCamera, cameraGesture, wheelPixels,
    moveIntent, isBuildMoveKey, isReframeKey, clearOfGround,
    CAMERA_ORBIT, CAMERA_PAN, CAMERA_GESTURES, BUILD_MOVE_KEYS, REFRAME_KEYS,
    MIN_PITCH, MAX_PITCH, MAX_MOVE_STEP, CAMERA_CLEARANCE
} from '../js/build-camera.js';
import { TILE_REACH } from '../js/world-tiles.js';
import { DEFAULT_SIZE } from '../js/environment/elements.js';
import { SELECT_TOOL } from '../js/build-tools.js';
import { isMenuControlKey } from '../js/menu.js';
import { DEFAULT_KEYMAP, RESET_KEYS } from '../js/input-map.js';
import { isReservedKey } from '../js/reserved-keys.js';
import { readFileSync } from 'node:fs';

/**
 * The flight's own fog density, read out of `js/sky.js` as text rather than
 * imported from it.
 *
 * That module pulls in Three.js, which the suite does not have and is
 * deliberately browserless about. Read rather than written out a second time,
 * because a second copy of the number is how the two come to disagree - which
 * is the failure this comparison is about.
 */
const skySource = readFileSync(new URL('../js/sky.js', import.meta.url), 'utf8');
const FOG_DENSITY = Number(skySource.match(/export const FOG_DENSITY\s*=\s*([\d.eE-]+)/)?.[1]);

/** How far a camera placement stands from what it is looking at. */
function standoff({ position, target }) {
    return Math.hypot(position.x - target.x, position.y - target.y, position.z - target.z);
}

test('the camera looks at the middle of the canvas, which is the middle of the world', () => {
    const { target } = canvasCamera(DEFAULT_SIZE);
    assert.deepEqual(target, { x: 0, y: 0, z: 0 });
});

// Square to the canvas rather than at a corner of it: an edge being worked to
// reads as an edge when it is parallel to the frame.
test('the camera stands back along one axis rather than across a corner', () => {
    const { position } = canvasCamera(DEFAULT_SIZE);

    assert.equal(position.x, 0);
    assert.ok(position.y > 0, 'above the canvas');
    assert.ok(position.z > 0, 'and back from the middle of it');
});

test('the view is tilted down by the pitch it declares', () => {
    const { position, target } = canvasCamera(DEFAULT_SIZE);
    const down = Math.atan2(position.y - target.y, Math.hypot(position.x - target.x, position.z - target.z));

    assert.ok(Math.abs(down * 180 / Math.PI - CANVAS_PITCH) < 0.001,
        `the view should be ${CANVAS_PITCH} degrees down and it was ${down * 180 / Math.PI}`);
});

test('a steeper pitch stands the camera higher without moving it further off', () => {
    const shallow = canvasCamera(DEFAULT_SIZE, { pitch: 30 });
    const steep   = canvasCamera(DEFAULT_SIZE, { pitch: 75 });

    assert.ok(steep.position.y > shallow.position.y, 'higher');
    assert.ok(steep.position.z < shallow.position.z, 'and less of it behind');
    assert.ok(Math.abs(standoff(steep) - standoff(shallow)) < 0.001,
        'at the same distance, because the pitch turns the view rather than moving it');
});

// A pitch straight down loses every bit of relief the ground has, and one on
// the horizon is not looking at the canvas at all, so both poles are clamped.
test('the pitch is held off both poles', () => {
    for (const pitch of [0, -40, 90, 200, NaN, undefined]) {
        const { position, target } = canvasCamera(DEFAULT_SIZE, { pitch });
        const height = position.y - target.y;
        const flat   = Math.hypot(position.x - target.x, position.z - target.z);

        assert.ok(height > 0, `a pitch of ${pitch} should still be above the canvas`);
        assert.ok(flat > 0, `and a pitch of ${pitch} should still be back from it`);
    }
});

/**
 * The distance is written against the canvas rather than as a number of units,
 * because what it has to do is frame the canvas: a distance that framed a
 * 16000-unit square would be the wrong distance for any other.
 */
test('the distance is measured off the canvas it is framing', () => {
    assert.ok(Math.abs(standoff(canvasCamera(16000)) - 16000 * CANVAS_STANDOFF) < 0.001);
    assert.ok(Math.abs(standoff(canvasCamera(4000)) - 4000 * CANVAS_STANDOFF) < 0.001);
    assert.ok(standoff(canvasCamera(16000)) > standoff(canvasCamera(4000)),
        'a bigger canvas is stood further back from');
});

test('the camera never stands further off than it can see', () => {
    // A canvas far wider than the far plane allows: the camera is placed where
    // it can see rather than where the whole of the square would be clipped.
    const far = canvasFarPlane(1000);
    assert.ok(standoff(canvasCamera(1000000, { far })) <= far + 0.001,
        'the distance should be held inside the far plane it was handed');
});

test('a canvas of no size is not a reason to divide by it', () => {
    for (const size of [0, -16000, NaN, undefined, null, 'wide']) {
        const placement = canvasCamera(size);

        assert.ok(Number.isFinite(placement.position.x), `${size} should still place a camera`);
        assert.ok(Number.isFinite(placement.position.y));
        assert.ok(Number.isFinite(placement.position.z));
    }
});

/**
 * The far plane has to reach past the canvas's far corner rather than to its
 * middle, because that corner is the extent of what is being built. The
 * flight's own `TILE_REACH` is shorter than the diagonal of one tile, which is
 * right for a flight - it is what keeps the end of the ground out of frame -
 * and wrong for a canvas.
 */
test('the far plane reaches past the canvas corner furthest from the camera', () => {
    const size = DEFAULT_SIZE;
    const far = canvasFarPlane(size);
    const { position } = canvasCamera(size);
    const half = size / 2;

    assert.ok(far > TILE_REACH, 'and further than a flight needs to see');

    for (const [x, z] of [[half, half], [-half, half], [half, -half], [-half, -half]]) {
        const away = Math.hypot(position.x - x, position.y, position.z - z);
        assert.ok(away < far, `the corner at ${x},${z} is ${away} away and would be clipped at ${far}`);
    }
});

test('a canvas inside the flight reach keeps that reach rather than shortening it', () => {
    assert.equal(canvasFarPlane(100), TILE_REACH);
    assert.equal(canvasFarPlane(0), TILE_REACH);
    assert.equal(canvasFarPlane(DEFAULT_SIZE), DEFAULT_SIZE * CANVAS_FAR);
});

/**
 * And the air is cleared, which is the other half of being able to see the
 * edges. Exponential fog at the flight's own density is total well inside one
 * tile, so a canvas left in it would be a disc of ground in a grey wall.
 */
test('the air over a canvas is clear enough to read its far corner as ground', () => {
    assert.ok(FOG_DENSITY > 0, 'js/sky.js should still declare the density this is measured against');

    const density = FOG_DENSITY * CANVAS_FOG;
    const corner  = Math.hypot(DEFAULT_SIZE, DEFAULT_SIZE) / 2;

    // FogExp2: the fraction of a surface the air has taken at a distance.
    const hidden = 1 - Math.exp(-((density * corner) ** 2));
    assert.ok(hidden < 0.5, `the far corner should still read as ground, and it was ${hidden} hidden`);

    const flight = 1 - Math.exp(-((FOG_DENSITY * corner) ** 2));
    assert.ok(flight > 0.99, 'where the flight it is standing down from hides it entirely');
    assert.ok(CANVAS_FOG > 0, 'and the air is thinned rather than taken away');
});

// --- The camera that moves -------------------------------------------------

const near = (a, b, within = 1e-6) => Math.abs(a - b) <= within;
const samePoint = (a, b, within = 1e-6) => near(a.x, b.x, within) && near(a.y, b.y, within) && near(a.z, b.z, within);

// The base was put down under a canvas that already opened on the hold, so a
// session that moves nothing has to open on exactly the frame it always did.
test('a session opens on the hold, to the unit', () => {
    for (const size of [DEFAULT_SIZE, 4000, 1000000]) {
        const hold  = canvasCamera(size);
        const moved = buildCameraPosition(createBuildCamera(size));

        assert.ok(samePoint(moved.position, hold.position), `${size}: ${JSON.stringify(moved.position)} is not the hold`);
        assert.ok(samePoint(moved.target, hold.target));
    }
});

test('the wheel zooms out no further than the hold, and in no nearer than the nearest', () => {
    const start = createBuildCamera(DEFAULT_SIZE);

    assert.equal(zoomBuildCamera(start, 100000).distance, start.furthest, 'out stops at the hold');
    assert.equal(zoomBuildCamera(start, -100000).distance, start.nearest, 'in stops at the nearest');
    assert.ok(start.nearest > 0 && start.nearest < start.furthest);

    const inward = zoomBuildCamera(start, -100);
    assert.ok(inward.distance < start.distance, 'up the page is in');
    assert.ok(zoomBuildCamera(inward, 100).distance > inward.distance, 'and down the page is out');
    assert.deepEqual(inward.target, start.target, 'and the target does not move');
});

test('a notch zooms by the same share of the view, near or far', () => {
    const start = createBuildCamera(DEFAULT_SIZE);
    const far   = zoomBuildCamera(start, -100);
    const close = { ...far, distance: far.distance / 8 };

    assert.ok(near(zoomBuildCamera(close, -100).distance / close.distance, far.distance / start.distance));
});

test('an orbit turns the view and holds it off both poles', () => {
    const start = createBuildCamera(DEFAULT_SIZE);

    assert.equal(orbitBuildCamera(start, 0, 100000).pitch, MAX_PITCH, 'never straight down');
    assert.equal(orbitBuildCamera(start, 0, -100000).pitch, MIN_PITCH, 'never flat');

    const turned = orbitBuildCamera(start, 200, 0);
    assert.notEqual(turned.yaw, start.yaw, 'across the screen turns it');
    assert.equal(turned.distance, start.distance, 'about the target, at the same distance');
    assert.deepEqual(turned.target, start.target);

    const { position } = buildCameraPosition(turned);
    assert.ok(near(Math.hypot(position.x, position.y, position.z), start.distance),
        'so the camera stays the distance from the target it was');
});

test('a pan slides the target and nothing else', () => {
    const start = createBuildCamera(DEFAULT_SIZE);
    const slid  = panBuildCamera(start, 40, 0, { viewHeight: 800, fov: 70 });

    assert.ok(slid.target.x < 0, 'a drag to the right moves the ground with it, so the target goes left');
    assert.equal(slid.distance, start.distance);
    assert.equal(slid.yaw, start.yaw);
    assert.equal(slid.pitch, start.pitch);

    const down = panBuildCamera(start, 0, 40, { viewHeight: 800, fov: 70 });
    assert.ok(down.target.z < 0, 'and a drag down the screen moves the target away into it');
});

test('the target pans to the edge of the canvas and no further', () => {
    const start = createBuildCamera(DEFAULT_SIZE);
    const half  = DEFAULT_SIZE / 2;

    for (const [dx, dy] of [[-1e7, 0], [1e7, 0], [0, -1e7], [0, 1e7]]) {
        const { target } = panBuildCamera(start, dx, dy, { viewHeight: 800, fov: 70 });
        assert.ok(Math.abs(target.x) <= half && Math.abs(target.z) <= half,
            `a pan of ${dx},${dy} left the canvas at ${target.x},${target.z}`);
    }

    let keyed = start;
    for (let frame = 0; frame < 1000; frame++) keyed = moveBuildCamera(keyed, { forward: 1, right: 1 }, MAX_MOVE_STEP);
    assert.ok(Math.abs(keyed.target.x) <= half && Math.abs(keyed.target.z) <= half, 'and the keys stop there too');
});

/**
 * A held key moves into the screen, whichever way the screen faces, and by
 * real time: the simulation's step is 0 for as long as the builder is open, so
 * a move handed that would never move at all.
 */
test('a key moves the way the view faces, at any yaw', () => {
    for (const yaw of [0, 37, 90, 180, -135, 300]) {
        const start = { ...createBuildCamera(DEFAULT_SIZE), yaw };
        const { position, target } = buildCameraPosition(start);
        const facing = { x: target.x - position.x, z: target.z - position.z };

        const moved = moveBuildCamera(start, { forward: 1 }, 0.05);
        const went  = { x: moved.target.x - start.target.x, z: moved.target.z - start.target.z };
        const along = (went.x * facing.x + went.z * facing.z) / Math.hypot(facing.x, facing.z);

        assert.ok(along > 0, `at a yaw of ${yaw} forward should go into the screen`);
        assert.ok(near(along, Math.hypot(went.x, went.z)), 'and straight into it');
    }
});

test('a key moves by the elapsed time it is handed, and not at all on none', () => {
    const start = createBuildCamera(DEFAULT_SIZE);
    const short = moveBuildCamera(start, { right: 1 }, 0.02);
    const long  = moveBuildCamera(start, { right: 1 }, 0.04);

    assert.ok(near(long.target.x, short.target.x * 2), 'twice the time is twice the move');
    assert.equal(moveBuildCamera(start, { right: 1 }, 0), start, 'a frozen step moves nothing');
    assert.equal(moveBuildCamera(start, {}, 0.05), start, 'and neither does a frame with no key held');

    const stalled = moveBuildCamera(start, { right: 1 }, 30);
    const capped  = moveBuildCamera(start, { right: 1 }, MAX_MOVE_STEP);
    assert.deepEqual(stalled.target, capped.target,
        'a frame that carries a hidden tab\'s time moves no further than one frame may');
});

test('Home gives the hold back exactly, from anywhere', () => {
    let state = createBuildCamera(DEFAULT_SIZE);
    const hold = buildCameraPosition(state);

    state = orbitBuildCamera(state, 300, 120);
    state = panBuildCamera(state, 500, -200, { viewHeight: 800, fov: 70 });
    state = zoomBuildCamera(state, -900);

    const back = buildCameraPosition(reframeBuildCamera(state));
    assert.ok(samePoint(back.position, hold.position) && samePoint(back.target, hold.target));
});

test('no gesture rewrites the state it was handed', () => {
    const start = createBuildCamera(DEFAULT_SIZE);
    const copy  = structuredClone(start);

    orbitBuildCamera(start, 10, 10);
    panBuildCamera(start, 10, 10, { viewHeight: 800, fov: 70 });
    zoomBuildCamera(start, 10);
    moveBuildCamera(start, { forward: 1 }, 0.05);
    reframeBuildCamera(start);

    assert.deepEqual(start, copy);
    assert.deepEqual(JSON.parse(JSON.stringify(start)), copy, 'and the state is plain numbers a panel can write');
});

/**
 * The furthest the camera stands is the hold, and the target can be panned to
 * a corner, so the corner opposite is the furthest anything on the canvas can
 * be. It has to be inside the far plane from there, at every turn of the view.
 */
test('the far plane reaches the opposite corner from anywhere the camera can be taken', () => {
    const far  = canvasFarPlane(DEFAULT_SIZE);
    const half = DEFAULT_SIZE / 2;
    const corners = [[half, half], [-half, half], [half, -half], [-half, -half]];

    for (const [tx, tz] of corners) {
        for (let yaw = 0; yaw < 360; yaw += 15) {
            for (const pitch of [MIN_PITCH, CANVAS_PITCH, MAX_PITCH]) {
                const state = { ...createBuildCamera(DEFAULT_SIZE), target: { x: tx, y: 0, z: tz }, yaw, pitch };
                const { position } = buildCameraPosition(state);

                for (const [x, z] of corners) {
                    const away = Math.hypot(position.x - x, position.y, position.z - z);
                    assert.ok(away < far, `from ${tx},${tz} at yaw ${yaw} the corner ${x},${z} is ${away}, past ${far}`);
                }
            }
        }
    }
});

test('the camera is kept clear of the ground under it', () => {
    assert.deepEqual(clearOfGround({ x: 1, y: 900, z: 2 }, 880), { x: 1, y: 880 + CAMERA_CLEARANCE, z: 2 });
    const high = { x: 1, y: 5000, z: 2 };
    assert.equal(clearOfGround(high, 880), high, 'and left where it is when it already is');
});

// --- Which press is which ----------------------------------------------------

test('in Select a left drag orbits and a middle drag pans', () => {
    assert.equal(cameraGesture({ button: 0 }, SELECT_TOOL), CAMERA_ORBIT);
    assert.equal(cameraGesture({ button: 1 }, SELECT_TOOL), CAMERA_PAN);
});

/**
 * Shift and the right button pans from inside any tool, which is how a drawing
 * tool reaches the view - and in Select too, for a trackpad with no middle
 * button.
 */
test('shift and the right button pans from any tool', () => {
    for (const tool of [SELECT_TOOL, 'grass', 'extrude']) {
        assert.equal(cameraGesture({ button: 2, shiftKey: true }, tool), CAMERA_PAN, `in ${tool}`);
    }
});

test('a press that drives nothing is left alone', () => {
    assert.equal(cameraGesture({ button: 2 }, SELECT_TOOL), null, 'the right button alone is kept for the selection');
    assert.equal(cameraGesture({ button: 0, shiftKey: true }, SELECT_TOOL), null, 'shift at a left press is the selection\'s');
    assert.equal(cameraGesture({ button: 0 }, 'grass'), null, 'and a drawing tool\'s left drag is its own');
    assert.equal(cameraGesture({ button: 1 }, 'grass'), null);
    assert.equal(cameraGesture({ button: 3 }, SELECT_TOOL), null);
});

test('every gesture in the table is one of the two the camera has', () => {
    for (const entry of CAMERA_GESTURES) assert.ok([CAMERA_ORBIT, CAMERA_PAN].includes(entry.gesture));
});

test('a wheel reported in lines or pages zooms as far as one reported in pixels', () => {
    assert.equal(wheelPixels(100, 0), 100);
    assert.equal(wheelPixels(3, 1), 48);
    assert.equal(wheelPixels(1, 2), 800);
    assert.equal(wheelPixels(undefined, 0), 0);
});

// --- Which key is which ------------------------------------------------------

test('opposite keys held together cancel, and the arrows and the letters agree', () => {
    assert.deepEqual(moveIntent(new Set(['KeyW'])), { forward: 1, right: 0 });
    assert.deepEqual(moveIntent(new Set(['ArrowUp', 'ArrowRight'])), { forward: 1, right: 1 });
    assert.deepEqual(moveIntent(new Set(['KeyW', 'ArrowDown'])), { forward: 0, right: 0 });
    assert.deepEqual(moveIntent(new Set(['KeyA'])), { forward: 0, right: -1 });
    assert.deepEqual(moveIntent(new Set()), { forward: 0, right: 0 });
    assert.deepEqual(moveIntent(undefined), { forward: 0, right: 0 });
});

/**
 * The move keys fly the aircraft too. The capture listener takes every menu
 * control key from the aircraft while the builder is showing, so moving the
 * view with one of these cannot also work a frozen aircraft's controls - which
 * only holds for as long as every one of them is a menu control key.
 */
test('every move key is one the menus already take from the aircraft', () => {
    for (const code of Object.values(BUILD_MOVE_KEYS).flat()) {
        assert.ok(isBuildMoveKey(code));
        assert.ok(isMenuControlKey(code), `${code} would reach the aircraft as well as the view`);
    }
    assert.equal(isBuildMoveKey('KeyQ'), false);
});

test('Home reframes, and is a key nothing in the flight reads', () => {
    assert.deepEqual(REFRAME_KEYS, ['Home']);
    assert.ok(isReframeKey('Home'));
    assert.equal(isReframeKey('End'), false);

    const flown = new Set([...Object.values(DEFAULT_KEYMAP).flat(), ...RESET_KEYS]);
    for (const code of REFRAME_KEYS) {
        assert.ok(!flown.has(code), `${code} already flies the aircraft`);
        assert.equal(isReservedKey(code), false, `${code} already does something in the game`);
    }
});
