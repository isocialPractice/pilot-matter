/**
 * Meeting the ground - the rules for what arriving on it means. Pure module
 * with no DOM or Three.js dependencies so the thresholds, the crash timer, and
 * the outcome the rest of the game reads can be unit tested in Node.
 *
 * Meeting terrain is not automatically a crash: settling onto a hillside at
 * the rate gravity pulls is survivable, and the aircraft keeps flying. Coming
 * down faster than the impact threshold is a crash, which locks the controls
 * for a moment and then resets the flight, instead of the aircraft silently
 * clamping to the ground height and carrying on.
 *
 * A runway changes what an arrival means rather than how hard one is allowed
 * to be. Prepared ground takes a firmer arrival than a hillside, and an arrival
 * on it that is soft enough and square enough is a landing - an outcome in its
 * own right, which the HUD and the game modes both read off the same state
 * rather than each working out for themselves.
 */

// How much clearance the aircraft keeps over the terrain below it, in world
// units. Ground contact happens at this height, not at zero.
export const GROUND_CLEARANCE = 5;

// Descent rate that turns ground contact into a crash, in world units per
// second. A stalled aircraft sinks at 24 units/s at the very worst, so an
// unpowered settle onto terrain survives and a dive into it does not.
export const CRASH_IMPACT_SPEED = 30;

// The same threshold over a runway. Prepared ground takes an arrival that
// would break the aircraft on a hillside, so a firm landing rolls out rather
// than ending the flight.
export const RUNWAY_IMPACT_SPEED = 48;

// How long the wreck stays on screen before the flight resets, in seconds.
export const CRASH_DURATION = 2.5;

// What an arrival on the ground turned out to be. `FLYING` covers both being in
// the air and rolling out from an arrival that was neither a landing nor a
// crash, because in both the flight is simply carrying on.
export const FLYING  = 'flying';
export const LANDED  = 'landed';
export const CRASHED = 'crashed';

export const GROUND_OUTCOMES = Object.freeze([FLYING, LANDED, CRASHED]);

/**
 * What a touchdown on a runway has to be inside to be a landing: a descent
 * gentle enough to be flown rather than survived, wings near enough level to
 * keep them off the ground, a nose neither dug in nor held off, and a heading
 * near enough the strip's to stay on it. Angles are in radians.
 */
export const LANDING_SINK_SPEED    = 18;
export const LANDING_BANK_LIMIT    = 0.20;
export const LANDING_PITCH_LIMIT   = 0.26;
export const LANDING_HEADING_LIMIT = 0.44;

export const LANDING_LIMITS = Object.freeze({
    sinkSpeed:    LANDING_SINK_SPEED,
    bank:         LANDING_BANK_LIMIT,
    pitch:        LANDING_PITCH_LIMIT,
    heading:      LANDING_HEADING_LIMIT,
    impactSpeed:  CRASH_IMPACT_SPEED,
    runwayImpact: RUNWAY_IMPACT_SPEED
});

export function createCrashState() {
    return { crashed: false, timer: 0, outcome: FLYING, landings: 0 };
}

/**
 * True when a vertical speed is a hard enough descent to break the aircraft.
 * Vertical speed is signed: descent is negative, so a climb into terrain -
 * which the ground clamp cannot produce - is never an impact.
 */
export function isCrashImpact(verticalSpeed, threshold = CRASH_IMPACT_SPEED) {
    return verticalSpeed <= -Math.abs(threshold);
}

/**
 * Starts a crash and its countdown. Returns true when this began a new crash,
 * and false when one was already running, so a wreck sliding along the ground
 * cannot keep restarting its own timer.
 */
export function beginCrash(state, duration = CRASH_DURATION) {
    if (state.crashed) return false;
    state.crashed = true;
    state.timer = duration;
    return true;
}

/**
 * Clears a crash without waiting out its timer, for a pilot who hits reset
 * rather than sitting through the countdown.
 */
export function clearCrash(state) {
    state.crashed = false;
    state.timer = 0;
    state.outcome = FLYING;
}

/**
 * Runs the crash countdown for one frame. Returns true on the single frame
 * the timer runs out, which is the caller's cue to reset the flight.
 */
