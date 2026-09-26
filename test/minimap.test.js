import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    MINIMAP_SIZE,
    DEFAULT_BOUNDS,
    Minimap,
    normalizePosition,
    minimapPoint,
    isOffMap,
    minimapHeading,
    coursePoints,
    courseLine,
    markClass
} from '../js/minimap.js';
import { headingToYaw } from '../js/units.js';

const BOUNDS = { minX: -8000, maxX: 8000, minZ: -8000, maxZ: 8000 };

test('the middle of the world is the middle of the map', () => {
    assert.deepEqual(normalizePosition(BOUNDS, 0, 0), { u: 0.5, v: 0.5 });
    assert.deepEqual(minimapPoint(BOUNDS, 0, 0), { x: 0, y: 0 });
});

// East is the world's -X, the frame `bearingToDirection` holds and the one the
// aircraft flies in, so the face runs the world's x axis right to left.
test('east is right and north is up, the way a chart is read', () => {
    assert.ok(minimapPoint(BOUNDS, -4000, 0).x > 0, 'east should be to the right');
    assert.ok(minimapPoint(BOUNDS, 4000, 0).x < 0, 'west should be to the left');
    assert.ok(minimapPoint(BOUNDS, 0, 4000).y < 0, 'north should be up the face');
    assert.ok(minimapPoint(BOUNDS, 0, -4000).y > 0, 'south should be down it');
});

/**
 * What being drawn right amounts to, and what the face was getting wrong: a
 * marker turned by the compass heading points along the track it is leaving.
 *
 * The chart is the only place the page shows a world position, so a face whose
 * marker and whose trace disagree is a face that cannot be read at all - and
 * it is the instrument the mirrored-bearing defect was measured with.
 */
test('the marker points along the track it leaves', () => {
    for (const degrees of [0, 37, 90, 152, 214, 300]) {
        const yaw = headingToYaw(degrees);

        // A step flown on that heading: a model built nose-first along +Z,
        // turned about +Y by the yaw, travels (sin yaw, cos yaw).
        const step = { x: Math.sin(yaw) * 100, z: Math.cos(yaw) * 100 };

        const before = minimapPoint(BOUNDS, 0, 0);
        const after  = minimapPoint(BOUNDS, step.x, step.z);
        const moved  = { x: after.x - before.x, y: after.y - before.y };

        // Where the marker points, in the face's own coordinates: it is drawn
        // pointing up the face and rotated clockwise by the heading, and SVG
        // counts y downward.
        const turn    = minimapHeading(yaw) * Math.PI / 180;
        const pointed = { x: Math.sin(turn), y: -Math.cos(turn) };

        const along = Math.hypot(moved.x, moved.y);
        const dot   = (moved.x * pointed.x + moved.y * pointed.y) / along;
        assert.ok(dot > 0.9999,
            `on ${degrees} the marker points ${(Math.acos(Math.min(1, dot)) * 180 / Math.PI).toFixed(1)}`
          + ' degrees off the track it draws');
    }
});

test('the corners of the world are the corners of the face', () => {
    const half = MINIMAP_SIZE / 2;
    assert.deepEqual(minimapPoint(BOUNDS, BOUNDS.minX, BOUNDS.maxZ), { x: half, y: -half });
    assert.deepEqual(minimapPoint(BOUNDS, BOUNDS.maxX, BOUNDS.minZ), { x: -half, y: half });
});

test('a position is placed in proportion to how far across the world it is', () => {
    const { u, v } = normalizePosition(BOUNDS, 4000, -4000);
    assert.equal(u, 0.75, 'three quarters of the way along the world x axis');
    assert.equal(v, 0.25, 'a quarter of the way north');
});

// The world has an edge, and an aircraft can be flown out over it. Holding the
// marker at the edge it left through is the honest reading: it says where the
// aircraft went out, rather than drawing it somewhere it is not.
test('an aircraft outside the world holds the edge it left through', () => {
    const half = MINIMAP_SIZE / 2;
    assert.deepEqual(minimapPoint(BOUNDS, 99999, 0), { x: -half, y: 0 });
    assert.deepEqual(minimapPoint(BOUNDS, 0, -99999), { x: 0, y: half });
});

