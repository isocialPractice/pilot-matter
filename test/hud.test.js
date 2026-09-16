import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
    KNOTS_PER_UNIT,
    FEET_PER_UNIT,
    VERTICAL_SPEED_STEP,
    LOW_ALTITUDE_FEET,
    COMPASS_POINTS,
    speedToKnots,
    altitudeToFeet,
    throttleToPercent,
    headingDegrees,
    formatHeading,
    compassPoint,
    verticalSpeedToFeetPerMinute,
    formatVerticalSpeed,
    isLowAltitude,
    showsLowAltitude,
    DISTANCE_STEP,
    formatGateDistance,
    formatGatePointer,
    formatStageClock,
    formatLandingReport,
    LANDING_PART_LABELS,
    showsLandedNotice,
    breakdownOnScreen
} from '../js/hud.js';
import { NO_TIME } from '../js/best-times.js';
import { LANDING_PARTS, PERFECT_SCORE } from '../js/landing-score.js';
import { GROUND_CLEARANCE } from '../js/crash.js';
import { createFlightState } from '../js/flight-state.js';

// js/aircraft.js and js/camera.js both import Three.js, so the HUD's contract
// with them is checked against their source rather than by loading them.
const readSource = (name) => readFileSync(
    fileURLToPath(new URL(`../js/${name}`, import.meta.url)),
    'utf8'
);
const hudSource      = readSource('hud.js');
const aircraftSource = readSource('aircraft.js');
const cameraSource   = readSource('camera.js');

const callsOn = (source, receiver) => new Set(
    [...source.matchAll(new RegExp(`${receiver}\\.(\\w+)\\(`, 'g'))].map(match => match[1])
);
const defines = (source, method) =>
    new RegExp(`^\\s*${method}\\s*\\([^)]*\\)\\s*\\{`, 'm').test(source);

test('speedToKnots scales by the knots conversion factor and rounds', () => {
    assert.equal(speedToKnots(0), 0);
    assert.equal(speedToKnots(100), Math.round(100 * KNOTS_PER_UNIT));
    assert.equal(speedToKnots(50.4), 101);
    assert.equal(speedToKnots(200), 400);
});

test('altitudeToFeet scales by the feet conversion factor and rounds', () => {
    assert.equal(altitudeToFeet(0), 0);
    assert.equal(altitudeToFeet(100), Math.round(100 * FEET_PER_UNIT));
    assert.equal(altitudeToFeet(300), 984);
    assert.equal(altitudeToFeet(1), 3);
});

test('throttleToPercent maps the 0-1 throttle fraction to whole percent', () => {
    assert.equal(throttleToPercent(0), 0);
    assert.equal(throttleToPercent(0.5), 50);
    assert.equal(throttleToPercent(1), 100);
    assert.equal(throttleToPercent(0.333), 33);
});

// --- Heading ---

test('a flight starts on north, the way it is pointed', () => {
    assert.equal(headingDegrees(createFlightState().rotation.y), 0);
});

test('turning right walks the compass card up through east, south, and west', () => {
    // The aircraft yaws right through the falling side of the yaw angle
    assert.equal(headingDegrees(-Math.PI / 2), 90);
    assert.equal(headingDegrees(-Math.PI), 180);
    assert.equal(headingDegrees(-Math.PI * 1.5), 270);
});

test('turning left walks the card back down through west', () => {
    assert.equal(headingDegrees(Math.PI / 2), 270);
    assert.equal(headingDegrees(Math.PI), 180);
});

test('the compass wraps rather than counting past a full turn', () => {
    assert.equal(headingDegrees(-Math.PI * 2), 0);
    assert.equal(headingDegrees(-Math.PI * 6), 0, 'three turns is still one heading');
    assert.equal(headingDegrees(-Math.PI * 2.5), 90);
});

test('a heading is always a bearing on the card, never a negative angle', () => {
    for (let yaw = -20; yaw <= 20; yaw += 0.13) {
        const heading = headingDegrees(yaw);
        assert.ok(heading >= 0 && heading < 360, `yaw ${yaw} read as ${heading}`);
        assert.equal(Number.isInteger(heading), true, `yaw ${yaw} read as ${heading}`);
    }
});

test('headings read as the three digits a compass card shows', () => {
    assert.equal(formatHeading(0), '000');
    assert.equal(formatHeading(7), '007');
    assert.equal(formatHeading(90), '090');
    assert.equal(formatHeading(359), '359');
});

