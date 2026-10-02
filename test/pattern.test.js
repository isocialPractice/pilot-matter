import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    buildPattern, legOffset, legCrossed, legProgress, legAltitude, headingMiss,
    createPatternState, resetPattern, samplePattern, scoreLeg, completeLeg,
    patternScore, flownLegs,
    PATTERN_LEGS, TAKEOFF_LEG, FINAL_LEG, LEG_HEIGHTS,
    LEFT_HAND, RIGHT_HAND, HEADING_REACH, ALTITUDE_REACH
} from '../js/pattern.js';
import { runwayDirection, runwayThresholds } from '../js/environment/elements.js';
import { FEET_PER_UNIT } from '../js/units.js';
import { PERFECT_SCORE } from '../js/landing-score.js';

// A strip in the shape the generator hands one over. The thresholds are read
// off `alongX` and `alongZ` rather than recomputed from the bearing, so a
// stand-in that carries only the bearing measures a circuit round nothing.
function strip(heading = 90, over = {}) {
    return {
        x: 0, z: 0, heading, ...runwayDirection(heading),
        length: 2000, width: 300, elevation: 60, ...over
    };
}

const PLAN = {
    pattern: { altitudeFeet: 1000, upwind: 1100, offset: 1600, final: 1500 }
};

// --- The shape of it -------------------------------------------------------

test('a circuit is the five legs a pattern is flown round, in order', () => {
    const legs = buildPattern(PLAN, strip());

    assert.equal(legs.length, PATTERN_LEGS.length);
    assert.deepEqual(legs.map(leg => leg.label), [...PATTERN_LEGS]);
    assert.deepEqual(legs.map(leg => leg.index), [0, 1, 2, 3, 4]);
});

test('a circuit needs something to be laid round, and lays nothing without it', () => {
    assert.deepEqual(buildPattern(PLAN, null), []);
    assert.deepEqual(buildPattern({}, strip()), []);
    assert.deepEqual(buildPattern(null, strip()), []);
});

// The whole point of a circuit is that it comes back. A pattern that finished
// anywhere but the threshold would be a pattern whose last leg was not an
// approach, and the landing at the end of it would be somewhere else entirely.
test('a circuit closes on the threshold it opened from', () => {
    for (const heading of [0, 45, 90, 180, 237, 330]) {
        const runway = strip(heading);
        const legs = buildPattern(PLAN, runway);
        const [approach] = runwayThresholds(runway);

        const start = legs[TAKEOFF_LEG];
        const end   = legs[FINAL_LEG];

        assert.ok(Math.hypot(start.fromX - approach.x, start.fromZ - approach.z) < 1e-6,
            `the takeoff on ${heading} should begin at the threshold`);
        assert.ok(Math.hypot(end.x - approach.x, end.z - approach.z) < 1e-6,
            `and the final on ${heading} should end back at it`);
    }
});

// Two of the five turns are on the strip itself, and a leg says which it is.
// Whatever draws the circuit needs telling: a turn in open air is a place with
// nothing at it and wants a mast, while the two thresholds are the ends of a
// drawn strip the approach marks already pick out. A mast at those stood on
// the runway, at the place the takeoff roll ends and the place the landing is
// flown onto.
test('a leg says whether the turn it is named by stands on the strip', () => {
    for (const heading of [0, 90, 237, 304]) {
        const runway = strip(heading);
        const legs = buildPattern(PLAN, runway);
        const [approach, departure] = runwayThresholds(runway);

        assert.deepEqual(legs.map(leg => leg.onStrip), [true, false, false, false, true],
            `on ${heading} the takeoff and the final are the two turns on the strip`);

        // And they are on it because they are the thresholds, rather than by
        // being the first and the last.
        const ends = legs.filter(leg => leg.onStrip);
        assert.ok(Math.hypot(ends[0].x - departure.x, ends[0].z - departure.z) < 1e-6,
            'the takeoff ends at the departure threshold');
        assert.ok(Math.hypot(ends[1].x - approach.x, ends[1].z - approach.z) < 1e-6,
            'and the final back at the approach one');

        // Every turn that is not on the strip is somewhere else entirely, so
        // nothing is drawn at a threshold by accident.
        for (const leg of legs.filter(leg => !leg.onStrip)) {
            assert.ok(Math.hypot(leg.x - approach.x, leg.z - approach.z) > 1
                   && Math.hypot(leg.x - departure.x, leg.z - departure.z) > 1,
                `${leg.label} turns in open air, away from either threshold`);
        }
    }
});

