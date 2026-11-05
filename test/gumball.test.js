/**
 * The gumball and its bindings - the two handle sets the artwork declares,
 * drawn at the placement's centre, and each handle writing one declared value
 * and nothing else, held to the bounds the panel holds it to.
 *
 * That the frame draws it through the camera, and that a press on a handle is
 * taken before an orbit, a pick or a drop, is wiring and is read off the
 * source in `page.test.js`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { getElement, ELEMENTS_BY_ID, DEFAULT_SIZE } from '../js/environment/elements.js';
import { bearingToDirection } from '../js/units.js';
import { draftHolderFor } from '../js/build-panel.js';
import { writeRowValue, rangeRows } from '../js/properties-panel.js';
import {
    GUMBALL_HANDLES, GUMBALL_AXES, GUMBALL_HEIGHTS, GUMBALL_FLAT, AXIS_COLOURS,
    gumballKind, gumballHandles, gumballHandle, handleBinding, boundHandles, gumballCentre,
    dragHandle, raiseSpan, scaleSpan, pressHandle, gumballLayout, gumballHit, alongAxis, sweepAround,
    GUMBALL_PIXELS, RAISE_PIXELS, SCALE_PIXELS, MIN_EXTENT
} from '../js/gumball.js';

const HEIGHT = getElement('mountain').ranges.height;
const RADIUS = getElement('mountain').ranges.radius;

/** A mountain as the builder drops one. */
function dropped(at = [400, -300], config = {}) {
    return { type: 'mountain', config: { count: 1, height: [300, 500], radius: [600, 900], at, ...config }, seed: 9 };
}

/** Ground cover drawn in a region. */
function patch(kind, extra = {}) {
    const shapes = {
        disc:    { kind: 'disc', x: 100, z: 200, radius: 500 },
        ellipse: { kind: 'ellipse', x: 100, z: 200, radiusX: 600, radiusZ: 300, angle: 0.5 },
        rect:    { kind: 'rect', x: 100, z: 200, width: 800, depth: 400, angle: 0.2, corner: 0 }
    };
    return { type: 'grass', config: {}, footprint: { ...shapes[kind], ...extra } };
}

const ids = handles => handles.map(handle => handle.id);

// --- The two sets the art declares --------------------------------------------

test('the art\'s handles are all here, under the ids it gives them', () => {
    assert.deepEqual(ids(GUMBALL_HANDLES).sort(), [
        'move', 'move-2', 'move-3', 'move-uniform',
        'rotate-blue', 'rotate-green', 'rotate-red',
        'scale-grassy', 'scale-grassy-2', 'scale-grassy-3',
        'scale-mount', 'scale-mount-2', 'scale-mount-3',
        'scale-x', 'scale-y', 'scale-z'
    ]);
    assert.ok(Object.isFrozen(GUMBALL_HANDLES) && GUMBALL_HANDLES.every(Object.isFrozen));
});

test('an element with a height has the Heights gumball, and every other the Flat one', () => {
    assert.equal(gumballKind('mountain'), GUMBALL_HEIGHTS);
    for (const type of ELEMENTS_BY_ID.keys()) {
        if (type === 'mountain') continue;
        assert.equal(gumballKind(type), GUMBALL_FLAT, `${type} lies on the ground`);
    }
    assert.equal(gumballKind('volcano'), null, 'and an element the registry does not hold has none');
});

test('the Flat gumball is the Heights one without the dot and the tick on each axis', () => {
    const heights = ids(gumballHandles(GUMBALL_HEIGHTS));
    const flat = ids(gumballHandles(GUMBALL_FLAT));
    assert.deepEqual(heights.filter(id => !id.startsWith('scale-grassy') && !id.startsWith('scale-mount')), flat);
    assert.ok(flat.includes('rotate-blue'), 'flat ground turns too: the Flat art carries the arcs');
});

/**
 * The art was drawn with blue up; the simulator has +Y up and north on +Z.
 * Translated once, from the one compass frame there is, so the gumball cannot
 * come to disagree with `js/units.js` about which way is east.
 */
