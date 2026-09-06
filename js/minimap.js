/**
 * Minimap - where the aircraft is inside the world, and which way it is
 * pointing, drawn small in a corner of the screen. The projection from world
 * coordinates onto the face is pure and has no DOM or Three.js dependency, so
 * it can be unit tested in Node; the class at the bottom is the SVG face the
 * marker is drawn onto.
 *
 * The map is drawn north-up, the way a chart is read: the world's +Z axis is
 * north and runs up the face, +X is east and runs across it, and the marker
 * turns under a fixed card rather than the card turning under the marker.
 */

import { headingDegrees } from './units.js';

// The face is drawn in a viewBox this many units across, centred on the middle
// of the world, matching the viewBox in index.html.
export const MINIMAP_SIZE = 100;

/** The bounds a map falls back on when it has not been told the world's yet. */
export const DEFAULT_BOUNDS = { minX: -8000, maxX: 8000, minZ: -8000, maxZ: 8000 };

function clamp(value, low, high) {
    return Math.min(Math.max(value, low), high);
}

/**
 * A point in the world as a fraction of the way across the map, from 0 at the
 * west and south edges to 1 at the east and north ones.
 *
 * A position outside the world clamps to the edge it left through, so an
 * aircraft that has flown off the map is still shown at the edge it went out
 * over rather than drawn outside the face or dropped from it entirely. A world
 * with no width to it reads as the middle rather than dividing by zero.
 */
export function normalizePosition(bounds, x, z) {
    return {
        u: fraction(x, bounds.minX, bounds.maxX),
        v: fraction(z, bounds.minZ, bounds.maxZ)
    };
}

/**
 * Where a world position sits on the face, in the face's own units, measured
 * from its centre. North is up, so a position further north sits higher up the
 * face, which is a smaller y in the coordinates an SVG is drawn in.
 */
export function minimapPoint(bounds, x, z, size = MINIMAP_SIZE) {
    const { u, v } = normalizePosition(bounds, x, z);
    return { x: (u - 0.5) * size, y: (0.5 - v) * size };
}

/** True when the position is outside the world the map covers. */
export function isOffMap(bounds, x, z) {
    return x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ;
}

/**
 * A course of loops as the points it is drawn at on the face, in the order it
 * is flown, each carrying the gate it stands for and whether that gate lies
 * outside the square the map covers.
 *
 * A gate off the square is held at the edge it lies beyond rather than dropped,
 * which is the convention the chart already reads by: the aircraft marker is
 * held the same way, and an edge-pinned mark means "that way, past the end of
 * this square" wherever it appears. Dropping it would leave a course that
 * vanishes the moment the flight crosses onto the next tile, which is exactly
 * when a pilot most wants to know which way the course ran.
 */
export function coursePoints(bounds, rings = [], size = MINIMAP_SIZE) {
    return rings.map((ring, at) => ({
        ...minimapPoint(bounds, ring.x, ring.z, size),
        index: ring.index ?? at,
        offMap: isOffMap(bounds, ring.x, ring.z)
    }));
}

/**
 * The polyline a course is drawn as: every gate's point, in order, as the
 * `points` attribute an SVG reads. An empty course is an empty string, which
 * draws nothing.
 */
