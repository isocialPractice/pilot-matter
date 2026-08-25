import * as THREE from 'three';

/**
 * The loops a course is flown through, as the meshes the geometry in
 * `js/game-modes.js` describes. Nothing here decides where a gate is or whether
 * one was flown through: this is the drawing of a course that has already been
 * laid, which is what lets the course itself be worked out and tested without a
 * renderer anywhere near it.
 */

// The hoop's thickness, as a fraction of its own radius, so a small gate looks
// like a small gate rather than a thicker one.
export const RING_TUBE = 0.06;

// Round enough to read as a circle from a distance and cheap enough to draw
// nine of them.
export const RING_SEGMENTS = 48;
export const TUBE_SEGMENTS = 10;

// Amber for a gate still to be flown, green for the one the course is waiting
// on, and a dim green for one already behind the aircraft - the same three
// readings the rest of the instruments are written in.
export const RING_COLOR      = 0xffb000;
export const RING_NEXT_COLOR = 0x00ff44;
export const RING_DONE_COLOR = 0x2c5c3a;

export class LoopCourse {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.group.name = 'pilot-matter-loop-course';
        this.hoops = [];
        scene?.add(this.group);
    }

    /**
     * Draws a course, taking the last one down first. A course is rebuilt
     * rather than moved because a stage is a different course, not the same one
     * somewhere else.
     */
    setRings(rings = []) {
        this.clear();
        for (const ring of rings) {
            const hoop = buildHoop(ring);
            this.hoops.push(hoop);
            this.group.add(hoop);
        }
        return this.hoops.length;
    }

    /**
     * Colours the course from the gate it is waiting on: everything before it is
     * flown, the gate itself is lit, and everything after it is still to come.
     * A course with nothing left to fly is drawn entirely as flown.
     */
    setNext(index) {
        this.hoops.forEach((hoop, at) => {
            hoop.material.color.setHex(colorFor(at, index));
        });
    }

    clear() {
        for (const hoop of this.hoops) {
            this.group.remove(hoop);
            hoop.geometry.dispose();
            hoop.material.dispose();
        }
        this.hoops.length = 0;
    }

    /** Takes the course out of the scene entirely, for a run that has ended. */
    dispose() {
        this.clear();
        this.scene?.remove(this.group);
    }
}

export function colorFor(at, next) {
    if (next < 0 || at < next) return RING_DONE_COLOR;
    return at === next ? RING_NEXT_COLOR : RING_COLOR;
}

function buildHoop(ring) {
    const geometry = new THREE.TorusGeometry(
        ring.radius, ring.radius * RING_TUBE, TUBE_SEGMENTS, RING_SEGMENTS
    );

    const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({ color: RING_COLOR })
    );

    mesh.position.set(ring.x, ring.y, ring.z);

    // A torus is built in its own XY plane, which puts its opening along +Z.
    // The gate faces the way the course runs through it, so the hoop is turned
    // about the vertical until its opening is on that bearing.
    mesh.rotation.y = Math.atan2(ring.dirX, ring.dirZ);

    return mesh;
}
