import * as THREE from 'three';
import {
    createDayNight, advanceDayNight, daylightAt, sunPositionAt, SUN_DISTANCE
} from './day-night.js';

// The colour the world fades to at midday, and how quickly it gets there.
// Exported so the Matter API can apply the same depth to a scene that is not
// importing the terrain with it. The colour is where the day starts from rather
// than where it stays: the cycle in `js/day-night.js` moves it from here.
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

/**
 * Puts a moment of the day into a scene and the lights over it: the sky and the
 * fog take the colour of the hour, the sun takes its colour, its strength, and
 * its place in the arc, and the fill takes the light coming back off everything
 * else.
 *
 * Everything is optional and nothing is replaced. The fog and the colours
 * already in the scene are retuned rather than swapped, so anything handed the
 * old ones is not left holding a sky the world has stopped using, and a scene
 * with no fog in it keeps having none.
 *
 * Returns the light now in force, which is what anything else keyed to the sun
 * reads.
 */
export function applyDaylight(phase, {
    scene = null, sun = null, ambient = null, density = FOG_DENSITY, distance = SUN_DISTANCE
} = {}) {
    const light = daylightAt(phase);
    const [r, g, b] = light.sky;

    if (scene) {
        if (scene.background?.isColor) scene.background.setRGB(r, g, b);
        else scene.background = new THREE.Color().setRGB(r, g, b);

        if (scene.fog) {
            scene.fog.color.setRGB(r, g, b);
            if (Number.isFinite(density)) scene.fog.density = density;
        }
    }

    if (sun) {
        sun.color.setRGB(...light.sun.color);
        sun.intensity = light.sun.intensity;
        const at = sunPositionAt(light.phase, distance);
        sun.position.set(at.x, at.y, at.z);
    }

    if (ambient) {
        ambient.color.setRGB(...light.ambient.color);
        ambient.intensity = light.ambient.intensity;
    }

    return light;
}

export class Sky {
    /**
     * @param {object} scene the scene to light
     * @param {object} [options.cycle] the day to run: its `length` and the
     *                 `phase` it opens on, or `{ length: 0 }` to hold the world
     *                 at whatever hour it was given
     */
    constructor(scene, options = {}) {
        this.scene   = scene;
        this.density = FOG_DENSITY;
        this.cycle   = createDayNight(options.cycle ?? {});
        this.running = options.cycle?.length !== 0;
        this.setup();
    }

    setup() {
        // Exponential fog hides terrain edges - the "smoke and mirrors"
        applyDepth(this.scene, { color: SKY_COLOR, density: this.density });

        // Sun directional light, walked across the sky by the cycle
        this.sunLight = new THREE.DirectionalLight(0xfff4e0, 1.3);
        this.scene.add(this.sunLight);

        // Soft sky fill light
        this.ambientLight = new THREE.AmbientLight(0x8aaccf, 0.7);
        this.scene.add(this.ambientLight);

        this.light = this.apply();
    }

    /**
     * Moves the day on by a frame of the flight. Time the flight did not spend
     * flying is time the day does not spend passing: a paused world is a world
     * with the sun where it was left.
     */
    update(dt = 0) {
        if (this.running) advanceDayNight(this.cycle, dt);
        this.light = this.apply();
        return this.light;
    }

    /** Puts the hour the cycle is at into the scene and the lights over it. */
    apply() {
        return applyDaylight(this.cycle.phase, {
            scene: this.scene,
            sun: this.sunLight,
            ambient: this.ambientLight,
            density: this.density
        });
    }

    /** The hour of the day the world is being flown in. */
    getPhase() { return this.cycle.phase; }

    /**
     * Sets the hour of the day directly, for a host that would rather say when
     * a flight is happening than wait for it to get there.
     */
    setPhase(phase) {
        this.cycle.phase = createDayNight({ length: this.cycle.length, phase }).phase;
        this.light = this.apply();
        return this.cycle.phase;
    }

    /** How much day there is, which is how much light there is to glint off water. */
    getDaylight() { return this.light?.daylight ?? 1; }

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
