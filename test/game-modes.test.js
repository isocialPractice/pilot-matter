import test from 'node:test';
import assert from 'node:assert/strict';
import {
    RUNWAY_LANDING,
    LOOP_COURSE,
    LAND_OBJECTIVE,
    LOOP_OBJECTIVE,
    GAME_MODES,
    GAME_MODE_IDS,
    FREE_FLIGHT_ID,
    GAME_MODES_BACK_ID,
    GAME_MODES_CLOSE_KEYS,
    getGameMode,
    isGameModeId,
    isGameModesCloseKey,
    gameModeEntries,
    syncGameModeEntries,
    createRunState,
    startRun,
    endRun,
    isRunning,
    runningMode,
    currentStage,
    stageCount,
    stageNumber,
    stageProgress,
    isStageComplete,
    advanceStage,
    restartStage,
    recordLanding,
    recordGate,
    recordCrash,
    nextGate,
    runObjective,
    runStatus,
    stageSeed,
    stageWorld,
    stageStart,
    buildCourse,
    gateOffset,
    gatePassed,
    bearingDirection,
    wrapDegrees,
    wrapRadians,
    blendBearing
} from '../js/game-modes.js';
import { isStartValue, START_FIELD_IDS, START_FLYING } from '../js/config.js';
import {
    buildEnvironment, getEnvironment, MODE_ENVIRONMENTS, isEnvironmentId
} from '../js/environment/presets.js';
import { sampleHeight, runwayThresholds } from '../js/environment/elements.js';
import { FEET_PER_UNIT } from '../js/units.js';

const WORLD_SIZE = 16000;

/** The world a stage is flown over, built the way the simulator builds it. */
function worldFor(state, segments = 100) {
    const world = stageWorld(state);
    const field = buildEnvironment(getEnvironment(world.environment), {
        segments, seed: world.seed, base: world.base, runway: world.runway
    });

    const rings = runningMode(state).objective === LOOP_OBJECTIVE
        ? buildCourse(currentStage(state), {
            seed: world.seed, size: field.size,
            sampleHeight: (x, z) => sampleHeight(field, x, z)
        })
        : [];

    return { world, field, rings, runway: field.runways[0] ?? null };
}

// --- The modes -------------------------------------------------------------

test('there are two modes, and each is a world, an objective, and stages', () => {
    assert.deepEqual(GAME_MODE_IDS, [RUNWAY_LANDING, LOOP_COURSE]);

    for (const mode of GAME_MODES) {
        assert.ok(mode.label.length > 0, `${mode.id} needs a label to be listed by`);
        assert.ok(mode.description.length > 0, `${mode.id} needs a line saying what it is`);
        assert.ok(mode.goal.length > 0, `${mode.id} needs an objective the HUD can write`);
        assert.ok([LAND_OBJECTIVE, LOOP_OBJECTIVE].includes(mode.objective));
        assert.ok(mode.stages.length > 1, `${mode.id} should get harder, so it needs stages`);

        for (const stage of mode.stages) {
            assert.ok(stage.label.length > 0, `a stage of ${mode.id} needs a name`);
            assert.ok(stage.note.length > 0, 'and a line saying what is being asked of the pilot');
        }
    }
});

// Every mode opens over a world of its own rather than over one of the five the
// settings panel offers, which is what "a mode brings its own ground" means.
test('every mode is flown over a world built for it', () => {
    for (const mode of GAME_MODES) {
        assert.ok(MODE_ENVIRONMENTS.some(preset => preset.id === mode.environment),
            `${mode.id} should open over one of the worlds the modes were given`);
        assert.equal(isEnvironmentId(mode.environment), false,
            'and that world should not be one the settings panel offers to fly for its own sake');
    }
});

