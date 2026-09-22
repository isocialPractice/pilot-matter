/**
 * Flight model - the arcade physics rules, as pure functions with no DOM or
 * Three.js dependencies so they can be unit tested in Node.
 *
 * Throttle is a setting, not a speed: Shift and Ctrl move a 0-1 lever, the
 * lever picks a target speed, and airspeed converges toward that target.
 * Lift is then read off airspeed - too slow and the aircraft stalls and
 * sinks hard, at cruise speed lift cancels gravity and level flight holds
 * altitude.
 */

// Speeds are in world units per second.
export const MIN_SPEED    = 40;    // below this the wing stalls
export const CRUISE_SPEED = 120;   // lift cancels gravity from here up
export const MAX_SPEED    = 200;   // speed at a full throttle setting

// Gravity in units per second squared, before any lift is subtracted.
export const GRAVITY = 12;

// A stalled wing sinks up to this multiple of the unlifted rate, reached at
// a dead stop and easing back to normal as the aircraft regains MIN_SPEED.
export const STALL_SINK_MULTIPLIER = 2;

// Throttle lever travel per second: a full 0-100% sweep takes two seconds.
export const THROTTLE_RATE = 0.5;

// How hard the engine pulls toward the target speed, and how quickly drag
// bleeds speed off when the throttle is pulled back. Units per second
// squared; drag is the gentler of the two.
export const SPEED_ACCEL = 60;
export const SPEED_DECEL = 40;

// A glide is the same wing with nothing pulling it: airspeed is bought with
// height instead of with the engine, so the nose sets the speed rather than the
// lever. GLIDE_SPEED is what a level nose settles at, and GLIDE_PITCH_SPEED is
// how much a radian of nose-down adds to it.
//
// The pair is chosen so that the nose-up angle which bleeds the speed to
// nothing is about 25 degrees, which is what makes a settled glide always a
// descent: past that the wing has no speed left to climb on, and short of it
// the sink the slow wing is already losing outruns the climb the nose is asking
// for. `glideDescent` is that guarantee written down, and the suite sweeps it.
//
// What the pair describes is a glide that has settled: the descent at an
// attitude once the airspeed is the one that attitude asks for. The aircraft
// is not always on it. The nose moves at the control rate and the speed
// follows at GLIDE_ACCEL and GLIDE_DECEL below, which are far slower, so for a
// second or two after a pull the aircraft carries the speed of the attitude it
// left at the angle of the one it arrived at - and that pair is not on the
// curve the sweep walks. `glideDescentAt` is the same guarantee held over
// every pair the aircraft can actually be in, which is where it has to hold
// for the mode to mean anything.
export const GLIDE_SPEED       = 80;
export const GLIDE_PITCH_SPEED = 180;

// How quickly a glide settles on the speed its nose is asking for. Slower than
// the engine either way, because what is being moved is the aircraft's own
// momentum rather than a throttle: a nose dropped for speed pays for it over a
// second or two, which is the trade a glide is planned around.
export const GLIDE_ACCEL = 26;
export const GLIDE_DECEL = 20;

// How fast a held control key turns the aircraft, in radians per second. Roll
// is the quickest because it is the control a turn is flown with, and yaw is
// the slowest because it is the one used to trim rather than to manoeuvre.
export const PITCH_RATE = 1.2;
export const ROLL_RATE  = 2.0;
export const YAW_RATE   = 0.8;

// How long the nose takes to settle to level when a flight is levelled off,
// in seconds. Long enough that the movement reads as the aircraft settling
// rather than as a jump, short enough that the aircraft is level by the time
// a pilot has looked back at the instrument. This is the one copy of the
// interval; change it here and both the model and the dial change with it.
export const LEVEL_OFF_SECONDS = 0.6;

// What those rates are multiplied by, which the settings panel moves. The
// range it offers is deliberately narrow: this is how hard the controls bite,
// not a different aircraft.
export const CONTROL_SENSITIVITY = 1;
export const MIN_SENSITIVITY     = 0.1;
export const MAX_SENSITIVITY     = 4;

function clamp(value, low, high) {
    return Math.min(Math.max(value, low), high);
}

/**
 * The control rates at a sensitivity setting. Kept as a function of the
 * setting rather than as state so the same setting always means the same
 * rates, however many times it has been changed.
 */
export function controlRates(sensitivity = CONTROL_SENSITIVITY) {
    const scale = clamp(numberOr(sensitivity, CONTROL_SENSITIVITY), MIN_SENSITIVITY, MAX_SENSITIVITY);
    return {
        pitch: PITCH_RATE * scale,
        roll:  ROLL_RATE  * scale,
        yaw:   YAW_RATE   * scale
    };
}

