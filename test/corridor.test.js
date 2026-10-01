import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildCorridor, sectionOffset, corridorCrossing, sectionPassed, sectionMissed,
    missedBy, CORRIDOR_REACH, MIN_HEADROOM
} from '../js/corridor.js';
import { DEFAULT_SIZE } from '../js/environment/elements.js';

const PLAN = {
    corridor: { count: 6, spacing: 1800, halfWidth: 300, ceiling: 400, turn: 0.25 }
};

const WORLD = { seed: 4242, size: DEFAULT_SIZE, sampleHeight: () => 0 };

// Rolling ground, so the ceiling has something to follow rather than sitting
// at one height everywhere.
const ROLLING = {
    ...WORLD,
    sampleHeight: (x, z) => 180 + 90 * Math.sin(x / 1100) + 60 * Math.cos(z / 900)
};

/** A step through a section, offset across the cut and set at a height. */
function stepThrough(section, across = 0, height = null) {
    const y = height ?? (section.floor + section.ceiling) / 2;
    const acrossX =  section.dirZ;
    const acrossZ = -section.dirX;

    const at = (along) => ({
        x: section.x + section.dirX * along + acrossX * across,
        y,
        z: section.z + section.dirZ * along + acrossZ * across
    });

    return [at(-60), at(60)];
}

// --- Laying it out ---------------------------------------------------------

test('a corridor is the sections the stage cuts it into', () => {
    const sections = buildCorridor(PLAN, WORLD);

    assert.equal(sections.length, 6);
    assert.deepEqual(sections.map(s => s.index), [0, 1, 2, 3, 4, 5]);

    for (const section of sections) {
        assert.equal(section.halfWidth, 300);
        assert.ok(Math.abs(Math.hypot(section.dirX, section.dirZ) - 1) < 1e-9,
            'a section faces the way the run goes, as a unit vector');
    }
});

test('a stage with no corridor to it lays none', () => {
    assert.deepEqual(buildCorridor({}, WORLD), []);
    assert.deepEqual(buildCorridor(null, WORLD), []);
});

test('the ceiling is held over the ground under each section rather than at one height', () => {
    const sections = buildCorridor(PLAN, ROLLING);
    const heights = new Set();

    for (const section of sections) {
        assert.ok(Math.abs(section.ceiling - section.floor - 400) < 1e-9,
            'every section leaves the stage\'s own headroom');
        assert.equal(section.y, section.ceiling, 'and the chart reads the ceiling as its height');
        heights.add(Math.round(section.ceiling));
    }

    assert.ok(heights.size > 1, 'over rolling ground the lid is not one flat sheet');
});

// A cut the aircraft cannot fit through is not a hard cut, it is an
// impossible one, so the plan is held off the floor rather than honoured.
test('a stage cannot ask for a cut with no air in it', () => {
    const airless = { corridor: { ...PLAN.corridor, ceiling: 1 } };
    for (const section of buildCorridor(airless, WORLD)) {
        assert.ok(Math.abs(section.ceiling - section.floor - MIN_HEADROOM) < 1e-9);
    }
});

test('a run is laid inside the ground it is flown over', () => {
    const reach = DEFAULT_SIZE / 2 * CORRIDOR_REACH;

    // Several seeds, because the line is walked at random and one of them
    // reaching the edge is the failure this guards.
    for (let seed = 1; seed <= 40; seed++) {
        for (const stage of [PLAN, { corridor: { ...PLAN.corridor, count: 12, turn: 0.5 } }]) {
            for (const section of buildCorridor(stage, { ...WORLD, seed })) {
                assert.ok(Math.hypot(section.x, section.z) <= reach,
                    `seed ${seed} laid a section ${Math.hypot(section.x, section.z)} out, past ${reach}`);
            }
        }
    }
});

test('the same seed lays the same corridor twice', () => {
    assert.deepEqual(buildCorridor(PLAN, { ...WORLD, seed: 77 }),
                     buildCorridor(PLAN, { ...WORLD, seed: 77 }));
});

test('a different seed lays a different line through the same world', () => {
    const one = buildCorridor(PLAN, { ...WORLD, seed: 11 });
    const two = buildCorridor(PLAN, { ...WORLD, seed: 12 });
    assert.notDeepEqual(one.map(s => [s.x, s.z]), two.map(s => [s.x, s.z]));
});

// --- Flying it -------------------------------------------------------------

test('a step down the middle of the cut goes through it', () => {
    const [section] = buildCorridor(PLAN, WORLD);
    const [from, to] = stepThrough(section);

    const crossing = corridorCrossing(section, from, to);
    assert.equal(crossing.inside, true);
    assert.equal(crossing.within, true);
    assert.equal(crossing.under, true);
    assert.equal(crossing.forward, true);
    assert.ok(Math.abs(crossing.offset) < 1e-9, 'down the middle is no offset at all');
    assert.equal(sectionPassed(section, from, to), true);
    assert.equal(sectionMissed(section, from, to), false);
});

test('a step that never reaches the section crosses nothing', () => {
    const [section] = buildCorridor(PLAN, WORLD);
    const short = { x: section.x - section.dirX * 500, y: section.floor + 100, z: section.z - section.dirZ * 500 };
    const also  = { x: section.x - section.dirX * 400, y: section.floor + 100, z: section.z - section.dirZ * 400 };

    assert.equal(corridorCrossing(section, short, also), null);
    assert.equal(sectionPassed(section, short, also), false);
    assert.equal(sectionMissed(section, short, also), false);
});

