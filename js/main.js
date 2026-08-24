import * as THREE from 'three';
import { Aircraft }         from './aircraft.js';
import { Terrain }          from './terrain.js';
import { Sky }              from './sky.js';
import { CameraController } from './camera.js';
import { HUD }              from './hud.js';
import { INITIAL_CAMERA_MODE, flightStart } from './flight-state.js';
import { createPauseState, applyPauseKey, resumeFlight, simulationDelta } from './pause.js';
import { createTitleState, startFlight, titleShowing, preFlightDelta }    from './title-screen.js';
import {
    createMenuState, resetSelection, applyMenuKey, isMenuKey, selectedId,
    isMenuAdjustKey, menuAdjustStep,
    MenuList, START_MENU_ENTRIES, PAUSE_MENU_ENTRIES
} from './menu.js';
import { createHelpState, applyHelpKey, expandHelp } from './controls-help.js';
import {
    createHudVisibilityState, applyHudToggleKey, isHudToggleKey, defaultStorage
} from './hud-visibility.js';
import {
    createSettingsState, openSettings, closeSettings, settingsShowing,
    chooseSetting, adjustSetting, currentEnvironment, currentOption, startSettings,
    isSettingsCloseKey, isSettingsOpenKey, isEnvironmentId,
    SETTINGS_BACK_ID, ENVIRONMENT_ENTRY, OPTION_ENTRY, START_GROUP,
    SENSITIVITY_OPTION, FOG_OPTION, SPEED_UNIT_OPTION, ALTITUDE_UNIT_OPTION
} from './settings.js';
import {
    createLoadingState, advanceLoading, loadingComplete, LoadingScreen
} from './loading.js';
import { createAudioState, applyMuteKey, audioLevels, FlightAudio } from './audio.js';
import {
    createPhotoState, applyPhotoKey, photoPending, completePhoto,
    photoFilename, savePhoto
} from './photo.js';

