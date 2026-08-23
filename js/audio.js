/**
 * Flight audio - the engine note that tracks the throttle, the wind that tracks
 * the airspeed, and the M key that mutes both. The mix is pure and has no DOM,
 * Web Audio, or Three.js dependency, so what the flight should sound like at a
 * given throttle and airspeed can be unit tested in Node; the class at the
 * bottom is the audio graph it is played through.
 *
 * Nothing is heard until the flight is started, because a browser will not let
 * a page make a sound before someone has pressed a key at it, and because a
 * flight held on the ramp behind the title screen is not running an engine.
 */

import { MAX_SPEED } from './flight-model.js';

export const MUTE_KEY = 'KeyM';
export const AUDIO_STORAGE_KEY = 'pilot-matter.audio-muted';

// The engine note, swept between a closed and a fully open throttle. Low
// enough to read as an engine rather than a tone, and narrow enough that an
// open throttle is a change in pitch rather than a different instrument.
export const ENGINE_IDLE_HZ = 55;
export const ENGINE_FULL_HZ = 190;

// How loud each source is allowed to get. The engine is the louder of the two
// at full throttle, and the wind overtakes it only in a dive, which is what a
// dive should sound like.
export const ENGINE_IDLE_GAIN = 0.04;
export const ENGINE_FULL_GAIN = 0.16;
export const WIND_MAX_GAIN    = 0.2;

// Wind rises faster than airspeed does, so the last of the speed range is
// where most of the noise is, rather than the whole range being a flat hiss.
export const WIND_CURVE = 2;

// How quickly a level follows the flight rather than jumping to it, in
// seconds. Long enough that a throttle sweep is a rise rather than a step.
export const AUDIO_GLIDE_SECONDS = 0.12;

function clamp(value, low, high) {
    return Math.min(Math.max(value, low), high);
}

export function isMuteKey(code) {
    return code === MUTE_KEY;
}

/**
 * Reads the stored choice. Anything other than a value this module wrote - a
 * missing key, a leftover from another version, or a storage that throws -
 * reads as unmuted, which is what a first flight should hear.
 */
export function readMuted(storage) {
    try {
        return storage?.getItem(AUDIO_STORAGE_KEY) === 'true';
    } catch {
        return false;
    }
}

/**
 * Stores the choice for the next session. A storage that refuses the write
 * costs the setting its memory and nothing else, so the flight goes on.
 *
 * Returns true when the choice was stored.
 */
export function writeMuted(storage, muted) {
    try {
        storage?.setItem(AUDIO_STORAGE_KEY, muted ? 'true' : 'false');
        return storage != null;
    } catch {
        return false;
    }
}

export function createAudioState(storage = null) {
    return { muted: readMuted(storage), storage };
}

export function toggleMute(state) {
    state.muted = !state.muted;
    writeMuted(state.storage, state.muted);
    return state.muted;
}

/**
 * Applies a key event to the mute state. Key releases and auto-repeat are
 * ignored, so the sound neither comes back on the release of M nor stutters
 * while the key is held.
 *
 * Returns true when the state changed.
 */
export function applyMuteKey(state, code, down, repeat = false) {
    if (!down || repeat || !isMuteKey(code)) return false;
    toggleMute(state);
    return true;
}

/** The engine note at a throttle setting, from a closed lever to a open one. */
export function engineFrequency(throttle) {
    const lever = clamp(Number(throttle) || 0, 0, 1);
    return ENGINE_IDLE_HZ + (ENGINE_FULL_HZ - ENGINE_IDLE_HZ) * lever;
}

/**
 * How loud the engine is at a throttle setting. A closed throttle still idles
 * rather than falling silent, because an aircraft with a running engine is
 * never quiet.
 */
export function engineGain(throttle) {
    const lever = clamp(Number(throttle) || 0, 0, 1);
    return ENGINE_IDLE_GAIN + (ENGINE_FULL_GAIN - ENGINE_IDLE_GAIN) * lever;
}

/**
 * How loud the wind is at an airspeed, as a share of the fastest the aircraft
 * flies. It rises faster than the speed does, so a standstill is silent and a
 * dive is loud.
 */
export function windGain(speed, maxSpeed = MAX_SPEED) {
    const top = Number(maxSpeed) > 0 ? Number(maxSpeed) : MAX_SPEED;
    const share = clamp((Number(speed) || 0) / top, 0, 1);
    return WIND_MAX_GAIN * share ** WIND_CURVE;
}

