/**
 * Pilot API - the flight model and its controls, without the world.
 *
 * A host supplies its own scene, and can supply its own aircraft asset and its
 * own terrain. What it gets back is an aircraft that flies the way the bundled
 * simulator's does, a telemetry reading it can render however it likes, and the
 * keybinding map it can remap or ignore entirely in favour of writing the input
 * state itself.
 */

import * as THREE from 'three';
import { Aircraft } from '../aircraft.js';
import { CameraController } from '../camera.js';
import { headingDegrees } from '../units.js';
import { resolvePilotOptions, createTelemetry } from './contract.js';

/**
 * Creates a pilot in a caller-supplied scene.
 *
 * @param {object} options
 * @param {object} options.scene      the scene to add the aircraft to
 * @param {object} [options.aircraft] an external model, flown from its anchor
 * @param {object} [options.anchor]   the point in that model the flight model moves
 * @param {object} [options.terrain]  `{ sampleHeight(x, z), bounds }` to fly over
 * @param {object} [options.camera]   a camera to place behind the aircraft
 * @param {object} [options.keymap]   bindings to use instead of the bundled ones
 * @param {boolean} [options.controls] false to take the keyboard off entirely
 * @param {object} [options.flight]   overrides for the start state and the model
 */
export function createPilot(options = {}) {
    const resolved = resolvePilotOptions(options);
    const scene    = resolved.scene ?? new THREE.Scene();

    let terrain = resolved.terrain;

    const aircraft = new Aircraft(scene, {
        model: asObject3D(resolved.aircraft),
        anchor: resolved.anchor,
        keymap: resolved.keymap,
        controls: resolved.controls,
        flight: resolved.flight
    });

    const camera = options.camera
        ? new CameraController(options.camera, aircraft, resolved.cameraMode)
        : null;

    return {
        aircraft,
        camera,
        scene,
        object3D: aircraft.group,
        input: aircraft.input,
        keymap: resolved.keymap,

        /** The square the pilot is being flown over, as the terrain declares it. */
        get bounds() { return terrain.bounds; },

        /**
         * Flies a different world without rebuilding the aircraft: anything
         * answering the terrain contract will do, the Matter API's environments
         * included.
         */
        setTerrain(next) {
            terrain = resolvePilotOptions({ terrain: next }).terrain;
            return terrain;
        },

        /**
         * Advances the flight by one frame. The ground under the aircraft is
         * read from the terrain each frame rather than cached, so a host that
         * regenerates its world underneath the aircraft is flown over the new
         * one from the next frame on.
         */
        update(dt) {
            const position = aircraft.getPosition();
            aircraft.update(dt, terrain.sampleHeight(position.x, position.z));
            camera?.update(dt);
            return this.telemetry();
        },

        /** Everything an external HUD needs, and nothing of what is behind it. */
        telemetry() {
            return createTelemetry({
                airspeed: aircraft.getSpeed(),
                altitude: aircraft.getAltitude(),
                verticalSpeed: aircraft.getVerticalSpeed(),
                heading: headingDegrees(aircraft.getHeading()),
                throttle: aircraft.getThrottle(),
                heightAboveTerrain: aircraft.getHeightAboveTerrain(),
                crashed: aircraft.isCrashed(),
                stalled: aircraft.isStalling()
            });
        },

        /** Where the aircraft is and which way it points, for an external camera. */
        pose() {
            return {
                position: aircraft.getPosition(),
                rotation: aircraft.getRotation(),
                quaternion: aircraft.getQuaternion(),
                attitude: aircraft.getAttitude()
            };
        },

        reset() { aircraft.reset(); },

        /** Takes the aircraft back out of the host's scene, keyboard and all. */
        dispose() {
            aircraft.releaseControls();
            scene.remove(aircraft.group);
        }
    };
}

/**
 * The Object3D inside whatever a host handed over: a mesh or a group as it is,
 * and the `scene` out of a loader result, which is what every Three.js loader
 * calls the thing it parsed.
 */
function asObject3D(asset) {
    if (!asset) return null;
    if (asset.isObject3D) return asset;
    if (asset.scene?.isObject3D) return asset.scene;
    return null;
}
