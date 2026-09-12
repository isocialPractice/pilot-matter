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
    gateMissed,
    gateCrossing,
    gateAspect,
    gateAxes,
    approachThreshold,
    approachGuidance,
    CENTRELINE_REACH,
    CENTRELINE_MARKS,
    recordMiss,
    missNotice,
    tickRun,
    gateBearing,
    gateDistance,
    relativeBearing,
    gateArrow,
    gateInView,
    gatePointer,
    GATE_ARROWS,
    GATE_IN_VIEW,
    bearingDirection,
    directionToBearing,
    wrapDegrees,
    wrapRadians,
    blendBearing
} from '../js/game-modes.js';
import { isStartValue, START_FIELD_IDS, START_FLYING, startField } from '../js/config.js';
import {
    buildEnvironment, getEnvironment, MODE_ENVIRONMENTS, isEnvironmentId
} from '../js/environment/presets.js';
import {
    sampleHeight, runwayThresholds, runwayDirection, runwayOffsets
} from '../js/environment/elements.js';
import { FEET_PER_UNIT, headingToYaw } from '../js/units.js';

const WORLD_SIZE = 16000;

/**
 * How far an opening's heading can sit off the bearing it was worked out from
 * and still be right. A stage opens on a card heading a pilot could dial in,
 * so `stageStart` snaps it to the step the start field is configured in, and
 * half a step is the most that snap can move it. Anything past this is the
 * geometry being wrong rather than the dial being coarse - the frame mismatch
 * these tests were written for was four times it.
 */
const HEADING_SNAP = startField('headingDegrees').step / 2;

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
    assert.ok(Math.abs(bearingDirection(90).x + 1) < 1e-9, 'east is -X');
    assert.equal(wrapDegrees(-90), 270);
    assert.equal(wrapDegrees(450), 90);
    assert.ok(Math.abs(wrapRadians(Math.PI * 1.5) + Math.PI * 0.5) < 1e-9);
});

/**
 * The one thing a compass bearing has to be, and the thing that was wrong:
 * the direction a bearing names is the direction an aircraft on that bearing
 * travels. Anything else and a stage can place the aircraft correctly, point
 * it with the reciprocal of the same bearing, and still aim it off the strip.
 *
 * The aircraft's direction is taken from `headingToYaw` and the rotation the
 * renderer applies it through: a model built nose-first along +Z, turned about
 * +Y by the yaw, travels `(sin yaw, cos yaw)`.
 */
test('a bearing is the direction an aircraft on that bearing actually flies', () => {
    // Bearings that are not multiples of a right angle, so a frame mirrored in
    // x cannot pass by symmetry the way it does on 000 and 180.
    for (const degrees of [5, 37, 128, 183, 274, 359]) {
        const yaw   = headingToYaw(degrees);
        const flown = { x: Math.sin(yaw), z: Math.cos(yaw) };
        const named = bearingDirection(degrees);

        assert.ok(Math.abs(named.x - flown.x) < 1e-9 && Math.abs(named.z - flown.z) < 1e-9,
            `${degrees} names (${named.x.toFixed(4)}, ${named.z.toFixed(4)}) `
          + `but is flown as (${flown.x.toFixed(4)}, ${flown.z.toFixed(4)})`);

        // And the reverse reading gets the bearing back off the direction.
        assert.ok(Math.abs(directionToBearing(flown.x, flown.z) - degrees) < 1e-9,
            `${degrees} does not read back off the direction it is flown in`);
    }

    assert.equal(directionToBearing(0, 0), 0, 'nowhere at all reads as north');
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

            assert.ok(Number.isFinite(position.x) && Number.isFinite(position.z),
                `${id} stage ${stageNumber(state)} opens at ${position.x},${position.z}`);
        } while (advanceStage(state));
    }
});

// The ground is an endless grid of tiles rather than one square, so an opening
// is read off the strip as it stands rather than the short way round an edge.
function offsetToRunway(position, runway) {
    return { x: position.x - runway.x, z: position.z - runway.z };
}

