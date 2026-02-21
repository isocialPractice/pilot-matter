import * as THREE from 'three';

export class Sky {
    constructor(scene) {
        this.scene = scene;
        this.setup();
    }

    setup() {
        const skyColor = 0x87ceeb;

        this.scene.background = new THREE.Color(skyColor);

        // Exponential fog hides terrain edges — the "smoke and mirrors"
        this.scene.fog = new THREE.FogExp2(skyColor, 0.00035);

        // Sun directional light
        this.sunLight = new THREE.DirectionalLight(0xfff4e0, 1.3);
        this.sunLight.position.set(600, 900, 400);
        this.scene.add(this.sunLight);

        // Soft sky fill light
        this.scene.add(new THREE.AmbientLight(0x8aaccf, 0.7));
    }

    update() {}

    getSunPosition() { return this.sunLight.position.clone(); }
}
