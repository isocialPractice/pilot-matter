import * as THREE from 'three';

export class Aircraft {
    constructor(scene) {
        this.scene = scene;
        this.position = new THREE.Vector3(0, 300, 0);
        this.rotation = new THREE.Euler(0, 0, 0, 'YXZ');
        this.speed = 0;
        this.minSpeed = 40;
        this.maxSpeed = 200;
        this.gravity = 12;

        this.input = {
            pitchUp: false, pitchDown: false,
            rollLeft: false, rollRight: false,
            throttleUp: false, throttleDown: false
        };

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
        switch (e.code) {
            case 'KeyW': case 'ArrowUp':    this.input.pitchUp = down; break;
            case 'KeyS': case 'ArrowDown':  this.input.pitchDown = down; break;
            case 'KeyA': case 'ArrowLeft':  this.input.rollLeft = down; break;
            case 'KeyD': case 'ArrowRight': this.input.rollRight = down; break;
            case 'ShiftLeft': case 'ShiftRight':
                this.input.throttleUp = down;
                if (down) e.preventDefault();
                break;
            case 'ControlLeft': case 'ControlRight':
                this.input.throttleDown = down;
                if (down) e.preventDefault();
                break;
            case 'KeyR': if (down) this.reset(); break;
        }
    }

    reset() {
        this.position.set(0, 300, 0);
        this.rotation.set(0, 0, 0);
        this.speed = 0;
    }

    update(dt, terrainHeight = 0) {
        dt = Math.min(dt, 0.05);

        // Throttle controls speed directly
        if (this.input.throttleUp)   this.speed = Math.min(this.maxSpeed, this.speed + 80 * dt);
        if (this.input.throttleDown) this.speed = Math.max(0, this.speed - 80 * dt);

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

        // Banking roll causes yaw (coordinated turn)
        this.rotation.y -= Math.sin(this.rotation.z) * 1.2 * dt;

        // Move forward in the direction the aircraft faces
        const quat = new THREE.Quaternion().setFromEuler(this.rotation);
        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(quat);
        this.position.addScaledVector(forward, this.speed * dt);

        // Gravity pulls down always
        this.position.y -= this.gravity * dt;

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
    getThrottle()  { return this.speed / this.maxSpeed; }
}
