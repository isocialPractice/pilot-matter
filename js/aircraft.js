import * as THREE from 'three';
import {
    createInputState, applyKeyToInput, isResetKey, isLevelOffKey, wantsVerticalChange,
    DEFAULT_KEYMAP
} from './input-map.js';
import { createFlightState } from './flight-state.js';
import {
    MIN_SPEED, CRUISE_SPEED, MAX_SPEED, GRAVITY, CONTROL_SENSITIVITY,
    updateThrottle, targetSpeed, convergeSpeed, sinkRate, isStalled, controlRates
} from './flight-model.js';
import {
    GROUND_CLEARANCE, CRASH_IMPACT_SPEED, RUNWAY_IMPACT_SPEED,
    CRASHED, LANDED, createCrashState, clearCrash, updateCrash, controlsLocked,
    touchdownOutcome, recordTouchdown, releaseGround, groundOutcome, headingOffsetTo,
    ranOffRunway
} from './crash.js';
import { isOnRunway, nearestRunway } from './environment/elements.js';
import { wrapPosition } from './world-edge.js';

/**
 * The aircraft: a model in a scene, and the frame loop the flight model drives
 * it through.
 *
 * Everything the game hands it is optional, because the Pilot API flies the
 * same class against a host's own scene, a host's own model, and a host's own
 * input source. Given nothing but a scene, it is the bundled aircraft flying
 * the configured start state.
 */
export class Aircraft {
    constructor(scene, options = {}) {
        this.scene   = scene;
        this.options = options;

        const flight = options.flight ?? {};
        this.minSpeed    = flight.minSpeed    ?? MIN_SPEED;
        this.cruiseSpeed = flight.cruiseSpeed ?? CRUISE_SPEED;
        this.maxSpeed    = flight.maxSpeed    ?? MAX_SPEED;
        this.gravity     = flight.gravity     ?? GRAVITY;
        this.clearance   = flight.clearance   ?? GROUND_CLEARANCE;
        this.impactSpeed = flight.impactSpeed ?? CRASH_IMPACT_SPEED;
        this.runwayImpactSpeed = flight.runwayImpactSpeed ?? RUNWAY_IMPACT_SPEED;

        // The strips in the world being flown over. Empty until something hands
        // them over, which is what leaves a host flying its own terrain with the
        // rule it has always had: every arrival is an arrival on open ground.
        this.runways = options.runways ?? [];

        this.setSensitivity(flight.sensitivity ?? CONTROL_SENSITIVITY);

        this.position = new THREE.Vector3();
        this.rotation = new THREE.Euler(0, 0, 0, 'YXZ');

        // The ground under the aircraft, for the altitude warning, filled in
        // each frame from whatever terrain the caller is flying over.
        this.terrainHeight = 0;

        this.crash  = createCrashState();
        this.input  = options.input ?? createInputState();
        this.keymap = options.keymap ?? DEFAULT_KEYMAP;

        this.reset();
        this.createModel(options.model ?? null, options.anchor ?? null);
        if (options.controls !== false) this.setupControls();
    }

    /**
     * The condition a flight starts from and resets back to: the configured
     * start state, with anything the caller asked to change about it applied
     * over the top.
     */
    startState() {
        const start  = createFlightState();
        const flight = this.options.flight;
        if (!flight) return start;

        return {
            speed:         flight.speed         ?? start.speed,
            throttle:      flight.throttle      ?? start.throttle,
            verticalSpeed: flight.verticalSpeed ?? start.verticalSpeed,
            cameraMode:    start.cameraMode,
            grounded:      flight.grounded === true,
            position: {
                x: flight.x ?? start.position.x,
                y: flight.altitude ?? start.position.y,
                z: flight.z ?? start.position.z
            },
            rotation: {
                x: flight.pitch ?? start.rotation.x,
                y: flight.yaw   ?? start.rotation.y,
                z: 0
            }
        };
    }