export function updateCrash(state, dt, duration = CRASH_DURATION) {
    if (!state.crashed) return false;
    state.timer = Math.max(0, state.timer - Math.max(dt, 0));
    if (state.timer > 0) return false;
    clearCrash(state);
    return true;
}

/**
 * True while the pilot's input should be ignored. The controls are dead
 * through a crash so the wreck cannot be flown out of.
 */
export function controlsLocked(state) {
    return state.crashed === true;
}

/**
 * The fraction of the crash countdown still to run, from 1 at the moment of
 * impact down to 0 at the reset, for anything that wants to fade with it.
 */
export function crashProgress(state, duration = CRASH_DURATION) {
    if (!state.crashed || duration <= 0) return 0;
    return Math.min(1, Math.max(0, state.timer / duration));
}

// --- Landing on a runway --------------------------------------------------

/**
 * An angle folded back into the half turn either side of zero, so a bearing
 * that has been added to a few too many times still reads as the small offset
 * it is rather than as most of a circle.
 */
export function wrapAngle(radians) {
    const turn = Math.PI * 2;
    const wrapped = ((radians % turn) + turn) % turn;
    return wrapped > Math.PI ? wrapped - turn : wrapped;
}

/**
 * How far off a strip the nose is pointing, in radians, measured to whichever
 * end of it is nearer: a runway is flown in either direction, so arriving on
 * the reciprocal is arriving square rather than backwards.
 */
export function headingOffsetTo(heading, runwayHeading) {
    const offset = Math.abs(wrapAngle(heading - runwayHeading));
    return Math.min(offset, Math.PI - offset);
}

/**
 * True when the aircraft is being held the way a landing is flown: wings level
 * enough, nose neither dug in nor held off, and the strip running away under
 * the nose rather than across it.
 */
export function withinLandingAttitude(contact = {}, limits = {}) {
    const { bank, pitch, heading } = { ...LANDING_LIMITS, ...limits };
    return Math.abs(wrapAngle(contact.bank ?? 0)) <= bank
        && Math.abs(wrapAngle(contact.pitch ?? 0)) <= pitch
        && Math.abs(contact.headingOffset ?? 0) <= heading;
}

/**
 * What meeting the ground amounted to.
 *
 * Off a runway the rule is the one it has always been: too fast a descent
 * breaks the aircraft, and anything gentler is flown out of. On a runway a
 * descent inside the landing limits, flown in the attitude a landing is flown
 * in, is a landing; a firmer arrival still rolls out, because prepared ground
 * takes more than a hillside does; and only past the runway's own threshold is
 * it a crash.
 */
export function touchdownOutcome(contact = {}, limits = {}) {
    const settings = { ...LANDING_LIMITS, ...limits };
    const descent  = contact.verticalSpeed ?? 0;

    if (!contact.onRunway) {
        return isCrashImpact(descent, settings.impactSpeed) ? CRASHED : FLYING;
    }

    if (isCrashImpact(descent, settings.runwayImpact)) return CRASHED;

    return !isCrashImpact(descent, settings.sinkSpeed) && withinLandingAttitude(contact, settings)
        ? LANDED
        : FLYING;
}

/**
 * Records what an arrival turned out to be. A crash starts its countdown the
 * way it always did; a landing is held as the outcome while the aircraft is
 * still on the strip, and counted once rather than once per frame of rollout.
 *
 * Returns true when the outcome is new, which is the caller's cue to act on it.
 */
export function recordTouchdown(state, outcome, duration = CRASH_DURATION) {
    if (outcome === CRASHED) {
        if (!beginCrash(state, duration)) return false;
        state.outcome = CRASHED;
        return true;
    }

    if (state.crashed || outcome === state.outcome) return false;

    state.outcome = outcome;
    if (outcome === LANDED) state.landings += 1;
    return true;
}

/**
 * Puts the outcome back to a flight in progress, for an aircraft that has left
 * the ground again. A crash is not cleared this way: a wreck is not flying
 * however far off the ground the reset leaves it.
 */
export function releaseGround(state) {
    if (state.crashed || state.outcome === FLYING) return false;
    state.outcome = FLYING;
    return true;
}

/** What the flight is currently doing about the ground, for anything showing it. */
export function groundOutcome(state) {
    return state?.outcome ?? FLYING;
}

export function hasLanded(state) {
    return groundOutcome(state) === LANDED;
}
