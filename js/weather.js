/**
 * Weather - the effects layer the render_weather directives drive.
 *
 * Drawn from the assets copied out of the weather server:
 *   - assets/weather/cloud.svg  when precipitation is cloudy or stormy
 *   - assets/weather/rain.svg   when it is stormy and the tone is not cold
 *   - assets/weather/moon.svg   at night (sun.svg by day)
 *
 * Rain and the celestial body ride with the camera, so the storm follows the
 * aircraft instead of being a patch of sky it can fly out of.
 */

import * as THREE from 'three';
import { STYLE } from './weather-style.js';

const CLOUD_ASSET = 'assets/weather/cloud.svg';
const RAIN_ASSET  = 'assets/weather/rain.svg';

const CLOUD_ASPECT = 281.76 / 178.25;   // from the source svg viewBox
const RAIN_ASPECT  = 74.3 / 190.72;

// Rain fills a box around the camera. Drops recycle to the top as they fall.
// RAIN_CLEARANCE keeps them off the lens: a drop seeded a unit from the camera
// fills half the screen and reads as a blob rather than rain.
const RAIN_BOX       = { width: 260, height: 200, depth: 260 };
const RAIN_CLEARANCE = 18;
const RAIN_SPEED     = 190;   // units per second, straight down
const RAIN_SHEAR     = 55;    // horizontal drift, so the storm reads as windy
const DROP_HEIGHT    = 0.6;

// The deck has to sit inside fog range or it fades out before it is ever seen,
// so it is a tight ceiling that wraps around the aircraft rather than a wide
// sparse field.
const CLOUD_SPREAD  = 3000;
const CLOUD_CEILING = { base: 680, spread: 460 };
const CLOUD_WIDTH   = { base: 380, spread: 520 };
const CLOUD_DRIFT   = 26;   // units per second

// A frame delta this long means the tab was hidden or the machine stalled.
// Clamping keeps a single frame from teleporting the whole weather layer.
const MAX_STEP = 0.05;

/** Fold `value` back into [-half, half], however far outside it has drifted. */
function wrap(value, half) {
    const span = half * 2;
    return value - Math.round(value / span) * span;
}

// Lightning timing, in seconds.
const STRIKE_GAP   = { min: 3.5, max: 11 };
const STRIKE_LENGTH = 0.42;

/** A soft radial blob, used when an svg asset cannot be loaded. */
function fallbackTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(canvas);
}

/** Load an svg as a texture, falling back to a blob if the file is missing. */
function loadTexture(url, material) {
    return new THREE.TextureLoader().load(
        url,
        undefined,
        undefined,
        () => {
            console.warn(`Weather: could not load ${url}, using a fallback blob.`);
            material.map = fallbackTexture();
            material.needsUpdate = true;
        }
    );
}

export class Weather {
    constructor(scene, sky) {
        this.scene = scene;
        this.sky   = sky;

        this.tint = new THREE.Color(...STYLE.tone.tint);
        this.wind = new THREE.Vector3(1, 0, 0.35).normalize();

        this.nextStrike = this.strikeGap();
        this.strikeTime = 0;

        this.addCelestial();
        this.addClouds();
        this.addRain();
    }

    strikeGap() {
        const { min, max } = STRIKE_GAP;
        return min + Math.random() * (max - min);
    }

    // --- Sun or moon -------------------------------------------------------

    addCelestial() {
        const { asset, color, size } = STYLE.celestial;

        // Fog is off so the sky body stays legible through a storm, and it
        // writes no depth so nothing sorts against a body that is meant to be
        // effectively at infinity. Terrain still occludes it normally.
        const material = new THREE.SpriteMaterial({
            color:       new THREE.Color(color).multiply(this.tint),
            fog:         false,
            transparent: true,
            depthWrite:  false,
        });
        material.map = loadTexture(asset, material);

        this.celestial = new THREE.Sprite(material);
        this.celestial.scale.set(size, size, 1);
        this.celestial.renderOrder = -10;
        this.scene.add(this.celestial);

        // Sit in the same direction as the key light so the lighting agrees
        // with where the moon appears to be.
        this.celestialDir = this.sky.getSunPosition().normalize();
        this.celestialDistance = 9000;
    }

    // --- Cloud deck --------------------------------------------------------

    addClouds() {
        const count = STYLE.precip.clouds;
        this.clouds = [];
        if (count === 0) return;

        const material = new THREE.SpriteMaterial({
            color:       new THREE.Color(STYLE.night ? 0x4a4150 : 0xdfe4ea).multiply(this.tint),
            transparent: true,
            opacity:     STYLE.precip.cloudOpacity,
            depthWrite:  false,
        });
        material.map = loadTexture(CLOUD_ASSET, material);

        this.cloudGroup = new THREE.Group();

        for (let i = 0; i < count; i++) {
            const sprite = new THREE.Sprite(material);
            const width  = CLOUD_WIDTH.base + Math.random() * CLOUD_WIDTH.spread;
            // Every sprite shares one material, so mirroring on x is the
            // cheapest way to stop the deck reading as one repeated shape.
            const facing = Math.random() < 0.5 ? -1 : 1;
            sprite.scale.set(width * facing, width / CLOUD_ASPECT, 1);
            sprite.position.set(
                (Math.random() * 2 - 1) * CLOUD_SPREAD,
                CLOUD_CEILING.base + Math.random() * CLOUD_CEILING.spread,
                (Math.random() * 2 - 1) * CLOUD_SPREAD
            );
            this.cloudGroup.add(sprite);
            this.clouds.push(sprite);
        }

        this.scene.add(this.cloudGroup);
    }

