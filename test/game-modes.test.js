import test from 'node:test';
import assert from 'node:assert/strict';
import {
    RUNWAY_LANDING,
    LOOP_COURSE,
    DEAD_STICK,
    CARGO_RUN,
    SEARCH_RESCUE,
    LAND_OBJECTIVE,
    LOOP_OBJECTIVE,
    CARGO_OBJECTIVE,
    SEARCH_OBJECTIVE,
    ENGINE_LIVE,
    ENGINE_DEAD,
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
    blendBearing,
    runEngine,
    engineLive,
    stageBudget,
    stageStrips,
    burnFuel,
    fuelRemaining,
    nextStrip,
    stripIndex,
    progressNoun,
    stageMarker,
    recordRescue,
    searchBriefing,
    stripPointer,
    runPointer,
    chartCourse,
    chartNext,
    RESCUE_RADIUS,
    RESCUE_STOP_SPEED
} from '../js/game-modes.js';
import { isStartValue, START_FIELD_IDS, START_FLYING, startField } from '../js/config.js';
import {
    buildEnvironment, getEnvironment, MODE_ENVIRONMENTS, isEnvironmentId
} from '../js/environment/presets.js';
import {
    sampleHeight, runwayThresholds, runwayDirection, runwayOffsets
} from '../js/environment/elements.js';
import { FEET_PER_UNIT, KNOTS_PER_UNIT, headingToYaw } from '../js/units.js';
import {
    glideSpeed, glideDescent, convergeSpeed, sinkRate, GLIDE_ACCEL, GLIDE_DECEL
} from '../js/flight-model.js';

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
        segments, seed: world.seed, base: world.base,
        // A route describes its world outright rather than asking for a strip
        // and being given one, so the description goes through when there is
        // one. Everything else leaves it null and is laid from the preset.
        runway: world.runway, elements: world.elements ?? undefined
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

