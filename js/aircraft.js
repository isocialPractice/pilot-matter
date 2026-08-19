import * as THREE from 'three';
import { createInputState, applyKeyToInput } from './input-map.js';
import { createFlightState } from './flight-state.js';
import {
    MIN_SPEED, CRUISE_SPEED, MAX_SPEED, GRAVITY,
    updateThrottle, targetSpeed, convergeSpeed, sinkRate
} from './flight-model.js';

export class Aircraft {
    constructor(scene) {
        this.scene = scene;

        const start = createFlightState();
        this.position = new THREE.Vector3(start.position.x, start.position.y, start.position.z);
        this.rotation = new THREE.Euler(start.rotation.x, start.rotation.y, start.rotation.z, 'YXZ');
        this.speed = start.speed;
        this.throttle = start.throttle;

        this.minSpeed = MIN_SPEED;
        this.cruiseSpeed = CRUISE_SPEED;
        this.maxSpeed = MAX_SPEED;
        this.gravity = GRAVITY;

        this.input = createInputState();

        this.createModel();
        this.setupControls();
    }

    createModel() {
        this.group = new THREE.Group();

        const mat = new THREE.MeshPhongMaterial({ color: 0x4477aa });
        const wingMat = new THREE.MeshPhongMaterial({ color: 0x3366aa });

        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.5, 8, 8), mat);
        body.rotation.x = Math.PI / 2;
        this.group.add(body);

        const wings = new THREE.Mesh(new THREE.BoxGeometry(14, 0.15, 2), wingMat);
        this.group.add(wings);

        const tail = new THREE.Mesh(new THREE.BoxGeometry(5, 0.1, 1), wingMat);
        tail.position.set(0, 0, -3.5);
        this.group.add(tail);

        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2, 1.5), wingMat);
        fin.position.set(0, 1, -3.5);
        this.group.add(fin);

        const nose = new THREE.Mesh(
            new THREE.ConeGeometry(0.5, 1.5, 8),
            new THREE.MeshPhongMaterial({ color: 0xdddddd })
        );
        nose.rotation.x = -Math.PI / 2;
        nose.position.set(0, 0, 4.5);
        this.group.add(nose);

        this.group.position.copy(this.position);
        this.scene.add(this.group);
    }

    setupControls() {
        window.addEventListener('keydown', (e) => this.onKey(e, true));
        window.addEventListener('keyup',  (e) => this.onKey(e, false));
    }

    onKey(e, down) {
        const changed = applyKeyToInput(this.input, e.code, down);
        if (down && (changed === 'throttleUp' || changed === 'throttleDown')) {
            e.preventDefault();
        }
        if (e.code === 'KeyR' && down) this.reset();
    }

    reset() {
        const start = createFlightState();
        this.position.set(start.position.x, start.position.y, start.position.z);
        this.rotation.set(start.rotation.x, start.rotation.y, start.rotation.z);
        this.speed = start.speed;
        this.throttle = start.throttle;
    }

    update(dt, terrainHeight = 0) {
        dt = Math.min(dt, 0.05);

        // Shift and Ctrl move the throttle lever, and speed chases the
        // setting rather than jumping with the key
        this.throttle = updateThrottle(this.throttle, this.input, dt);
        this.speed = convergeSpeed(this.speed, targetSpeed(this.throttle, this.maxSpeed), dt);

        // Pitch: W = nose up, S = nose down
        if (this.input.pitchUp)   this.rotation.x += 1.2 * dt;
        if (this.input.pitchDown) this.rotation.x -= 1.2 * dt;
        this.rotation.x = THREE.MathUtils.clamp(this.rotation.x, -Math.PI / 2.2, Math.PI / 2.2);

        // Roll
        if (this.input.rollLeft)  this.rotation.z += 2.0 * dt;
        if (this.input.rollRight) this.rotation.z -= 2.0 * dt;
        this.rotation.z = THREE.MathUtils.clamp(this.rotation.z, -Math.PI, Math.PI);

        // Roll auto-levels slowly when no input
        if (!this.input.rollLeft && !this.input.rollRight) {
            this.rotation.z *= (1 - dt * 1.5);
        }

        // Yaw: Q = nose left, E = nose right
        if (this.input.yawLeft)  this.rotation.y += 0.8 * dt;
        if (this.input.yawRight) this.rotation.y -= 0.8 * dt;

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

        // Ground collision
        const minY = terrainHeight + 5;
        if (this.position.y < minY) {
            this.position.y = minY;
        }

        this.group.position.copy(this.position);
        this.group.rotation.copy(this.rotation);
    }

    getPosition()  { return this.position.clone(); }
    getRotation()  { return this.rotation.clone(); }
    getQuaternion(){ return new THREE.Quaternion().setFromEuler(this.rotation); }
    getSpeed()     { return this.speed; }
    getAltitude()  { return this.position.y; }
    getThrottle()  { return this.throttle; }
}