    // --- Rain --------------------------------------------------------------

    addRain() {
        const count = STYLE.precip.rainDrops;
        this.rain = null;
        if (count === 0) return;

        const material = new THREE.MeshBasicMaterial({
            color:       new THREE.Color(0xbcd6e2).multiply(this.tint),
            transparent: true,
            opacity:     0.55,
            depthWrite:  false,
            side:        THREE.DoubleSide,
            fog:         true,
        });
        material.map = loadTexture(RAIN_ASSET, material);

        const geometry = new THREE.PlaneGeometry(DROP_HEIGHT * RAIN_ASPECT, DROP_HEIGHT);

        this.rain = new THREE.InstancedMesh(geometry, material, count);
        this.rain.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.rain.frustumCulled = false;

        // Drops live in the group's local space. The group sits on the camera
        // and turns with it, so every drop faces the viewer without a
        // per-instance billboard update.
        this.rainGroup = new THREE.Group();
        this.rainGroup.add(this.rain);
        this.scene.add(this.rainGroup);

        this.drops  = new Float32Array(count * 3);
        this.dummy  = new THREE.Object3D();
        for (let i = 0; i < count; i++) {
            this.seedDrop(i, Math.random() * RAIN_BOX.height);
        }
        this.writeDrops();
    }

    seedDrop(i, height) {
        let x, z;
        do {
            x = (Math.random() - 0.5) * RAIN_BOX.width;
            z = (Math.random() - 0.5) * RAIN_BOX.depth;
        } while (Math.abs(x) < RAIN_CLEARANCE && Math.abs(z) < RAIN_CLEARANCE);

        this.drops[i * 3]     = x;
        this.drops[i * 3 + 1] = height - RAIN_BOX.height / 2;
        this.drops[i * 3 + 2] = z;
    }

    writeDrops() {
        for (let i = 0; i < this.rain.count; i++) {
            this.dummy.position.set(
                this.drops[i * 3],
                this.drops[i * 3 + 1],
                this.drops[i * 3 + 2]
            );
            this.dummy.updateMatrix();
            this.rain.setMatrixAt(i, this.dummy.matrix);
        }
        this.rain.instanceMatrix.needsUpdate = true;
    }

    // --- Frame -------------------------------------------------------------

    update(dt, cameraPosition, cameraYaw) {
        dt = Math.min(dt, MAX_STEP);

        this.updateCelestial(cameraPosition);
        this.updateClouds(dt, cameraPosition);
        this.updateRain(dt, cameraPosition, cameraYaw);
        this.updateLightning(dt);
    }

    updateCelestial(cameraPosition) {
        this.celestial.position
            .copy(this.celestialDir)
            .multiplyScalar(this.celestialDistance)
            .add(cameraPosition);
    }

    updateClouds(dt, cameraPosition) {
        if (!this.clouds.length) return;

        const drift = CLOUD_DRIFT * dt;

        for (const cloud of this.clouds) {
            cloud.position.x += this.wind.x * drift;
            cloud.position.z += this.wind.z * drift;

            // Wrap the deck around the aircraft so it never runs out of sky,
            // however far the aircraft has travelled since the last frame.
            cloud.position.x = cameraPosition.x
                + wrap(cloud.position.x - cameraPosition.x, CLOUD_SPREAD);
            cloud.position.z = cameraPosition.z
                + wrap(cloud.position.z - cameraPosition.z, CLOUD_SPREAD);
        }
    }

    updateRain(dt, cameraPosition, cameraYaw) {
        if (!this.rain) return;

        this.rainGroup.position.copy(cameraPosition);
        this.rainGroup.rotation.y = cameraYaw;

        const fall  = RAIN_SPEED * dt;
        const shear = RAIN_SHEAR * dt;
        const floor = -RAIN_BOX.height / 2;

        for (let i = 0; i < this.rain.count; i++) {
            const x = i * 3;
            const y = x + 1;

            this.drops[y] -= fall;
            if (this.drops[y] < floor) {
                this.seedDrop(i, RAIN_BOX.height);
                continue;
            }

            this.drops[x] = wrap(this.drops[x] + shear, RAIN_BOX.width / 2);

            // Shear walks drops sideways across the whole box, so one seeded
            // clear of the lens will still drift into it. Re-seed at the same
            // height rather than let it swell across the screen.
            if (Math.abs(this.drops[x]) < RAIN_CLEARANCE
                && Math.abs(this.drops[x + 2]) < RAIN_CLEARANCE) {
                this.seedDrop(i, this.drops[y] + RAIN_BOX.height / 2);
            }
        }

        this.writeDrops();
    }

    updateLightning(dt) {
        if (!STYLE.precip.lightning) return;

        if (this.strikeTime > 0) {
            this.strikeTime -= dt;
            if (this.strikeTime <= 0) {
                this.strikeTime = 0;
                this.sky.setFlash(0);
            } else {
                // Decaying envelope with a flicker on top, so a strike reads
                // as two or three stutters rather than one clean fade.
                const t       = this.strikeTime / STRIKE_LENGTH;
                const flicker = 0.55 + 0.45 * Math.abs(Math.sin(t * Math.PI * 5));
                this.sky.setFlash(t * flicker);
            }
            return;
        }

        this.nextStrike -= dt;
        if (this.nextStrike <= 0) {
            this.nextStrike = this.strikeGap();
            this.strikeTime = STRIKE_LENGTH;
        }
    }
}