test('being outside the world is something the map says out loud', () => {
    assert.equal(isOffMap(BOUNDS, 0, 0), false);
    assert.equal(isOffMap(BOUNDS, BOUNDS.maxX, BOUNDS.maxZ), false, 'the edge itself is still inside');
    assert.equal(isOffMap(BOUNDS, BOUNDS.maxX + 1, 0), true);
    assert.equal(isOffMap(BOUNDS, 0, BOUNDS.minZ - 1), true);
});

test('a world with no width to it reads as the middle rather than dividing by zero', () => {
    const flat = { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
    assert.deepEqual(normalizePosition(flat, 500, -500), { u: 0.5, v: 0.5 });
    assert.deepEqual(minimapPoint(flat, 500, -500), { x: 0, y: 0 });
});

// The marker is drawn pointing north, so the angle it is turned by is the
// compass heading itself and the map needs no second convention for it.
test('the marker is turned to the heading the compass reads', () => {
    for (const degrees of [0, 45, 90, 180, 270, 359]) {
        assert.equal(minimapHeading(headingToYaw(degrees)), degrees);
    }
});

// Enough of an SVG face for the marker to be placed on, with no browser to
// place it in: elements that remember what was set on them.
function fakeFace() {
    const marker = { attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } };
    const classes = new Set();

    return {
        marker,
        classes,
        querySelector: () => marker,
        classList: { toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)) }
    };
}

test('the map draws the aircraft where it is and turns it the way it points', () => {
    const face = fakeFace();
    const map  = new Minimap(face, BOUNDS);

    map.update({ x: 4000, y: 500, z: 4000 }, headingToYaw(90));
    assert.equal(face.marker.attributes.transform, 'translate(-25.00 -25.00) rotate(90)');
    assert.equal(face.classes.has('off-map'), false);
});

test('the map says so when the aircraft it is drawing has left the world', () => {
    const face = fakeFace();
    const map  = new Minimap(face, BOUNDS);

    map.update({ x: 99999, y: 500, z: 0 }, 0);
    assert.equal(face.classes.has('off-map'), true);

    map.update({ x: 0, y: 500, z: 0 }, 0);
    assert.equal(face.classes.has('off-map'), false, 'and stops saying it on the way back in');
});

test('the map is refitted to whatever world is being flown', () => {
    const face = fakeFace();
    const map  = new Minimap(face);
    assert.deepEqual(map.bounds, DEFAULT_BOUNDS, 'a map with no world yet still has a scale');

    const smaller = { minX: -100, maxX: 100, minZ: -100, maxZ: 100 };
    assert.deepEqual(map.setBounds(smaller), smaller);

    map.update({ x: 100, y: 0, z: 0 }, 0);
    assert.equal(face.classes.has('off-map'), false, 'the edge of the new world is inside it');
    assert.deepEqual(map.setBounds(null), DEFAULT_BOUNDS, 'and no world at all falls back rather than throwing');
});

// --- The course on the chart ----------------------------------------------

const COURSE = [
    { index: 0, x: 0,     z: 0 },
    { index: 1, x: 4000,  z: 4000 },
    { index: 2, x: -4000, z: -4000 }
];

test('a course is drawn where the chart puts each of its gates', () => {
    const points = coursePoints(BOUNDS, COURSE);

    assert.equal(points.length, COURSE.length);
    assert.deepEqual(points.map(point => point.index), [0, 1, 2]);
    assert.deepEqual(points[0], { x: 0, y: 0, index: 0, offMap: false });
    assert.ok(points[1].x < 0 && points[1].y < 0, 'north west is up and to the left');
    assert.ok(points[2].x > 0 && points[2].y > 0, 'south east is down and to the right');
});