test('a mode answers to its own id and to nothing else', () => {
    assert.equal(getGameMode(RUNWAY_LANDING).id, RUNWAY_LANDING);
    assert.equal(getGameMode('a-mode-from-another-version'), null);
    assert.equal(getGameMode(null), null);
    assert.equal(isGameModeId(FREE_FLIGHT_ID), false, 'free flight is the absence of a mode');
});

// --- Landing gets harder ---------------------------------------------------

// The two things that make a landing hard are finding the strip and reading the
// ground around it. Both should be getting worse, stage on stage, or the mode
// is four goes at the same thing.
test('a landing stage asks more of the pilot than the one before it', () => {
    const stages = getGameMode(RUNWAY_LANDING).stages;

    for (let i = 1; i < stages.length; i++) {
        const before = stages[i - 1], now = stages[i];

        assert.ok(now.approach.distance > before.approach.distance,
            `stage ${i + 1} should open further out than stage ${i}`);
        assert.ok(Math.abs(now.approach.heading) > Math.abs(before.approach.heading),
            `stage ${i + 1} should open further off the line to the strip`);
        assert.ok(now.runway.length[1] < before.runway.length[1],
            `stage ${i + 1} should offer a shorter strip`);
        assert.ok(now.base.maxHeight > before.base.maxHeight,
            `stage ${i + 1} should put that strip in higher country`);
    }
});

test('a course stage asks more of the pilot than the one before it', () => {
    const stages = getGameMode(LOOP_COURSE).stages;

    for (let i = 1; i < stages.length; i++) {
        const before = stages[i - 1].rings, now = stages[i].rings;
        assert.ok(now.count > before.count, `stage ${i + 1} should lay more loops`);
        assert.ok(now.radius < before.radius, 'and tighter ones');
        assert.ok(now.spacing < before.spacing, 'with less run between them');
        assert.ok(now.turn > before.turn, 'on a course that bends more');
    }
});

// --- A run -----------------------------------------------------------------

test('a session opens in free flight, which is a run of nothing', () => {
    const state = createRunState();
    assert.equal(isRunning(state), false);
    assert.equal(runningMode(state), null);
    assert.equal(currentStage(state), null);
    assert.equal(stageNumber(state), 0);
    assert.equal(runObjective(state), '');
    assert.equal(runStatus(state), '');
    assert.deepEqual(stageProgress(state), { done: 0, total: 0 });
    assert.equal(nextGate(state), -1);
});

test('starting a mode opens it on its first stage with nothing done', () => {
    const state = createRunState(RUNWAY_LANDING);
    assert.equal(runningMode(state).id, RUNWAY_LANDING);
    assert.equal(stageNumber(state), 1);
    assert.equal(stageCount(state), getGameMode(RUNWAY_LANDING).stages.length);
    assert.deepEqual(stageProgress(state), { done: 0, total: 1 });
    assert.equal(state.complete, false);
});

test('a mode nothing answers to is free flight rather than a broken run', () => {
    assert.equal(isRunning(createRunState('a-mode-from-another-version')), false);

    const state = createRunState(LOOP_COURSE);
    startRun(state, 'a-mode-from-another-version');
    assert.equal(isRunning(state), false, 'and it stops whatever was being played');
});

test('stopping a mode puts the run back to free flight', () => {
    const state = createRunState(LOOP_COURSE);
    advanceStage(state);

    assert.equal(endRun(state), null);
    assert.equal(isRunning(state), false);
    assert.equal(state.stageIndex, 0, 'and back to the beginning, for the next time it is played');
});

test('a landing completes a landing stage, and only counts once', () => {
    const state = createRunState(RUNWAY_LANDING);

    assert.equal(recordLanding(state), true);
    assert.equal(isStageComplete(state), true);
    assert.deepEqual(stageProgress(state), { done: 1, total: 1 });
    assert.equal(recordLanding(state), false, 'rolling out is not a second landing');
});

