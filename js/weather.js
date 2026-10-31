/**
 * Weather - the effects layer over the world: a cloud deck, rain that follows
 * the aircraft, lightning over the sky, and the body the light of the day is
 * coming from.
 *
 * Lifted from the `local-weather` branch rather than merged from it. The
 * branch is one commit off the initial commit and has never seen this
 * repository since, so there is nothing to merge; what it had worth having is
 * this layer, and the arithmetic behind it is in `js/weather-math.js`.
 *
 * Three things are this world's rather than the branch's, and each of them is
 * the branch asking a question this repository answers better:
 *
 *   - **The hour.** The branch had a `day` or `night` switch and hung a fixed
 *     light position and a pair of sprite assets off it. Here the hour is a
 *     phase of a continuous cycle, so the sky's body is placed on the arc the
 *     key light walks and coloured by the light at that moment - one body that
 *     reads as the sun or the moon without anything choosing which.
 *   - **The condition.** The branch resolved a hand-edited module constant
 *     once at import, which is a build-time setting rather than something a
 *     pilot can reach. Here it is an option in the settings panel.
 *   - **The palette.** The branch tinted every colour in the scene by a tone
 *     knob. Nothing of that travels: this world's colour is the hour's.
 *
 * The textures are drawn on a canvas rather than loaded, so the layer brings
 * no assets with it and nothing to fail to load - which is the same reason the
 * ground, the hoops and the walls are all generated here rather than placed.
 */

import * as THREE from 'three';
import {
    PRECIPITATION_MOST, DEFAULT_PRECIPITATION, precipitationAt,
    RAIN_BOX, DROP_HEIGHT, RAIN_ASPECT, createDrops, advanceDrops,
    createCloudDeck, driftClouds,
    createStrikes, advanceStrikes,
    celestialAt, litShade
} from './weather-math.js';

/**
 * The colours the layer draws in, as the light of noon would show them. Every
 * one of them is walked to the hour by `litShade`, so these are the top of a
 * range rather than a setting.
 */
export const DECK_COLOR = Object.freeze([0.874, 0.894, 0.918]);
export const RAIN_COLOR = Object.freeze([0.737, 0.839, 0.886]);
export const RAIN_OPACITY = 0.55;

export class Weather {
    /**
     * @param {object} scene the scene to draw the weather in
     * @param {object} sky   the `Sky` the strikes are flashed over, which is
     *                       also where the hour comes from
     * @param {string} [options.precipitation] the condition to open in
     */
    constructor(scene, sky, { precipitation = DEFAULT_PRECIPITATION } = {}) {
        this.scene = scene;
        this.sky   = sky;

        // Built to the worst weather and drawn down to the weather in force,
        // so changing the condition mid-flight costs a count rather than a
        // rebuild. `PRECIPITATION_MOST` is where that figure comes from.
        this.deck    = createCloudDeck(PRECIPITATION_MOST.clouds);
        this.drops   = createDrops(PRECIPITATION_MOST.rainDrops);
        this.strikes = createStrikes();

        this.yaw   = new THREE.Euler();
        this.dummy = new THREE.Object3D();

        this.addCelestial();
        this.addClouds();
        this.addRain();

        this.setPrecipitation(precipitation);
    }

    // --- The sun or the moon ----------------------------------------------

    addCelestial() {
        // Fog is off so the body stays legible through a storm, and it writes
        // no depth so nothing sorts against something meant to be effectively
        // at infinity. The ground still hides it normally.
        const material = new THREE.SpriteMaterial({
            map:         discTexture(),
            fog:         false,
            transparent: true,
            depthWrite:  false
        });

        this.celestial = new THREE.Sprite(material);
        this.celestial.renderOrder = -10;
        this.scene.add(this.celestial);
    }

    // --- The cloud deck ---------------------------------------------------

