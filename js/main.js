import * as THREE from 'three';
import { Aircraft }         from './aircraft.js';
import { Terrain }          from './terrain.js';
import { Sky }              from './sky.js';
import { CameraController } from './camera.js';
import { HUD }              from './hud.js';
import { INITIAL_CAMERA_MODE } from './flight-state.js';
import { createPauseState, applyPauseKey, resumeFlight, simulationDelta } from './pause.js';
import { createTitleState, startFlight, titleShowing, preFlightDelta }    from './title-screen.js';
import {
    createMenuState, resetSelection, applyMenuKey, isMenuKey,
    MenuList, START_MENU_ENTRIES, PAUSE_MENU_ENTRIES
} from './menu.js';
import { createHelpState, applyHelpKey, expandHelp } from './controls-help.js';
import {
    createHudVisibilityState, applyHudToggleKey, isHudToggleKey, defaultStorage
} from './hud-visibility.js';
import {
    createSettingsState, openSettings, closeSettings, settingsShowing,
    chooseSetting, currentEnvironment, isSettingsCloseKey, SETTINGS_BACK_ID
} from './settings.js';

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

        this.settings = createSettingsState(defaultStorage());

        this.sky      = new Sky(this.scene);
        this.terrain  = new Terrain(this.scene, currentEnvironment(this.settings));
        this.aircraft = new Aircraft(this.scene);
        this.camera2  = new CameraController(this.camera, this.aircraft, INITIAL_CAMERA_MODE);
        this.hud      = new HUD();

        document.getElementById('loading').style.display = 'none';

        this.titleState     = createTitleState();
        this.pauseState     = createPauseState();
        this.startMenuState = createMenuState(START_MENU_ENTRIES);
        this.pauseMenuState = createMenuState(PAUSE_MENU_ENTRIES);
        this.settingsState  = createMenuState(this.settings.entries);
        this.helpState      = createHelpState();
        this.hudVisibility  = createHudVisibilityState(defaultStorage());

        // The start screen's Controls entry puts the control list on screen
        // over the title, where nothing else would have shown it yet.
        this.titleHelp = false;

        this.overlays = {
            title:    document.getElementById('title-screen'),
            paused:   document.getElementById('paused'),
            settings: document.getElementById('settings'),
            hud:      document.getElementById('hud'),
            attitude: document.getElementById('attitude'),
            help:     document.getElementById('controls-help'),
            helpList: document.getElementById('controls-help-list'),
            helpHint: document.getElementById('controls-help-hint')
        };

        this.startMenu    = new MenuList(document.getElementById('start-menu'), this.startMenuState);
        this.pauseMenu    = new MenuList(document.getElementById('pause-menu'), this.pauseMenuState);
        this.settingsMenu = new MenuList(document.getElementById('settings-menu'), this.settingsState);

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
        // The start screen swallows every key it sees, so working its menu
        // never also moves a control surface. This listener runs on the way
        // down to the page, ahead of the aircraft's and the camera's, which
        // listen on the way back up.
        window.addEventListener('keydown', (e) => {
            if (!titleShowing(this.titleState)) return;
            // A key held with a modifier is a browser shortcut rather than a
            // menu key, and is left to the browser
            if (e.ctrlKey || e.altKey || e.metaKey) return;

            if (SWALLOWED_KEYS.includes(e.code)) e.preventDefault();
            this.onStartKey(e);
            e.stopPropagation();
        }, true);

        window.addEventListener('keydown', (e) => this.onKeyDown(e));
    }

    onStartKey(e) {
        if (settingsShowing(this.settings)) {
            this.onSettingsKey(e);
            return;
        }

        const chosen = applyMenuKey(this.startMenuState, e.code, true, e.repeat);
        if (chosen) this.chooseStartEntry(chosen);
        this.syncOverlays();
    }

    chooseStartEntry(id) {
        switch (id) {
            case 'start':
                this.titleHelp = false;
                startFlight(this.titleState);
                break;
            case 'controls':
                // The same entry the pause menu carries, showing the same list.
                // On the start screen it is also the way back off it: there is
                // no flight yet for the H key to be part of.
                this.titleHelp = !this.titleHelp;
                if (this.titleHelp) expandHelp(this.helpState);
                break;
            case 'settings':
                this.openSettingsPanel();
                break;
        }
    }

    onKeyDown(e) {
        // The panel is modal over a paused flight: nothing else reads a key
        // while it is open, so P cannot resume out from under it.
        if (settingsShowing(this.settings)) {
            this.onSettingsKey(e);
            return;
        }

        let changed = false;

        if (applyPauseKey(this.pauseState, e.code, true, e.repeat)) {
            // The menu opens on its first entry every time, so Resume is
            // always one key press away from a paused flight.
            resetSelection(this.pauseMenuState);
            changed = true;
        } else if (this.pauseState.paused && isMenuKey(e.code)) {
            // Space and the arrow keys scroll a page given the chance
            e.preventDefault();
            const chosen = applyMenuKey(this.pauseMenuState, e.code, true, e.repeat);
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
            case 'settings':
                this.openSettingsPanel();
                break;
        }
    }

    openSettingsPanel() {
        openSettings(this.settings);
        resetSelection(this.settingsState);
    }

    onSettingsKey(e) {
        if (isSettingsCloseKey(e.code)) {
            closeSettings(this.settings);
            this.syncOverlays();
            return;
        }

        if (!isMenuKey(e.code)) return;
        e.preventDefault();

        const chosen = applyMenuKey(this.settingsState, e.code, true, e.repeat);
        if (chosen) this.chooseSettingsEntry(chosen);
        this.syncOverlays();
    }

    chooseSettingsEntry(id) {
        const applied = chooseSetting(this.settings, id);
        if (!applied || applied === SETTINGS_BACK_ID) return;

        // A new world is a new flight: the aircraft goes back to the configured
        // start rather than carrying on inside a mountain that was not there
        // a moment ago.
        this.terrain.setEnvironment(applied);
        this.aircraft.reset();
    }

    // Every overlay is placed from the state that drives it, in one pass, so
    // no two toggles can leave the screen in a state neither of them meant.
    syncOverlays() {
        const onTitle  = titleShowing(this.titleState);
        const settings = settingsShowing(this.settings);
        const paused   = !onTitle && this.pauseState.paused;
        const chrome   = !onTitle && this.hudVisibility.visible;
        // The panel is opened to look at the world behind it, so it is the one
        // overlay that clears the screen it was opened from.
        const help     = !settings && (chrome || (onTitle && this.titleHelp));

        this.overlays.title.style.display    = onTitle && !settings ? 'flex' : 'none';
        this.overlays.settings.style.display = settings ? 'block' : 'none';
        this.overlays.paused.style.display   = paused && !settings ? 'block' : 'none';
        this.overlays.hud.style.display      = chrome && !settings ? 'block' : 'none';
        this.overlays.attitude.style.display = chrome && !settings ? 'block' : 'none';
        this.overlays.help.style.display     = help ? 'block' : 'none';
        this.overlays.helpList.style.display = this.helpState.expanded ? 'block' : 'none';
        this.overlays.helpHint.style.display = this.helpState.expanded ? 'none' : 'block';

        // The control list sits under the instruments in the corner, so on the
        // start screen it has to be lifted over the title to be read at all.
        this.overlays.help.classList.toggle('over-title', onTitle);

        this.startMenu.render(this.startMenuState);
        this.pauseMenu.render(this.pauseMenuState);
        this.settingsMenu.render(this.settingsState);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        // The clock is always read so the time spent paused, or spent on the
        // start screen before the flight is chosen, is discarded rather than
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
