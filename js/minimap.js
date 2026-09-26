/**
 * Minimap - where the aircraft is inside the world, and which way it is
 * pointing, drawn small in a corner of the screen. The projection from world
 * coordinates onto the face is pure and has no DOM or Three.js dependency, so
 * it can be unit tested in Node; the class at the bottom is the SVG face the
 * marker is drawn onto.
 *
 * The map is drawn north-up, the way a chart is read: north runs up the face
 * and east across it, and the marker turns under a fixed card rather than the
 * card turning under the marker.
 *
 * North is the world's +Z axis and east is its -X, which is the frame
 * `bearingToDirection` in `js/units.js` holds and the one the aircraft
 * actually flies in. So the face runs the world's x axis right to left. That
 * looks like a mirror written down and is the opposite: a marker turned by the
 * compass heading has to point along the track it is leaving, and it only does
 * that if east is the side of the face the aircraft moves toward on 090.
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
 * low x and z edges to 1 at the high ones. Which compass edge each of those is
 * belongs to `minimapPoint`, which is where the face's own axes are decided.
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
 * face, which is a smaller y in the coordinates an SVG is drawn in. East is
 * right, and east is -X, so a position further along the world's x axis sits
 * further left.
 */
export function minimapPoint(bounds, x, z, size = MINIMAP_SIZE) {
    const { u, v } = normalizePosition(bounds, x, z);
    return { x: (0.5 - u) * size, y: (0.5 - v) * size };
}

/** True when the position is outside the world the map covers. */
export function isOffMap(bounds, x, z) {
    return x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ;
}

/**
 * A course as the points it is drawn at on the face, in the order it is flown,
 * each carrying the number the run counts it by and whether it lies outside the
 * square the map covers.
 *
 * What a course is made of depends on the mode - the gates of a loop course,
 * the strips of a route, the one marker of a search - and none of that reaches
 * here. A mark is a place in the world with a number on it, which is all the
 * chart needs to draw one.
 *
 * A mark off the square is held at the edge it lies beyond rather than dropped,
 * which is the convention the chart already reads by: the aircraft marker is
 * held the same way, and an edge-pinned mark means "that way, past the end of
 * this square" wherever it appears. Dropping it would leave a course that
 * vanishes the moment the flight crosses onto the next tile, which is exactly
 * when a pilot most wants to know which way the course ran - and for a route or
 * a search, whose objective is usually miles off the square, it would drop the
 * only mark there is.
 */
export function coursePoints(bounds, course = [], size = MINIMAP_SIZE) {
    return course.map((mark, at) => ({
        ...minimapPoint(bounds, mark.x, mark.z, size),
        index: mark.index ?? at,
        offMap: isOffMap(bounds, mark.x, mark.z)
    }));
}

/**
 * The polyline a course is drawn as: every mark's point, in order, as the
 * `points` attribute an SVG reads. An empty course is an empty string, which
 * draws nothing, and so does a course of one mark - a search has nowhere to
 * draw a line to.
 */
export function courseLine(points = []) {
    return points.map(point => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
}

/**
 * How a mark on the chart is drawn, from where the course has got to: the ones
 * already behind the aircraft, the one it is waiting on, and the ones still to
 * come. The same three readings the hoops themselves are coloured in, so the
 * chart and the world agree about which gate is next - and a route's strips and
 * a search's marker are read off the same three, so the chart says the same
 * thing about an objective whatever kind of objective it is.
 */
export const MARK_STATES = ['flown', 'next', 'ahead'];

export function markClass(at, next) {
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
// mark drawn with the ordinary document call is a well-formed tag the browser
// renders as nothing at all.
const SVG_NS = 'http://www.w3.org/2000/svg';

// How big a mark is drawn on the face, in the face's own units.
export const MARK_RADIUS = 2;

export class Minimap {
    constructor(root, bounds = DEFAULT_BOUNDS) {
        this.root     = root;
        this.marker   = root.querySelector('#minimap-aircraft');
        this.bounds   = bounds;

        // The course being flown, drawn under the marker so the aircraft is
        // never hidden behind a mark. A free flight has no course, and the
        // group stays empty.
        this.group    = root.querySelector('#minimap-course');
        this.line     = root.querySelector('#minimap-course-line');
        this.course   = [];
        this.marks    = [];
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
     * touched anything: the first mark is not the only one they have seen, and
     * which way the course runs is something to read rather than remember.
     *
     * A stage is a different course, not the same one somewhere else, so the
     * marks are built again rather than moved.
     */
    setCourse(course = []) {
        this.course = course;
        this.next   = -1;

        for (const mark of this.marks) mark.remove();
        this.marks = course.map(() => {
            const mark = document.createElementNS(SVG_NS, 'circle');
            mark.setAttribute('class', 'minimap-mark');
            mark.setAttribute('r', MARK_RADIUS);
            // Appended after the line, which the markup puts first, so a mark
            // sits on the course rather than under it.
            this.group?.appendChild(mark);
            return mark;
        });

        this.drawCourse();
        return this.marks.length;
    }

    /**
     * Marks the one the course is waiting on, and everything either side of it.
     * Called whenever the run moves, the same moment the hoops themselves are
     * recoloured.
     */
    setNext(index) {
        this.next = index;
        this.marks.forEach((mark, at) => {
            const state = markClass(at, index);
            for (const name of MARK_STATES) mark.classList.toggle(name, name === state);
        });
        return index;
    }

    /** Draws the course where the square the map now covers puts it. */
    drawCourse() {
        if (!this.group) return 0;

        const points = coursePoints(this.bounds, this.course);

        this.line?.setAttribute('points', courseLine(points));
        points.forEach((point, at) => {
            const mark = this.marks[at];
            if (!mark) return;
            mark.setAttribute('cx', point.x.toFixed(2));
            mark.setAttribute('cy', point.y.toFixed(2));
            mark.classList.toggle('off-map', point.offMap);
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
