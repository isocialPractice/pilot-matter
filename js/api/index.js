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
// allowed to hold, so a host can offer the same start state its own way.
export {
    DEFAULT_CONFIG, START_FIELDS, START_FIELD_IDS,
    startField, isStartValue, startDefaults, resolveStart
} from '../config.js';

export { flightStart, createFlightState } from '../flight-state.js';

// The rule the bundled simulator uses at the end of the ground, published so a
// host handling its own edge can use it, or match it.
export { wrapValue, wrapPosition, isOutsideBounds } from '../world-edge.js';

// The worlds the Matter API can assemble, and the elements they are assembled
// out of, so a host can list them, extend a preset, or write one of its own.
export {
    ENVIRONMENTS, DEFAULT_ENVIRONMENT_ID,
    getEnvironment, environmentIds, isEnvironmentId, buildEnvironment
} from '../environment/presets.js';

export {
    ELEMENTS, ELEMENT_ORDER, getElement, isElementId, resolveConfig,
    createField, sampleHeight
} from '../environment/elements.js';
