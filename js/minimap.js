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

export class Minimap {
    constructor(root, bounds = DEFAULT_BOUNDS) {
        this.root     = root;
        this.marker   = root.querySelector('#minimap-aircraft');
        this.bounds   = bounds;
    }

    /**
     * Fits the map to the world being flown. Called whenever the environment
     * changes, so a map is never scaled to a world that is no longer there.
     */
    setBounds(bounds) {
        this.bounds = bounds ?? DEFAULT_BOUNDS;
        return this.bounds;
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
