import test from 'node:test';
import assert from 'node:assert/strict';
import {
    TOUCH_PADS,
    TOUCH_CELLS,
    TOUCH_LEFT,
    TOUCH_RIGHT,
    touchPads,
    padsOn,
    applyTouchToInput,
    releaseTouchInput,
    isTouchOnly,
    TouchControls
} from '../js/touch-controls.js';
import { CONTROL_NAMES, createInputState } from '../js/input-map.js';
import { TILT_CONTROLS } from '../js/tilt-controls.js';

/**
 * A machine, as the browser describes one. Written as the two answers that
 * decide the question rather than as a whole navigator, because those two are
 * the whole of what `isTouchOnly` is allowed to ask.
 */
function machine({ touchPoints = 0, coarse = false, hover = true } = {}) {
    return {
        navigator: { maxTouchPoints: touchPoints },
        matchMedia: (query) => ({
            matches: query === '(pointer: coarse)' ? coarse : hover
        })
    };
}

// --- The layout -------------------------------------------------------------

test('there is a pad for every control the flight model reads', () => {
    const controls = TOUCH_PADS.map(pad => pad.control);

    assert.deepEqual([...controls].sort(), [...CONTROL_NAMES].sort(),
        'a machine flown from the glass has to reach every control it has');
    assert.equal(new Set(controls).size, controls.length, 'and no control twice');
});

test('every pad has somewhere to be drawn and something to be read by', () => {
    const ids = TOUCH_PADS.map(pad => pad.id);
    assert.equal(new Set(ids).size, ids.length, 'a pad is looked up by its id');

    for (const pad of TOUCH_PADS) {
        assert.ok(pad.label.length > 0, `${pad.id} needs a label to be pressed by`);
        assert.ok([TOUCH_LEFT, TOUCH_RIGHT].includes(pad.side), `${pad.id} belongs to a cluster`);
        assert.ok(TOUCH_CELLS.includes(pad.cell), `${pad.id} sits in a cell of it`);
    }
});

test('each cluster is a cross, with nothing at its middle and no cell claimed twice', () => {
    for (const side of [TOUCH_LEFT, TOUCH_RIGHT]) {
        const cells = padsOn(side).map(pad => pad.cell);
        assert.deepEqual([...cells].sort(), [...TOUCH_CELLS].sort(),
            `the ${side} cluster should fill its cross`);
    }
});

test('attitude is under one thumb and power under the other', () => {
    const left = padsOn(TOUCH_LEFT).map(pad => pad.control).sort();
    assert.deepEqual(left, ['pitchDown', 'pitchUp', 'rollLeft', 'rollRight']);

    const right = padsOn(TOUCH_RIGHT).map(pad => pad.control).sort();
    assert.deepEqual(right, ['throttleDown', 'throttleUp', 'yawLeft', 'yawRight']);
});

test('the pads tilt takes over are exactly the controls tilt writes', () => {
    const tilted = TOUCH_PADS.filter(pad => pad.tilted).map(pad => pad.control);
    assert.deepEqual([...tilted].sort(), [...TILT_CONTROLS].sort(),
        'a control written twice a frame would be a control fighting itself');
});

test('tilt takes its own pads off the glass and leaves the rest', () => {
    assert.equal(touchPads(false).length, TOUCH_PADS.length, 'nothing tilting, everything drawn');

    const flown = touchPads(true);
    assert.equal(flown.length, TOUCH_PADS.length - TILT_CONTROLS.length);
    assert.ok(flown.every(pad => !pad.tilted));
    assert.ok(flown.some(pad => pad.control === 'throttleUp'),
        'a device being tilted still has a throttle to work');
});

// --- What a pad writes ------------------------------------------------------

test('a pad holds its control down and lets it up again', () => {
    const input = createInputState();

    assert.equal(applyTouchToInput(input, 'pitchUp', true), 'pitchUp');
    assert.equal(input.pitchUp, true);

    assert.equal(applyTouchToInput(input, 'pitchUp', false), 'pitchUp');
    assert.equal(input.pitchUp, false);
});