test('a landing means nothing to a course, and a gate means nothing to a landing', () => {
    const landing = createRunState(RUNWAY_LANDING);
    assert.equal(recordGate(landing, 0), false);
    assert.equal(stageProgress(landing).done, 0);

    const course = createRunState(LOOP_COURSE);
    assert.equal(recordLanding(course), false);
    assert.equal(stageProgress(course).done, 0);
});

test('a course is flown in order: the gate it is up to and no other', () => {
    const state = createRunState(LOOP_COURSE);
    const total = stageProgress(state).total;

    assert.equal(nextGate(state), 0);
    assert.equal(recordGate(state, 1), false, 'skipping ahead is not progress');
    assert.equal(recordGate(state, 0), false, 'the first of several does not finish it');
    assert.equal(nextGate(state), 1);
    assert.equal(recordGate(state, 0), false, 'and flying back through one already behind you is not either');
    assert.equal(stageProgress(state).done, 1);

    for (let gate = 1; gate < total - 1; gate++) assert.equal(recordGate(state, gate), false);
    assert.equal(recordGate(state, total - 1), true, 'the last one finishes the stage');
    assert.equal(nextGate(state), -1, 'and there is nothing left to light');
});

test('a crash puts the stage back to its beginning without ending the run', () => {
    const state = createRunState(LOOP_COURSE);
    recordGate(state, 0);
    recordGate(state, 1);

    assert.equal(recordCrash(state), true);
    assert.deepEqual(stageProgress(state).done, 0);
    assert.equal(stageNumber(state), 1, 'the stage is still the one being played');
    assert.equal(recordCrash(createRunState()), false, 'and free flight has no stage to restart');
});

test('a run walks its stages and finishes on the last of them', () => {
    const state = createRunState(RUNWAY_LANDING);
    const total = stageCount(state);

    for (let stage = 1; stage < total; stage++) {
        assert.equal(advanceStage(state), true);
        assert.equal(stageNumber(state), stage + 1);
        assert.equal(state.complete, false);
    }

    assert.equal(advanceStage(state), false, 'there is no stage after the last one');
    assert.equal(state.complete, true);
    assert.equal(stageNumber(state), total, 'and the run stays on the stage it finished in');
});

test('a finished run stops taking progress rather than looping round', () => {
    const state = createRunState(RUNWAY_LANDING);
    while (advanceStage(state)) { /* to the last stage */ }

    assert.equal(recordLanding(state), false);
    assert.equal(recordCrash(state), false);
    assert.ok(runStatus(state).includes('COMPLETE'));
});

test('advancing a stage clears what the last one had done', () => {
    const state = createRunState(LOOP_COURSE);
    recordGate(state, 0);
    advanceStage(state);
    assert.equal(stageProgress(state).done, 0);

    recordGate(state, 0);
    restartStage(state);
    assert.equal(stageProgress(state).done, 0);
});

test('the status line says where the run is up to', () => {
    const landing = createRunState(RUNWAY_LANDING);
    assert.equal(runStatus(landing), `STAGE 1 OF ${stageCount(landing)}`);
    assert.equal(runObjective(landing), getGameMode(RUNWAY_LANDING).goal);

    const course = createRunState(LOOP_COURSE);
    assert.ok(runStatus(course).includes('LOOP 1 OF 3'), 'a course also says which loop');
    recordGate(course, 0);
    assert.ok(runStatus(course).includes('LOOP 2 OF 3'));
});

// --- The panel -------------------------------------------------------------

test('the panel lists free flight, every mode, then the way out', () => {
    const entries = gameModeEntries();
    assert.deepEqual(
        entries.map(entry => entry.id),
        [FREE_FLIGHT_ID, ...GAME_MODE_IDS, GAME_MODES_BACK_ID]
    );
    for (const entry of entries) {
        assert.ok(entry.label.length > 0, `${entry.id} needs a label to be read by`);
    }
});