test('each leg begins where the one before it ended', () => {
    const legs = buildPattern(PLAN, strip(237));

    for (let at = 1; at < legs.length; at++) {
        assert.ok(Math.abs(legs[at].fromX - legs[at - 1].x) < 1e-9
               && Math.abs(legs[at].fromZ - legs[at - 1].z) < 1e-9,
            `${legs[at].label} should pick up where ${legs[at - 1].label} left off`);
        assert.equal(legs[at].fromFeet, legs[at - 1].altitudeFeet,
            'and at the height it left off at, so the ramp through the circuit is unbroken');
    }
});

// The downwind is the leg a pilot holds a heading on, so it is the one that
// has to be parallel to the strip. The turn onto it belongs to the climb out,
// which is why that leg is a diagonal and this one is not.
test('the takeoff, the downwind and the final run with the strip', () => {
    for (const heading of [0, 90, 180, 300]) {
        const legs = buildPattern(PLAN, strip(heading));
        const reciprocal = (heading + 180) % 360;

        assert.ok(Math.abs(headingMiss(legs[0], heading)) < 1e-6, 'the takeoff runs down the strip');
        assert.ok(Math.abs(headingMiss(legs[2], reciprocal)) < 1e-6, 'the downwind runs back up it');
        assert.ok(Math.abs(headingMiss(legs[4], heading)) < 1e-6, 'and the final comes back down it');
    }
});

test('the base crosses the strip at a right angle to it', () => {
    const legs = buildPattern(PLAN, strip(90));
    const off = Math.abs(headingMiss(legs[3], 90));
    assert.ok(Math.abs(off - 90) < 1e-6, `base should be square to the strip, and is ${off} off it`);
});

// A left-hand circuit is the standard one, and the only thing that makes it
// one is which side of the strip the downwind lies on.
test('the hand of the circuit is which side the downwind lies', () => {
    const runway = strip(90);
    const left  = buildPattern({ pattern: { ...PLAN.pattern, hand: LEFT_HAND } }, runway);
    const right = buildPattern({ pattern: { ...PLAN.pattern, hand: RIGHT_HAND } }, runway);

    // Mirrored about the strip's own line, which for a strip on heading 90
    // through the origin is the z axis.
    assert.ok(Math.abs(left[2].z + right[2].z) < 1e-6, 'the two downwinds mirror each other');
    assert.ok(Math.abs(left[2].z) > 0, 'and neither lies on the strip');
    assert.equal(buildPattern(PLAN, runway)[2].z, left[2].z, 'left-hand is the one with no hand named');
});

test('the circuit is flown at the height the stage asks for, over the field', () => {
    const runway = strip(90, { elevation: 100 });
    const legs = buildPattern(PLAN, runway);
    const field = 100 * FEET_PER_UNIT;

    assert.equal(legs[TAKEOFF_LEG].altitudeFeet, field, 'the takeoff ends on the ground');
    assert.equal(legs[2].altitudeFeet, field + 1000, 'the downwind is flown at the circuit height');
    assert.equal(legs[FINAL_LEG].altitudeFeet, field, 'and the final comes back to the field');

    legs.forEach((leg, at) => {
        assert.equal(leg.altitudeFeet, field + 1000 * LEG_HEIGHTS[at],
            `${leg.label} should be at its own share of the circuit height`);
    });
});

// --- Crossing from one leg to the next -------------------------------------

