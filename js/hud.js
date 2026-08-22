import { AttitudeIndicator, pitchFromForward, bankFromWing } from './attitude.js';
import {
    FEET_PER_UNIT, SECONDS_PER_MINUTE,
    speedToKnots, altitudeToFeet, throttleToPercent, headingDegrees
} from './units.js';

// The unit conversions live in js/units.js, which converts in both directions
// so a start state can be configured in knots and feet. They are re-exported
// here because the instruments are what those numbers are read on.
export {
    KNOTS_PER_UNIT, FEET_PER_UNIT,
    speedToKnots, altitudeToFeet, throttleToPercent, headingDegrees
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
 * Climb and descent rate in feet per minute, from a vertical speed in world
 * units per second. Signed the way an altimeter needle moves: positive is a
 * climb, negative is a descent.
 */
export function verticalSpeedToFeetPerMinute(verticalSpeed) {
    const perMinute = verticalSpeed * FEET_PER_UNIT * SECONDS_PER_MINUTE;
    return Math.round(perMinute / VERTICAL_SPEED_STEP) * VERTICAL_SPEED_STEP;
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
        this.attitude             = new AttitudeIndicator(document.getElementById('attitude'));
    }

    /**
     * Writes the frame's readings onto the instruments. A frozen simulation -
     * a paused flight, or one still waiting behind the title screen - keeps
     * the warnings quiet: there is nothing for the pilot to do about them
     * while the world is holding still.
     */
    update(aircraft, cameraController, frozen = false) {
        this.speedElement.textContent = speedToKnots(aircraft.getSpeed());
        this.altitudeElement.textContent = altitudeToFeet(aircraft.getAltitude());
        this.throttleElement.textContent = throttleToPercent(aircraft.getThrottle());
        this.cameraElement.textContent = cameraController.getCurrentMode();

        this.verticalSpeedElement.textContent = formatVerticalSpeed(
            verticalSpeedToFeetPerMinute(aircraft.getVerticalSpeed())
        );

        const heading = headingDegrees(aircraft.getHeading());
        this.headingElement.textContent = formatHeading(heading);
        this.compassElement.textContent = compassPoint(heading);

        const { forwardY, rightY, upY } = aircraft.getAttitude();
        this.attitude.update(pitchFromForward(forwardY), bankFromWing(rightY, upY));

        // The crash banner replaces the low altitude warning: once the
        // ground has been hit there is nothing left to warn about. Both give
        // the middle of the screen up to the paused indicator.
        const crashed = !frozen && aircraft.isCrashed();
        const low = !frozen && !crashed && isLowAltitude(aircraft.getHeightAboveTerrain());
        this.crashElement.style.display = crashed ? 'block' : 'none';
        this.lowAltitudeElement.style.display = low ? 'block' : 'none';
    }
}
