import * as THREE from 'three';
import {
    CHASE_POSITION_LAMBDA, CHASE_TARGET_LAMBDA, ORBIT_RATE,
    CAMERA_MODES, modeIndexOf, damp, shouldSnap, orbitStep
} from './camera-math.js';

export { CAMERA_MODES, modeIndexOf, ORBIT_RATE, ORBIT_RATES } from './camera-math.js';

export class CameraController {
    constructor(camera, aircraft, mode = CAMERA_MODES[0]) {
        this.camera     = camera;
        this.aircraft   = aircraft;
        this.distance   = 30;
        this.height     = 10;
        this.modeIndex  = modeIndexOf(mode);
        this.orbitAngle = 0;
        this.orbitRate  = ORBIT_RATE;

        // Where the chase camera has eased to, and the point it is easing to
        // look at. Null until the first chase frame places them.
        this.chasePosition = null;
        this.chaseTarget   = null;

        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyC') this.cycleMode();
        });
    }

    cycleMode() {
        this.modeIndex = (this.modeIndex + 1) % CAMERA_MODES.length;
    }

    /**
     * Puts the view in a named mode, for a flight starting or restarting in the
     * camera it was configured to open in. A name nothing answers to reads as
     * the first mode, the same way the constructor takes one.
     *
     * Returns the mode now in force.
     */
    setMode(mode) {
        this.modeIndex = modeIndexOf(mode);
        return this.getCurrentMode();
    }

    /**
     * How fast the orbit view sweeps, in degrees a second, for the settings
     * panel to hold. A rate that is not a number leaves the one in force, so a
     * setting from a version that offered different ones does not stop the
     * camera turning.
     *
     * Returns the rate now in force.
     */
    setOrbitRate(degreesPerSecond) {
        if (Number.isFinite(degreesPerSecond)) this.orbitRate = degreesPerSecond;
        return this.orbitRate;
    }

    update(dt = 0) {
        const pos  = this.aircraft.getPosition();
        const quat = this.aircraft.getQuaternion();

        switch (this.getCurrentMode()) {
            case 'COCKPIT': {
                // Just above the fuselage, looking out over the nose
                const eye    = new THREE.Vector3(0, 1.8, 1.5).applyQuaternion(quat).add(pos);
                const target = new THREE.Vector3(0, 1.8, 100).applyQuaternion(quat).add(pos);
                this.camera.up.set(0, 1, 0).applyQuaternion(quat);
                this.camera.position.copy(eye);
                this.camera.lookAt(target);
                break;
            }
            case 'ORBIT': {
                // Slow circle around the aircraft in world space, at whatever
                // rate the pilot has the sweep set to.
                this.orbitAngle += orbitStep(this.orbitRate, dt);
                const offset = new THREE.Vector3(
                    Math.sin(this.orbitAngle) * this.distance * 2,
                    this.height * 1.5,
                    Math.cos(this.orbitAngle) * this.distance * 2
                );
                this.camera.up.set(0, 1, 0);
                this.camera.position.copy(pos).add(offset);
                this.camera.lookAt(pos);
                break;
            }
            default: {
                // CHASE: an offset behind and above the aircraft in its local
                // space, which the camera trails rather than sits on, so
                // turns and pitch changes swing the view instead of snapping it
                const offset = new THREE.Vector3(0, this.height, -this.distance);
                offset.applyQuaternion(quat);
                const desired = pos.clone().add(offset);

                this.camera.up.set(0, 1, 0);
                if (!this.chasePosition || shouldSnap(this.chasePosition.distanceTo(desired))) {
                    // First frame, a reset, or a return from another mode:
                    // cut to the offset rather than fly across the world to it
                    this.chasePosition = desired;
                    this.chaseTarget   = pos.clone();
                } else {
                    dampVector(this.chasePosition, desired, CHASE_POSITION_LAMBDA, dt);
                    dampVector(this.chaseTarget, pos, CHASE_TARGET_LAMBDA, dt);
                }

                this.camera.position.copy(this.chasePosition);
                this.camera.lookAt(this.chaseTarget);
            }
        }
    }

    getCurrentMode() { return CAMERA_MODES[this.modeIndex]; }
}

// Eases a vector toward another in place, one axis at a time.
function dampVector(current, target, lambda, dt) {
    current.set(
        damp(current.x, target.x, lambda, dt),
        damp(current.y, target.y, lambda, dt),
        damp(current.z, target.z, lambda, dt)
    );
}
