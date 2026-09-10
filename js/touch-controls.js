/**
 * On-screen controls, for a machine with no keys to fly with.
 *
 * The flight model reads an input state of named controls that are either held
 * or not, and the keyboard is only one thing that writes it - `js/input-map.js`
 * says as much, and the Pilot API publishes the keymap so a host can ignore it
 * entirely. A pad on the glass is another thing that writes it, so what is here
 * is the layout of the pads, which control each one works, and the rule for
 * whether a machine wants them at all.
 *
 * The layout and the rules are pure and have no DOM in them; the class at the
 * bottom is the only part that touches the page.
 */

import { CONTROL_NAMES } from './input-map.js';

export const TOUCH_LEFT  = 'left';
export const TOUCH_RIGHT = 'right';

/**
 * Where a pad sits in its cluster. Each cluster is a cross with nothing in the
 * middle, which is the shape a thumb works without looking: the pad opposite
 * the one being held is always the one straight across from it.
 */
export const TOUCH_CELLS = Object.freeze(['up', 'left', 'right', 'down']);

/**
 * The pads, and the control each one holds down.
 *
 * Attitude is on the left and power on the right, the way an aircraft is flown
 * with a stick in one hand and a lever in the other. The four marked as flown
 * by tilt are the ones the device's own attitude takes over when tilt is doing
 * the flying, and they come off the glass rather than fighting it.
 */
export const TOUCH_PADS = Object.freeze([
    { id: 'touch-pitch-up',      control: 'pitchUp',      label: 'PITCH +', side: TOUCH_LEFT,  cell: 'up',    tilted: true },
    { id: 'touch-roll-left',     control: 'rollLeft',     label: 'ROLL L',  side: TOUCH_LEFT,  cell: 'left',  tilted: true },
    { id: 'touch-roll-right',    control: 'rollRight',    label: 'ROLL R',  side: TOUCH_LEFT,  cell: 'right', tilted: true },
    { id: 'touch-pitch-down',    control: 'pitchDown',    label: 'PITCH -', side: TOUCH_LEFT,  cell: 'down',  tilted: true },
    { id: 'touch-throttle-up',   control: 'throttleUp',   label: 'THR +',   side: TOUCH_RIGHT, cell: 'up',    tilted: false },
    { id: 'touch-yaw-left',      control: 'yawLeft',      label: 'YAW L',   side: TOUCH_RIGHT, cell: 'left',  tilted: false },
    { id: 'touch-yaw-right',     control: 'yawRight',     label: 'YAW R',   side: TOUCH_RIGHT, cell: 'right', tilted: false },
    { id: 'touch-throttle-down', control: 'throttleDown', label: 'THR -',   side: TOUCH_RIGHT, cell: 'down',  tilted: false }
]);

/**
 * The pads a flight wants on the glass. Tilt flies pitch and roll off the
 * device's own attitude, so the pads for those two come off when it is live:
 * two ways of asking for the same control, one of them writing the input state
 * every frame, is one way too many.
 */
export function touchPads(tilting = false, pads = TOUCH_PADS) {
    return pads.filter(pad => !(tilting && pad.tilted));
}

/** The pads of one cluster, in the order the cells are laid out. */
export function padsOn(side, pads = TOUCH_PADS) {
    return pads.filter(pad => pad.side === side);
}

/**
 * Holds a control down, or lets it up. Returns the control that changed, or
 * null for a name the flight model does not read - the same answer, and for
 * the same reason, that `applyKeyToInput` gives an unbound key.
 */
export function applyTouchToInput(input, control, down, names = CONTROL_NAMES) {
    if (!names.includes(control)) return null;
    input[control] = down === true;
    return control;
}

/** Lets go of every control a pad can hold, for controls being taken away. */
export function releaseTouchInput(input, pads = TOUCH_PADS) {
    for (const pad of pads) input[pad.control] = false;
    return input;
}

/**
 * Whether this is a machine that has to be flown from the glass: it takes
 * touches, and it has no pointer that can hover over anything.
 *
 * There is no way to ask a browser whether a keyboard is attached, so the
 * question is put the way it can be answered. A device with a mouse or a
 * trackpad - which is what a hover-capable pointer means - has keys beside it
 * in every case that matters, and a phone or a tablet has neither. Getting it
 * wrong in the cautious direction leaves a machine flown with the keys it
 * already had, which is why the hover test is the one that decides.
 */
export function isTouchOnly(env = globalThis) {
    const touches = Number(env?.navigator?.maxTouchPoints ?? 0) > 0;
    if (!touches) return false;

    const asks = (query, fallback) => {
        try {
            return env.matchMedia?.(query)?.matches ?? fallback;
        } catch {
            return fallback;
        }
    };

    return asks('(pointer: coarse)', true) && !asks('(any-hover: hover)', false);
}

// --- The pads on the page --------------------------------------------------

/**
 * The pads themselves. Built from the layout above rather than written into the
 * page, because which pads there are depends on whether tilt is flying the
 * aircraft, and a set of buttons that has to be kept in step with a list is a
 * set of buttons that falls out of step with it.
 */
export class TouchControls {
    constructor(container, input, clusters = {}) {
        this.container = container;
        this.input = input;
        this.clusters = clusters;
        this.pads = [];
        // The card starts hidden, the way the page styles it, so the first
        // sync that leaves it hidden is asking for the state it is already in.
        this.visible = false;
    }

    /**
     * Draws a set of pads, taking the last set down first. Anything the old set
     * was holding is let go on the way out, so a pad that disappears under a
     * thumb does not leave its control held down forever.
     */
    setPads(pads = []) {
        this.release();
        for (const cluster of Object.values(this.clusters)) cluster?.replaceChildren();

        this.pads = pads;
        for (const pad of pads) {
            this.clusters[pad.side]?.appendChild(this.buildPad(pad));
        }

        return this.pads.length;
    }

    buildPad(pad) {
        const button = document.createElement('button');
        button.type = 'button';
        button.id = pad.id;
        button.className = `touch-pad touch-${pad.cell}`;
        button.textContent = pad.label;

        // The pointer is captured on the way down, so a thumb that slides off
        // the pad still lets go of the control when it lifts - which is the
        // difference between a control released and an aircraft rolling onto
        // its back because the pad stopped hearing about the finger.
        button.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            button.setPointerCapture?.(event.pointerId);
            this.hold(pad, true);
        });

        for (const name of ['pointerup', 'pointercancel']) {
            button.addEventListener(name, () => this.hold(pad, false));
        }

        // A context menu on a long press would take the finger off the pad
        // without ever telling it, which is the same aircraft on its back.
        button.addEventListener('contextmenu', (event) => event.preventDefault());

        return button;
    }

    hold(pad, down) {
        applyTouchToInput(this.input, pad.control, down);
    }

    /** Lets go of everything, for a flight that has been taken off the pilot. */
    release() {
        releaseTouchInput(this.input, this.pads);
    }

    /**
     * Puts the pads on screen or takes them off. Pads actually coming off the
     * glass let go of whatever was held, because a control held down under a
     * menu is a control the pilot cannot see to release.
     *
     * Only the coming off does that, though. The overlays are synced on every
     * photo, every resize, and every press of the HUD and control-list keys,
     * and the input state the pads write is the one the keyboard writes: a set
     * of pads that was never on the glass letting go each time it is asked to
     * stay off would take a held key's control with it.
     */
    setVisible(visible) {
        const shown = visible === true;

        if (!shown && this.visible) this.release();
        this.visible = shown;

        if (this.container) this.container.style.display = shown ? 'flex' : 'none';
        return shown;
    }
}