/**
 * The bearing from the strip out to a place, in degrees clockwise from north,
 * read on the card the aircraft flies by rather than on one written out here.
 * The two are mirror images in x, and a test that writes out its own is a test
 * that agrees with a placement and a heading that disagree with each other.
 */
function bearingFromRunway(position, runway) {
    const out = offsetToRunway(position, runway);
    return directionToBearing(out.x, out.z);
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
    const toStrip = directionToBearing(-out.x, -out.z);
    const off = Math.abs(wrapRadians((toStrip - start.headingDegrees) * Math.PI / 180));
    assert.ok(off < 0.1, `the first stage opens ${(off * 180 / Math.PI).toFixed(0)} degrees off the strip`);
});

/**
 * The check the two tests above could not make between them. Both read the
 * opening's bearing off a card written in the test, so a placement and a
 * heading that were mirror images of each other agreed with a test that was
 * mirrored the same way, and `FINAL` opened ten degrees off the strip for as
 * long as the three of them were wrong together.
 *
 * This one never names a bearing. It asks where the nose points in the world,
 * through `headingToYaw` and the rotation the renderer applies it with, and
 * compares that against where the strip lies from the opening. A frame is
 * either right or it is not, and no card is consulted about it.
 */
test('a landing stage opens pointed at the strip it is about', () => {
    const state = createRunState(RUNWAY_LANDING);

    // A strip laid on a bearing that is not a multiple of a right angle, so a
    // frame mirrored in x cannot pass by symmetry. Placed well away from the
    // origin for the same reason.
    const runway = {
        x: 1200, z: -3400, heading: 37, length: 3000, width: 300, elevation: 0,
        ...runwayDirection(37)
    };

    const { start, position } = stageStart(state, { runway, size: WORLD_SIZE });

    // Where the nose points in the world, for the heading the stage opened on.
    const yaw  = headingToYaw(start.headingDegrees);
    const nose = { x: Math.sin(yaw), z: Math.cos(yaw) };

    // And where the strip is from there.
    const away    = Math.hypot(runway.x - position.x, runway.z - position.z);
    const toStrip = { x: (runway.x - position.x) / away, z: (runway.z - position.z) / away };

    // FINAL sets approach.heading 0, which is the stage saying "aimed at it".
    assert.equal(currentStage(state).approach.heading, 0,
        'this test is about the stage that opens aimed at the strip');

    const off = Math.acos(Math.min(1, Math.max(-1, nose.x * toStrip.x + nose.z * toStrip.z)))
              * 180 / Math.PI;
    assert.ok(off <= HEADING_SNAP,
        `the stage opens ${off.toFixed(2)} degrees off the strip it is about`);
});

/**
 * What that angle comes to over the distance there is to fly, which is the
 * part a pilot meets. The test above reads the opening's aim as an angle, and
 * an angle is right or wrong at any range; this one holds the heading the
 * stage opened on across the ground between the aircraft and the strip and
 * asks whether the track that draws crosses the strip or the country beside
 * it. Nothing is flown - no model, no time - only the straight line a heading
 * held without a control touched leaves over the ground.
 *
 * Marched in steps rather than solved, because what is wanted is the closest
 * the track comes to the middle while it is over the strip's own length, and a
 * line that never gets there at all has no answer to give rather than a wrong
 * one.
 */
test('the opening heading, held, carries the aircraft onto the strip', () => {
    const state = createRunState(RUNWAY_LANDING);
    const { runway } = worldFor(state);
    const { start, position } = stageStart(state, { runway, size: WORLD_SIZE });

    // Where the nose points in the world, taken the way the renderer takes it
    // rather than off a bearing, for the same reason the test above does.
    const yaw  = headingToYaw(start.headingDegrees);
    const nose = { x: Math.sin(yaw), z: Math.cos(yaw) };

    let closest = null;
    for (let flown = 0; flown <= WORLD_SIZE; flown += 10) {
        const { along, across } = runwayOffsets(runway,
            position.x + nose.x * flown, position.z + nose.z * flown);
        if (Math.abs(along) > runway.length / 2) continue;
        if (!closest || Math.abs(across) < Math.abs(closest.across)) closest = { along, across };
    }

    assert.ok(closest, 'the opening heading never carries the aircraft over the strip at all');
    assert.ok(Math.abs(closest.across) <= runway.width / 2,
        `the track passes ${Math.abs(closest.across).toFixed(0)} units off the middle of a strip `
      + `${runway.width.toFixed(0)} wide, which is beside it rather than onto it`);
});