test('the panel marks what is being played, and free flight when nothing is', () => {
    const entries = gameModeEntries();

    syncGameModeEntries(entries, createRunState());
    assert.deepEqual(entries.filter(entry => entry.current).map(entry => entry.id), [FREE_FLIGHT_ID]);

    syncGameModeEntries(entries, createRunState(LOOP_COURSE));
    assert.deepEqual(entries.filter(entry => entry.current).map(entry => entry.id), [LOOP_COURSE],
        'a mark on two rows is a mark on neither');
});

test('the keys that close the panel are the ones that back out of anything', () => {
    for (const code of GAME_MODES_CLOSE_KEYS) assert.equal(isGameModesCloseKey(code), true);
    for (const code of ['KeyW', 'Enter', 'KeyP']) assert.equal(isGameModesCloseKey(code), false);
});

// --- Bearings --------------------------------------------------------------

test('a bearing points the way the compass card says it does', () => {
    assert.ok(Math.abs(bearingDirection(0).z - 1) < 1e-9, 'north is +Z');
    assert.ok(Math.abs(bearingDirection(90).x - 1) < 1e-9, 'east is +X');
    assert.equal(wrapDegrees(-90), 270);
    assert.equal(wrapDegrees(450), 90);
    assert.ok(Math.abs(wrapRadians(Math.PI * 1.5) + Math.PI * 0.5) < 1e-9);
});

test('a bearing turns toward another by the short way round', () => {
    const nearlyNorth = -0.1;
    assert.ok(Math.abs(blendBearing(0.1, nearlyNorth, 1) - nearlyNorth) < 1e-9);
    assert.ok(Math.abs(blendBearing(0.1, nearlyNorth, 0) - 0.1) < 1e-9, 'no turn is no turn');
    assert.ok(Math.abs(blendBearing(0.1, nearlyNorth, 0.5)) < 1e-9, 'half way is half way');
    assert.ok(Math.abs(blendBearing(0.1, nearlyNorth, 4) - nearlyNorth) < 1e-9,
        'and more than all the way is all the way');
});

// --- The world a stage is flown over ---------------------------------------

test('every stage of a landing mode carries a strip, and no course stage does', () => {
    const landing = createRunState(RUNWAY_LANDING);
    do {
        assert.ok(stageWorld(landing).runway, 'a landing stage needs somewhere to land');
    } while (advanceStage(landing));

    const course = createRunState(LOOP_COURSE);
    assert.equal(stageWorld(course).runway, false, 'a course is not landed at the end of');
    assert.equal(stageWorld(createRunState()), null, 'and free flight is not a stage at all');
});

// Two seeds a few apart open a shift register on much the same value, so a
// stage number added to a mode's seed would lay four near-identical courses.
test('every stage is its own world rather than the last one shifted along', () => {
    const seeds = new Set();
    for (let stage = 0; stage < 8; stage++) seeds.add(stageSeed(90733, stage));
    assert.equal(seeds.size, 8, 'two stages should not share a seed');

    const state = createRunState(LOOP_COURSE);
    const headings = [];
    do {
        const { rings } = worldFor(state, 64);
        headings.push(Math.round(Math.atan2(rings[0].dirX, rings[0].dirZ) * 180 / Math.PI));
    } while (advanceStage(state));

    assert.ok(new Set(headings).size > 1, `every course opens on ${headings[0]} degrees`);
});

// --- Where a stage opens ---------------------------------------------------

test('a stage opens on a start the configuration can actually hold', () => {
    for (const id of GAME_MODE_IDS) {
        const state = createRunState(id);
        do {
            const { runway, rings } = worldFor(state);
            const { start, position } = stageStart(state, { runway, rings, size: WORLD_SIZE });

            assert.deepEqual(Object.keys(start), START_FIELD_IDS,
                'a stage should hand over a start and nothing else');
            assert.equal(start.startMode, START_FLYING,
                'every stage opens in the air, because nobody is scored on the takeoff');

            for (const field of START_FIELD_IDS) {
                assert.equal(isStartValue(field, start[field]), true,
                    `${id} stage ${stageNumber(state)} asked for a ${field} of ${start[field]}`);
            }

            assert.ok(Math.abs(position.x) <= WORLD_SIZE / 2 && Math.abs(position.z) <= WORLD_SIZE / 2,
                `${id} stage ${stageNumber(state)} opens outside the world it is flown in`);
        } while (advanceStage(state));
    }
});

