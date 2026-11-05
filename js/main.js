import * as THREE from 'three';
import { Aircraft }         from './aircraft.js';
import { Terrain }          from './terrain.js';
import { Sky }              from './sky.js';
import { Weather }          from './weather.js';
import { CameraController } from './camera.js';
import { HUD }              from './hud.js';
import { INITIAL_CAMERA_MODE, flightStart, startsAfresh } from './flight-state.js';
import { createPauseState, applyPauseKey, resumeFlight, simulationDelta } from './pause.js';
import { createTitleState, startFlight, titleShowing, preFlightDelta }    from './title-screen.js';
import {
    createMenuState, resetSelection, applyMenuKey, applyMenuPointer, isMenuKey, selectedId,
    isMenuAdjustKey, isMenuControlKey, menuAdjustStep, setMenuEntries, moveSelection,
    MenuList, followPointers, startMenuEntries, pauseMenuEntries,
    START_MENU_ENTRIES, PAUSE_MENU_ENTRIES
} from './menu.js';
import {
    createBuildState, openBuildMode, closeBuildMode, buildModeShowing,
    buildModePicking, buildModeDrawing, buildModeFrom, beginCanvas,
    buildModeTool, chooseBuildTool, requestLeave, leavesBuilder, isCanvasLeaveKey,
    buildModeEnvironment, draftPending, buildDraft, reviseDraft, acceptDraft, cancelDraft,
    dropDraft, confirmOpen, buildConfirm, answerConfirm, acceptToolName,
    selectPlacement, pickedIndex, pickablePlacements,
    setSelection, deselect, buildLassoTool, chooseLassoTool, lassoValues, setLassoValues,
    drawIntoSelection, selectionLive, strokeValues, setStrokeValues, layStroke,
    buildRunwayTemplate, chooseRunwayTemplate, insertTemplate,
    resetBrush, eyeDropperArmed, toggleEyeDropper, dropEyeDropper, takeEyeDropperColor,
    openDeselectPopup, deselectPopup, closeDeselectPopup,
    buildExtrudeTool, chooseExtrudeTool, extrudeValues, setExtrudeValues, extrudeStage, extrudeDrawing, extrudeRegion,
    drawExtrudeShape, pressExtrudeStage, extrudeSurface, chooseExtrudeSurface, backFromSurfaces,
    holdCamera, cameraHeld, releaseCamera, suspendForSettings, settingsOver, resumeFromSettings,
    setAutoAccept, drawAgain, editPending,
    isBuilderOpenKey, BUILDER_ENTRY_ID, CONFIRM_ENTRIES, CONFIRM_HEADINGS, CONFIRM_STAY,
    BUILD_FROM_TITLE, BUILD_FROM_PAUSE
} from './build-mode.js';
import {
    paletteTools, dropsAtClick, toolMark, toolName, isStrokeTool, isPaintTool, isEraseTool, isExtrudeTool, strokeStamp, buildTool,
    insertsTemplate, ACCEPT_TOOL, SELECT_TOOL
} from './build-tools.js';
import { placeTemplate, groupStrips, groupLots, groupReach, keepStripOnCanvas, arrivalHeading } from './templates.js';
import {
    createPaletteState, paletteFolded, togglePalette, paletteFoldName, PALETTE_FOLD_MARK,
    BUILDER_SETTINGS_MARK, BUILDER_SETTINGS_NAME
} from './build-palette.js';
import { placementAt, travelledPast } from './build-select.js';
import {
    placementOutline, projectOutline, strokeOutline, strokeGumball, HOVER_OUTLINE, CHOSEN_OUTLINE,
    footprintLoop, subdividePath, canvasPieces, projectPath, strokePaths, SELECTION_OUTLINE, DRAWING_OUTLINE, PATH_STEP,
    regionEdges, contoured, stampOutline, strokeRibbon, fillRegion, paintTrailColour, COVER_TRAIL, ERASE_TRAIL,
    EXTRUDE_REGION, EXTRUDE_PENDING, EXTRUDE_FILL, EXTRUDE_PRISM, surfaceEdges
} from './build-overlay.js';
import {
    boundHandles, gumballCentre, gumballLayout, gumballHit, pressHandle, dragHandle, handleBinding,
    alongAxis, sweepAround, GUMBALL_AXES
} from './gumball.js';
import {
    createPickerState, pickerEntries, choosePickerEntry,
    CARD_ENTRY, PICKER_STARTED, PICKER_LEFT
} from './build-picker.js';
import {
    canvasFarPlane, CANVAS_FOG, createBuildCamera, buildCameraPosition,
    orbitBuildCamera, panBuildCamera, zoomBuildCameraToward, moveBuildCamera, reframeBuildCamera,
    cameraGesture, wheelPixels, moveIntent, isBuildMoveKey, isReframeKey, clearOfGround,
    writeCameraField, nudgeBuildCamera, unitsPerPixel, viewBearing, CAMERA_ORBIT, DEFAULT_FOV
} from './build-camera.js';
import {
    dockContent, draftHolderFor, strokeHolderFor, canvasElements, DOCK_SELECT, DOCK_DRAFT, DOCK_WORLD, DOCK_LASSO,
    DOCK_COVER, DOCK_PAINT, DOCK_ERASE, DOCK_EXTRUDE, DOCK_RUNWAY, DOCK_ACCEPT, DOCK_CANCEL, DOCK_DESELECT, DOCK_DEFAULT_BRUSH
} from './build-panel.js';
import {
    lassoTool, clickVertex, lassoOp, squareInDrag, LASSO_CLICKS, LASSO_DRAG, CLOSE_PIXELS
} from './lasso.js';
import { flattenPath, footprintWeight, footprintSampler } from './environment/footprints.js';
import { shape as shapeOf, shapeFootprint } from './shapes.js';
import {
    extrudeTool, EXTRUDE_DRAWING, EXTRUDE_EXTRUDING, EXTRUDE_SURFACES, EXTRUDE_STAGE_ACTION, EXTRUDE_BACK, surfaceAt
} from './extrude.js';
import { PanelView } from './panel-view.js';
import {
    stepRow, writeRowValue, typedRowValue, rangeNotice, rangeStep, stepPlaces, coarseStep
} from './properties-panel.js';
import { getEnvironment } from './environment/presets.js';
import { pickGround, canvasPickBounds, pickStep, pointerDevice } from './build-picking.js';
import {
    createHelpState, applyHelpKey, expandHelp, toggleHelp, helpRowLines, buildHelpLines
} from './controls-help.js';
import {
    createHudVisibilityState, applyHudToggleKey, isHudToggleKey, defaultStorage
} from './hud-visibility.js';
import {
    createSettingsState, openSettings, closeSettings, settingsShowing,
    typedSettingRow, beginTypedSetting, applyTypedSettingKey, cancelTypedSetting,
    chooseSetting, adjustSetting, currentEnvironment, currentOption, startSettings,
    isSettingsCloseKey, isSettingsOpenKey,
    SETTINGS_BACK_ID, ENVIRONMENT_ENTRY, START_GROUP, BUILDER_GROUP, BUILDER_SETTINGS_ID,
    SENSITIVITY_OPTION, ORBIT_RATE_OPTION, FOG_OPTION, WEATHER_OPTION,
    SPEED_UNIT_OPTION, ALTITUDE_UNIT_OPTION
} from './settings.js';
import {
    createControlSettingsState, openControlSettings, closeControlSettings,
    controlSettingsShowing, chooseControlSetting, adjustControlSetting,
    controlAxes, fullRotationWanted, isControlSettingsCloseKey,
    tiltInputAxes, tiltWanted, tiltDeadzone,
    levelOffControls, referenceOpenWanted, rememberReferenceOpen,
    controlBindings, bindingArmed, bindArmedKey, bindingEntryName,
    CONTROL_SETTINGS_BACK_ID, CONTROL_REFERENCE_ID,
    AXIS_GROUP, TILT_GROUP, ATTITUDE_GROUP, LEVEL_OFF_GROUP, BINDING_GROUP
} from './control-settings.js';
import {
    createBuilderSettingsState, openBuilderSettings, closeBuilderSettings, builderSettingsShowing,
    chooseBuilderSetting, adjustBuilderSetting, isBuilderSettingsCloseKey, isBuilderSettingsOpenKey, builderAutoAccept, builderCameraSpeed,
    BUILDER_SETTINGS_FROM_BUILDER, BUILDER_SETTINGS_FROM_SETTINGS, BUILDER_SETTINGS_BACK_ID,
    AUTO_ACCEPT_GROUP, VIEW_GROUP
} from './builder-settings.js';
import { aircraftBindings } from './key-bindings.js';
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
    typedEditorRow, beginTypedEditorValue, applyTypedEditorKey, cancelTypedEditorValue,
    editorEntries, editorPlacements, chooseEditorEntry, adjustEditorRange,
    setEditorClearance, isEditorCloseKey, keepBuiltWorld, keptPlacements, builtWorld,
    flownEnvironment, canvasWorld, EDITOR_BACK_ID
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

/** The palette's lasso tile, whose presses on the canvas draw the selection. */
const LASSO_PALETTE_TOOL = 'lasso';

/**
 * How far, in screen pixels, a free lasso travels between the points it
 * gathers: close enough to follow a hand, far enough apart that a slow drag is
 * not a thousand points.
 */
const LASSO_SAMPLE_PIXELS = 6;

// How far, in screen pixels, the pointer travels between the samples a cover
// stroke is laid through: close enough that a stroke dragged round a bend is
// the bend, and far enough apart that a stroke is not hundreds of points.
const STROKE_SAMPLE_PIXELS = 6;

/** Keys a canvas keeps from the browser, whose own use of them would take the page from the builder. */
const CANVAS_SWALLOWED_KEYS = ['AltLeft', 'AltRight'];

/** How soon after a click a second on the same spot is the same double click, in milliseconds. */
const DOUBLE_CLICK_MS = 500;

/**
 * How often, in milliseconds, the ground under a gumball drag is drawn again.
 * A canvas takes the better part of a frame to draw, so a drag writes the
 * edit on every move and the ground catches up at this pace, and once more
 * when the handle is let go.
 */
const GROUND_REDRAW_MS = 120;

/**
 * One of the builder's marks as an image inside a button. Its own document, so
 * the ids and class names every Illustrator export carries stay inside it and
 * collide with nothing; and silent, since the button around it is named.
 */
