import * as THREE from 'three';
import { createInputState, applyKeyToInput, isResetKey, DEFAULT_KEYMAP } from './input-map.js';
import { createFlightState } from './flight-state.js';
import {
    MIN_SPEED, CRUISE_SPEED, MAX_SPEED, GRAVITY, CONTROL_SENSITIVITY,
    updateThrottle, targetSpeed, convergeSpeed, sinkRate, isStalled, controlRates
} from './flight-model.js';
import {
    GROUND_CLEARANCE, CRASH_IMPACT_SPEED, createCrashState, isCrashImpact,
    beginCrash, clearCrash, updateCrash, controlsLocked
} from './crash.js';
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
            position: { x: 0, y: flight.altitude ?? start.position.y, z: 0 },
            rotation: {
                x: flight.pitch ?? start.rotation.x,
                y: flight.yaw   ?? start.rotation.y,
                z: 0
            }
        };
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

        // Pitch: W = nose up, S = nose down
        if (this.input.pitchUp)   this.rotation.x += this.rates.pitch * dt;
        if (this.input.pitchDown) this.rotation.x -= this.rates.pitch * dt;
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

        // Ground collision. Meeting the terrain gently is a landing and the
        // aircraft flies on; arriving faster than the impact threshold is a
        // crash, which locks the controls and resets the flight
        const impactRate = dt > 0 ? (this.position.y - startY) / dt : 0;
        const minY = terrainHeight + this.clearance;
        if (this.position.y < minY) {
            this.position.y = minY;
            if (isCrashImpact(impactRate, this.impactSpeed) && beginCrash(this.crash)) {
                this.speed = 0;
                this.throttle = 0;
                this.verticalSpeed = 0;
                this.group.position.copy(this.position);
                this.group.rotation.copy(this.rotation);
                return;
            }
        }

        // The vertical speed indicator reads the altitude actually gained or
        // lost this frame, so riding up a hillside shows as the climb it is.
        // A frozen clock leaves the last reading on the dial.
        if (dt > 0) this.verticalSpeed = (this.position.y - startY) / dt;

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
