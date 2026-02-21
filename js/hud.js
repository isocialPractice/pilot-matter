export class HUD {
    constructor() {
        this.speedElement = document.getElementById('hud-speed');
        this.altitudeElement = document.getElementById('hud-altitude');
        this.throttleElement = document.getElementById('hud-throttle');
        this.cameraElement = document.getElementById('hud-camera');
    }

    update(aircraft, cameraController) {
        // Convert units for display
        // Speed: internal units to knots (approximate conversion for arcade feel)
        const speedKnots = Math.round(aircraft.getSpeed() * 2);

        // Altitude: internal units to feet (approximate)
        const altitudeFeet = Math.round(aircraft.getAltitude() * 3.28);

        // Throttle as percentage
        const throttlePercent = Math.round(aircraft.getThrottle() * 100);

        // Update HUD elements
        this.speedElement.textContent = speedKnots;
        this.altitudeElement.textContent = altitudeFeet;
        this.throttleElement.textContent = throttlePercent;
        this.cameraElement.textContent = cameraController.getCurrentMode();
    }
}