test('a control the flight model does not read is left alone, the way an unbound key is', () => {
    const input = createInputState();

    assert.equal(applyTouchToInput(input, 'eject', true), null);
    assert.equal(input.eject, undefined);
});

test('taking the pads away lets go of everything they were holding', () => {
    const input = createInputState();

    for (const pad of TOUCH_PADS) applyTouchToInput(input, pad.control, true);
    releaseTouchInput(input);

    assert.ok(CONTROL_NAMES.every(name => input[name] === false),
        'a control held under a menu is a control the pilot cannot see to release');
});

test('only the pads being taken away are let go of', () => {
    const input = createInputState();
    input.pitchUp = true;
    input.throttleUp = true;

    releaseTouchInput(input, touchPads(true));

    assert.equal(input.throttleUp, false, 'a pad that went');
    assert.equal(input.pitchUp, true, 'and one that was never on the glass to go');
});

// --- Whether a machine wants them at all ------------------------------------

test('a machine that takes no touches is flown with the keys it has', () => {
    assert.equal(isTouchOnly(machine({ touchPoints: 0, coarse: true, hover: false })), false);
});

test('a phone takes touches and has nothing that can hover', () => {
    assert.equal(isTouchOnly(machine({ touchPoints: 5, coarse: true, hover: false })), true);
});

test('a laptop with a touchscreen has a trackpad, and so has keys beside it', () => {
    assert.equal(isTouchOnly(machine({ touchPoints: 10, coarse: true, hover: true })), false,
        'the hover is what says there is a pointer, and a pointer says there are keys');
    assert.equal(isTouchOnly(machine({ touchPoints: 10, coarse: false, hover: false })), false,
        'and a fine pointer says the same');
});

test('a browser that will not answer leaves the machine flown as it was', () => {
    assert.equal(isTouchOnly({}), false, 'nothing to ask');
    assert.equal(isTouchOnly(null), false);

    const throws = {
        navigator: { maxTouchPoints: 5 },
        matchMedia: () => { throw new Error('no'); }
    };
    assert.equal(isTouchOnly(throws), true,
        'a refused question falls back to the answer that draws the pads, '
        + 'because a machine that takes five touches has already answered the one that matters');
});

// --- The pads on the page ---------------------------------------------------

/**
 * The page a set of pads is drawn onto, as the little of it the class touches:
 * a card with a display, and a cluster either side to append into.
 */
function fakeGlass() {
    const element = () => ({
        style: {},
        children: [],
        appendChild(child) { this.children.push(child); return child; },
        replaceChildren(...items) { this.children = items; },
        addEventListener() {},
        setPointerCapture() {}
    });

    globalThis.document = { createElement: element };

    return {
        container: element(),
        clusters: { [TOUCH_LEFT]: element(), [TOUCH_RIGHT]: element() }
    };
}

/** A set of pads built and left where the page styles the card: off screen. */
function hiddenPads(input) {
    const { container, clusters } = fakeGlass();
    const controls = new TouchControls(container, input, clusters);

    controls.setPads(touchPads(false));
    controls.setVisible(false);

    return { controls, container };
}

test('pads that were never on the glass let go of nothing', () => {
    const input = createInputState();
    const { controls } = hiddenPads(input);

    input.pitchUp = true;
    controls.setVisible(false);

    assert.equal(input.pitchUp, true,
        'the overlays are synced on every photo, every resize, and every press '
        + 'of the HUD key, and a hidden pad letting go each time would take a '
        + 'the control off a key still being held with it');
});

test('pads coming off the glass let go of what they were holding', () => {
    const input = createInputState();
    const { controls, container } = hiddenPads(input);

    controls.setVisible(true);
    input.pitchUp = true;

    controls.setVisible(false);
    assert.equal(input.pitchUp, false,
        'a control held down under a menu is one the pilot cannot see to release');
    assert.equal(container.style.display, 'none');
});
