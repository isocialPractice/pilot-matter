import * as THREE from 'three';
import { Aircraft }         from './aircraft.js';
import { Terrain }          from './terrain.js';
import { Sky }              from './sky.js';
import { CameraController } from './camera.js';
import { HUD }              from './hud.js';
import { addMountains }     from './mountains.js';
import { createPauseState, applyPauseKey, resumeFlight, simulationDelta } from './pause.js';
import { createTitleState, applyStartKey, titleShowing, preFlightDelta }  from './title-screen.js';
import { createMenuState, resetSelection, applyMenuKey, isMenuKey, PauseMenu } from './menu.js';
import { createHelpState, applyHelpKey, expandHelp } from './controls-help.js';
import {
    createHudVisibilityState, applyHudToggleKey, isHudToggleKey, defaultStorage
} from './hud-visibility.js';

// Keys whose browser default would disturb the page behind the game: the
// focus ring walking off the canvas, or the page scrolling under it. Every
// other key, the reload key included, keeps whatever the browser does with it.
const SWALLOWED_KEYS = ['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

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

        this.titleState    = createTitleState();
        this.pauseState    = createPauseState();
        this.menuState     = createMenuState();
        this.helpState     = createHelpState();
        this.hudVisibility = createHudVisibilityState(defaultStorage());

        this.overlays = {
            title:    document.getElementById('title-screen'),
            paused:   document.getElementById('paused'),
            hud:      document.getElementById('hud'),
            attitude: document.getElementById('attitude'),
            help:     document.getElementById('controls-help'),
            helpList: document.getElementById('controls-help-list'),
            helpHint: document.getElementById('controls-help-hint')
        };
        this.pauseMenu = new PauseMenu(document.getElementById('pause-menu'), this.menuState);

        this.setupKeys();
        this.syncOverlays();

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        this.clock = new THREE.Clock();
        this.animate();
    }

    setupKeys() {
        // The title screen swallows the key that answers it, so the press
        // that starts the flight does not also move a control surface. This
        // listener runs on the way down to the page, ahead of the aircraft's
        // and the camera's, which listen on the way back up.
        window.addEventListener('keydown', (e) => {
            if (!titleShowing(this.titleState)) return;
            // A key held with a modifier is a browser shortcut rather than an
            // answer to the prompt, and is left to the browser
            if (e.ctrlKey || e.altKey || e.metaKey) return;

            if (SWALLOWED_KEYS.includes(e.code)) e.preventDefault();
            if (applyStartKey(this.titleState, e.code, true, e.repeat)) this.syncOverlays();
            e.stopPropagation();
        }, true);

        window.addEventListener('keydown', (e) => this.onKeyDown(e));
    }

    onKeyDown(e) {
        let changed = false;

        if (applyPauseKey(this.pauseState, e.code, true, e.repeat)) {
            // The menu opens on its first entry every time, so Resume is
            // always one key press away from a paused flight.
            resetSelection(this.menuState);
            changed = true;
        } else if (this.pauseState.paused && isMenuKey(e.code)) {
            // Space and the arrow keys scroll a page given the chance
            e.preventDefault();
            const chosen = applyMenuKey(this.menuState, e.code, true, e.repeat);
            if (chosen) this.chooseMenuEntry(chosen);
            changed = true;
        } else if (applyHelpKey(this.helpState, e.code, true, e.repeat)) {
            changed = true;
        } else if (isHudToggleKey(e.code)) {
            // Tab would otherwise walk the browser's focus ring off the canvas
            e.preventDefault();
            changed = applyHudToggleKey(this.hudVisibility, e.code, true, e.repeat);
        }

        if (changed) this.syncOverlays();
    }

    chooseMenuEntry(id) {
        switch (id) {
            case 'resume':
                resumeFlight(this.pauseState);
                break;
            case 'reset':
                // Back to the starting condition, and flying again: a reset
                // that left the flight paused would be a menu that lied
                this.aircraft.reset();
                resumeFlight(this.pauseState);
                break;
            case 'controls':
                expandHelp(this.helpState);
                break;
        }
    }

    // Every overlay is placed from the state that drives it, in one pass, so
    // no two toggles can leave the screen in a state neither of them meant.
    syncOverlays() {
        const onTitle = titleShowing(this.titleState);
        const paused  = !onTitle && this.pauseState.paused;
        const chrome  = !onTitle && this.hudVisibility.visible;

        this.overlays.title.style.display    = onTitle ? 'flex' : 'none';
        this.overlays.paused.style.display   = paused ? 'block' : 'none';
        this.overlays.hud.style.display      = chrome ? 'block' : 'none';
        this.overlays.attitude.style.display = chrome ? 'block' : 'none';
        this.overlays.help.style.display     = chrome ? 'block' : 'none';
        this.overlays.helpList.style.display = this.helpState.expanded ? 'block' : 'none';
        this.overlays.helpHint.style.display = this.helpState.expanded ? 'none' : 'block';

        this.pauseMenu.render(this.menuState);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        // The clock is always read so the time spent paused, or spent on the
        // title screen before the first key press, is discarded rather than
        // applied in one jump on the frame the simulation runs again.
        const frozen      = titleShowing(this.titleState) || this.pauseState.paused;
        const dt          = preFlightDelta(this.titleState, simulationDelta(this.pauseState, this.clock.getDelta()));
        const aircraftPos = this.aircraft.getPosition();
        const groundH     = this.terrain.getTerrainHeightAt(aircraftPos.x, aircraftPos.z);

        this.aircraft.update(dt, groundH);
        this.camera2.update(dt);
        this.sky.update();
        this.hud.update(this.aircraft, this.camera2, frozen);

        this.renderer.render(this.scene, this.camera);
    }
}

new FlightSimulator();
