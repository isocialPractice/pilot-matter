import test from 'node:test';
import assert from 'node:assert/strict';
import {
    BEST_TIMES_STORAGE_KEY,
    NO_TIME,
    stageKey,
    isTime,
    roundTime,
    readBestTimes,
    writeBestTimes,
    createBestTimesState,
    bestTime,
    recordStageTime,
    formatStageTime
} from '../js/best-times.js';

// A storage that behaves the way the browser's does, and one that refuses
// everything the way a sandboxed frame's does.
function fakeStorage(values = {}) {
    const held = { ...values };
    return {
        held,
        getItem: (key) => held[key] ?? null,
        setItem: (key, value) => { held[key] = String(value); }
    };
}

const refusingStorage = {
    getItem() { throw new Error('no storage here'); },
    setItem() { throw new Error('no storage here'); }
};

test('a stage is named by its mode and its place in it, not by its label', () => {
    assert.equal(stageKey('loop-course', 0), 'loop-course:0');
    assert.notEqual(stageKey('loop-course', 0), stageKey('loop-course', 1));
    assert.notEqual(stageKey('loop-course', 0), stageKey('runway-landing', 0));
});

test('a time is a number of seconds somebody could have flown', () => {
    assert.ok(isTime(42.1));
    assert.ok(!isTime(0), 'a stage flown in no time was not flown');
    assert.ok(!isTime(-3));
    assert.ok(!isTime(NaN));
    assert.ok(!isTime(Infinity));
    assert.ok(!isTime('42'), 'a string is not a time however it reads');
});

test('a board with nothing on it is where every mode starts', () => {
    assert.deepEqual(readBestTimes(fakeStorage()), {});
    assert.deepEqual(readBestTimes(null), {});
});

test('a time comes back the way it went in', () => {
    const storage = fakeStorage();
    assert.equal(writeBestTimes(storage, { 'loop-course:0': 38.4 }), true);
    assert.deepEqual(readBestTimes(storage), { 'loop-course:0': 38.4 });
});

// One unreadable entry should cost that entry its memory and nothing else: a
// board thrown away whole is a board a pilot has to fly out from scratch.
test('an entry that is not a time is dropped, and the rest of the board is kept', () => {
    const storage = fakeStorage({
        [BEST_TIMES_STORAGE_KEY]: JSON.stringify({
            'loop-course:0': 38.4,
            'loop-course:1': 'quick',
            'loop-course:2': -1,
            'runway-landing:0': 21.7
        })
    });

    assert.deepEqual(readBestTimes(storage), {
        'loop-course:0': 38.4,
        'runway-landing:0': 21.7
    });
});

test('a stored value that is not a board at all reads as an empty one', () => {
    for (const stored of ['null', '"38.4"', '[1, 2]', 'not json at all']) {
        assert.deepEqual(readBestTimes(fakeStorage({ [BEST_TIMES_STORAGE_KEY]: stored })), {});
    }
});

test('a storage that refuses costs the board its memory and nothing else', () => {
    assert.deepEqual(readBestTimes(refusingStorage), {});
    assert.equal(writeBestTimes(refusingStorage, { 'loop-course:0': 38.4 }), false);
    assert.equal(writeBestTimes(null, { 'loop-course:0': 38.4 }), false);
});

test('a stage nobody has finished has no time to beat', () => {
    const state = createBestTimesState(fakeStorage());
    assert.equal(bestTime(state, 'loop-course', 0), null);
});

test('the first time flown is the time to beat', () => {
    const storage = fakeStorage();
    const state = createBestTimesState(storage);

    const result = recordStageTime(state, 'loop-course', 0, 42.13);

    assert.deepEqual(result, { time: 42.1, previous: null, best: true });
    assert.equal(bestTime(state, 'loop-course', 0), 42.1);
    assert.deepEqual(readBestTimes(storage), { 'loop-course:0': 42.1 });
});

test('a faster flight takes the board, and a slower one leaves it alone', () => {
    const state = createBestTimesState(fakeStorage());
    recordStageTime(state, 'loop-course', 0, 42.1);

    const slower = recordStageTime(state, 'loop-course', 0, 50);
    assert.deepEqual(slower, { time: 50, previous: 42.1, best: false });
    assert.equal(bestTime(state, 'loop-course', 0), 42.1);

    const faster = recordStageTime(state, 'loop-course', 0, 38.4);
    assert.deepEqual(faster, { time: 38.4, previous: 42.1, best: true });
    assert.equal(bestTime(state, 'loop-course', 0), 38.4);
});

// Matching the board is not beating it, so the time already there stays there
// rather than being written again for nothing.
test('a time that only matches the board does not take it', () => {
    const state = createBestTimesState(fakeStorage());
    recordStageTime(state, 'loop-course', 0, 38.4);

    assert.deepEqual(recordStageTime(state, 'loop-course', 0, 38.4),
        { time: 38.4, previous: 38.4, best: false });
});

test('each stage of each mode is its own record', () => {
    const state = createBestTimesState(fakeStorage());
    recordStageTime(state, 'loop-course', 0, 38.4);
    recordStageTime(state, 'loop-course', 1, 51.2);
    recordStageTime(state, 'runway-landing', 0, 21.7);

    assert.equal(bestTime(state, 'loop-course', 0), 38.4);
    assert.equal(bestTime(state, 'loop-course', 1), 51.2);
    assert.equal(bestTime(state, 'runway-landing', 0), 21.7);
});

// A clock that never ran is not a record somebody flew, and storing it would
// leave a stage with a time nothing could ever match.
test('a clock that never ran is refused rather than stored', () => {
    const state = createBestTimesState(fakeStorage());

    assert.deepEqual(recordStageTime(state, 'loop-course', 0, 0),
        { time: null, previous: null, best: false });
    assert.deepEqual(recordStageTime(state, 'loop-course', 0, NaN),
        { time: null, previous: null, best: false });
    assert.equal(bestTime(state, 'loop-course', 0), null);
});

test('a time is kept to the tenth the readout is written to', () => {
    assert.equal(roundTime(42.13), 42.1);
    assert.equal(roundTime(42.16), 42.2);
    assert.equal(roundTime(0), null);
});

test('a time reads the way a stopwatch reads it', () => {
    assert.equal(formatStageTime(0.4), '0:00.4');
    assert.equal(formatStageTime(42.13), '0:42.1');
    assert.equal(formatStageTime(64.05), '1:04.1');
    assert.equal(formatStageTime(600), '10:00.0');
});

// The seconds are zero filled so a time never reads as a shorter one, and a
// stage nobody has flown leaves a gap of the right width rather than a number.
test('a time nobody has flown reads as the shape of one', () => {
    assert.equal(formatStageTime(null), NO_TIME);
    assert.equal(formatStageTime(0), NO_TIME);
    assert.equal(formatStageTime(NaN), NO_TIME);
    assert.equal(NO_TIME.length, formatStageTime(42.1).length);
});

// A tenth that rounds up to a whole second has to carry into the seconds
// rather than being written as ".10", which is not a tenth of anything.
test('a tenth that rounds up carries into the second above it', () => {
    assert.equal(formatStageTime(41.97), '0:42.0');
    assert.equal(formatStageTime(59.98), '1:00.0');
});