test('the art\'s axes are the simulator\'s compass: red east, green north, blue up', () => {
    const east = bearingToDirection(90);
    const north = bearingToDirection(0);
    assert.deepEqual(GUMBALL_AXES.red, { x: Math.round(east.x), y: 0, z: 0 });
    assert.deepEqual(GUMBALL_AXES.green, { x: 0, y: 0, z: Math.round(north.z) });
    assert.deepEqual(GUMBALL_AXES.blue, { x: 0, y: 1, z: 0 });
    assert.deepEqual(AXIS_COLOURS, { red: '#fa2020', green: '#20fa20', blue: '#2020fa' }, 'in the art\'s own colours');
});

// --- What each handle is bound to ---------------------------------------------------

/**
 * The binding is where this stays maintainable: every handle drawn is bound to
 * something the placement actually owns, so no handle drags a value nothing
 * holds.
 */
test('every handle drawn on a dropped mountain writes something it owns', () => {
    const mountain = dropped();
    assert.deepEqual(ids(boundHandles(mountain)), [
        'move-uniform', 'move-3', 'move-2', 'move',
        'scale-grassy-3', 'scale-grassy-2', 'scale-grassy',
        'scale-mount-3', 'scale-mount-2', 'scale-mount'
    ], 'no squares and no arcs: it has no footprint, and its angle is no range it declares');

    for (const handle of boundHandles(mountain)) {
        const binding = handleBinding(handle, mountain);
        if (binding.from === 'config') assert.ok(getElement('mountain').ranges[binding.name], `${handle.id} writes a declared range`);
        else assert.equal(binding.from, 'point', `${handle.id} writes the point it was dropped on`);
    }
});

test('the dot spreads a mountain and the tick stands it, as the art\'s names say', () => {
    const mountain = dropped();
    for (const id of ['scale-grassy', 'scale-grassy-2', 'scale-grassy-3']) {
        assert.deepEqual(handleBinding(id, mountain), { from: 'config', name: 'radius', mode: 'scale' });
    }
    for (const id of ['scale-mount', 'scale-mount-2', 'scale-mount-3']) {
        assert.deepEqual(handleBinding(id, mountain), { from: 'config', name: 'height', mode: 'scale' });
    }
});

/** The one that floats a mountain if it is wrong. */
test('the vertical arrow raises a Heights element rather than lifting it off the ground', () => {
    const binding = handleBinding('move', dropped());
    assert.deepEqual(binding, { from: 'config', name: 'height', mode: 'raise' });

    const raised = dragHandle(dropped(), 'move', { along: 40 });
    assert.ok(!('at' in raised.config), 'nothing about where it stands moves');
    assert.ok(raised.config.height[0] > 300 && raised.config.height[1] > 500, 'it gets taller');

    assert.equal(handleBinding('move', patch('disc')), null, 'and on flat ground it has nothing to write, so it is not drawn');
});

test('the centre moves the element on both gumballs', () => {
    assert.deepEqual(handleBinding('move-uniform', dropped()), { from: 'point', name: 'at', mode: 'place' });
    assert.deepEqual(handleBinding('move-uniform', patch('disc')), { from: 'footprint', name: ['x', 'z'], mode: 'place' });

    assert.deepEqual(dragHandle(dropped([0, 0]), 'move-uniform', { ground: { dx: 120.4, dz: -80.6 } }).config.at, [120, -81]);
    const moved = dragHandle(patch('disc'), 'move-uniform', { ground: { dx: 50, dz: 25 } });
    assert.deepEqual([moved.footprint.x, moved.footprint.z], [150, 225]);
    assert.equal(moved.footprint.radius, 500, 'the region moves whole');
});

