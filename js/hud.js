import { AttitudeIndicator, pitchFromForward, bankFromWing } from './attitude.js';
import { Minimap } from './minimap.js';
import { LANDED } from './crash.js';
import {
    FEET_PER_UNIT, SECONDS_PER_MINUTE,
    DEFAULT_SPEED_UNIT, DEFAULT_ALTITUDE_UNIT,
    speedTo, altitudeTo, speedUnit, altitudeUnit,
    altitudeToFeet, throttleToPercent, headingDegrees
} from './units.js';

// The unit conversions live in js/units.js, which converts in both directions
// so a start state can be configured in knots and feet. They are re-exported
// here because the instruments are what those numbers are read on.
export {
    KNOTS_PER_UNIT, FEET_PER_UNIT, SPEED_UNITS, ALTITUDE_UNITS,
    speedToKnots, altitudeToFeet, speedTo, altitudeTo, throttleToPercent, headingDegrees
} from './units.js';

// The vertical speed indicator rounds to this many feet per minute, so the
// readout settles on a number instead of flickering every frame.
export const VERTICAL_SPEED_STEP = 10;

// Height above the terrain below the aircraft, in feet, that trips the low
// altitude warning.
export const LOW_ALTITUDE_FEET = 200;

// The compass points the heading readout names, in clockwise order from
// north, each covering an equal slice of the circle.
export const COMPASS_POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/**
 * Pads a heading to the three digits a compass card reads: 7 degrees is
 * "007", not "7".
 */
export function formatHeading(degrees) {
    return String(degrees).padStart(3, '0');
}

/**
 * The compass point a bearing falls under, with each point centred on its
 * own bearing so north covers the wrap from 337.5 degrees back round to 22.5.
 */
export function compassPoint(degrees) {
    const slice = 360 / COMPASS_POINTS.length;
    const wrapped = ((degrees % 360) + 360) % 360;
    return COMPASS_POINTS[Math.round(wrapped / slice) % COMPASS_POINTS.length];
}

/**
 * Climb and descent rate over a minute, on whichever scale the altimeter is
 * set to, from a vertical speed in world units per second. Signed the way an
 * altimeter needle moves: positive is a climb, negative is a descent.
 */
export function verticalSpeedToRate(verticalSpeed, unit = DEFAULT_ALTITUDE_UNIT) {
    const perMinute = verticalSpeed * altitudeUnit(unit).perUnit * SECONDS_PER_MINUTE;
    return Math.round(perMinute / VERTICAL_SPEED_STEP) * VERTICAL_SPEED_STEP;
}

/** The same climb rate on the scale a flight opens on. */
export function verticalSpeedToFeetPerMinute(verticalSpeed) {
    return verticalSpeedToRate(verticalSpeed, 'feet');
}

/**
 * Writes a climb rate the way a vertical speed indicator does, with the sign
 * always shown on a climb so it cannot be misread as a descent.
 */
export function formatVerticalSpeed(feetPerMinute) {
    return feetPerMinute > 0 ? `+${feetPerMinute}` : String(feetPerMinute);
}

/**
 * True when the aircraft is close enough to the ground below it to warn the
 * pilot. Measured against the terrain, not sea level, so flying up a valley
 * warns while the same altitude out over water does not.
 */
export function isLowAltitude(heightAboveTerrain, thresholdFeet = LOW_ALTITUDE_FEET) {
    return altitudeToFeet(heightAboveTerrain) < thresholdFeet;
}