/**
 * What the flight sounds like this frame: the engine note and the two levels
 * the mix is made of.
 *
 * A muted flight, or one frozen by the pause menu or the title screen, is
 * silent - the levels go to zero rather than the graph being torn down, so
 * unmuting or resuming picks the sound back up where it was.
 */
export function audioLevels(state, { throttle = 0, speed = 0, maxSpeed = MAX_SPEED, frozen = false } = {}) {
    const silent = state?.muted === true || frozen === true;

    return {
        engine: {
            frequency: engineFrequency(throttle),
            gain: silent ? 0 : engineGain(throttle)
        },
        wind: {
            gain: silent ? 0 : windGain(speed, maxSpeed)
        }
    };
}

// How long the looping noise buffer is, in seconds. Long enough that the loop
// point is not a rhythm the ear can pick out of the hiss.
const NOISE_SECONDS = 2;

/**
 * The mix as an audio graph: an engine oscillator and a loop of noise for the
 * wind, each behind a filter and a gain the frame loop writes levels into.
 *
 * Built on the first call to `start()` rather than in the constructor, because
 * a browser will not run an audio context that was created before a key was
 * pressed at the page, and a simulator whose audio was created too early is one
 * that stays silent for the whole session.
 */
export class FlightAudio {
    constructor(state) {
        this.state   = state;
        this.context = null;
    }

    /**
     * Starts the audio, building the graph on the first call. Safe to call on
     * every key press: a context that is already running is left alone.
     *
     * Returns true once there is a graph to write levels into.
     */
    start() {
        if (this.context) {
            this.context.resume?.();
            return true;
        }

        const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext;
        if (!Context) return false;

        try {
            this.context = new Context();
        } catch {
            // A browser that refuses an audio context costs the flight its
            // sound and nothing else.
            this.context = null;
            return false;
        }

        this.build();
        this.context.resume?.();
        return true;
    }

    build() {
        const context = this.context;

        this.master = context.createGain();
        this.master.gain.value = 1;
        this.master.connect(context.destination);

        // The engine: a sawtooth is all harmonics, and the low pass takes the
        // top off it, which is the difference between an engine and a buzzer.
        this.engine = context.createOscillator();
        this.engine.type = 'sawtooth';
        this.engine.frequency.value = ENGINE_IDLE_HZ;

        this.engineFilter = context.createBiquadFilter();
        this.engineFilter.type = 'lowpass';
        this.engineFilter.frequency.value = 700;

        this.engineGainNode = context.createGain();
        this.engineGainNode.gain.value = 0;

        this.engine.connect(this.engineFilter);
        this.engineFilter.connect(this.engineGainNode);
        this.engineGainNode.connect(this.master);
        this.engine.start();

        // The wind: a loop of noise with the low end taken out, so it is air
        // over a canopy rather than a rumble under the engine.
        this.wind = context.createBufferSource();
        this.wind.buffer = noiseBuffer(context, NOISE_SECONDS);
        this.wind.loop = true;

        this.windFilter = context.createBiquadFilter();
        this.windFilter.type = 'bandpass';
        this.windFilter.frequency.value = 900;
        this.windFilter.Q.value = 0.6;

        this.windGainNode = context.createGain();
        this.windGainNode.gain.value = 0;

        this.wind.connect(this.windFilter);
        this.windFilter.connect(this.windGainNode);
        this.windGainNode.connect(this.master);
        this.wind.start();
    }

    /**
     * Writes the frame's levels into the graph. Every value is glided to
     * rather than set, so a throttle sweep is heard as a rise and a mute is
     * heard as a fade rather than as a click.
     */
    update(levels) {
        if (!this.context) return;

        const now = this.context.currentTime;
        glide(this.engine.frequency, levels.engine.frequency, now);
        glide(this.engineGainNode.gain, levels.engine.gain, now);
        glide(this.windGainNode.gain, levels.wind.gain, now);
    }

    /** Takes the sound back off the page, for a host tearing the flight down. */
    dispose() {
        if (!this.context) return;
        this.engine.stop();
        this.wind.stop();
        this.context.close?.();
        this.context = null;
    }
}

function glide(param, value, now, seconds = AUDIO_GLIDE_SECONDS) {
    if (param.setTargetAtTime) param.setTargetAtTime(value, now, seconds);
    else param.value = value;
}

function noiseBuffer(context, seconds) {
    const frames = Math.floor(context.sampleRate * seconds);
    const buffer = context.createBuffer(1, frames, context.sampleRate);
    const data   = buffer.getChannelData(0);

    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
}
