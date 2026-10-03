import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildCorridor, sectionOffset, corridorCrossing, sectionPassed, sectionMissed,
    missedBy, CORRIDOR_REACH, MIN_HEADROOM, HEADROOM_SAMPLES
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

// Ground that climbs steeply away from both axes, so a cut laid anywhere on it
// and at any heading has its posts well above its own centre line. This is the
// shape the lid used to be measured wrong on: a floor read out of the low point
// of the span, and walls standing most of the way up to the beam.
//
// Steeper than any shipped environment, deliberately. The fault is in how the
// span is read rather than in how steep the ground is, so the ground here is
// steep enough that every cut shows it instead of waiting on a seed that puts
// one cut across a slope.
const STEEP = {
    ...WORLD,
    sampleHeight: (x, z) => 2 * (Math.abs(x) + Math.abs(z))
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

/**
 * The ground across a cut, read at the points the corridor itself reads - one
 * post to the other, both ends included.
 *
 * Read at the same points on purpose. A denser reading could find a spike
 * between two of them and fail a lid that honoured the rule as written, which
 * would be the test disagreeing with the rule rather than with the code.
 */
function groundAcross(section, sampleHeight) {
    const acrossX =  section.dirZ;
    const acrossZ = -section.dirX;

    return Array.from({ length: HEADROOM_SAMPLES }, (unused, step) => {
        const across = ((step / (HEADROOM_SAMPLES - 1)) * 2 - 1) * section.halfWidth;
        return sampleHeight(section.x + acrossX * across, section.z + acrossZ * across);
    });
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
        assert.ok(section.ceiling - section.floor >= 400 - 1e-9,
            'every section leaves at least the stage\'s own headroom over its centre line');
        assert.equal(section.y, section.ceiling, 'and the chart reads the ceiling as its height');
        heights.add(Math.round(section.ceiling));
    }

    assert.ok(heights.size > 1, 'over rolling ground the lid is not one flat sheet');
});

// Ground that is level across the cut has nothing to clear beyond its centre
// line, so the stage's own figure is the whole of the answer. Held on its own
// because the rule above it is a floor and this is the case where the floor is
// exactly what the lid sits at.
test('over level ground the stage\'s headroom is the whole of the lid', () => {
    for (const section of buildCorridor(PLAN, WORLD)) {
        assert.ok(Math.abs(section.ceiling - section.floor - 400) < 1e-9);
        assert.equal(section.crest, section.floor,
            'and the highest ground across a level cut is the ground at its middle');
    }
});

// The reading the lid is actually held against. A cut is open over the whole
// span between its posts, so that span is what the room in it is measured
// across - a lid clearing only the centre line is a lid the walls reach up
// into, and the aircraft flies between the walls rather than along the line.
test('the lid clears the highest ground across the cut, not the ground at its centre', () => {
    const sections = buildCorridor(PLAN, STEEP);
    let raised = 0;

    for (const section of sections) {
        const ground = groundAcross(section, STEEP.sampleHeight);

        assert.equal(section.crest, Math.max(...ground),
            'the crest is the highest ground the cut is open over');
        assert.ok(section.crest >= section.floor,
            'which is never below the centre line, since the centre is one of the readings');

        for (const height of ground) {
            assert.ok(section.ceiling - height >= MIN_HEADROOM - 1e-9,
                `cut ${section.index} leaves ${section.ceiling - height} over ground at `
              + `${height}, against a least room of ${MIN_HEADROOM}`);
        }

        if (section.ceiling - section.floor > 400 + 1e-9) raised++;
    }

    assert.ok(raised > 0,
        'and over ground that climbs across the cut the lid is raised past the stage\'s own figure');
});

/**
 * The lid against the rule itself rather than against a bound it clears.
 *
 * Everything above reads one side of it. The level-ground case runs where
 * `crest === floor`, which is the one world in which every candidate rule
 * agrees. The crest case asserts a least room over the highest ground and more
 * air than the stage asked for, and both of those are floors - a lid measuring
 * the stage's own headroom off the crest instead of off the centre line clears
 * them more generously than the rule as written, while standing hundreds of
 * units too high on the steeper cuts.
 *
 * So this reads the formula on ground that is not level across the cut, where
 * the two halves are measured off different numbers and the difference shows.
 */
test('the lid is the stage\'s headroom over the floor or the least room over the crest, whichever is higher', () => {
    const headroom = PLAN.corridor.ceiling;
    const lid = (section) => Math.max(section.floor + headroom, section.crest + MIN_HEADROOM);

    // Rolling ground, with the stage's own figure well clear of what the slope
    // asks for, so the floor half is the winning one and the lid is read off
    // the centre line. Measured off the crest instead, every cut here sits
    // `crest - floor` too high.
    let overFloor = 0;
    for (const section of buildCorridor(PLAN, ROLLING)) {
        assert.ok(Math.abs(section.ceiling - lid(section)) < 1e-9,
            `cut ${section.index} has a lid of ${section.ceiling}, wanting ${lid(section)}`);
        if (section.crest > section.floor + 1e-9) overFloor++;
    }
    assert.ok(overFloor > 0,
        'the ground has to climb across some cut, or floor and crest are one reading and this pins nothing');

    // Ground steep enough that the least room over the crest is the winning
    // half instead, so both sides of the rule are read rather than whichever
    // one the gentler ground happens to reach.
    let overCrest = 0;
    for (const section of buildCorridor(PLAN, STEEP)) {
        assert.ok(Math.abs(section.ceiling - lid(section)) < 1e-9,
            `cut ${section.index} has a lid of ${section.ceiling}, wanting ${lid(section)}`);
        if (section.crest + MIN_HEADROOM > section.floor + headroom + 1e-9) overCrest++;
    }
    assert.ok(overCrest > 0,
        'and the crest half has to win on some cut, or only one half of the rule is ever read');
});

// A cut the aircraft cannot fit through is not a hard cut, it is an
// impossible one, so the plan is held off the ground rather than honoured.
test('a stage cannot ask for a cut with no air in it', () => {
    const airless = { corridor: { ...PLAN.corridor, ceiling: 1 } };

    // Over level ground the floor and the crest are the same reading, so the
    // least room is measured off either.
    for (const section of buildCorridor(airless, WORLD)) {
        assert.ok(Math.abs(section.ceiling - section.floor - MIN_HEADROOM) < 1e-9);
    }

    // Over ground that climbs across the cut they are not, and it is the crest
    // the least room is owed to. Measured off the floor instead, this is the
    // stage whose arithmetic went the other way entirely and left a cut with
    // less than nothing in it.
    for (const section of buildCorridor(airless, STEEP)) {
        assert.ok(Math.abs(section.ceiling - section.crest - MIN_HEADROOM) < 1e-9,
            `cut ${section.index} should leave exactly the least room over its highest ground`);
        assert.ok(section.ceiling - section.floor >= MIN_HEADROOM - 1e-9,
            'and no less than that over its centre line either');
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