export class HUD {
    constructor() {
        this.speedElement         = document.getElementById('hud-speed');
        this.altitudeElement      = document.getElementById('hud-altitude');
        this.verticalSpeedElement = document.getElementById('hud-vertical-speed');
        this.headingElement       = document.getElementById('hud-heading');
        this.compassElement       = document.getElementById('hud-compass');
        this.throttleElement      = document.getElementById('hud-throttle');
        this.cameraElement        = document.getElementById('hud-camera');
        this.lowAltitudeElement   = document.getElementById('low-altitude');
        this.crashElement         = document.getElementById('crashed');
        this.landedElement        = document.getElementById('landed');
        this.attitude             = new AttitudeIndicator(document.getElementById('attitude'));
        this.minimap              = new Minimap(document.getElementById('minimap'));

        // What the pilot is being asked to do, when they are being asked to do
        // anything. A free flight leaves these empty and the card off screen.
        this.modeNameElement      = document.getElementById('game-mode-name');
        this.modeObjectiveElement = document.getElementById('game-mode-objective');
        this.modeStatusElement    = document.getElementById('game-mode-status');

        // The units the readouts are written beside, which the settings panel
        // can switch without the flight model ever hearing about it.
        this.speedUnitElement         = document.getElementById('hud-speed-unit');
        this.altitudeUnitElement      = document.getElementById('hud-altitude-unit');
        this.verticalSpeedUnitElement = document.getElementById('hud-vertical-speed-unit');

        this.setUnits();
    }

    /**
     * Fits the minimap to the world being flown, so the marker on it means the
     * same thing after an environment is changed as it did before.
     */
    setBounds(bounds) {
        return this.minimap.setBounds(bounds);
    }

    /**
     * Puts the instruments on a pair of scales. The labels are written once
     * here rather than every frame, because they only change when the pilot
     * changes them.
     */
    setUnits({ speed = DEFAULT_SPEED_UNIT, altitude = DEFAULT_ALTITUDE_UNIT } = {}) {
        this.speedUnit    = speedUnit(speed).id;
        this.altitudeUnit = altitudeUnit(altitude).id;

        this.speedUnitElement.textContent         = speedUnit(this.speedUnit).label;
        this.altitudeUnitElement.textContent      = altitudeUnit(this.altitudeUnit).label;
        this.verticalSpeedUnitElement.textContent = altitudeUnit(this.altitudeUnit).rateLabel;
    }

    /**
     * Writes the objective card: what is being played, what it is asking for,
     * and how far through it the pilot is. Written when the run changes rather
     * than every frame, because a stage is not something that moves.
     */
    setObjective({ name = '', objective = '', status = '' } = {}) {
        this.modeNameElement.textContent      = name;
        this.modeObjectiveElement.textContent = objective;
        this.modeStatusElement.textContent    = status;
    }

    /**
     * Writes the frame's readings onto the instruments. A frozen simulation -
     * a paused flight, or one still waiting behind the title screen - keeps
     * the warnings quiet: there is nothing for the pilot to do about them
     * while the world is holding still.
     */
    update(aircraft, cameraController, frozen = false) {
        this.speedElement.textContent = speedTo(aircraft.getSpeed(), this.speedUnit);
        this.altitudeElement.textContent = altitudeTo(aircraft.getAltitude(), this.altitudeUnit);
        this.throttleElement.textContent = throttleToPercent(aircraft.getThrottle());
        this.cameraElement.textContent = cameraController.getCurrentMode();

        this.verticalSpeedElement.textContent = formatVerticalSpeed(
            verticalSpeedToRate(aircraft.getVerticalSpeed(), this.altitudeUnit)
        );

        const heading = headingDegrees(aircraft.getHeading());
        this.headingElement.textContent = formatHeading(heading);
        this.compassElement.textContent = compassPoint(heading);

        const { forwardY, rightY, upY } = aircraft.getAttitude();
        this.attitude.update(pitchFromForward(forwardY), bankFromWing(rightY, upY));
        this.minimap.update(aircraft.getPosition(), aircraft.getHeading());

        // The crash banner replaces the low altitude warning: once the
        // ground has been hit there is nothing left to warn about. A landing
        // replaces it for the same reason - the ground under the aircraft has
        // stopped being a thing to be warned about and started being the point.
        // All three give the middle of the screen up to the paused indicator.
        const crashed = !frozen && aircraft.isCrashed();
        const landed  = !frozen && !crashed && aircraft.getGroundOutcome?.() === LANDED;
        const low = !frozen && !crashed && !landed && isLowAltitude(aircraft.getHeightAboveTerrain());
        this.crashElement.style.display = crashed ? 'block' : 'none';
        this.landedElement.style.display = landed ? 'block' : 'none';
        this.lowAltitudeElement.style.display = low ? 'block' : 'none';
    }
}
