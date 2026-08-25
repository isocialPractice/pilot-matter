/**
 * The simulator API - one module a host page imports to get either half of
 * Pilot Matter without the other.
 *
 * The **Pilot API** is the aircraft: the flight model, the controls, and the
 * telemetry, flown against a scene, a terrain, and an aircraft asset the host
 * supplies. The **Matter API** is the world: an assembled environment as a
 * detachable group, a height sampler, and a contract any aircraft can satisfy,
 * whatever is flying it.
 *
 * Everything under `contract.js` is pure and can be imported on its own, with
 * no renderer, by a host that only wants to check its options or its aircraft.
 */

export { createPilot } from './pilot.js';
export { createEnvironment } from './matter.js';

export {
    API_VERSION,
    DEFAULT_KEYMAP, CONTROL_NAMES, RESET_KEYS,
    TELEMETRY_FIELDS,
    boundsFromSize, flatSampler, isInsideBounds,
    resolveTerrain, resolvePilotOptions, resolveEnvironmentOptions,
    validateAircraftContract, isAircraftContractSatisfied,
    createTelemetry
} from './contract.js';

// The configured start, as the values a pilot reads and the fields they are
// allowed to hold, so a host can offer the same start state its own way. A
// start is one of two conditions - already flying, or held on a runway - and
// which one it is decides which of the other fields mean anything.
export {
    DEFAULT_CONFIG, START_FIELDS, START_FIELD_IDS, START_MODES,
    START_FLYING, START_TAKEOFF, CHOICE_FIELD, TOGGLE_FIELD,
    startField, isStartValue, snapStartValue, startDefaults, resolveStart,
    startsOnRunway, runwayForced, runwayWanted
} from '../config.js';

export { flightStart, takeoffStart, createFlightState } from '../flight-state.js';

// What meeting the ground amounted to, and the rules that decide it, so a host
// flying its own strips can read a landing the same way the bundled game does.
export {
    FLYING, LANDED, CRASHED, GROUND_OUTCOMES, LANDING_LIMITS,
    GROUND_CLEARANCE, CRASH_IMPACT_SPEED, RUNWAY_IMPACT_SPEED,
    touchdownOutcome, withinLandingAttitude, headingOffsetTo
} from '../crash.js';

// The modes the bundled game is played in, and the pure rules behind them: the
// stages, the run state, the course geometry, and the gate test.
export {
    GAME_MODES, GAME_MODE_IDS, RUNWAY_LANDING, LOOP_COURSE,
    LAND_OBJECTIVE, LOOP_OBJECTIVE,
    getGameMode, isGameModeId,
    createRunState, startRun, endRun, runningMode, currentStage, advanceStage,
    restartStage, recordLanding, recordGate, recordCrash, nextGate,
    stageProgress, isStageComplete, runObjective, runStatus,
    stageWorld, stageStart, buildCourse, gateOffset, gatePassed
} from '../game-modes.js';

// The rule the bundled simulator uses at the end of the ground, published so a
// host handling its own edge can use it, or match it.
export { wrapValue, wrapPosition, isOutsideBounds } from '../world-edge.js';

// The worlds the Matter API can assemble, and the elements they are assembled
// out of, so a host can list them, extend a preset, or write one of its own.
export {
    ENVIRONMENTS, MODE_ENVIRONMENTS, DEFAULT_ENVIRONMENT_ID,
    getEnvironment, environmentIds, isEnvironmentId,
    environmentElements, buildEnvironment
} from '../environment/presets.js';

export {
    ELEMENTS, ELEMENT_ORDER, getElement, isElementId, resolveConfig,
    createField, sampleHeight
} from '../environment/elements.js';

// Reading a strip: where it runs, how far it reaches, and which end of it a
// takeoff rolls from, for a host placing an aircraft on one of its own.
export {
    runwayDirection, runwayPoint, runwayOffsets,
    isOnRunway, runwayThresholds, nearestRunway
} from '../environment/elements.js';