test('the end of a leg is the line the next one begins past', () => {
    const [leg] = buildPattern(PLAN, strip(90));

    const before = { x: leg.x - leg.dirX * 10, z: leg.z - leg.dirZ * 10 };
    const after  = { x: leg.x + leg.dirX * 10, z: leg.z + leg.dirZ * 10 };

    assert.ok(legOffset(leg, before) < 0, 'short of the turn reads as short of it');
    assert.ok(legOffset(leg, after)  > 0, 'and past it reads as past it');
    assert.equal(legCrossed(leg, before, after), true);
});

// An aircraft covers more ground in a frame than a line is wide, which is why
// a step is tested rather than a place.
test('a step that leaps the turn in one frame still crosses it', () => {
    const [leg] = buildPattern(PLAN, strip(90));
    const before = { x: leg.x - leg.dirX * 400, z: leg.z - leg.dirZ * 400 };
    const after  = { x: leg.x + leg.dirX * 400, z: leg.z + leg.dirZ * 400 };

    assert.equal(legCrossed(leg, before, after), true);
});

test('coming back over a turn is not crossing it again', () => {
    const [leg] = buildPattern(PLAN, strip(90));
    const past  = { x: leg.x + leg.dirX * 50, z: leg.z + leg.dirZ * 50 };
    const back  = { x: leg.x - leg.dirX * 50, z: leg.z - leg.dirZ * 50 };

    assert.equal(legCrossed(leg, past, back), false,
        'a pilot who has overshot and come back is on the leg they were on');
});

test('a step with nothing to put it to crosses nothing', () => {
    const [leg] = buildPattern(PLAN, strip(90));
    assert.equal(legCrossed(null, { x: 0, z: 0 }, { x: 1, z: 1 }), false);
    assert.equal(legCrossed(leg, null, { x: 1, z: 1 }), false);
    assert.equal(legCrossed(leg, { x: 0, z: 0 }, null), false);
});

// --- What the leg is asking for at a place along it ------------------------

test('how far along a leg is read from its own two ends', () => {
    const legs = buildPattern(PLAN, strip(90));
    const leg = legs[2];

    assert.equal(legProgress(leg, { x: leg.fromX, z: leg.fromZ }), 0);
    assert.equal(legProgress(leg, { x: leg.x, z: leg.z }), 1);

    const middle = { x: (leg.fromX + leg.x) / 2, z: (leg.fromZ + leg.z) / 2 };
    assert.ok(Math.abs(legProgress(leg, middle) - 0.5) < 1e-9);
});

// An aircraft wide of the turn is still being asked for this leg's height
// rather than for one further round, so the reading is held inside the leg.
test('a place off the end of a leg is held to the leg', () => {
    const legs = buildPattern(PLAN, strip(90));
    const leg = legs[2];

    const short = { x: leg.fromX - leg.dirX * 5000, z: leg.fromZ - leg.dirZ * 5000 };
    const over  = { x: leg.x + leg.dirX * 5000, z: leg.z + leg.dirZ * 5000 };

    assert.equal(legProgress(leg, short), 0);
    assert.equal(legProgress(leg, over), 1);
});

test('a climbing leg asks for the height it has got to rather than the one it ends at', () => {
    const legs = buildPattern(PLAN, strip(90, { elevation: 0 }));
    const climb = legs[1];

    const middle = { x: (climb.fromX + climb.x) / 2, z: (climb.fromZ + climb.z) / 2 };
    assert.ok(Math.abs(legAltitude(climb, middle) - 500) < 1e-6,
        'halfway up the climb out is halfway to the circuit height');
    assert.equal(legAltitude(climb, { x: climb.x, z: climb.z }), 1000);
});

test('a level leg asks for one height all the way along it', () => {
    const legs = buildPattern(PLAN, strip(90, { elevation: 0 }));
    const downwind = legs[2];

    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        const at = {
            x: downwind.fromX + (downwind.x - downwind.fromX) * t,
            z: downwind.fromZ + (downwind.z - downwind.fromZ) * t
        };
        assert.equal(legAltitude(downwind, at), 1000);
    }
});

