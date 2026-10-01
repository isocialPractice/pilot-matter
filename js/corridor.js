/**
 * The corridor a canyon run is flown down: a line through the world with a
 * wall either side of it and a ceiling over it, cut into sections the aircraft
 * is counted through.
 *
 * It is laid rather than found. The generator draws canyons wherever its noise
 * puts them, so a run that went looking for one would be a run whose difficulty
 * was whatever the seed happened to hand it. The corridor is walked across the
 * ground instead - the same way a course of loops is walked - and the ceiling
 * is held a declared height over whatever is underneath, so a stage that brings
 * the ceiling down brings it down everywhere rather than only where the ground
 * was already high.
 *
 * A section is a gate with corners: the same plane test a loop uses, asked of a
 * rectangle open at the bottom rather than of an ellipse. Open at the bottom
 * because the floor is the ground, and the ground is already a thing that ends
 * a flight - a run does not need a second rule saying so.
 *
 * Pure module with no DOM or Three.js dependency, so a corridor can be laid out
 * and flown down in Node without a renderer anywhere near it.
 */

import { createRandom, DEFAULT_SIZE } from './environment/elements.js';

/**
 * How much of the world a corridor is laid inside, as a fraction of the half
 * width. The same reach a course of loops is held to, for the same reason: a
 * section put out past the ground is a section nothing can be flown through.
 */
export const CORRIDOR_REACH = 0.82;

/**
 * The least room a stage can leave between the ceiling and the ground under a
 * section, in world units. The stages narrow the cut and bring the ceiling
 * down, and this is where that stops: a section with no air in it is not a
 * hard section, it is an impossible one, and a plan that asks for one gets this
 * instead.
 */
export const MIN_HEADROOM = 70;

/**
 * Lays out a stage's corridor.
 *
 * The line is walked from one side of the world toward the other, drifting by
 * the stage's own amount and pulled back toward the middle as it reaches the
 * edge - a run is a length to be flown down, so it wants the longest line
 * through the world rather than a tour of it.
 *
 * Each section stands square across the line at the point it is laid, and
 * carries the two things the run is judged on: how far either side of the line
 * the walls stand, and how far over the ground the ceiling is held.
 */
export function buildCorridor(stage, options = {}) {
    const plan = stage?.corridor;
    if (!plan) return [];

    const random = options.random ?? createRandom(options.seed ?? 1);
    const sample = options.sampleHeight ?? (() => 0);
    const reach  = (options.size ?? DEFAULT_SIZE) / 2 * CORRIDOR_REACH;

    // The run opens on the far side of the world from wherever it is headed,
    // so the whole of the ground is in front of it.
    let heading = random() * Math.PI * 2;
    let x = -Math.sin(heading) * reach * 0.85;
    let z = -Math.cos(heading) * reach * 0.85;

    const sections = [];
    for (let index = 0; index < plan.count; index++) {
        const floor   = sample(x, z);
        const ceiling = floor + Math.max(plan.ceiling, MIN_HEADROOM);

        sections.push({
            index,
            x,
            z,
            floor,
            ceiling,
            // Kept under the name a chart reads a mark's height by, so the
            // corridor draws on the same instruments a course does.
            y: ceiling,
            halfWidth: plan.halfWidth,
            dirX: Math.sin(heading),
            dirZ: Math.cos(heading)
        });

        const out  = Math.hypot(x, z) / reach;
        const home = Math.atan2(-x, -z);
        heading = steer(heading + (random() * 2 - 1) * plan.turn, home, (out - 0.55) / 0.45);

        x += Math.sin(heading) * plan.spacing;
        z += Math.cos(heading) * plan.spacing;
    }

    return sections;
}

/** One heading turned part of the way toward another, by the short way round. */
function steer(from, to, amount) {
    const turn = Math.PI * 2;
    const wrapped = ((to - from) % turn + turn) % turn;
    const shortest = wrapped > Math.PI ? wrapped - turn : wrapped;
    return from + shortest * Math.min(Math.max(amount, 0), 1);
}

/** How far in front of or behind a section a place lies, along the run. */
export function sectionOffset(section, point) {
    return (point.x - section.x) * section.dirX + (point.z - section.z) * section.dirZ;
}

/**
 * Where a step of the flight crossed a section, and what it was doing there.
 *
 * Null for a step that did not reach the section at all. Otherwise it reports
 * the crossing on each of the three readings the walls and the ceiling make:
 * how far off the middle of the cut it was, whether that was inside the walls,
 * and whether it was under the ceiling. `inside` is the two together, which is
 * what counts the section; the two apart are what lets the pilot be told which
 * of them they got wrong.
 */
export function corridorCrossing(section, from, to) {
    if (!section || !from || !to) return null;

    const before = sectionOffset(section, from);
    const after  = sectionOffset(section, to);
    if ((before > 0) === (after > 0)) return null;

    const t = before / (before - after);
    const at = {
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
        z: from.z + (to.z - from.z) * t
    };

    // Across the cut is square to the way the run goes, which is the span the
    // walls stand on either side of.
    const offset = (at.x - section.x) * section.dirZ - (at.z - section.z) * section.dirX;
    const within = Math.abs(offset) <= section.halfWidth;
    const under  = at.y <= section.ceiling;

    return {
        offset,
        height: at.y - section.floor,
        within,
        under,
        inside: within && under,
        forward: after > before
    };
}

/** True when a step took the aircraft through a section, inside the cut. */
export function sectionPassed(section, from, to) {
    return corridorCrossing(section, from, to)?.inside === true;
}

/**
 * True when a step went past a section rather than through it: it reached the
 * section going the way the run goes, and was over the ceiling or wide of a
 * wall when it got there.
 *
 * Only the forward crossing counts, as it does for a loop gone by: a pilot who
 * has turned back to come at a section again crosses it on the way round, and
 * that is the turn rather than a second fault.
 */
export function sectionMissed(section, from, to) {
    const crossing = corridorCrossing(section, from, to);
    return crossing != null && !crossing.inside && crossing.forward;
}

/**
 * What a section was missed by, in the words the pilot is told it in: over the
 * ceiling, wide of the walls, or both at once. Empty for a crossing that was
 * inside, and for no crossing at all.
 */
export function missedBy(crossing) {
    if (!crossing || crossing.inside) return '';
    if (!crossing.under && !crossing.within) return 'OVER AND WIDE';
    return crossing.under ? 'WIDE' : 'OVER THE TOP';
}
