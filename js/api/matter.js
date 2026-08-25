/**
 * Matter API - the world, without the flight model.
 *
 * A host gets one detachable group holding the ground it asked for, a height
 * sampler for whatever is flying over it, and a contract any aircraft can
 * satisfy - including one driven by a control API that has never heard of this
 * one. Caller-supplied meshes can be registered as elements of the world and
 * placed by the generator, so an external asset sits on the ground rather than
 * hovering over it.
 */

import * as THREE from 'three';
import {
    createField, createRandom, applyBase, applyElement, orderPlacements, sampleHeight
} from '../environment/elements.js';
import { getEnvironment, environmentElements } from '../environment/presets.js';
import { applyDepth, SKY_COLOR, FOG_DENSITY } from '../sky.js';
import { resolveEnvironmentOptions, validateAircraftContract, boundsFromSize } from './contract.js';

/**
 * Builds an environment as one group any scene can add.
 *
 * @param {object} [options]
 * @param {string} [options.environment] the id of an assembled environment
 * @param {number} [options.size]        the square the world covers
 * @param {number} [options.segments]    how finely that square is sampled
 * @param {Array}  [options.elements]    element placements, instead of the preset's
 * @param {boolean|object} [options.runway] a landable strip in the world
 * @param {number} [options.seed]        build the same description as other ground
 * @param {boolean} [options.lights]     false to light the world yourself
 * @param {boolean} [options.fog]        false to keep your own scene depth
 */
export function createEnvironment(options = {}) {
    const resolved = resolveEnvironmentOptions(options);

    const group = new THREE.Group();
    group.name = 'pilot-matter-environment';

    const extras = [];
    let preset = getEnvironment(resolved.environment);
    let field  = null;
    let mesh   = null;

    function generate() {
        field = createField({ size: resolved.size, segments: resolved.segments });
        applyBase(field, preset.base);

        const random = createRandom(resolved.seed ?? preset.seed);
        const placements = resolved.elements ?? environmentElements(preset, resolved.runway);
        for (const placement of orderPlacements(placements)) {
            applyElement(field, placement, random);
        }

        if (mesh) {
            group.remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
        }

        mesh = buildMesh(field, resolved);
        group.add(mesh);

        // Anything a host registered was placed against the old ground, so it
        // is set back down on the new ground rather than left in mid-air.
        for (const extra of extras) settle(extra, field);
    }

    if (resolved.lights) {
        const sun = new THREE.DirectionalLight(0xfff4e0, 1.3);
        sun.position.set(600, 900, 400);
        group.add(sun, new THREE.AmbientLight(0x8aaccf, 0.7));
    }

    generate();

    return {
        group,
        get field() { return field; },
        get environment() { return preset; },
        bounds: boundsFromSize(resolved.size),

        /**
         * The strips cut into this world, which is the other half of the terrain
         * contract: what a flight model has to know to tell a landing from an
         * arrival on a hillside. Empty for a world built without a runway.
         */
        get runways() { return field.runways; },

        /** The terrain contract the Pilot API and any other flight model reads. */
        sampleHeight(x, z) { return sampleHeight(field, x, z); },

        /** Regenerates the ground as a different assembled environment. */
        setEnvironment(id) {
            const next = getEnvironment(id);
            if (next.id === preset.id) return false;
            preset = next;
            generate();
            return true;
        },

        /**
         * Adds a caller-supplied mesh as an element of this world. It is placed
         * by the generator rather than by the host: given a position it is set
         * down on the ground there, and given none it is dropped somewhere
         * inside the bounds by the environment's own seeded stream.
         */
        register(object, placement = {}) {
            if (!object?.isObject3D) throw new TypeError('register() needs an Object3D');

            const random = createRandom(preset.seed + extras.length + 1);
            const half   = resolved.size / 2 * 0.9;
            const entry  = {
                object,
                x: placement.x ?? (random() * 2 - 1) * half,
                z: placement.z ?? (random() * 2 - 1) * half,
                offset: placement.offset ?? 0
            };

            extras.push(entry);
            settle(entry, field);
            group.add(object);
            return object;
        },

        /**
         * Adopts an aircraft the environment did not build: anything that
         * carries a position and an orientation the world can read. Throws with
         * every problem at once rather than one per reload.
         */
        attach(aircraft) {
            const problems = validateAircraftContract(aircraft);
            if (problems.length > 0) {
                throw new TypeError(`aircraft does not satisfy the contract: ${problems.join('; ')}`);
            }
            if (aircraft.isObject3D) group.add(aircraft);
            return {
                aircraft,
                /** The ground under the aircraft, for whatever is flying it. */
                groundHeight() {
                    return sampleHeight(field, aircraft.position.x, aircraft.position.z);
                }
            };
        },

        /**
         * The world's depth without the world: the sky it fades to and the fog
         * that fades it, applied to any scene. An environment created with
         * `fog: false` leaves the scene's own depth alone.
         */
        applyDepth(scene, depth = {}) {
            if (!resolved.fog) return scene;
            return applyDepth(scene, { color: SKY_COLOR, density: FOG_DENSITY, ...depth });
        },

        dispose() {
            for (const extra of extras) group.remove(extra.object);
            extras.length = 0;
            if (mesh) {
                group.remove(mesh);
                mesh.geometry.dispose();
                mesh.material.dispose();
                mesh = null;
            }
            group.removeFromParent?.();
        }
    };
}

function buildMesh(field, resolved) {
    const geo = new THREE.PlaneGeometry(
        resolved.size, resolved.size, field.segments, field.segments
    );
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, field.height[i]);

    geo.setAttribute('color', new THREE.Float32BufferAttribute(field.color.slice(), 3));
    geo.computeVertexNormals();

    return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
}

function settle(entry, field) {
    entry.object.position.set(
        entry.x,
        sampleHeight(field, entry.x, entry.z) + entry.offset,
        entry.z
    );
}