test('the compass point names the quarter the nose is in', () => {
    assert.equal(compassPoint(0), 'N');
    assert.equal(compassPoint(90), 'E');
    assert.equal(compassPoint(180), 'S');
    assert.equal(compassPoint(270), 'W');
    assert.equal(compassPoint(45), 'NE');
    assert.equal(compassPoint(315), 'NW');
});

test('north covers the wrap either side of the card, not just the top', () => {
    assert.equal(compassPoint(350), 'N');
    assert.equal(compassPoint(359), 'N');
    assert.equal(compassPoint(10), 'N');
});

test('every bearing on the card names one of the eight points', () => {
    for (let degrees = 0; degrees < 360; degrees++) {
        assert.ok(COMPASS_POINTS.includes(compassPoint(degrees)), `${degrees} named nothing`);
    }
});

// --- Vertical speed ---

test('level flight reads a flat zero on the vertical speed indicator', () => {
    assert.equal(verticalSpeedToFeetPerMinute(0), 0);
    assert.equal(formatVerticalSpeed(verticalSpeedToFeetPerMinute(0)), '0');
});

test('a climb reads positive and a descent negative, in feet per minute', () => {
    assert.equal(verticalSpeedToFeetPerMinute(10), Math.round(10 * FEET_PER_UNIT * 60 / 10) * 10);
    assert.ok(verticalSpeedToFeetPerMinute(10) > 0);
    assert.equal(verticalSpeedToFeetPerMinute(-10), -verticalSpeedToFeetPerMinute(10));
});

test('the indicator rounds off, so the readout settles instead of flickering', () => {
    for (const rate of [0.1, 1.7, -4.3, 12.9]) {
        const fpm = verticalSpeedToFeetPerMinute(rate);
        assert.ok(fpm % VERTICAL_SPEED_STEP === 0, `${fpm} is not a whole step`);
    }
});

test('a climb always carries its sign, so it cannot be misread as a descent', () => {
    assert.equal(formatVerticalSpeed(1200), '+1200');
    assert.equal(formatVerticalSpeed(-1200), '-1200');
    assert.equal(formatVerticalSpeed(0), '0', 'level flight needs no sign');
});

test('a barely-there drift reads as level rather than as minus nothing', () => {
    assert.equal(formatVerticalSpeed(verticalSpeedToFeetPerMinute(-0.001)), '0');
});

// --- Low altitude warning ---

test('the warning is measured against the ground, not against sea level', () => {
    const threshold = LOW_ALTITUDE_FEET / FEET_PER_UNIT;
    assert.equal(isLowAltitude(threshold - 1), true);
    assert.equal(isLowAltitude(threshold + 1), false);
});

test('cruising well clear of the terrain below leaves the warning off', () => {
    assert.equal(isLowAltitude(createFlightState().position.y), false);
});

test('sitting on the ground is as low as the warning ever gets', () => {
    assert.equal(isLowAltitude(GROUND_CLEARANCE), true);
    assert.equal(isLowAltitude(0), true);
});

test('the warning has room to sound before the ground arrives', () => {
    assert.ok(LOW_ALTITUDE_FEET > altitudeToFeet(GROUND_CLEARANCE),
        'a warning that only trips on contact warns of nothing');
});

/**
 * Which is exactly why it said nothing worth hearing at the start of a flight:
 * an aircraft held on the strip is as low as the warning ever gets, and the
 * first thing a pilot saw was a warning about the state the simulator had just
 * put them in.
 */
test('a flight still on the ground is not being warned about its altitude', () => {
    assert.equal(showsLowAltitude(GROUND_CLEARANCE, false), false, 'held on the strip');
    assert.equal(showsLowAltitude(0, false), false, 'and rolling out on it');
});

test('an altitude the pilot flew to is one the warning speaks about', () => {
    assert.equal(showsLowAltitude(GROUND_CLEARANCE, true), true);
    assert.equal(showsLowAltitude(LOW_ALTITUDE_FEET / FEET_PER_UNIT - 1, true), true);
});

test('leaving the ground is the condition rather than a timer', () => {
    const clear = createFlightState().position.y;
    assert.equal(showsLowAltitude(clear, true), false,
        'a flight up where the warning has nothing to say stays quiet');
    assert.equal(showsLowAltitude(clear, false), false,
        'and so does one that never left the runway, however long it sits there');
});

// A host flying an aircraft that does not answer the question keeps the warning
// it always had: an unanswered question is not a grounded aircraft.
test('an aircraft that does not report being airborne warns as it always did', () => {
    assert.equal(showsLowAltitude(GROUND_CLEARANCE, undefined), true);
    assert.equal(showsLowAltitude(GROUND_CLEARANCE, null), true);
});