export function courseLine(points = []) {
    return points.map(point => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
}

/**
 * How a gate on the chart is drawn, from where the course has got to: the ones
 * already behind the aircraft, the one it is waiting on, and the ones still to
 * come. The same three readings the hoops themselves are coloured in, so the
 * chart and the world agree about which gate is next.
 */
export const GATE_STATES = ['flown', 'next', 'ahead'];

export function gateClass(at, next) {
    if (next < 0 || at < next) return 'flown';
    return at === next ? 'next' : 'ahead';
}

/**
 * How far the marker is turned on the face, in degrees clockwise from the top.
 * The marker is drawn pointing north, so this is the compass heading itself.
 */
export function minimapHeading(yaw) {
    return headingDegrees(yaw);
}

function fraction(value, low, high) {
    const span = high - low;
    if (!Number.isFinite(span) || span === 0) return 0.5;
    return clamp((value - low) / span, 0, 1);
}

// The namespace an SVG element has to be created in to be an SVG element: a
// gate drawn with the ordinary document call is a well-formed tag the browser
// renders as nothing at all.
const SVG_NS = 'http://www.w3.org/2000/svg';

// How big a gate is drawn on the face, in the face's own units.
export const GATE_RADIUS = 2;

export class Minimap {
    constructor(root, bounds = DEFAULT_BOUNDS) {
        this.root     = root;
        this.marker   = root.querySelector('#minimap-aircraft');
        this.bounds   = bounds;

        // The course being flown, drawn under the marker so the aircraft is
        // never hidden behind a gate. A free flight has no course, and the
        // group stays empty.
        this.course   = root.querySelector('#minimap-course');
        this.line     = root.querySelector('#minimap-course-line');
        this.rings    = [];
        this.gates    = [];
        this.next     = -1;
    }

    /**
     * Fits the map to the world being flown. Called whenever the environment
     * changes, so a map is never scaled to a world that is no longer there.
     *
     * The course is drawn again against the new square, because a chart fitted
     * to a different piece of ground puts the same gate somewhere else on the
     * face.
     */
    setBounds(bounds) {
        this.bounds = bounds ?? DEFAULT_BOUNDS;
        this.drawCourse();
        return this.bounds;
    }

    /**
     * Puts a course on the chart. Called the moment a stage is laid out rather
     * than as it is flown, so the whole of it is on screen before the pilot has
     * touched anything: the first gate is not the only one they have seen, and
     * which way the course runs is something to read rather than remember.
     *
     * A stage is a different course, not the same one somewhere else, so the
     * gates are built again rather than moved.
     */
    setCourse(rings = []) {
        this.rings = rings;
        this.next  = -1;

        for (const gate of this.gates) gate.remove();
        this.gates = rings.map(() => {
            const gate = document.createElementNS(SVG_NS, 'circle');
            gate.setAttribute('class', 'minimap-gate');
            gate.setAttribute('r', GATE_RADIUS);
            // Appended after the line, which the markup puts first, so a gate
            // sits on the course rather than under it.
            this.course?.appendChild(gate);
            return gate;
        });

        this.drawCourse();
        return this.gates.length;
    }

    /**
     * Marks the gate the course is waiting on, and everything either side of
     * it. Called whenever the run moves, the same moment the hoops themselves
     * are recoloured.
     */
    setNext(index) {
        this.next = index;
        this.gates.forEach((gate, at) => {
            const state = gateClass(at, index);
            for (const name of GATE_STATES) gate.classList.toggle(name, name === state);
        });
        return index;
    }

    /** Draws the course where the square the map now covers puts it. */
    drawCourse() {
        if (!this.course) return 0;

        const points = coursePoints(this.bounds, this.rings);

        this.line?.setAttribute('points', courseLine(points));
        points.forEach((point, at) => {
            const gate = this.gates[at];
            if (!gate) return;
            gate.setAttribute('cx', point.x.toFixed(2));
            gate.setAttribute('cy', point.y.toFixed(2));
            gate.classList.toggle('off-map', point.offMap);
        });

        this.setNext(this.next);
        return points.length;
    }

    /**
     * Moves the marker to where the aircraft is and turns it the way the nose
     * points. An aircraft outside the world holds the edge it left through and
     * says so, rather than quietly reading as though it were still inside.
     */
    update(position, yaw) {
        const point = minimapPoint(this.bounds, position.x, position.z);
        const angle = minimapHeading(yaw);

        this.marker.setAttribute(
            'transform',
            `translate(${point.x.toFixed(2)} ${point.y.toFixed(2)}) rotate(${angle})`
        );
        this.root.classList.toggle('off-map', isOffMap(this.bounds, position.x, position.z));
    }
}
