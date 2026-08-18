import * as THREE from 'three';

export const CAMERA_MODES = ['CHASE', 'COCKPIT', 'ORBIT'];

export class CameraController {
    constructor(camera, aircraft) {
        this.camera     = camera;
        this.aircraft   = aircraft;
        this.distance   = 30;
        this.height     = 10;
        this.modeIndex  = 0;
        this.orbitAngle = 0;

        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyC') this.cycleMode();
        });
    }

    cycleMode() {
        this.modeIndex = (this.modeIndex + 1) % CAMERA_MODES.length;
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
                // Slow circle around the aircraft in world space
                this.orbitAngle += 0.4 * dt;
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
                // CHASE: fixed offset behind and above the aircraft in its local space
                const offset = new THREE.Vector3(0, this.height, -this.distance);
                offset.applyQuaternion(quat);
                this.camera.up.set(0, 1, 0);
                this.camera.position.copy(pos).add(offset);
                this.camera.lookAt(pos);
            }
        }
    }

    getCurrentMode() { return CAMERA_MODES[this.modeIndex]; }
}