    /**
     * The strips in the world under the aircraft. Handed over rather than
     * looked up, because the aircraft does not know what it is flying over -
     * the bundled terrain, a game mode's world, or a host's own ground.
     */
    setRunways(runways = []) {
        this.runways = runways ?? [];
        return this.runways;
    }

    /** The strip the aircraft is over, or null when it is over open ground. */
    runwayUnder(x = this.position.x, z = this.position.z) {
        const strip = nearestRunway(this.runways, x, z);
        return isOnRunway(strip, x, z) ? strip : null;
    }

    /**
     * Changes the condition the aircraft resets into, without resetting it: a
     * start edited mid-flight is the next flight's, not this one's. Fields the
     * caller does not name keep whatever they were.
     *
     * Returns the start state now in force.
     */
    setStart(flight = {}) {
        this.options = { ...this.options, flight: { ...this.options.flight, ...flight } };
        return this.startState();
    }

    /**
     * How hard the controls bite, as a multiplier on every control rate. The
     * rates are worked out here rather than every frame, because a setting is
     * changed far less often than a frame is drawn.
     */
    setSensitivity(sensitivity) {
        this.sensitivity = sensitivity;
        this.rates = controlRates(sensitivity);
        return this.rates;
    }

    createModel(external = null, anchor = null) {
        this.group = new THREE.Group();

        if (external) {
            // An external aircraft is flown from the control anchor it
            // declares: the model is shifted so that point sits where the
            // flight model puts the aircraft, rather than the host having to
            // rebuild its own model around an origin this simulator chose.
            if (anchor) external.position.set(-(anchor.x ?? 0), -(anchor.y ?? 0), -(anchor.z ?? 0));
            this.group.add(external);
        } else {
            this.group.add(...bundledModel());
        }

        this.group.position.copy(this.position);
        this.group.rotation.copy(this.rotation);
        this.scene?.add(this.group);
    }

    setupControls() {
        this.onKeyDown = (e) => this.onKey(e, true);
        this.onKeyUp   = (e) => this.onKey(e, false);
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup',   this.onKeyUp);
    }

    /** Takes the keyboard back off the aircraft, for a host tearing one down. */
    releaseControls() {
        if (!this.onKeyDown) return;
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup',   this.onKeyUp);
        this.onKeyDown = this.onKeyUp = null;
    }

    onKey(e, down) {
        const changed = applyKeyToInput(this.input, e.code, down, this.keymap);
        if (down && (changed === 'throttleUp' || changed === 'throttleDown')) {
            e.preventDefault();
        }
        if (down && isResetKey(e.code)) this.reset();

        // Space scrolls a page given the chance, so the key is taken as well as
        // read. Repeats are left alone: the level off is a press rather than a
        // hold, and a held key would keep asking for something already in force.
        if (down && isLevelOffKey(e.code)) {
            e.preventDefault();
            if (!e.repeat) this.levelOff();
        }
    }

    reset() {
        const start = this.startState();
        this.position.set(start.position.x, start.position.y, start.position.z);
        this.rotation.set(start.rotation.x, start.rotation.y, start.rotation.z);
        this.speed = start.speed;
        this.throttle = start.throttle;

        // The climb rate starts on the configured one, so the vertical speed
        // indicator reads the climb the aircraft is already in rather than a
        // level zero it would only leave on the first frame that runs.
        this.verticalSpeed = start.verticalSpeed;
        clearCrash(this.crash);

        // A flight that opens on the ground has not landed there: it is waiting
        // to go, and the first arrival it will be judged on is the one it flies
        // back to after leaving. A flight that opens in the air is already up.
        this.airborne = !start.grounded;

        // Whether the run along the ground is on a strip, which is what makes
        // leaving one an event. Left unset rather than worked out here: the
        // strips arrive from the caller and a reset can run before they do, so
        // the first grounded frame reads the ground itself.
        this.onStrip = null;

        // Whether the pilot has asked for the climb to be trimmed out, which
        // holds until they ask for a different vertical state.
        this.holdingAltitude = false;

        // Nothing is told about the reset the constructor runs: there is no
        // model to place and no flight to have been interrupted yet, so a host
        // hears about the resets that happened to a flight rather than about
        // the one that built it.
        if (this.group) {
            this.group.position.copy(this.position);
            this.group.rotation.copy(this.rotation);
            this.options.onReset?.(start);
        }
    }

