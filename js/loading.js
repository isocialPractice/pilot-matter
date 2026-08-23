/**
 * Loading screen - what the page shows between arriving and flying. The steps
 * the start-up goes through and how far along them it is are pure and have no
 * DOM or Three.js dependency, so the progress can be unit tested in Node; the
 * class at the bottom is the bar and the label they are drawn on.
 *
 * The screen is taken off by the first frame the renderer actually draws
 * rather than by a timer, so it is gone exactly when there is a world behind it
 * and not a moment before.
 *
 * Start-up runs in one pass with no chance for the browser to paint between
 * the steps, so the bar is not seen creeping from one to the next: it is a
 * width the stylesheet animates toward, and the progress behind it is real
 * whether or not every step of it gets a frame of its own.
 */

// The start-up, in the order it happens. The label is what is being done
// rather than what has just been finished, so the screen reads as a report of
// the work in hand.
export const LOADING_STEPS = [
    { id: 'scene',       label: 'BUILDING THE SCENE' },
    { id: 'world',       label: 'GENERATING THE WORLD' },
    { id: 'aircraft',    label: 'ROLLING OUT THE AIRCRAFT' },
    { id: 'instruments', label: 'CALIBRATING THE INSTRUMENTS' },
    { id: 'frame',       label: 'DRAWING THE FIRST FRAME' }
];

export const LOADING_DONE_LABEL = 'READY TO FLY';

// How long the screen takes to fade out, in milliseconds, matching the
// transition on #loading in index.html.
export const LOADING_FADE_MS = 600;

export function createLoadingState(steps = LOADING_STEPS) {
    return { steps, completed: 0 };
}

/**
 * Marks a step of the start-up as done. Progress only ever moves forward, so a
 * step reported twice does not double-count and a step reported out of order
 * carries the ones before it with it rather than dropping the bar back.
 *
 * Returns true when this call moved the bar.
 */
export function advanceLoading(state, id) {
    const at = state.steps.findIndex(step => step.id === id);
    if (at < 0 || at + 1 <= state.completed) return false;

    state.completed = at + 1;
    return true;
}

/** How far through the start-up the page is, from 0 to 1. */
export function loadingProgress(state) {
    const count = state.steps.length;
    return count === 0 ? 1 : Math.min(state.completed, count) / count;
}

/** The same progress as the percentage the bar is drawn at. */
export function loadingPercent(state) {
    return Math.round(loadingProgress(state) * 100);
}

export function loadingComplete(state) {
    return state.completed >= state.steps.length;
}

/** What the screen says: the step being worked on, or that there is no more. */
export function loadingLabel(state) {
    return state.steps[state.completed]?.label ?? LOADING_DONE_LABEL;
}

export class LoadingScreen {
    constructor(root) {
        this.root  = root;
        this.bar   = root.querySelector('#loading-bar');
        this.label = root.querySelector('#loading-label');
    }

    /** Draws the progress so far, and says what is being done to earn it. */
    update(state) {
        this.bar.style.width = `${loadingPercent(state)}%`;
        this.label.textContent = loadingLabel(state);
    }

    /**
     * Fades the screen off the world it was covering, and takes it out of the
     * page once it is gone, so nothing is left lying over the canvas.
     */
    finish() {
        this.root.classList.add('done');
        setTimeout(() => { this.root.style.display = 'none'; }, LOADING_FADE_MS);
    }
}