// Nothing named is not a setting of zero: a caller asking for no particular
// sensitivity gets the one the controls were tuned at, rather than a control
// that has been turned all the way down.
function numberOr(value, fallback) {
    if (value === null || value === undefined) return fallback;
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

/**
 * Moves the throttle lever for one frame and returns the new 0-1 setting.
 * Holding both keys cancels out; the lever stops at each end rather than
 * winding past it.
 */
export function updateThrottle(throttle, input = {}, dt, rate = THROTTLE_RATE) {
    let next = throttle;
    if (input.throttleUp)   next += rate * dt;
    if (input.throttleDown) next -= rate * dt;
    return clamp(next, 0, 1);
}

/**
 * The speed a throttle setting asks for. A closed throttle asks for a dead
 * stop, which is what makes an idle aircraft stall and sink.
 */
export function targetSpeed(throttle, maxSpeed = MAX_SPEED) {
    return clamp(throttle, 0, 1) * maxSpeed;
}

/**
 * Steps airspeed toward the target for one frame, snapping to the target
 * once it is within a single step so speed settles instead of oscillating.
 */
export function convergeSpeed(speed, target, dt, accel = SPEED_ACCEL, decel = SPEED_DECEL) {
    const gap = target - speed;
    if (gap === 0) return target;
    const step = (gap > 0 ? accel : decel) * dt;
    return Math.abs(gap) <= step ? target : speed + Math.sign(gap) * step;
}

/**
 * The airspeed a glide settles at for an attitude, with nothing driving it but
 * the nose.
 *
 * `pitch` is the attitude in the form the aircraft carries it - the X part of
 * its YXZ rotation - so a positive angle is nose-down and buys speed, and a
 * negative one is nose-up and spends it. Read the sign off `pitchForClimb`,
 * which negates for the same reason: the model flies nose-first along +Z.
 *
 * Floored at a standstill and capped at the same top speed the engine has, so a
 * dive is fast rather than unbounded.
 */
export function glideSpeed(pitch, options = {}) {
    const {
        glideSpeed: level = GLIDE_SPEED,
        pitchSpeed        = GLIDE_PITCH_SPEED,
        maxSpeed          = MAX_SPEED
    } = options;

    return clamp(level + numberOr(pitch, 0) * pitchSpeed, 0, maxSpeed);
}

/**
 * The attitude a glide has settled to at an airspeed, which is `glideSpeed`
 * read the other way round: the nose that asks for this speed.
 *
 * Not clamped to the range a pilot can hold the nose in, because it is not an
 * attitude anybody is being put at - it is the answer to "what nose does this
 * speed belong to", which is what says whether the nose the pilot is holding
 * is one their airspeed can pay for.
 */
export function glidePitch(speed, options = {}) {
    const {
        glideSpeed: level = GLIDE_SPEED,
        pitchSpeed        = GLIDE_PITCH_SPEED
    } = options;

    if (!(pitchSpeed > 0)) return 0;
    return (Math.max(numberOr(speed, 0), 0) - level) / pitchSpeed;
}

/**
 * How fast the aircraft loses height at an attitude and an airspeed, in units
 * per second, counted positive downward.
 *
 * Both halves of it, added the way the aircraft adds them: the height the nose
 * itself is pointing away, which is the airspeed through the vertical part of
 * the nose direction, and the sink the wing is losing on top of that at the
 * speed it is doing. The pair is taken as given rather than derived from each
 * other - this is the aircraft's vertical at whatever state it is in, engine or
 * no engine.
 */
export function descentRate(pitch, speed, options = {}) {
    const airspeed = Math.max(numberOr(speed, 0), 0);
    return airspeed * Math.sin(numberOr(pitch, 0)) + sinkRate(airspeed, options);
}

/**
 * How fast a settled glide loses height at an attitude, in units per second,
 * counted positive downward. The descent at `pitch` once the airspeed is the
 * one that attitude asks for.
 *
 * It exists to be asserted about. A glide that came out positive at some
 * attitude would be an aircraft climbing on no engine and holding the climb
 * forever, which is the one way a dead stick can stop being a dead stick, and
 * it is not a thing anyone would see by flying - it needs the whole attitude
 * range swept, which is what the suite does with this.
 *
 * What it does not cover is the aircraft on its way to that attitude, which is
 * where the climb was actually found. `glideDescentAt` is this guarantee held
 * over every pair instead of over the settled one.
 */
export function glideDescent(pitch, options = {}) {
    return descentRate(pitch, glideSpeed(pitch, options), options);
}

/**
 * The same descent for a glide that has not settled: the vertical at an
 * attitude the airspeed has not caught up with, which is where a dead stick
 * spends a second or two after every pull.
 *
 * The nose moves at the control rate and the airspeed follows at GLIDE_ACCEL
 * and GLIDE_DECEL, so the two are routinely out of step, and `glideDescent`
 * says nothing about the pairs in between. Flown straight, those pairs climb:
 * at the 65 units a settled glide holds, any nose-up past about -0.19 radians
 * comes out with the aircraft gaining height on no engine, which the mode is
 * built on not happening.
 *
 * So the nose counts for no more height than the airspeed can pay for. The
 * floor is the attitude this speed has settled to, taken no further than level:
 * a speed above the level glide's has settled to a nose-down attitude, and a
 * dead stick is not shoved into a dive the pilot never put it in. Being a
 * floor on the attitude rather than on the descent, it only ever bites on a
 * nose held up - and it can never ask for a faster descent than the level nose
 * at that speed is already losing, so nothing lurches.
 *
 * Two things follow, and the suite holds both. A settled pair is unchanged at
 * every attitude, so the glide the mode is flown on is exactly the one
 * `glideDescent` describes. And no pair the aircraft can be in comes out
 * climbing: below cruise speed the descent is strictly positive, and at or
 * above it a level nose holds height for as long as the speed lasts, which is
 * the wing cancelling gravity rather than the glide giving way.
 */
export function glideDescentAt(pitch, speed, options = {}) {
    const paidFor = Math.min(glidePitch(speed, options), 0);
    return descentRate(Math.max(numberOr(pitch, 0), paidFor), speed, options);
}

/**
 * Lift as a fraction of weight, from zero at a standstill to a full 1 at
 * cruise speed. Capped at 1 so extra speed never lifts the aircraft on its
 * own - climbing is done with the nose, not the engine.
 */
export function liftFactor(speed, cruiseSpeed = CRUISE_SPEED) {
    if (cruiseSpeed <= 0) return 1;
    const ratio = Math.max(speed, 0) / cruiseSpeed;
    return Math.min(1, ratio * ratio);
}

/**
 * True while the wing is below its stall speed.
 */
export function isStalled(speed, minSpeed = MIN_SPEED) {
    return speed < minSpeed;
}

/**
 * How fast the aircraft falls this frame, in units per second, before pitch
 * is taken into account. Gravity minus lift, multiplied by a stall penalty
 * that eases in from 1 at the stall speed to the full multiplier at a dead
 * stop. Zero at and above cruise speed, so level flight holds altitude.
 */
export function sinkRate(speed, options = {}) {
    const {
        gravity         = GRAVITY,
        minSpeed        = MIN_SPEED,
        cruiseSpeed     = CRUISE_SPEED,
        stallMultiplier = STALL_SINK_MULTIPLIER
    } = options;

    const sink = gravity * (1 - liftFactor(speed, cruiseSpeed));
    if (!isStalled(speed, minSpeed) || minSpeed <= 0) return sink;

    const severity = 1 + (1 - Math.max(speed, 0) / minSpeed) * (stallMultiplier - 1);
    return sink * severity;
}

/**
 * The vertical part of the direction the nose has to point to hold a climb
 * rate at an airspeed. The nose has to lift enough to turn forward motion into
 * the asked-for climb and to out-climb the sink the wing is already losing at
 * that speed, so a slow aircraft needs a steeper attitude for the same climb.
 */
export function climbForward(verticalSpeed, speed, options = {}) {
    if (speed <= 0) return 0;
    return clamp((verticalSpeed + sinkRate(speed, options)) / speed, -1, 1);
}

/**
 * The same climb as a pitch angle, in the form the aircraft carries it: the X
 * part of its YXZ euler rotation.
 *
 * The angle comes out negated because the model flies nose-first along +Z, and
 * a positive rotation about +X - the axis out of the left wing - carries that
 * nose down. Anything reading the attitude reads the nose direction instead,
 * so this sign lives here and nowhere else.
 */
export function pitchForClimb(verticalSpeed, speed, options = {}) {
    return -Math.asin(climbForward(verticalSpeed, speed, options));
}

/**
 * How far through a level off the nose is at a moment in it, from 0 at the
 * press to 1 once it has settled. Smoothstep, so the nose leaves the attitude
 * the pilot left it in gently and arrives at level gently rather than starting
 * and stopping dead.
 */
export function levelOffProgress(elapsed, duration = LEVEL_OFF_SECONDS) {
    if (!(duration > 0)) return 1;
    const t = clamp(elapsed / duration, 0, 1);
    return t * t * (3 - 2 * t);
}

/**
 * The pitch the nose is at part way through a level off, easing from wherever
 * the pilot left it to level over `duration` seconds.
 *
 * Exact at both ends: the attitude it started at on the frame the key went
 * down, and a flat zero once the ease has run. Anything reading the attitude
 * reads the model's own pitch, so easing it here is what carries the artificial
 * horizon down with the nose - one value eased once, rather than the model and
 * the dial each easing their own and disagreeing by a frame.
 */
export function pitchLevellingOff(startPitch, elapsed, duration = LEVEL_OFF_SECONDS) {
    const remaining = 1 - levelOffProgress(elapsed, duration);

    // Level is a flat zero rather than the negative one scaling a nose-down
    // attitude by nothing leaves behind. The two fly identically; only one of
    // them reads as level to anything comparing the number.
    return remaining === 0 ? 0 : startPitch * remaining;
}