test('a step over the lid reaches the section without going through it', () => {
    const [section] = buildCorridor(PLAN, WORLD);
    const [from, to] = stepThrough(section, 0, section.ceiling + 50);

    const crossing = corridorCrossing(section, from, to);
    assert.equal(crossing.under, false);
    assert.equal(crossing.within, true);
    assert.equal(crossing.inside, false);
    assert.equal(sectionMissed(section, from, to), true);
    assert.equal(missedBy(crossing), 'OVER THE TOP');
});

test('a step wide of a wall reaches the section without going through it', () => {
    const [section] = buildCorridor(PLAN, WORLD);

    for (const side of [1, -1]) {
        const [from, to] = stepThrough(section, (section.halfWidth + 40) * side);
        const crossing = corridorCrossing(section, from, to);

        assert.equal(crossing.within, false);
        assert.equal(crossing.under, true);
        assert.equal(sectionMissed(section, from, to), true);
        assert.equal(missedBy(crossing), 'WIDE');
    }
});

test('over and wide at once is reported as both', () => {
    const [section] = buildCorridor(PLAN, WORLD);
    const [from, to] = stepThrough(section, section.halfWidth + 80, section.ceiling + 80);

    assert.equal(missedBy(corridorCrossing(section, from, to)), 'OVER AND WIDE');
});

test('the wall is where the cut ends, and just inside it still counts', () => {
    const [section] = buildCorridor(PLAN, WORLD);

    const [inFrom, inTo] = stepThrough(section, section.halfWidth - 0.001);
    assert.equal(sectionPassed(section, inFrom, inTo), true, 'inside the wall is through');

    const [outFrom, outTo] = stepThrough(section, section.halfWidth + 0.001);
    assert.equal(sectionPassed(section, outFrom, outTo), false, 'outside it is not');
});

test('the ceiling is a limit the aircraft may touch rather than one it must clear', () => {
    const [section] = buildCorridor(PLAN, WORLD);

    const [onFrom, onTo] = stepThrough(section, 0, section.ceiling);
    assert.equal(sectionPassed(section, onFrom, onTo), true);

    const [overFrom, overTo] = stepThrough(section, 0, section.ceiling + 0.001);
    assert.equal(sectionPassed(section, overFrom, overTo), false);
});

// The floor is the ground, and the ground already ends a flight. A run does
// not need a second rule saying so, and one would make a low pass a fault.
test('there is no floor to the cut, because the ground is already one', () => {
    const [section] = buildCorridor(PLAN, WORLD);
    const [from, to] = stepThrough(section, 0, section.floor - 500);

    assert.equal(sectionPassed(section, from, to), true,
        'under the floor is still under the lid and between the walls');
});

// A pilot who has climbed out of the corridor turns back and comes at the
// section again, and that turn crosses the plane on the way round.
test('coming back the other way is the turn rather than a second fault', () => {
    const [section] = buildCorridor(PLAN, WORLD);
    const [from, to] = stepThrough(section, section.halfWidth + 200);

    assert.equal(sectionMissed(section, to, from), false, 'the way back is not a fault');
    assert.equal(corridorCrossing(section, to, from).forward, false);
});

test('a loop back through the cut the right way still counts', () => {
    const [section] = buildCorridor(PLAN, WORLD);
    const [from, to] = stepThrough(section);

    assert.equal(sectionPassed(section, to, from), true,
        'a cut is a cut from either side, as a loop is');
});

test('a step leaping the whole section in one frame still crosses it', () => {
    const [section] = buildCorridor(PLAN, WORLD);
    const y = (section.floor + section.ceiling) / 2;
    const from = { x: section.x - section.dirX * 900, y, z: section.z - section.dirZ * 900 };
    const to   = { x: section.x + section.dirX * 900, y, z: section.z + section.dirZ * 900 };

    assert.equal(sectionPassed(section, from, to), true);
});

test('how far off the middle is measured across the cut, not along the run', () => {
    const [section] = buildCorridor(PLAN, WORLD);
    const [from, to] = stepThrough(section, 120);

    assert.ok(Math.abs(Math.abs(corridorCrossing(section, from, to).offset) - 120) < 1e-6);
});

test('how far along the run a place is reads positive once it is behind', () => {
    const [section] = buildCorridor(PLAN, WORLD);

    assert.ok(sectionOffset(section, {
        x: section.x - section.dirX * 10, z: section.z - section.dirZ * 10
    }) < 0);
    assert.ok(sectionOffset(section, {
        x: section.x + section.dirX * 10, z: section.z + section.dirZ * 10
    }) > 0);
});

test('a crossing with nothing to cross is nothing at all', () => {
    const [section] = buildCorridor(PLAN, WORLD);
    assert.equal(corridorCrossing(null, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 1 }), null);
    assert.equal(corridorCrossing(section, null, { x: 1, y: 0, z: 1 }), null);
    assert.equal(corridorCrossing(section, { x: 0, y: 0, z: 0 }, null), null);
    assert.equal(missedBy(null), '');
});

test('a crossing that was inside has nothing to say about what it missed', () => {
    const [section] = buildCorridor(PLAN, WORLD);
    const [from, to] = stepThrough(section);
    assert.equal(missedBy(corridorCrossing(section, from, to)), '');
});
