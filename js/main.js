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
import {
    createControlSettingsState, openControlSettings, closeControlSettings,
    controlSettingsShowing, chooseControlSetting, adjustControlSetting,
    controlAxes, fullRotationWanted, isControlSettingsCloseKey,
    CONTROL_SETTINGS_BACK_ID, CONTROL_REFERENCE_ID, AXIS_GROUP, ATTITUDE_GROUP
} from './control-settings.js';
import { runwayWanted } from './config.js';
import { headingDegrees, altitudeToFeet, feetToAltitude } from './units.js';
import {
    createRunState, startRun, isRunning, runningMode, currentStage, advanceStage,
    restartStage, recordLanding, flyStep, nextGate, runObjective, runStatus,
    stageWorld, stageStart, buildCourse, runPointer, approachGuidance,
    tickRun, missNotice, isStageComplete, chartCourse, chartNext,
    nextStrip, burnFuel, fuelRemaining, engineLive, stageMarker, recordRescue,
    gameModeEntries, syncGameModeEntries, isGameModesCloseKey, openingRun,
    stagePattern, stageLandmarks, stageReaches, flyPattern, nextLeg,
    flyCorridor, nextSection, recordPhoto, nextLandmark,
    runBrief, faultNotice, shotNotice, legNotice, circuitNotice,
    FREE_FLIGHT_ID, GAME_MODES_BACK_ID, LOOP_OBJECTIVE, CARGO_OBJECTIVE,
    PATTERN_OBJECTIVE, CORRIDOR_OBJECTIVE, SURVEY_OBJECTIVE
} from './game-modes.js';
import {
    createPatternState, resetPattern, samplePattern, completeLeg, patternScore,
    FINAL_LEG
} from './pattern.js';
import { buildCorridor } from './corridor.js';
import { rangeBand } from './survey.js';
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
import { CanyonWalls } from './walls.js';
import { ApproachGuidance } from './guidance.js';
import { RescueMarker, MAST_HEIGHT } from './marker.js';
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

        // What the keys mean and how far the attitude may go, which is the
        // Control Settings entry's panel. Held apart from the settings panel
        // because they are a different question and remembered under a key of
        // their own: how a pilot flies outlives which world they were flying.
        this.controlSettings = createControlSettingsState(defaultStorage());

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
        // And the three the newer modes are flown to, held for the same
        // reason: a circuit, a corridor and a list of landmarks are all laid
        // with the stage and none of them moves inside one.
        this.circuit   = [];
        this.corridor  = [];
        this.landmarks = [];
        // How each leg of a circuit has been held so far. Kept beside the run
        // the way a rollout is, because it is one mode's working rather than
        // something every mode reads.
        this.pattern = createPatternState();

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
        this.walls    = new CanyonWalls(this.scene);
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
        this.controlState   = createMenuState(this.controlSettings.entries);
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
        // The beat the objective line is given up for, and what it is given up
        // to say. One timer rather than one per mode: a missed gate, a cut
        // flown over the top of, a shot outside its window and a leg just held
        // are all the same thing to the card - something that just happened,
        // worth a moment of the row the objective is usually in.
        this.noticeHold = 0;
        this.notice = '';
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
            controls:  document.getElementById('control-settings'),
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

        // And the control panel the same way: the axes under one heading, the
        // attitude under the next, and the reference list and the way out under
        // the last, walked as the one list the cursor already treats them as.
        this.controlAxesMenu = new MenuList(
            document.getElementById('control-settings-axes'), this.controlState,
            entry => entry.group === AXIS_GROUP
        );
        this.controlAttitudeMenu = new MenuList(
            document.getElementById('control-settings-attitude'), this.controlState,
            entry => entry.group === ATTITUDE_GROUP
        );
        this.controlReferenceMenu = new MenuList(
            document.getElementById('control-settings-reference'), this.controlState,
            entry => entry.group !== AXIS_GROUP && entry.group !== ATTITUDE_GROUP
        );

        followPointers(
            [this.controlAxesMenu, this.controlAttitudeMenu, this.controlReferenceMenu],
            (index, choose, step) => this.onControlSettingsPointer(index, choose, step)
        );

        // The control list is what the panel's Control Reference row puts on
        // screen, so it is also the way back off it for a pilot working the
        // menus with the mouse: clicking the list collapses it, and clicking
        // what is left opens it again.
        this.overlays.help.addEventListener('click', () => this.onHelpClick());

        this.setupKeys();
        this.applySettings();
        this.applyControlSettings();

        // And then whatever the address asked for, which is the one way into a
        // stage past the first. It goes after the settings because it builds a
        // world of its own over the one they just built.
        this.openRequestedRun(window.location.search);

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

        // A corridor is laid over the ground the same way, and for the same
        // reason: its ceiling is held a height over whatever is underneath, so
        // it cannot be worked out until the ground it is laid on has been.
        this.corridor = mode?.objective === CORRIDOR_OBJECTIVE
            ? buildCorridor(currentStage(this.run), {
                seed: world.seed,
                size: this.terrain.size,
                sampleHeight: (x, z) => this.terrain.getTerrainHeightAt(x, z)
            })
            : [];
        this.walls.setCorridor(this.corridor);

        // The circuit is laid off the strip rather than over the ground, so it
        // waits on the runway the world put down rather than on the terrain.
        this.circuit = stagePattern(this.run, this.terrain.getRunway());
        resetPattern(this.pattern, Math.max(this.circuit.length, 1));

        this.landmarks = stageLandmarks(this.run);

        // The whole of what is being flown to is on the chart the moment it is
        // laid, rather than as it is reached: the first gate should not be the
        // only one the pilot has ever seen, and a route's strips and a search's
        // marker are drawn on the same terms. The chart is what a short screen
        // gives as its reason for taking the card's pointer row off, so a mode
        // it drew nothing for was a mode with no bearing left anywhere.
        this.hud.setCourse(chartCourse(this.run, this.runWorld()));

        // And the help a landing stage is given, drawn out over the ground it
        // is laid on rather than at the strip's own height, because the lead-in
        // leaves the graded strip behind after the first mark or two.
        this.drawGuidance();

        // The marker a search is flown to, if this stage has one. Laid on the
        // ground the same way the lead-in is, because it stands in open country
        // rather than on anything graded.
        // The marker a search is flown to, the landmarks a survey works
        // through, and the turns a circuit is flown round all stand in open
        // country on a mast, so one call draws whichever of them this stage
        // has. A turn carries no circle and stands to the height its leg is
        // flown at; a landmark carries the two circles its range band is.
        this.marker = stageMarker(this.run);
        this.beacon.setMarkers(this.standingMarks(),
            (x, z) => this.terrain.getTerrainHeightAt(x, z));

        return rebuilt;
    }

    /**
     * The things this stage puts on a mast: a search's marker, a survey's
     * landmarks, or a circuit's turns. One list, because they are drawn by one
     * renderer, and the differences between them are what each carries rather
     * than how many of them there are.
     *
     * A landmark carries the two circles its range band is drawn as - the band
     * is the one of its three readings that is a place, so it is put on the
     * ground rather than on the card. A turn carries no circle and a mast as
     * tall as the height its leg wants, which is the one thing about a place
     * in empty air that cannot be read off the country under it.
     *
     * Which is the reason only three of a circuit's five turns get one. The
     * takeoff and the final end on the strip's own thresholds, where there is
     * nothing in empty air to mark: the strip is drawn, and the approach
     * guidance already marks the end being landed on. A mast there stood on
     * the runway, at the place the takeoff roll ends and the place the landing
     * is flown onto. Each mark carries the leg it stands for, because the run
     * counts in legs and this list no longer has one entry per leg.
     */
    standingMarks() {
        if (this.marker) return [this.marker];

        if (this.landmarks.length) {
            return this.landmarks.map(landmark => {
                const band = rangeBand(landmark);
                return {
                    x: landmark.x,
                    z: landmark.z,
                    mast: MAST_HEIGHT + landmark.height,
                    radius: band?.far ?? 0,
                    inner: band?.near ?? 0
                };
            });
        }

        return this.circuit.filter(leg => !leg.onStrip).map(leg => ({
            at: leg.index,
            x: leg.x,
            z: leg.z,
            mast: Math.max(
                feetToAltitude(leg.altitudeFeet) - this.terrain.getTerrainHeightAt(leg.x, leg.z),
                MAST_HEIGHT
            )
        }));
    }

    /**
     * Everything the run is flown to, as the one object the mode's own rules
     * read it off. Built here because this is where all of it is held, and
     * handed over whole rather than a piece at a time: a pointer, a chart and
     * a brief are three readings of the same world.
     */
    runWorld() {
        return {
            course: this.course,
            runways: this.runways,
            corridor: this.corridor,
            circuit: this.circuit,
            landmarks: this.landmarks
        };
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
            const opening = stageStart(this.run, {
                runway, rings: this.course, corridor: this.corridor,
                // A run opens a spacing back from its first cut, over ground
                // that is not the ground under the cut, so the opening height
                // wants the terrain as well as the corridor.
                sampleHeight: (x, z) => this.terrain.getTerrainHeightAt(x, z)
            });

            // A circuit opens on the strip and hands over no place, because
            // the takeoff start already put the aircraft on the threshold.
            // Spreading an absent position over that would be spreading
            // nothing; spreading a second answer would be worse.
            const start = flightStart(opening.start, { runway });
            return opening.position ? { ...start, ...opening.position } : start;
        }

        return flightStart(startSettings(this.settings), { runway });
    }

    /**
     * Writes the objective card and lights the gate the course is waiting on.
     * Called whenever the run moves rather than every frame, because what is
     * being asked for is not something that changes inside a stage.
     */
    syncObjective() {
        // The hoops, the corridor and the masts are each lit by the mark the
        // run is waiting on, and so is the chart. Every one of them is told
        // the same index, so what is lit in the world, what is lit on the
        // chart and what is named on the card are one answer.
        const next = chartNext(this.run);
        this.loops.setNext(nextGate(this.run));
        this.walls.setNext(nextSection(this.run));
        this.beacon.setNext(next);
        this.hud.setNextMark(next);

        const mode  = runningMode(this.run);
        const stage = currentStage(this.run);

        // The objective line is given up for two things, both of them shorter
        // lived than it and both of them more urgent while they last: a notice
        // about what just happened, and the time a stage just flown out came
        // to. The objective is written back the moment their beat runs out.
        const notice = this.noticeHold > 0 ? this.notice : '';
        const report = this.stageHold > 0 ? stageReport(this.stageResult) : '';

        // And what the objective is, for the two modes whose objective moves
        // inside a stage: a circuit asks for a different height and heading on
        // every leg, and a survey for a different landmark on every shot.
        const asking = this.run.complete ? 'MODE COMPLETE' : runBrief(this.run, this.runWorld());

        this.hud.setObjective(mode ? {
            name: mode.label,
            objective: notice || report || asking,
            status: this.run.complete ? runStatus(this.run) : `${stage.label}  ·  ${runStatus(this.run)}`
        } : {});
    }

    /** True while something the pilot works with the menu keys is on screen. */
    menuShowing() {
        return this.modesOpen
            || settingsShowing(this.settings)
            || controlSettingsShowing(this.controlSettings)
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

        if (controlSettingsShowing(this.controlSettings)) {
            this.onControlSettingsKey(e);
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
                // The same entry the pause menu carries, opening the same panel.
                // The reference list it used to show is a row inside that panel
                // now, so the entry answers "what do I want the keys to do" and
                // the list it opens answers "which key does what".
                this.openControlSettingsPanel();
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

        if (controlSettingsShowing(this.controlSettings)) {
            this.onControlSettingsKey(e);
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
                this.openControlSettingsPanel();
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
     * opened, so a click there closes it the way choosing the Control Reference
     * row again would.
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

    // --- The control settings panel ---------------------------------------

    openControlSettingsPanel() {
        this.modesOpen = false;
        closeSettings(this.settings);
        closeEditor(this.editor);
        openControlSettings(this.controlSettings);
        resetSelection(this.controlState);
    }

    /**
     * Hands what the control panel holds to the things they drive. Called once at
     * start-up so a stored choice is in force on the first frame, and again
     * whenever one of them is changed.
     *
     * Nothing here touches the world or the start state, which is why it is its
     * own step rather than part of `applySettings`: an axis turned over should
     * not rebuild the ground under the aircraft.
     */
    applyControlSettings() {
        this.aircraft.setAxes(controlAxes(this.controlSettings));
        this.aircraft.setFullRotation(fullRotationWanted(this.controlSettings));
    }

    /**
     * The control panel under the mouse, read the way the settings panel's rows
     * are: the left of a row steps its value down and the right steps it up.
     */
    onControlSettingsPointer(index, choose, step = 1) {
        const chosen = applyMenuPointer(this.controlState, index, choose);
        if (chosen) this.chooseControlSettingsEntry(chosen, step);
        this.syncOverlays();
    }

    onControlSettingsKey(e) {
        if (isControlSettingsCloseKey(e.code)) {
            closeControlSettings(this.controlSettings);
            this.syncOverlays();
            return;
        }

        // An axis is stepped where a row is chosen, so the roll keys move a
        // setting along its own list rather than the cursor down the panel.
        if (isMenuAdjustKey(e.code)) {
            e.preventDefault();
            const adjusted = adjustControlSetting(
                this.controlSettings, selectedId(this.controlState), menuAdjustStep(e.code)
            );
            if (adjusted) this.applyControlSettings();
            this.syncOverlays();
            return;
        }

        if (!isMenuKey(e.code)) return;
        e.preventDefault();

        const chosen = applyMenuKey(this.controlState, e.code, true, e.repeat);
        if (chosen) this.chooseControlSettingsEntry(chosen);
        this.syncOverlays();
    }

    chooseControlSettingsEntry(id, step = 1) {
        const applied = chooseControlSetting(this.controlSettings, id, step);
        if (!applied || applied === CONTROL_SETTINGS_BACK_ID) return;

        // The reference list is read against the world rather than against the
        // panel, so the panel has already closed itself by here and all that is
        // left is to put the list on screen. Over a flight it is the list the H
        // key collapses, opened back up.
        //
        // On the start screen the row is also the way back off the list, which
        // is why it turns it over rather than only opening it: there is no
        // flight yet for the H key to be part of, so a list that only ever went
        // on would be one a pilot working the menus from the keyboard could not
        // take off again.
        if (applied === CONTROL_REFERENCE_ID) {
            if (titleShowing(this.titleState)) {
                this.titleHelp = !this.titleHelp;
                if (this.titleHelp) expandHelp(this.helpState);
                return;
            }

            expandHelp(this.helpState);
            return;
        }

        this.applyControlSettings();
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
     * Opens the run the address asked for - `?mode=cargo-run&stage=2` opens
     * that route's second stage on the first frame, with nothing flown before
     * it. That is what lets a check read a later stage at all: the stages of a
     * route stand thousands of units apart, and an arrival cannot be handed to
     * the app from outside while the aircraft is flying.
     *
     * A request that cannot be honoured opens nothing and says why on the
     * console. Opening the nearest stage instead would hand a check a stage it
     * did not ask for and no way to tell.
     */
    openRequestedRun(search) {
        const request = openingRun(search);
        if (!request) return;

        if (request.problem) {
            console.warn(`Ignoring the run asked for on the address: ${request.problem}`);
            return;
        }

        // The same three steps the panel takes, because it is the same thing
        // happening: a fresh world under a fresh flight.
        startRun(this.run, request.modeId, request.stageIndex);
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
        this.noticeHold = 0;
        this.notice = '';
        this.stageResult = null;
        this.clearLanding();

        // However the pilot has drifted into holding the device, that is level
        // for the flight that starts now.
        levelTilt(this.tilt);

        if (!isRunning(this.run) || this.run.complete) return;
        restartStage(this.run);

        // The circuit is flown again from the takeoff, so what was held on
        // each leg of the last attempt goes with it. A stage flown twice is
        // scored as the attempt that finished it, the way the clock is.
        resetPattern(this.pattern, Math.max(this.circuit.length, 1));

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

            // A circuit's last leg is the one no turn can close: final ends at
            // the threshold, and the pilot crosses that threshold on every
            // go-around they fly, so `recordPatternLeg` refuses it. The
            // landing is what closes it instead - the approach is read against
            // its height and heading every frame it is flown, the same as the
            // other four, and closing it here is what turns that reading into
            // the mark the pilot is shown rather than a tally nothing reads.
            this.closeFinalLeg();

            // The next leg is a different approach, so the help moves to the
            // strip it is flown to.
            this.drawGuidance();
        }
        this.syncObjective();
    }

    /**
     * Closes the final leg of a circuit, if a circuit is what was landed.
     *
     * Costs nothing for every other landing mode: a route and a landing stage
     * have no circuit, so there is no final leg to close.
     */
    closeFinalLeg() {
        const leg = this.circuit[FINAL_LEG];
        if (!leg) return;

        const flown = completeLeg(this.pattern, leg, stageReaches(this.run));

        // Closed before the mark for the whole is read, because the circuit is
        // five legs and this is the fifth: a score read first would be the
        // circuit without its own last leg in it.
        this.holdNotice(circuitNotice(flown, patternScore(this.pattern)));
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
        this.noticeHold = 0;
        this.notice = '';
    }

    /**
     * Gives the objective row up for a beat to say what just happened. An
     * empty notice is nothing happening, which leaves whatever is there.
     */
    holdNotice(text) {
        if (!text) return;
        this.notice = text;
        this.noticeHold = MISS_HOLD;
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
        const from = this.lastPosition;
        this.lastPosition = position;
        if (!from) return;

        // Three modes are flown as a line crossed rather than a place reached,
        // and all three are read off the same step. Which of them this is has
        // already been decided by the run - each of these answers nothing at
        // all outside its own mode - so the step is simply put to all three.
        this.trackGates(from, position);
        this.trackCuts(from, position);
        this.trackLegs(from, position);
    }

    /** The step put to the course of loops, if that is what is being flown. */
    trackGates(from, to) {
        if (nextGate(this.run) < 0) return;

        const step = flyStep(this.run, this.course, from, to);

        // The stage is finished before the card is written, so a card written
        // on the last gate of a stage carries the time it took.
        if (step.finished) this.finishStage();

        // A miss leaves the course waiting on the same gate, so nothing about
        // the run has moved. What the pilot gets is the one thing they were not
        // getting before: told.
        if (step.missed) this.holdNotice(missNotice(this.run));

        if (step.passed || step.missed) this.syncObjective();
    }

    /** The step put to the corridor, if a canyon run is being flown. */
    trackCuts(from, to) {
        if (nextSection(this.run) < 0) return;

        const step = flyCorridor(this.run, this.corridor, from, to);

        if (step.finished) this.finishStage();

        // A cut reached over the lid or wide of a wall leaves the run waiting
        // on it, exactly as a missed gate does. The pilot is told which of the
        // two it was, because coming back down and coming back in are
        // different corrections.
        if (step.faulted) this.holdNotice(faultNotice(this.run, step.fault));

        if (step.passed || step.faulted) this.syncObjective();
    }

    /**
     * The step put to the circuit, if a pattern is being flown.
     *
     * A leg is closed here rather than where it is read, because the turn is
     * the moment the reading stops: everything after it belongs to the next
     * leg and is held against that one's height and heading instead.
     */
    trackLegs(from, to) {
        const index = nextLeg(this.run);
        if (index < 0) return;

        const step = flyPattern(this.run, this.circuit, from, to);
        if (!step.turned) return;

        this.holdNotice(legNotice(completeLeg(this.pattern, this.circuit[index], stageReaches(this.run))));
        this.syncObjective();
    }

    /**
     * Reads the aircraft against the leg of the circuit it is on, for one
     * frame. Costs nothing outside a pattern, which has no circuit to be on a
     * leg of.
     */
    trackPattern(dt) {
        const leg = this.circuit[nextLeg(this.run)];
        if (!leg) return;

        const position = this.aircraft.getPosition();
        samplePattern(this.pattern, leg, {
            x: position.x,
            z: position.z,
            altitudeFeet: altitudeToFeet(this.aircraft.getAltitude()),
            headingDegrees: headingDegrees(this.aircraft.getHeading())
        }, dt);
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

        // And what the frame did to the leg being flown. A circuit is scored
        // on the whole of each leg rather than on the turn at the end of it,
        // so the reading is taken every frame and closed at the turn.
        this.trackPattern(dt);

        if (this.noticeHold > 0) {
            this.noticeHold = Math.max(0, this.noticeHold - dt);
            if (this.noticeHold === 0) this.syncObjective();
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
            this.runWorld(),
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
        const controls = !photo && !modes && !settings && controlSettingsShowing(this.controlSettings);
        const editor   = !photo && !modes && !settings && !controls && editorShowing(this.editor);
        const panel    = modes || settings || controls || editor;
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
        this.overlays.controls.style.display  = controls ? 'block' : 'none';
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
        this.controlAxesMenu.render(this.controlState);
        this.controlAttitudeMenu.render(this.controlState);
        this.controlReferenceMenu.render(this.controlState);
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
        this.surveyPhoto();
        this.syncOverlays();
    }

    /**
     * Puts the shutter to a survey. The picture has already been taken and
     * saved by the time this runs, and that is the order on purpose: the
     * camera belongs to the pilot, and a mode that swallowed a photograph for
     * being of the wrong thing would be a mode that broke it.
     *
     * Everything about whether it counted is decided in `js/game-modes.js`,
     * which holds the window; what is here is reading the aircraft off and
     * saying what came of it.
     */
    surveyPhoto() {
        if (nextLandmark(this.run) < 0) return;

        const position = this.aircraft.getPosition();
        const shot = recordPhoto(this.run, this.landmarks, {
            x: position.x,
            z: position.z,
            altitudeFeet: altitudeToFeet(this.aircraft.getAltitude()),
            headingDegrees: headingDegrees(this.aircraft.getHeading())
        });

        if (shot.finished) this.finishStage();
        if (!shot.caught) this.holdNotice(shotNotice(this.landmarks[shot.index], shot.fault));

        this.syncObjective();
    }
}

new FlightSimulator();
