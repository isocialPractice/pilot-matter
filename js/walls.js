import * as THREE from 'three';
import { colorFor } from './rings.js';

/**
 * The walls and the ceiling a canyon run is flown between, as the meshes the
 * geometry in `js/corridor.js` describes: a post standing either side of each
 * cut, and a beam across the top of them at the height the run has to stay
 * under.
 *
 * Nothing here decides where a cut is, how wide it is, or whether the aircraft
 * went through it inside - that is the mode's, and it is pure, so a run can be
 * laid out and flown down without a renderer. What is here is the drawing of a
 * corridor already laid, the same division `js/rings.js` keeps with the course
 * and `js/marker.js` keeps with the marker.
 */

// The same three readings the rest of the instruments are written in: amber
// for a cut still to come, green for the one the run is up to, and a dim green
// for one already behind.
export const WALL_COLOR = 0xffb000;

// How thick a post is drawn, in world units. Thin enough not to be the thing
// narrowing the cut, and thick enough to be seen from the far end of the run.
export const POST_RADIUS   = 5;
export const POST_SEGMENTS = 8;

// How far below the floor a post is sunk, so it stands in the ground rather
// than balancing on it where the terrain between the two walls is uneven.
export const POST_FOOTING = 40;

// How thick the beam across the top is drawn, against the post. Heavier than
// the posts, because the ceiling is the limit a pilot loses track of first -
// the walls are either side of them and the lid is overhead.
export const BEAM_RADIUS = 7;

export class CanyonWalls {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.group.name = 'pilot-matter-canyon-walls';
        this.cuts = [];
        scene?.add(this.group);
    }

    /**
     * Draws a corridor, taking the last one down first. A stage is a different
     * corridor rather than the same one somewhere else, so it is rebuilt.
     *
     * Each cut is drawn as one group - two posts and a beam - so the whole of
     * it is lit or dimmed together by `setNext`. Nothing at all for a run with
     * no corridor, which is every stage of every other mode.
     *
     * Returns how many cuts were drawn.
     */
    setCorridor(sections = []) {
        this.clear();

        for (const section of sections) {
            const cut = buildCut(section);
            this.cuts.push(cut);
            this.group.add(cut.group);
        }

        return this.cuts.length;
    }

    /**
     * Colours the corridor from the cut the run is up to: everything before it
     * flown, that cut lit, and everything after it still to come. A run with
     * nothing left is drawn entirely as flown.
     */
    setNext(index) {
        this.cuts.forEach((cut, at) => {
            const color = colorFor(at, index);
            for (const part of cut.parts) part.material.color.setHex(color);
        });
    }

    clear() {
        for (const cut of this.cuts) {
            this.group.remove(cut.group);
            for (const part of cut.parts) {
                part.geometry.dispose();
                part.material.dispose();
            }
        }
        this.cuts.length = 0;
    }

    /** Takes the corridor out of the scene entirely, for a run that has ended. */
    dispose() {
        this.clear();
        this.scene?.remove(this.group);
    }
}

/**
 * One cut: a post at each wall, standing from under the floor up to the
 * ceiling, and a beam laid across the two at the ceiling itself.
 *
 * The posts reach the ceiling rather than stopping short of it, so the opening
 * the pilot flies at is bounded on three sides by something drawn. The fourth
 * side is the ground, which needs no drawing - it is already the thing that
 * ends a flight.
 */
function buildCut(section) {
    // Across the cut is square to the way the run goes, which is the same span
    // `corridorCrossing` measures the offset along.
    const acrossX =  section.dirZ;
    const acrossZ = -section.dirX;

    const base   = section.floor - POST_FOOTING;
    const height = section.ceiling - base;
    const middle = base + height / 2;

    const parts = [-1, 1].map(side => {
        const post = new THREE.Mesh(
            new THREE.CylinderGeometry(POST_RADIUS, POST_RADIUS, height, POST_SEGMENTS),
            new THREE.MeshBasicMaterial({ color: WALL_COLOR })
        );

        post.position.set(
            section.x + acrossX * section.halfWidth * side,
            middle,
            section.z + acrossZ * section.halfWidth * side
        );
        return post;
    });

    parts.push(buildBeam(section, acrossX, acrossZ));

    const group = new THREE.Group();
    for (const part of parts) group.add(part);

    return { group, parts };
}

/**
 * The beam across the top, drawn as a cylinder laid on its side.
 *
 * A cylinder is built standing up its own Y, and what is wanted is that axis
 * lying along the span of the cut. The turn from the one to the other is said
 * as the two directions it is between rather than as a pair of Euler angles:
 * a hoop's two turns happen to compose in the order Three.js applies them, and
 * the same pair here does not, so saying it the short way would be saying it
 * wrong in a way only a screenshot would show.
 */
function buildBeam(section, acrossX, acrossZ) {
    const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(BEAM_RADIUS, BEAM_RADIUS, section.halfWidth * 2, POST_SEGMENTS),
        new THREE.MeshBasicMaterial({ color: WALL_COLOR })
    );

    beam.position.set(section.x, section.ceiling, section.z);
    beam.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(acrossX, 0, acrossZ).normalize()
    );
    return beam;
}