test('how far off a heading is read the short way round', () => {
    const leg = { heading: 350 };
    assert.equal(headingMiss(leg, 10), 20, 'past north is twenty degrees, not three hundred and forty');
    assert.equal(headingMiss(leg, 330), -20);
    assert.equal(headingMiss(leg, 350), 0);
});

// --- Holding the leg -------------------------------------------------------

test('a leg flown dead on reads as flown dead on', () => {
    const legs = buildPattern(PLAN, strip(90, { elevation: 0 }));
    const leg = legs[2];
    const state = createPatternState();

    for (let t = 0; t <= 1; t += 0.1) {
        const at = {
            x: leg.fromX + (leg.x - leg.fromX) * t,
            z: leg.fromZ + (leg.z - leg.fromZ) * t,
            altitudeFeet: legAltitude(leg, { x: leg.fromX + (leg.x - leg.fromX) * t,
                                             z: leg.fromZ + (leg.z - leg.fromZ) * t }),
            headingDegrees: leg.heading
        };
        samplePattern(state, leg, at, 0.5);
    }

    const flown = scoreLeg(state, leg);
    assert.equal(flown.altitude, 0);
    assert.equal(flown.heading, 0);
    assert.equal(flown.score, PERFECT_SCORE);
});

test('the errors are means over the time the leg took, not sums over its frames', () => {
    const legs = buildPattern(PLAN, strip(90, { elevation: 0 }));
    const leg = legs[2];

    // The same leg flown identically wrong, once in long frames and once in
    // short ones. A machine drawing twice as fast should not score twice as
    // badly.
    const reading = { x: leg.fromX, z: leg.fromZ, altitudeFeet: legAltitude(leg, leg) + 100,
                      headingDegrees: leg.heading + 10 };

    const slow = createPatternState();
    for (let i = 0; i < 10; i++) samplePattern(slow, leg, reading, 0.1);

    const fast = createPatternState();
    for (let i = 0; i < 100; i++) samplePattern(fast, leg, reading, 0.01);

    assert.ok(Math.abs(scoreLeg(slow, leg).altitude - scoreLeg(fast, leg).altitude) < 1e-9);
    assert.equal(scoreLeg(slow, leg).score, scoreLeg(fast, leg).score);
});

test('a frame with no time in it reads nothing, so a paused circuit is not judged', () => {
    const [leg] = buildPattern(PLAN, strip(90));
    const state = createPatternState();

    samplePattern(state, leg, { x: 0, z: 0, altitudeFeet: 9999, headingDegrees: 0 }, 0);
    assert.equal(state.legs[0].seconds, 0);
    assert.equal(state.legs[0].altitude, 0);
});

test('a reading that cannot be taken is not counted as a reading of nothing', () => {
    const [leg] = buildPattern(PLAN, strip(90));
    const state = createPatternState();

    samplePattern(state, leg, { x: 0, z: 0 }, 1);
    samplePattern(state, leg, { altitudeFeet: NaN, headingDegrees: 0 }, 1);

    assert.equal(state.legs[0].seconds, 0, 'a frame with no altitude or heading in it is skipped');
});

test('being out past the reach takes a mark to nothing rather than below it', () => {
    const legs = buildPattern(PLAN, strip(90, { elevation: 0 }));
    const leg = legs[2];
    const state = createPatternState();

    samplePattern(state, leg, {
        x: leg.fromX, z: leg.fromZ,
        altitudeFeet: legAltitude(leg, leg) + ALTITUDE_REACH * 10,
        headingDegrees: leg.heading + HEADING_REACH * 4
    }, 1);

    const flown = scoreLeg(state, leg);
    assert.equal(flown.marks.altitude, 0);
    assert.equal(flown.marks.heading, 0);
    assert.equal(flown.score, 0);
});