    /**
     * Carries the aircraft across the world's edge and back in over the
     * opposite one, so the ground never runs out from under it. Only the
     * horizontal position moves: the altitude, the attitude, and the heading
     * are the flight, and a flight that changed at the edge would be a fence.
     *
     * Returns true when the aircraft crossed.
     */
    wrapInside(bounds) {
        const inside = wrapPosition(bounds, this.position.x, this.position.z);
        if (!inside.wrapped) return false;

        this.position.x = inside.x;
        this.position.z = inside.z;
        this.group?.position.copy(this.position);
        return true;
    }

    update(dt, terrainHeight = 0) {
        dt = Math.min(dt, 0.05);
        this.terrainHeight = terrainHeight;

        // A crash locks the controls: the wreck sits where it hit while the
        // countdown runs, then the flight resets itself
        if (controlsLocked(this.crash)) {
            if (updateCrash(this.crash, dt)) this.reset();
            this.group.position.copy(this.position);
            this.group.rotation.copy(this.rotation);
            return;
        }

        const startY = this.position.y;

        // Shift and Ctrl move the throttle lever, and speed chases the
        // setting rather than jumping with the key
        this.throttle = updateThrottle(this.throttle, this.input, dt);
        this.speed = convergeSpeed(this.speed, targetSpeed(this.throttle, this.maxSpeed), dt);

        // Pitch: W = nose up, S = nose down, which is what the pads, the
        // control list and the documentation all say it is.
        //
        // The control that raises the nose is the one that lowers the angle.
        // The model flies nose-first along +Z, so a positive rotation about
        // +X - the axis out of the left wing - carries that nose down, which
        // is the same sign `pitchForClimb` in js/flight-model.js negates for
        // the same reason. Raising it here flew W into a dive.
        if (this.input.pitchUp)   this.rotation.x -= this.rates.pitch * dt;
        if (this.input.pitchDown) this.rotation.x += this.rates.pitch * dt;
        this.rotation.x = THREE.MathUtils.clamp(this.rotation.x, -Math.PI / 2.2, Math.PI / 2.2);

        // Roll
        if (this.input.rollLeft)  this.rotation.z += this.rates.roll * dt;
        if (this.input.rollRight) this.rotation.z -= this.rates.roll * dt;
        this.rotation.z = THREE.MathUtils.clamp(this.rotation.z, -Math.PI, Math.PI);

        // Roll auto-levels slowly when no input
        if (!this.input.rollLeft && !this.input.rollRight) {
            this.rotation.z *= (1 - dt * 1.5);
        }

        // Yaw: Q = nose left, E = nose right
        if (this.input.yawLeft)  this.rotation.y += this.rates.yaw * dt;
        if (this.input.yawRight) this.rotation.y -= this.rates.yaw * dt;

        // Banking roll causes yaw (coordinated turn)
        this.rotation.y -= Math.sin(this.rotation.z) * 1.2 * dt;

        // Move forward in the direction the aircraft faces
        const quat = new THREE.Quaternion().setFromEuler(this.rotation);
        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(quat);
        this.position.addScaledVector(forward, this.speed * dt);

        // Lift is read off airspeed: a stalled wing drops hard, cruise speed
        // cancels gravity and holds altitude in level flight
        this.position.y -= sinkRate(this.speed, {
            gravity: this.gravity,
            minSpeed: this.minSpeed,
            cruiseSpeed: this.cruiseSpeed
        }) * dt;

        // The level off, which is the whole of what a vertical speed trimmed to
        // zero means: the altitude the aircraft was at is the altitude it keeps,
        // and the nose stays exactly where the pilot put it. Holding one by hand
        // is a fiddle in the middle of everything else a landing asks for, and
        // this is the trim wheel for it.
        //
        // The next call for a different vertical state hands the aircraft back.
        // Roll and yaw are not that call: an altitude held through a turn is
        // what holding one is for.
        if (wantsVerticalChange(this.input)) this.holdingAltitude = false;

        // Only in the air. On the ground the altitude is the ground's, and the
        // hold would be pinning the aircraft to a strip it is trying to leave.
        if (this.holdingAltitude && this.airborne) this.position.y = startY;

        // Ground contact. Off a runway, meeting the terrain gently is flown out
        // of and arriving faster than the impact threshold is a crash. On one, a
        // soft square arrival is a landing, which is an outcome the HUD and the
        // game modes read rather than something the aircraft acts on itself.
        //
        // Only the frame the aircraft arrives on is judged. Everything after it
        // is a rollout, and a rollout is not a second arrival: judging every
        // frame of one would turn a landing into a crash as the airspeed - and
        // with it the lift holding the aircraft up - bled away underneath it.
        const impactRate = dt > 0 ? (this.position.y - startY) / dt : 0;
        const minY = terrainHeight + this.clearance;
        const onGround = this.position.y <= minY;

        if (onGround) {
            this.position.y = minY;
            const onStrip = this.runwayUnder() != null;

            if (this.airborne) {
                this.airborne = false;
                const contact = this.contactAt(impactRate);
                const outcome = touchdownOutcome(contact, {
                    impactSpeed: this.impactSpeed,
                    runwayImpact: this.runwayImpactSpeed
                });

                // The strip first, which is what a landing has always been
                // reported as, and the arrival itself after it: where on the
                // strip it happened and how, which is everything a landing can
                // be scored from and nothing a caller has to take.
                if (recordTouchdown(this.crash, outcome) && outcome === LANDED) {
                    this.options.onLanding?.(this.runwayUnder(), contact);
                }

                this.onStrip = onStrip;
                if (outcome === CRASHED) return this.stopOnTheGround();
            } else if (ranOffRunway(this.onStrip, onStrip)) {
                // The run has left the strip it was running on - a takeoff
                // that went past the end of it, or a rollout off the side.
                // That ends the attempt through the same path any other
                // arrival on ground the aircraft cannot use takes, rather than
                // leaving it driving across the country as though it were
                // taxiing.
                this.onStrip = false;
                recordTouchdown(this.crash, CRASHED);
                return this.stopOnTheGround();
            } else {
                this.onStrip = onStrip;
            }
        } else if (!this.airborne) {
            this.airborne = true;
            this.onStrip = null;
            releaseGround(this.crash);
        }

        // The vertical speed indicator reads the altitude actually gained or
        // lost this frame, so riding up a hillside shows as the climb it is.
        // A frozen clock leaves the last reading on the dial.
        if (dt > 0) this.verticalSpeed = (this.position.y - startY) / dt;

        this.group.position.copy(this.position);
        this.group.rotation.copy(this.rotation);
    }

