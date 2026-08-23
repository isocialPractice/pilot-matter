import test from 'node:test';
import assert from 'node:assert/strict';
import {
    LOADING_STEPS,
    LOADING_DONE_LABEL,
    LOADING_FADE_MS,
    LoadingScreen,
    createLoadingState,
    advanceLoading,
    loadingProgress,
    loadingPercent,
    loadingLabel,
    loadingComplete
} from '../js/loading.js';

test('the start-up is a list of steps, each with something to say for itself', () => {
    assert.ok(LOADING_STEPS.length > 1, 'a bar with one step in it is not a bar');
    const ids = LOADING_STEPS.map(step => step.id);
    assert.equal(new Set(ids).size, ids.length, 'two steps answering to one id is one step too many');
    for (const step of LOADING_STEPS) {
        assert.ok(step.label.length > 0, `${step.id} needs a label to be read by`);
    }
});

// The screen is taken off by the frame that has something behind it, so the
// frame has to be a step of the start-up rather than an afterthought.
test('the last step is the first frame actually drawn', () => {
    assert.equal(LOADING_STEPS.at(-1).id, 'frame');
});

test('a page that has just arrived has done nothing and says what it is doing', () => {
    const state = createLoadingState();
    assert.equal(loadingProgress(state), 0);
    assert.equal(loadingPercent(state), 0);
    assert.equal(loadingComplete(state), false);
    assert.equal(loadingLabel(state), LOADING_STEPS[0].label);
});

test('each step moves the bar, and the label moves on to the next thing', () => {
    const state = createLoadingState();

    assert.equal(advanceLoading(state, LOADING_STEPS[0].id), true);
    assert.equal(loadingProgress(state), 1 / LOADING_STEPS.length);
    assert.equal(loadingLabel(state), LOADING_STEPS[1].label, 'the label is the work in hand');

    assert.equal(advanceLoading(state, LOADING_STEPS[1].id), true);
    assert.equal(loadingProgress(state), 2 / LOADING_STEPS.length);
});

test('the bar is full and the screen is done once every step is', () => {
    const state = createLoadingState();
    for (const step of LOADING_STEPS) advanceLoading(state, step.id);

    assert.equal(loadingProgress(state), 1);
    assert.equal(loadingPercent(state), 100);
    assert.equal(loadingComplete(state), true);
    assert.equal(loadingLabel(state), LOADING_DONE_LABEL);
});

// Progress that could go backwards would be a bar reporting the order the
// steps were reported in rather than how far the start-up got.
test('the bar only ever moves forward', () => {
    const state = createLoadingState();

    advanceLoading(state, LOADING_STEPS[2].id);
    const reached = loadingProgress(state);

    assert.equal(advanceLoading(state, LOADING_STEPS[0].id), false, 'a step already passed is not news');
    assert.equal(advanceLoading(state, LOADING_STEPS[2].id), false, 'nor is the same step twice');
    assert.equal(loadingProgress(state), reached);
});

test('a step out of order carries the ones before it rather than dropping the bar', () => {
    const state = createLoadingState();
    advanceLoading(state, LOADING_STEPS.at(-1).id);
    assert.equal(loadingComplete(state), true);
});

test('a step nothing answers to is not progress', () => {
    const state = createLoadingState();
    assert.equal(advanceLoading(state, 'a-step-that-does-not-exist'), false);
    assert.equal(loadingProgress(state), 0);
});

test('a start-up with no steps at all is already finished', () => {
    const state = createLoadingState([]);
    assert.equal(loadingProgress(state), 1);
    assert.equal(loadingComplete(state), true);
    assert.equal(loadingLabel(state), LOADING_DONE_LABEL);
});

// Enough of a screen for the bar to be drawn on, with no browser to draw it
// in: elements that remember what was set on them.
function fakeScreen() {
    const bar   = { style: {} };
    const label = { textContent: '' };
    const classes = new Set();

    return {
        bar,
        label,
        classes,
        style: {},
        querySelector: (selector) => (selector === '#loading-bar' ? bar : label),
        classList: { add: (name) => classes.add(name) }
    };
}

test('the screen draws the progress, and says what is being done to earn it', () => {
    const root = fakeScreen();
    const state = createLoadingState();
    const screen = new LoadingScreen(root);

    screen.update(state);
    assert.equal(root.bar.style.width, '0%');
    assert.equal(root.label.textContent, LOADING_STEPS[0].label);

    advanceLoading(state, LOADING_STEPS[0].id);
    screen.update(state);
    assert.equal(root.bar.style.width, `${loadingPercent(state)}%`);
    assert.equal(root.label.textContent, LOADING_STEPS[1].label);
});

test('finishing fades the screen off, and takes it out of the page once it is gone', async () => {
    const root = fakeScreen();
    const screen = new LoadingScreen(root);

    screen.finish();
    assert.equal(root.classes.has('done'), true, 'the fade is the stylesheet\'s to run');
    assert.notEqual(root.style.display, 'none', 'and nothing is removed until it has');

    await new Promise(resolve => setTimeout(resolve, LOADING_FADE_MS + 50));
    assert.equal(root.style.display, 'none');
});
