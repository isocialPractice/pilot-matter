/**
 * Best times - the fastest each stage of each mode has been flown in, kept
 * between sessions so a course already flown is something to beat rather than
 * something to repeat.
 *
 * Pure module with no DOM or Three.js dependency: the browser's storage is
 * passed in rather than reached for, so a plain object stands in for it under
 * test. A stage is timed by `js/game-modes.js`, which holds the clock; what is
 * here is only what becomes of the number once the stage is flown out.
 */

export const BEST_TIMES_STORAGE_KEY = 'pilot-matter.best-times';

// What a time reads as before there is one: the shape of a time, with nothing
// filled in, so the row is the same width whether or not a stage has been
// flown yet.
export const NO_TIME = '-:--.-';

// A time is kept to a tenth of a second, which is the smallest difference
// worth telling a pilot about and the precision the readout is written to.
export const TIME_PRECISION = 10;

const SECONDS_PER_MINUTE = 60;

/**
 * The name a stage's time is stored under: the mode and the stage's place in
 * it. The stage's number rather than its label, because a label is prose and
 * could be rewritten without anyone meaning to throw the board away.
 */
export function stageKey(modeId, stageIndex) {
    return `${modeId}:${stageIndex}`;
}

/** True for a reading that could be a time somebody flew. */
export function isTime(seconds) {
    return Number.isFinite(seconds) && seconds > 0;
}

/**
 * Reads the stored board. Anything other than a value this module wrote - no
 * key at all, something that is not an object, or a storage that throws -
 * reads as an empty board, which is what a first flight should see. Every
 * entry is checked on its own, so one unreadable time does not cost the rest
 * of the board its memory.
 */
export function readBestTimes(storage) {
    const times = {};

    try {
        const stored = JSON.parse(storage?.getItem(BEST_TIMES_STORAGE_KEY) ?? 'null');
        // A list is an object too, and one of numbers would read as a board of
        // times filed under 0, 1, 2 - a board nobody wrote, kept forever.
        if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return times;

        for (const [key, value] of Object.entries(stored)) {
            if (isTime(value)) times[key] = value;
        }
    } catch {
        return {};
    }

    return times;
}

/**
 * Stores the board for the next session. A storage that refuses the write
 * costs the board its memory and nothing else, so the flight goes on.
 *
 * Returns true when the board was stored.
 */
export function writeBestTimes(storage, times) {
    try {
        storage?.setItem(BEST_TIMES_STORAGE_KEY, JSON.stringify(times));
        return storage != null;
    } catch {
        return false;
    }
}

export function createBestTimesState(storage = null) {
    return { storage, times: readBestTimes(storage) };
}

/** The best a stage has been flown in, or null for one nobody has finished. */
export function bestTime(state, modeId, stageIndex) {
    return state?.times[stageKey(modeId, stageIndex)] ?? null;
}

/**
 * Puts a finished stage's time on the board, if it beats what was there.
 *
 * Returns what happened, so the caller can say so: the time flown, the time to
 * beat before this one, and whether it was beaten. A reading that is not a
 * time at all - a stage finished on the frame it was laid out, or a clock that
 * never ran - is refused rather than stored as a record nobody could match.
 */
export function recordStageTime(state, modeId, stageIndex, seconds) {
    const time = roundTime(seconds);
    const previous = bestTime(state, modeId, stageIndex);

    if (!isTime(time)) return { time: null, previous, best: false };
    if (previous != null && previous <= time) return { time, previous, best: false };

    state.times[stageKey(modeId, stageIndex)] = time;
    writeBestTimes(state.storage, state.times);

    return { time, previous, best: true };
}

/** A time on the board rather than on the clock, kept to its own precision. */
export function roundTime(seconds) {
    if (!isTime(seconds)) return null;
    return Math.round(seconds * TIME_PRECISION) / TIME_PRECISION;
}

/**
 * A time the way a stopwatch reads it: minutes, seconds zero filled to two
 * digits, and a tenth. Anything that is not a time reads as the empty shape of
 * one, so a stage nobody has flown leaves a gap of the right width rather than
 * a number that means nothing.
 */
export function formatStageTime(seconds) {
    if (!isTime(seconds)) return NO_TIME;

    const tenths  = Math.round(seconds * TIME_PRECISION);
    const minutes = Math.floor(tenths / (SECONDS_PER_MINUTE * TIME_PRECISION));
    const rest    = tenths - minutes * SECONDS_PER_MINUTE * TIME_PRECISION;
    const whole   = Math.floor(rest / TIME_PRECISION);

    return `${minutes}:${String(whole).padStart(2, '0')}.${rest % TIME_PRECISION}`;
}