test('a stage can ask for more of the same thing by drawing the reaches in', () => {
    const legs = buildPattern(PLAN, strip(90, { elevation: 0 }));
    const leg = legs[2];
    const state = createPatternState();

    samplePattern(state, leg, {
        x: leg.fromX, z: leg.fromZ,
        altitudeFeet: legAltitude(leg, leg) + 100,
        headingDegrees: leg.heading
    }, 1);

    const wide  = scoreLeg(state, leg, { altitude: 400, heading: 30 });
    const tight = scoreLeg(state, leg, { altitude: 150, heading: 12 });
    assert.ok(tight.score < wide.score, 'the same flying scores less against a tighter reach');
});

test('a leg is closed once, and the first reading is the one that stands', () => {
    const legs = buildPattern(PLAN, strip(90, { elevation: 0 }));
    const leg = legs[2];
    const state = createPatternState();

    samplePattern(state, leg, {
        x: leg.fromX, z: leg.fromZ,
        altitudeFeet: legAltitude(leg, leg), headingDegrees: leg.heading
    }, 1);
    const first = completeLeg(state, leg);

    // Fly it badly afterwards and close it again: the leg was flown to its
    // turn, and what happened after the turn belongs to the next leg.
    samplePattern(state, leg, {
        x: leg.fromX, z: leg.fromZ,
        altitudeFeet: legAltitude(leg, leg) + 5000, headingDegrees: leg.heading + 90
    }, 10);

    assert.equal(completeLeg(state, leg), first);
    assert.equal(first.score, PERFECT_SCORE);
});

test('a leg crossed in a single frame is not a leg held badly', () => {
    const legs = buildPattern(PLAN, strip(90));
    const flown = completeLeg(createPatternState(), legs[3]);

    assert.equal(flown.seconds, 0);
    assert.equal(flown.score, PERFECT_SCORE,
        'there is nothing to have held badly over no time at all');
});

test('the circuit comes to the mean of the legs flown, and to nothing before one is', () => {
    const legs = buildPattern(PLAN, strip(90, { elevation: 0 }));
    const state = createPatternState();

    assert.equal(patternScore(state), null);
    assert.deepEqual(flownLegs(state), []);

    // One leg dead on, one leg right out.
    completeLeg(state, legs[0]);
    samplePattern(state, legs[1], {
        x: legs[1].fromX, z: legs[1].fromZ,
        altitudeFeet: legAltitude(legs[1], legs[1]) + ALTITUDE_REACH * 4,
        headingDegrees: legs[1].heading + HEADING_REACH * 4
    }, 1);
    completeLeg(state, legs[1]);

    assert.equal(flownLegs(state).length, 2);
    assert.equal(patternScore(state), Math.round(PERFECT_SCORE / 2));
});

test('a circuit put back to its beginning has nothing held against it', () => {
    const legs = buildPattern(PLAN, strip(90));
    const state = createPatternState();

    samplePattern(state, legs[0], {
        x: 0, z: 0, altitudeFeet: 5000, headingDegrees: 0
    }, 5);
    completeLeg(state, legs[0]);

    resetPattern(state);
    assert.equal(patternScore(state), null);
    assert.equal(state.legs[0].seconds, 0);
});

// The approach is read against its height and heading every frame it is flown,
// the same as the other four legs - `LEG_HEIGHTS` ramps it down to the field and
// the module calls it an approach. What it had no way of becoming was a mark:
// no turn can close it, because the pilot crosses the threshold on every
// go-around they fly, so the tally filled up every frame and nothing ever read
// it. The landing is what closes it.
test('the final leg can be closed, and the circuit counts it when it is', () => {
    const legs = buildPattern(PLAN, strip(90, { elevation: 0 }));
    const final = legs[FINAL_LEG];
    const state = createPatternState();

    // One leg flown dead on, and the approach flown well off its height, so
    // the circuit's mark moves when the approach is counted into it.
    completeLeg(state, legs[0]);
    samplePattern(state, final, {
        x: final.fromX, z: final.fromZ,
        altitudeFeet: legAltitude(final, final) + ALTITUDE_REACH * 4,
        headingDegrees: final.heading + HEADING_REACH * 4
    }, 3);

    const before = patternScore(state);
    assert.equal(flownLegs(state).length, 1, 'the approach is read but not yet closed');

    const flown = completeLeg(state, final, {});
    assert.equal(flown.index, FINAL_LEG);
    assert.equal(flown.label, 'FINAL');
    assert.equal(flown.score, 0, 'an approach flown right out of both reaches holds nothing');

    assert.equal(flownLegs(state).length, 2, 'and once closed it is one of the legs flown');
    assert.equal(patternScore(state), Math.round(PERFECT_SCORE / 2));
    assert.notEqual(patternScore(state), before,
        'so the circuit is read over the approach rather than around it');
});

