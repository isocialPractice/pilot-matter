/**
 * Flying by tilting the device.
 *
 * The same input state the keys and the pads write, written instead from the
 * orientation sensors: the device is the stick, and pitching and rolling it
 * pitches and rolls the aircraft. Offered only where there is nothing better -
 * a phone or a tablet with no keys - because a machine that has keys is flown
 * with them, which is the whole of the reason this is a default rather than a
 * replacement.
 *
 * The reading is turned into the controls the flight model already reads, which
 * are held or not held rather than held by an amount. That is a deliberate
 * limit rather than an oversight: the input state is what the keyboard, the
 * pads, and a host writing its own controls all share, and a tilt that needed
 * its own kind of control would be a tilt only this game could be flown with.
 * What it costs is fineness, and what a deadzone buys back is that a device
 * held still flies straight.
 *
 * Pure module with no DOM dependency apart from the listener at the bottom, so
 * the mapping from a reading to a set of controls can be unit tested in Node.
 */

// How far the device is turned from where it was held before it is asked for
// anything, in degrees. Wide enough that a hand is not a control input, and
// narrow enough that a deliberate turn is one.
export const TILT_DEADZONE = 7;

// The controls tilt writes, and the ones it therefore takes off the glass.
export const TILT_CONTROLS = Object.freeze(['pitchUp', 'pitchDown', 'rollLeft', 'rollRight']);

/**
 * The device's tilt as the aircraft's two axes, whichever way up the screen is
 * being held.
 *
 * `beta` and `gamma` are reported against the device rather than against the
 * screen, so a phone turned on its side reports the pilot's pitch as roll. The
 * screen's own angle is what turns one frame into the other, and a flight
 * simulator on a phone is held sideways every time, so this is the ordinary
 * case rather than the corner one.
 */
export function tiltAxes(beta = 0, gamma = 0, screenAngle = 0) {
    const radians = screenAngle * Math.PI / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

    return {
        pitch: beta * cos - gamma * sin,
        roll:  gamma * cos + beta * sin
    };
}

/**
 * The tilt state: whether tilt is wanted at all, where the device was being
 * held when it was last levelled, and the last reading taken.
 *
 * `reading` is null until a sensor has actually reported something. That is
 * what tells a flight whether tilt is flying it or only meant to: a browser can
 * refuse the sensor outright, and a set of pads taken off the glass for a tilt
 * that never arrived would be an aircraft with no controls at all.
 */
export function createTiltState(enabled = false) {
    return { enabled, reading: null, zero: { pitch: 0, roll: 0 } };
}

/** True once tilt is both wanted and actually reporting. */
export function tiltFlying(state) {
    return state?.enabled === true && state.reading != null;
}

/**
 * Takes a reading. The first one after a levelling is what the device's neutral
 * is set from, so a pilot holding a phone at whatever angle suits them is
 * holding it level rather than permanently pitching.
 *
 * A reading with no numbers in it is no reading. A browser with no gyroscope
 * still fires the event, with every angle null, which is the specification's
 * way of saying it has nothing to report - and a null read as zero is a device
 * being held perfectly level, which is the one answer that takes the pitch and
 * roll pads off the glass. Refusing it here is what keeps `state.reading` null,
 * and a tilt that is not flying is what leaves the pads where they are.
 */
export function applyTiltReading(state, beta, gamma, screenAngle = 0) {
    if (!state.enabled) return null;
    if (!Number.isFinite(beta) && !Number.isFinite(gamma)) return null;

    // One axis reported and the other not is still a device saying something,
    // so the silent axis is the neutral rather than the whole reading thrown
    // away: a sensor that only knows roll can still fly the wings.
    const axes = tiltAxes(
        Number.isFinite(beta)  ? beta  : 0,
        Number.isFinite(gamma) ? gamma : 0,
        screenAngle
    );
    if (state.reading == null) state.zero = { ...axes };

    state.reading = axes;
    return axes;
}

