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
    createMenuState, resetSelection, applyMenuKey, applyMenuPointer, isMenuKey, selectedId,
    isMenuAdjustKey, isMenuControlKey, menuAdjustStep, setMenuEntries,
    MenuList, followPointers, START_MENU_ENTRIES, PAUSE_MENU_ENTRIES
} from './menu.js';
import { createHelpState, applyHelpKey, expandHelp, toggleHelp } from './controls-help.js';
import {
    createHudVisibilityState, applyHudToggleKey, isHudToggleKey, defaultStorage
} from './hud-visibility.js';
import {
    createSettingsState, openSettings, closeSettings, settingsShowing,
    chooseSetting, adjustSetting, currentEnvironment, currentOption, startSettings,
    isSettingsCloseKey, isSettingsOpenKey,
    SETTINGS_BACK_ID, ENVIRONMENT_ENTRY, START_GROUP,
    SENSITIVITY_OPTION, ORBIT_RATE_OPTION, FOG_OPTION,
    SPEED_UNIT_OPTION, ALTITUDE_UNIT_OPTION
} from './settings.js';
import { runwayWanted } from './config.js';
import { headingDegrees } from './units.js';
import {
    createRunState, startRun, isRunning, runningMode, currentStage, advanceStage,
    restartStage, recordLanding, flyStep, nextGate, runObjective, runStatus,
    stageWorld, stageStart, buildCourse, runPointer, approachGuidance,
    tickRun, missNotice, isStageComplete, chartCourse, chartNext,
    nextStrip, burnFuel, fuelRemaining, engineLive, stageMarker, recordRescue,
    gameModeEntries, syncGameModeEntries, isGameModesCloseKey,
    FREE_FLIGHT_ID, GAME_MODES_BACK_ID, LOOP_OBJECTIVE, CARGO_OBJECTIVE
} from './game-modes.js';
import {
    scoreLanding, createRolloutState, beginRollout, clearRollout, updateRollout
} from './landing-score.js';
import {
    createBestTimesState, bestTime, recordStageTime, stageReport
} from './best-times.js';
import {
    createEditorState, setEditorWorld, editorShowing, openEditor, closeEditor,
    editorEntries, editorPlacements, chooseEditorEntry, adjustEditorRange,
    setEditorClearance, isEditorOpenKey, isEditorCloseKey, EDITOR_BACK_ID
} from './element-editor.js';
import { LoopCourse } from './rings.js';
import { ApproachGuidance } from './guidance.js';
import { RescueMarker } from './marker.js';
import { TILE_REACH } from './world-tiles.js';
import {
    createLoadingState, advanceLoading, loadingComplete, LoadingScreen
} from './loading.js';
import { createAudioState, applyMuteKey, audioLevels, FlightAudio } from './audio.js';
import {
    isTouchOnly, touchPads, TouchControls, TOUCH_LEFT, TOUCH_RIGHT
} from './touch-controls.js';
import {
    createTiltState, tiltFlying, tiltToInput, levelTilt, TiltSensor
} from './tilt-controls.js';
import {
    createPhotoState, applyPhotoKey, photoPending, completePhoto,
    photoFilename, savePhoto
} from './photo.js';