// --- The seam between the circuit and what draws it -----------------------

/**
 * Everything above is the circuit as geometry and arithmetic. What is done with
 * it is decided in `js/main.js`, which imports Three.js and cannot be loaded
 * here, so the seam is read out of the source the way `test/minimap.test.js`
 * reads the chart's.
 *
 * Both spans below have already been wrong, and neither failure could be seen
 * from Node: a mast standing on the runway at each end of the strip, and a
 * final leg sampled every frame into a tally no call ever closed.
 *
 * Each span is bounded to the method it is anchored on rather than running to
 * the end of the file, for the reason `test/input-map.test.js` gives: an
 * unbounded span matches the same text written a second time anywhere below,
 * and passes a call that no longer makes it.
 */
const mainSource = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');

test('a mast is put up at the turns in open air and not at the two on the strip', () => {
    const method = mainSource.match(/^ {4}standingMarks\(\)\s*\{([\s\S]*?)^ {4}\}/m);
    assert.ok(method, 'js/main.js should still gather what a stage puts on a mast in one place');

    const body = method[1];
    assert.match(body, /this\.circuit\.filter\(leg => !leg\.onStrip\)/,
        'the turns on the strip are left out, since the strip is already drawn there');
    assert.match(body, /at: leg\.index/,
        'and each mark carries its own leg, because the list is now shorter than the circuit');
});

test('the mast being waited on is lit by the leg rather than by its place in the list', () => {
    const marker = readFileSync(new URL('../js/marker.js', import.meta.url), 'utf8');

    const method = marker.match(/^ {4}setNext\(index\)\s*\{([\s\S]*?)^ {4}\}/m);
    assert.ok(method, 'js/marker.js should still colour the heads in one place');
    assert.match(method[1], /colorFor\(this\.lit\[at\] \?\? at, index\)/,
        'a mark that names the mark it stands for is lit by that, and the rest by position');

    assert.match(marker, /this\.lit = markers\.map\(\(marker, at\) => marker\.at \?\? at\)/,
        'and what each head is lit by is read off the markers when they are drawn');
});

test('the landing closes the final leg, and reports the circuit with it', () => {
    const method = mainSource.match(/^ {4}closeFinalLeg\(\)\s*\{([\s\S]*?)^ {4}\}/m);
    assert.ok(method, 'js/main.js should close the circuit\'s last leg in one place');

    const body = method[1];
    assert.match(body, /this\.circuit\[FINAL_LEG\]/,
        'the leg closed is the final one, which is the leg a turn cannot close');
    assert.match(body, /completeLeg\(this\.pattern, leg, stageReaches\(this\.run\)\)/,
        'and it is closed the way every other leg is');
    assert.match(body, /circuitNotice\(flown, patternScore\(this\.pattern\)\)/,
        'then the leg and the whole circuit are reported together');

    // And it is the landing that calls it, which is the one event that means a
    // circuit was flown out rather than crossed over.
    const landing = mainSource.match(/^ {4}onLanding\(runway, contact\)\s*\{([\s\S]*?)^ {4}\}/m);
    assert.ok(landing, 'js/main.js should still take a landing in one place');
    assert.match(landing[1], /this\.closeFinalLeg\(\);/,
        'the final leg is closed by the arrival, inside the guard that counts it');
});
