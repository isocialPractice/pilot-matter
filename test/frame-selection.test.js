import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createBuildCamera, frameBuildCamera, reframeBuildCamera, isFrameKey, isReframeKey,
    isBuildMoveKey, buildCameraPosition, orbitBuildCamera, panBuildCamera,
    FRAME_KEYS, REFRAME_KEYS, BUILD_MOVE_KEYS, CANVAS_PITCH, CANVAS_STANDOFF
} from '../js/build-camera.js';
import { placementBounds, placementsBounds, framedBounds } from '../js/build-select.js';
import { footprintBounds } from '../js/environment/footprints.js';
import { canvasPickBounds } from '../js/build-picking.js';
import { placeObject } from '../js/objects.js';
import { prefabsIn } from '../js/prefabs.js';
import { placeTemplate, offeredTemplates } from '../js/templates.js';
import { DEFAULT_KEYMAP, RESET_KEYS, LEVEL_OFF_KEYS } from '../js/input-map.js';
import { isReservedKey } from '../js/reserved-keys.js';
import { CANVAS_LEAVE_KEYS } from '../js/build-mode.js';
import { SETTINGS_OPEN_KEYS } from '../js/settings.js';
import { HELP_KEY } from '../js/controls-help.js';
import { UNDO_COMBOS, REDO_COMBOS } from '../js/build-history.js';

const SIZE = 16000;
const PREFAB = prefabsIn('residential')[0].id;

// --- The key -------------------------------------------------------------------------

test('F is the key, and it is not any of the others a canvas reads', () => {
    assert.deepEqual(FRAME_KEYS, ['KeyF']);
    assert.equal(isFrameKey('KeyF'), true);
    assert.equal(isFrameKey('KeyG'), false);

    const canvas = new Set([
        ...REFRAME_KEYS, ...CANVAS_LEAVE_KEYS, ...SETTINGS_OPEN_KEYS, HELP_KEY,
        ...Object.values(BUILD_MOVE_KEYS).flat(),
        ...UNDO_COMBOS.map(combo => combo.code), ...REDO_COMBOS.map(combo => combo.code)
    ]);
    for (const code of FRAME_KEYS) assert.equal(canvas.has(code), false, `${code} already means something on a canvas`);
    assert.equal(isReframeKey('KeyF'), false);
    assert.equal(isBuildMoveKey('KeyF'), false);
});

/**
 * The builder reads its keys only while it is open and the flight is not being
 * flown behind it, so a canvas's key is free to be a key the map binds - which
 * is why `W/A/S/D` move the view here and fly the aircraft there. What `F` must
 * not be is a key the game reads for itself, since those are read whatever is
 * open.
 */
test('F is nothing the game reads for itself, and nothing the key map ships bound', () => {
    assert.equal(isReservedKey('KeyF'), false);
    const flight = [...Object.values(DEFAULT_KEYMAP).flat(), ...RESET_KEYS, ...LEVEL_OFF_KEYS];
    assert.equal(flight.includes('KeyF'), false, 'so a first flight has no conflict to resolve');
});

// --- What a placement covers -----------------------------------------------------------

/**
 * `footprintBounds` is the square the tiling already reads off a region, and it
 * is deliberately a little generous: a turned rectangle is squared off by its
 * own half-diagonal, so one square serves it at every angle. That is right for
 * framing too - a view a little wider than the thing is a view of the thing.
 */
test('a footprint\'s own square is what it covers', () => {
    const footprint = { kind: 'rect', x: 400, z: -200, width: 1000, depth: 600, angle: 0, corner: 0, feather: 0 };
    const box = placementBounds({ type: 'grass', config: {}, footprint }, SIZE);

    assert.deepEqual(box, footprintBounds(footprint), 'the square the tiling reads, and not a second reading of it');
    assert.ok(box.minX <= -100 && box.maxX >= 900, 'it covers the rectangle across');
    assert.ok(box.minZ <= -500 && box.maxZ >= 100, 'and along');
    assert.deepEqual([(box.minX + box.maxX) / 2, (box.minZ + box.maxZ) / 2], [400, -200], 'round its middle');
});

test('a mountain dropped at a point covers the ellipse its peak is drawn on', () => {
    const mountain = { type: 'mountain', config: { count: 1, at: [1000, -1000], radius: [1500, 1500] }, seed: 7 };
    const box = placementBounds(mountain, SIZE);

    assert.ok(box != null, 'a peak is worked out again from its own stream');
    assert.ok(box.minX < 1000 && box.maxX > 1000, 'round the point it was dropped on');
    assert.ok(box.minZ < -1000 && box.maxZ > -1000);
    assert.ok(box.maxX - box.minX >= 3000, 'and at least as wide as its radius either way');
});

