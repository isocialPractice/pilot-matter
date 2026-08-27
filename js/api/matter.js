/**
 * Matter API - the world, without the flight model.
 *
 * A host gets one detachable group holding the ground it asked for, a height
 * sampler for whatever is flying over it, and a contract any aircraft can
 * satisfy - including one driven by a control API that has never heard of this
 * one. Caller-supplied meshes can be registered as elements of the world and
 * placed by the generator, so an external asset sits on the ground rather than
 * hovering over it.
 *
 * A world can also be one square of a larger one. Given the place it takes in a
 * grid, an environment is generated in the world's coordinates rather than in
 * its own, which is what lets the ground it is shaped on run on across a join,
 * and `join()` settles what the elements drew at the edges so neighbouring
 * tiles meet at matched heights and matched colours rather than at a seam.
 */

import * as THREE from 'three';
import {
    createField, createRandom, applyBase, applyElement, orderPlacements,
    sampleHeight, matchEdges, waterSurface, tileSeed
} from '../environment/elements.js';
import { getEnvironment, environmentElements } from '../environment/presets.js';
import { applyDepth, applyDaylight, SKY_COLOR, FOG_DENSITY } from '../sky.js';
import { animateWater } from '../water.js';
import {
    resolveEnvironmentOptions, validateAircraftContract, boundsFromSize, tileOrigin
} from './contract.js';

/**
 * Builds an environment as one group any scene can add.
 *
 * @param {object} [options]
 * @param {string} [options.environment] the id of an assembled environment
 * @param {number} [options.size]        the square the world covers
 * @param {number} [options.segments]    how finely that square is sampled
 * @param {Array}  [options.elements]    element placements, instead of the preset's
 * @param {boolean|object} [options.runway] a landable strip in the world
 * @param {object} [options.tile]        `{ x, z }`, the square this world is of a larger one
 * @param {number} [options.seed]        build the same description as other ground
 * @param {boolean} [options.lights]     false to light the world yourself
 * @param {boolean} [options.fog]        false to keep your own scene depth
 */