    /**
     * Trims the climb out and leaves the nose where it is, which is what the
     * pilot is asking for when they hold an altitude by hand: the vertical
     * speed reads zero from the next frame and the aircraft keeps the altitude
     * it was at until the pilot calls for a different one.
     *
     * Refused while the controls are locked, because a wreck is not being
     * flown. Returns true when the hold is now in force.
     */
    levelOff() {
        if (controlsLocked(this.crash)) return false;
        this.holdingAltitude = true;
        return true;
    }

    /** True while the flight is holding the altitude the pilot levelled it at. */
    isHoldingAltitude() {
        return this.holdingAltitude === true;
    }

    /**
     * Puts the wreck down where it is: no speed, no power, no climb, and the
     * model left standing where the flight ended. Both ways a flight ends on
     * the ground come through here, so an overrun is stopped exactly the way an
     * arrival that broke the aircraft is.
     */
    stopOnTheGround() {
        this.speed = 0;
        this.throttle = 0;
        this.verticalSpeed = 0;
        this.holdingAltitude = false;
        this.group.position.copy(this.position);
        this.group.rotation.copy(this.rotation);
    }

    getPosition()  { return this.position.clone(); }
    getRotation()  { return this.rotation.clone(); }
    getQuaternion(){ return new THREE.Quaternion().setFromEuler(this.rotation); }
    getSpeed()     { return this.speed; }
    getAltitude()  { return this.position.y; }
    getThrottle()  { return this.throttle; }
    getHeading()   { return this.rotation.y; }
    getVerticalSpeed() { return this.verticalSpeed; }
    getHeightAboveTerrain() { return this.position.y - this.terrainHeight; }
    isCrashed()    { return controlsLocked(this.crash); }
    isStalling()   { return isStalled(this.speed, this.minSpeed); }
    isAirborne()   { return this.airborne !== false; }