/**
 * A girthed peak is drawn on an ellipse rather than on a circle, so the square
 * round it has to carry the stretch. A mutation run on 11.20.2026 is what put
 * this test here: squaring a peak off by its radius alone passed everything.
 */
test('a peak drawn on an ellipse is squared off by the stretch, not by its radius', () => {
    const round    = { type: 'mountain', config: { count: 1, at: [0, 0], radius: [1500, 1500] }, seed: 7 };
    const stretched = { ...round, config: { ...round.config, girth: 1, girthRange: [0.2, 0.9] } };

    const circle = placementBounds(round, SIZE);
    const ellipse = placementBounds(stretched, SIZE);
    assert.equal(circle.maxX - circle.minX, 3000, 'a round peak is its radius either way');
    assert.ok(ellipse.maxX - ellipse.minX > 4000,
        `a stretched one reaches further (${Math.round(ellipse.maxX - ellipse.minX)})`);
});

test('a clip narrows what a placement covers, since it is only there where it stands', () => {
    const footprint = { kind: 'disc', x: 0, z: 0, radius: 2000, feather: 0 };
    const plain = { type: 'grass', config: {}, footprint };
    const clipped = { ...plain, clip: { kind: 'rect', x: 1000, z: 0, width: 1000, depth: 1000, angle: 0, corner: 0, feather: 0 } };

    const whole = placementBounds(plain, SIZE);
    const part = placementBounds(clipped, SIZE);
    assert.ok(part.minX > whole.minX && part.maxX < whole.maxX, 'narrower than the region on its own');
    assert.ok(part.minZ > whole.minZ && part.maxZ < whole.maxZ);
    assert.deepEqual(part, footprintBounds(clipped.clip), 'the clip is the smaller of the two here, so it is the answer');
});

test('a clip that leaves nothing covers nothing, which is what its reach says of it too', () => {
    const clipped = {
        type: 'grass', config: {},
        footprint: { kind: 'disc', x: 0, z: 0, radius: 500, feather: 0 },
        clip: { kind: 'disc', x: 9000, z: 9000, radius: 500, feather: 0 }
    };
    assert.equal(placementBounds(clipped, SIZE), null);
});

test('an object covers the box round the building it stands for', () => {
    const object = placeObject(PREFAB, [600, 600]);
    const box = placementBounds(object, SIZE);
    assert.ok(box.minX < 600 && box.maxX > 600);
    assert.ok(box.maxX - box.minX < 100, 'a cottage is a cottage, not a region');
});

test('a placed template covers every strip and lot it stands for', () => {
    const template = offeredTemplates()[0];
    const group = placeTemplate(template.id, [0, 0], { heading: 90 });
    const box = placementBounds(group, SIZE);
    assert.ok(box != null && box.maxX - box.minX > 1000, 'a runway is a long thing');
});

test('a whole-world element covers nothing in particular, and neither does anything that is not a placement', () => {
    assert.equal(placementBounds({ type: 'sea', config: { level: 100 } }, SIZE), null);
    assert.equal(placementBounds({ type: 'castle', config: {} }, SIZE), null);
    assert.equal(placementBounds(null, SIZE), null);
});

test('a list covers every square in it together, and nothing for a list with none', () => {
    const near = { type: 'grass', config: {}, footprint: { kind: 'disc', x: 0, z: 0, radius: 500, feather: 0 } };
    const far  = { type: 'grass', config: {}, footprint: { kind: 'disc', x: 4000, z: -3000, radius: 500, feather: 0 } };

    assert.deepEqual(placementsBounds([near, far], SIZE), { minX: -500, maxX: 4500, minZ: -3500, maxZ: 500 });
    assert.equal(placementsBounds([], SIZE), null);
    assert.equal(placementsBounds([{ type: 'sea', config: {} }], SIZE), null);
});

// --- What F frames ---------------------------------------------------------------------