export function createEnvironment(options = {}) {
    const resolved = resolveEnvironmentOptions(options);
    const origin   = tileOrigin(resolved.tile, resolved.size);

    const group = new THREE.Group();
    group.name = 'pilot-matter-environment';

    const extras = [];
    let preset  = getEnvironment(resolved.environment);
    let field   = null;
    let mesh    = null;
    let water   = null;
    let elapsed = 0;
    let depthScene = null;
    let sun = null;
    let ambient = null;

    /** The stream this square of the world is laid out from. */
    function seed() {
        return tileSeed(resolved.seed ?? preset.seed, resolved.tile.x, resolved.tile.z);
    }

    function generate() {
        field = createField({
            size: resolved.size,
            segments: resolved.segments,
            originX: origin.x,
            originZ: origin.z
        });
        applyBase(field, preset.base);

        const random = createRandom(seed());
        const placements = resolved.elements ?? environmentElements(preset, resolved.runway);
        for (const placement of orderPlacements(placements)) {
            applyElement(field, placement, random);
        }

        draw();
    }

    /**
     * Draws whatever the field now says, without generating it again. Called on
     * a fresh world, and again after a join has settled its edges against a
     * neighbour's.
     */
    function draw() {
        if (mesh) {
            group.remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
        }

        mesh  = buildMesh(field, resolved, origin);
        water = waterSurface(field);
        group.add(mesh);

        // Anything a host registered was placed against the old ground, so it
        // is set back down on the new ground rather than left in mid-air.
        for (const extra of extras) settle(extra, field);
    }

    if (resolved.lights) {
        sun = new THREE.DirectionalLight(0xfff4e0, 1.3);
        sun.position.set(600, 900, 400);
        ambient = new THREE.AmbientLight(0x8aaccf, 0.7);
        group.add(sun, ambient);
    }

    generate();

    return {
        group,
        get field() { return field; },
        get environment() { return preset; },
        bounds: boundsFromSize(resolved.size, origin),

        /** The square of a larger world this one is, and where its middle sits. */
        tile: { ...resolved.tile },
        origin: { ...origin },

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
         * Settles this world's edges against the worlds laid beside it, so an
         * assembly meets at matched heights and matched colours rather than at
         * a seam. Every neighbour is given at once rather than one at a time,
         * because a vertex four tiles all reach has to be settled against all
         * four of them to close.
         *
         * Only the few vertices either side of a join move, and only the tiles
         * that shared a vertex are drawn again. Returns how many shared
         * vertices were settled.
         */
        join(...neighbours) {
            const others = neighbours.flat().filter(Boolean);
            if (others.length === 0) return 0;

            const settled = matchEdges([field, ...others.map(other => other.field)]);
            if (settled > 0) {
                draw();
                for (const other of others) other.redraw();
            }

            return settled;
        },

        /**
         * Draws the ground again from the field as it now stands, for a host
         * that has settled the edges itself or written into the field directly.
         */
        redraw() { draw(); },

        /**
         * Adds a caller-supplied mesh as an element of this world. It is placed
         * by the generator rather than by the host: given a position it is set
         * down on the ground there, and given none it is dropped somewhere
         * inside the bounds by the environment's own seeded stream.
         */
        register(object, placement = {}) {
            if (!object?.isObject3D) throw new TypeError('register() needs an Object3D');

            const random = createRandom(seed() + extras.length + 1);
            const half   = resolved.size / 2 * 0.9;
            const entry  = {
                object,
                x: placement.x ?? origin.x + (random() * 2 - 1) * half,
                z: placement.z ?? origin.z + (random() * 2 - 1) * half,
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
         *
         * The scene is remembered, so a world told what hour it is tints the
         * depth it applied along with the light it is casting.
         */
        applyDepth(scene, depth = {}) {
            if (!resolved.fog) return scene;
            depthScene = scene;
            return applyDepth(scene, { color: SKY_COLOR, density: FOG_DENSITY, ...depth });
        },

        /**
         * Sets the hour of the day, from midnight at 0 through noon at a half.
         * The sun this world is lit by walks the arc, the fill and the depth go
         * with it, and what comes back is the light now in force - which is what
         * the water reads to know how much there is to glint with.
         */
        setDaylight(phase) {
            return applyDaylight(phase, {
                scene: depthScene,
                sun,
                ambient,
                density: depthScene?.fog?.density ?? FOG_DENSITY
            });
        },

        /**
         * Moves the water on by a frame. `light` is how much day there is to
         * glint off it, which a host running the cycle reads off `setDaylight`.
         *
         * Returns how many vertices moved.
         */
        updateWater(dt = 0, light = 1) {
            if (!water) return 0;
            elapsed += Number(dt) || 0;

            const position = mesh.geometry.attributes.position;
            const color    = mesh.geometry.attributes.color;

            const moved = animateWater(water, elapsed, {
                positions: position.array,
                colors: color.array,
                light
            });

            position.needsUpdate = true;
            color.needsUpdate = true;
            return moved;
        },

        dispose() {
            for (const extra of extras) group.remove(extra.object);
            extras.length = 0;
            water = null;
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

/**
 * Builds a grid of environments as one larger world, with every join already
 * settled.
 *
 * Each tile is a whole environment - its own ground, its own strips, its own
 * water - generated in the world's coordinates rather than in its own, so the
 * noise the ground is shaped from runs on across the joins instead of starting
 * again at each of them. What the elements drew at the edges is settled
 * afterwards, in one pass over the whole assembly, so the corner four tiles
 * meet at closes as cleanly as the edges do.
 *
 * The grid is laid around the middle of the world, so an assembly is centred
 * where a single environment would have been and a host does not have to move
 * anything to fly over the middle of it.
 *
 * @param {object} [options]        everything `createEnvironment` takes, and:
 * @param {number|object} [options.tiles] how many squares across, or `{ x, z }`
 * @param {number} [options.seam]   how far a join is eased back into the ground
 */
export function createTiledEnvironment(options = {}) {
    const { tiles = 2, seam, lights, fog, ...rest } = options;
    const across = tileCounts(tiles);
    const size   = resolveEnvironmentOptions(rest).size;

    const group = new THREE.Group();
    group.name = 'pilot-matter-assembly';

    const built = [];
    for (let z = 0; z < across.z; z++) {
        for (let x = 0; x < across.x; x++) {
            // One light over the whole assembly rather than one over each tile,
            // which would light the world as many times over as it has squares.
            const tile = createEnvironment({
                ...rest,
                lights: false,
                fog: false,
                tile: { x: x - (across.x - 1) / 2, z: z - (across.z - 1) / 2 }
            });
            built.push(tile);
            group.add(tile.group);
        }
    }

    const settled = matchEdges(built.map(tile => tile.field), seam ? { blend: seam } : {});
    if (settled > 0) for (const tile of built) tile.redraw();

    let sun = null;
    let ambient = null;
    if (lights !== false) {
        sun = new THREE.DirectionalLight(0xfff4e0, 1.3);
        sun.position.set(600, 900, 400);
        ambient = new THREE.AmbientLight(0x8aaccf, 0.7);
        group.add(sun, ambient);
    }

    let depthScene = null;

    const bounds = {
        minX: -across.x * size / 2, maxX: across.x * size / 2,
        minZ: -across.z * size / 2, maxZ: across.z * size / 2
    };

    /**
     * The square a place in the world falls on, or null off the whole assembly.
     * A plain function rather than a method, because the sampler below is handed
     * to a flight model as the terrain contract - on its own, without the object
     * it came off - and a contract that only worked while it was still attached
     * to its world would not be one.
     */
    function tileAt(x, z) {
        if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) return null;
        const ix = Math.min(Math.floor((x - bounds.minX) / size), across.x - 1);
        const iz = Math.min(Math.floor((z - bounds.minZ) / size), across.z - 1);
        return built[iz * across.x + ix] ?? null;
    }

    return {
        group,
        tiles: built,
        across,
        bounds,
        /** How many vertices the joins were settled at, for a host counting them. */
        seams: settled,

        /** Every strip cut into the assembly, whichever square it was cut into. */
        get runways() { return built.flatMap(tile => tile.runways); },

        /** The square a place in the world falls on, or null off the whole assembly. */
        tileAt,

        /**
         * The ground under a point, taken from whichever square it is over. The
         * terrain contract, answered across the whole assembly rather than one
         * tile at a time.
         */
        sampleHeight(x, z) {
            return tileAt(x, z)?.sampleHeight(x, z) ?? 0;
        },

        /**
         * Adopts an aircraft the assembly did not build, the same way one
         * square does, and reports the ground under it from whichever square it
         * is over rather than from the one it started on.
         */
        attach(aircraft) {
            const problems = validateAircraftContract(aircraft);
            if (problems.length > 0) {
                throw new TypeError(`aircraft does not satisfy the contract: ${problems.join('; ')}`);
            }
            if (aircraft.isObject3D) group.add(aircraft);
            return {
                aircraft,
                groundHeight() {
                    const tile = tileAt(aircraft.position.x, aircraft.position.z);
                    return tile ? tile.sampleHeight(aircraft.position.x, aircraft.position.z) : 0;
                }
            };
        },

        /**
         * Adds a caller-supplied mesh as an element of the assembly, placed by
         * the square it falls on. Given no position it is dropped on the first
         * square, by that square's own seeded stream.
         */
        register(object, placement = {}) {
            const tile = placement.x != null && placement.z != null
                ? tileAt(placement.x, placement.z)
                : built[0];

            if (!tile) throw new RangeError('register() was given a place off the assembly');
            return tile.register(object, placement);
        },

        applyDepth(scene, depth = {}) {
            if (fog === false) return scene;
            depthScene = scene;
            return applyDepth(scene, { color: SKY_COLOR, density: FOG_DENSITY, ...depth });
        },

        setDaylight(phase) {
            return applyDaylight(phase, {
                scene: depthScene,
                sun,
                ambient,
                density: depthScene?.fog?.density ?? FOG_DENSITY
            });
        },

        /** Moves every square's water on together, so one surface crosses the joins. */
        updateWater(dt = 0, light = 1) {
            let moved = 0;
            for (const tile of built) moved += tile.updateWater(dt, light);
            return moved;
        },

        dispose() {
            for (const tile of built) tile.dispose();
            built.length = 0;
            group.removeFromParent?.();
        }
    };
}

/** How many squares across an assembly is, from a count or a pair of them. */
function tileCounts(tiles) {
    const count = (value, fallback) => {
        const number = Math.round(Number(value));
        return Number.isFinite(number) && number > 0 ? number : fallback;
    };

    if (typeof tiles === 'object' && tiles !== null) {
        return { x: count(tiles.x, 1), z: count(tiles.z, 1) };
    }

    const square = count(tiles, 2);
    return { x: square, z: square };
}

function buildMesh(field, resolved, origin) {
    const geo = new THREE.PlaneGeometry(
        resolved.size, resolved.size, field.segments, field.segments
    );
    geo.rotateX(-Math.PI / 2);

    // The mesh is drawn where the field says it is rather than being moved
    // there afterwards, so a vertex of a tile stands at the world coordinate the
    // generator wrote it at and a host never has to convert between the two.
    if (origin.x !== 0 || origin.z !== 0) geo.translate(origin.x, 0, origin.z);

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