    /** What the last arrival on the ground turned out to be: flying, landed, or crashed. */
    getGroundOutcome() { return groundOutcome(this.crash); }

    /** How many landings this flight has made, which is what a game mode counts. */
    getLandings() { return this.crash.landings; }

    /**
     * How the aircraft is meeting the ground, as the reading the touchdown rules
     * are written against: the descent it arrived at, whether there is a strip
     * under it, and how it is being held.
     *
     * Where it is meeting the ground rides along with it, on the same reading
     * rather than on a second one. The rules ignore it, but a landing is scored
     * on where down the strip it happened as much as on how, and the place and
     * the manner are the one moment.
     */
    contactAt(verticalSpeed) {
        const strip = this.runwayUnder();
        const forwardY = THREE.MathUtils.clamp(this.getAttitude().forwardY, -1, 1);

        return {
            verticalSpeed,
            onRunway: strip != null,
            x: this.position.x,
            z: this.position.z,
            // The compass bearing the nose is on, in radians, which is the yaw
            // read the way the card counts rather than the way the model turns.
            heading: -this.rotation.y,
            bank: this.rotation.z,
            // The nose's own elevation rather than the pitch that was asked for,
            // so the aircraft is read the way it is actually being held.
            pitch: Math.asin(forwardY),
            headingOffset: strip
                ? headingOffsetTo(-this.rotation.y, strip.heading * Math.PI / 180)
                : 0
        };
    }

    /**
     * Where the nose and the wings are pointing, as the vertical part of each
     * direction. The attitude indicator reads the aircraft's orientation this
     * way rather than reading the pitch and roll angles behind it, so the
     * ladder shows what the aircraft is doing rather than what it was asked
     * to do. The model is built with its nose along +Z, which puts the right
     * wing along -X.
     */
    getAttitude() {
        const quat = this.getQuaternion();
        return {
            forwardY: new THREE.Vector3(0, 0, 1).applyQuaternion(quat).y,
            rightY:   new THREE.Vector3(-1, 0, 0).applyQuaternion(quat).y,
            upY:      new THREE.Vector3(0, 1, 0).applyQuaternion(quat).y
        };
    }
}

/**
 * The bundled aircraft, built nose-first along +Z with its control anchor at
 * the origin, which is the same contract an external model has to meet.
 */
export function bundledModel() {
    const mat     = new THREE.MeshPhongMaterial({ color: 0x4477aa });
    const wingMat = new THREE.MeshPhongMaterial({ color: 0x3366aa });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.5, 8, 8), mat);
    body.rotation.x = Math.PI / 2;

    const wings = new THREE.Mesh(new THREE.BoxGeometry(14, 0.15, 2), wingMat);

    const tail = new THREE.Mesh(new THREE.BoxGeometry(5, 0.1, 1), wingMat);
    tail.position.set(0, 0, -3.5);

    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2, 1.5), wingMat);
    fin.position.set(0, 1, -3.5);

    const nose = new THREE.Mesh(
        new THREE.ConeGeometry(0.5, 1.5, 8),
        new THREE.MeshPhongMaterial({ color: 0xdddddd })
    );
    nose.rotation.x = -Math.PI / 2;
    nose.position.set(0, 0, 4.5);

    return [body, wings, tail, fin, nose];
}