// Keys whose browser default would disturb the page behind the game: the
// focus ring walking off the canvas, or the page scrolling under it. Every
// other key, the reload key included, keeps whatever the browser does with it.
const SWALLOWED_KEYS = ['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

// How long a finished stage is left on screen before the next one is laid out,
// in seconds, so the pilot sees what they did rather than being moved on from
// it. Roughly the crash countdown, because both are the same beat: the flight
// has ended, and the next one has not begun yet.
const STAGE_HOLD = 2.5;

// How long a missed gate is reported for, in seconds, before the card goes
// back to the objective. Long enough to be read on the way past, and short
// enough to be gone by the time the pilot has turned round to try again.
const MISS_HOLD = 3;

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

        // The far plane is the reach the ground is laid to rather than a number
        // of its own. Everything the tile grid promises rests on the ground
        // running further than the camera can see, and two numbers that agree
        // only agree until one of them is changed on its own - which would put
        // the void edge back in frame with nothing to say it had.
        this.camera = new THREE.PerspectiveCamera(
            70,
            window.innerWidth / window.innerHeight,
            0.1,
            TILE_REACH
        );

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        document.getElementById('canvas-container').appendChild(this.renderer.domElement);
        this.loaded('scene');

        this.settings = createSettingsState(defaultStorage());

        // The world the settings panel is holding, as the elements it was
        // assembled from, so a range can be moved and the ground drawn again
        // from the algorithm rather than from another preset.
        this.editor = createEditorState(
            currentEnvironment(this.settings),
            runwayWanted(startSettings(this.settings))
        );

        // Free flight is the run every session opens in, so the first world is
        // the settings panel's rather than a mode's.
        this.run    = createRunState();
        this.course = [];
        this.runways = [];
        // Where the marker of a search stands, held rather than asked for every
        // frame: it is laid with the stage and does not move inside one.
        this.marker = null;

        // The board a finished stage is measured against, which outlives the
        // session it was flown in.
        this.bestTimes = createBestTimesState(defaultStorage());

        this.sky     = new Sky(this.scene);
        // The first world is built from the editor's elements as well, though
        // nobody has moved one yet: the ground is compared against what it was
        // asked for, and asking for the same world a second way would throw the
        // whole of it away and draw it again a tile at a time.
        this.terrain = new Terrain(this.scene, currentEnvironment(this.settings), {
            runway: runwayWanted(startSettings(this.settings)),
            elements: editorPlacements(this.editor)
        });
        this.loops   = new LoopCourse(this.scene);
        this.guidance = new ApproachGuidance(this.scene);
        this.beacon   = new RescueMarker(this.scene);
        // The square the world covers, held rather than asked for every frame:
        // it only changes when the world does.
        this.bounds  = this.terrain.getBounds();
        this.loaded('world');

        // A flight that resets - by the menu, by the R key, or by a crash - goes
        // back to the whole configured start, the view it opens in included, and
        // puts whatever stage was under way back to its beginning.
        this.aircraft = new Aircraft(this.scene, {
            onReset:   () => this.onFlightReset(),
            // The strip and the arrival are handed on rather than dropped: they
            // are everything the landing is scored from, and a handler that
            // took neither scored nothing and wrote no breakdown.
            onLanding: (runway, contact) => this.onLanding(runway, contact)
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
        this.editorState    = createMenuState(this.editor.entries);
        this.modesState     = createMenuState(gameModeEntries());
        this.helpState      = createHelpState();
        this.hudVisibility  = createHudVisibilityState(defaultStorage());
        this.audioState     = createAudioState(defaultStorage());
        this.audio          = new FlightAudio(this.audioState);
        this.photoState     = createPhotoState();

        // Whether this machine has to be flown from the glass, and so whether
        // the pads are drawn and the device's own attitude is read. Asked once:
        // a phone does not grow a keyboard halfway through a flight.
        this.touchOnly  = isTouchOnly();
        this.tilt       = createTiltState(this.touchOnly);
        this.tiltSensor = new TiltSensor(this.tilt);

        // Which controls the pads are currently drawn for, so the set is rebuilt
        // when the sensor comes to life rather than every frame it stays alive.
        this.padsTilted = null;

        // The start screen's Controls entry puts the control list on screen
        // over the title, where nothing else would have shown it yet.
        this.titleHelp = false;

        // The panel of modes, which is modal over whatever it was opened from
        // the same way the settings panel is.
        this.modesOpen = false;

        // What is left of the beat a finished stage is held for, what is left of
        // the beat a missed gate is reported for, and where the aircraft was
        // last frame, which is what a gate is tested against.
        this.stageHold = 0;
        this.missHold = 0;
        this.lastPosition = null;

        // What the stage just flown out came to, for as long as it is held on
        // the screen: the time it took, and whether it beat the board.
        this.stageResult = null;

        // A landing is not finished at the touchdown. What it came to is worked
        // out on the frame the wheels arrive and held until the aircraft has
        // stopped, which is when the pilot has somewhere to read it from.
        this.rollout = createRolloutState();
        this.landing = null;

        this.overlays = {
            title:     document.getElementById('title-screen'),
            paused:    document.getElementById('paused'),
            settings:  document.getElementById('settings'),
            editor:    document.getElementById('element-editor'),
            gameModes: document.getElementById('game-modes'),
            objective: document.getElementById('game-mode'),
            hud:       document.getElementById('hud'),
            attitude:  document.getElementById('attitude'),
            minimap:   document.getElementById('minimap'),
            muted:     document.getElementById('audio-muted'),
            help:      document.getElementById('controls-help'),
            helpList:  document.getElementById('controls-help-list'),
            helpHint:  document.getElementById('controls-help-hint'),
            touch:     document.getElementById('touch-controls')
        };

        // The pads write the same input state the keys do, which is what lets
        // the flight model stay ignorant of where a control came from.
        this.touch = new TouchControls(this.overlays.touch, this.aircraft.input, {
            [TOUCH_LEFT]:  document.getElementById('touch-cluster-left'),
            [TOUCH_RIGHT]: document.getElementById('touch-cluster-right')
        });

        this.startMenu    = new MenuList(document.getElementById('start-menu'), this.startMenuState);
        this.pauseMenu    = new MenuList(document.getElementById('pause-menu'), this.pauseMenuState);
        this.modesMenu    = new MenuList(document.getElementById('game-modes-menu'), this.modesState);
        this.editorMenu   = new MenuList(document.getElementById('element-editor-menu'), this.editorState);

        // Every menu on screen is worked with the mouse as well as the keys: the
        // cursor follows the pointer across the entries, and a click chooses the
        // one under it. The cards lie over the flight without taking the mouse
        // from it, so it is the menu on each that takes the pointer rather than
        // the card around it.
        this.startMenu.followPointer((index, choose) => this.onStartPointer(index, choose));
        this.pauseMenu.followPointer((index, choose) => this.onPausePointer(index, choose));
        this.modesMenu.followPointer((index, choose) => this.onGameModesPointer(index, choose));
        this.editorMenu.followPointer((index, choose, step) => this.onEditorPointer(index, choose, step));

        // One cursor, three lists: the worlds under one heading of the panel,
        // the start state under the next, and the options that hold whichever
        // world is flown under the last, all walked as though they were one.
        this.settingsMenu = new MenuList(
            document.getElementById('settings-menu'), this.settingsState,
            entry => entry.kind === ENVIRONMENT_ENTRY
        );
        this.settingsStart = new MenuList(
            document.getElementById('settings-start'), this.settingsState,
            entry => entry.kind !== ENVIRONMENT_ENTRY && entry.group === START_GROUP
        );
        this.settingsOptions = new MenuList(
            document.getElementById('settings-options'), this.settingsState,
            entry => entry.kind !== ENVIRONMENT_ENTRY && entry.group !== START_GROUP
        );

        // Three lists, one cursor, and so one pointer: an entry is reported by
        // its place in the whole panel rather than by its row in the list it was
        // drawn into, so the mouse and the keys walk the same panel.
        followPointers(
            [this.settingsMenu, this.settingsStart, this.settingsOptions],
            (index, choose, step) => this.onSettingsPointer(index, choose, step)
        );

        // The control list is the one thing the Controls entry puts on screen,
        // so it is also the way back off it for a pilot working the menus with
        // the mouse: clicking the list collapses it, and clicking what is left
        // opens it again.
        this.overlays.help.addEventListener('click', () => this.onHelpClick());

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
        this.syncEditor();
        this.aircraft.setSensitivity(currentOption(this.settings, SENSITIVITY_OPTION));
        this.camera2.setOrbitRate(currentOption(this.settings, ORBIT_RATE_OPTION));
        this.sky.setFogDensity(currentOption(this.settings, FOG_OPTION));
        this.hud.setUnits({
            speed:    currentOption(this.settings, SPEED_UNIT_OPTION),
            altitude: currentOption(this.settings, ALTITUDE_UNIT_OPTION)
        });

        this.refreshWorld();
    }

    /**
     * Puts the world and the start now asked for in force.
     *
     * A world that had to be rebuilt is a new flight whatever else was
     * happening: the ground the aircraft was over is not there any more. A
     * start that changed on its own is the next flight's rather than this one's,
     * so an aircraft already in the air keeps the flight it is in and takes the
     * new start at the next reset. Before launch there is no flight to
     * interrupt, so the aircraft is put straight into it and the world behind
     * the panel shows what was set.
     */
    refreshWorld() {
        const rebuilt = this.buildWorld();
        const flight  = this.buildStart();
        const changed = !sameStart(flight, this.start);

        this.start = flight;
        this.aircraft.setStart(flight);

        if (rebuilt || (changed && titleShowing(this.titleState))) this.aircraft.reset();
        this.syncEngine();
        this.syncObjective();
    }

    /**
     * Tells the aircraft whether it has an engine. Two modes take one away - a
     * dead stick from the first frame, a route the moment its budget runs out -
     * and the run works out which, because the aircraft has no business knowing
     * why the lever stopped doing anything.
     */
    syncEngine() {
        this.aircraft.setEngine(engineLive(this.run));
    }

    /**
     * Generates the ground the next flight is flown over: the stage's if a mode
     * is being played, and the settings panel's otherwise. A mode brings its
     * own world, which is why the panel's environment is not consulted while one
     * is under way.
     *
     * Returns true when the world was actually rebuilt.
     */
    buildWorld() {
        const mode  = runningMode(this.run);
        const world = mode ? stageWorld(this.run) : {
            environment: currentEnvironment(this.settings),
            runway: runwayWanted(startSettings(this.settings)),
            // A free flight is drawn from the elements the editor is holding
            // rather than from the preset directly, because those elements are
            // the preset until the pilot moves one of them.
            elements: editorPlacements(this.editor)
        };

        const rebuilt = this.terrain.setEnvironment(world.environment, world);
        if (rebuilt) {
            this.bounds = this.terrain.getBounds();
            this.hud.setBounds(this.bounds);
        }

        // The aircraft is told where the strips are rather than going looking,
        // because it does not know what it is flying over. Held here as well,
        // because a route reads them every frame to point at the one it is up
        // to, and they only change when the world does.
        this.runways = this.terrain.getRunways();
        this.aircraft.setRunways(this.runways);

        // And the editor is told which elements the strip was cut clear of, so
        // a range moved until it reached the runway reads as refused on its own
        // row rather than as a setting that did nothing.
        if (setEditorClearance(this.editor, this.terrain.getRunway()?.cleared)) {
            this.redrawEditor();
        }

        // A course is laid over the ground it is flown through, so it is built
        // from the world rather than beside it.
        this.course = mode?.objective === LOOP_OBJECTIVE
            ? buildCourse(currentStage(this.run), {
                seed: world.seed,
                size: this.terrain.size,
                sampleHeight: (x, z) => this.terrain.getTerrainHeightAt(x, z)
            })
            : [];
        this.loops.setRings(this.course);

        // The whole of what is being flown to is on the chart the moment it is
        // laid, rather than as it is reached: the first gate should not be the
        // only one the pilot has ever seen, and a route's strips and a search's
        // marker are drawn on the same terms. The chart is what a short screen
        // gives as its reason for taking the card's pointer row off, so a mode
        // it drew nothing for was a mode with no bearing left anywhere.
        this.hud.setCourse(chartCourse(this.run, {
            course: this.course,
            runways: this.runways
        }));

        // And the help a landing stage is given, drawn out over the ground it
        // is laid on rather than at the strip's own height, because the lead-in
        // leaves the graded strip behind after the first mark or two.
        this.drawGuidance();

        // The marker a search is flown to, if this stage has one. Laid on the
        // ground the same way the lead-in is, because it stands in open country
        // rather than on anything graded.
        this.marker = stageMarker(this.run);
        this.beacon.setMarker(this.marker, (x, z) => this.terrain.getTerrainHeightAt(x, z));

        return rebuilt;
    }

    /**
     * Draws the help for the strip the run is landing at next.
     *
     * A route moves between strips inside one stage, so this is drawn again
     * when a leg lands rather than only when the stage is laid out: the lead-in
     * belongs to the approach being flown, and a run that left it on the first
     * strip would be pointing the pilot back at the one they have left.
     */
    drawGuidance() {
        this.guidance.setGuidance(
            approachGuidance(this.run, this.legStrip()),
            (x, z) => this.terrain.getTerrainHeightAt(x, z)
        );
    }

    /**
     * The strip the run is landing at next: the one a route is up to, or the
     * only one there is. Null once a route is flown out, which is the guidance
     * coming off the ground the moment there is nothing left to approach.
     *
     * A route is asked separately from what it is up to, because `nextStrip`
     * answers -1 both for a route with nothing left and for every run that is
     * not a route at all. Reading the two as one is how the lead-in comes back
     * up at the first strip the moment the last one is landed at.
     */
    legStrip() {
        if (runningMode(this.run)?.objective !== CARGO_OBJECTIVE) return this.terrain.getRunway();

        const leg = nextStrip(this.run);
        return leg >= 0 ? (this.runways?.[leg] ?? null) : null;
    }

    /** The condition the next flight opens in, in the units the model works in. */
    buildStart() {
        const runway = this.terrain.getRunway();

        if (isRunning(this.run)) {
            const opening = stageStart(this.run, { runway, rings: this.course });
            return { ...flightStart(opening.start, { runway }), ...opening.position };
        }

        return flightStart(startSettings(this.settings), { runway });
    }

    /**
     * Writes the objective card and lights the gate the course is waiting on.
     * Called whenever the run moves rather than every frame, because what is
     * being asked for is not something that changes inside a stage.
     */
    syncObjective() {
        // The hoops are lit by the gate a course is up to; the chart is lit by
        // whichever mark the run is waiting on, which is that same gate for a
        // course and a strip or a marker for the modes that fly to those.
        this.loops.setNext(nextGate(this.run));
        this.hud.setNextMark(chartNext(this.run));

        const mode  = runningMode(this.run);
        const stage = currentStage(this.run);

        // The objective line is given up for two things, both of them shorter
        // lived than it and both of them more urgent while they last: a gate
        // gone by, and the time a stage just flown out came to. The objective
        // is written back the moment their beat runs out.
        const missed = this.missHold > 0 ? missNotice(this.run) : '';
        const report = this.stageHold > 0 ? stageReport(this.stageResult) : '';

        this.hud.setObjective(mode ? {
            name: mode.label,
            objective: missed || report || (this.run.complete ? 'MODE COMPLETE' : runObjective(this.run)),
            status: this.run.complete ? runStatus(this.run) : `${stage.label}  ·  ${runStatus(this.run)}`
        } : {});
    }

    /** True while something the pilot works with the menu keys is on screen. */
    menuShowing() {
        return this.modesOpen
            || settingsShowing(this.settings)
            || editorShowing(this.editor)
            || this.pauseState.paused;
    }

    setupKeys() {
        // A menu takes the keys that work it before the flight behind it can
        // read them, so walking a list never also pitches an aircraft. This
        // listener runs on the way down to the page, ahead of the aircraft's and
        // the camera's, which listen on the way back up.
        //
        // The start screen takes every key it sees, because there is no flight
        // yet for any of them to be part of. A menu over a flight takes only the
        // keys it works with - the same keys that fly the aircraft - and leaves
        // the rest to be read as they always were.
        window.addEventListener('keydown', (e) => {
            // A key held with a modifier is a browser shortcut rather than a
            // menu key, and is left to the browser
            if (e.ctrlKey || e.altKey || e.metaKey) return;

            const onTitle = titleShowing(this.titleState);
            if (!onTitle && !(this.menuShowing() && isMenuControlKey(e.code))) return;

            if (SWALLOWED_KEYS.includes(e.code)) e.preventDefault();
            if (onTitle) this.onStartKey(e);
            else this.onKeyDown(e);
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

        if (this.modesOpen) {
            this.onGameModesKey(e);
            return;
        }

        if (settingsShowing(this.settings)) {
            this.onSettingsKey(e);
            return;
        }

        if (editorShowing(this.editor)) {
            this.onEditorKey(e);
            return;
        }

        if (isSettingsOpenKey(e.code) && !e.repeat) {
            this.openSettingsPanel();
            this.syncOverlays();
            return;
        }

        // The world can be edited before the flight it will be flown over has
        // begun, which is the natural time to do it - unless a mode has been
        // chosen, which brings its own ground and leaves the editor nothing to
        // edit.
        if (isEditorOpenKey(e.code) && !e.repeat && !isRunning(this.run)) {
            this.openEditorPanel();
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
                // browser wants before it will let the page make a sound, and
                // the one Safari wants before it will report the device's
                // orientation. Neither ask is waited on: a refused sound is a
                // quiet flight, and a refused sensor is a flight flown from the
                // pads, which are on the glass until tilt reports otherwise.
                this.audio.start();
                this.tiltSensor.start().then(() => this.syncOverlays());
                break;
            case 'modes':
                this.openGameModesPanel();
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

    /**
     * The start menu under the mouse. The card is only on screen while the
     * flight is held on the ramp with no panel over it, so a pointer that
     * reaches an entry at all is a pointer over a menu that is being worked.
     */
    onStartPointer(index, choose) {
        const chosen = applyMenuPointer(this.startMenuState, index, choose);
        if (chosen) this.chooseStartEntry(chosen);
        this.syncOverlays();
    }

    onKeyDown(e) {
        // A picture is of the world, whatever is over it, so the key that takes
        // one is read ahead of the panels that are otherwise modal over the rest.
        if (applyPhotoKey(this.photoState, e.code, true, e.repeat)) {
            this.syncOverlays();
            return;
        }

        // A panel is modal over the flight behind it: nothing else reads a key
        // while one is open, so P cannot resume out from under it.
        if (this.modesOpen) {
            this.onGameModesKey(e);
            return;
        }

        if (settingsShowing(this.settings)) {
            this.onSettingsKey(e);
            return;
        }

        if (editorShowing(this.editor)) {
            this.onEditorKey(e);
            return;
        }

        let changed = false;

        if (isSettingsOpenKey(e.code) && !e.repeat) {
            this.openSettingsPanel();
            changed = true;
        } else if (isEditorOpenKey(e.code) && !e.repeat && !isRunning(this.run)) {
            // A mode brings its own ground with it, so there is nothing here
            // for the editor to be editing while one is being played.
            this.openEditorPanel();
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
            case 'modes':
                this.openGameModesPanel();
                break;
            case 'controls':
                expandHelp(this.helpState);
                break;
            case 'settings':
                this.openSettingsPanel();
                break;
        }
    }

    /**
     * The pause menu under the mouse. The card comes off the screen the moment
     * the flight resumes or a panel opens over it, which is the same answer the
     * key handler gets from a menu that is not there to be worked.
     */
    onPausePointer(index, choose) {
        const chosen = applyMenuPointer(this.pauseMenuState, index, choose);
        if (chosen) this.chooseMenuEntry(chosen);
        this.syncOverlays();
    }

    /**
     * The control list under the mouse. It is what the Controls entry puts on
     * screen, so it is also the way back off it: a click collapses the list to
     * its hint line and another opens it again, which is the H key's job for a
     * pilot working the menus with the keyboard.
     *
     * Over the title screen the list is not a toggle but a panel the start menu
     * opened, so a click there closes it the way choosing Controls again would.
     */
    onHelpClick() {
        if (titleShowing(this.titleState)) this.titleHelp = false;
        else toggleHelp(this.helpState);

        this.syncOverlays();
    }

    openSettingsPanel() {
        this.modesOpen = false;
        closeEditor(this.editor);
        openSettings(this.settings);
        resetSelection(this.settingsState);
    }

    /**
     * The settings panel under the mouse. Every choice the panel offers goes
     * through the same place a chosen entry does, so a click on a world picks
     * it, a click on an option steps it on, and a click on a box turns it over -
     * the same answers the keys get.
     *
     * An option is stepped the way the click reads: the left of the row moves
     * it down and the right moves it up, which is what the marks either side of
     * the reading say the row does.
     */
    onSettingsPointer(index, choose, step = 1) {
        const chosen = applyMenuPointer(this.settingsState, index, choose);
        if (chosen) this.chooseSettingsEntry(chosen, step);
        this.syncOverlays();
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

    chooseSettingsEntry(id, step = 1) {
        const applied = chooseSetting(this.settings, id, step);
        if (!applied || applied === SETTINGS_BACK_ID) return;

        // Every choice the panel offers goes back through the same place: the
        // world and the start are worked out from the run and the settings
        // together, so a new world resets the flight, a new start waits for
        // one, and nothing here has to know which kind of choice was made.
        this.applySettings();
    }

    // --- The element editor ----------------------------------------------

    /**
     * Puts the editor on the world the settings panel is holding, and draws its
     * rows again when that is a different world.
     *
     * Called wherever the settings are applied rather than only where the
     * environment is chosen, because the strip is part of what a world places
     * and the start state is what turns it on.
     */
    syncEditor() {
        const rebuilt = setEditorWorld(
            this.editor,
            currentEnvironment(this.settings),
            runwayWanted(startSettings(this.settings))
        );
        if (rebuilt) this.redrawEditor();
        return rebuilt;
    }

    /**
     * Draws the panel again from the rows it now has. The list is built rather
     * than redrawn because the editor is the one menu whose rows come and go:
     * opening an element adds its ranges to the panel under it.
     */
    redrawEditor() {
        setMenuEntries(this.editorState, this.editor.entries);
        this.editorMenu.rebuild(this.editorState);
    }

    openEditorPanel() {
        closeSettings(this.settings);
        this.modesOpen = false;
        openEditor(this.editor);
        this.redrawEditor();
        resetSelection(this.editorState);
    }

    onEditorKey(e) {
        // The key that opens the panel closes it again, the way O does the
        // settings panel.
        if (isEditorCloseKey(e.code) || (isEditorOpenKey(e.code) && !e.repeat)) {
            closeEditor(this.editor);
            this.syncOverlays();
            return;
        }

        // A range is stepped where an element is opened, so the roll keys move
        // a number along its own bounds rather than the cursor down the panel.
        if (isMenuAdjustKey(e.code)) {
            e.preventDefault();
            const moved = adjustEditorRange(this.editor, selectedId(this.editorState), menuAdjustStep(e.code));
            if (moved) this.applyEditor();
            this.syncOverlays();
            return;
        }

        if (!isMenuKey(e.code)) return;
        e.preventDefault();

        const chosen = applyMenuKey(this.editorState, e.code, true, e.repeat);
        if (chosen) this.chooseEditorRow(chosen);
        this.syncOverlays();
    }

    /**
     * The editor under the mouse. Every choice the panel offers goes through
     * the same place a chosen row does, so a click on an element opens it and a
     * click on a range steps it on - the same answers the keys get.
     *
     * A range moves the way the click reads: the left of the row moves it down
     * and the right moves it up, which is what the marks either side of the
     * reading say the row does.
     */
    onEditorPointer(index, choose, step = 1) {
        const chosen = applyMenuPointer(this.editorState, index, choose);
        if (chosen) this.chooseEditorRow(chosen, step);
        this.syncOverlays();
    }

    chooseEditorRow(id, step = 1) {
        const applied = chooseEditorEntry(this.editor, id, step);
        this.redrawEditor();

        if (applied && applied !== EDITOR_BACK_ID) this.refreshWorld();
    }

    /**
     * Draws the ground again from the elements the panel is now describing.
     * The world goes back through the same place every other world does, so an
     * edited environment is generated by the algorithm rather than patched into
     * the one already on screen.
     */
    applyEditor() {
        this.redrawEditor();
        this.refreshWorld();
    }

    // --- The modes -------------------------------------------------------

    openGameModesPanel() {
        closeSettings(this.settings);
        closeEditor(this.editor);
        this.modesOpen = true;
        resetSelection(this.modesState);
    }

    onGameModesKey(e) {
        if (isGameModesCloseKey(e.code)) {
            this.modesOpen = false;
            this.syncOverlays();
            return;
        }

        if (!isMenuKey(e.code)) return;
        e.preventDefault();

        const chosen = applyMenuKey(this.modesState, e.code, true, e.repeat);
        if (chosen) this.chooseGameMode(chosen);
        this.syncOverlays();
    }

    /**
     * The modes panel under the mouse. The panel is modal over whatever it was
     * opened from, so a pointer that reaches an entry is a pointer over the one
     * list being worked.
     */
    onGameModesPointer(index, choose) {
        const chosen = applyMenuPointer(this.modesState, index, choose);
        if (chosen) this.chooseGameMode(chosen);
        this.syncOverlays();
    }

    /**
     * Starts a mode, or stops the one being played. Either way it is a fresh
     * world and a fresh flight, so the panel closes behind it rather than
     * leaving the pilot looking at a list over the world they asked for.
     */
    chooseGameMode(id) {
        this.modesOpen = false;
        if (id === GAME_MODES_BACK_ID) return;

        const wanted = id === FREE_FLIGHT_ID ? null : id;
        if ((this.run.modeId ?? FREE_FLIGHT_ID) === (wanted ?? FREE_FLIGHT_ID)) return;

        startRun(this.run, wanted);
        this.stageHold = 0;
        this.refreshWorld();
        this.aircraft.reset();
    }

    /**
     * A reset is the stage starting again: the gates are all still to fly and
     * the landing is still to make, whether the reset came from the menu, the
     * reset key, or the end of a crash countdown.
     */
    onFlightReset() {
        this.camera2?.setMode(this.start?.cameraMode ?? INITIAL_CAMERA_MODE);
        this.lastPosition = null;
        this.missHold = 0;
        this.stageResult = null;
        this.clearLanding();

        // However the pilot has drifted into holding the device, that is level
        // for the flight that starts now.
        levelTilt(this.tilt);

        if (!isRunning(this.run) || this.run.complete) return;
        restartStage(this.run);

        // The budget goes back with the stage, so the engine a run had spent
        // comes back with it. Read from the run rather than assumed, because a
        // dead stick is still a dead stick on its second attempt.
        this.syncEngine();
        this.drawGuidance();
        this.syncObjective();
    }

    /**
     * A landing reported by the flight model, which a landing stage is asking
     * for. The objective is met on the touchdown - the clock stops there, and
     * the time is the one the approach was flown in - but the stage is not laid
     * away yet: what the landing came to is measured now and held until the
     * aircraft has rolled to a stop.
     */
    onLanding(runway, contact) {
        // The strip goes with the landing, because a route cares which one it
        // was made on: the objective is the order of the strips as much as the
        // arrivals on them, so a landing back at the one already behind the
        // pilot is somewhere to be rather than progress.
        if (recordLanding(this.run, runway)) {
            this.landing = scoreLanding(runway, contact);
            beginRollout(this.rollout);

            // The next leg is a different approach, so the help moves to the
            // strip it is flown to.
            this.drawGuidance();
        }
        this.syncObjective();
    }

    /**
     * Counts out the rollout, then reads the landing off. The wait ends when
     * the aircraft stops or when it is plain it is not going to, and either way
     * the breakdown goes up and the stage is finished from there.
     */
    trackLanding(dt) {
        if (!updateRollout(this.rollout, dt, this.aircraft.getSpeed())) return;

        this.hud.setLandingReport(this.landing);

        // A route is several landings and only the last of them ends anything.
        // The breakdown goes up either way - each arrival is worth reading -
        // but a leg with strips still to reach leaves the stage running, and
        // the pilot takes off again with the clock and the budget where they
        // left them.
        if (isStageComplete(this.run)) this.finishStage();
        this.syncObjective();
    }

    /** Takes a landing's breakdown back off the card, for the next attempt. */
    clearLanding() {
        clearRollout(this.rollout);
        this.landing = null;
        this.hud?.setLandingReport(null);
    }

    /**
     * A stage flown out: the clock stops, the time goes on the board, and the
     * stage is held on screen for a beat before the next one is laid out.
     *
     * The time recorded is what the clock read when the objective was met, so
     * neither the beat the stage is held for nor the pause menu opened halfway
     * down the course is part of it.
     */
    finishStage() {
        this.stageResult = recordStageTime(
            this.bestTimes, this.run.modeId, this.run.stageIndex, this.run.elapsed
        );
        this.holdStage();
    }

    /** Holds a finished stage on screen for a beat before laying out the next. */
    holdStage() {
        this.stageHold = STAGE_HOLD;
        this.missHold = 0;
    }

    /**
     * Lays the ground around the aircraft and takes the chart with it. The map
     * in the corner is drawn to the tile being flown over rather than to a world
     * that has no bounds to draw, so crossing into the next tile is a new square
     * on the chart rather than a marker pinned to an edge.
     */
    flyOver(position) {
        if (!this.terrain.focusOn(position.x, position.z)) return;

        this.bounds = this.terrain.getBounds();
        this.hud.setBounds(this.bounds);
    }

    /**
     * Puts the step the aircraft just flew to the course. What that step did to
     * the run is decided in `js/game-modes.js`, which holds the course rules;
     * what is here is the screen's answer to it.
     */
    trackCourse() {
        const position = this.aircraft.getPosition();

        if (nextGate(this.run) < 0 || !this.lastPosition) {
            this.lastPosition = position;
            return;
        }

        const step = flyStep(this.run, this.course, this.lastPosition, position);
        this.lastPosition = position;

        // The stage is finished before the card is written, so a card written
        // on the last gate of a stage carries the time it took.
        if (step.finished) this.finishStage();

        // A miss leaves the course waiting on the same gate, so nothing about
        // the run has moved. What the pilot gets is the one thing they were not
        // getting before: told.
        if (step.missed) this.missHold = MISS_HOLD;

        if (step.passed || step.missed) this.syncObjective();
    }

    /**
     * Runs the stage clock and the beat a missed gate is reported for, and
     * writes both onto the objective card.
     *
     * The clock is the one thing on that card that moves, so it is written
     * every frame while the rest of the card is written when the run does.
     */
    trackStage(dt) {
        tickRun(this.run, dt);

        // What the frame cost the budget, and what that leaves the engine. Only
        // an open throttle spends, so a leg glided with the lever closed is a
        // leg flown for nothing - which is the whole of what makes a route
        // worth planning rather than merely flying.
        burnFuel(this.run, this.aircraft.getThrottle(), dt);
        this.syncEngine();

        if (this.missHold > 0) {
            this.missHold = Math.max(0, this.missHold - dt);
            if (this.missHold === 0) this.syncObjective();
        }

        // The breakdown of a leg belongs to the ground it was read on. Once the
        // aircraft is up again it describes a landing the pilot has left
        // behind, so it comes off at the takeoff rather than at the next
        // arrival, which on a route is a long way further on.
        if (this.landing && this.aircraft.isAirborne()) this.clearLanding();

        this.hud.setClock(
            this.run.elapsed,
            isRunning(this.run) ? bestTime(this.bestTimes, this.run.modeId, this.run.stageIndex) : null,
            fuelRemaining(this.run)
        );

        this.hud.setRunPointer(runPointer(
            this.run,
            { course: this.course, runways: this.runways },
            this.aircraft.getPosition(),
            headingDegrees(this.aircraft.getHeading())
        ));
    }

    /**
     * Puts where the aircraft has come to rest to a search. Everything a
     * set-down has to be is decided in `js/game-modes.js`, which holds the rule;
     * what is here is reading the aircraft off and acting on the answer.
     *
     * Costs nothing outside a search, which has no marker to be beside.
     */
    trackRescue() {
        if (!this.marker) return;

        const position = this.aircraft.getPosition();
        const found = recordRescue(this.run, this.marker, {
            x: position.x,
            z: position.z,
            speed: this.aircraft.getSpeed(),
            airborne: this.aircraft.isAirborne(),
            crashed: this.aircraft.isCrashed()
        });

        if (!found) return;

        this.finishStage();
        this.syncObjective();
    }

    /** Counts down the beat a finished stage is held for, then lays out the next. */
    advanceRun(dt) {
        if (this.stageHold <= 0) return;

        this.stageHold = Math.max(0, this.stageHold - dt);
        if (this.stageHold > 0) return;

        this.stageResult = null;
        this.clearLanding();
        if (advanceStage(this.run)) this.refreshWorld();
        else this.syncObjective();
    }

    // Every overlay is placed from the state that drives it, in one pass, so
    // no two toggles can leave the screen in a state neither of them meant.
    syncOverlays() {
        // A picture is the world with nothing over it. While one is pending
        // every overlay comes off, so the screen the shutter falls on is the
        // frame that ends up in the file.
        const photo    = photoPending(this.photoState);
        const onTitle  = !photo && titleShowing(this.titleState);
        const modes    = !photo && this.modesOpen;
        const settings = !photo && !modes && settingsShowing(this.settings);
        const editor   = !photo && !modes && !settings && editorShowing(this.editor);
        const panel    = modes || settings || editor;
        const paused   = !photo && !onTitle && this.pauseState.paused;
        const chrome   = !photo && !onTitle && !panel && this.hudVisibility.visible;
        // The pads belong to a flight being flown, the same as the instruments,
        // and to a machine with no keys to fly it with. Taking them off lets go
        // of whatever they were holding, which is why a pause takes them off
        // rather than leaving a control held under a menu.
        const pads     = chrome && !paused && this.touchOnly;
        // A panel is opened to look at the world behind it, so it is the one
        // overlay that clears the screen it was opened from. The pads clear it
        // too, for the corner they take and because the list names keys a
        // machine being flown from the glass does not have - though the entry
        // on the start screen still shows it, there being no pads out yet.
        const help     = !panel && !pads && (chrome || (onTitle && this.titleHelp));

        this.overlays.title.style.display     = onTitle && !panel ? 'flex' : 'none';
        this.overlays.settings.style.display  = settings ? 'block' : 'none';
        this.overlays.editor.style.display    = editor ? 'block' : 'none';
        this.overlays.gameModes.style.display = modes ? 'block' : 'none';
        this.overlays.paused.style.display    = paused && !panel ? 'block' : 'none';
        this.overlays.hud.style.display       = chrome ? 'block' : 'none';
        this.overlays.attitude.style.display  = chrome ? 'block' : 'none';
        this.overlays.minimap.style.display   = chrome ? 'block' : 'none';
        this.overlays.muted.style.display     = chrome && this.audioState.muted ? 'block' : 'none';
        this.overlays.help.style.display      = help ? 'block' : 'none';
        this.overlays.helpList.style.display  = this.helpState.expanded ? 'block' : 'none';
        this.overlays.helpHint.style.display  = this.helpState.expanded ? 'none' : 'block';

        // The objective card belongs to a flight being played rather than to
        // one being flown, so a free flight never carries it.
        this.overlays.objective.style.display = chrome && isRunning(this.run) ? 'block' : 'none';

        // The control list sits under the instruments in the corner, so on the
        // start screen it has to be lifted over the title to be read at all.
        this.overlays.help.classList.toggle('over-title', onTitle);

        // The pads take the bottom corners, so the two overlays that were in
        // them move to the top of the screen for as long as the pads are out -
        // and the readouts drop below the two instruments now sharing that top,
        // rather than being drawn over by the ladder that moved into them.
        this.syncTouchPads(pads);
        this.overlays.attitude.classList.toggle('floated', pads);
        this.overlays.muted.classList.toggle('floated', pads);
        this.overlays.hud.classList.toggle('floated', pads);
        // The objective card is centred and the pads are not, so it cleared
        // them for as long as it only carried an instruction. The landing
        // breakdown made it tall enough to reach into the band they take, and
        // they paint over it, so it is lifted the depth of that band too.
        this.overlays.objective.classList.toggle('floated', pads);

        syncGameModeEntries(this.modesState.entries, this.run);

        this.startMenu.render(this.startMenuState);
        this.pauseMenu.render(this.pauseMenuState);
        this.modesMenu.render(this.modesState);
        this.settingsMenu.render(this.settingsState);
        this.settingsStart.render(this.settingsState);
        this.settingsOptions.render(this.settingsState);
        this.editorMenu.render(this.editorState);
    }

    /**
     * Draws the pads the flight wants and puts them on screen or takes them off.
     *
     * The set is rebuilt only when tilt changes hands, because the sensor coming
     * to life is what decides whether pitch and roll are flown off the glass or
     * off the device itself - and that happens once, some frames after the
     * flight has begun, rather than on any frame anything else changes.
     */
    syncTouchPads(visible) {
        const tilted = tiltFlying(this.tilt);

        if (tilted !== this.padsTilted) {
            this.padsTilted = tilted;
            this.touch.setPads(touchPads(tilted));
        }

        this.touch.setVisible(visible);
    }

    /**
     * Hands the device's own attitude to the aircraft. Nothing at all where the
     * sensor is not reporting, which is every machine that has keys and every
     * one that refused the sensor: the input state belongs to whatever is
     * writing it, and tilt does not take it away from the keys by turning up.
     */
    trackTilt(frozen) {
        // The pads that tilt replaces come off the moment it starts reporting,
        // which is a frame nothing else has any reason to notice.
        if (tiltFlying(this.tilt) !== this.padsTilted) this.syncOverlays();
        if (!frozen) tiltToInput(this.aircraft.input, this.tilt);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        // The clock is always read so the time spent frozen - paused, waiting
        // behind the title screen, or held under a panel - is discarded rather
        // than applied in one jump on the frame the simulation runs again.
        const elapsed = this.clock.getDelta();
        const frozen  = titleShowing(this.titleState)
            || this.pauseState.paused
            || settingsShowing(this.settings)
            || editorShowing(this.editor)
            || this.modesOpen;

        const dt = frozen ? 0 : preFlightDelta(this.titleState, simulationDelta(this.pauseState, elapsed));

        // The overlays came off when the key was pressed; the warnings the HUD
        // places itself go quiet the same way a frozen frame quiets them.
        const capturing = photoPending(this.photoState);

        const aircraftPos = this.aircraft.getPosition();
        const groundH     = this.terrain.getTerrainHeightAt(aircraftPos.x, aircraftPos.z);

        // Read before the frame is flown, so the attitude the device is being
        // held at is the attitude this frame is flown in.
        this.trackTilt(frozen);

        this.aircraft.update(dt, groundH);

        // The world has no end to it: the ground is laid on ahead of the
        // aircraft as it flies, out past everything the camera can see, so the
        // edge the fog used to be hiding is never there to be reached. Drawn
        // before the camera is placed, so the chase view never swings out over
        // ground that has not been laid yet.
        this.flyOver(this.aircraft.getPosition());

        this.trackCourse();
        this.trackStage(dt);
        this.trackLanding(dt);
        this.trackRescue();
        this.advanceRun(dt);

        this.camera2.update(dt);

        // The day moves on and the water moves with it: what the surface has to
        // throw back is whatever the sky is giving it at that hour.
        this.sky.update(dt);
        this.terrain.updateWater(dt, this.sky.getDaylight());

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