test('a ground arrow moves the element along its own axis and no other', () => {
    const east = dragHandle(dropped([0, 0]), 'move-3', { ground: { dx: -200, dz: 300 } });
    assert.deepEqual(east.config.at, [-200, 0], 'red is east, which is -X: the northward part of the drag is dropped');
    const north = dragHandle(dropped([0, 0]), 'move-2', { ground: { dx: -200, dz: 300 } });
    assert.deepEqual(north.config.at, [0, 300], 'green is north');
});

test('a point carried off the canvas comes back in at the far edge', () => {
    const half = DEFAULT_SIZE / 2;
    const moved = dragHandle(dropped([half - 100, 0]), 'move-uniform', { ground: { dx: 300, dz: 0 } }, { size: DEFAULT_SIZE });
    assert.deepEqual(moved.config.at, [-half + 200, 0]);
});

test('a footprint\'s squares stretch it along their axes, and the blue arc turns it', () => {
    assert.deepEqual(handleBinding('scale-x', patch('ellipse')), { from: 'footprint', name: 'radiusX', mode: 'scale' });
    assert.deepEqual(handleBinding('scale-y', patch('ellipse')), { from: 'footprint', name: 'radiusZ', mode: 'scale' });
    assert.deepEqual(handleBinding('scale-x', patch('rect')), { from: 'footprint', name: 'width', mode: 'scale' });
    assert.deepEqual(handleBinding('scale-y', patch('disc')), { from: 'footprint', name: 'radius', mode: 'scale' });
    assert.equal(handleBinding('scale-z', patch('ellipse')), null, 'a region has no height to stretch');

    assert.deepEqual(handleBinding('rotate-blue', patch('rect')), { from: 'footprint', name: 'angle', mode: 'turn' });
    assert.equal(handleBinding('rotate-blue', patch('disc')), null, 'a disc turned is the same disc');
    assert.equal(handleBinding('rotate-red', patch('rect')), null, 'and ground cannot be tipped on its side');

    const turned = dragHandle(patch('rect'), 'rotate-blue', { turn: 0.3 });
    assert.ok(Math.abs(turned.footprint.angle - 0.5) < 1e-12);
    const shrunk = dragHandle(patch('disc'), 'scale-x', { along: -10000 });
    assert.equal(shrunk.footprint.radius, MIN_EXTENT, 'and a region shrinks no smaller than a few units');
});

// --- Held to the panel's bounds --------------------------------------------------------

test('a raise moves the whole span and stops where an end meets its bound', () => {
    assert.deepEqual(raiseSpan([300, 500], 100, HEIGHT), [400, 600]);
    assert.deepEqual(raiseSpan([300, 500], 5000, HEIGHT), [HEIGHT.high - 200, HEIGHT.high], 'the gap is kept');
    assert.deepEqual(raiseSpan([300, 500], -5000, HEIGHT), [HEIGHT.low, HEIGHT.low + 200]);

    const pixels = RAISE_PIXELS / 2;
    const raised = dragHandle(dropped(), 'move', { along: pixels });
    const by = (HEIGHT.high - HEIGHT.low) / 2;
    assert.deepEqual(raised.config.height, raiseSpan([300, 500], by, HEIGHT), 'half the pixels raise it half its range');
});

test('a scale stretches both ends together and stops where either meets its bound', () => {
    assert.deepEqual(scaleSpan([300, 500], 2, HEIGHT), [600, 1000]);
    assert.deepEqual(scaleSpan([300, 500], 10, HEIGHT), [720, 1200], 'stopped where the top end meets 1200');
    assert.deepEqual(scaleSpan([300, 500], 0.01, HEIGHT), [HEIGHT.low, HEIGHT.low * 5 / 3].map(v => Number(v.toFixed(0))),
        'and where the bottom end meets the floor');

    const scaled = dragHandle(dropped(), 'scale-grassy', { along: SCALE_PIXELS * Math.log(2) });
    assert.deepEqual(scaled.config.radius, [1200, 1800]);
    assert.ok(!('height' in scaled.config), 'the dot writes the spread and nothing else');
});

