import * as THREE from 'three';
import { STYLE } from './weather-style.js';

export class Sky {
    constructor(scene) {
        this.scene = scene;
        this.setup();
    }

    setup() {
        const {
            background, fogDensity,
            keyColor, keyPosition, keyIntensity,
            ambientColor, ambient,
        } = STYLE.sky;

        this.baseColor = new THREE.Color(background);
        this.scene.background = this.baseColor.clone();

        // Exponential fog hides terrain edges - the "smoke and mirrors".
        // Storms thicken it, which is what closes the world in.
        this.scene.fog = new THREE.FogExp2(this.baseColor.clone(), fogDensity);

        // Key light: the sun by day, the moon by night.
        this.sunLight = new THREE.DirectionalLight(keyColor, keyIntensity);
        this.sunLight.position.set(...keyPosition);
        this.scene.add(this.sunLight);

        // Soft fill from the sky itself.
        this.ambientLight = new THREE.AmbientLight(ambientColor, ambient);
        this.scene.add(this.ambientLight);

        this.baseKeyIntensity     = keyIntensity;
        this.baseAmbientIntensity = ambient;
        this.flash = 0;
    }

    /**
     * Lightning is driven from weather.js, which owns the storm timing. A
     * strike briefly washes out the sky colour and lifts both lights.
     * @param {number} strength 0 for calm, 1 at the peak of a strike
     */
    setFlash(strength) {
        this.flash = strength;

        const lift = strength * strength;
        this.sunLight.intensity     = this.baseKeyIntensity     + lift * 2.2;
        this.ambientLight.intensity = this.baseAmbientIntensity + lift * 1.1;

        const lit = this.baseColor.clone().lerp(new THREE.Color(0xd8ccff), lift * 0.75);
        this.scene.background.copy(lit);
        this.scene.fog.color.copy(lit);
    }

    update() {}

    getSunPosition() { return this.sunLight.position.clone(); }
}