test('every mode is a world, an objective, and stages', () => {
    assert.deepEqual(GAME_MODE_IDS,
        [RUNWAY_LANDING, LOOP_COURSE, DEAD_STICK, CARGO_RUN, SEARCH_RESCUE]);

    const objectives = [LAND_OBJECTIVE, LOOP_OBJECTIVE, CARGO_OBJECTIVE, SEARCH_OBJECTIVE];

    for (const mode of GAME_MODES) {
        assert.ok(mode.label.length > 0, `${mode.id} needs a label to be listed by`);
        assert.ok(mode.description.length > 0, `${mode.id} needs a line saying what it is`);
        assert.ok(mode.goal.length > 0, `${mode.id} needs an objective the HUD can write`);
        assert.ok(objectives.includes(mode.objective));
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
    assert.equal(missNotice(state), 'LOOP 1 MISSED  ·  COME ROUND');

    recordGate(state, 0);
    assert.equal(missNotice(state), 'LOOP 2 MISSED  ·  COME ROUND');
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

// --- The engine, and the budget that keeps it turning ----------------------

// A dead stick is the mode's own condition rather than something that happens
// during it: the lever is dead from the first frame and stays dead, so the
// whole flight is the glide.
test('a dead stick has no engine from the moment the stage is laid out', () => {
    const state = createRunState(DEAD_STICK);

    assert.equal(runEngine(state), ENGINE_DEAD);
    assert.equal(engineLive(state), false);

    // Through every stage of it, and through a restart, because a stage flown
    // a second time is the same stage.
    do {
        assert.equal(runEngine(state), ENGINE_DEAD, `stage ${stageNumber(state)}`);
        restartStage(state);
        assert.equal(runEngine(state), ENGINE_DEAD, 'and after it is put back to the start');
    } while (advanceStage(state));
});

test('a dead stick opens gliding, with the lever already where it will stay', () => {
    const state = createRunState(DEAD_STICK);
    const { runway } = worldFor(state);
    const { start } = stageStart(state, { runway });

    assert.equal(start.throttlePercent, 0, 'nothing to open the lever for');
    assert.ok(start.airspeedKnots > 0, 'but flying, because a glide is still flying');
    assert.ok(isStartValue('airspeedKnots', start.airspeedKnots),
        'at a speed the configuration can hold');
});

// Everything else keeps its engine, including free flight - which has no budget
// to run out of and should never be able to lose one by accident.
test('every other run has an engine', () => {
    assert.equal(runEngine(createRunState()), ENGINE_LIVE, 'free flight');

    for (const id of [RUNWAY_LANDING, LOOP_COURSE, SEARCH_RESCUE]) {
        assert.equal(runEngine(createRunState(id)), ENGINE_LIVE, id);
    }
});

test('a route opens with its budget full and spends it on the throttle alone', () => {
    const state = createRunState(CARGO_RUN);
    const budget = stageBudget(state);

    assert.ok(budget > 0, 'a route is flown against something');
    assert.equal(state.fuel, budget, 'and opens with all of it');
    assert.equal(fuelRemaining(state), 1);

    // A closed lever costs nothing, which is what makes a glide worth flying.
    burnFuel(state, 0, 10);
    assert.equal(state.fuel, budget, 'a closed throttle spends nothing');

    // And the burn is the lever setting, so half open costs half a second a
    // second rather than all of it or none.
    burnFuel(state, 0.5, 10);
    assert.equal(state.fuel, budget - 5);

    burnFuel(state, 1, 5);
    assert.equal(state.fuel, budget - 10, 'and wide open costs a second a second');
    assert.ok(Math.abs(fuelRemaining(state) - (budget - 10) / budget) < 1e-9);
});

test('a budget spent out takes the engine and leaves the run flying', () => {
    const state = createRunState(CARGO_RUN);

    assert.equal(engineLive(state), true);
    burnFuel(state, 1, stageBudget(state) * 2);

    assert.equal(state.fuel, 0, 'a budget stops at empty rather than going under it');
    assert.equal(runEngine(state), ENGINE_DEAD, 'and the engine goes with the last of it');
    assert.equal(state.complete, false, 'the stage is still there to be flown out');

    // Which is the thing a restart puts back, because a run out of fuel is
    // something to fly again rather than something to sit in.
    restartStage(state);
    assert.equal(fuelRemaining(state), 1);
    assert.equal(engineLive(state), true);
});

// Nothing without a budget has one to read, which is what leaves the clock row
// of every other mode writing the time to beat.
test('a run with no budget has no fuel to report', () => {
    for (const id of [null, RUNWAY_LANDING, LOOP_COURSE, DEAD_STICK, SEARCH_RESCUE]) {
        assert.equal(fuelRemaining(createRunState(id)), null, `${id}`);
    }
});

// --- A route ---------------------------------------------------------------

test('a route lays a strip per stop, and stands them apart', () => {
    const state = createRunState(CARGO_RUN);

    do {
        const stage = currentStage(state);
        const { field } = worldFor(state, 140);

        assert.equal(field.runways.length, stageStrips(state),
            `${stage.label} asks for ${stageStrips(state)} strips`);
        assert.deepEqual(field.runways.map(strip => strip.index),
            field.runways.map((_, at) => at), 'numbered in the order they were laid');

        for (let a = 0; a < field.runways.length; a++) {
            for (let b = a + 1; b < field.runways.length; b++) {
                const gap = Math.hypot(field.runways[a].x - field.runways[b].x,
                                       field.runways[a].z - field.runways[b].z);
                assert.ok(gap >= stage.separation * 0.9,
                    `${stage.label} put two strips ${Math.round(gap)} apart, `
                  + `asking for ${stage.separation}`);
            }
        }
    } while (advanceStage(state));
});

// A route is an order as much as a set of arrivals, which is the same rule a
// course of loops is flown under and is written the same way.
test('a route counts the strip it is up to and nothing else', () => {
    const state = createRunState(CARGO_RUN);
    const total = stageStrips(state);

    assert.equal(nextStrip(state), 0);
    assert.equal(recordLanding(state, { index: 1 }), false, 'the strip further on is not yet');
    assert.equal(recordLanding(state, null), false, 'and open ground is no strip at all');
    assert.equal(state.leg, 0);

    assert.equal(recordLanding(state, { index: 0 }), true);
    assert.equal(state.leg, 1);
    assert.equal(nextStrip(state), 1);
    assert.equal(isStageComplete(state), total <= 1);

    assert.equal(recordLanding(state, { index: 0 }), false, 'and the one behind is not again');
    assert.equal(state.leg, 1);

    for (let leg = 1; leg < total; leg++) assert.equal(recordLanding(state, { index: leg }), true);

    assert.equal(isStageComplete(state), true);
    assert.equal(nextStrip(state), -1, 'and a route flown out is waiting on nothing');
});

// A route that has run out of strips is waiting on nothing, and an arrival on
// open ground is no strip at all - two absences that must not read as a match.
test('a route flown out counts nothing more, least of all a field landing', () => {
    const state = createRunState(CARGO_RUN);
    const total = stageStrips(state);

    for (let leg = 0; leg < total; leg++) assert.equal(recordLanding(state, { index: leg }), true);

    assert.equal(nextStrip(state), -1, 'the route is waiting on nothing');
    assert.equal(stripIndex(null), -1, 'and open ground answers to nothing');

    assert.equal(recordLanding(state, null), false, 'so putting down in a field is not a leg');
    assert.equal(recordLanding(state, {}), false, 'nor is a strip laid before they were numbered');
    assert.equal(state.leg, total, 'and the route is still the length it was flown');
});

test('a strip with no number is no strip a route can count', () => {
    assert.equal(stripIndex(null), -1);
    assert.equal(stripIndex({}), -1, 'a strip a world laid before it numbered them');
    assert.equal(stripIndex({ index: 0 }), 0, 'and zero is a number, not an absence of one');
});

test('a route says how far down it the pilot is, in the word it counts in', () => {
    const state = createRunState(CARGO_RUN);

    assert.equal(progressNoun(state), 'LEG');
    assert.ok(runStatus(state).includes(`LEG 1 OF ${stageStrips(state)}`));

    recordLanding(state, { index: 0 });
    assert.ok(runStatus(state).includes('LEG 2 OF'));
    assert.equal(progressNoun(createRunState(LOOP_COURSE)), 'LOOP');
});

// Every other mode takes the ground its preset describes. Only a route needs
// more strips than a world lays on its own, so only a route describes one.
test('only a route describes its own world', () => {
    for (const id of [RUNWAY_LANDING, LOOP_COURSE, DEAD_STICK, SEARCH_RESCUE]) {
        assert.equal(stageWorld(createRunState(id)).elements, null, id);
    }

    assert.ok(Array.isArray(stageWorld(createRunState(CARGO_RUN)).elements));
});

// --- A search --------------------------------------------------------------

test('the marker stands where the briefing says it does, from the start', () => {
    const state = createRunState(SEARCH_RESCUE);

    do {
        const marker = stageMarker(state);
        const { start, position } = stageStart(state, {});

        assert.equal(position.x, 0, 'a search opens where its bearings were measured from');
        assert.equal(position.z, 0);
        assert.equal(start.runway, false, 'over country with nothing prepared to arrive on');

        // The bearing and the distance the pilot is given are the bearing and
        // the distance to the marker, read on the card the compass is written
        // on rather than on one of its own.
        assert.ok(Math.abs(directionToBearing(marker.x, marker.z) - marker.bearing) < 1e-6);
        assert.ok(Math.abs(Math.hypot(marker.x, marker.z) - marker.distance) < 1e-6);
        assert.ok(marker.radius > 0, 'and beside it is a distance rather than a point');
    } while (advanceStage(state));
});

test('nothing but a search has a marker to find', () => {
    for (const id of [null, RUNWAY_LANDING, LOOP_COURSE, DEAD_STICK, CARGO_RUN]) {
        assert.equal(stageMarker(createRunState(id)), null, `${id}`);
    }
});

test('a search is flown out by setting down beside the marker', () => {
    const state = createRunState(SEARCH_RESCUE);
    const marker = stageMarker(state);
    const down = { x: marker.x, z: marker.z, speed: 0, airborne: false, crashed: false };

    assert.equal(isStageComplete(state), false);
    assert.equal(recordRescue(state, marker, down), true);
    assert.equal(isStageComplete(state), true);
    assert.equal(recordRescue(state, marker, down), false, 'and found once is found');
});

test('a search is not flown out by anything short of being down beside it', () => {
    const state = createRunState(SEARCH_RESCUE);
    const marker = stageMarker(state);
    const down = { x: marker.x, z: marker.z, speed: 0, airborne: false, crashed: false };

    const refused = {
        'still flying over it': { ...down, airborne: true },
        'rolling through it':   { ...down, speed: RESCUE_STOP_SPEED + 1 },
        'rolling backwards':    { ...down, speed: -(RESCUE_STOP_SPEED + 1) },
        'a wreck beside it':    { ...down, crashed: true },
        'stopped outside it':   { ...down, x: marker.x + marker.radius + 1 }
    };

    for (const [what, report] of Object.entries(refused)) {
        assert.equal(recordRescue(state, marker, report), false, what);
        assert.equal(state.found, false, what);
    }

    assert.equal(recordRescue(state, null, down), false, 'and nothing to be beside is not beside it');
    assert.equal(state.found, false);

    // The edge of the circle is inside it, because beside it is a circle the
    // pilot is told the size of rather than one they have to beat.
    assert.equal(recordRescue(state, marker, { ...down, x: marker.x + marker.radius }), true);
});

// A distance that is not a number is not a distance inside the circle either,
// and `NaN > radius` is false - so the place is read before it is measured.
test('a set-down that does not say where it was is not a rescue', () => {
    const state = createRunState(SEARCH_RESCUE);
    const marker = stageMarker(state);
    const stopped = { speed: 0, airborne: false, crashed: false };

    assert.equal(recordRescue(state, marker, stopped), false, 'a report carrying no place');
    assert.equal(recordRescue(state, marker, { ...stopped, x: marker.x }), false, 'or only half of one');
    assert.equal(recordRescue(state, marker, { ...stopped, x: NaN, z: NaN }), false, 'or nowhere at all');
    assert.equal(state.found, false);

    // And the same report with the place in it is the rescue it always was.
    assert.equal(recordRescue(state, marker, { ...stopped, x: marker.x, z: marker.z }), true);
});

test('a stage naming no circle of its own is given the one every search has', () => {
    assert.ok(RESCUE_RADIUS > 0);
    assert.ok(RESCUE_STOP_SPEED > 0);
});

// --- Where the run is pointed ----------------------------------------------

test('the pointer names whatever the run is waiting on', () => {
    const route = createRunState(CARGO_RUN);
    const strips = [{ x: 4000, z: 0, index: 0 }, { x: 0, z: 4000, index: 1 }];
    const here = { x: 0, z: 0, y: 500 };

    const leg = runPointer(route, { runways: strips }, here, 0);
    assert.equal(leg.label, 'LEG 1');
    assert.equal(leg.index, 0);
    assert.ok(Math.abs(leg.distance - 4000) < 1e-6);

    recordLanding(route, { index: 0 });
    assert.equal(runPointer(route, { runways: strips }, here, 0).label, 'LEG 2',
        'which moves on with the route');

    // A strip is a grey mark on grey country rather than a lit hoop, so a strip
    // straight ahead is still pointed at - unlike a gate, which is not.
    const onTheNose = runPointer(route, { runways: strips }, here, 0);
    assert.ok(onTheNose, 'a strip on the nose is still worth pointing at');
    assert.ok(Math.abs(onTheNose.relative) < GATE_IN_VIEW, 'even though a gate there would not be');
});

test('a search is given its briefing rather than a needle that follows the marker', () => {
    const state = createRunState(SEARCH_RESCUE);
    const marker = stageMarker(state);

    const briefing = searchBriefing(state);
    assert.equal(briefing.arrow, '', 'a bearing given rather than a direction pointed');
    assert.equal(briefing.bearing, marker.bearing);
    assert.equal(briefing.distance, marker.distance);

    // Read off the start, so flying half of it does not change what it says.
    const flown = { x: marker.x / 2, z: marker.z / 2, y: 600 };
    assert.deepEqual(runPointer(state, {}, flown, 180), briefing,
        'the briefing is the same briefing wherever the aircraft has got to');

    recordRescue(state, marker, { x: marker.x, z: marker.z, speed: 0, airborne: false });
    assert.equal(runPointer(state, {}, flown, 180), null, 'and goes away once it is answered');
});

test('a route with no strip laid for the leg points at nothing rather than guessing', () => {
    const state = createRunState(CARGO_RUN);

    assert.equal(stripPointer(state, [], { x: 0, z: 0, y: 0 }, 0), null);
    assert.equal(runPointer(createRunState(), {}, { x: 0, z: 0, y: 0 }, 0), null,
        'and so does free flight');
});

// --- What the chart in the corner is given ---------------------------------

/**
 * The chart is the reason a short screen gives for taking the pointer row off,
 * so every mode that writes that row has to be a mode the chart draws for.
 * Under 746 pixels of height the row is gone and the chart is the only thing
 * left saying where the objective is, which it cannot do for a mode it was
 * handed nothing about.
 *
 * The three modes that write the row are the three asserted here. The two that
 * do not - a landing and a free flight - are asserted to draw nothing, because
 * a chart that marked an objective nothing is asking for would be reporting one
 * the card never mentions.
 */
test('every mode that writes the pointer row gives the chart the same thing to draw', () => {
    const STRIPS = [{ x: 4000, z: 0, index: 0 }, { x: 0, z: 4000, index: 1 }];

    const course = buildCourse(currentStage(createRunState(LOOP_COURSE)), {
        seed: 1, size: 16000, sampleHeight: () => 0
    });
    assert.deepEqual(chartCourse(createRunState(LOOP_COURSE), { course }), course,
        'a course is its gates, which is what the chart already drew');

    const route = createRunState(CARGO_RUN);
    assert.deepEqual(chartCourse(route, { runways: STRIPS }), STRIPS,
        'a route is the strips it lands at, in the order it lands at them');

    const search = createRunState(SEARCH_RESCUE);
    const marker = stageMarker(search);
    assert.deepEqual(chartCourse(search, {}), [marker],
        'and a search is the one marker it is looking for');

    for (const id of [RUNWAY_LANDING, DEAD_STICK]) {
        assert.deepEqual(chartCourse(createRunState(id), { runways: STRIPS }), [],
            `${id} has its strip under the nose and writes no pointer row`);
    }
    assert.deepEqual(chartCourse(createRunState(), { runways: STRIPS, course }), [],
        'and a free flight has no objective to be told about at all');
});

// The strips are handed over by position, because `nextStrip` counts legs flown
// and the chart lights the mark at that position. A stage asking for two strips
// over a world that laid three would otherwise mark ground the route never
// visits, and one that laid fewer than it asked for still lines up.
test('a route is given the strips its stage asks for and no others', () => {
    const route = createRunState(CARGO_RUN);
    const asked = stageStrips(route);
    const laid = [0, 1, 2, 3].map(index => ({ x: index * 1000, z: 0, index }));

    assert.ok(asked > 0 && asked < laid.length, 'the stage should ask for fewer than were laid');
    assert.deepEqual(chartCourse(route, { runways: laid }), laid.slice(0, asked));
    assert.deepEqual(chartCourse(route, { runways: laid.slice(0, 1) }), laid.slice(0, 1),
        'and a world that could only take one strip is drawn with the one it has');
    assert.deepEqual(chartCourse(route, {}), [],
        'and a world not laid yet is drawn with nothing');
});

// The chart lights the mark the card is naming, so the two cannot disagree
// about which objective the run is waiting on.
test('the mark the chart lights is the one the pointer row is naming', () => {
    const loops = createRunState(LOOP_COURSE);
    assert.equal(chartNext(loops), nextGate(loops));
    assert.equal(chartNext(loops), 0, 'a course opens waiting on its first gate');

    const route = createRunState(CARGO_RUN);
    assert.equal(chartNext(route), 0);
    recordLanding(route, { index: 0 });
    assert.equal(chartNext(route), nextStrip(route), 'which moves on with the route');
    assert.equal(chartNext(route), 1);

    const search = createRunState(SEARCH_RESCUE);
    assert.equal(chartNext(search), 0, 'a search has one marker and is waiting on it');
    const marker = stageMarker(search);
    recordRescue(search, marker, { x: marker.x, z: marker.z, speed: 0, airborne: false });
    assert.equal(chartNext(search), -1, 'and is waiting on nothing once it is found');

    for (const id of [RUNWAY_LANDING, DEAD_STICK]) {
        assert.equal(chartNext(createRunState(id)), -1, `${id} lights nothing`);
    }
    assert.equal(chartNext(createRunState()), -1, 'and neither does a free flight');
});

// --- The glide a dead stick has to be flown on -----------------------------

/**
 * A glide flown the way `js/aircraft.js` flies one, to the height a strip sits
 * at: converge the airspeed on what the nose is asking for, carry the aircraft
 * forward along that nose, and take the sink off underneath it.
 *
 * The aircraft itself needs a renderer and cannot be run here, so this is the
 * same three lines written out. What it is for is the one thing about these
 * stages that no rule in the module can state: whether the strip a stage opens
 * you out from is a strip you can actually reach.
 *
 * Returns how far it went over the ground before it ran out of height.
 */
function glideReach(altitude, speed, pitch, dt = 0.05, limit = 40000) {
    let height = altitude;
    let airspeed = speed;
    let flown = 0;

    for (let step = 0; step < limit && height > 0; step++) {
        airspeed = convergeSpeed(airspeed, glideSpeed(pitch), dt, GLIDE_ACCEL, GLIDE_DECEL);
        height -= (Math.sin(pitch) * airspeed + sinkRate(airspeed)) * dt;
        flown += Math.cos(pitch) * airspeed * dt;
    }

    return flown;
}

/** The attitude a glide reaches furthest at, which is the one worth finding. */
function bestGlidePitch() {
    let best = { pitch: 0, reach: 0 };

    for (let pitch = -0.4; pitch <= 0.4; pitch += 0.005) {
        const reach = glideSpeed(pitch) * Math.cos(pitch) / glideDescent(pitch);
        if (reach > best.reach) best = { pitch, reach };
    }

    return best.pitch;
}

/** Where a dead stick stage opens, how high, and how far off the strip it is. */
function deadStickOpening(state) {
    const { field, runway } = worldFor(state);
    const { start, position } = stageStart(state, { runway });

    return {
        runway,
        field,
        range: Math.hypot(position.x - runway.x, position.z - runway.z),
        // The height there is to spend is the height over the strip rather than
        // over the sea, because the strip is what the glide has to reach.
        height: start.altitudeFeet / FEET_PER_UNIT - runway.elevation,
        speed: start.airspeedKnots / KNOTS_PER_UNIT
    };
}

// The stages are tuned rather than derived, so nothing in the module says a
// stage is flyable. This does: every one of them is inside the glide the
// aircraft actually has, from the height and the speed it opens at.
test('every dead stick stage opens somewhere the strip can be reached from', () => {
    const state = createRunState(DEAD_STICK);
    const pitch = bestGlidePitch();

    do {
        const { range, height, speed } = deadStickOpening(state);
        const reach = glideReach(height, speed, pitch);

        assert.ok(reach > range,
            `${currentStage(state).label} opens ${Math.round(range)} out with `
          + `${Math.round(reach)} of glide in hand`);
    } while (advanceStage(state));
});

// And the last of them is not reachable by pointing the nose at the strip and
// waiting, which is what makes the mode a glide to be planned rather than a
// descent to be flown. A stage anyone could fall into would not be one.
test('the last dead stick stage wants the glide found rather than the nose pointed', () => {
    const state = createRunState(DEAD_STICK);
    while (advanceStage(state));

    const { range, height, speed } = deadStickOpening(state);

    assert.ok(glideReach(height, speed, 0) < range,
        `${currentStage(state).label} should be past what a level nose reaches`);
    assert.ok(glideReach(height, speed, bestGlidePitch()) > range,
        'and inside what the glide reaches when it is flown well');
});

// The first of them is the other way round, because a mode whose first stage
// asks for the technique is a mode nobody gets past.
test('the first dead stick stage is inside a level glide', () => {
    const { range, height, speed } = deadStickOpening(createRunState(DEAD_STICK));

    assert.ok(glideReach(height, speed, 0) > range,
        'the opening stage should be reachable with the nose simply held level');
});

// --- The budget a route has to be flown on ---------------------------------

// Same question, asked of a route: the budget has to cover the ground, and has
// to not cover it so comfortably that the throttle stops being a decision.
test('every route stage is given enough budget to fly it, and not much more', () => {
    const state = createRunState(CARGO_RUN);

    // A route flown carelessly: cruise the whole way with the lever open far
    // enough to hold it, which is the most expensive way round.
    const CRUISE = 120;
    const CARELESS_THROTTLE = 0.6;

    do {
        const { field } = worldFor(state, 140);
        const { position } = stageStart(state, { runway: field.runways[0] });

        let at = position;
        let route = 0;
        for (const strip of field.runways) {
            route += Math.hypot(at.x - strip.x, at.z - strip.z);
            at = strip;
        }

        const careless = route / CRUISE * CARELESS_THROTTLE;
        const budget = stageBudget(state);

        assert.ok(budget > careless,
            `${currentStage(state).label} is a ${Math.round(route)} unit route on a `
          + `budget of ${budget}, which a careless run spends ${Math.round(careless)} of`);
        assert.ok(budget < careless * 3,
            `${currentStage(state).label} has so much budget that the throttle `
          + 'stops being a decision');
    } while (advanceStage(state));
});