/**
 * A drag and a typed number are two ways into one schema: whatever the drag
 * writes is a value the panel's row could have been typed to, and the row
 * writing it back changes nothing.
 */
test('what a drag writes is a value the panel itself would hold', () => {
    for (const along of [-900, -120, -7, 0, 33, 260, 4000]) {
        for (const handle of ['move', 'scale-mount', 'scale-grassy']) {
            const changes = dragHandle(dropped(), handle, { along });
            for (const [name, value] of Object.entries(changes.config)) {
                const range = getElement('mountain').ranges[name];
                assert.ok(value[0] >= range.low && value[1] <= range.high && value[0] <= value[1], `${handle} ${along}: ${value}`);

                const holder = draftHolderFor({ ...dropped(), config: { ...dropped().config, [name]: value } });
                for (const row of rangeRows(name, range)) writeRowValue(holder, name, row, value[row.at]);
                assert.deepEqual(holder.config[name], value, 'the panel holds it as it was dragged');
            }
        }
    }
});

test('shift and a scale handle stretch every scaled value at once, on both gumballs', () => {
    const both = dragHandle(dropped(), 'scale-mount-2', { along: SCALE_PIXELS * Math.log(1.5), uniform: true });
    assert.deepEqual(both.config.height, [450, 750]);
    assert.deepEqual(both.config.radius, [900, 1350]);

    const region = dragHandle(patch('ellipse'), 'scale-x', { along: SCALE_PIXELS * Math.log(2), uniform: true });
    assert.deepEqual([region.footprint.radiusX, region.footprint.radiusZ].map(Math.round), [1200, 600]);

    const one = dragHandle(patch('ellipse'), 'scale-x', { along: SCALE_PIXELS * Math.log(2) });
    assert.deepEqual([one.footprint.radiusX, one.footprint.radiusZ].map(Math.round), [1200, 300], 'without it, one axis');
});

test('a drag is worked out from the grab, so one brought back puts the element back', () => {
    const grabbed = dropped([10, 20]);
    for (const handle of ['move-uniform', 'move', 'scale-grassy', 'scale-mount-3']) {
        const back = dragHandle(grabbed, handle, { ground: { dx: 0, dz: 0 }, along: 0 });
        for (const [name, value] of Object.entries(back.config)) assert.deepEqual(value, grabbed.config[name], handle);
    }
});

test('ctrl and a press on the centre does nothing; shift is read at the press', () => {
    assert.equal(pressHandle('move-uniform', { ctrlKey: true }), null);
    assert.deepEqual(pressHandle('move-uniform', {}), { handle: 'move-uniform', uniform: false });
    assert.deepEqual(pressHandle('scale-mount', { shiftKey: true }), { handle: 'scale-mount', uniform: true });
    assert.deepEqual(pressHandle('move', { ctrlKey: true }), { handle: 'move', uniform: false }, 'ctrl means nothing anywhere else');
    assert.equal(pressHandle('nothing'), null);
});

test('a placement with nowhere to stand has no gumball', () => {
    const scattered = { type: 'mountain', config: { count: 4 } };
    assert.equal(gumballCentre(scattered), null, 'a whole-world scatter has no centre to draw a gumball at');
    const moving = ['move-uniform', 'move-2', 'move-3'];
    assert.ok(boundHandles(scattered).every(handle => !moving.includes(handle.id)), 'and nothing to move it by');
    assert.deepEqual(gumballCentre(dropped([5, 6])), { x: 5, z: 6 });
    assert.deepEqual(gumballCentre(patch('disc')), { x: 100, z: 200 });
    assert.deepEqual(boundHandles({ type: 'volcano', config: {} }), []);
});

// --- On the screen ------------------------------------------------------------------------

const AXES = { red: { x: -10, y: 0 }, green: { x: 0, y: 8 }, blue: { x: 0, y: -4 } };
const CENTRE = { x: 400, y: 300 };

