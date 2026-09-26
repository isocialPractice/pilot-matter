import test from 'node:test';
import assert from 'node:assert/strict';
import {
    LOOP_COURSE,
    createRunState,
    currentStage,
    stageNumber,
    isStageComplete,
    advanceStage,
    recordCrash,
    nextGate,
    flyStep,
    tickRun,
    buildCourse
} from '../js/game-modes.js';
import {
    createBestTimesState,
    recordStageTime,
    stageReport,
    bestTime
} from '../js/best-times.js';
import { formatStageClock } from '../js/hud.js';
import { markClass } from '../js/minimap.js';

/**
 * A stage of a course, flown out.
 *
 * Everything a pilot is told at the end of a stage happens after a gate is
 * actually flown through, which used to be the one thing nothing here could do:
 * a 240 unit hoop 2600 units down its own axis is not something the flight keys
 * can be tapped into hitting from a test. `flyStep` is the seam that makes it
 * possible - a step of flight put to the gate the course is waiting on - so the
 * card, the clock, the board, and the mark on the chart are checked against a
 * course being flown rather than against a run state written by hand.
 */

// A storage that behaves the way the browser's does, so a board can be written
// in one session and read back in the next.
function fakeStorage(values = {}) {
    const held = { ...values };
    return {
        getItem: (key) => held[key] ?? null,
        setItem: (key, value) => { held[key] = String(value); }
    };
}

// A step of flight across a gate's plane, `offset` units off the middle of the
// hoop. A gate is crossed rather than arrived at, so what it takes to fly one
// is two positions either side of its plane - which is the whole of what
// `flyStep` asks for.
function crossGate(ring, offset) {
    const run = ring.radius * 2;
    return {
        from: { x: ring.x - ring.dirX * run, y: ring.y + offset, z: ring.z - ring.dirZ * run },
        to:   { x: ring.x + ring.dirX * run, y: ring.y + offset, z: ring.z + ring.dirZ * run }
    };
}

/** Straight through the middle of the hoop, which is the gate flown. */
function throughGate(ring) {
    return crossGate(ring, 0);
}

/** Across the plane a clear radius outside the hoop, which is the gate missed. */
function pastGate(ring) {
    return crossGate(ring, ring.radius * 2);
}

// The same course every time, so a time is the seconds put on the clock rather
// than the shape a seed happened to lay.
const COURSE_SEED = 11;

function layCourse(run) {
    return buildCourse(currentStage(run), { seed: COURSE_SEED });
}

/**
 * Flies the stage under way, gate by gate, with `seconds` on the clock between
 * each. Returns what the board made of the time, which is what the card is
 * written from.
 */
function flyStage(run, board, seconds) {
    const course = layCourse(run);

    for (const ring of course) {
        tickRun(run, seconds);
        const { from, to } = throughGate(ring);
        flyStep(run, course, from, to);
    }

    return recordStageTime(board, run.modeId, run.stageIndex, run.elapsed);
}

test('a stage flown out gate by gate ends in the card the pilot reads', () => {
    const run = createRunState(LOOP_COURSE);
    const board = createBestTimesState(fakeStorage());
    const course = layCourse(run);

    assert.equal(course.length, currentStage(run).rings.count);

    let finished = false;
    course.forEach((ring, index) => {
        assert.equal(nextGate(run), index, 'the course waits on each gate in turn');

        tickRun(run, 4);
        const { from, to } = throughGate(ring);
        const step = flyStep(run, course, from, to);

        assert.equal(step.gate, index);
        assert.ok(step.passed, `gate ${index} should be flown through`);
        finished = step.finished;
    });

    assert.ok(finished, 'the last gate is what finishes the stage');
    assert.ok(isStageComplete(run));
    assert.equal(nextGate(run), -1, 'and the course has nothing left to wait on');

    assert.equal(run.elapsed, 12);
    assert.equal(
        stageReport(recordStageTime(board, run.modeId, run.stageIndex, run.elapsed)),
        'NEW BEST  ·  0:12.0'
    );
});

test('a stage flown slower than the board reads as a time rather than a best', () => {
    const run = createRunState(LOOP_COURSE);
    const board = createBestTimesState(fakeStorage());

    assert.equal(stageReport(flyStage(run, board, 4)), 'NEW BEST  ·  0:12.0');

    recordCrash(run);
    assert.equal(stageReport(flyStage(run, board, 9)), 'STAGE TIME  ·  0:27.0');

    recordCrash(run);
    assert.equal(stageReport(flyStage(run, board, 2)), 'NEW BEST  ·  0:06.0',
        'and a faster one takes the board back');
});

// A stage the clock never ran on is a stage nothing was flown in, whatever the
// gates say, so there is no time to report and none to put on the board.
test('a stage finished on the frame it opened is reported as nothing at all', () => {
    const run = createRunState(LOOP_COURSE);
    const board = createBestTimesState(fakeStorage());

    assert.equal(stageReport(flyStage(run, board, 0)), '');
    assert.equal(bestTime(board, LOOP_COURSE, 0), null);
});