/** How far the device is off the neutral it was levelled at, in degrees. */
export function tiltOffset(state) {
    if (!tiltFlying(state)) return { pitch: 0, roll: 0 };
    return {
        pitch: state.reading.pitch - state.zero.pitch,
        roll:  state.reading.roll  - state.zero.roll
    };
}

/**
 * Levels the device: wherever it is being held now becomes the neutral. Called
 * when a flight resets, so a pilot who has drifted into holding the phone at a
 * new angle gets that angle back as level rather than having to fly out of it.
 */
export function levelTilt(state) {
    state.zero = state.reading ? { ...state.reading } : { pitch: 0, roll: 0 };
    return state.zero;
}

/**
 * Writes the tilt onto the input state. A device inside the deadzone holds
 * nothing, which is what lets it be put down flat without the aircraft flying
 * away on its own.
 *
 * Returns the input state, so it reads the way the other input sources do.
 */
export function tiltToInput(input, state, deadzone = TILT_DEADZONE) {
    // A tilt that is not flying writes nothing at all, rather than writing four
    // released controls. The input state is shared with the keys and the pads,
    // and a sensor that has never reported has no business letting go of a
    // control something else is holding.
    if (!tiltFlying(state)) return input;

    for (const control of TILT_CONTROLS) input[control] = false;

    const { pitch, roll } = tiltOffset(state);

    // Nose up is the top of the device coming toward the pilot, which is the
    // way a stick is pulled, and a wing down is the same wing down on the
    // device. Neither needs inverting, and neither should be: the point of
    // flying by tilt is that the device is the aircraft.
    if (pitch >  deadzone) input.pitchUp   = true;
    if (pitch < -deadzone) input.pitchDown = true;
    if (roll  < -deadzone) input.rollLeft  = true;
    if (roll  >  deadzone) input.rollRight = true;

    return input;
}

// --- Reaching the sensor ---------------------------------------------------

/**
 * Whether the browser wants asking before it will report orientation. Safari on
 * iOS does, and only from inside a gesture the pilot made, which is why the ask
 * happens on the tap that starts the flight rather than at start-up.
 */
export function tiltNeedsPermission(env = globalThis) {
    return typeof env?.DeviceOrientationEvent?.requestPermission === 'function';
}

/**
 * Asks for the sensor, where it has to be asked for. Anything other than a
 * plain yes reads as a no, including a browser that throws because the ask did
 * not come from a gesture: tilt then stays off, the pads stay on the glass, and
 * the flight is flown exactly as it would have been.
 */
export async function requestTilt(env = globalThis) {
    if (!tiltNeedsPermission(env)) return true;

    try {
        return await env.DeviceOrientationEvent.requestPermission() === 'granted';
    } catch {
        return false;
    }
}

/** The screen's own angle, or zero where the browser will not say. */
export function screenAngle(env = globalThis) {
    const angle = env?.screen?.orientation?.angle;
    return Number.isFinite(angle) ? angle : 0;
}

/**
 * The sensor, listened to. The one part of this file that reaches for anything
 * outside itself, so everything above it is testable without a device.
 */
export class TiltSensor {
    constructor(state, env = globalThis) {
        this.state = state;
        this.env = env;
        this.listening = false;
        // The angles are handed over exactly as the event reported them,
        // nulls and all, because whether a reading is a reading is decided in
        // `applyTiltReading` - where it can be tested without a device.
        this.onReading = (event) => {
            applyTiltReading(this.state, event.beta, event.gamma, screenAngle(this.env));
        };
    }

    /**
     * Starts listening, asking first where the browser wants asking. Returns
     * whether the sensor is being listened to, which is not yet whether it is
     * reporting - a device with no gyroscope answers yes here and then sends
     * nothing worth reading, and `tiltFlying` is what tells those two apart.
     */
    async start() {
        if (this.listening || !this.state.enabled) return this.listening;
        if (!await requestTilt(this.env)) return false;

        this.env.addEventListener?.('deviceorientation', this.onReading);
        this.listening = true;
        return true;
    }

    stop() {
        if (!this.listening) return false;
        this.env.removeEventListener?.('deviceorientation', this.onReading);
        this.listening = false;
        this.state.reading = null;
        return true;
    }
}