/**
 * The same reading for the stages that open deliberately turned off the line.
 * A stage asking to open 30 degrees off the strip should be 30 degrees off it,
 * not 30 mirrored into something else.
 *
 * Measured in the world the same way as the test above, never through a
 * bearing: a test that reads the opening's bearing back with the same helper
 * the opening was placed with agrees with any frame at all, mirrored or not,
 * because the two mirror together.
 */
test('a landing stage opens exactly as far off the strip as it asked to', () => {
    const state = createRunState(RUNWAY_LANDING);
    const runway = {
        x: -900, z: 2100, heading: 214, length: 3000, width: 300, elevation: 0,
        ...runwayDirection(214)
    };

    do {
        const stage = currentStage(state);
        const { start, position } = stageStart(state, { runway, size: WORLD_SIZE });

        const yaw  = headingToYaw(start.headingDegrees);
        const nose = { x: Math.sin(yaw), z: Math.cos(yaw) };

        const away    = Math.hypot(runway.x - position.x, runway.z - position.z);
        const toStrip = { x: (runway.x - position.x) / away, z: (runway.z - position.z) / away };

        // Signed the way the card counts, so a stage that opens turned right
        // of the strip reads as the positive `approach.heading` it asked for.
        const turned = Math.atan2(nose.z * toStrip.x - nose.x * toStrip.z,
                                  nose.x * toStrip.x + nose.z * toStrip.z) * 180 / Math.PI;

        // Folded back into the half turn either side of zero, because the last
        // stage opens with the strip dead behind and 180 either way is the
        // same place: an unfolded difference there reads as 359 degrees out.
        const miss = relativeBearing(turned, stage.approach.heading);

        assert.ok(Math.abs(miss) <= HEADING_SNAP,
            `${stage.label} asked to open ${stage.approach.heading} degrees off the strip `
          + `and opened ${turned.toFixed(2)}`);
    } while (advanceStage(state));
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

// An opening is a bearing and a distance out from the strip, and that has to
// hold wherever in the tile the site search put the strip. Nothing carries the
// opening back inside the square any more, because the ground continues past
// it: a wrapped opening would put the aircraft out on the far side of the
// runway, at a bearing and a distance the stage never asked for.
test('a landing stage opens the distance and bearing out it asked for, from a strip sited anywhere', () => {
    const state = createRunState(RUNWAY_LANDING);
    const { runway: generated } = worldFor(state);
    const edge = WORLD_SIZE / 2;

    const sites = [
        { x: 0, z: 0 },
        { x: edge - 400, z: 0 }, { x: -edge + 400, z: 0 },
        { x: 0, z: edge - 400 }, { x: 0, z: -edge + 400 },
        { x: edge - 200, z: edge - 200 }, { x: -edge + 200, z: -edge + 200 }
    ];

    do {
        const stage = currentStage(state);
        const asked = wrapDegrees(runwayThresholds(generated)[0].heading + 180 + stage.approach.bearing);

        for (const site of sites) {
            const runway = { ...generated, ...site };
            const { position } = stageStart(state, { runway });
            const where = `${stage.label} from a strip at ${site.x},${site.z}`;

            const from = offsetToRunway(position, runway);
            const out  = Math.hypot(from.x, from.z);
            assert.ok(Math.abs(out - stage.approach.distance) < 1,
                `${where} opens ${Math.round(out)} out rather than the ${stage.approach.distance} it asked for`);

            const off = Math.abs(wrapRadians((bearingFromRunway(position, runway) - asked) * Math.PI / 180));
            assert.ok(off < 0.01,
                `${where} opens ${(off * 180 / Math.PI).toFixed(1)} degrees off the bearing it asked for`);
        }
    } while (advanceStage(state));
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

// --- A gate gone past ------------------------------------------------------

// A course that stops counting without saying so is a course the pilot goes on
// flying at a gate that is already behind them.
test('crossing the plane of a gate outside the hoop is a miss rather than nothing', () => {
    const gate = { x: 0, y: 500, z: 0, radius: 200, dirX: 0, dirZ: 1 };

    assert.equal(gateMissed(gate, { x: 300, y: 500, z: -50 }, { x: 300, y: 500, z: 50 }), true);
    assert.equal(gateMissed(gate, { x: 0, y: 900, z: -50 }, { x: 0, y: 900, z: 50 }), true,
        'over the top of it is past it');
    assert.equal(gateMissed(gate, { x: 0, y: 500, z: -50 }, { x: 0, y: 500, z: 50 }), false,
        'through the hoop is not past it');
    assert.equal(gateMissed(gate, { x: 300, y: 500, z: -100 }, { x: 300, y: 500, z: -10 }), false,
        'and stopping short of the plane is neither');
    assert.equal(gateMissed(null, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }), false);
});

// A pilot who has overshot turns round and comes back through the plane on
// their way to line the gate up again. Reporting that as a second miss would
// be reporting the turn.
test('coming back at a gate is the turn rather than a second miss', () => {
    const gate = { x: 0, y: 500, z: 0, radius: 200, dirX: 0, dirZ: 1 };

    assert.equal(gateMissed(gate, { x: 300, y: 500, z: 50 }, { x: 300, y: 500, z: -50 }), false,
        'crossing back the way the course does not run is repositioning');
    assert.equal(gatePassed(gate, { x: 0, y: 500, z: 50 }, { x: 0, y: 500, z: -50 }), true,
        'though flying the loop backwards is still flying it');
});

test('a step reports where it crossed and which way it was going', () => {
    const gate = { x: 0, y: 500, z: 0, radius: 200, dirX: 0, dirZ: 1 };

    const through = gateCrossing(gate, { x: 0, y: 500, z: -50 }, { x: 0, y: 500, z: 50 });
    assert.equal(through.inside, true);
    assert.equal(through.forward, true);
    assert.equal(through.offset, 0);

    const past = gateCrossing(gate, { x: 300, y: 500, z: -50 }, { x: 300, y: 500, z: 50 });
    assert.equal(past.inside, false);
    assert.equal(past.offset, 300);

    assert.equal(gateCrossing(gate, { x: 0, y: 500, z: -100 }, { x: 0, y: 500, z: -10 }), null);
    assert.equal(gateCrossing(null, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }), null);
});

test('a missed gate is counted, and the course still waits on it', () => {
    const state = createRunState(LOOP_COURSE);

    assert.equal(recordMiss(state, 0), true);
    assert.equal(state.gate, 0, 'the gate the course waits on has not moved');
    assert.equal(state.missed, 1);
    assert.equal(nextGate(state), 0, 'so it is still there to be flown');

    assert.equal(recordGate(state, 0), false, 'and flying it still counts');
    assert.equal(state.gate, 1);
});

test('only the gate the course is waiting on can be missed', () => {
    const state = createRunState(LOOP_COURSE);

    assert.equal(recordMiss(state, 2), false);
    assert.equal(state.missed, 0);
});

test('a landing has no gates to miss, and neither has a free flight', () => {
    assert.equal(recordMiss(createRunState(RUNWAY_LANDING), 0), false);
    assert.equal(recordMiss(createRunState(), 0), false);
});

test('a stage started again has nothing missed against it', () => {
    const state = createRunState(LOOP_COURSE);
    recordMiss(state, 0);
    restartStage(state);
    assert.equal(state.missed, 0);
});

// Being told only that a gate went by reads as the course having ended, which
// is the one thing that has not happened.
test('a miss is reported as the gate to come round to, not as a failure', () => {
    const state = createRunState(LOOP_COURSE);
    assert.equal(missNotice(state), 'LOOP 1 MISSED  ·  COME ROUND AGAIN');

    recordGate(state, 0);
    assert.equal(missNotice(state), 'LOOP 2 MISSED  ·  COME ROUND AGAIN');
});

test('a course with nothing left to fly has no gate to report', () => {
    const state = createRunState(RUNWAY_LANDING);
    assert.equal(missNotice(state), '');
});

// --- The stage clock -------------------------------------------------------

test('a stage is timed from the moment it is laid out', () => {
    const state = createRunState(LOOP_COURSE);
    assert.equal(state.elapsed, 0);

    tickRun(state, 1.5);
    tickRun(state, 0.5);
    assert.equal(state.elapsed, 2);
});

test('a free flight has no stage to time', () => {
    const state = createRunState();
    tickRun(state, 5);
    assert.equal(state.elapsed, 0);
});

// The clock stops when the objective is met rather than when the next stage is
// laid out, so the beat a finished stage is held for is not part of its time.
test('the clock stops the moment the stage is flown out', () => {
    const state = createRunState(RUNWAY_LANDING);
    tickRun(state, 10);
    recordLanding(state);
    tickRun(state, 5);

    assert.equal(state.elapsed, 10);
});

test('a course stops its clock on the last gate rather than after it', () => {
    const state = createRunState(LOOP_COURSE);
    const gates = currentStage(state).rings.count;

    for (let gate = 0; gate < gates; gate++) {
        tickRun(state, 1);
        recordGate(state, gate);
    }
    tickRun(state, 30);

    assert.equal(state.elapsed, gates);
});

test('a finished run has no clock left to run', () => {
    const state = createRunState(LOOP_COURSE);
    state.complete = true;
    tickRun(state, 5);
    assert.equal(state.elapsed, 0);
});

// A frame handing back a negative delta is a clock that has been put back,
// which is not time the pilot spent flying.
test('the clock never runs backwards', () => {
    const state = createRunState(LOOP_COURSE);
    tickRun(state, 4);
    tickRun(state, -10);
    assert.equal(state.elapsed, 4);
});

test('a stage started again is timed from nothing', () => {
    const state = createRunState(LOOP_COURSE);
    tickRun(state, 12);
    restartStage(state);
    assert.equal(state.elapsed, 0);
});

test('the next stage is timed on its own rather than on the last one', () => {
    const state = createRunState(LOOP_COURSE);
    tickRun(state, 12);
    advanceStage(state);
    assert.equal(state.elapsed, 0);
});

// --- Pointing at the gate --------------------------------------------------

const GATE = { index: 0, x: 0, y: 500, z: 4000, radius: 200, dirX: 0, dirZ: 1 };
const HERE = { x: 0, y: 500, z: 0 };

// East is the world's -X, because the card counts the way the nose turns and
// the nose is turned by `headingToYaw`. So a gate out along +X is to the west.
test('a bearing to a gate is read off the same card the heading is', () => {
    assert.equal(gateBearing(GATE, HERE), 0, 'due north');
    assert.equal(gateBearing({ x: -4000, z: 0 }, HERE), 90, 'due east');
    assert.equal(gateBearing({ x: 0, z: -4000 }, HERE), 180, 'due south');
    assert.equal(gateBearing({ x: 4000, z: 0 }, HERE), 270, 'due west');
});

test('a bearing to a gate points the way the direction it names does', () => {
    const gate = { x: 3000, z: 3000 };
    const direction = bearingDirection(gateBearing(gate, HERE));

    // Whatever the bearing reads, the direction it names has to be the way the
    // gate actually lies - which is the round trip the two functions make.
    assert.ok(Math.abs(direction.x - Math.SQRT1_2) < 1e-9);
    assert.ok(Math.abs(direction.z - Math.SQRT1_2) < 1e-9);
});

test('the distance to a gate is the distance there is to fly over the ground', () => {
    assert.equal(gateDistance(GATE, HERE), 4000);
    assert.equal(gateDistance({ x: 3000, z: 4000 }, HERE), 5000);
    assert.equal(gateDistance({ x: 0, y: 9000, z: 4000 }, HERE), 4000,
        'a gate overhead is no further off over the ground for being high');
});

test('a bearing off the nose says which way to turn', () => {
    assert.equal(relativeBearing(90, 0), 90, 'to the right');
    assert.equal(relativeBearing(270, 0), -90, 'to the left');
    assert.equal(relativeBearing(0, 90), -90);
    assert.equal(relativeBearing(350, 10), -20, 'and the short way round north');
    assert.equal(relativeBearing(10, 350), 20);
});

test('a gate is pointed at with the eight points the compass names', () => {
    assert.equal(gateArrow(0), GATE_ARROWS[0]);
    assert.equal(gateArrow(90), GATE_ARROWS[2]);
    assert.equal(gateArrow(180), GATE_ARROWS[4]);
    assert.equal(gateArrow(-90), GATE_ARROWS[6]);
    assert.equal(gateArrow(-170), GATE_ARROWS[4], 'and wraps rather than falling off');
    assert.equal(gateArrow(359), GATE_ARROWS[0]);
});

test('a gate in front of the aircraft is in view and one behind it is not', () => {
    assert.equal(gateInView(0), true);
    assert.equal(gateInView(GATE_IN_VIEW), true);
    assert.equal(gateInView(-GATE_IN_VIEW), true);
    assert.equal(gateInView(GATE_IN_VIEW + 1), false);
    assert.equal(gateInView(180), false);
});

// A readout that never goes away is a readout nobody reads, so a gate on the
// screen is not pointed at.
test('a gate the pilot can see is not pointed at', () => {
    const state = createRunState(LOOP_COURSE);
    assert.equal(gatePointer(state, [GATE], HERE, 0), null);
});

test('a gate off the screen is pointed at, with the way to turn and how far', () => {
    const state = createRunState(LOOP_COURSE);
    const pointer = gatePointer(state, [GATE], HERE, 180);

    assert.equal(pointer.index, 0);
    assert.equal(pointer.bearing, 0);
    assert.equal(Math.abs(pointer.relative), 180);
    assert.equal(pointer.distance, 4000);
    assert.equal(pointer.arrow, GATE_ARROWS[4], 'behind you');
});

test('the gate pointed at is the one the course is waiting on', () => {
    const state = createRunState(LOOP_COURSE);
    const course = [GATE, { index: 1, x: 4000, y: 500, z: 0, radius: 200, dirX: 1, dirZ: 0 }];

    recordGate(state, 0);
    const pointer = gatePointer(state, course, HERE, 180);

    assert.equal(pointer.index, 1);
    assert.equal(pointer.bearing, 270, 'the second gate is out along +X, which is west');
});

test('nothing is pointed at when there is no gate outstanding', () => {
    assert.equal(gatePointer(createRunState(), [GATE], HERE, 180), null,
        'a free flight has no course');
    assert.equal(gatePointer(createRunState(RUNWAY_LANDING), [GATE], HERE, 180), null,
        'and a landing has no gates');
    assert.equal(gatePointer(createRunState(LOOP_COURSE), [], HERE, 180), null,
        'nor has a course that has not been laid yet');
});

// --- A gate laid over ------------------------------------------------------

/**
 * A step across a gate's plane, `span` units along the gate's own width and
 * `rise` units up its own vertical.
 *
 * Written in the gate's frame rather than the world's because that is the whole
 * of what banking changes: a gate laid over at half a right angle has an opening
 * whose wide way climbs, and a step that would have gone through it upright goes
 * past it now. Anything measuring the crossing in world height would be
 * measuring the wrong thing and agreeing with itself about it.
 */
function crossAt(ring, span, rise) {
    const axes = gateAxes(ring);
    const run  = ring.radius * 3;
    const at = (side) => ({
        x: ring.x + axes.span.x * span + axes.rise.x * rise + ring.dirX * run * side,
        y: ring.y + axes.span.y * span + axes.rise.y * rise,
        z: ring.z + axes.span.z * span + axes.rise.z * rise + ring.dirZ * run * side
    });

    return { from: at(-1), to: at(1) };
}

test('a gate that names no shape is the round one a course was always flown through', () => {
    assert.equal(gateAspect({ radius: 200 }), 1, 'nothing named');
    assert.equal(gateAspect({ radius: 200, aspect: 0 }), 1, 'nor a shape with no height to it');
    assert.equal(gateAspect({ radius: 200, aspect: -1 }), 1, 'nor one turned inside out');
    assert.equal(gateAspect(null), 1);
    assert.equal(gateAspect({ radius: 200, aspect: 0.5 }), 0.5, 'and a shape named is the shape');
});

test('a level gate opens across the way the course runs and straight up', () => {
    const { span, rise } = gateAxes({ dirX: 0, dirZ: 1 });

    assert.ok(Math.abs(span.x - 1) < 1e-9, 'the width lies across the course');
    assert.ok(Math.abs(span.y) < 1e-9, 'and does not climb');
    assert.ok(Math.abs(rise.y - 1) < 1e-9, 'the height is the world vertical');
});

test('banking a gate turns its opening about the way the course runs', () => {
    const { span, rise } = gateAxes({ dirX: 0, dirZ: 1, bank: Math.PI / 2 });

    // A quarter turn puts the gate's width where its height was.
    assert.ok(Math.abs(span.y - 1) < 1e-9, 'the width now climbs');
    assert.ok(Math.abs(rise.x + 1) < 1e-9, 'and the height lies across the course');

    for (const axis of [span, rise]) {
        assert.ok(Math.abs(Math.hypot(axis.x, axis.y, axis.z) - 1) < 1e-9,
            'a turn is a turn: neither axis changes length');
    }
});

test('a gate narrower one way is flown through at the angle it was laid at', () => {
    const level  = { x: 0, y: 500, z: 0, radius: 200, aspect: 0.5, dirX: 0, dirZ: 1 };
    const banked = { ...level, bank: Math.PI / 2 };

    // 150 units along the wide way is inside; the same 150 up the narrow way,
    // which only reaches 100, is outside. That is true of both gates - what the
    // bank changes is which way through the world those two directions point.
    for (const gate of [level, banked]) {
        const wide   = crossAt(gate, 150, 0);
        const narrow = crossAt(gate, 0, 150);

        assert.equal(gatePassed(gate, wide.from, wide.to), true,
            'the wide way across is the way through');
        assert.equal(gatePassed(gate, narrow.from, narrow.to), false,
            'and the narrow way is not');
    }

    // The same step in the world, put to each gate: the one that is level takes
    // it and the one laid on its side does not.
    const across = { from: { x: -150, y: 500, z: -50 }, to: { x: -150, y: 500, z: 50 } };
    assert.equal(gatePassed(level, across.from, across.to), true);
    assert.equal(gatePassed(banked, across.from, across.to), false,
        'a gate on its side is 100 units wide where it was 200');
});

test('a gate laid over is missed on the same rule it is flown on', () => {
    const banked = { x: 0, y: 500, z: 0, radius: 200, aspect: 0.5, bank: Math.PI / 2, dirX: 0, dirZ: 1 };
    const narrow = crossAt(banked, 0, 150);

    assert.equal(gateMissed(banked, narrow.from, narrow.to), true,
        'outside the opening, going the way the course runs');
    assert.equal(gateMissed(banked, narrow.to, narrow.from), false,
        'and coming back at it is still the turn');
});

test('a crossing still reports how far off the middle of the hoop it landed', () => {
    const banked = { x: 0, y: 500, z: 0, radius: 200, aspect: 0.5, bank: 0.6, dirX: 0, dirZ: 1 };
    const { from, to } = crossAt(banked, 120, 0);
    const crossing = gateCrossing(banked, from, to);

    assert.ok(Math.abs(crossing.offset - 120) < 1e-6,
        'the offset is a distance in the world, whatever angle the gate is at');
    assert.equal(crossing.inside, true);
    assert.equal(crossing.forward, true);
});

test('a course is laid at the banks its stage asks for', () => {
    const state = createRunState(LOOP_COURSE);

    do {
        const stage = currentStage(state);
        const { rings } = worldFor(state);

        for (const ring of rings) {
            assert.equal(ring.aspect, stage.rings.aspect,
                'every gate of a stage is the shape the stage was written as');
            assert.ok(Math.abs(ring.bank) <= stage.rings.bank + 1e-9,
                'and is laid no further over than the stage allows');
        }

        if (stage.rings.bank > 0) {
            assert.ok(rings.some(ring => ring.bank < 0) && rings.some(ring => ring.bank > 0),
                'a course banked one way only would be flown with one wing down');
        }
    } while (advanceStage(state));
});

test('the first stage is the round upright course it always was, and the rest lean', () => {
    const [first, ...rest] = getGameMode(LOOP_COURSE).stages;

    assert.equal(first.rings.aspect, 1, 'nothing to line up on but the gate itself');
    assert.equal(first.rings.bank, 0);

    let aspect = first.rings.aspect;
    let bank   = first.rings.bank;
    for (const stage of rest) {
        assert.ok(stage.rings.aspect < aspect, `${stage.label} should close up on the one before it`);
        assert.ok(stage.rings.bank > bank, `${stage.label} should lie further over`);
        aspect = stage.rings.aspect;
        bank   = stage.rings.bank;
    }
});

// --- The help a landing stage is given -------------------------------------

test('the approach and its guidance are measured off one end of the strip', () => {
    const state = createRunState(RUNWAY_LANDING);
    const { runway } = worldFor(state);

    assert.deepEqual(approachThreshold(runway), runwayThresholds(runway)[0],
        'a strip has two ends, and which one is the threshold is decided once');
    assert.equal(approachThreshold(null), null);
});

test('the first stage is given the whole of the help, and the last none of it', () => {
    const state = createRunState(RUNWAY_LANDING);

    const first = approachGuidance(state, worldFor(state).runway);
    assert.equal(first.marks.length, CENTRELINE_MARKS, 'a lead-in back down the approach');
    assert.ok(first.threshold, 'and a bar across the threshold');

    advanceStage(state);
    const second = approachGuidance(state, worldFor(state).runway);
    assert.equal(second.marks.length, 0, 'the lead-in is the first thing withdrawn');
    assert.ok(second.threshold, 'and the marker outlives it');

    while (advanceStage(state)) { /* on to the last stage */ }
    assert.equal(approachGuidance(state, worldFor(state).runway), null,
        'by the last stage the strip is where the pilot works out it is');
});

test('the lead-in runs back down the approach rather than out the far end', () => {
    const state = createRunState(RUNWAY_LANDING);
    const { runway } = worldFor(state);

    const { marks, threshold, heading, width, elevation } = approachGuidance(state, runway);
    const back = bearingDirection(wrapDegrees(approachThreshold(runway).heading + 180));

    assert.equal(heading, approachThreshold(runway).heading, 'laid across the strip it belongs to');
    assert.equal(width, runway.width);
    assert.equal(elevation, runway.elevation);

    marks.forEach((mark, index) => {
        const step = CENTRELINE_REACH / CENTRELINE_MARKS * (index + 1);
        assert.ok(Math.abs(mark.x - (threshold.x + back.x * step)) < 1e-6, 'on the extended centreline');
        assert.ok(Math.abs(mark.z - (threshold.z + back.z * step)) < 1e-6);
    });

    const last = marks[marks.length - 1];
    assert.ok(Math.hypot(last.x - runway.x, last.z - runway.z) > runway.length / 2,
        'and reaching out past the strip rather than lying along it');
});

test('there is nothing to draw where there is nothing to find', () => {
    const strip = { x: 0, z: 0, heading: 0, length: 3000, width: 300, alongX: 0, alongZ: 1 };

    assert.equal(approachGuidance(createRunState(RUNWAY_LANDING), null), null,
        'a world with no strip in it');
    assert.equal(approachGuidance(createRunState(LOOP_COURSE), strip), null, 'a course stage');
    assert.equal(approachGuidance(createRunState(), strip), null, 'and a free flight');
});