// The world has no outside, so an opening the stage put past an edge comes back
// in at the opposite one. Where the aircraft sits relative to the strip is the
// same reading either way, once it is taken the short way round.
function toroidal(delta, size = WORLD_SIZE) {
    const wrapped = ((delta % size) + size) % size;
    return wrapped > size / 2 ? wrapped - size : wrapped;
}

function offsetToRunway(position, runway) {
    return { x: toroidal(position.x - runway.x), z: toroidal(position.z - runway.z) };
}

test('a landing stage opens where it said it would, pointing where it said', () => {
    const state = createRunState(RUNWAY_LANDING);
    const { runway } = worldFor(state);
    const stage = currentStage(state);
    const { start, position } = stageStart(state, { runway, size: WORLD_SIZE });

    const out = offsetToRunway(position, runway);
    assert.ok(Math.abs(Math.hypot(out.x, out.z) - stage.approach.distance) < 1,
        'the opening should be the distance out the stage asked for');

    // The first stage points at the strip: the bearing from the aircraft to the
    // runway and the heading it opens on should be the same bearing.
    const toStrip = wrapDegrees(Math.atan2(-out.x, -out.z) * 180 / Math.PI);
    const off = Math.abs(wrapRadians((toStrip - start.headingDegrees) * Math.PI / 180));
    assert.ok(off < 0.1, `the first stage opens ${(off * 180 / Math.PI).toFixed(0)} degrees off the strip`);
});

test('a landing stage opens on the approach side, so the strip is ahead not behind', () => {
    const state = createRunState(RUNWAY_LANDING);
    const { runway } = worldFor(state);
    const { position } = stageStart(state, { runway, size: WORLD_SIZE });

    // Approaching to land runs down the strip's bearing, so the aircraft should
    // be sitting back beyond the threshold rather than out past the far end.
    const [threshold] = runwayThresholds(runway);
    const out = bearingDirection(threshold.heading);
    const from = offsetToRunway(position, runway);
    assert.ok(from.x * out.x + from.z * out.z < 0,
        'the first stage should open short of the threshold, not past the far end');
});

test('a course stage opens lined up on the first loop at the height it was laid', () => {
    const state = createRunState(LOOP_COURSE);
    const { rings } = worldFor(state);
    const { start, position } = stageStart(state, { rings, size: WORLD_SIZE });

    const heading = bearingDirection(start.headingDegrees);
    assert.ok(Math.abs(heading.x - rings[0].dirX) < 0.02, 'the nose should be on the first gate');
    assert.ok(Math.abs(heading.z - rings[0].dirZ) < 0.02);

    const ahead = (rings[0].x - position.x) * heading.x + (rings[0].z - position.z) * heading.z;
    assert.ok(ahead > 0, 'and the gate should be in front of the aircraft rather than behind it');
    assert.ok(Math.abs(start.altitudeFeet - rings[0].y * FEET_PER_UNIT) < 20,
        'at the height the course was laid at');
});

test('a stage with no world to read falls back rather than throwing', () => {
    const landing = stageStart(createRunState(RUNWAY_LANDING), {});
    assert.deepEqual(landing.position, { x: 0, z: 0 });

    const course = stageStart(createRunState(LOOP_COURSE), {});
    assert.deepEqual(course.position, { x: 0, z: 0 });
    assert.equal(stageStart(createRunState(), {}), null);
});

// --- The course ------------------------------------------------------------