// --- What the HUD reads its instruments from ---

test('the aircraft answers every reading the HUD asks it for', () => {
    const asked = callsOn(hudSource, 'aircraft');
    assert.ok(asked.size > 0, 'the HUD should read its instruments off the aircraft');
    for (const method of asked) {
        assert.ok(defines(aircraftSource, method), `js/aircraft.js is missing ${method}()`);
    }
});

test('the camera controller answers every reading the HUD asks it for', () => {
    const asked = callsOn(hudSource, 'cameraController');
    assert.ok(asked.size > 0, 'the HUD should read the camera mode off the controller');
    for (const method of asked) {
        assert.ok(defines(cameraSource, method), `js/camera.js is missing ${method}()`);
    }
});

test('the new instruments are wired to the aircraft and not to guesses', () => {
    const asked = callsOn(hudSource, 'aircraft');
    for (const method of ['getHeading', 'getVerticalSpeed', 'getHeightAboveTerrain', 'isCrashed']) {
        assert.ok(asked.has(method), `the HUD should read ${method}() off the aircraft`);
    }

    // Asked rather than assumed, and asked in a way a host's own aircraft can
    // decline to answer.
    assert.ok(hudSource.includes('aircraft.isAirborne?.()'),
        'and ask whether the flight has left the ground before warning about its altitude');
    assert.ok(/isAirborne\(\)\s*\{/.test(aircraftSource),
        'which js/aircraft.js should be able to answer');
});

// --- What the objective card is told --------------------------------------

test('a distance is read on whichever scale the altimeter is set to', () => {
    assert.equal(formatGateDistance(1000, 'feet'), `${Math.round(1000 * FEET_PER_UNIT / 10) * 10}`);
    assert.notEqual(formatGateDistance(1000, 'meters'), formatGateDistance(1000, 'feet'));
});

// A distance that ran every frame would be a number nobody could read off a
// moving aircraft, so it settles the way the climb rate does.
test('a distance settles on a step rather than running every frame', () => {
    for (const distance of [1000, 1000.4, 1001]) {
        assert.equal(Number(formatGateDistance(distance)) % DISTANCE_STEP, 0);
    }
});

test('a gate off the screen is pointed at with the turn, the bearing, and the range', () => {
    const line = formatGatePointer(
        { index: 2, bearing: 7, relative: -120, arrow: '←', distance: 4000 },
        'feet'
    );

    assert.ok(line.includes('LOOP 3'), 'the loop it is, counted the way a loop is spoken about');
    assert.ok(line.includes('←'), 'which way to turn');
    assert.ok(line.includes('007'), 'the bearing, padded the way the compass card is');
    assert.ok(line.includes(formatGateDistance(4000, 'feet')), 'and how far there is to go');
    assert.ok(line.includes('ft'), 'on a scale the pilot can read');
});

test('a gate the pilot can see is not written about at all', () => {
    assert.equal(formatGatePointer(null), '');
});

test('the clock carries the time flown and the time to beat', () => {
    const line = formatStageClock(42.13, 38.4);
    assert.ok(line.includes('0:42.1'));
    assert.ok(line.includes('0:38.4'));
});

// A stage nobody has flown out leaves the shape of a time rather than a number
// that means nothing, so the line does not change width on the first flight.
test('a stage with no time to beat says so in the shape of a time', () => {
    assert.ok(formatStageClock(42.1, null).includes(NO_TIME));
    assert.equal(formatStageClock(42.1, null).length, formatStageClock(42.1, 38.4).length);
});

// --- What a landing is read off as -----------------------------------------

// A landing is four measurements, and four measurements on one line is a line
// nobody finishes reading.
const LANDING = {
    down: 610, across: 18, sink: 4.2, heading: 0.07,
    marks: { touchdown: 0.9, centreline: 0.88, sink: 0.77, heading: 0.84 },
    score: 85
};

test('a landing is read off line by line, the score first', () => {
    const lines = formatLandingReport(LANDING, 'feet');

    assert.equal(lines.length, LANDING_PARTS.length + 1, 'the score, then each part behind it');
    assert.ok(lines[0].text.includes('85'), 'the headline is what it came to');
    assert.ok(lines[0].className, 'and is marked out from the readings under it');
});

test('every part of a landing is named and given its reading', () => {
    const lines = formatLandingReport(LANDING, 'feet').map(line => line.text);

    for (const part of LANDING_PARTS) {
        assert.ok(lines.some(line => line.startsWith(LANDING_PART_LABELS[part])),
            `the breakdown should account for ${part}`);
    }

    const report = lines.join('\n');
    assert.ok(report.includes(`${altitudeToFeet(610)} ft`), 'how far down the strip');
    assert.ok(report.includes(`${altitudeToFeet(18)} ft`), 'how far off the middle');
    assert.ok(report.includes('ft/min'), 'the rate it came down at');
    assert.ok(report.includes('4°'), 'and how far off the strip the nose was');
});

test('the breakdown is read on whichever scale the altimeter is set to', () => {
    const metric = formatLandingReport(LANDING, 'meters').map(line => line.text).join('\n');

    assert.ok(metric.includes(' m'), 'the lengths follow the altimeter');
    assert.ok(metric.includes('m/min'), 'and so does the rate');
    assert.ok(!metric.includes(' ft'), 'rather than leaving the pilot two scales to think in');
});

test('a perfect landing is written as the whole hundred', () => {
    const perfect = { ...LANDING, score: PERFECT_SCORE };
    assert.ok(formatLandingReport(perfect, 'feet')[0].text.includes(String(PERFECT_SCORE)));
});

test('a landing there is nothing to say about writes nothing', () => {
    assert.deepEqual(formatLandingReport(null), [], 'which is what leaves the card as it was');
    assert.deepEqual(formatLandingReport(undefined), []);
});

// --- The notice and the breakdown ------------------------------------------

/**
 * The two are on screen for the same moment. `#landed` is shown for as long as
 * the ground outcome reads LANDED, which is the whole of the time the aircraft
 * is stopped on the strip, and the breakdown goes up when the rollout ends,
 * which is inside that. Centred, the notice is drawn over the card - and on a
 * 320 pixel screen held upright it took seven of the card's lines with it,
 * `LANDING  ·  <score>` among them.
 */
test('the LANDED notice comes off once the breakdown is up to say it better', () => {
    assert.equal(showsLandedNotice(true, false), true,
        'a landing still rolling out has nothing else announcing it');
    assert.equal(showsLandedNotice(true, true), false,
        'and the notice steps aside once the card is reading the landing off');
    assert.equal(showsLandedNotice(false, false), false);
    assert.equal(showsLandedNotice(false, true), false,
        'a breakdown left up over a flight is not a landing to announce');
});

// The notice is only safe to drop because the card says everything it said.
test('the breakdown the notice steps aside for names the landing itself', () => {
    const [headline] = formatLandingReport(LANDING, 'feet');
    assert.match(headline.text, /LANDING/,
        'the card has to carry what the notice carried, or taking it off loses it');
    assert.ok(headline.text.includes(String(LANDING.score)),
        'and the score with it, which is more than the notice ever said');
});

test('the run that raises the breakdown is the run that records it is up', () => {
    assert.match(hudSource, /setLandingReport\([\s\S]*?this\.breakdownShowing\s*=/,
        'setLandingReport is what puts the card up, so it is what says the card is up');
    assert.match(hudSource, /landedElement\.style\.display\s*=\s*\n?\s*showsLandedNotice\(/,
        'and the notice is drawn through the rule rather than around it');
});

/**
 * Writing the breakdown is not the same as showing it. The card is placed by
 * the run rather than by the HUD, and `Tab` takes it off with the instruments
 * while the flight goes on being flown - a cleared screen is not a frozen one,
 * and the notice is not among the things that key hides. So a landing rolled
 * to a stop with the screen cleared had the notice stepping aside for a card
 * that was not on it, and nothing at all said the aircraft was down.
 */
test('a breakdown the screen is not showing is not something to step aside for', () => {
    assert.equal(breakdownOnScreen(true, 'block'), true,
        'a card the run has put up is a card a landing can be read off');
    assert.equal(breakdownOnScreen(true, 'none'), false,
        'and a card cleared off the screen says nothing, whatever was written on it');
    assert.equal(breakdownOnScreen(false, 'block'), false,
        'a card with no breakdown on it is not a breakdown');

    assert.equal(showsLandedNotice(true, breakdownOnScreen(true, 'none')), true,
        'so the notice is what is left to announce a landing on a cleared screen');
    assert.equal(showsLandedNotice(true, breakdownOnScreen(true, 'block')), false,
        'and it steps aside again as soon as the card is back');
});

test('the notice is asked what is on the screen rather than what was written', () => {
    assert.match(hudSource, /showsLandedNotice\(landed, breakdown\)/,
        'the notice reads the breakdown that is up, not the one that was written');
    assert.match(hudSource, /breakdownOnScreen\(\s*\n?\s*this\.breakdownShowing,\s*this\.modeElement\.style\.display/,
        'and what is up is the flag and the display the run wrote onto the card');
});
