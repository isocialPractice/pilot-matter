import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildSurvey, shotFor, shotFault, headingMiss, landmarkBrief,
    rangeBand, windowHeight, HEADING_REACH
} from '../js/survey.js';
import { bearingToDirection, directionToBearing, FEET_PER_UNIT } from '../js/units.js';

const STAGE = {
    survey: {
        window: { heightFeet: [1000, 2400], range: [500, 1800], headingReach: 40 },
        landmarks: [
            { name: 'THE BLUFF', bearing: 40,  distance: 2600, heading: 40,  height: 220 },
            { name: 'MILL TOWN', bearing: 135, distance: 3400, heading: 160, height: 80 }
        ]
    }
};

/** The aircraft standing exactly where a landmark's window wants it. */
function insideWindow(landmark, over = {}) {
    const { heightFeet, range, heading } = landmark.window;
    const back = bearingToDirection((heading + 180) % 360);
    const out  = (range[0] + range[1]) / 2;

    return {
        x: landmark.x + back.x * out,
        z: landmark.z + back.z * out,
        altitudeFeet: (heightFeet[0] + heightFeet[1]) / 2,
        headingDegrees: heading,
        ...over
    };
}

// --- Placing the list ------------------------------------------------------

test('a survey is the landmarks the stage lists, placed by their own briefing', () => {
    const marks = buildSurvey(STAGE);

    assert.equal(marks.length, 2);
    assert.deepEqual(marks.map(m => m.index), [0, 1]);
    assert.deepEqual(marks.map(m => m.name), ['THE BLUFF', 'MILL TOWN']);

    // Placed by a bearing and a distance from the middle, which is where the
    // stage opens - so the brief a pilot is given is a brief they can fly.
    for (const mark of marks) {
        assert.ok(Math.abs(Math.hypot(mark.x, mark.z) - mark.distance) < 1e-6,
            `${mark.name} should lie its own distance from the start`);
        assert.ok(Math.abs(headingMiss(directionToBearing(mark.x, mark.z), mark.bearing)) < 1e-6,
            `${mark.name} should lie on its own bearing from the start`);
    }
});

test('a stage with no list to it places none', () => {
    assert.deepEqual(buildSurvey({}), []);
    assert.deepEqual(buildSurvey(null), []);
    assert.deepEqual(buildSurvey({ survey: {} }), []);
});

test('the stage window is every landmark\'s unless the landmark says otherwise', () => {
    const stage = {
        survey: {
            ...STAGE.survey,
            landmarks: [
                STAGE.survey.landmarks[0],
                { ...STAGE.survey.landmarks[1], window: { heightFeet: [100, 200] } }
            ]
        }
    };

    const [common, own] = buildSurvey(stage);
    assert.deepEqual(common.window.heightFeet, [1000, 2400]);
    assert.deepEqual(own.window.heightFeet, [100, 200]);
    assert.deepEqual(own.window.range, [500, 1800], 'and what it does not say is still the stage\'s');
});

test('the heading a landmark is caught on is the landmark\'s own', () => {
    const [bluff, town] = buildSurvey(STAGE);
    assert.equal(bluff.window.heading, 40);
    assert.equal(town.window.heading, 160);
    assert.equal(bluff.window.headingReach, 40);
});

test('a window that names no reach gets the standing one', () => {
    const [mark] = buildSurvey({
        survey: {
            window: { heightFeet: [1000, 2000], range: [400, 1200] },
            landmarks: [STAGE.survey.landmarks[0]]
        }
    });
    assert.equal(mark.window.headingReach, HEADING_REACH);
});

// --- Taking the shot -------------------------------------------------------

test('a shot from inside all three parts of the window counts', () => {
    const [mark] = buildSurvey(STAGE);
    const shot = shotFor(mark, insideWindow(mark));

    assert.equal(shot.inside, true);
    assert.equal(shot.heightOk, true);
    assert.equal(shot.rangeOk, true);
    assert.equal(shot.headingOk, true);
    assert.equal(shot.name, 'THE BLUFF');
    assert.equal(shotFault(shot, mark), '');
});

test('each part of the window can refuse a shot on its own', () => {
    const [mark] = buildSurvey(STAGE);
    const { heightFeet, range, heading } = mark.window;

    const high = shotFor(mark, insideWindow(mark, { altitudeFeet: heightFeet[1] + 1 }));
    assert.equal(high.heightOk, false);
    assert.equal(high.rangeOk, true);
    assert.equal(high.inside, false);

    const turned = shotFor(mark, insideWindow(mark, {
        headingDegrees: heading + mark.window.headingReach + 1
    }));
    assert.equal(turned.headingOk, false);
    assert.equal(turned.heightOk, true);
    assert.equal(turned.inside, false);

    const far = buildSurvey(STAGE)[0];
    const back = bearingToDirection((heading + 180) % 360);
    const away = shotFor(far, insideWindow(far, {
        x: far.x + back.x * (range[1] + 10),
        z: far.z + back.z * (range[1] + 10)
    }));
    assert.equal(away.rangeOk, false);
    assert.equal(away.inside, false);
});

test('the edges of the window are inside it', () => {
    const [mark] = buildSurvey(STAGE);
    const { heightFeet, heading, headingReach } = mark.window;

    for (const altitudeFeet of heightFeet) {
        assert.equal(shotFor(mark, insideWindow(mark, { altitudeFeet })).heightOk, true);
    }
    for (const side of [1, -1]) {
        const at = insideWindow(mark, { headingDegrees: heading + headingReach * side });
        assert.equal(shotFor(mark, at).headingOk, true);
    }
});