test('the pick is framed first, then the selection, then everything built, then the canvas', () => {
    const picked = { type: 'grass', config: {}, footprint: { kind: 'disc', x: 1000, z: 0, radius: 400, feather: 0 } };
    const selection = { kind: 'disc', x: -2000, z: 0, radius: 900, feather: 0 };
    const built = { type: 'grass', config: {}, footprint: { kind: 'disc', x: 5000, z: 0, radius: 300, feather: 0 } };

    assert.deepEqual(framedBounds({ picked, selection, placements: [built], size: SIZE }),
        placementBounds(picked, SIZE), 'a pick is the most particular answer there is');
    assert.deepEqual(framedBounds({ selection, placements: [built], size: SIZE }),
        { minX: -2900, maxX: -1100, minZ: -900, maxZ: 900 }, 'then the region the lasso drew');
    assert.deepEqual(framedBounds({ placements: [built], size: SIZE }),
        placementBounds(built, SIZE), 'then the work');
    assert.deepEqual(framedBounds({ size: SIZE }), canvasPickBounds(SIZE),
        'and an empty canvas is always something to look at');
});

test('a pick that covers nothing falls through to the next answer rather than framing nothing', () => {
    const selection = { kind: 'disc', x: -2000, z: 0, radius: 900, feather: 0 };
    const framed = framedBounds({ picked: { type: 'sea', config: {} }, selection, size: SIZE });
    assert.deepEqual(framed, { minX: -2900, maxX: -1100, minZ: -900, maxZ: 900 });
});

test('a selection that is not a region is not framed', () => {
    assert.deepEqual(framedBounds({ selection: { kind: 'blob' }, size: SIZE }), canvasPickBounds(SIZE));
});

// --- Where the camera lands -------------------------------------------------------------

test('framing turns the view onto the middle of what is framed and stands back to see across it', () => {
    const camera = createBuildCamera(SIZE);
    const framed = frameBuildCamera(camera, { minX: 1000, maxX: 3000, minZ: -1000, maxZ: 1000 });

    assert.deepEqual(framed.target, { x: 2000, y: 0, z: 0 }, 'the middle of the square, at ground level');
    assert.equal(framed.distance, 2000 * CANVAS_STANDOFF, 'the hold\'s own standoff, read at the square\'s size');
});

/**
 * This is what makes `F` different from `Home`: the pilot has arranged a view
 * they can work in, and framing something in it does not take that away.
 */
test('framing keeps the angles the pilot left, where the hold puts its own back', () => {
    const turned = orbitBuildCamera(createBuildCamera(SIZE), 300, 60);
    const framed = frameBuildCamera(turned, { minX: 0, maxX: 2000, minZ: 0, maxZ: 2000 });

    assert.equal(framed.yaw, turned.yaw);
    assert.equal(framed.pitch, turned.pitch);
    assert.notEqual(turned.yaw, 0, 'the view really had been turned');

    const held = reframeBuildCamera(turned);
    assert.equal(held.yaw, 0, 'and Home is the one that squares it up again');
    assert.equal(held.pitch, CANVAS_PITCH);
});

test('framing comes no nearer than the view does, and stands back no further than the hold', () => {
    const camera = createBuildCamera(SIZE);

    const tiny = frameBuildCamera(camera, { minX: -5, maxX: 5, minZ: -5, maxZ: 5 });
    assert.equal(tiny.distance, camera.nearest, 'one cottage is still a view of ground');

    const whole = frameBuildCamera(camera, canvasPickBounds(SIZE));
    assert.equal(whole.distance, camera.furthest, 'and the whole canvas is the hold\'s own distance');
});

test('framing holds the target over the canvas, as every other way of moving it does', () => {
    const camera = createBuildCamera(SIZE);
    const framed = frameBuildCamera(camera, { minX: SIZE, maxX: SIZE + 1000, minZ: 0, maxZ: 1000 });
    assert.ok(Math.abs(framed.target.x) <= camera.reach);
    assert.ok(Math.abs(framed.target.z) <= camera.reach);
});

test('nothing to frame leaves the view exactly as it is', () => {
    const camera = panBuildCamera(createBuildCamera(SIZE), 120, 80, { viewHeight: 800 });
    assert.equal(frameBuildCamera(camera, null), camera);
    assert.deepEqual(frameBuildCamera(camera, { minX: NaN, maxX: 1, minZ: 0, maxZ: 1 }), camera);
});

test('the camera stands where the framed view says, so the frame really is drawn from there', () => {
    const framed = frameBuildCamera(createBuildCamera(SIZE), { minX: 1000, maxX: 3000, minZ: -1000, maxZ: 1000 });
    const { position, target } = buildCameraPosition(framed);
    assert.deepEqual(target, { x: 2000, y: 0, z: 0 });
    assert.ok(position.y > 0, 'above the ground it is looking at');
    assert.ok(Math.hypot(position.x - target.x, position.y - target.y, position.z - target.z) - framed.distance < 1e-6);
});