    addClouds() {
        this.cloudMaterial = new THREE.SpriteMaterial({
            map:         cloudTexture(),
            transparent: true,
            depthWrite:  false
        });

        this.cloudGroup = new THREE.Group();
        this.clouds = this.deck.map(cloud => {
            const sprite = new THREE.Sprite(this.cloudMaterial);
            sprite.scale.set(cloud.width * cloud.facing, cloud.height, 1);
            sprite.position.set(cloud.x, cloud.y, cloud.z);
            this.cloudGroup.add(sprite);
            return sprite;
        });

        this.scene.add(this.cloudGroup);
    }

    // --- The rain ---------------------------------------------------------

    addRain() {
        const count = PRECIPITATION_MOST.rainDrops;
        if (count === 0) {
            this.rain = null;
            return;
        }

        this.rainMaterial = new THREE.MeshBasicMaterial({
            map:         streakTexture(),
            transparent: true,
            opacity:     RAIN_OPACITY,
            depthWrite:  false,
            side:        THREE.DoubleSide,
            fog:         true
        });

        const geometry = new THREE.PlaneGeometry(DROP_HEIGHT * RAIN_ASPECT, DROP_HEIGHT);

        this.rain = new THREE.InstancedMesh(geometry, this.rainMaterial, count);
        this.rain.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.rain.frustumCulled = false;

        // Drops live in the group's local space. The group sits on the camera
        // and turns with it, so every drop faces the viewer without a
        // per-instance billboard update.
        this.rainGroup = new THREE.Group();
        this.rainGroup.add(this.rain);
        this.scene.add(this.rainGroup);

        this.writeDrops();
    }

    writeDrops() {
        for (let i = 0; i < this.rain.count; i++) {
            const at = i * 3;
            this.dummy.position.set(this.drops[at], this.drops[at + 1], this.drops[at + 2]);
            this.dummy.updateMatrix();
            this.rain.setMatrixAt(i, this.dummy.matrix);
        }
        this.rain.instanceMatrix.needsUpdate = true;
    }

    // --- The condition ----------------------------------------------------

    /**
     * Puts a condition in force: how much of the deck is drawn, how dense it
     * reads, how much of the rain falls, and whether there is any lightning.
     *
     * Nothing is built or thrown away here. The surplus sprites are hidden and
     * the instanced rain is drawn to a lower count, which is what makes this
     * safe to call from the settings panel mid-flight.
     *
     * Returns the condition now in force.
     */
    setPrecipitation(id = DEFAULT_PRECIPITATION) {
        const precip = precipitationAt(id);
        this.precipitation = precip;

        this.cloudMaterial.opacity = precip.cloudOpacity;
        this.clouds.forEach((sprite, i) => { sprite.visible = i < precip.clouds; });

        if (this.rain) {
            this.rain.count = Math.min(precip.rainDrops, this.drops.length / 3);
            this.rainGroup.visible = precip.rainDrops > 0;
        }

        // A storm that has been turned off leaves no flash behind it: the sky
        // is only ever handed a level while there is lightning to hand it, so
        // the last one written would otherwise hold until the next storm.
        if (!precip.lightning) {
            this.strikes = createStrikes();
            this.sky.setFlash(0);
        }

        return precip;
    }

    // --- The frame --------------------------------------------------------

    /**
     * Moves the weather on by a frame of the flight and draws it where the
     * camera now is.
     *
     * Time the flight did not spend flying is time the weather does not spend
     * moving, exactly as the day does not pass while a flight is paused - but
     * the layer is still placed, because the camera may have been moved by
     * something that is not the flight.
     */
    update(dt = 0, camera = null, phase = this.sky.getPhase()) {
        const at = camera?.position ?? ZERO;

        this.updateCelestial(phase, at);
        this.updateClouds(dt, phase, at);
        this.updateRain(dt, phase, camera, at);
        this.updateLightning(dt);
    }

    updateCelestial(phase, at) {
        const body = celestialAt(phase);

        this.celestial.position.set(body.at.x + at.x, body.at.y + at.y, body.at.z + at.z);
        this.celestial.scale.set(body.size, body.size, 1);
        this.celestial.material.color.setRGB(...body.color);
    }

