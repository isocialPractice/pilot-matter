import * as THREE from 'three';

export class CameraController {
    constructor(camera, aircraft) {
        this.camera   = camera;
        this.aircraft = aircraft;
        this.distance = 30;
        this.height   = 10;
    }

    update() {
        const pos  = this.aircraft.getPosition();
        const quat = this.aircraft.getQuaternion();

        // Fixed offset behind and above the aircraft in its local space
        const offset = new THREE.Vector3(0, this.height, -this.distance);
        offset.applyQuaternion(quat);

        this.camera.position.copy(pos).add(offset);
        this.camera.lookAt(pos);
    }

    getCurrentMode() { return 'CHASE'; }
}
