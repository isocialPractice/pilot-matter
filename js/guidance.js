import * as THREE from 'three';

/**
 * The approach guidance, as the meshes the geometry in `js/game-modes.js`
 * describes: a bar across the threshold of the strip being landed on, and the
 * extended centreline running back down the approach toward the aircraft.
 *
 * Nothing here decides what a stage is given or where the marks lie - that is
 * the mode's, and it is pure, so what the pilot is shown can be worked out and
 * tested without a renderer. What is here is the drawing of it, the same
 * division `js/rings.js` keeps with the course.
 */

// The threshold in the green a gate the course is waiting on is lit in, and the
// lead-in in the amber one still to come is drawn in: the same two readings the
// rest of the instruments are written in, saying the same two things - this is
// what you are flying at, and this is the way to it.
export const THRESHOLD_COLOR  = 0x00ff44;
export const CENTRELINE_COLOR = 0xffb000;

// How far a mark stands off the ground under it, in world units, so it reads
// from the air rather than disappearing into the terrain it is laid on.
export const MARK_CLEARANCE = 6;

// How thick a mark is drawn, in world units: deep enough along the approach to
// be seen end-on, and thin enough to be a mark rather than a wall.
export const MARK_DEPTH = 24;
export const MARK_RISE  = 4;

// How wide a lead-in mark is against the strip it leads to. Narrower than the
// threshold, so the line reads as running into the bar rather than as a ladder
// of identical rungs.
export const MARK_WIDTH = 0.55;

export class ApproachGuidance {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.group.name = 'pilot-matter-approach-guidance';
        this.marks = [];
        scene?.add(this.group);
    }

    /**
     * Draws a stage's guidance, taking the last stage's down first. Nothing at
     * all for a stage that is given none, which is how the help is withdrawn:
     * the same call, handed nothing to draw.
     *
     * `groundAt` is the height of the terrain at a place, because the lead-in
     * runs out over open country rather than over the graded strip, and a mark
     * laid at the runway's own elevation would be buried under rising ground or
     * left hanging over falling ground.
     *
     * Returns how many marks were drawn.
     */
    setGuidance(plan, groundAt = () => 0) {
        this.clear();
        if (!plan) return 0;

        const facing = plan.heading * Math.PI / 180;

        if (plan.threshold) {
            this.add(buildMark(plan.threshold, facing, plan.width,
                plan.elevation + MARK_CLEARANCE, THRESHOLD_COLOR));
        }

        for (const mark of plan.marks ?? []) {
            this.add(buildMark(mark, facing, plan.width * MARK_WIDTH,
                groundAt(mark.x, mark.z) + MARK_CLEARANCE, CENTRELINE_COLOR));
        }

        return this.marks.length;
    }

    add(mark) {
        this.marks.push(mark);
        this.group.add(mark);
    }

    clear() {
        for (const mark of this.marks) {
            this.group.remove(mark);
            mark.geometry.dispose();
            mark.material.dispose();
        }
        this.marks.length = 0;
    }

    /** Takes the guidance out of the scene entirely, for a run that has ended. */
    dispose() {
        this.clear();
        this.scene?.remove(this.group);
    }
}

/** One bar laid across the approach, at a place, a width, and a height. */
function buildMark({ x, z }, facing, width, y, color) {
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(width, MARK_RISE, MARK_DEPTH),
        new THREE.MeshBasicMaterial({ color })
    );

    mesh.position.set(x, y, z);
    // The box is built along the world's axes, so it is turned about the
    // vertical until its width lies across the strip rather than along it.
    mesh.rotation.y = facing;

    return mesh;
}
