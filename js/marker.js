import * as THREE from 'three';

/**
 * The marker a search is flown to, as the meshes the geometry in
 * `js/game-modes.js` describes: a mast standing off the ground with a lit head
 * on it, and a ring laid round it at the distance that counts as beside it.
 *
 * Nothing here decides where the marker is or how close is close enough - that
 * is the mode's, and it is pure, so a search can be worked out and tested
 * without a renderer. What is here is the drawing of a marker already placed,
 * the same division `js/rings.js` keeps with the course and `js/guidance.js`
 * keeps with the approach.
 */

// The head in the green a gate the course is waiting on is lit in, the mast in
// the amber a gate still to come is drawn in, and the circle in the same amber:
// the same two readings the rest of the instruments are written in, saying the
// same two things - this is what you are looking for, and this is the ground it
// counts as found from.
export const MARKER_COLOR = 0x00ff44;
export const MAST_COLOR   = 0xffb000;
export const CIRCLE_COLOR = 0xffb000;

// How tall the mast stands, in world units. Tall enough to clear the trees the
// back country is drawn with, because a marker inside a canopy is a marker that
// is not there.
export const MAST_HEIGHT = 130;
export const MAST_RADIUS = 3.5;

// The head on top of it, and how round it is drawn. A sphere reads the same
// from every bearing, which is what something being searched for wants to do.
export const HEAD_RADIUS   = 22;
export const HEAD_SEGMENTS = 14;

// How thick the ring on the ground is drawn against its own radius, so a tight
// circle reads as a tight circle rather than as a thicker one.
export const CIRCLE_TUBE     = 0.035;
export const CIRCLE_SEGMENTS = 56;

// How far the ring stands off the ground under it, so it reads from the air
// rather than disappearing into the terrain it is laid on. The same clearance
// the approach marks are given, for the same reason.
export const CIRCLE_CLEARANCE = 6;

export class RescueMarker {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.group.name = 'pilot-matter-rescue-marker';
        this.parts = [];
        scene?.add(this.group);
    }

    /**
     * Draws a marker, taking the last one down first. Nothing at all for a
     * stage that has no marker, which is every stage of every other mode: the
     * same call, handed nothing to draw.
     *
     * `groundAt` is the height of the terrain at a place, because a marker
     * stands in open country rather than on anything graded, and a ring laid at
     * one height would be buried under rising ground on one side and left
     * hanging over falling ground on the other.
     *
     * Returns how many pieces were drawn.
     */
    setMarker(marker, groundAt = () => 0) {
        this.clear();
        if (!marker) return 0;

        const base = groundAt(marker.x, marker.z);

        this.add(buildMast(marker, base));
        this.add(buildHead(marker, base));

        // The ring is laid to the ground under itself rather than to the
        // ground under the mast: over a slope the two are not the same height,
        // and a circle drawn flat across one would tell the pilot the hillside
        // is level when it is the thing they are about to land on.
        this.add(buildCircle(marker, groundAt));

        return this.parts.length;
    }

    add(part) {
        this.parts.push(part);
        this.group.add(part);
    }

    clear() {
        for (const part of this.parts) {
            this.group.remove(part);
            part.geometry.dispose();
            part.material.dispose();
        }
        this.parts.length = 0;
    }

    /** Takes the marker out of the scene entirely, for a run that has ended. */
    dispose() {
        this.clear();
        this.scene?.remove(this.group);
    }
}

function buildMast({ x, z }, base) {
    const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(MAST_RADIUS, MAST_RADIUS, MAST_HEIGHT, 8),
        new THREE.MeshBasicMaterial({ color: MAST_COLOR })
    );

    // A cylinder is built about its own middle, so it is raised by half its
    // height to stand on the ground rather than half buried in it.
    mesh.position.set(x, base + MAST_HEIGHT / 2, z);
    return mesh;
}

function buildHead({ x, z }, base) {
    const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(HEAD_RADIUS, HEAD_SEGMENTS, HEAD_SEGMENTS),
        new THREE.MeshBasicMaterial({ color: MARKER_COLOR })
    );

    mesh.position.set(x, base + MAST_HEIGHT, z);
    return mesh;
}

/**
 * The circle that counts as beside the marker, drawn as a ring of segments each
 * sitting on the ground beneath it. A torus would be one flat plane and would
 * lie about the slope; this follows the country the way the ground does.
 */
function buildCircle({ x, z, radius }, groundAt) {
    // One point short of all the way round: the curve is closed below, so a
    // point at the start and another at the same place at the end is one point
    // twice, which a spline reads as a corner rather than as a join.
    const points = [];
    for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
        const angle = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
        const px = x + Math.sin(angle) * radius;
        const pz = z + Math.cos(angle) * radius;
        points.push(new THREE.Vector3(px, groundAt(px, pz) + CIRCLE_CLEARANCE, pz));
    }

    return new THREE.Mesh(
        new THREE.TubeGeometry(
            new THREE.CatmullRomCurve3(points, true),
            CIRCLE_SEGMENTS, radius * CIRCLE_TUBE, 6, true
        ),
        new THREE.MeshBasicMaterial({ color: CIRCLE_COLOR })
    );
}