test('the longest axis is drawn its full length and the others foreshortened with it', () => {
    const layout = gumballLayout(CENTRE, AXES, boundHandles(dropped()));
    const near = (a, b) => Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9;
    assert.ok(near(layout.axes.red, { x: -GUMBALL_PIXELS, y: 0 }));
    assert.ok(near(layout.axes.green, { x: 0, y: GUMBALL_PIXELS * 0.8 }));
    assert.ok(near(layout.axes.blue, { x: 0, y: -GUMBALL_PIXELS * 0.4 }));

    const arrow = layout.handles.find(handle => handle.id === 'move-3');
    assert.deepEqual(arrow.to, { x: CENTRE.x - GUMBALL_PIXELS, y: CENTRE.y }, 'the arrowhead at the end of its axis');
    const dot = layout.handles.find(handle => handle.id === 'scale-grassy-3');
    assert.deepEqual(dot.at, { x: CENTRE.x - GUMBALL_PIXELS / 4, y: CENTRE.y }, 'the dot a quarter of the way out, as the art has it');
    assert.equal(layout.handles.length, boundHandles(dropped()).length, 'and only the bound handles are laid out');
});

test('a press lands on the handle under it, the small ones before the shafts they sit on', () => {
    const layout = gumballLayout(CENTRE, AXES, boundHandles(dropped()));
    assert.equal(gumballHit(layout, CENTRE.x + 1, CENTRE.y - 1), 'move-uniform');
    assert.equal(gumballHit(layout, CENTRE.x - GUMBALL_PIXELS / 4, CENTRE.y + 2), 'scale-grassy-3', 'the dot, not the arrow under it');
    assert.equal(gumballHit(layout, CENTRE.x - GUMBALL_PIXELS * 0.56, CENTRE.y + 5), 'scale-mount-3', 'the tick, across the shaft');
    assert.equal(gumballHit(layout, CENTRE.x - GUMBALL_PIXELS * 0.85, CENTRE.y + 1), 'move-3', 'the shaft where nothing sits on it');
    assert.equal(gumballHit(layout, CENTRE.x + 60, CENTRE.y - 60), null, 'and off the gumball, nothing');
    assert.equal(gumballHit(null, 0, 0), null);
});

test('squares and arcs are laid out where the art draws them, and can be pressed', () => {
    const layout = gumballLayout(CENTRE, AXES, boundHandles(patch('ellipse')));
    const square = layout.handles.find(handle => handle.id === 'scale-x');
    assert.deepEqual(square.at, { x: CENTRE.x + GUMBALL_PIXELS, y: CENTRE.y }, 'at the far end of the dashed line, behind the centre');
    assert.equal(gumballHit(layout, square.at.x + 2, square.at.y), 'scale-x');

    const arc = layout.handles.find(handle => handle.id === 'rotate-blue');
    const middle = arc.points[6];
    assert.equal(gumballHit(layout, middle.x, middle.y), 'rotate-blue');
});

test('a drag is read along the handle\'s own axis as drawn, outward being more', () => {
    const layout = gumballLayout(CENTRE, AXES, boundHandles(patch('ellipse')));
    assert.equal(alongAxis(layout, 'move-3', { x: 0, y: 0 }, { x: -30, y: 7 }), 30, 'red runs left on this screen');
    assert.equal(alongAxis(layout, 'scale-x', { x: 0, y: 0 }, { x: 30, y: 0 }), 30, 'and its square sits on the right, so right is outward');
    assert.equal(alongAxis(layout, 'move-uniform', { x: 0, y: 0 }, { x: 30, y: 0 }), 0, 'the centre has no axis to read along');

    assert.ok(Math.abs(sweepAround(CENTRE, { x: 500, y: 300 }, { x: 400, y: 200 }) - Math.PI / 2) < 1e-12,
        'a sweep from right to up is a quarter turn anticlockwise');
    assert.ok(Math.abs(sweepAround(CENTRE, { x: 300, y: 301 }, { x: 300, y: 299 })) < 0.05, 'and crossing behind the centre does not jump a whole turn');
});