test('the next stage opens on its own clock, waiting on its own first gate', () => {
    const run = createRunState(LOOP_COURSE);
    const board = createBestTimesState(fakeStorage());

    flyStage(run, board, 4);
    assert.equal(stageNumber(run), 1);

    assert.ok(advanceStage(run), 'a course with stages left moves on to the next');
    assert.equal(stageNumber(run), 2);
    assert.equal(run.elapsed, 0, 'the next stage is timed from its own beginning');
    assert.equal(nextGate(run), 0);

    assert.equal(
        formatStageClock(run.elapsed, bestTime(board, run.modeId, run.stageIndex)),
        'TIME -:--.-  ·  BEST -:--.-',
        'a stage nobody has flown has neither a time nor a time to beat'
    );

    tickRun(run, 0.02);
    assert.equal(formatStageClock(run.elapsed, null), 'TIME 0:00.0  ·  BEST -:--.-');
});

test('a best time flown in one session is the time to beat in the next', () => {
    const storage = fakeStorage();
    const run = createRunState(LOOP_COURSE);

    assert.ok(flyStage(run, createBestTimesState(storage), 4).best);

    const reloaded = createBestTimesState(storage);
    assert.equal(bestTime(reloaded, LOOP_COURSE, 0), 12);
    assert.equal(
        formatStageClock(0, bestTime(reloaded, LOOP_COURSE, 0)),
        'TIME -:--.-  ·  BEST 0:12.0'
    );
});

// The mark is drawn from the gate the course is waiting on, on the chart and on
// the hoops alike, so a course being flown should light one gate at a time and
// nothing once the stage is out.
test('the mark on the course moves on as each loop is flown', () => {
    const run = createRunState(LOOP_COURSE);
    const course = layCourse(run);
    const marks = () => course.map((_, at) => markClass(at, nextGate(run)));

    assert.deepEqual(marks(), ['next', 'ahead', 'ahead']);

    for (const expected of [['flown', 'next', 'ahead'], ['flown', 'flown', 'next']]) {
        const { from, to } = throughGate(course[nextGate(run)]);
        flyStep(run, course, from, to);
        assert.deepEqual(marks(), expected);
    }

    const last = throughGate(course[nextGate(run)]);
    flyStep(run, course, last.from, last.to);
    assert.deepEqual(marks(), ['flown', 'flown', 'flown'],
        'a stage flown out has nothing left lit');
});

test('a gate gone past leaves the course waiting on the same gate', () => {
    const run = createRunState(LOOP_COURSE);
    const course = layCourse(run);
    const gate = course[0];

    const missed = pastGate(gate);
    assert.deepEqual(flyStep(run, course, missed.from, missed.to),
        { gate: 0, passed: false, missed: true, finished: false });
    assert.equal(nextGate(run), 0, 'the gate missed is still the gate to fly');
    assert.equal(run.missed, 1);

    const round = throughGate(gate);
    assert.ok(flyStep(run, course, round.from, round.to).passed,
        'and coming round again flies it');
    assert.equal(nextGate(run), 1);
});

test('a step that crosses no gate leaves the run exactly where it was', () => {
    const run = createRunState(LOOP_COURSE);
    const course = layCourse(run);
    const ring = course[0];

    const along = (distance) => ({
        x: ring.x + ring.dirX * distance, y: ring.y, z: ring.z + ring.dirZ * distance
    });

    assert.deepEqual(flyStep(run, course, along(5000), along(6000)),
        { gate: 0, passed: false, missed: false, finished: false });
    assert.equal(nextGate(run), 0);
    assert.equal(run.missed, 0);
});

test('there is no gate to fly on a free flight or on a stage already flown out', () => {
    const free = createRunState();
    assert.deepEqual(flyStep(free, [], { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 1 }),
        { gate: -1, passed: false, missed: false, finished: false });

    const run = createRunState(LOOP_COURSE);
    const board = createBestTimesState(fakeStorage());
    const course = layCourse(run);
    flyStage(run, board, 4);

    const { from, to } = throughGate(course[0]);
    assert.deepEqual(flyStep(run, course, from, to),
        { gate: -1, passed: false, missed: false, finished: false },
        'flying back through a gate on a finished stage is not progress');
});

// The clock is put back with the stage, so a stage flown twice is timed as the
// attempt that finished it rather than as everything the pilot did getting
// there.
test('a stage restarted is timed from where it restarted', () => {
    const run = createRunState(LOOP_COURSE);
    const board = createBestTimesState(fakeStorage());
    const course = layCourse(run);

    tickRun(run, 30);
    const { from, to } = throughGate(course[0]);
    assert.ok(flyStep(run, course, from, to).passed);

    assert.ok(recordCrash(run), 'a crash puts the stage back to its beginning');
    assert.equal(run.elapsed, 0);
    assert.equal(nextGate(run), 0);

    assert.equal(stageReport(flyStage(run, board, 4)), 'NEW BEST  ·  0:12.0',
        'the thirty seconds before the crash are no part of the time flown');
});
