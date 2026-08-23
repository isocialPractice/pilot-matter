import test from 'node:test';
import assert from 'node:assert/strict';
import {
    MUTE_KEY,
    AUDIO_STORAGE_KEY,
    ENGINE_IDLE_HZ,
    ENGINE_FULL_HZ,
    ENGINE_IDLE_GAIN,
    ENGINE_FULL_GAIN,
    WIND_MAX_GAIN,
    isMuteKey,
    readMuted,
    writeMuted,
    createAudioState,
    toggleMute,
    applyMuteKey,
    engineFrequency,
    engineGain,
    windGain,
    audioLevels
} from '../js/audio.js';
import { MAX_SPEED } from '../js/flight-model.js';

// Enough of a storage for the choice to be remembered, with no browser to
// remember it in.
function fakeStorage(initial = {}) {
    const values = { ...initial };
    return {
        getItem: (key) => (key in values ? values[key] : null),
        setItem: (key, value) => { values[key] = String(value); },
        values
    };
}

function refusingStorage() {
    return {
        getItem() { throw new Error('storage is blocked'); },
        setItem() { throw new Error('storage is blocked'); }
    };
}

test('the mute key is M, and it is not a key anything else answers to', () => {
    assert.equal(isMuteKey(MUTE_KEY), true);
    for (const code of ['KeyN', 'KeyP', 'KeyH', 'KeyO', 'Tab']) {
        assert.equal(isMuteKey(code), false, `${code} already belongs to something else`);
    }
});

test('a first flight is heard rather than muted', () => {
    assert.equal(createAudioState(null).muted, false);
    assert.equal(readMuted(fakeStorage()), false);
});

test('the throttle is what the engine note is read off', () => {
    assert.equal(engineFrequency(0), ENGINE_IDLE_HZ);
    assert.equal(engineFrequency(1), ENGINE_FULL_HZ);
    assert.ok(engineFrequency(0.5) > engineFrequency(0.2), 'more throttle should be a higher note');

    assert.equal(engineGain(0), ENGINE_IDLE_GAIN, 'a closed throttle still idles rather than falling silent');
    assert.equal(engineGain(1), ENGINE_FULL_GAIN);
});

test('a throttle setting outside the lever is held to the lever', () => {
    assert.equal(engineFrequency(-3), ENGINE_IDLE_HZ);
    assert.equal(engineFrequency(9), ENGINE_FULL_HZ);
    assert.equal(engineGain('not a throttle'), ENGINE_IDLE_GAIN);
});

test('the wind is silent at a standstill and loudest at the top of the range', () => {
    assert.equal(windGain(0), 0);
    assert.equal(windGain(MAX_SPEED), WIND_MAX_GAIN);
    assert.equal(windGain(MAX_SPEED * 2), WIND_MAX_GAIN, 'and no louder past it');
});

// Wind rises faster than airspeed does, so the last of the range carries most
// of the noise rather than the whole range being a flat hiss.
test('the wind rises faster than the airspeed behind it', () => {
    const half = windGain(MAX_SPEED / 2);
    assert.ok(half < WIND_MAX_GAIN / 2, 'half the speed should be less than half the noise');
    assert.ok(half > 0, 'and still be something');
});

test('a wind with no speed range to read against falls back rather than dividing by zero', () => {
    assert.equal(Number.isFinite(windGain(50, 0)), true);
    assert.equal(windGain(50, 0), windGain(50, MAX_SPEED));
});

test('the mix follows the throttle and the airspeed', () => {
    const state = createAudioState(null);
    const idle  = audioLevels(state, { throttle: 0, speed: 0 });
    const full  = audioLevels(state, { throttle: 1, speed: MAX_SPEED });

    assert.ok(full.engine.frequency > idle.engine.frequency);
    assert.ok(full.engine.gain > idle.engine.gain);
    assert.ok(full.wind.gain > idle.wind.gain);
    assert.equal(idle.wind.gain, 0, 'a standstill has no wind over it');
});

test('a muted flight is silent, and the note it would have played is still there', () => {
    const state = createAudioState(null);
    toggleMute(state);

    const levels = audioLevels(state, { throttle: 1, speed: MAX_SPEED });
    assert.equal(levels.engine.gain, 0);
    assert.equal(levels.wind.gain, 0);
    assert.equal(levels.engine.frequency, ENGINE_FULL_HZ,
        'unmuting should pick the sound back up where it was rather than from silence');
});

// A frozen simulation is a frozen soundtrack: an engine that carried on
// running behind a paused frame would be a frame that was not paused.
test('a frozen flight is silent whether or not it is muted', () => {
    const state = createAudioState(null);
    const levels = audioLevels(state, { throttle: 1, speed: MAX_SPEED, frozen: true });
    assert.equal(levels.engine.gain, 0);
    assert.equal(levels.wind.gain, 0);
});

test('a mix asked for with nothing at all is silence rather than a crash', () => {
    const levels = audioLevels(createAudioState(null));
    assert.equal(levels.engine.frequency, ENGINE_IDLE_HZ);
    assert.equal(levels.engine.gain, ENGINE_IDLE_GAIN);
    assert.equal(levels.wind.gain, 0);
});

test('the mute key latches rather than holding, and does not stutter when held', () => {
    const state = createAudioState(null);

    assert.equal(applyMuteKey(state, MUTE_KEY, true), true);
    assert.equal(state.muted, true);
    assert.equal(applyMuteKey(state, MUTE_KEY, false), false, 'a release is not a second press');
    assert.equal(state.muted, true);
    assert.equal(applyMuteKey(state, MUTE_KEY, true, true), false, 'nor is auto-repeat');
    assert.equal(state.muted, true);
    assert.equal(applyMuteKey(state, MUTE_KEY, true), true);
    assert.equal(state.muted, false);
});

test('keys the mute knows nothing about leave the sound alone', () => {
    const state = createAudioState(null);
    for (const code of ['KeyW', 'KeyP', 'Enter']) {
        assert.equal(applyMuteKey(state, code, true), false);
    }
    assert.equal(state.muted, false);
});

test('the choice outlives the session that made it', () => {
    const storage = fakeStorage();
    const state = createAudioState(storage);

    toggleMute(state);
    assert.equal(storage.values[AUDIO_STORAGE_KEY], 'true');
    assert.equal(createAudioState(storage).muted, true);

    toggleMute(state);
    assert.equal(createAudioState(storage).muted, false);
});

test('a storage holding something that is not a choice reads as unmuted', () => {
    for (const stored of ['', 'yes', 'TRUE', '1']) {
        assert.equal(readMuted(fakeStorage({ [AUDIO_STORAGE_KEY]: stored })), false,
            `"${stored}" is not something this module wrote`);
    }
});

test('a storage that refuses costs the choice its memory and nothing else', () => {
    assert.equal(readMuted(refusingStorage()), false);
    assert.equal(writeMuted(refusingStorage(), true), false);
    assert.equal(writeMuted(null, true), false);

    const state = createAudioState(refusingStorage());
    assert.equal(toggleMute(state), true, 'the flight goes on either way');
});