function markImage(src) {
    const image = document.createElement('img');
    image.src = src;
    image.alt = '';
    image.draggable = false;
    return image;
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

        // The builder's own preferences - when a draft is kept without asking,
        // how fast the view over a canvas moves - remembered under a key of
        // their own. The editor reads them; nothing that builds ground does.
        this.builderSettings = createBuilderSettingsState(defaultStorage());

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
        // Built beside the sky rather than inside it: the weather reads the
        // hour off the cycle and hands a strike back to it, which is two
        // things talking rather than one thing doing both.
        this.weather = new Weather(this.scene, this.sky);
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
        this.builderSettingsMenuState = createMenuState(this.builderSettings.entries);
        this.editorState    = createMenuState(this.editor.entries);
        this.modesState     = createMenuState(gameModeEntries());

        // The builder's session, the canvas its picker has settled on, and the
        // picker drawn as one menu across its cards and the two rows under
        // them.
        this.builder     = createBuildState();
        this.picker      = createPickerState();
        this.pickerState = createMenuState(pickerEntries(this.picker));

        // The confirm a canvas asks before an edit is settled or the builder is
        // left, as a menu of its two buttons.
        this.confirmState = createMenuState(CONFIRM_ENTRIES);

        // The builder's own control list, open when a canvas first opens - a
        // canvas is a screen with nothing else on it to say what it answers to.
        this.buildHelpState = createHelpState(true);

        // The camera over a canvas, as the orbit a pointer and the keys move;
        // the drag being made on the canvas, if one is; and the move keys held
        // down, which the frame reads rather than the key event, so a held key
        // moves the view smoothly rather than at the rate keys repeat.
        this.buildCamera = null;
        this.canvasDrag  = null;
        this.buildKeys   = new Set();

        // What a pick on the canvas reads the ground against - the highest the
        // ground stands, the square that may be picked, and the march step for
        // its sampling - worked out once per canvas; and the ray a pick is cast
        // along, built from the camera through the pointer.
        this.canvasGround = null;
        this.pointerRay   = new THREE.Raycaster();

        // Where the pointer last was over a canvas, and the committed
        // placement under it - which Select outlines lightly as what a click
        // would take - with the outlines traced so far, kept by what they are
        // the outline of so a placement is traced once rather than once a
        // frame, and the point each end of one is projected through.
        this.canvasPointer = null;
        this.hovered       = null;
        this.outlines      = new Map();
        this.overlayPoint  = new THREE.Vector3();
        this.overlayDrawn  = false;

        // The gumball on the edit in hand as the last frame laid it out, which
        // a press is hit-tested against; the handle under the pointer; the drag
        // of a handle being made; and whether the ground is behind what that
        // drag has written, with when it was last drawn - a drag writes the
        // edit every move and the ground at most every `GROUND_REDRAW_MS`.
        this.gumball      = null;
        this.gumballHover = null;
        this.gumballDrag  = null;
        this.groundStale  = false;
        this.groundDrawnAt = 0;

        // Which of the world's own elements are open on Select's panel, by
        // their place in the world, so a section stays open across frames.
        this.worldOpen = new Set();

        // The shape the lasso is drawing and has not finished: its tool, its
        // gesture, and the ground points it has so far - with the pointer it
        // was pressed with for a drag, and where on the screen each point was
        // for a click per vertex, which is what closing on a point reads.
        this.lassoDrawing = null;
        // Where and when a click-per-vertex shape was last closed, so the
        // second press of the double click that closed it starts nothing.
        this.lassoClosed = null;
        // A combined selection's edge as last traced, and which selection it
        // was traced for.
        this.selectionTrace = null;
        // The stroke the cover tool is laying and has not let go of: the
        // pointer it was pressed with, the ground points it has gathered, and
        // the world units a screen pixel spanned where it was pressed, which
        // is the scale its stamp is laid at.
        this.strokeDrawing = null;

        // What the dock last drew, which a press on it is read against, and
        // the holder an edit in hand is stepped through - its configuration,
        // and its gradients held as shades of the colours the edit began with.
        // The cover tool's panel has a holder of its own, kept for as long as
        // the tool is live, so its colour reads against where it started and
        // not against wherever the last batch left it.
        this.dockShown   = null;
        this.draftHolder = null;
        this.strokeHolder = null;

        // Whether the two menus are currently carrying the builder's entry, so
        // a card is drawn again when that changes rather than on every frame
        // something else did.
        this.builderEntryReady = null;
        // The list opens the way the pilot last left it, which the control
        // panel remembers beside the rest of what it holds: the H key's answer
        // is the same question the panel is already asking.
        this.helpState      = createHelpState(referenceOpenWanted(this.controlSettings));
        this.hudVisibility  = createHudVisibilityState(defaultStorage());
        // Whether the builder's tools are folded away, kept for the next canvas.
        this.paletteState   = createPaletteState(defaultStorage());
        this.audioState     = createAudioState(defaultStorage());
        this.audio          = new FlightAudio(this.audioState);
        this.photoState     = createPhotoState();

        // Whether this machine has to be flown from the glass, and so whether
        // the pads are drawn. Asked once: a phone does not grow a keyboard
        // halfway through a flight.
        //
        // It is no longer the whole of whether the device's own attitude is
        // read, only the answer the panel's FLY BY TILT row defers to - a
        // tablet with a keyboard can now ask for tilt and a phone can ask to be
        // left alone. `syncTilt` is what carries a change of mind to the sensor.
        this.touchOnly  = isTouchOnly();

        // The canvas's control list names keys, and a machine with no keyboard
        // has none of them, so there it starts collapsed to its hint line rather
        // than covering the ground a finger is working.
        if (this.touchOnly) this.buildHelpState.expanded = false;
        this.tilt       = createTiltState(tiltWanted(this.controlSettings, this.touchOnly));
        this.tiltSensor = new TiltSensor(this.tilt);

        // Which controls the pads are currently drawn for, so the set is rebuilt
        // when the sensor comes to life rather than every frame it stays alive.
        this.padsTilted = null;

        // Whether the control settings panel's CONTROL REFERENCE row has put the
        // control list on screen over the title, where nothing else would have
        // shown it yet. The row turns it over there rather than only opening it,
        // there being no H key over a title screen to collapse it with.
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
            builderSettings: document.getElementById('builder-settings'),
            editor:    document.getElementById('element-editor'),
            picker:    document.getElementById('build-picker'),
            gameModes: document.getElementById('game-modes'),
            objective: document.getElementById('game-mode'),
            hud:       document.getElementById('hud'),
            attitude:  document.getElementById('attitude'),
            minimap:   document.getElementById('minimap'),
            muted:     document.getElementById('audio-muted'),
            help:      document.getElementById('controls-help'),
            helpList:  document.getElementById('controls-help-list'),
            helpHint:  document.getElementById('controls-help-hint'),
            // The rows of the list that name a key a pilot can move. The rest
            // of the list names keys nothing rebinds and is left as the page
            // writes it.
            helpRows:  document.querySelectorAll('#controls-help-list [data-help-row]'),
            touch:     document.getElementById('touch-controls'),
            // The builder's palette and its control list, which are a canvas's
            // only chrome.
            palette:       document.getElementById('build-palette'),
            buildHelp:     document.getElementById('build-help'),
            buildHelpList: document.getElementById('build-help-list'),
            buildHelpHint: document.getElementById('build-help-hint'),
            buildHelpRows: document.getElementById('build-help-rows'),
            dock:          document.getElementById('build-dock'),
            // The two confirms a canvas asks, drawn in one panel over it.
            confirm:        document.getElementById('build-confirm'),
            confirmPanel:   document.getElementById('build-confirm-panel'),
            confirmHeading: document.getElementById('build-confirm-heading'),
            // The popup a right click on the selection opens, carrying the
            // one answer it has.
            popup:          document.getElementById('build-popup'),
            // The layer over the ground the outlines are drawn on.
            buildOverlay:   document.getElementById('build-overlay')
        };
        this.overlayContext = this.overlays.buildOverlay.getContext('2d');

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

        // The picker is two lists under one cursor: the six canvases as cards
        // in two columns, and `START` and `BACK` beneath them. Split for the
        // same reason the settings panel's three lists are - the cards are a
        // grid and the answers are rows - and walked as the one menu the cursor
        // already treats them as.
        this.pickerCards = new MenuList(
            document.getElementById('build-picker-cards'), this.pickerState,
            entry => entry.kind === CARD_ENTRY
        );
        this.pickerActions = new MenuList(
            document.getElementById('build-picker-actions'), this.pickerState,
            entry => entry.kind !== CARD_ENTRY
        );

        followPointers(
            [this.pickerCards, this.pickerActions],
            (index, choose) => this.onPickerPointer(index, choose)
        );

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
            entry => entry.kind !== ENVIRONMENT_ENTRY && entry.group !== START_GROUP && entry.group !== BUILDER_GROUP
        );
        this.settingsBuilder = new MenuList(
            document.getElementById('settings-builder'), this.settingsState,
            entry => entry.group === BUILDER_GROUP
        );

        // Four lists, one cursor, and so one pointer: an entry is reported by
        // its place in the whole panel rather than by its row in the list it was
        // drawn into, so the mouse and the keys walk the same panel.
        followPointers(
            [this.settingsMenu, this.settingsStart, this.settingsOptions, this.settingsBuilder],
            (index, choose, step) => this.onSettingsPointer(index, choose, step)
        );

        // The builder's own settings the same way: auto accept under one
        // heading, the view under the next, and the reset and the way out
        // under neither.
        this.builderSettingsMenus = [
            new MenuList(document.getElementById('builder-settings-auto'), this.builderSettingsMenuState,
                entry => entry.group === AUTO_ACCEPT_GROUP),
            new MenuList(document.getElementById('builder-settings-view'), this.builderSettingsMenuState,
                entry => entry.group === VIEW_GROUP),
            new MenuList(document.getElementById('builder-settings-end'), this.builderSettingsMenuState,
                entry => entry.group !== AUTO_ACCEPT_GROUP && entry.group !== VIEW_GROUP)
        ];
        followPointers(this.builderSettingsMenus, (index, choose, step) => this.onBuilderSettingsPointer(index, choose, step));

        // And the control panel the same way: the axes under one heading, the
        // tilt and the attitude under the next two, and the reference list and
        // the way out under the last, walked as the one list the cursor already
        // treats them as.
        this.controlAxesMenu = new MenuList(
            document.getElementById('control-settings-axes'), this.controlState,
            entry => entry.group === AXIS_GROUP
        );
        this.controlTiltMenu = new MenuList(
            document.getElementById('control-settings-tilt'), this.controlState,
            entry => entry.group === TILT_GROUP
        );
        this.controlAttitudeMenu = new MenuList(
            document.getElementById('control-settings-attitude'), this.controlState,
            entry => entry.group === ATTITUDE_GROUP
        );
        this.controlLevelOffMenu = new MenuList(
            document.getElementById('control-settings-level-off'), this.controlState,
            entry => entry.group === LEVEL_OFF_GROUP
        );
        this.controlKeysMenu = new MenuList(
            document.getElementById('control-settings-keys'), this.controlState,
            entry => entry.group === BINDING_GROUP
        );
        this.controlReferenceMenu = new MenuList(
            document.getElementById('control-settings-reference'), this.controlState,
            entry => ![
                AXIS_GROUP, TILT_GROUP, ATTITUDE_GROUP, LEVEL_OFF_GROUP, BINDING_GROUP
            ].includes(entry.group)
        );

        this.controlMenus = [
            this.controlAxesMenu, this.controlTiltMenu, this.controlAttitudeMenu,
            this.controlLevelOffMenu, this.controlKeysMenu, this.controlReferenceMenu
        ];

        followPointers(
            this.controlMenus,
            (index, choose, step) => this.onControlSettingsPointer(index, choose, step)
        );

        // The control list is what the panel's Control Reference row puts on
        // screen, so it is also the way back off it for a pilot working the
        // menus with the mouse: clicking the list collapses it, and clicking
        // what is left opens it again.
        this.overlays.help.addEventListener('click', () => this.onHelpClick());

        // A canvas's palette and control list are drawn once, from the tools
        // that work and the bindings a canvas reads, and shown or hidden with
        // the canvas. The list is worked with a click as the flight's is.
        this.drawPalette();
        this.drawBuildHelp();
        this.overlays.buildHelp.addEventListener('click', () => this.onBuildHelpClick());
        this.setupBuilderPointer();

        // The dock is drawn by the one panel view, and tells this what was done
        // to it: a row stepped or typed into, the view slid, an edit settled.
        this.dockView = new PanelView(this.overlays.dock, {
            onStep:   (entry, step, coarse) => this.onDockStep(entry, step, coarse),
            onType:   (entry, figure, field) => this.onDockType(entry, figure, field),
            onNudge:  (id, sign) => this.onDockNudge(id, sign),
            onAction: (id) => this.onDockAction(id),
            onFold:   (id) => this.onDockFold(id),
            onShape:  (id) => this.onDockShape(id),
            onColor:  (entry, rgb) => this.onDockColor(entry, rgb),
            onDropper: entry => this.onDockDropper(entry)
        });

        // The confirm is worked with the mouse as every menu here is, and a
        // press on the layer behind it - anywhere but the panel - calls the
        // question off, the way Escape does.
        this.confirmMenu = new MenuList(document.getElementById('build-confirm-menu'), this.confirmState);
        this.confirmMenu.followPointer((index, choose) => this.onConfirmPointer(index, choose));
        this.overlays.confirm.addEventListener('click', (e) => {
            if (e.target === this.overlays.confirm) this.answerBuildConfirm(CONFIRM_STAY);
        });

        this.setupKeys();
        this.applySettings();
        this.applyControlSettings();
        this.applyBuilderSettings();

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
        this.weather.setPrecipitation(currentOption(this.settings, WEATHER_OPTION));
        this.hud.setUnits({
            speed:    currentOption(this.settings, SPEED_UNIT_OPTION),
            altitude: currentOption(this.settings, ALTITUDE_UNIT_OPTION)
        });

        this.refreshWorld();
    }

    /**
     * Puts the world and the start now asked for in force.
     *
     * Whether that is a new flight for the aircraft standing on it is
     * `startsAfresh`, in `js/flight-state.js` with the rest of what a start
     * means - a pure reading, so what a rebuilt world does to the flight over
     * it can be tested without a renderer to rebuild one in.
     *
     * `restored` is the one thing a caller has to say that this cannot work
     * out: whether the world going down is the same world being laid again or
     * a different one being chosen. A rebuild looks identical either way, and
     * only the caller knows which it asked for.
     */
    refreshWorld({ restored = false } = {}) {
        const rebuilt = this.buildWorld();
        const flight  = this.buildStart();
        const changed = !sameStart(flight, this.start);

        this.start = flight;
        this.aircraft.setStart(flight);

        if (startsAfresh({
            rebuilt,
            startChanged: changed,
            beforeLaunch: titleShowing(this.titleState),
            restored
        })) this.aircraft.reset();

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
            // The settings' world, or the canvas a build kept on it was made
            // on - Blank Canvas is one the settings do not offer, and its
            // build is flown on its own flat ground rather than on theirs.
            environment: flownEnvironment(this.editor, currentEnvironment(this.settings)),
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
            || builderSettingsShowing(this.builderSettings)
            || editorShowing(this.editor)
            || buildModeShowing(this.builder)
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
            // A figure being typed into the dock is the field's: none of the
            // builder's keys - the moves, H, Escape leaving - and none of the
            // aircraft's reach anything while it has the focus, and the field's
            // own keys go on doing what a field does. Escape gives the focus
            // back, which is the innermost thing it can step out of.
            if (this.editingDockField(e)) {
                if (e.code === 'Escape') e.target.blur();
                e.stopPropagation();
                return;
            }

            // A key held with a modifier is a browser shortcut rather than a
            // menu key, and is left to the browser
            if (e.ctrlKey || e.altKey || e.metaKey) return;

            // A key row waiting for a key takes every key, ahead of everything
            // else that would have read one: the aircraft listens on the way
            // back up, and a control surface moved by the press that bound it
            // would be a surface held by a key that no longer works it.
            const onTitle = titleShowing(this.titleState);
            const binding = bindingArmed(this.controlSettings) != null;
            if (!onTitle && !binding && !(this.menuShowing() && isMenuControlKey(e.code))) return;

            if (SWALLOWED_KEYS.includes(e.code)) e.preventDefault();
            if (onTitle) this.onStartKey(e);
            else this.onKeyDown(e);
            e.stopPropagation();
        }, true);

        window.addEventListener('keydown', (e) => this.onKeyDown(e));

        // A move key held on a canvas is let go of on its release, wherever the
        // release lands, and every one is let go of when the window loses the
        // keys - a release made behind another window never arrives, and the
        // view would slide on after it.
        window.addEventListener('keyup', (e) => {
            this.buildKeys.delete(e.code);
            if (buildModeDrawing(this.builder) && CANVAS_SWALLOWED_KEYS.includes(e.code)) e.preventDefault();
        });
        window.addEventListener('blur', () => this.buildKeys.clear());
    }

    onStartKey(e) {
        // A key row waiting for a key is read ahead of everything here too, for
        // the reason it is in `onKeyDown`: the panel opens from this screen as
        // well, and a key that did something else while a row waited would be a
        // key nothing can be bound to on one screen and can be on the other.
        if (bindingArmed(this.controlSettings)) {
            this.onControlSettingsKey(e);
            return;
        }

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

        // The builder's settings over the builder are read ahead of it, which
        // is what makes them modal over the canvas.
        if (builderSettingsShowing(this.builderSettings)) {
            this.onBuilderSettingsKey(e);
            return;
        }

        if (editorShowing(this.editor)) {
            this.onEditorKey(e);
            return;
        }

        if (buildModeShowing(this.builder)) {
            this.onBuilderKey(e);
            return;
        }

        if (isSettingsOpenKey(e.code) && !e.repeat) {
            this.openSettingsPanel();
            this.syncOverlays();
            return;
        }

        // The world can be built before the flight it will be flown over has
        // begun, which is the natural time to do it - unless a mode has been
        // chosen, which brings its own ground and leaves the builder nothing to
        // be building. `builderReady` is that one predicate, and the pause
        // menu's entry reads it too.
        if (isBuilderOpenKey(e.code) && !e.repeat && this.builderReady()) {
            this.openBuilder(BUILD_FROM_TITLE);
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
            case BUILDER_ENTRY_ID:
                // The same entry the pause menu carries, opening the same
                // builder through the same function the L key opens it with.
                this.openBuilder(BUILD_FROM_TITLE);
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
        // A key row waiting for a key is read ahead of everything, the shutter
        // included. A row that waits for any key at all keeps back three keys -
        // Escape leaves the wait, Delete and Backspace clear the row - and a key
        // that did something else while a row waited would be one more key
        // nothing can be bound to, with nothing on the row to say why. The keys
        // the game reads for itself are kept off the map as well, but a row
        // refuses those out loud and says what the key already does.
        if (bindingArmed(this.controlSettings)) {
            this.onControlSettingsKey(e);
            return;
        }

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

        if (builderSettingsShowing(this.builderSettings)) {
            this.onBuilderSettingsKey(e);
            return;
        }

        if (editorShowing(this.editor)) {
            this.onEditorKey(e);
            return;
        }

        if (buildModeShowing(this.builder)) {
            this.onBuilderKey(e);
            return;
        }

        let changed = false;

        if (isSettingsOpenKey(e.code) && !e.repeat) {
            this.openSettingsPanel();
            changed = true;
        } else if (isBuilderOpenKey(e.code) && !e.repeat && this.builderReady()) {
            // A mode brings its own ground with it, so there is nothing here
            // for the builder to be building while one is being played. The
            // pause menu's entry comes off under the same predicate rather than
            // being shown doing nothing.
            this.openBuilder(BUILD_FROM_PAUSE);
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
            this.rememberHelpState();
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
            case BUILDER_ENTRY_ID:
                this.openBuilder(BUILD_FROM_PAUSE);
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
     * The control list under the mouse. The CONTROL REFERENCE row of the control
     * settings panel is what puts it on screen, and H is what collapses it over
     * a flight, so a click has to be the way off it for a pilot working the
     * menus with the mouse: a click collapses the list to its hint line and
     * another opens it again, which is the H key's job for a pilot working them
     * with the keyboard.
     *
     * Over the title screen the list is not a toggle but a panel that same
     * CONTROL REFERENCE row opened, so a click there closes it the way choosing
     * the row again would.
     */
    onHelpClick() {
        if (titleShowing(this.titleState)) this.titleHelp = false;
        else {
            toggleHelp(this.helpState);
            this.rememberHelpState();
        }

        this.syncOverlays();
    }

    openSettingsPanel() {
        this.modesOpen = false;
        closeEditor(this.editor);
        closeControlSettings(this.controlSettings);
        this.leaveBuilder();
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
        // A figure is typed with a keyboard, so reaching for the mouse is giving
        // up on one: the row goes back to the value it had rather than being
        // left reading a caret nothing is being typed into any more.
        cancelTypedSetting(this.settings);

        const chosen = applyMenuPointer(this.settingsState, index, choose);
        if (chosen) this.chooseSettingsEntry(chosen, step);
        this.syncOverlays();
    }

    onSettingsKey(e) {
        // A row being typed into reads the press first, because three of the
        // keys it answers are keys the panel already means something by: Enter
        // chooses a row, Escape closes the panel, and Backspace closes it too.
        // A key the figure has no use for comes back null and falls through to
        // the panel, so the cursor can still walk off a row mid-figure.
        if (typedSettingRow(this.settings) != null) {
            const typed = applyTypedSettingKey(this.settings, e.code);
            if (typed) {
                e.preventDefault();
                if (typed.result === 'applied') this.applySettings();
                this.syncOverlays();
                return;
            }
        }

        // The key that opens the panel closes it again, so O is a way in and
        // out rather than a one-way door.
        if (isSettingsCloseKey(e.code) || (isSettingsOpenKey(e.code) && !e.repeat)) {
            closeSettings(this.settings);
            this.syncOverlays();
            return;
        }

        // A figure the pilot already knows is typed rather than stepped to, so a
        // digit at a row holding a number starts one. Read after the way out and
        // before the menu keys, which no digit is one of.
        //
        // Only where no figure is in hand. A press the figure itself has already
        // refused - a minus part way along, or a ninth character - comes back
        // null above and reaches here, and starting a fresh figure on it throws
        // away everything typed so far with nothing on the row to say it went.
        if (!e.repeat && typedSettingRow(this.settings) == null
            && beginTypedSetting(this.settings, selectedId(this.settingsState), e.code)) {
            e.preventDefault();
            this.syncOverlays();
            return;
        }

        // Walking off a row is giving up on a figure for the same reason
        // reaching for the mouse is, and stepping the value under it is giving
        // up on one for the same reason again. The highlight says where the
        // pilot is and the reading says what is stored, so a figure left live
        // through either takes every digit after it and is finally measured
        // against a value the row never showed. Given up on for any key the
        // panel works with, above both the stepping and the walking - which is
        // the order onSettingsPointer already reads in. A key the panel does
        // nothing with leaves the figure alone, since nothing it does can move
        // the value out from under one.
        if (isMenuControlKey(e.code)) cancelTypedSetting(this.settings);

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

        // The builder's own settings, opened in this panel's place.
        if (applied === BUILDER_SETTINGS_ID) {
            this.openBuilderSettingsPanel(BUILDER_SETTINGS_FROM_SETTINGS);
            return;
        }

        // Every choice the panel offers goes back through the same place: the
        // world and the start are worked out from the run and the settings
        // together, so a new world resets the flight, a new start waits for
        // one, and nothing here has to know which kind of choice was made.
        this.applySettings();
    }

    // --- The builder's settings ------------------------------------------

    /**
     * Opens the builder's own settings, from the builder - the gear, or `O` -
     * or from the game's settings. Over a canvas it is modal and suspends the
     * live tool the way a held pan does: whatever is being dragged ends, a
     * held move key is let go, and the draft is left exactly as it was, so
     * opening it never accepts a half-drawn stroke. A shape being drawn a click
     * at a time is kept, as a pan keeps it.
     */
    openBuilderSettingsPanel(from = BUILDER_SETTINGS_FROM_BUILDER) {
        if (builderSettingsShowing(this.builderSettings)) return false;

        if (from === BUILDER_SETTINGS_FROM_BUILDER) {
            if (!buildModeShowing(this.builder)) return false;
            if (buildModeDrawing(this.builder)) {
                if (!suspendForSettings(this.builder)) return false;
                this.endCanvasDrag();
                this.endGumballDrag();
                this.cancelStroke();
                if (this.lassoDrawing?.gesture === LASSO_DRAG) this.cancelLasso();
                this.buildKeys.clear();
            }
        } else {
            closeSettings(this.settings);
        }

        openBuilderSettings(this.builderSettings, from);
        resetSelection(this.builderSettingsMenuState);
        return true;
    }

    /**
     * Closes the builder's settings, back to whichever screen opened them:
     * the canvas, with the tool they suspended live again as it was, or the
     * game's settings, on the row that opened them.
     */
    closeBuilderSettingsPanel() {
        const from = closeBuilderSettings(this.builderSettings);
        if (from === BUILDER_SETTINGS_FROM_SETTINGS) {
            this.openSettingsPanel();
            const at = this.settingsState.entries.findIndex(entry => entry.id === BUILDER_SETTINGS_ID);
            if (at >= 0) this.settingsState.index = at;
        } else if (from === BUILDER_SETTINGS_FROM_BUILDER) {
            resumeFromSettings(this.builder);
            this.renderer.domElement.style.cursor = this.canvasCursor();
        }
    }

    /**
     * Hands the builder's settings to what they drive: the moments auto
     * accept covers, to the session - from the next event on, never to what is
     * already in hand - and how fast the view over a canvas moves.
     */
    applyBuilderSettings() {
        setAutoAccept(this.builder, builderAutoAccept(this.builderSettings));
        this.buildCameraSpeed = builderCameraSpeed(this.builderSettings);
    }

    onBuilderSettingsKey(e) {
        // The key that opens the screen closes it again, as `O` does the game's.
        if (isBuilderSettingsCloseKey(e.code) || (isBuilderSettingsOpenKey(e.code) && !e.repeat)) {
            e.preventDefault();
            this.closeBuilderSettingsPanel();
            this.syncOverlays();
            return;
        }

        if (isMenuAdjustKey(e.code)) {
            e.preventDefault();
            const adjusted = adjustBuilderSetting(
                this.builderSettings, selectedId(this.builderSettingsMenuState), menuAdjustStep(e.code)
            );
            if (adjusted) this.applyBuilderSettings();
            this.syncOverlays();
            return;
        }

        if (!isMenuKey(e.code)) return;
        e.preventDefault();

        const chosen = applyMenuKey(this.builderSettingsMenuState, e.code, true, e.repeat);
        if (chosen) this.chooseBuilderSettingsEntry(chosen);
        this.syncOverlays();
    }

    /** The builder's settings under the mouse: a click chooses, the left of a row steps it down and the right up. */
    onBuilderSettingsPointer(index, choose, step = 1) {
        const chosen = applyMenuPointer(this.builderSettingsMenuState, index, choose);
        if (chosen) this.chooseBuilderSettingsEntry(chosen, step);
        this.syncOverlays();
    }

    chooseBuilderSettingsEntry(id, step = 1) {
        // `BACK` closes through the one place `Escape` does, so it returns to
        // whichever screen opened the settings.
        if (id === BUILDER_SETTINGS_BACK_ID) {
            this.closeBuilderSettingsPanel();
            return;
        }
        if (chooseBuilderSetting(this.builderSettings, id, step)) this.applyBuilderSettings();
    }

    // --- The control settings panel ---------------------------------------

    openControlSettingsPanel() {
        this.modesOpen = false;
        closeSettings(this.settings);
        closeEditor(this.editor);
        this.leaveBuilder();
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
        this.aircraft.setBindings(aircraftBindings(controlBindings(this.controlSettings)));
        this.aircraft.setVerticalControls(levelOffControls(this.controlSettings));
        this.syncTilt();

        // The list is the one setting the panel shares with a key, so the panel
        // is what the list is read from rather than the other way round: a box
        // turned over here puts the list on screen, and the H key writes its
        // answer back through `rememberHelpState` below.
        this.helpState.expanded = referenceOpenWanted(this.controlSettings);
        this.syncHelpList();
    }

    /**
     * Hands the FLY BY TILT row's answer to the sensor, which is the one control
     * setting that changes what the machine is doing rather than only how a
     * reading is read.
     *
     * Nothing at all while the answer has not changed, because starting is
     * asking: Safari wants a gesture before it will report orientation, and the
     * gesture this has is the press or the click that chose the row. Spending it
     * on a setting that is already in force would leave a refused ask where a
     * working sensor was.
     *
     * Turning tilt off stops the sensor, which drops the reading, which is what
     * `tiltFlying` reads - so the pads come back to the glass by the same route
     * they left it rather than by a second rule written here.
     */
    syncTilt() {
        const wanted = tiltWanted(this.controlSettings, this.touchOnly);
        if (wanted === this.tilt.enabled) return;

        this.tilt.enabled = wanted;

        if (!wanted) {
            this.tiltSensor.stop();
            this.syncOverlays();
            return;
        }

        // A refused sensor is a flight flown from the pads, exactly as it is
        // when the ask happens on the key that starts the flight, so nothing is
        // waited on here either.
        this.tiltSensor.start().then(() => this.syncOverlays());
    }

    /**
     * Keeps the answer the H key or a click on the list just gave, so the next
     * session opens the list the way this one left it.
     */
    rememberHelpState() {
        rememberReferenceOpen(this.controlSettings, this.helpState.expanded);
    }

    /**
     * Writes the keys into the rows of the reference list that name one. A list
     * still naming the keys the game shipped with would be the one thing on
     * screen contradicting the panel that moved them.
     */
    syncHelpList() {
        const lines = helpRowLines(controlBindings(this.controlSettings));
        for (const row of this.overlays.helpRows ?? []) {
            const line = lines[row.dataset.helpRow];
            if (line != null) row.textContent = line;
        }
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
        // A row waiting for a key reads every key there is, which is the whole
        // of what waiting for one means: the way out of the wait and the way to
        // leave an optional binding on nothing are the only two the panel keeps
        // for itself, and `bindArmedKey` is where that is decided.
        if (bindingArmed(this.controlSettings)) {
            e.preventDefault();
            if (!e.repeat) {
                const press = bindArmedKey(this.controlSettings, e.code);
                if (press?.result === 'bound' || press?.result === 'cleared') this.applyControlSettings();
            }
            this.syncOverlays();
            return;
        }

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

        // Choosing a key row only puts it on the wait, so there is nothing yet
        // to hand to the aircraft - the key that answers it comes next, and
        // `onControlSettingsKey` is what reads it. The key row is the only row
        // held back, and is held back by being one rather than by a row waiting
        // somewhere: a box clicked while a row waits has still changed a
        // setting, and a setting the aircraft is never handed is one the panel
        // reads one way and the flight flies the other.
        if (bindingEntryName(applied) != null) return;

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
                this.rememberHelpState();
                return;
            }

            expandHelp(this.helpState);
            this.rememberHelpState();
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
        closeControlSettings(this.controlSettings);
        this.leaveBuilder();
        openEditor(this.editor);
        this.redrawEditor();
        resetSelection(this.editorState);
    }

    onEditorKey(e) {
        // A row being typed into reads the press first, for the reason it does
        // in the settings panel: Enter, Escape and Backspace all already mean
        // something here, and a figure being written has first claim on them.
        if (typedEditorRow(this.editor) != null) {
            const typed = applyTypedEditorKey(this.editor, e.code);
            if (typed) {
                e.preventDefault();
                this.redrawEditor();
                if (typed.element) this.refreshWorld();
                this.syncOverlays();
                return;
            }
        }

        // Escape and Backspace are the way off the panel. The key that used to
        // open it - and so close it again, the way O does the settings panel -
        // opens the interactive environment builder now, which is where this
        // panel is reached from.
        if (isEditorCloseKey(e.code)) {
            closeEditor(this.editor);
            this.syncOverlays();
            return;
        }

        // A height or a density the pilot already has in mind is typed rather
        // than stepped to, a fiftieth of the range at a time. Guarded on no
        // figure being in hand for the reason the settings panel is: a press
        // the figure refused is not a press that starts a new one.
        if (!e.repeat && typedEditorRow(this.editor) == null
            && beginTypedEditorValue(this.editor, selectedId(this.editorState), e.code)) {
            e.preventDefault();
            this.redrawEditor();
            this.syncOverlays();
            return;
        }

        // Walking off a row gives up on a figure here too, and so does stepping
        // the range under it: either one moves the number the figure is being
        // measured against while the caret still reads the figure. Given up on
        // for any key the panel works with, above both of them, the way
        // onSettingsKey and onEditorPointer read in that order.
        //
        // The rebuilt rows then go to the menu the list is drawn from, as
        // onEditorPointer hands them over. Without it the cursor leaves a caret
        // behind on the row it came from, and RESTORE THE PRESET is unreachable
        // from the keyboard: the Enter that would ask for it is taken by the
        // figure still in hand.
        if (isMenuControlKey(e.code) && cancelTypedEditorValue(this.editor)) {
            setMenuEntries(this.editorState, this.editor.entries);
        }

        // A range is stepped where an element is opened, so the roll keys move
        // a number along its own bounds rather than the cursor down the panel;
        // with `shift`, ten points or ten steps at a time, as the dock's rows.
        if (isMenuAdjustKey(e.code)) {
            e.preventDefault();
            const moved = adjustEditorRange(this.editor, selectedId(this.editorState), menuAdjustStep(e.code), { coarse: e.shiftKey });
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
        // Giving up on a figure builds this panel's rows again rather than
        // writing over the ones it had, and the menu the list is drawn from
        // holds that array rather than the panel - so the rebuilt rows have to
        // be handed to it here. A pointer that only crossed onto a row chooses
        // nothing, so nothing below redraws, and the row the figure was on
        // would go on reading a caret nothing is being typed into.
        if (cancelTypedEditorValue(this.editor)) {
            setMenuEntries(this.editorState, this.editor.entries);
        }

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

    // --- The builder -----------------------------------------------------

    /**
     * Whether the builder can be opened at all.
     *
     * The one predicate the menu entry and the `L` key both read, so the two
     * cannot come to disagree about when the builder is reachable. A game mode
     * brings its own ground with it, and the comment the key handler has always
     * carried says why: there is nothing there for the editor to be editing
     * while one is being played.
     */
    builderReady() {
        return !isRunning(this.run);
    }

    /**
     * Opens the builder, remembering what opened it.
     *
     * The title screen's entry, the pause menu's entry and the `L` key all come
     * here, so the three cannot drift into opening slightly different things,
     * and `from` is what the way out returns to.
     *
     * On the picker the first time, and straight onto the built world once a
     * build has been kept: its canvas, with every placement on it committed
     * and each one Select can pick up again. Choosing another world in the
     * settings lets go of the build, and the picker is back.
     *
     * Every other panel is closed on the way in, the way each of them closes
     * the others: a panel left open behind this one would come back out from
     * under it.
     *
     * Returns true when a session was opened.
     */
    openBuilder(from = BUILD_FROM_TITLE) {
        if (!this.builderReady()) return false;

        closeSettings(this.settings);
        this.modesOpen = false;
        closeControlSettings(this.controlSettings);
        closeEditor(this.editor);

        openBuildMode(this.builder, from, builtWorld(this.editor));
        this.redrawPicker();
        resetSelection(this.pickerState);
        if (buildModeDrawing(this.builder)) this.showCanvas(this.builder.environment);

        return true;
    }

    /**
     * Draws the picker again from the entries it now has. Built rather than
     * redrawn because the card marked as chosen moves, and the mark is drawn
     * into the row rather than onto it.
     */
    redrawPicker() {
        setMenuEntries(this.pickerState, pickerEntries(this.picker));
        this.pickerCards.rebuild(this.pickerState);
        this.pickerActions.rebuild(this.pickerState);
    }

    /**
     * Leaves the builder for whichever menu opened it: the title screen, or the
     * pause menu with the flight still behind it.
     *
     * The flight's own world comes back with it. A canvas is one tile and a
     * flight is an endless grid of them, so the ground has to be laid again
     * rather than left as the square the builder was working on - and that is
     * the same ground the pilot was already flying over, so it is restored
     * rather than changed and the flight paused over it is kept. Before launch
     * there is nothing to keep, and the waiting aircraft takes the start the
     * settings panel holds, which is what it does today and is right: a canvas
     * left from the title screen has no flight behind it.
     *
     * `changed` says the world a flight is drawn from is not the one it was -
     * a built world kept - and then the flight paused over it starts again
     * from its start rather than resuming in ground that moved under it. A
     * world changed under an aircraft is a new flight, as a world chosen in
     * the settings panel is; carrying the flight over, lifted clear of what was
     * built, is `Re-seat the aircraft`'s.
     */
    leaveBuilder(changed = false) {
        const canvas = buildModeDrawing(this.builder);

        // A drag, a held key or a hover does not outlive the canvas it was on.
        this.endCanvasDrag();
        this.buildKeys.clear();
        this.buildCamera = null;
        this.canvasGround = null;
        this.canvasPointer = null;
        this.hovered = null;
        this.outlines.clear();
        this.endGumballDrag(false);
        this.gumball = null;
        this.gumballHover = null;
        this.cancelLasso();
        this.cancelStroke();

        closeBuildMode(this.builder);

        if (canvas) {
            this.terrain.setCanvas(false);
            this.releaseCanvasView();
            // A flight paused before the builder opened is the flight it goes
            // back to, kept whatever was built: a world kept that changed the
            // ground is laid under it, and it is put back over that ground
            // before the first frame is scored, rather than started again.
            const resumed = !titleShowing(this.titleState);
            this.refreshWorld({ restored: resumed });
            this.flyOver(this.aircraft.getPosition());
            if (resumed && changed) this.reseatAircraft();
        }
    }

    /**
     * The aircraft put back over the ground under it as it is now, which a
     * world kept from the builder may have raised or lowered - so a mountain
     * built where it was parked is not a crash on resume. See `reseatHeight`
     * in js/crash.js.
     */
    reseatAircraft() {
        const at = this.aircraft.getPosition();
        return this.aircraft.reseat(this.terrain.getTerrainHeightAt(at.x, at.z));
    }

    /**
     * Keeps what was built: the canvas's environment becomes the one flown,
     * and what the session committed is laid over it, held by the element
     * editor - which is where an edited world already lives, and what a free
     * flight is drawn from.
     *
     * Returns true when the world a flight is drawn from is now a different
     * one, which a canvas kept exactly as the flight already had it is not.
     */
    saveBuiltWorld(environment, placements, world = null) {
        const before = this.flightWorldKey();

        // Chosen in the settings first, so the editor is told which world the
        // settings now hold: the canvas's own, or for a canvas they do not
        // offer, the one they held - which the build is kept under until
        // another is chosen there.
        chooseSetting(this.settings, environment);
        keepBuiltWorld(this.editor, environment, runwayWanted(startSettings(this.settings)), placements,
            currentEnvironment(this.settings), world);
        this.redrawEditor();

        return this.flightWorldKey() !== before;
    }

    /** The world a free flight is drawn from, written down so two can be compared. */
    flightWorldKey() {
        return JSON.stringify({
            environment: flownEnvironment(this.editor, currentEnvironment(this.settings)),
            runway: runwayWanted(startSettings(this.settings)),
            elements: editorPlacements(this.editor)
        });
    }

    /**
     * Opens the canvas on the chosen environment.
     *
     * The world is drawn as the one tile that canvas is, with no strip in it -
     * a runway is a place rather than ground that repeats, and one is placed
     * here rather than searched for - and the camera is held over it. What an
     * earlier session built on this environment and kept is on it already,
     * committed, so saving again keeps that as well as what is added.
     */
    startCanvas(environmentId) {
        if (!beginCanvas(this.builder, environmentId, keptPlacements(this.editor, environmentId),
            canvasWorld(this.editor, environmentId))) return false;
        this.showCanvas(environmentId);
        return true;
    }

    /**
     * Draws a canvas the session has just opened on: the ground, as the one
     * tile it is, and the camera held over it. The picker's `START` and a
     * builder reopening onto its built world both come here.
     */
    showCanvas(environmentId) {
        this.worldOpen.clear();
        this.strokeHolder = null;
        this.terrain.setCanvas(true);
        this.terrain.setEnvironment(environmentId, {
            runway: false,
            elements: canvasElements(getEnvironment(environmentId), this.builder)
        });
        this.bounds = this.terrain.getBounds();
        this.hud.setBounds(this.bounds);

        // The view a pointer and the keys move from here, seeded from the hold
        // so the canvas opens on the frame it always has.
        this.buildCamera = createBuildCamera(this.terrain.size);
        this.canvasGround = this.readCanvasGround();
        this.holdCanvasView();
    }

    /**
     * What a pick reads the canvas's ground against, worked out once per canvas:
     * the highest the ground stands, so a ray is only walked through the air the
     * ground could be in; the square of the canvas, which is all a pick may land
     * on; and a step of half a cell, so no rise in the ground is stepped over.
     */
    readCanvasGround() {
        const field = this.terrain.tileAt(0, 0)?.field;
        let top = -Infinity;
        for (const height of field?.height ?? []) if (height > top) top = height;

        return {
            top: Number.isFinite(top) ? top : Infinity,
            bounds: canvasPickBounds(this.terrain.size),
            step: pickStep(field?.step)
        };
    }

    /**
     * The point of the canvas's ground under the pointer, or null where the
     * pointer is over the sky or over ground off the canvas.
     *
     * The ray is cast from the camera as it stands for the state now, not as
     * the last frame drew it: several wheel notches can land between two
     * frames, and each has to be aimed from where the one before it left the
     * view.
     */
    pickCanvasPoint(clientX, clientY) {
        if (!buildModeDrawing(this.builder) || !this.buildCamera || !this.canvasGround) return null;

        this.placeCanvasCamera();
        const device = pointerDevice(clientX, clientY, this.renderer.domElement.getBoundingClientRect());
        this.pointerRay.setFromCamera(device, this.camera);

        const { origin, direction } = this.pointerRay.ray;
        return pickGround(origin, direction, (x, z) => this.terrain.getTerrainHeightAt(x, z), {
            step: this.canvasGround.step,
            maxDistance: this.camera.far,
            top: this.canvasGround.top,
            bounds: this.canvasGround.bounds
        });
    }

    /**
     * Holds the camera over the canvas, and clears the air over it.
     *
     * Both are the flight's settings being stood down rather than changed. The
     * far plane is as far as the ground is drawn for a flight, which is shorter
     * than the diagonal of one tile, and the fog is thick on purpose - between
     * them they are what keeps the end of the world out of frame. A canvas is
     * the opposite case: its four edges are the extent of what is being built,
     * and they are there to be seen.
     */
    holdCanvasView() {
        this.flightFov = this.camera.fov;
        this.camera.fov = DEFAULT_FOV;
        this.camera.far = canvasFarPlane(this.terrain.size);
        this.camera.updateProjectionMatrix();
        this.sky.setFogDensity(CANVAS_FOG);
    }

    /** Puts both back as the flight had them, which is what leaving restores. */
    releaseCanvasView() {
        this.camera.fov = this.flightFov ?? DEFAULT_FOV;
        this.camera.far = TILE_REACH;
        this.camera.updateProjectionMatrix();
        this.sky.setFogDensity(currentOption(this.settings, FOG_OPTION));
    }

    /**
     * Stands the camera over the canvas for this frame.
     *
     * Written every frame rather than once, because the flight camera is what
     * would otherwise have placed it: `js/camera.js` chases an aircraft, and a
     * canvas has no aircraft to chase.
     *
     * The keys held down move the view here rather than in the key handler, by
     * the clock's own `elapsed` - the simulation's step is 0 for as long as the
     * builder is open - so a held key moves it smoothly and at one speed
     * whatever rate the keyboard repeats at. And the camera is kept clear of the
     * ground under it, so a view taken low over a hill is not one from inside it.
     */
    trackCanvasCamera(elapsed = 0) {
        if (!this.buildCamera) this.buildCamera = createBuildCamera(this.terrain.size);
        this.buildCamera = moveBuildCamera(this.buildCamera, moveIntent(this.buildKeys), elapsed);
        this.placeCanvasCamera();

        // Select's panel reads back whatever a gesture just did to the view.
        this.syncDock();

        // What is under the pointer is asked again every frame rather than
        // only when it moves, because the view moving under a still pointer
        // moves the ground under it too.
        this.trackHover();

        // A gumball drag writes the edit on every move, and the ground is
        // drawn from it here - not every frame, because a canvas takes the
        // better part of a frame to draw, but often enough to watch it change.
        // An extrusion pulled up is the exception: its height is shown on the
        // overlay while it is dragged, and the ground drawn once, on release.
        if (this.groundStale && !this.gumballDrag?.preview && performance.now() - this.groundDrawnAt >= GROUND_REDRAW_MS) this.redrawCanvas();
    }

    /**
     * The committed placement under the pointer, which Select outlines lightly
     * as what a click would take - one ray and a weight per placement, so it
     * can follow the pointer every frame.
     *
     * Only with Select live, which is the tool a click picks with; never under
     * a question, which holds the canvas still; never while the view is being
     * dragged; and never for a finger, which has no hover - it is down on the
     * glass or not there at all.
     */
    trackHover() {
        const pointer  = this.canvasPointer;
        const drag     = this.canvasDrag;
        const dragging = (drag != null && (drag.travelled || !drag.picks)) || this.gumballDrag != null;
        const looking  = pointer != null && pointer.type !== 'touch' && !dragging && !confirmOpen(this.builder);

        // A handle of the gumball under the pointer comes before anything
        // under it on the ground: a press there drags the handle.
        const handle = looking ? gumballHit(this.gumball, pointer.x, pointer.y) : null;

        let hovered = null;
        if (looking && handle == null && buildModeTool(this.builder) === SELECT_TOOL && this.builder.placements.length > 0) {
            const point = this.pickCanvasPoint(pointer.x, pointer.y);
            if (point) hovered = placementAt(pickablePlacements(this.builder), point.x, point.z, this.terrain.size);
        }

        if (hovered !== this.hovered || handle !== this.gumballHover) {
            this.hovered = hovered;
            this.gumballHover = handle;
            this.renderer.domElement.style.cursor = this.canvasCursor();
        }
    }

    /**
     * The pointer over a canvas: a crosshair for a tool that drops at a click,
     * a hand over something Select would pick, and the arrow otherwise.
     */
    canvasCursor() {
        if (!buildModeDrawing(this.builder)) return '';
        if (this.gumballDrag != null || cameraHeld(this.builder)) return 'grabbing';
        if (this.gumballHover != null) return 'grab';
        const tool = buildModeTool(this.builder);
        if (eyeDropperArmed(this.builder)) return 'cell';
        if (dropsAtClick(tool) || tool === LASSO_PALETTE_TOOL || isStrokeTool(tool) || insertsTemplate(tool) || extrudeDrawing(this.builder)) return 'crosshair';
        return this.hovered != null ? 'pointer' : '';
    }

    /**
     * Draws the outlines over the canvas for the frame just rendered: the
     * placement under the pointer lightly, and the one in hand - picked with
     * Select or dropped by a tool - firmly. Each is traced once round its
     * reach and stood on the ground under it here, through the camera the
     * frame was drawn from, so it lies over the terrain however the view has
     * moved and costs no ground to draw.
     */
    drawBuildOverlay() {
        const layer = this.overlays.buildOverlay;
        const ctx   = this.overlayContext;
        if (!ctx) return;

        if (!buildModeDrawing(this.builder) || photoPending(this.photoState)) {
            if (this.overlayDrawn) {
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.clearRect(0, 0, layer.width, layer.height);
                this.overlayDrawn = false;
            }
            return;
        }

        // Drawn at the screen's own density, so a line is as sharp as the
        // ground under it.
        const ratio  = window.devicePixelRatio || 1;
        const width  = layer.clientWidth;
        const height = layer.clientHeight;
        const across = Math.round(width * ratio);
        const down   = Math.round(height * ratio);
        if (layer.width !== across || layer.height !== down) {
            layer.width = across;
            layer.height = down;
        }

        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.clearRect(0, 0, width, height);
        this.overlayDrawn = true;

        // The selection, whatever tool is live - it outlives the one that drew
        // it - and the shape the lasso is drawing, under everything else. In
        // Extrude the selection is what will be lifted rather than a clip, so
        // it is drawn solid red, and once shapes are drawn into it the region
        // they come to is filled red under a red dashed edge instead.
        const selection = this.builder.selection;
        const extruding = isExtrudeTool(buildModeTool(this.builder));
        const stage = extrudeStage(this.builder);
        const pending = extruding && stage === EXTRUDE_DRAWING && buildDraft(this.builder) != null;
        if (selection && !(extruding && buildDraft(this.builder) != null)) {
            const edge = contoured(selection)
                ? this.screenRuns(this.selectionEdges(selection), width, height)
                : this.screenRegion(footprintLoop(selection), true, width, height);
            strokePaths(ctx, edge, extruding ? EXTRUDE_REGION : SELECTION_OUTLINE);
        }
        if (pending) {
            const runs = this.screenRuns(this.selectionEdges(extrudeRegion(this.builder)), width, height);
            fillRegion(ctx, runs, EXTRUDE_FILL);
            strokePaths(ctx, runs, EXTRUDE_PENDING);
        }
        const drawing = this.lassoDrawingPath();
        if (drawing) strokePaths(ctx, this.screenRegion(drawing.points, drawing.closed, width, height), DRAWING_OUTLINE);

        // A stroke as far as it has gone, as the region it will cover - worked
        // out on the ground in world units, so it is as wide on the screen as
        // the stroke laid will be - in the cover trail's blue, or the paint's
        // own colour; and the brush a press would lay with, following a
        // pointer that can hover - so it is seen before it is pressed, and not
        // over a handle, where a press would take the handle instead, nor with
        // the eye dropper armed, where a press takes a colour, nor with the
        // popup open, where a press shuts it.
        const live  = buildModeTool(this.builder);
        const brush = isStrokeTool(live) ? strokeValues(this.builder) : null;
        if (brush && this.strokeDrawing) {
            const stamp = strokeStamp(buildTool(live), brush, this.strokeDrawing.scale);
            const runs  = strokeRibbon({ points: this.strokeDrawing.points, stamp })
                .flatMap(loop => this.screenRegion(loop, true, width, height));
            fillRegion(ctx, runs, this.strokeTrailColour(live, brush, this.strokeDrawing));
        }
        const pointer = this.canvasPointer;
        if (brush && pointer && pointer.type !== 'touch' && !confirmOpen(this.builder) && !eyeDropperArmed(this.builder)
            && !cameraHeld(this.builder) && deselectPopup(this.builder) == null && this.gumballHover == null && this.gumballDrag == null) {
            const tip = isPaintTool(live)
                ? stampOutline(pointer.x, pointer.y, brush.size, brush.size, brush.tip === 'square' ? 0 : brush.size / 2)
                : stampOutline(pointer.x, pointer.y, brush.buildWidth, brush.buildHeight, brush.cornerRadius);
            strokePaths(ctx, [tip], DRAWING_OUTLINE);
        }

        // The template Insert Runway carries, outlined on the ground where a
        // click would put it - the field is written once, on the click.
        if (insertsTemplate(buildModeTool(this.builder)) && !confirmOpen(this.builder) && !cameraHeld(this.builder)
            && this.gumballHover == null && this.gumballDrag == null) {
            for (const loop of this.insertPreview() ?? []) {
                strokePaths(ctx, this.screenRegion(loop, true, width, height), DRAWING_OUTLINE);
            }
        }

        const picked  = pickedIndex(this.builder);
        const hovered = this.hovered != null && this.hovered !== picked ? this.builder.placements[this.hovered] : null;
        const chosen  = buildDraft(this.builder);

        if (hovered) strokeOutline(ctx, this.screenOutline(hovered, width, height), HOVER_OUTLINE);
        if (chosen && !pending) strokeOutline(ctx, this.screenOutline(chosen, width, height), CHOSEN_OUTLINE);
        if (this.gumballDrag?.preview) this.drawPrism(ctx, chosen, width, height);

        // At an extrusion's surfaces, the one a click pointed the panel at,
        // edged in Extrude's red: the top round its rim, the wall at its foot
        // and its head.
        const surface = extruding ? extrudeSurface(this.builder) : null;
        if (surface && chosen?.footprint) {
            strokePaths(ctx, this.screenRuns(this.surfaceRuns(chosen.footprint, surface), width, height), EXTRUDE_REGION);
        }

        // The gumball on the edit in hand, laid out for this frame's camera and
        // kept so a press can be hit-tested against what is on the screen -
        // Extrude's only while it is extruding: while drawing there is nothing
        // lifted to take hold of, and its surfaces are chosen without it.
        const held = chosen && (!extruding || buildDraft(this.builder) == null || stage === EXTRUDE_EXTRUDING || this.builder.draft?.replaces != null);
        this.gumball = held ? this.gumballFor(chosen, width, height) : null;
        if (this.gumball) strokeGumball(ctx, this.gumball, this.gumballDrag?.handle ?? this.gumballHover);
    }

    /**
     * A placement's gumball as it falls on a screen `width` by `height`: its
     * centre stood on the ground under it and projected, and its three axes
     * projected from there, so it is drawn lying in the scene - with only the
     * handles bound to something the placement owns. Null for a placement
     * with no centre, or one the camera cannot see the centre of.
     */
    gumballFor(placement, width, height) {
        const centre = gumballCentre(placement);
        const handles = boundHandles(placement);
        if (centre == null || handles.length === 0) return null;

        const y = this.terrain.getTerrainHeightAt(centre.x, centre.z);
        const point = this.overlayPoint;
        const onScreen = (x, h, z) => {
            point.set(x, h, z).project(this.camera);
            if (!(point.z >= -1 && point.z <= 1)) return null;
            return { x: (point.x + 1) / 2 * width, y: (1 - point.y) / 2 * height };
        };

        const middle = onScreen(centre.x, y, centre.z);
        if (middle == null) return null;

        // A short step along each axis, scaled to how far off the camera is,
        // gives the direction and the foreshortening the axis is drawn with.
        const reach = Math.max(this.camera.position.distanceTo(point.set(centre.x, y, centre.z)) * 0.02, 1);
        const axes = {};
        for (const [name, direction] of Object.entries(GUMBALL_AXES)) {
            const end = onScreen(centre.x + direction.x * reach, y + direction.y * reach, centre.z + direction.z * reach);
            axes[name] = end ? { x: end.x - middle.x, y: end.y - middle.y } : { x: 0, y: 0 };
        }

        return gumballLayout(middle, axes, handles);
    }

    /**
     * The colour a stroke being drawn is shown in: Free Paint's own, the cover
     * trail's blue, or for Erase the take's red - or with `alt` held at the
     * press the green of what is put back.
     */
    strokeTrailColour(tool, brush, drawing) {
        if (isPaintTool(tool)) return paintTrailColour(brush.color, brush.opacity);
        if (isEraseTool(tool)) return drawing.alt ? ERASE_TRAIL.restore : ERASE_TRAIL.colour;
        return COVER_TRAIL.colour;
    }

    /**
     * An extrusion being pulled up, as the overlay previews it: its outline on
     * the ground, the same outline at the height the drag has reached, and the
     * corners joining them - the ground is written once, on release, since a
     * drag that drew a canvas on every move is the one place here the cost
     * would show. The top is where the lifted region stood when the drag began,
     * moved by however far the height has moved since, so the preview is exact
     * rather than approximate.
     */
    drawPrism(ctx, placement, width, height) {
        const drag = this.gumballDrag;
        if (placement == null || drag == null || !Number.isFinite(drag.top)) return;
        const top = drag.top + (Number(placement.config?.height) || 0) - drag.lifted;

        const segments = this.outlineOf(placement);
        const point = this.overlayPoint;
        const project = (x, y, z) => {
            point.set(x, y, z).project(this.camera);
            if (!(point.z >= -1 && point.z <= 1)) return null;
            return { x: (point.x + 1) / 2 * width, y: (1 - point.y) / 2 * height };
        };
        const base = projectOutline(segments, (x, z) => this.terrain.getTerrainHeightAt(x, z), project);
        const raised = projectOutline(segments, () => top, project);
        strokeOutline(ctx, base, EXTRUDE_PRISM);
        strokeOutline(ctx, raised, EXTRUDE_PRISM);

        // A corner every so often up the side, so the two outlines read as one
        // solid rather than as two loops.
        const every = Math.max(1, Math.floor(segments.length / 12));
        const sides = [];
        for (let i = 0; i < segments.length; i += every) {
            const [x, z] = segments[i];
            const foot = project(x, this.terrain.getTerrainHeightAt(x, z), z);
            const head = project(x, top, z);
            if (foot && head) sides.push([foot, head]);
        }
        strokePaths(ctx, sides, EXTRUDE_PRISM);
    }

    /** A placement's outline as it falls on a screen `width` by `height`. */
    screenOutline(placement, width, height) {
        const point = this.overlayPoint;
        return projectOutline(
            this.outlineOf(placement),
            (x, z) => this.terrain.getTerrainHeightAt(x, z),
            (x, y, z) => {
                point.set(x, y, z).project(this.camera);
                if (!(point.z >= -1 && point.z <= 1)) return null;
                return { x: (point.x + 1) / 2 * width, y: (1 - point.y) / 2 * height };
            }
        );
    }

    /**
     * A placement's outline on the canvas, traced the first time it is asked
     * for and kept by what it is the outline of - a value stepped on the panel
     * is a different placement, traced again, and a placement the pointer
     * passes back over is the one traced before.
     */
    outlineOf(placement) {
        const size = this.terrain.size;
        const key  = `${size}:${JSON.stringify(placement)}`;
        let segments = this.outlines.get(key);
        if (!segments) {
            // A session stepping a value through its range traces a new
            // outline at every step, and none of the old ones is wanted again.
            if (this.outlines.size >= 32) this.outlines.clear();
            segments = placementOutline(placement, size);
            this.outlines.set(key, segments);
        }
        return segments;
    }

    /** Stands the renderer's camera where the build camera's state says, clear of the ground. */
    placeCanvasCamera() {
        const { position, target } = buildCameraPosition(this.buildCamera);
        const stand = clearOfGround(position, this.terrain.getTerrainHeightAt(position.x, position.z));

        this.camera.up.set(0, 1, 0);
        this.camera.position.set(stand.x, stand.y, stand.z);
        this.camera.lookAt(target.x, target.y, target.z);
        this.camera.updateMatrixWorld();
    }

    // --- The pointer on a canvas ------------------------------------------

    /**
     * Listens for the pointer on the renderer's canvas, once, for as long as
     * the page is open.
     *
     * Every handler returns at once unless a canvas is open, so the flight is
     * untouched by construction rather than by each handler remembering to be
     * careful. A press the camera takes is captured, so a drag that wanders
     * over the palette or the control list stays the drag it began as; the
     * wheel is kept from zooming the page; and the right button's menu is kept
     * off the canvas, because shift and the right button pans.
     */
    setupBuilderPointer() {
        const surface = this.renderer.domElement;

        surface.addEventListener('pointerdown',        (e) => this.onCanvasPress(e));
        surface.addEventListener('pointermove',        (e) => this.onCanvasDrag(e));
        surface.addEventListener('pointerup',          (e) => this.onCanvasRelease(e));
        surface.addEventListener('pointercancel',      (e) => this.onCanvasRelease(e));
        surface.addEventListener('lostpointercapture', (e) => this.onCanvasRelease(e));
        surface.addEventListener('pointerleave',       () => { this.canvasPointer = null; });
        surface.addEventListener('wheel',              (e) => this.onCanvasWheel(e), { passive: false });
        surface.addEventListener('contextmenu', (e) => {
            if (!buildModeDrawing(this.builder)) return;
            e.preventDefault();
            this.onCanvasMenu(e);
        });

        // The popup's own button, and a press anywhere else off the canvas -
        // the palette, the dock - shutting it. A press on the canvas shuts it
        // in `onCanvasPress`, which also keeps that press off the ground.
        this.overlays.popup.addEventListener('click', (e) => this.onPopupPress(e));
        this.overlays.popup.addEventListener('contextmenu', (e) => e.preventDefault());
        document.addEventListener('pointerdown', (e) => {
            if (e.target === surface || this.overlays.popup.contains(e.target)) return;
            if (closeDeselectPopup(this.builder)) this.syncOverlays();
        }, true);
    }

    /**
     * A press on the canvas: the camera takes it if the press and the live tool
     * make a gesture, and a tool that drops at a click takes a plain press of
     * the main button - a mouse's left, or a finger.
     *
     * A plain press of the main button with Select live is held as one that
     * may yet be a click: the view does not turn until it has travelled past
     * what a click may, and one let go of before then picks what is under it
     * rather than orbiting.
     */
    onCanvasPress(e) {
        if (!buildModeDrawing(this.builder) || this.canvasDrag || this.gumballDrag) return;

        // A press anywhere off the popup shuts it, and does nothing else: it
        // was the answer to the popup, not a press on the ground under it.
        if (closeDeselectPopup(this.builder)) {
            e.preventDefault();
            this.syncOverlays();
            return;
        }

        // Where a right press went down, so the click it ends in can be told
        // from a drag that panned.
        this.rightPress = e.button === 2 ? { x: e.clientX, y: e.clientY, type: e.pointerType } : null;

        // A press on a handle of the gumball drags that handle, whichever tool
        // is live: it is the edit in hand's, and comes before an orbit, a pick
        // or a drop. `ctrl` and the centre is pressed and does nothing.
        const handle = e.button === 0 ? gumballHit(this.gumball, e.clientX, e.clientY) : null;
        if (handle != null) {
            e.preventDefault();
            const pressed = pressHandle(handle, e);
            if (pressed) this.beginGumballDrag(e, pressed);
            return;
        }

        const tool    = buildModeTool(this.builder);
        const gesture = cameraGesture(e, tool);
        if (!gesture) {
            // With auto accept on for drawing, a press that draws again keeps
            // what is in hand first, so what it draws starts a draft of its
            // own. Nothing was kept on the release before it, so until this
            // press the stroke just drawn could still be changed.
            if (e.button === 0 && !(e.shiftKey && dropsAtClick(tool)) && drawAgain(this.builder)) this.draftKept();
            if (e.button === 0 && !e.shiftKey && dropsAtClick(tool)) this.dropAt(e);
            else if (e.button === 0 && (tool === LASSO_PALETTE_TOOL || extrudeDrawing(this.builder))) this.lassoPress(e);
            else if (e.button === 0 && eyeDropperArmed(this.builder)) this.dropperAt(e);
            else if (e.button === 0 && extrudeStage(this.builder) === EXTRUDE_SURFACES) this.surfacePress(e);
            else if (e.button === 0 && isStrokeTool(tool)) this.strokePress(e);
            else if (e.button === 0 && insertsTemplate(tool)) this.insertAt(e);
            return;
        }

        e.preventDefault();
        this.renderer.domElement.setPointerCapture(e.pointerId);
        this.canvasDrag = {
            pointer: e.pointerId, gesture, x: e.clientX, y: e.clientY,
            start: { x: e.clientX, y: e.clientY },
            type: e.pointerType,
            picks: tool === SELECT_TOOL && e.button === 0 && !e.shiftKey,
            travelled: false
        };
        // From inside a tool the pan is an override: the tool is suspended,
        // not changed, so a shape half drawn waits for it rather than being
        // committed or asked about.
        if (holdCamera(this.builder)) this.renderer.domElement.style.cursor = this.canvasCursor();
    }

    /**
     * A right click on the canvas: on the selection, the popup carrying
     * `DESELECT` opens at the pointer, whatever tool is live; anywhere else,
     * and after a right drag that panned, nothing does. A click with `shift`
     * is the start of a pan, and nothing is opened under a drag or a stroke.
     */
    onCanvasMenu(e) {
        const press = this.rightPress;
        this.rightPress = null;
        if (press == null || e.shiftKey || travelledPast(press, { x: e.clientX, y: e.clientY }, press.type)) return;
        if (this.strokeDrawing || this.lassoDrawing || this.gumballDrag || this.canvasDrag) return;

        const selection = this.builder.selection;
        const point = selection ? this.pickCanvasPoint(e.clientX, e.clientY) : null;
        const inside = point != null && footprintWeight(selection, point.x, point.z, this.terrain.size) > 0;
        if (openDeselectPopup(this.builder, { x: e.clientX, y: e.clientY }, inside)) this.syncOverlays();
    }

    /**
     * A click with a tool that drops: the edit begun where the ground under
     * the pointer is, or the one in hand put down there instead, and the
     * ground drawn again with it. A click over the sky or off the canvas lands
     * on nothing and does nothing.
     */
    dropAt(e) {
        const point = this.pickCanvasPoint(e.clientX, e.clientY);
        if (!point || !dropDraft(this.builder, point, { size: this.terrain.size })) return;

        e.preventDefault();
        this.redrawCanvas();
        this.syncOverlays();
    }

    /**
     * A click with Insert Runway armed: the chosen template placed where the
     * ground under the pointer is, lined up with the view to the nearest ten
     * degrees - or the one in hand put down there instead - and the ground
     * drawn again with it. A click over the sky, or with no card chosen,
     * places nothing.
     */
    insertAt(e) {
        const point = this.pickCanvasPoint(e.clientX, e.clientY);
        if (!point || !insertTemplate(this.builder, point, arrivalHeading(viewBearing(this.buildCamera)), { size: this.terrain.size })) return;

        e.preventDefault();
        this.redrawCanvas();
        this.syncOverlays();
    }

    /**
     * The template Insert Runway is armed with, as it would land under a
     * pointer that can hover - lined up with the view, held on the canvas - as
     * the outlines of its strips, on the canvas's frame. Null with no card
     * chosen, or over the sky.
     */
    insertPreview() {
        const id = buildRunwayTemplate(this.builder);
        const pointer = this.canvasPointer;
        if (id == null || pointer == null || pointer.type === 'touch') return null;

        const ground = this.pickCanvasPoint(pointer.x, pointer.y);
        if (ground == null) return null;

        const size = this.terrain.size;
        const placed = placeTemplate(id, [ground.x, ground.z], arrivalHeading(viewBearing(this.buildCamera)));
        placed.config.at = keepStripOnCanvas(placed.config.at, groupReach(placed), size);
        return [...groupStrips(placed, size), ...groupLots(placed, size)].map(strip => footprintLoop(strip));
    }

    /**
     * The pointer moving over a canvas, which is where the hover is read from,
     * and under a drag: the camera turns or slides by how far it went. A press
     * that may yet be a click moves nothing until it has travelled past one,
     * and then moves by the whole of the way it came, so no turn is lost.
     */
    onCanvasDrag(e) {
        if (!buildModeDrawing(this.builder)) return;
        this.canvasPointer = { x: e.clientX, y: e.clientY, type: e.pointerType };

        if (this.gumballDrag && e.pointerId === this.gumballDrag.pointer) {
            this.dragGumball(e);
            return;
        }

        if (this.lassoDrawing?.gesture === LASSO_DRAG && e.pointerId === this.lassoDrawing.pointer) {
            this.dragLasso(e);
            return;
        }

        if (this.strokeDrawing && e.pointerId === this.strokeDrawing.pointer) {
            this.dragStroke(e);
            return;
        }

        const drag = this.canvasDrag;
        if (!drag || e.pointerId !== drag.pointer) return;

        if (drag.picks && !drag.travelled) {
            if (!travelledPast(drag.start, { x: e.clientX, y: e.clientY }, drag.type)) return;
            drag.travelled = true;
        }

        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        drag.x = e.clientX;
        drag.y = e.clientY;

        // The builder's camera speed scales every gesture together.
        const speed = this.buildCameraSpeed ?? 1;
        this.buildCamera = drag.gesture === CAMERA_ORBIT
            ? orbitBuildCamera(this.buildCamera, dx * speed, dy * speed)
            : panBuildCamera(this.buildCamera, dx * speed, dy * speed, {
                viewHeight: this.renderer.domElement.clientHeight,
                fov: this.camera.fov
            });
    }

    /**
     * The press let go of, cancelled, or its capture lost: the drag ends where
     * it is. A Select press let go of before it travelled was a click, and
     * picks what is under it; one cancelled or taken away picks nothing.
     */
    onCanvasRelease(e) {
        if (this.gumballDrag && e.pointerId === this.gumballDrag.pointer) {
            this.endGumballDrag();
            return;
        }

        if (this.lassoDrawing?.gesture === LASSO_DRAG && e.pointerId === this.lassoDrawing.pointer) {
            // Let go of, the shape is made; cancelled or taken away, it is not.
            const drawn = this.lassoDrawing;
            this.cancelLasso();
            if (e.type === 'pointerup' && drawn.travelled) this.finishLasso(drawn);
            return;
        }

        if (this.strokeDrawing && e.pointerId === this.strokeDrawing.pointer) {
            // Let go of, the stroke is laid; cancelled or taken away, it is not.
            const drawn = this.strokeDrawing;
            this.cancelStroke();
            if (e.type === 'pointerup') this.finishStroke(drawn);
            return;
        }

        const drag = this.canvasDrag;
        if (!drag || e.pointerId !== drag.pointer) return;

        const click = e.type === 'pointerup' && drag.picks && !drag.travelled;
        this.endCanvasDrag();
        if (click) this.pickAt(e.clientX, e.clientY);
    }

    /**
     * A handle of the gumball pressed: the drag begins from the edit in hand
     * as it stands, and from the ground under the press - or, pressed over the
     * sky, from the gumball's own centre - so every move after it is worked
     * out from the grab rather than from the move before.
     */
    beginGumballDrag(e, pressed) {
        const draft = buildDraft(this.builder);
        if (draft == null || this.gumball == null) return;

        this.renderer.domElement.setPointerCapture(e.pointerId);
        const centre = gumballCentre(draft);
        // Pulling an extrusion up is previewed on the overlay rather than drawn,
        // from the top the lifted region stands at now and the height it has.
        const preview = draft.type === 'extrude' && handleBinding(pressed.handle, draft)?.mode === 'lift';
        this.gumballDrag = {
            pointer: e.pointerId,
            handle: pressed.handle,
            uniform: pressed.uniform,
            preview,
            top: preview ? this.liftedTop(draft) : null,
            lifted: Number(draft.config?.height) || 0,
            grab: structuredClone(draft),
            start: { x: e.clientX, y: e.clientY },
            ground: this.pickCanvasPoint(e.clientX, e.clientY) ?? (centre && { x: centre.x, z: centre.z }),
            moved: { dx: 0, dz: 0 },
            layout: this.gumball,
            type: e.pointerType,
            travelled: false
        };
        this.renderer.domElement.style.cursor = this.canvasCursor();
    }

    /** The mean height of the ground an extrusion wholly covers on the canvas as it is drawn now - its top. */
    liftedTop(placement) {
        const field = this.terrain.tileAt(0, 0)?.field;
        if (field == null || placement?.footprint == null) return null;
        const weigh = footprintSampler(placement.footprint, field.size);
        let total = 0, count = 0;
        for (let i = 0; i < field.count; i++) {
            const x = (i % field.stride) * field.step - field.size / 2;
            const z = Math.floor(i / field.stride) * field.step - field.size / 2;
            if (weigh(x, z) < 1) continue;
            total += field.height[i];
            count++;
        }
        return count > 0 ? total / count : null;
    }

    /**
     * The pointer moving under a handle: what the drag as a whole writes on
     * the placement as it was grabbed, through the holder the dock steps - so
     * the dock's figures follow the drag and both are held to the same bounds.
     * Over the sky the ground stays where it was last read.
     *
     * Nothing is written until the press has travelled further than a click
     * may, the rule a click on the canvas is told from an orbit by: a press on
     * the centre that wobbles as it lands - a finger's always does - is a
     * click, and leaves the placement exactly as it was. Past that, the drag
     * is read from the press, so nothing it travelled is lost.
     */
    dragGumball(e) {
        const drag = this.gumballDrag;
        const now  = { x: e.clientX, y: e.clientY };
        if (!drag.travelled) {
            if (!travelledPast(drag.start, now, drag.type)) return;
            drag.travelled = true;
        }

        const point = this.pickCanvasPoint(now.x, now.y);
        if (point && drag.ground) drag.moved = { dx: point.x - drag.ground.x, dz: point.z - drag.ground.z };

        const changes = dragHandle(drag.grab, drag.handle, {
            ground: drag.moved,
            along: alongAxis(drag.layout, drag.handle, drag.start, now),
            turn: sweepAround(drag.layout.centre, drag.start, now),
            uniform: drag.uniform
        }, { size: this.terrain.size });
        if (changes) this.writeGumball(changes);
    }

    /**
     * Writes what a handle moved into the edit in hand, by the door the dock's
     * rows go through: a declared range into the holder and from there into
     * the draft, the point and the footprint into the draft directly. The
     * ground is left to the frame, which draws it while the drag goes on.
     */
    writeGumball(changes) {
        const footprint = changes.footprint ?? null;

        // A drag that moved only the footprint - every handle of a cover
        // batch's gumball, which moves, turns and stretches its frame - writes
        // the footprint alone, so the draft's configuration stays what its
        // panel says rather than taking on every default the holder filled in.
        if (Object.keys(changes.config ?? {}).length === 0) {
            if (footprint) reviseDraft(this.builder, { footprint });
            this.groundStale = true;
            this.syncOverlays();
            return;
        }

        const holder = this.currentDraftHolder();
        const written = {};
        for (const [name, value] of Object.entries(changes.config ?? {})) {
            if (name !== 'at' && holder?.config && name in holder.config) holder.config[name] = structuredClone(value);
            else written[name] = value;
        }

        reviseDraft(this.builder, {
            config: { ...(holder?.config ?? {}), ...written },
            ...(footprint ? { footprint } : {})
        });
        this.groundStale = true;
        this.syncOverlays();
    }

    /**
     * The drag of a handle let go of, cancelled, or ended by `Escape`: the
     * edit stays where the drag left it, and the ground is drawn from it.
     */
    endGumballDrag(redraw = true) {
        const drag = this.gumballDrag;
        if (!drag) return;

        this.gumballDrag = null;
        const surface = this.renderer.domElement;
        if (surface.hasPointerCapture?.(drag.pointer)) surface.releasePointerCapture(drag.pointer);
        if (redraw && this.groundStale) this.redrawCanvas();
        if (!redraw) this.groundStale = false;
        surface.style.cursor = this.canvasCursor();
    }

    /**
     * A press with the lasso: the start of a drag for the tools that draw by
     * dragging, or a point placed - or the shape closed on one - for those that
     * draw a click per vertex. A drag begun over the sky begins nothing; a
     * point clicked there is not placed.
     */
    lassoPress(e) {
        const tool = this.liveShapeTool();
        if (tool == null) return;
        const mode = buildModeTool(this.builder);

        const ground = this.pickCanvasPoint(e.clientX, e.clientY);
        const screen = { x: e.clientX, y: e.clientY };
        e.preventDefault();

        // How the shape meets the selection, read here once and never again:
        // `shift` adds it, `alt` cuts it out, and neither draws it inside.
        const op = lassoOp(e, selectionLive(this.builder));

        if (tool.gesture === LASSO_CLICKS) {
            // The second press of the double click that closed a shape is
            // still that double click, not the first point of another.
            const closed = this.lassoClosed;
            this.lassoClosed = null;
            if (closed && performance.now() - closed.time < DOUBLE_CLICK_MS
                && Math.hypot(screen.x - closed.x, screen.y - closed.y) <= CLOSE_PIXELS) return;

            const drawing = this.lassoDrawing?.tool === tool.id ? this.lassoDrawing : null;
            const shape = clickVertex(drawing, ground, screen);
            if (shape.closed) {
                this.cancelLasso();
                this.lassoClosed = { ...screen, time: performance.now() };
                this.finishLasso({ mode, tool: tool.id, shape: tool.shape, points: shape.points, op: drawing?.op ?? op, square: false });
            } else {
                // A shape of clicks keeps the op its first click latched.
                this.lassoDrawing = {
                    gesture: LASSO_CLICKS, mode, tool: tool.id, shape: tool.shape, points: shape.points, screens: shape.screens,
                    op: drawing?.op ?? op
                };
            }
            return;
        }

        if (ground == null) return;
        this.renderer.domElement.setPointerCapture(e.pointerId);
        this.lassoDrawing = {
            gesture: LASSO_DRAG, mode, tool: tool.id, shape: tool.shape, pointer: e.pointerId, points: [ground], last: screen,
            start: screen, type: e.pointerType, travelled: false,
            op, shiftUp: !e.shiftKey, square: false
        };
    }

    /**
     * The pointer moving under a lasso drag: a free shape gathers the ground
     * under it every few pixels it travels, and a box or an ellipse is sized to
     * where it is now. Over the sky nothing is gathered.
     */
    dragLasso(e) {
        const drawing = this.lassoDrawing;
        const screen  = { x: e.clientX, y: e.clientY };

        // `shift` held from the press is the add it latched; pressed again
        // once the drag is under way, it keeps a box square and an ellipse
        // round.
        Object.assign(drawing, squareInDrag(drawing, e.shiftKey));

        // A drag is a shape only once it has travelled further than a click
        // may, the rule every press on the canvas keeps: a box a few pixels
        // across is a slip, however far off the camera stands.
        if (!drawing.travelled) {
            if (!travelledPast(drawing.start, screen, drawing.type)) return;
            drawing.travelled = true;
        }

        const ground  = this.pickCanvasPoint(screen.x, screen.y);
        if (ground == null) return;

        if (shapeOf(drawing.shape)?.kind === 'ring') {
            if (Math.hypot(screen.x - drawing.last.x, screen.y - drawing.last.y) < LASSO_SAMPLE_PIXELS) return;
            drawing.points.push(ground);
            drawing.last = screen;
        } else {
            drawing.points = [drawing.points[0], ground];
        }
    }

    /**
     * A shape finished: the region it comes to drawn into the selection by the
     * op its press latched - the selection where there was none, added to it,
     * drawn inside it or cut out of it - and a shape that came to no region, a
     * box a few pixels across or a ring of two points, changes nothing.
     */
    finishLasso(drawn) {
        const { mode, tool, shape, points, op, square = false } = drawn;
        const footprint = shapeFootprint(shape, points, this.shapeValues(mode), { square });
        if (footprint && mode === LASSO_PALETTE_TOOL) drawIntoSelection(this.builder, footprint, op, { tool, size: this.terrain.size });
        else if (footprint && isExtrudeTool(mode)) drawExtrudeShape(this.builder, footprint, op, { size: this.terrain.size });
        this.syncOverlays();
    }

    /**
     * The shape tool the live tool draws with: the lasso's chosen tool, or
     * Extrude's chosen shape while it is drawing - the one vocabulary, see
     * `js/shapes.js`, offered by two modes that differ only in what is done
     * with the region drawn. Null for any other tool.
     */
    liveShapeTool() {
        const tool = buildModeTool(this.builder);
        if (tool === LASSO_PALETTE_TOOL) return lassoTool(buildLassoTool(this.builder));
        if (extrudeDrawing(this.builder)) return extrudeTool(buildExtrudeTool(this.builder));
        return null;
    }

    /** The fields of the shape a mode draws with: the lasso's chosen tool's, or Extrude's chosen shape's. */
    shapeValues(mode) {
        return isExtrudeTool(mode) ? extrudeValues(this.builder) : lassoValues(this.builder);
    }

    /**
     * A press with a stroke tool - the cover tool or Free Paint: the start of
     * a stroke, at the ground under the press, with the scale a screen pixel
     * spans there - which is what the brush's pixels come to in the world, so
     * the stamp is laid the size it is on the glass. A press over the sky
     * begins nothing. The stroke owns the pointer until it is let go, wherever
     * it wanders, so a stroke dragged over the palette or the dock stays the
     * stroke it began as.
     */
    strokePress(e) {
        const ground = this.pickCanvasPoint(e.clientX, e.clientY);
        if (ground == null) return;

        e.preventDefault();
        const surface = this.renderer.domElement;
        surface.setPointerCapture(e.pointerId);
        const distance = this.camera.position.distanceTo(this.overlayPoint.set(ground.x, ground.y ?? this.terrain.getTerrainHeightAt(ground.x, ground.z), ground.z));
        this.strokeDrawing = {
            tool: buildModeTool(this.builder),
            // `alt` at the press, read once: with Erase, a stroke that puts back.
            alt: e.altKey === true,
            pointer: e.pointerId,
            points: [[ground.x, ground.z]],
            last: { x: e.clientX, y: e.clientY },
            scale: unitsPerPixel(distance, this.camera.fov, surface.clientHeight)
        };
    }

    /**
     * The pointer moving under a stroke: the ground under it gathered every few
     * pixels it travels, each sample stood on the ground as it is taken, so the
     * stroke on the screen is the stroke that is laid. Over the sky nothing is
     * gathered.
     */
    dragStroke(e) {
        const drawing = this.strokeDrawing;
        const screen  = { x: e.clientX, y: e.clientY };
        if (Math.hypot(screen.x - drawing.last.x, screen.y - drawing.last.y) < STROKE_SAMPLE_PIXELS) return;

        const ground = this.pickCanvasPoint(screen.x, screen.y);
        if (ground == null) return;
        drawing.points.push([ground.x, ground.z]);
        drawing.last = screen;
    }

    /**
     * A stroke let go of: laid into the tool's batch with the stamp the brush
     * comes to at the press's scale - the batch begun by it, or grown by it -
     * and the ground drawn again with the batch on it. A stroke the selection
     * cuts all of away lays nothing.
     */
    finishStroke(drawn) {
        if (drawn.tool !== buildModeTool(this.builder)) return;
        const stamp = strokeStamp(buildTool(drawn.tool), strokeValues(this.builder), drawn.scale);
        if (!layStroke(this.builder, drawn.points, stamp, { size: this.terrain.size, alt: drawn.alt })) return;
        this.redrawCanvas();
        this.syncOverlays();
    }

    /** Lets go of a stroke half drawn, laying nothing of it. */
    cancelStroke() {
        const drawing = this.strokeDrawing;
        if (!drawing) return;
        this.strokeDrawing = null;
        const surface = this.renderer.domElement;
        if (surface.hasPointerCapture?.(drawing.pointer)) surface.releasePointerCapture(drawing.pointer);
    }

    /**
     * The holder a stroke tool's panel is stepped through, made when the tool
     * is chosen and kept while it is live - across strokes and batches alike,
     * since one panel carries from each batch to the next - and made again
     * when something other than the panel changes what it holds: the eye
     * dropper's colour, or `DEFAULT`'s brush.
     */
    currentStrokeHolder() {
        const tool = buildModeTool(this.builder);
        if (!isStrokeTool(tool)) {
            this.strokeHolder = null;
            return null;
        }
        if (this.strokeHolder?.tool !== tool) this.strokeHolder = { tool, ...strokeHolderFor(this.builder, tool) };
        return this.strokeHolder;
    }

    /** Lets go of a shape half drawn, keeping nothing of it. */
    cancelLasso() {
        const drawing = this.lassoDrawing;
        if (!drawing) return;
        this.lassoDrawing = null;
        const surface = this.renderer.domElement;
        if (drawing.pointer != null && surface.hasPointerCapture?.(drawing.pointer)) surface.releasePointerCapture(drawing.pointer);
    }

    /**
     * The shape being drawn as a run of canvas points, closed or not: a free
     * shape as far as it has gone, a box or an ellipse as the region it would
     * make if let go of now, and a click per vertex as its points with a last
     * leg out to the ground under the pointer.
     */
    lassoDrawingPath() {
        const drawing = this.lassoDrawing;
        if (!drawing) return null;
        const tool = shapeOf(drawing.shape);
        const points = drawing.points.map(p => [p.x, p.z]);

        if (drawing.gesture === LASSO_DRAG && tool?.kind !== 'ring') {
            const region = shapeFootprint(drawing.shape, drawing.points, this.shapeValues(drawing.mode), { square: drawing.square });
            return region ? { points: footprintLoop(region), closed: true } : { points, closed: false };
        }

        // Out to the pointer, unless the pointer is panning the view.
        if (drawing.gesture === LASSO_CLICKS && this.canvasPointer && !cameraHeld(this.builder)) {
            const ground = this.pickCanvasPoint(this.canvasPointer.x, this.canvasPointer.y);
            if (ground) points.push([ground.x, ground.z]);
        }

        // A curve is drawn as the curve it will be, through its points and out
        // to the pointer, left open until it is closed.
        if (tool?.kind === 'path' && points.length >= 3) {
            return { points: flattenPath({ kind: 'path', points, closed: false }), closed: false };
        }
        return { points, closed: false };
    }

    /**
     * A combined selection's edge, traced from its weight the first time it is
     * asked for and kept for as long as the selection is that one - a trace is
     * a few hundredths of a second, and a frame comes many times a second.
     */
    selectionEdges(selection) {
        const key = `${this.terrain.size}:${JSON.stringify(selection)}`;
        if (this.selectionTrace?.key !== key) this.selectionTrace = { key, runs: regionEdges(selection, this.terrain.size) };
        return this.selectionTrace.runs;
    }

    /** An extrusion's surface's edge, traced once for its footprint and kept, as a selection's is. */
    surfaceRuns(footprint, surface) {
        const key = `${this.terrain.size}:${surface}:${JSON.stringify(footprint)}`;
        if (this.surfaceTrace?.key !== key) this.surfaceTrace = { key, runs: surfaceEdges(footprint, surface, this.terrain.size) };
        return this.surfaceTrace.runs;
    }

    /** A run of canvas points as it falls on a screen `width` by `height`, wherever on the canvas it repeats. */
    screenRegion(points, closed, width, height) {
        return this.screenRuns(canvasPieces(subdividePath(points, PATH_STEP, closed), this.terrain.size), width, height);
    }

    /** Runs of canvas points already on the canvas, each stood on the ground and projected. */
    screenRuns(runs, width, height) {
        const point = this.overlayPoint;
        const project = (x, y, z) => {
            point.set(x, y, z).project(this.camera);
            if (!(point.z >= -1 && point.z <= 1)) return null;
            return { x: (point.x + 1) / 2 * width, y: (1 - point.y) / 2 * height };
        };
        const heightAt = (x, z) => this.terrain.getTerrainHeightAt(x, z);
        return runs.flatMap(run => projectPath(run, heightAt, project));
    }

    /**
     * A click with Select: the committed placement under it picked, the one
     * already picked kept, or - on bare ground, or over the sky - the pick let
     * go of. A pick that was changed asks `ACCEPT EDITS` before it is let go.
     */
    pickAt(clientX, clientY) {
        const point = this.pickCanvasPoint(clientX, clientY);
        const index = point ? placementAt(pickablePlacements(this.builder), point.x, point.z, this.terrain.size) : null;

        const answer = selectPlacement(this.builder, index);
        if (answer?.confirm) this.confirmOpened();
        else if (answer) this.syncOverlays();
    }

    /** Ends the drag being made, if one is, and gives the pointer back. */
    endCanvasDrag() {
        const drag = this.canvasDrag;
        if (!drag) return;

        this.canvasDrag = null;
        const surface = this.renderer.domElement;
        if (surface.hasPointerCapture?.(drag.pointer)) surface.releasePointerCapture(drag.pointer);
        // Let go of, a pan held from inside a tool puts the tool back.
        if (releaseCamera(this.builder) != null) surface.style.cursor = this.canvasCursor();
    }

    /**
     * The wheel over the canvas zooms the view, and nothing else - not the page.
     * It zooms toward the ground under the pointer, so what is pointed at stays
     * under the pointer, and toward the middle of the screen where the pointer
     * is over the sky.
     */
    onCanvasWheel(e) {
        if (!buildModeDrawing(this.builder)) return;

        e.preventDefault();
        const point = this.pickCanvasPoint(e.clientX, e.clientY);
        const travel = wheelPixels(e.deltaY, e.deltaMode) * (this.buildCameraSpeed ?? 1);
        this.buildCamera = zoomBuildCameraToward(this.buildCamera, travel, point);
    }

    // --- The dock ----------------------------------------------------------

    /** True while a key is being typed into one of the dock's fields. */
    editingDockField(e) {
        return e.target instanceof HTMLInputElement && this.overlays.dock.contains(e.target);
    }

    /**
     * Draws the dock for the session as it stands: the edit in hand with its
     * accept and cancel, or the live tool's panel, or nothing off a canvas.
     */
    syncDock(canvas = null) {
        const showing = canvas ?? buildModeDrawing(this.builder);
        this.dockShown = showing
            ? dockContent(this.builder, {
                camera: this.buildCamera,
                fov: this.camera.fov,
                size: this.terrain.size,
                holder: isStrokeTool(buildModeTool(this.builder)) ? this.currentStrokeHolder() : this.currentDraftHolder(),
                open: [...this.worldOpen]
            })
            : null;
        this.dockView.render(this.dockShown);
    }

    /**
     * The holder the edit in hand is stepped through, made when the edit is
     * begun and let go when it is settled - so a gradient's shades are measured
     * against the colours it had when the edit began, however far it is moved.
     */
    currentDraftHolder() {
        if (!draftPending(this.builder)) {
            this.draftHolder = null;
            return null;
        }
        if (this.draftHolder?.draft !== this.builder.draft) {
            this.draftHolder = { draft: this.builder.draft, ...draftHolderFor(buildDraft(this.builder)) };
        }
        return this.draftHolder;
    }

    /** A row of the dock stepped: one press along what its range allows. */
    onDockStep(entry, step, coarse = false) {
        const holder = this.dockHolder(entry);
        if (!holder || !stepRow(holder, entry.name, entry.row, coarse ? coarseStep(entry.row, step) : step)) return;
        this.applyDockValue(entry);
    }

    /** The holder a row of the dock writes: the first part's, or its section's. */
    dockHolder(entry) {
        const shown = this.dockShown;
        if (!shown) return null;
        if (!entry.section) return shown.holder;
        return shown.sections?.find(section => section.id === entry.section)?.holder ?? null;
    }

    /**
     * One of a mode's own tiles pressed on its panel: a template's card arms
     * Insert Runway with it - and turns the one in hand into it - and a lasso
     * tool is what the next shape is drawn with.
     */
    onDockShape(id) {
        if (this.dockShown?.kind === DOCK_PAINT) {
            if (id !== DOCK_DEFAULT_BRUSH.id || !resetBrush(this.builder)) return;
            this.strokeHolder = null;
            this.syncOverlays();
            return;
        }
        if (this.dockShown?.kind === DOCK_EXTRUDE) {
            // Picking a shape with an extrusion lifted keeps it and goes back
            // to drawing, so the ground is drawn with it kept.
            const lifted = extrudeStage(this.builder) !== EXTRUDE_DRAWING;
            if (!chooseExtrudeTool(this.builder, id)) return;
            this.cancelLasso();
            this.draftHolder = null;
            if (lifted) this.redrawCanvas();
            this.syncOverlays();
            return;
        }
        if (this.dockShown?.kind === DOCK_RUNWAY) {
            if (!chooseRunwayTemplate(this.builder, id)) return;
            if (draftPending(this.builder)) this.redrawCanvas();
            this.syncOverlays();
            return;
        }
        if (!chooseLassoTool(this.builder, id)) return;
        this.cancelLasso();
        this.syncDock();
    }

    /**
     * A colour chosen at a colour row - a swatch, a band of the picker, or a
     * hex figure typed - written into the row's holder and carried to what it
     * stands for, as a stepped value is.
     */
    onDockColor(entry, rgb) {
        const holder = this.dockHolder(entry);
        if (!holder) return;
        writeRowValue(holder, entry.name, entry.row, rgb);
        this.applyDockValue(entry);
    }

    /**
     * The draft in hand kept without a question - by auto accept - so the
     * panel's holders, made for it, are let go, and the ground is drawn again
     * where keeping it changes what is drawn.
     */
    draftKept() {
        this.draftHolder = null;
        this.strokeHolder = null;
        this.redrawCanvas();
    }

    /** An eye dropper pressed - Free Paint's, or a surface's colour row's: armed, or put down again. */
    onDockDropper(entry) {
        toggleEyeDropper(this.builder, entry?.name);
        this.renderer.domElement.style.cursor = this.canvasCursor();
        this.syncOverlays();
    }

    /**
     * A click on an extrusion at its surfaces: the panel pointed at the
     * surface under it - the top or the wall, read off the footprint's weight
     * there as the element paints them - or, off the extrusion, at both again.
     */
    surfacePress(e) {
        const footprint = buildDraft(this.builder)?.footprint;
        if (footprint == null) return;
        e.preventDefault();
        const point = this.pickCanvasPoint(e.clientX, e.clientY);
        const weight = point ? footprintWeight(footprint, point.x, point.z, this.terrain.size) : 0;
        if (!chooseExtrudeSurface(this.builder, surfaceAt(weight))) return;
        this.draftHolder = null;
        this.syncOverlays();
    }

    /**
     * A click with the eye dropper armed: the colour of the ground under it
     * taken as the brush's - and the batch in hand's, drawn again with it -
     * and the dropper put down. A click over the sky takes nothing and leaves
     * it armed.
     */
    dropperAt(e) {
        const point = this.pickCanvasPoint(e.clientX, e.clientY);
        const rgb = point ? this.terrain.getGroundColorAt(point.x, point.z) : null;
        if (rgb == null) return;

        e.preventDefault();
        const pending = draftPending(this.builder);
        if (!takeEyeDropperColor(this.builder, rgb)) return;
        this.strokeHolder = null;
        this.draftHolder = null;
        if (pending) this.redrawCanvas();
        this.renderer.domElement.style.cursor = this.canvasCursor();
        this.syncOverlays();
    }

    /** A folding section's heading pressed: an element of the world opened, or shut again. */
    onDockFold(id) {
        const section = this.dockShown?.sections?.find(each => each.id === id);
        if (!section?.folds) return;

        if (this.worldOpen.has(section.index)) this.worldOpen.delete(section.index);
        else this.worldOpen.add(section.index);
        this.syncDock();
    }

    /**
     * A figure typed into a row of the dock: taken when it is inside what the
     * range allows, and refused with the bounds otherwise, the field keeping
     * what was typed so it can be put right.
     */
    onDockType(entry, figure, field) {
        const holder = this.dockHolder(entry);
        if (!holder) return;

        const value = typedRowValue(entry.row, figure);
        const range = entry.row.range;
        if (value == null || value < range.low || value > range.high) {
            field.setCustomValidity(rangeNotice(entry.row));
            field.reportValidity();
            return;
        }

        field.setCustomValidity('');
        writeRowValue(holder, entry.name, entry.row, Number(value.toFixed(stepPlaces(rangeStep(range)))));
        // A slider is let go of by the pointer, not by the panel: taking the
        // focus off it would end the drag it is in the middle of.
        if (field.type !== 'range') field.blur();
        this.applyDockValue(entry);
    }

    /**
     * Carries a value a row of the dock now holds to what it stands for: the
     * camera for Select's own rows, the edit in hand - and the ground drawn
     * from it - for an edit's or a pick's, and the ground again for one of the
     * world's own elements, whose row is the session's own.
     */
    applyDockValue(entry) {
        const shown   = this.dockShown;
        const section = entry.section ? shown.sections?.find(each => each.id === entry.section) : null;
        const kind    = section ? section.kind : shown.kind;
        const holder  = section ? section.holder : shown.holder;
        const name    = entry.name;

        if (kind === DOCK_WORLD) {
            this.redrawCanvas();
            this.syncDock();
            return;
        }

        if (kind === DOCK_LASSO) {
            setLassoValues(this.builder, holder.config);
            this.syncDock();
            return;
        }

        // Extrude's rows: the next shape's fields while drawing, and once the
        // region is lifted, the extrusion's own, which draw the ground again.
        if (kind === DOCK_EXTRUDE) {
            if (shown.stage === EXTRUDE_DRAWING) {
                setExtrudeValues(this.builder, holder.config);
                this.syncDock();
                return;
            }
            reviseDraft(this.builder, { config: holder.config });
            this.redrawCanvas();
            this.syncOverlays();
            return;
        }

        // A stroke tool's panel: kept for the tool's next batch, and the
        // batch in hand changed with it - every stroke of it, so the ground
        // is drawn again. A brush row changes only the strokes still to come.
        if (kind === DOCK_COVER || kind === DOCK_PAINT || kind === DOCK_ERASE) {
            if (setStrokeValues(this.builder, holder.config)) {
                this.redrawCanvas();
                this.syncOverlays();
                return;
            }
            this.syncDock();
            return;
        }

        if (kind === DOCK_SELECT) {
            const { state, fov } = writeCameraField(this.buildCamera, this.camera.fov, name, holder.config[name]);
            this.buildCamera = state;
            if (fov !== this.camera.fov) {
                this.camera.fov = fov;
                this.camera.updateProjectionMatrix();
            }
        } else if (kind === DOCK_DRAFT || kind === DOCK_RUNWAY) {
            reviseDraft(this.builder, { config: holder.config });
            this.redrawCanvas();
            // A picked placement changed, or changed back, turns the accept
            // tile's question from saving to accepting or back again, so the
            // palette is drawn with the dock rather than after it.
            this.syncOverlays();
            return;
        }

        this.syncDock();
    }

    /**
     * Draws the popup a right click on the selection opened, at the point it
     * was opened and held inside the window, or takes it off the screen.
     */
    syncPopup(canvas = null) {
        const popup = this.overlays.popup;
        const at = (canvas ?? buildModeDrawing(this.builder)) ? deselectPopup(this.builder) : null;
        popup.style.display = at ? 'block' : 'none';
        if (!at) return;

        const width = popup.offsetWidth, height = popup.offsetHeight;
        popup.style.left = `${Math.max(Math.min(at.x, window.innerWidth - width - 4), 4)}px`;
        popup.style.top  = `${Math.max(Math.min(at.y, window.innerHeight - height - 4), 4)}px`;
    }

    /** The popup's `DESELECT` pressed: the selection dropped, as the panel's answer drops it. */
    onPopupPress(e) {
        if (!e.target.closest('[data-popup="deselect"]')) return;
        e.preventDefault();
        if (!deselect(this.builder)) closeDeselectPopup(this.builder);
        this.syncOverlays();
    }

    /** A `PAN` or `MOVE` row pressed: the view slid one press's worth. */
    onDockNudge(id, sign) {
        if (!this.buildCamera) return;
        this.buildCamera = nudgeBuildCamera(this.buildCamera, id, sign, {
            viewHeight: this.renderer.domElement.clientHeight,
            fov: this.camera.fov
        });
        this.syncDock();
    }

    /**
     * The edit in hand settled: accepted, which always commits it, or
     * cancelled, which always drops it - and the ground drawn again from what
     * is kept.
     */
    onDockAction(id) {
        if (id === DOCK_DESELECT.id) {
            if (deselect(this.builder)) this.syncOverlays();
            return;
        }

        // Extrude's one button: the region lifted - and the ground drawn with
        // it - the surfaces opened, or come back from.
        if (id === EXTRUDE_STAGE_ACTION) {
            const was = extrudeStage(this.builder);
            if (pressExtrudeStage(this.builder, { size: this.terrain.size }) == null) return;
            this.draftHolder = null;
            this.cancelLasso();
            if (was === EXTRUDE_DRAWING) this.redrawCanvas();
            this.renderer.domElement.style.cursor = this.canvasCursor();
            this.syncOverlays();
            return;
        }

        // `BACK` from the surfaces: the colours changed there dropped, and
        // the ground drawn again as it stood.
        if (id === EXTRUDE_BACK.id) {
            if (!backFromSurfaces(this.builder)) return;
            this.draftHolder = null;
            this.redrawCanvas();
            this.renderer.domElement.style.cursor = this.canvasCursor();
            this.syncOverlays();
            return;
        }

        if (id === DOCK_ACCEPT.id) acceptDraft(this.builder);
        else if (id === DOCK_CANCEL.id) cancelDraft(this.builder);
        else return;

        this.draftHolder = null;
        this.redrawCanvas();
        this.syncOverlays();
    }

    /**
     * Draws the canvas again from the environment's own placements and what
     * has been built on it, the edit in hand shown where it stands. The same
     * door a preset goes through: the built world is a description like any
     * other.
     */
    redrawCanvas() {
        const id = buildModeEnvironment(this.builder);
        if (!id) return;

        this.terrain.setEnvironment(id, { runway: false, elements: canvasElements(getEnvironment(id), this.builder) });
        this.canvasGround = this.readCanvasGround();
        this.groundStale = false;
        this.groundDrawnAt = performance.now();
    }

    onBuilderKey(e) {
        // `alt` cuts a shape out of the selection, and on its own some browsers
        // lift the focus to the window's menu with it, which in the middle of
        // a cut takes the next key from the canvas. On a canvas it is the
        // builder's.
        if (buildModeDrawing(this.builder) && CANVAS_SWALLOWED_KEYS.includes(e.code)) {
            e.preventDefault();
            return;
        }

        // A confirm open on the canvas takes every key: it is the one thing
        // the pilot has been asked, and nothing behind it moves until it is
        // answered or called off.
        if (buildModeDrawing(this.builder) && confirmOpen(this.builder)) {
            this.onConfirmKey(e);
            return;
        }

        // H opens and collapses the canvas's control list the way it does the
        // flight's, so the key that says how to work a screen is the same key
        // on both.
        if (buildModeDrawing(this.builder) && applyHelpKey(this.buildHelpState, e.code, true, e.repeat)) {
            this.syncOverlays();
            return;
        }

        // `O`, which opens the game's settings everywhere else, opens the
        // builder's own inside it - the screen a pilot in the editor is after.
        if (isBuilderSettingsOpenKey(e.code) && !e.repeat) {
            e.preventDefault();
            this.openBuilderSettingsPanel(BUILDER_SETTINGS_FROM_BUILDER);
            this.syncOverlays();
            return;
        }

        if (buildModeDrawing(this.builder)) {
            // Escape steps out of the innermost thing first: a drag being made
            // ends where it is, and only a press with nothing in progress asks
            // to leave.
            if ((this.canvasDrag || this.gumballDrag || this.lassoDrawing || this.strokeDrawing) && isCanvasLeaveKey(e.code)) {
                this.endCanvasDrag();
                this.endGumballDrag();
                this.cancelLasso();
                this.cancelStroke();
                return;
            }

            // The popup is shut before anything else is stepped out of.
            if (isCanvasLeaveKey(e.code) && closeDeselectPopup(this.builder)) {
                this.syncOverlays();
                return;
            }

            // An armed eye dropper is put down before leaving is asked about.
            if (isCanvasLeaveKey(e.code) && dropEyeDropper(this.builder)) {
                this.renderer.domElement.style.cursor = this.canvasCursor();
                this.syncOverlays();
                return;
            }

            // A move key is held rather than acted on, so the frame moves the
            // view for as long as it is down; the arrows would scroll a page
            // given the chance.
            if (isBuildMoveKey(e.code)) {
                e.preventDefault();
                this.buildKeys.add(e.code);
                return;
            }

            if (isReframeKey(e.code)) {
                e.preventDefault();
                this.buildCamera = reframeBuildCamera(this.buildCamera);
                return;
            }
        }

        // The picker is the builder's first screen rather than a gate in front
        // of it, so the way off it is the way out of the builder - by either of
        // a panel's two close keys there, and by Escape alone on a canvas.
        if (leavesBuilder(this.builder, e.code)) {
            this.requestLeaveBuilder();
            this.syncOverlays();
            return;
        }

        if (!buildModePicking(this.builder) || !isMenuKey(e.code)) return;

        // Space and the arrow keys scroll a page given the chance
        e.preventDefault();

        const chosen = applyMenuKey(this.pickerState, e.code, true, e.repeat);
        if (chosen) this.choosePickerRow(chosen);
        this.syncOverlays();
    }

    /**
     * The picker under the mouse. Every choice it offers goes through the same
     * place a chosen row does, so a click on a card chooses that canvas and a
     * click on `START` opens it - the same answers the keys get.
     */
    onPickerPointer(index, choose) {
        const chosen = applyMenuPointer(this.pickerState, index, choose);
        if (chosen) this.choosePickerRow(chosen);
        this.syncOverlays();
    }

    choosePickerRow(id) {
        const chosen = choosePickerEntry(this.picker, id);
        if (chosen == null) return;

        if (chosen.action === PICKER_LEFT) {
            this.requestLeaveBuilder();
            return;
        }

        if (chosen.action === PICKER_STARTED) {
            this.startCanvas(chosen.environment);
            return;
        }

        // A card moves the choice without leaving the picker, so the six can be
        // read over before one is settled on.
        this.redrawPicker();
    }

    /**
     * Asks to leave the builder, and leaves when the answer is to go.
     *
     * The accept tool, Escape and the picker's BACK all come here, so the three
     * ways out cannot come to ask different questions. Off the picker the
     * answer is to go. On a canvas it is a question - `ACCEPT EDITS` with an
     * edit in hand, `SAVE AND EXIT MODE` with none - and the confirm that asks
     * it opens.
     */
    requestLeaveBuilder() {
        const pending = editPending(this.builder);
        const asked = requestLeave(this.builder);
        if (pending && !draftPending(this.builder)) this.draftKept();
        if (asked?.leave) this.leaveBuilder();
        else if (asked?.confirm) this.confirmOpened();
    }

    /**
     * A confirm has just opened: it opens on `YES`, takes the focus so `Enter`
     * answers it rather than pressing whatever tile was last clicked, and stops
     * a drag or a held key from moving the view behind it.
     */
    confirmOpened() {
        resetSelection(this.confirmState);
        this.endCanvasDrag();
        this.endGumballDrag();
        this.cancelLasso();
        this.cancelStroke();
        this.buildKeys.clear();
        this.syncOverlays();
        this.overlays.confirmPanel.focus({ preventScroll: true });
    }

    /**
     * A key while a confirm is open. The arrows and their letters move between
     * the two buttons whichever way they point, since the buttons stand side by
     * side; `Enter` answers the one under the cursor; `Escape` calls the
     * question off. Each is kept from the page, so `Enter` never also presses a
     * tile that had the focus.
     */
    onConfirmKey(e) {
        if (isCanvasLeaveKey(e.code)) {
            e.preventDefault();
            this.answerBuildConfirm(CONFIRM_STAY);
            return;
        }

        if (isMenuAdjustKey(e.code)) {
            e.preventDefault();
            if (!e.repeat) moveSelection(this.confirmState, menuAdjustStep(e.code));
            this.syncOverlays();
            return;
        }

        if (!isMenuKey(e.code)) return;
        e.preventDefault();

        const chosen = applyMenuKey(this.confirmState, e.code, true, e.repeat);
        if (chosen) this.answerBuildConfirm(chosen);
        else this.syncOverlays();
    }

    /** The confirm under the mouse: the cursor follows the pointer, and a click answers. */
    onConfirmPointer(index, choose) {
        const chosen = applyMenuPointer(this.confirmState, index, choose);
        if (chosen) this.answerBuildConfirm(chosen);
        else this.syncOverlays();
    }

    /**
     * Answers the confirm that is open, and does what the answer says: leaves,
     * keeping what was built or not, or settles the edit in hand and draws the
     * ground again from what is kept - or, called off, does nothing at all.
     */
    answerBuildConfirm(answer) {
        const answered = answerConfirm(this.builder, answer);
        if (!answered) return;

        this.overlays.confirmPanel.blur();

        if (answered.leave) {
            const changed = answered.keep && this.saveBuiltWorld(answered.environment, answered.placements, answered.world);
            this.leaveBuilder(changed);
        } else if (answered.settled) {
            this.draftHolder = null;
            this.redrawCanvas();
        }

        this.syncOverlays();
    }

    /**
     * Draws the palette's tiles: the tools that work, in the order of the
     * twelve, each a button named for its tool. Drawn once, because which tools
     * are built does not change while the page is open; which one is live is
     * marked on them by `syncOverlays`.
     */
    drawPalette() {
        const palette = this.overlays.palette;
        palette.replaceChildren();

        // The chevrons across the head of the column, which fold the tools
        // away and bring them back: the one button on the palette that is not
        // a tool, so it carries no tool's id and is never lit as live.
        const fold = document.createElement('button');
        fold.type = 'button';
        fold.className = 'palette-fold';
        fold.dataset.palette = 'fold';
        fold.append(markImage(PALETTE_FOLD_MARK));
        fold.addEventListener('click', (event) => {
            this.onPaletteFold();
            if (event.detail > 0) fold.blur();
        });
        palette.append(fold);

        // The gear on the same band, which opens the builder's own settings.
        // It is not a tile: the tiles are tools, a tool has a draft, and the
        // settings have none.
        const gear = document.createElement('button');
        gear.type = 'button';
        gear.className = 'palette-gear';
        gear.dataset.palette = 'settings';
        gear.title = `${BUILDER_SETTINGS_NAME} (O)`;
        gear.setAttribute('aria-label', BUILDER_SETTINGS_NAME);
        gear.append(markImage(BUILDER_SETTINGS_MARK));
        gear.addEventListener('click', (event) => {
            if (event.detail > 0) gear.blur();
            if (this.openBuilderSettingsPanel(BUILDER_SETTINGS_FROM_BUILDER)) this.syncOverlays();
        });
        palette.append(gear);

        for (const tool of paletteTools()) {
            const tile = document.createElement('button');
            tile.type = 'button';
            tile.dataset.tool = tool.id;
            // The tool's own mark, and its name where a pointer resting on it
            // and a screen reader find it.
            tile.append(markImage(toolMark(tool.id)));
            tile.setAttribute('aria-label', toolName(tool.id));
            tile.title = `${toolName(tool.id)} - ${tool.hint}`;
            tile.addEventListener('click', (event) => {
                this.onPaletteClick(tool.id);
                // A tile clicked with the pointer gives the focus back, or the
                // next Enter would press it again; one reached by the keyboard
                // keeps it, which is how the keyboard works a row of buttons.
                if (event.detail > 0) tile.blur();
            });
            palette.append(tile);
        }
    }

    /** The chevrons pressed: the tools folded away, or brought back, and the choice kept. */
    onPaletteFold() {
        togglePalette(this.paletteState);
        this.syncOverlays();
    }

    /**
     * A tile pressed. The accept tool asks to leave, through the same call
     * Escape makes; any other tile makes its tool the live one.
     */
    onPaletteClick(id) {
        if (!buildModeDrawing(this.builder)) return;

        const pending = editPending(this.builder);
        if (id === ACCEPT_TOOL) this.requestLeaveBuilder();
        else if (!chooseBuildTool(this.builder, id) && confirmOpen(this.builder)) this.confirmOpened();
        else if (pending && !draftPending(this.builder)) this.draftKept();
        if (buildModeTool(this.builder) !== this.lassoDrawing?.mode) this.cancelLasso();
        if (buildModeTool(this.builder) !== this.strokeDrawing?.tool) this.cancelStroke();

        this.syncOverlays();
    }

    /** Writes the canvas's control list from the bindings a canvas reads. */
    drawBuildHelp() {
        const rows = this.overlays.buildHelpRows;
        rows.replaceChildren();

        for (const line of buildHelpLines()) {
            const row = document.createElement('div');
            row.dataset.buildHelpRow = line.id;
            row.textContent = line.text;
            rows.append(row);
        }
    }

    /** A click on the canvas's control list collapses it, and a click on what is left opens it. */
    onBuildHelpClick() {
        toggleHelp(this.buildHelpState);
        this.syncOverlays();
    }

    // --- The modes -------------------------------------------------------

    openGameModesPanel() {
        closeSettings(this.settings);
        closeEditor(this.editor);
        closeControlSettings(this.controlSettings);
        this.leaveBuilder();
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
        // The builder is the world rather than a card over it: a session has
        // the screen, so neither card is drawn behind it and none of the
        // flight's own chrome is drawn over it. Its picker is the one modal
        // screen it has, and that is a panel like any other.
        const builder  = !photo && buildModeShowing(this.builder);
        const picker   = builder && buildModePicking(this.builder);
        // A canvas's own chrome - the palette and the control list - is all it
        // carries, and it is what says how to work the canvas and how to leave.
        const canvas   = builder && buildModeDrawing(this.builder);
        const onTitle  = !photo && !builder && titleShowing(this.titleState);
        const modes    = !photo && !builder && this.modesOpen;
        const settings = !photo && !builder && !modes && settingsShowing(this.settings);
        const controls = !photo && !builder && !modes && !settings && controlSettingsShowing(this.controlSettings);
        const editor   = !photo && !builder && !modes && !settings && !controls && editorShowing(this.editor);
        // The builder's settings are drawn over whichever screen opened them,
        // the canvas included, which goes on being drawn behind them.
        const prefs    = !photo && builderSettingsShowing(this.builderSettings);
        const panel    = modes || settings || controls || editor || picker || prefs;
        const paused   = !photo && !builder && !onTitle && this.pauseState.paused;
        const chrome   = !photo && !builder && !onTitle && !panel && this.hudVisibility.visible;
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
        this.overlays.builderSettings.style.display = prefs ? 'flex' : 'none';
        this.overlays.editor.style.display    = editor ? 'block' : 'none';
        this.overlays.picker.style.display    = picker ? 'block' : 'none';
        this.overlays.palette.style.display   = canvas ? 'grid' : 'none';
        // A finger dragged across a canvas is a gesture, not a page being
        // scrolled, so the browser is told before a finger arrives rather than
        // after it has already taken the drag.
        this.renderer.domElement.style.touchAction = canvas ? 'none' : '';
        this.overlays.buildHelp.style.display = canvas ? 'block' : 'none';
        this.overlays.buildHelpList.style.display = this.buildHelpState.expanded ? 'block' : 'none';
        this.overlays.buildHelpHint.style.display = this.buildHelpState.expanded ? 'none' : 'block';
        this.syncDock(canvas);

        // The live tool is lit, and said to be pressed, so the palette reads as
        // which tool the canvas is being worked with. The accept tool is a way
        // out rather than a mode, so it is a plain button and never a toggle -
        // named for the question it will ask if it is pressed now, which is
        // the question Escape asks too.
        const live = buildModeTool(this.builder);
        const folded = paletteFolded(this.paletteState);
        this.overlays.palette.classList.toggle('folded', folded);
        for (const tile of this.overlays.palette.children) {
            if (tile.dataset.palette === 'fold') {
                const name = paletteFoldName(this.paletteState);
                tile.title = name;
                tile.setAttribute('aria-label', name);
                tile.setAttribute('aria-expanded', String(!folded));
                continue;
            }
            if (tile.dataset.tool === ACCEPT_TOOL) {
                const name = acceptToolName(this.builder);
                tile.title = `${name} (Esc)`;
                tile.setAttribute('aria-label', name);
                continue;
            }
            tile.setAttribute('aria-pressed', String(tile.dataset.tool === live));
        }

        // Where the palette ends, folded or not, for the control list under it
        // to stop short of - so the list scrolls rather than covering a tool,
        // the way out at the foot of the column among them, however tall the
        // palette grows as tools join it.
        if (canvas) {
            const bottom = this.overlays.palette.getBoundingClientRect().bottom;
            document.documentElement.style.setProperty('--build-palette-bottom', `${Math.ceil(bottom)}px`);
        }

        // A tool that drops at a click marks the ground as somewhere to click,
        // and Select marks a placement it would pick.
        this.renderer.domElement.style.cursor = canvas ? this.canvasCursor() : '';
        this.overlays.buildOverlay.style.display = canvas ? 'block' : 'none';

        // The popup, at the point the right click opened it, kept on the
        // screen.
        this.syncPopup(canvas);

        // The confirm, over the canvas while one is asking.
        const asking = canvas ? buildConfirm(this.builder) : null;
        this.overlays.confirm.style.display = asking ? 'flex' : 'none';
        this.overlays.confirm.dataset.ask = asking ?? '';
        this.overlays.confirmHeading.textContent = asking ? CONFIRM_HEADINGS[asking] : '';
        this.confirmMenu.render(this.confirmState);
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
        this.syncBuilderEntry();

        this.startMenu.render(this.startMenuState);
        this.pauseMenu.render(this.pauseMenuState);
        this.modesMenu.render(this.modesState);
        this.settingsMenu.render(this.settingsState);
        this.settingsStart.render(this.settingsState);
        this.settingsOptions.render(this.settingsState);
        this.settingsBuilder.render(this.settingsState);
        for (const menu of this.controlMenus) menu.render(this.controlState);
        for (const menu of this.builderSettingsMenus) menu.render(this.builderSettingsMenuState);
        this.editorMenu.render(this.editorState);
        this.pickerCards.render(this.pickerState);
        this.pickerActions.render(this.pickerState);
    }

    /**
     * Puts the builder's entry on the start menu and the pause menu or takes it
     * off both, and draws the cards again when that has changed.
     *
     * A row that opened nothing is the one thing a row under the cursor should
     * never do, so the entry comes off while a game mode is running rather than
     * being shown doing nothing - which is the same answer the `L` key has
     * always given, read off the same predicate.
     *
     * Both screens, from here, rather than the pause menu alone from here and
     * the start menu from somewhere else. A mode can be chosen from the title
     * screen's own panel before anything has flown, and `startRun` makes the
     * run live from that moment, so the title screen's entry goes dead at
     * exactly the same instant the pause menu's does.
     *
     * Only a change rebuilds the lists. The rows carry their place in the menu,
     * so a menu that has grown or shrunk has to be built again to be walked at
     * all, and a rebuild on every frame would be a card redrawn under the
     * pointer that is working it.
     */
    syncBuilderEntry() {
        const ready = this.builderReady();
        if (ready === this.builderEntryReady) return;

        this.builderEntryReady = ready;

        setMenuEntries(this.startMenuState, startMenuEntries(ready));
        this.startMenu.rebuild(this.startMenuState);

        setMenuEntries(this.pauseMenuState, pauseMenuEntries(ready));
        this.pauseMenu.rebuild(this.pauseMenuState);
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
        if (!frozen) {
            // The device is read through the same pair the keys are, or through
            // the directional one, which is what the panel's TILT READS AXES
            // box answers - see `tiltInputAxes` in js/control-settings.js.
            tiltToInput(
                this.aircraft.input, this.tilt,
                tiltDeadzone(this.controlSettings), tiltInputAxes(this.controlSettings)
            );
        }
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
            || buildModeShowing(this.builder)
            || this.modesOpen;

        // A canvas is the world being built rather than flown, so the flight
        // stands down for as long as one is open: the ground is not laid out
        // around the aircraft, and the camera is held over the canvas rather
        // than chasing something that is not moving.
        //
        // The picker is not one of those frames. It is a modal over the live
        // world, which goes on being drawn behind it exactly as it was - the
        // flight is frozen, so the chase camera holds where it was left.
        const canvas = buildModeDrawing(this.builder);

        const dt = frozen ? 0 : preFlightDelta(this.titleState, simulationDelta(this.pauseState, elapsed));

        // The overlays came off when the key was pressed; the warnings the HUD
        // places itself go quiet the same way a frozen frame quiets them.
        const capturing = photoPending(this.photoState);

        const aircraftPos = this.aircraft.getPosition();
        const groundH     = this.terrain.getTerrainHeightAt(aircraftPos.x, aircraftPos.z);

        // Read before the frame is flown, so the attitude the device is being
        // held at is the attitude this frame is flown in.
        this.trackTilt(frozen);

        // Nor is the aircraft measured against a canvas. The ground there is
        // one tile being built, not the ground under the flight, and a frozen
        // frame still meets the ground: a block built where the aircraft was
        // paused would set it down on top of the block and lose the height it
        // was flying at, which is what it is put back at when the flight
        // resumes over the world kept.
        if (!canvas) this.aircraft.update(dt, groundH);

        // The world has no end to it: the ground is laid on ahead of the
        // aircraft as it flies, out past everything the camera can see, so the
        // edge the fog used to be hiding is never there to be reached. Drawn
        // before the camera is placed, so the chase view never swings out over
        // ground that has not been laid yet.
        //
        // A canvas is the one world this does not apply to. It is one tile with
        // four edges, and laying ground around the aircraft would be laying the
        // grid back out under a session that is deliberately not drawing it.
        if (!canvas) this.flyOver(this.aircraft.getPosition());

        this.trackCourse();
        this.trackStage(dt);
        this.trackLanding(dt);
        this.trackRescue();
        this.advanceRun(dt);

        if (canvas) this.trackCanvasCamera(elapsed);
        else this.camera2.update(dt);

        // The day moves on and the water moves with it: what the surface has to
        // throw back is whatever the sky is giving it at that hour.
        this.sky.update(dt);
        this.terrain.updateWater(dt, this.sky.getDaylight());

        // Drawn after the camera has been placed and the hour has moved on,
        // because all three of those are what the layer is positioned by: the
        // rain rides with the camera, the deck wraps around it, and the sky's
        // body stands on the arc the light of that hour is coming from.
        this.weather.update(dt, this.camera, this.sky.getPhase());

        this.hud.update(this.aircraft, this.camera2, frozen || capturing);

        this.audio.update(audioLevels(this.audioState, {
            throttle: this.aircraft.getThrottle(),
            speed: this.aircraft.getSpeed(),
            maxSpeed: this.aircraft.maxSpeed,
            frozen
        }));

        this.renderer.render(this.scene, this.camera);

        // The outlines over a canvas, through the camera this frame was drawn
        // from, so they sit on the ground the frame shows.
        this.drawBuildOverlay();

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