test('the range is measured to the landmark rather than to where it was briefed from', () => {
    const [mark] = buildSurvey(STAGE);
    const back = bearingToDirection((mark.window.heading + 180) % 360);
    const out  = 900;

    const shot = shotFor(mark, insideWindow(mark, {
        x: mark.x + back.x * out, z: mark.z + back.z * out
    }));

    assert.ok(Math.abs(shot.range - out) < 1e-6);
});

// A photograph taken from nowhere is the one reading a survey must never
// count, because a missing place measures NaN and NaN fails every comparison
// - including the ones that would have rejected it.
test('a shot the aircraft cannot be placed for is outside the window, not inside it', () => {
    const [mark] = buildSurvey(STAGE);

    for (const broken of [{}, { x: 1 }, { x: NaN, z: 0 }, { x: 0, z: NaN }]) {
        const shot = shotFor(mark, { ...insideWindow(mark), ...broken, x: broken.x, z: broken.z });
        assert.equal(shot.inside, false, `a shot from ${JSON.stringify(broken)} should not count`);
        assert.equal(shot.rangeOk, false);
    }

    assert.equal(shotFor(mark, { ...insideWindow(mark), altitudeFeet: NaN }).heightOk, false);
    assert.equal(shotFor(mark, { ...insideWindow(mark), headingDegrees: NaN }).headingOk, false);
});

test('a shot of nothing is nothing', () => {
    assert.equal(shotFor(null, { x: 0, z: 0 }), null);
    assert.equal(shotFault(null, null), '');
});

// --- What the pilot is told ------------------------------------------------

test('a shot is faulted on the first thing wrong with it, and range comes first', () => {
    const [mark] = buildSurvey(STAGE);
    const { range, heightFeet, heading } = mark.window;
    const back = bearingToDirection((heading + 180) % 360);

    const far = insideWindow(mark, {
        x: mark.x + back.x * (range[1] + 500), z: mark.z + back.z * (range[1] + 500)
    });
    assert.equal(shotFault(shotFor(mark, far), mark), 'TOO FAR OUT');

    const close = insideWindow(mark, {
        x: mark.x + back.x * (range[0] / 2), z: mark.z + back.z * (range[0] / 2)
    });
    assert.equal(shotFault(shotFor(mark, close), mark), 'TOO CLOSE IN');

    // Out of range and too high at once still reads as the range: a pilot who
    // fixes the first comes round and is told the second.
    const both = { ...far, altitudeFeet: heightFeet[1] + 900 };
    assert.equal(shotFault(shotFor(mark, both), mark), 'TOO FAR OUT');
});

test('a shot inside the range is faulted on its height, then on its side', () => {
    const [mark] = buildSurvey(STAGE);
    const { heightFeet, heading } = mark.window;

    assert.equal(shotFault(shotFor(mark, insideWindow(mark, {
        altitudeFeet: heightFeet[1] + 500
    })), mark), 'TOO HIGH');

    assert.equal(shotFault(shotFor(mark, insideWindow(mark, {
        altitudeFeet: 0
    })), mark), 'TOO LOW');

    assert.equal(shotFault(shotFor(mark, insideWindow(mark, {
        headingDegrees: (heading + 180) % 360
    })), mark), 'WRONG SIDE');
});

test('the brief names the landmark, the height to be at, and the way to be pointing', () => {
    const [bluff] = buildSurvey(STAGE);

    assert.equal(landmarkBrief(bluff), 'THE BLUFF  ·  1700 FT  ·  040°');
    assert.equal(landmarkBrief(null), '');
});

test('the bearing in the brief is written the way the compass readout writes one', () => {
    const [mark] = buildSurvey({
        survey: { ...STAGE.survey, landmarks: [{ ...STAGE.survey.landmarks[0], heading: 5 }] }
    });
    assert.ok(landmarkBrief(mark).endsWith('005°'), landmarkBrief(mark));
});

// The range is the one of the three readings that is a place, so it is drawn
// round the landmark rather than written on a card that has no room for it.
test('the range band is handed over as a pair of circles to draw', () => {
    const [mark] = buildSurvey(STAGE);

    assert.deepEqual(rangeBand(mark), { near: 500, far: 1800 });
    assert.equal(rangeBand(null), null);
    assert.equal(rangeBand({ window: {} }), null);

    assert.ok(!landmarkBrief(mark).includes('500'), 'and kept off the brief, which has no room');
    assert.ok(!landmarkBrief(mark).includes('1800'));
});

test('the height band is handed over in the units a renderer draws in', () => {
    const [mark] = buildSurvey(STAGE);
    const band = windowHeight(mark);

    assert.ok(Math.abs(band.low  - 1000 / FEET_PER_UNIT) < 1e-9);
    assert.ok(Math.abs(band.high - 2400 / FEET_PER_UNIT) < 1e-9);
    assert.equal(windowHeight(null), null);
    assert.equal(windowHeight({ window: {} }), null);
});

test('how far off a briefed heading is read the short way round', () => {
    assert.equal(headingMiss(10, 350), 20);
    assert.equal(headingMiss(350, 10), -20);
    assert.equal(headingMiss(90, 90), 0);
});