// Keys whose browser default would disturb the page behind the game: the
// focus ring walking off the canvas, or the page scrolling under it. Every
// other key, the reload key included, keeps whatever the browser does with it.
const SWALLOWED_KEYS = ['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

// Whether two starts are the same condition, so that changing a setting which
// is not part of the start does not put the aircraft back into one.
function sameStart(start, applied) {
    return applied != null && Object.keys(start).every(field => start[field] === applied[field]);
}

class FlightSimulator {
    constructor() {
        this.init();
    }

    init() {
        // The loading screen is the first thing built and the last thing taken
        // off, so every step below has somewhere to report itself to.
        this.loading       = createLoadingState();
        this.loadingScreen = new LoadingScreen(document.getElementById('loading'));
        this.loadingScreen.update(this.loading);

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
        this.loaded('scene');

        this.settings = createSettingsState(defaultStorage());

        this.sky      = new Sky(this.scene);
        this.terrain  = new Terrain(this.scene, currentEnvironment(this.settings));
        // The square the world covers, held rather than asked for every frame:
        // it only changes when the world does.
        this.bounds   = this.terrain.getBounds();
        this.loaded('world');

        // A flight that resets - by the menu, by the R key, or by a crash - goes
        // back to the whole configured start, the view it opens in included.
        this.aircraft = new Aircraft(this.scene, {
            onReset: () => this.camera2?.setMode(startSettings(this.settings).cameraMode)
        });
        this.camera2  = new CameraController(this.camera, this.aircraft, INITIAL_CAMERA_MODE);
        this.loaded('aircraft');

        this.hud = new HUD();
        this.hud.setBounds(this.bounds);

        this.titleState     = createTitleState();
        this.pauseState     = createPauseState();
        this.startMenuState = createMenuState(START_MENU_ENTRIES);
        this.pauseMenuState = createMenuState(PAUSE_MENU_ENTRIES);
        this.settingsState  = createMenuState(this.settings.entries);
        this.helpState      = createHelpState();
        this.hudVisibility  = createHudVisibilityState(defaultStorage());
        this.audioState     = createAudioState(defaultStorage());
        this.audio          = new FlightAudio(this.audioState);
        this.photoState     = createPhotoState();

        // The start screen's Controls entry puts the control list on screen
        // over the title, where nothing else would have shown it yet.
        this.titleHelp = false;

        this.overlays = {
            title:    document.getElementById('title-screen'),
            paused:   document.getElementById('paused'),
            settings: document.getElementById('settings'),
            hud:      document.getElementById('hud'),
            attitude: document.getElementById('attitude'),
            minimap:  document.getElementById('minimap'),
            muted:    document.getElementById('audio-muted'),
            help:     document.getElementById('controls-help'),
            helpList: document.getElementById('controls-help-list'),
            helpHint: document.getElementById('controls-help-hint')
        };

        this.startMenu    = new MenuList(document.getElementById('start-menu'), this.startMenuState);
        this.pauseMenu    = new MenuList(document.getElementById('pause-menu'), this.pauseMenuState);

        // One cursor, three lists: the worlds under one heading of the panel,
        // the start state under the next, and the options that hold whichever
        // world is flown under the last, all walked as though they were one.
        this.settingsMenu = new MenuList(
            document.getElementById('settings-menu'), this.settingsState,
            entry => entry.kind === ENVIRONMENT_ENTRY
        );
        this.settingsStart = new MenuList(
            document.getElementById('settings-start'), this.settingsState,
            entry => entry.kind === OPTION_ENTRY && entry.group === START_GROUP
        );
        this.settingsOptions = new MenuList(
            document.getElementById('settings-options'), this.settingsState,
            entry => entry.kind !== ENVIRONMENT_ENTRY && entry.group !== START_GROUP
        );

        this.setupKeys();
        this.applySettings();
        this.syncOverlays();
        this.loaded('instruments');

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        this.clock = new THREE.Clock();
        this.animate();
    }

    /** Reports a step of the start-up to the screen covering it. */
    loaded(step) {
        if (advanceLoading(this.loading, step)) this.loadingScreen.update(this.loading);
    }

    /**
     * Hands the settings the panel holds to the things they drive. Called once
     * at start-up so a stored choice is in force on the first frame, and again
     * whenever one of them is changed.
     */
    applySettings() {
        this.aircraft.setSensitivity(currentOption(this.settings, SENSITIVITY_OPTION));
        this.sky.setFogDensity(currentOption(this.settings, FOG_OPTION));
        this.hud.setUnits({
            speed:    currentOption(this.settings, SPEED_UNIT_OPTION),
            altitude: currentOption(this.settings, ALTITUDE_UNIT_OPTION)
        });

        // The start state is the condition the next flight opens in, so it is
        // handed over rather than flown into: an aircraft already in the air
        // keeps the flight it is in, and takes the new start at the next reset.
        // Before launch there is no flight to interrupt, so the aircraft is put
        // straight into it and the world behind the panel shows what was set.
        const start   = startSettings(this.settings);
        const changed = !sameStart(start, this.start);

        this.start = start;
        this.aircraft.setStart(flightStart(start));
        if (changed && titleShowing(this.titleState)) this.aircraft.reset();
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
        // A picture is of the world, whatever is over it, so the key that takes
        // one is read before the screens that would otherwise have swallowed it.
        if (applyPhotoKey(this.photoState, e.code, true, e.repeat)) {
            this.syncOverlays();
            return;
        }

        if (settingsShowing(this.settings)) {
            this.onSettingsKey(e);
            return;
        }

        if (isSettingsOpenKey(e.code) && !e.repeat) {
            this.openSettingsPanel();
            this.syncOverlays();
            return;
        }

        // The sound can be muted before the flight it would have been heard
        // over has begun.
        if (applyMuteKey(this.audioState, e.code, true, e.repeat)) {
            this.syncOverlays();
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
                // The key that started the flight is also the gesture a
                // browser wants before it will let the page make a sound.
                this.audio.start();
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
        // A picture is of the world, whatever is over it, so the key that takes
        // one is read ahead of the panel that is otherwise modal over the rest.
        if (applyPhotoKey(this.photoState, e.code, true, e.repeat)) {
            this.syncOverlays();
            return;
        }

        // The panel is modal over the flight behind it: nothing else reads a
        // key while it is open, so P cannot resume out from under it.
        if (settingsShowing(this.settings)) {
            this.onSettingsKey(e);
            return;
        }

        let changed = false;

        if (isSettingsOpenKey(e.code) && !e.repeat) {
            this.openSettingsPanel();
            changed = true;
        } else if (applyMuteKey(this.audioState, e.code, true, e.repeat)) {
            changed = true;
        } else if (applyPauseKey(this.pauseState, e.code, true, e.repeat)) {
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
        // The key that opens the panel closes it again, so O is a way in and
        // out rather than a one-way door.
        if (isSettingsCloseKey(e.code) || (isSettingsOpenKey(e.code) && !e.repeat)) {
            closeSettings(this.settings);
            this.syncOverlays();
            return;
        }

        // An option is stepped where a world is chosen, so the roll keys move
        // a setting along its own list rather than the cursor down the panel.
        if (isMenuAdjustKey(e.code)) {
            e.preventDefault();
            const adjusted = adjustSetting(this.settings, selectedId(this.settingsState), menuAdjustStep(e.code));
            if (adjusted) this.applySettings();
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

        if (!isEnvironmentId(applied)) {
            this.applySettings();
            return;
        }

        // A new world is a new flight: the aircraft goes back to the configured
        // start rather than carrying on inside a mountain that was not there
        // a moment ago.
        this.terrain.setEnvironment(applied);
        this.bounds = this.terrain.getBounds();
        this.hud.setBounds(this.bounds);
        this.aircraft.reset();
    }

    // Every overlay is placed from the state that drives it, in one pass, so
    // no two toggles can leave the screen in a state neither of them meant.
    syncOverlays() {
        // A picture is the world with nothing over it. While one is pending
        // every overlay comes off, so the screen the shutter falls on is the
        // frame that ends up in the file.
        const photo    = photoPending(this.photoState);
        const onTitle  = !photo && titleShowing(this.titleState);
        const settings = !photo && settingsShowing(this.settings);
        const paused   = !photo && !onTitle && this.pauseState.paused;
        const chrome   = !photo && !onTitle && !settings && this.hudVisibility.visible;
        // The panel is opened to look at the world behind it, so it is the one
        // overlay that clears the screen it was opened from.
        const help     = !settings && (chrome || (onTitle && this.titleHelp));

        this.overlays.title.style.display    = onTitle && !settings ? 'flex' : 'none';
        this.overlays.settings.style.display = settings ? 'block' : 'none';
        this.overlays.paused.style.display   = paused && !settings ? 'block' : 'none';
        this.overlays.hud.style.display      = chrome ? 'block' : 'none';
        this.overlays.attitude.style.display = chrome ? 'block' : 'none';
        this.overlays.minimap.style.display  = chrome ? 'block' : 'none';
        this.overlays.muted.style.display    = chrome && this.audioState.muted ? 'block' : 'none';
        this.overlays.help.style.display     = help ? 'block' : 'none';
        this.overlays.helpList.style.display = this.helpState.expanded ? 'block' : 'none';
        this.overlays.helpHint.style.display = this.helpState.expanded ? 'none' : 'block';

        // The control list sits under the instruments in the corner, so on the
        // start screen it has to be lifted over the title to be read at all.
        this.overlays.help.classList.toggle('over-title', onTitle);

        this.startMenu.render(this.startMenuState);
        this.pauseMenu.render(this.pauseMenuState);
        this.settingsMenu.render(this.settingsState);
        this.settingsStart.render(this.settingsState);
        this.settingsOptions.render(this.settingsState);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        // The clock is always read so the time spent frozen - paused, waiting
        // behind the title screen, or held under the settings panel - is
        // discarded rather than applied in one jump on the frame the
        // simulation runs again.
        const elapsed = this.clock.getDelta();
        const frozen  = titleShowing(this.titleState)
            || this.pauseState.paused
            || settingsShowing(this.settings);

        const dt = frozen ? 0 : preFlightDelta(this.titleState, simulationDelta(this.pauseState, elapsed));

        // The overlays came off when the key was pressed; the warnings the HUD
        // places itself go quiet the same way a frozen frame quiets them.
        const capturing = photoPending(this.photoState);

        const aircraftPos = this.aircraft.getPosition();
        const groundH     = this.terrain.getTerrainHeightAt(aircraftPos.x, aircraftPos.z);

        this.aircraft.update(dt, groundH);

        // The world has no outside: an aircraft that reaches an edge comes back
        // in over the opposite one. Carried before the camera is placed, so the
        // chase view cuts across with it rather than flying the width of the
        // world to catch up.
        this.aircraft.wrapInside(this.bounds);

        this.camera2.update(dt);
        this.sky.update();
        this.hud.update(this.aircraft, this.camera2, frozen || capturing);

        this.audio.update(audioLevels(this.audioState, {
            throttle: this.aircraft.getThrottle(),
            speed: this.aircraft.getSpeed(),
            maxSpeed: this.aircraft.maxSpeed,
            frozen
        }));

        this.renderer.render(this.scene, this.camera);

        // Read back inside the pass that drew it: a drawing buffer is cleared
        // once its frame has been composited, so a picture taken any later than
        // this would be a picture of nothing.
        if (capturing) this.takePhoto();

        // The screen over the page comes off on the strength of a frame that
        // has actually been drawn, rather than on a timer that would take it
        // off a black canvas.
        if (!loadingComplete(this.loading)) {
            this.loaded('frame');
            this.loadingScreen.finish();
        }
    }

    /**
     * Downloads the frame just drawn and puts the screen back. The request is
     * cleared whether or not the browser took the download, because a request
     * left pending would clear the overlays off every frame after it.
     */
    takePhoto() {
        savePhoto(this.renderer.domElement, photoFilename());
        completePhoto(this.photoState);
        this.syncOverlays();
    }
}

new FlightSimulator();
