/**
 * Both halves of the simulator API on one page, each proving the direction the
 * other cannot.
 *
 * On the left, the **Pilot API** flies over an environment this page generated
 * itself: no terrain of Pilot Matter's is loaded at all, and the aircraft finds
 * the ground through the terrain contract - a function that answers the height
 * under a point, and the bounds that say where its ground stops.
 *
 * On the right, the **Matter API** carries an aircraft it did not build, flown
 * by a flight model written in this file. The world is an assembly of four
 * tiles rather than one square, so the join between them is there to be flown
 * across, and it runs the day and moves its own water.
 *
 * Everything is imported from the one specifier the manifest publishes, which
 * is what a host page installing the package would write.
 */

import * as THREE from 'three';
import {
    createPilot, createTiledEnvironment, boundsFromSize,
    createDayNight, advanceDayNight, isAircraftContractSatisfied
} from 'pilot-matter';

// --- A pane of the page, as its own scene, camera, and renderer ------------

class Pane {
    constructor(id, { background = 0x0b1622 } = {}) {
        this.element  = document.getElementById(id);
        this.scene    = new THREE.Scene();
        this.scene.background = new THREE.Color(background);
        this.camera   = new THREE.PerspectiveCamera(70, 1, 0.1, 24000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });

        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.element.appendChild(this.renderer.domElement);
        this.resize();
    }

    resize() {
        const { clientWidth: width, clientHeight: height } = this.element;
        this.camera.aspect = width / Math.max(height, 1);
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }
}

// --- The Pilot API, over an environment this page generated ----------------

const HOST_WORLD = 12000;

/**
 * The host's own ground: a couple of crossed waves and a slow swell over them.
 * Any function of x and z will do - what makes it a world the Pilot API can fly
 * is that it answers a height and says where it stops.
 */
function hostHeight(x, z) {
    return 210
        + Math.sin(x / 880) * Math.cos(z / 1040) * 240
        + Math.sin((x + z) / 2600) * 180
        + Math.cos(x / 3400) * Math.sin(z / 2900) * 120;
}

const hostTerrain = {
    sampleHeight: hostHeight,
    bounds: boundsFromSize(HOST_WORLD)
};

function buildHostGround() {
    const segments = 140;
    const geometry = new THREE.PlaneGeometry(HOST_WORLD, HOST_WORLD, segments, segments);
    geometry.rotateX(-Math.PI / 2);

    const position = geometry.attributes.position;
    const colors = new Float32Array(position.count * 3);

    for (let i = 0; i < position.count; i++) {
        const x = position.getX(i);
        const z = position.getZ(i);
        const height = hostHeight(x, z);
        position.setY(i, height);

        // The host paints its own ground, which is the point: the Pilot API
        // never sees the world it is being flown over.
        const t = Math.min(Math.max((height + 300) / 900, 0), 1);
        colors[i * 3]     = 0.20 + t * 0.45;
        colors[i * 3 + 1] = 0.34 + t * 0.34;
        colors[i * 3 + 2] = 0.26 + t * 0.30;
    }

    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    return new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true }));
}

const pilotPane = new Pane('pilot-pane', { background: 0x243d55 });
pilotPane.scene.fog = new THREE.FogExp2(0x243d55, 0.00016);
pilotPane.scene.add(buildHostGround());

const hostSun = new THREE.DirectionalLight(0xfff0d8, 1.25);
hostSun.position.set(700, 1100, 500);
pilotPane.scene.add(hostSun, new THREE.AmbientLight(0x8aaccf, 0.65));

const pilot = createPilot({
    scene: pilotPane.scene,
    camera: pilotPane.camera,
    terrain: hostTerrain,
    flight: { altitude: 900, speed: 90, throttle: 0.4 }
});

const pilotReadout = document.getElementById('pilot-readout');

// --- The Matter API, under an aircraft this page built --------------------

const world = createTiledEnvironment({
    environment: 'lakeside',
    tiles: 2,
    size: 8000,
    segments: 110,
    runway: true
});

const matterPane = new Pane('matter-pane');
matterPane.scene.add(world.group);
world.applyDepth(matterPane.scene, { density: 0.00012 });

/**
 * The host's own aircraft. All the world asks of it is somewhere to sample
 * under and a way to read which way it points, which is the whole of the
 * aircraft contract.
 */
