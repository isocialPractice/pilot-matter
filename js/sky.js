import * as THREE from 'three';

// The colour the world fades to, and how quickly it gets there. Exported so
// the Matter API can apply the same depth to a scene that is not importing the
// terrain with it.
export const SKY_COLOR   = 0x87ceeb;
export const FOG_DENSITY = 0.00035;

/**
 * Applies the world's depth to any scene: the sky it fades to, and the fog
 * that fades it. Standalone, so a host can take the look without the ground.
 */
export function applyDepth(scene, { color = SKY_COLOR, density = FOG_DENSITY } = {}) {
    scene.background = new THREE.Color(color);
    scene.fog = new THREE.FogExp2(color, density);
    return scene;
}

export class Sky {
    constructor(scene) {
        this.scene   = scene;
        this.density = FOG_DENSITY;
        this.setup();
    }

    setup() {
        const skyColor = SKY_COLOR;

        // Exponential fog hides terrain edges - the "smoke and mirrors"
        applyDepth(this.scene, { color: skyColor, density: this.density });

        // Sun directional light
        this.sunLight = new THREE.DirectionalLight(0xfff4e0, 1.3);
        this.sunLight.position.set(600, 900, 400);
        this.scene.add(this.sunLight);

        // Soft sky fill light
        this.scene.add(new THREE.AmbientLight(0x8aaccf, 0.7));
    }

    update() {}

    /**
     * Thickens or thins the haze, as a multiple of the density the world is
     * drawn at by default. The fog object already in the scene is retuned
     * rather than replaced, so nothing that was handed the old one is left
     * holding a fog the world has stopped using.
     *
     * Returns the density now in force.
     */
    setFogDensity(scale = 1) {
        this.density = FOG_DENSITY * Math.max(Number(scale) || 0, 0);
        if (this.scene.fog) this.scene.fog.density = this.density;
        return this.density;
    }

    getSunPosition() { return this.sunLight.position.clone(); }
}
