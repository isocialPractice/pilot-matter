// Unit conversions (approximate, tuned for arcade feel). Kept as pure
// exported functions so they can be unit tested in Node without a DOM.
export const KNOTS_PER_UNIT = 2;
export const FEET_PER_UNIT  = 3.28;

export function speedToKnots(speed)       { return Math.round(speed * KNOTS_PER_UNIT); }
export function altitudeToFeet(altitude)  { return Math.round(altitude * FEET_PER_UNIT); }
export function throttleToPercent(throttle) { return Math.round(throttle * 100); }

export class HUD {
    constructor() {
        this.speedElement = document.getElementById('hud-speed');
        this.altitudeElement = document.getElementById('hud-altitude');
        this.throttleElement = document.getElementById('hud-throttle');
        this.cameraElement = document.getElementById('hud-camera');
    }

    update(aircraft, cameraController) {
        this.speedElement.textContent = speedToKnots(aircraft.getSpeed());
        this.altitudeElement.textContent = altitudeToFeet(aircraft.getAltitude());
        this.throttleElement.textContent = throttleToPercent(aircraft.getThrottle());
        this.cameraElement.textContent = cameraController.getCurrentMode();
    }
}