test('a course is the loops the stage asked for, in the order they are flown', () => {
    const state = createRunState(LOOP_COURSE);
    do {
        const stage = currentStage(state);
        const { field, rings } = worldFor(state);

        assert.equal(rings.length, stage.rings.count);
        rings.forEach((ring, index) => {
            assert.equal(ring.index, index, 'a loop should know where in the course it is');
            assert.equal(ring.radius, stage.rings.radius);
            assert.ok(Math.abs(Math.hypot(ring.dirX, ring.dirZ) - 1) < 1e-9,
                'and face along a bearing rather than along nothing');
            assert.ok(Math.abs(ring.x) <= field.size / 2 && Math.abs(ring.z) <= field.size / 2,
                'and be laid inside the world it is flown in');
            assert.ok(ring.y - sampleHeight(field, ring.x, ring.z) > ring.radius,
                'and hang clear of the ground under it, so there is a line through');
        });
    } while (advanceStage(state));
});

test('a course laid twice from one seed is the same course twice', () => {
    const stage = getGameMode(LOOP_COURSE).stages[1];
    assert.deepEqual(buildCourse(stage, { seed: 99 }), buildCourse(stage, { seed: 99 }));
    assert.notDeepEqual(buildCourse(stage, { seed: 99 }), buildCourse(stage, { seed: 100 }));
    assert.deepEqual(buildCourse(null), [], 'and a stage with no loops in it lays none');
});

test('a gate knows what is in front of it and what is behind', () => {
    const gate = { x: 0, y: 500, z: 0, radius: 200, dirX: 0, dirZ: 1 };
    assert.ok(gateOffset(gate, { x: 0, y: 500, z: -100 }) < 0, 'short of it');
    assert.ok(gateOffset(gate, { x: 0, y: 500, z: 100 }) > 0, 'past it');
    assert.equal(gateOffset(gate, { x: 900, y: 0, z: 0 }), 0, 'and abeam of it is neither');
});

test('a gate is flown through when the step across it lands inside the hoop', () => {
    const gate = { x: 0, y: 500, z: 0, radius: 200, dirX: 0, dirZ: 1 };
    const through = (from, to) => gatePassed(gate, from, to);

    assert.equal(through({ x: 0, y: 500, z: -50 }, { x: 0, y: 500, z: 50 }), true);
    assert.equal(through({ x: 0, y: 500, z: 50 }, { x: 0, y: 500, z: -50 }), true,
        'a loop is a loop from both sides');
    assert.equal(through({ x: 0, y: 500, z: -100 }, { x: 0, y: 500, z: -10 }), false,
        'stopping short of the plane is not through it');
    assert.equal(through({ x: 300, y: 500, z: -50 }, { x: 300, y: 500, z: 50 }), false,
        'and crossing the plane outside the hoop is flying past, not through');
    assert.equal(through({ x: 0, y: 900, z: -50 }, { x: 0, y: 900, z: 50 }), false,
        'over the top of it is past it too');
    assert.equal(gatePassed(null, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }), false);
});

// A gate is thinner than the distance an aircraft covers in a frame, so the
// test has to be against the step rather than against where it ended up.
test('a step long enough to jump the gate still counts as through it', () => {
    const gate = { x: 0, y: 500, z: 0, radius: 200, dirX: 0, dirZ: 1 };
    assert.equal(gatePassed(gate, { x: 0, y: 500, z: -3000 }, { x: 0, y: 500, z: 3000 }), true);
});

test('a step that only clips the rim is flown past rather than through', () => {
    const gate = { x: 0, y: 500, z: 0, radius: 200, dirX: 0, dirZ: 1 };
    // Crossing the plane 201 units above the middle: past the hoop by a metre.
    assert.equal(gatePassed(gate, { x: 0, y: 701, z: -50 }, { x: 0, y: 701, z: 50 }), false);
    assert.equal(gatePassed(gate, { x: 0, y: 699, z: -50 }, { x: 0, y: 699, z: 50 }), true);
});