// A gate off the square is held at the edge it lies beyond, the way the
// aircraft marker is: dropping it would leave the course vanishing exactly
// when the pilot most wants to know which way it ran.
test('a gate past the edge of the chart is held at that edge and says so', () => {
    const point = coursePoints(BOUNDS, [{ index: 0, x: 40000, z: 0 }])[0];

    assert.equal(point.x, -MINIMAP_SIZE / 2, 'held at the edge it lies beyond');
    assert.equal(point.offMap, true);
    assert.equal(coursePoints(BOUNDS, COURSE).every(gate => !gate.offMap), true);
});

test('a gate that never carried its number is numbered by where it sits', () => {
    const points = coursePoints(BOUNDS, [{ x: 0, z: 0 }, { x: 100, z: 100 }]);
    assert.deepEqual(points.map(point => point.index), [0, 1]);
});

test('a course is one line through its gates, in the order they are flown', () => {
    assert.equal(courseLine(coursePoints(BOUNDS, COURSE)), '0.00,0.00 -25.00,-25.00 25.00,25.00');
    assert.equal(courseLine([]), '', 'and a course with no gates draws nothing');
});

// The chart and the world should not disagree about which mark is next. The
// three readings here are the three the hoops themselves are coloured in;
// js/rings.js imports Three.js, so that the two agree about the colours is
// checked against its source in test/page.test.js rather than here.
test('a mark is drawn from how far the course has got, in three readings', () => {
    assert.deepEqual([0, 1, 2].map(at => markClass(at, 1)), ['flown', 'next', 'ahead']);
    assert.deepEqual([0, 1, 2].map(at => markClass(at, -1)), ['flown', 'flown', 'flown'],
        'a course with nothing left to fly is drawn entirely as flown');
    assert.equal(markClass(0, 0), 'next');
});

// --- The chart the course is drawn onto ------------------------------------

// Enough of a document for the chart to draw into, with no browser to draw it
// in. The marks are SVG circles, which have to be made in the SVG namespace to
// be circles at all rather than well-formed tags rendering as nothing.
function fakeChart() {
    const element = (id = '') => ({
        id,
        namespace: null,
        children: [],
        attributes: {},
        classes: new Set(),
        parent: null,
        setAttribute(name, value) { this.attributes[name] = String(value); },
        getAttribute(name) { return this.attributes[name] ?? null; },
        appendChild(child) { child.parent = this; this.children.push(child); return child; },
        remove() {
            const at = this.parent?.children.indexOf(this) ?? -1;
            if (at >= 0) this.parent.children.splice(at, 1);
            this.parent = null;
        },
        classList: {
            toggle(name, on) { on ? this.owner.classes.add(name) : this.owner.classes.delete(name); }
        }
    });

    const own = (made) => { made.classList.owner = made; return made; };
    const parts = new Map(
        ['minimap-aircraft', 'minimap-course', 'minimap-course-line']
            .map(id => [`#${id}`, own(element(id))])
    );

    globalThis.document = {
        createElementNS: (namespace) => {
            const made = own(element());
            made.namespace = namespace;
            return made;
        }
    };

    const root = own(element('minimap'));
    root.querySelector = (selector) => parts.get(selector) ?? null;
    root.parts = parts;

    return root;
}

test('a course is laid on the chart as a mark for every leg of it', () => {
    const root = fakeChart();
    const map = new Minimap(root, BOUNDS);

    assert.equal(map.setCourse(COURSE), 3);

    const course = root.parts.get('#minimap-course');
    assert.equal(course.children.length, 3);
    assert.ok(course.children.every(mark => mark.namespace === 'http://www.w3.org/2000/svg'),
        'a mark made outside the SVG namespace is a tag that draws nothing');
    assert.deepEqual(course.children.map(mark => mark.getAttribute('cx')), ['0.00', '-25.00', '25.00']);
    assert.equal(root.parts.get('#minimap-course-line').getAttribute('points'),
        courseLine(coursePoints(BOUNDS, COURSE)));
});