    updateClouds(dt, phase, at) {
        if (this.precipitation.clouds === 0) return;

        this.cloudMaterial.color.setRGB(...litShade(DECK_COLOR, phase));

        driftClouds(this.deck, dt, at);
        for (let i = 0; i < this.precipitation.clouds; i++) {
            this.clouds[i].position.set(this.deck[i].x, this.deck[i].y, this.deck[i].z);
        }
    }

    updateRain(dt, phase, camera, at) {
        if (!this.rain || this.rain.count === 0) return;

        this.rainGroup.position.set(at.x, at.y, at.z);

        // Only the yaw, read off the camera rather than taken from its euler:
        // the rain has to face the viewer without leaning with the chase
        // view's pitch, and a camera's own `rotation.y` is not the yaw once
        // there is any pitch in it.
        if (camera) {
            this.yaw.setFromQuaternion(camera.quaternion, 'YXZ');
            this.rainGroup.rotation.y = this.yaw.y;
        }

        this.rainMaterial.color.setRGB(...litShade(RAIN_COLOR, phase));

        advanceDrops(this.drops, dt);
        this.writeDrops();
    }

    updateLightning(dt) {
        if (!this.precipitation.lightning) return;
        this.sky.setFlash(advanceStrikes(this.strikes, dt));
    }
}

const ZERO = Object.freeze({ x: 0, y: 0, z: 0 });

// --- The textures, drawn rather than loaded -------------------------------

/** A canvas of a size, and the context to draw the texture on it with. */
function surface(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width  = width;
    canvas.height = height;
    return { canvas, ctx: canvas.getContext('2d') };
}

function textureOf(canvas) {
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

/** One soft white blob, which is what all three textures are built out of. */
function blob(ctx, x, y, radius, alpha = 1) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0,    `rgba(255, 255, 255, ${alpha})`);
    gradient.addColorStop(0.55, `rgba(255, 255, 255, ${alpha * 0.82})`);
    gradient.addColorStop(1,     'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
}

/**
 * The sky's body: a disc with a soft edge, rather than a blur. The core is
 * held opaque most of the way out so the body reads as a thing with an edge
 * and the falloff reads as the glow around it.
 */
function discTexture() {
    const { canvas, ctx } = surface(128, 128);
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);

    gradient.addColorStop(0,    'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.62, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.74, 'rgba(255, 255, 255, 0.55)');
    gradient.addColorStop(1,    'rgba(255, 255, 255, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    return textureOf(canvas);
}

/**
 * A cloud: a lumpy mound built of overlapping blobs, flat along the bottom and
 * taller on one side, so a deck of them mirrored half the time reads as
 * weather rather than as a row of circles.
 */
function cloudTexture() {
    const { canvas, ctx } = surface(256, 162);

    for (const [x, y, radius, alpha] of [
        [ 92, 112, 58, 0.9 ],
        [ 164, 108, 52, 0.9 ],
        [ 126,  74, 50, 0.85],
        [ 196,  86, 40, 0.8 ],
        [  54,  98, 40, 0.75]
    ]) blob(ctx, x, y, radius, alpha);

    return textureOf(canvas);
}

/** A raindrop: a streak, brightest along its length and faded at both ends. */
function streakTexture() {
    const { canvas, ctx } = surface(32, 128);
    const gradient = ctx.createLinearGradient(0, 0, 0, 128);

    gradient.addColorStop(0,    'rgba(255, 255, 255, 0)');
    gradient.addColorStop(0.35, 'rgba(255, 255, 255, 0.9)');
    gradient.addColorStop(0.85, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(1,    'rgba(255, 255, 255, 0)');

    ctx.fillStyle = gradient;
    // Narrower than the canvas so the streak has a soft side as well as a soft
    // end: a drop drawn to the edge reads as a ribbon.
    ctx.fillRect(10, 0, 12, 128);
    return textureOf(canvas);
}
