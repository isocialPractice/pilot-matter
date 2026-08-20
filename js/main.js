import * as THREE from 'three';
import { Aircraft }         from './aircraft.js';
import { Terrain }          from './terrain.js';
import { Sky }              from './sky.js';
import { CameraController } from './camera.js';
import { HUD }              from './hud.js';
import { addMountains }     from './mountains.js';
import { createPauseState, applyPauseKey, simulationDelta } from './pause.js';

class FlightSimulator {
    constructor() {
        this.init();
    }

    init() {
        this.scene = new THREE.Scene();

        this.camera = new THREE.PerspectiveCamera(
            70,
            window.innerWidth / window.innerHeight,
            0.1,
            12000
        );

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        document.getElementById('canvas-container').appendChild(this.renderer.domElement);

        this.sky      = new Sky(this.scene);
        this.terrain  = new Terrain(this.scene);
        addMountains(this.terrain);
        this.aircraft = new Aircraft(this.scene);
        this.camera2  = new CameraController(this.camera, this.aircraft);
        this.hud      = new HUD();

        document.getElementById('loading').style.display = 'none';

        this.pauseState      = createPauseState();
        this.pausedIndicator = document.getElementById('paused');
        this.setupPause();

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        this.clock = new THREE.Clock();
        this.animate();
    }

    setupPause() {
        window.addEventListener('keydown', (e) => {
            if (applyPauseKey(this.pauseState, e.code, true, e.repeat)) {
                this.pausedIndicator.style.display = this.pauseState.paused ? 'block' : 'none';
            }
        });
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        // The clock is always read so the time spent paused is discarded
        // rather than applied in one jump on the frame the sim resumes.
        const dt          = simulationDelta(this.pauseState, this.clock.getDelta());
        const aircraftPos = this.aircraft.getPosition();
        const groundH     = this.terrain.getTerrainHeightAt(aircraftPos.x, aircraftPos.z);

        this.aircraft.update(dt, groundH);
        this.camera2.update(dt);
        this.sky.update();
        this.hud.update(this.aircraft, this.camera2, this.pauseState.paused);

        this.renderer.render(this.scene, this.camera);
    }
}

new FlightSimulator();