// A stage is a different course, not the same one somewhere else, so the marks
// are built again rather than moved - and the last stage's are taken down.
test('a second course replaces the first rather than joining it', () => {
    const root = fakeChart();
    const map = new Minimap(root, BOUNDS);

    map.setCourse(COURSE);
    map.setCourse([{ index: 0, x: 0, z: 0 }]);

    assert.equal(root.parts.get('#minimap-course').children.length, 1);
    assert.equal(map.setCourse([]), 0, 'and a free flight leaves the chart clear');
    assert.equal(root.parts.get('#minimap-course').children.length, 0);
});

test('the mark the course is waiting on is lit, on the chart as in the world', () => {
    const root = fakeChart();
    const map = new Minimap(root, BOUNDS);

    map.setCourse(COURSE);
    map.setNext(1);

    const marks = root.parts.get('#minimap-course').children;
    assert.deepEqual(marks.map(mark => [...mark.classes].filter(name => name !== 'minimap-mark')),
        [['flown'], ['next'], ['ahead']]);
});

// The chart is fitted to the tile being flown over, so crossing onto the next
// one puts every gate somewhere else on the face.
test('a chart fitted to new ground draws the course against that ground', () => {
    const root = fakeChart();
    const map = new Minimap(root, BOUNDS);

    map.setCourse(COURSE);
    map.setNext(1);
    map.setBounds({ minX: 8000, maxX: 24000, minZ: 8000, maxZ: 24000 });

    const gates = root.parts.get('#minimap-course').children;
    assert.ok(gates.every(gate => gate.classes.has('off-map')),
        'the whole course is behind the aircraft now');
    assert.ok(gates.some(gate => gate.classes.has('next')),
        'and the gate being waited on is still marked as the one being waited on');
});

// --- The seam between the run and the chart --------------------------------

/**
 * Everything above is the chart drawing what it is handed. What it is handed is
 * decided in `js/main.js`, which imports three and cannot be loaded here, so
 * the seam is read out of the source the way `test/landing-score.test.js` reads
 * the landing.
 *
 * It is worth reading because it has already been wrong. The chart was handed
 * the loop course and an empty array for everything else, so of the three modes
 * that write the objective card's pointer row only one was drawn for - and a
 * screen under 746 pixels of height takes that row off and gives the chart as
 * the reason. A route and a search lost their bearing altogether, with the whole
 * suite green, because nothing in Node can see which array crosses that call.
 *
 * Each span is bounded to the call it is anchored on rather than running to the
 * end of the file, for the reason the hold test in `test/input-map.test.js`
 * gives: an unbounded span matches the same text written a second time anywhere
 * below, and passes a call that no longer makes it.
 */
const mainSource = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');

test('the chart is handed what the run is flying to, whatever kind of run it is', () => {
    assert.ok(/this\.hud\.setCourse\([^;]*?chartCourse\(this\.run,/.test(mainSource),
        'js/main.js should hand the chart the run\'s own marks rather than only a loop course');
    assert.ok(/chartCourse\(this\.run,[^;]*?runways:\s*this\.runways/.test(mainSource),
        'and hand over the strips, which is the only place a route\'s marks can come from');
    assert.ok(/chartCourse\(this\.run,[^;]*?course:\s*this\.course/.test(mainSource),
        'and the gates, so a loop course is drawn as it always was');
});

test('the chart lights the mark the run is waiting on, and the hoops their gate', () => {
    const method = mainSource.match(/^ {4}syncObjective\(\)\s*\{([\s\S]*?)^ {4}\}/m);
    assert.ok(method, 'js/main.js should still write the objective card in one place');

    const [body] = [method[1]];
    assert.ok(/this\.hud\.setNextMark\(chartNext\(this\.run\)\)/.test(body),
        'the chart is lit from what the run is waiting on, which is not always a gate');
    assert.ok(!/setNextMark\(nextGate\(/.test(body),
        'a route and a search count legs and markers, and nextGate answers -1 for both');
    assert.ok(/this\.loops\.setNext\(nextGate\(this\.run\)\)/.test(body),
        'while the hoops in the world are still lit by the gate a course is up to');
});