function buildHostAircraft() {
    const aircraft = new THREE.Group();

    const body = new THREE.Mesh(
        new THREE.ConeGeometry(6, 30, 8).rotateX(Math.PI / 2),
        new THREE.MeshLambertMaterial({ color: 0xe8eef5 })
    );
    const wing = new THREE.Mesh(
        new THREE.BoxGeometry(46, 1.6, 8),
        new THREE.MeshLambertMaterial({ color: 0xcc5533 })
    );
    wing.position.z = -2;

    aircraft.add(body, wing);
    return aircraft;
}

const hostAircraft = buildHostAircraft();
hostAircraft.position.set(0, 1200, 0);
console.assert(isAircraftContractSatisfied(hostAircraft), 'the aircraft should satisfy the contract');

// Throws with every gap in the contract at once rather than one per reload.
const flown = world.attach(hostAircraft);

// A landmark of the host's own, set down on the ground by the generator rather
// than placed over it by hand.
world.register(new THREE.Mesh(
    new THREE.CylinderGeometry(6, 6, 220, 6),
    new THREE.MeshLambertMaterial({ color: 0xdd4422 })
), { x: 900, z: -1400, offset: 110 });

/**
 * The host's own flight model, which is as much of one as a circuit needs: a
 * constant speed, a slow turn, and a height held over whatever ground the world
 * says is underneath. Nothing of Pilot Matter's flight model is loaded here.
 */
const circuit = { heading: 0.6, speed: 260, hold: 700 };

function flyHostAircraft(dt) {
    circuit.heading += dt * 0.16;

    const step = circuit.speed * dt;
    hostAircraft.position.x += Math.sin(circuit.heading) * step;
    hostAircraft.position.z += Math.cos(circuit.heading) * step;

    // The ground under the aircraft, which is the terrain contract answered
    // across the whole assembly rather than by one tile of it.
    const ground = flown.groundHeight();
    const wanted = ground + circuit.hold;
    hostAircraft.position.y += (wanted - hostAircraft.position.y) * Math.min(dt * 0.9, 1);

    hostAircraft.rotation.y = circuit.heading;
    hostAircraft.rotation.z = -0.4;

    return ground;
}

// The day the right-hand world is flown through, which is the pure cycle the
// bundled sky is driven by, run here by the host instead.
const day = createDayNight({ length: 120, phase: 0.3 });

const matterReadout = document.getElementById('matter-readout');

// --- Both panes, one loop -------------------------------------------------

const clock = new THREE.Clock();

function frame() {
    const dt = Math.min(clock.getDelta(), 0.1);

    const telemetry = pilot.update(dt);
    pilotReadout.textContent = [
        `SPEED  ${telemetry.airspeed.toFixed(0).padStart(4)} u/s`,
        `ALT    ${telemetry.altitude.toFixed(0).padStart(4)}`,
        `AGL    ${telemetry.heightAboveTerrain.toFixed(0).padStart(4)}`,
        `HDG    ${String(telemetry.heading).padStart(3, '0')}`,
        `THR    ${Math.round(telemetry.throttle * 100).toString().padStart(3)}%`,
        telemetry.stalled ? 'STALL' : telemetry.crashed ? 'CRASHED' : ''
    ].join('\n');

    const ground = flyHostAircraft(dt);

    // The hour moves, the light moves with it, and the water glints with
    // whatever daylight there is to glint with.
    advanceDayNight(day, dt);
    const light = world.setDaylight(day.phase);
    world.updateWater(dt, light.daylight);

    const chase = new THREE.Vector3(
        hostAircraft.position.x - Math.sin(circuit.heading) * 170,
        hostAircraft.position.y + 60,
        hostAircraft.position.z - Math.cos(circuit.heading) * 170
    );
    matterPane.camera.position.lerp(chase, Math.min(dt * 4, 1));
    matterPane.camera.lookAt(hostAircraft.position);

    const tile = world.tileAt(hostAircraft.position.x, hostAircraft.position.z);
    matterReadout.textContent = [
        `TILE   ${tile ? `${tile.tile.x}, ${tile.tile.z}` : 'off the assembly'}`,
        `GROUND ${ground.toFixed(0).padStart(4)}`,
        `ALT    ${hostAircraft.position.y.toFixed(0).padStart(4)}`,
        `HOUR   ${light.label}`,
        `SEAMS  ${world.seams} vertices matched`,
        `STRIPS ${world.runways.length}`
    ].join('\n');

    pilotPane.render();
    matterPane.render();

    requestAnimationFrame(frame);
}

window.addEventListener('resize', () => {
    pilotPane.resize();
    matterPane.resize();
});

frame();
