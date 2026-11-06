import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    GROUND_COLOR_CHUNK, HELD_GROUND_COLOR, GROUND_COLOR_KEY, holdGroundColorSource, holdGroundColor
} from '../js/ground-material.js';
import {
    BUILDER_ENVIRONMENTS, MODE_ENVIRONMENTS, buildEnvironment, environmentElements, getEnvironment
} from '../js/environment/presets.js';

/**
 * Painted ground seen through fog that had taken everything around it, as a
 * patch of pure cyan and blue. Measured in Chromium, every vertex colour of
 * that ground lay between 0 and 1; the patch was the interpolated colour,
 * carried past a sliver triangle's corners at a pixel antialiasing shaded
 * outside it, coming out below 0 in a channel the paint holds near 0 - which
 * the frame's encoding turned into no number at all, written as 0 after the
 * fog. The fix holds the interpolated colour to 0 and 1 in the ground's shader.
 */

// Three's own chunk, as r160 writes it, so the edit is tested on the text it
// is made to.
const THREE_COLOR_FRAGMENT = [
    'void main() {',
    '\tvec4 diffuseColor = vec4( diffuse, opacity );',
    `\t${GROUND_COLOR_CHUNK}`,
    '\t#include <alphamap_fragment>',
    '}'
].join('\n');

test('the vertex colour is held to 0 and 1 in place of three\'s own chunk', () => {
    const held = holdGroundColorSource(THREE_COLOR_FRAGMENT);
    assert.ok(!held.includes(GROUND_COLOR_CHUNK), 'the chunk is replaced');
    assert.ok(held.includes(HELD_GROUND_COLOR), 'by the held one');
    assert.match(held, /diffuseColor\.rgb \*= clamp\( vColor, 0\.0, 1\.0 \);/, 'the colour multiplied in is the clamped one');
    assert.match(held, /diffuseColor \*= clamp\( vColor, 0\.0, 1\.0 \);/, 'and so is a colour carrying alpha');
    assert.ok(!/\*= vColor;/.test(held), 'and no colour is multiplied in unheld');
    assert.equal(held.replace(HELD_GROUND_COLOR, GROUND_COLOR_CHUNK), THREE_COLOR_FRAGMENT, 'and nothing else is touched');
});

test('the held chunk keeps three\'s two guards, so a material with no vertex colour compiles as it did', () => {
    const lines = HELD_GROUND_COLOR.split('\n').map(line => line.trim());
    assert.deepEqual(
        lines.filter(line => line.startsWith('#')),
        ['#if defined( USE_COLOR_ALPHA )', '#elif defined( USE_COLOR )', '#endif']
    );
});

test('a shader without the chunk is given back as it was', () => {
    assert.equal(holdGroundColorSource('void main() {}'), 'void main() {}');
    assert.equal(holdGroundColorSource(undefined), '');
});

test('a ground material compiles through the edit, cached apart from an unedited one', () => {
    const material = {};
    assert.equal(holdGroundColor(material), material, 'the material itself is handed back');

    const shader = { fragmentShader: THREE_COLOR_FRAGMENT, vertexShader: 'void main() {}' };
    material.onBeforeCompile(shader);
    assert.equal(shader.fragmentShader, holdGroundColorSource(THREE_COLOR_FRAGMENT), 'its fragment shader is held');
    assert.equal(shader.vertexShader, 'void main() {}', 'and its vertex shader left alone');
    assert.equal(material.customProgramCacheKey(), GROUND_COLOR_KEY);
});

test('the flight\'s ground and the Matter API\'s are both drawn through the held material', () => {
    for (const file of ['js/terrain.js', 'js/api/matter.js']) {
        const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
        assert.match(source, /new THREE\.Mesh\(geo, holdGroundColor\(new THREE\.MeshLambertMaterial\(\{ vertexColors: true \}\)\)\)/,
            `${file} should build its ground mesh with the colour held`);
        assert.ok(!/new THREE\.Mesh\(geo, new THREE\.MeshLambertMaterial/.test(source), `${file} should build no ground mesh unheld`);
    }
});

// --- The colours the generators write ---------------------------------------

// Coarser than the game's, which is the same generators at fewer vertices.
const SEGMENTS = 64;

function outOfRange(field) {
    const found = [];
    for (let i = 0; i < field.color.length; i++) {
        const value = field.color[i];
        if (!(value >= 0 && value <= 1)) found.push({ vertex: Math.floor(i / 3), channel: i % 3, value });
    }
    return found;
}

/**
 * The held shader is a backstop, and would hide a generator that wrote a colour
 * no colour can be. So the colours are held to the range where they are made,
 * on every world a flight or a canvas is drawn on.
 */
test('every world a flight or a canvas is drawn on is coloured within 0 and 1', () => {
    for (const environment of [...BUILDER_ENVIRONMENTS, ...MODE_ENVIRONMENTS]) {
        for (const runway of [false, true]) {
            const field = buildEnvironment(environment, { segments: SEGMENTS, runway });
            assert.deepEqual(outOfRange(field).slice(0, 3), [], `${environment.id}${runway ? ' with a runway' : ''}`);
        }
    }
});

/**
 * The build the patch was measured on: a block lifted on Highlands, water laid
 * against its foot, and pure cyan and pure blue painted at a normal blend
 * across the two - placements as the builder committed them.
 */
const MEASURED_BUILD = [
    { type: 'extrude', config: { height: 900, flatten: 1, topColor: [0.55, 0.54, 0.52], wallColor: [0.38, 0.37, 0.36], blend: 'tint' },
        footprint: { kind: 'placed', of: { kind: 'rect', x: 0, z: 0, width: 2400, depth: 2400, angle: 0, corner: 0 }, x: 0, z: 0, angle: 0, scaleX: 1, scaleZ: 1 } },
    { type: 'water', config: { density: 1, color: { light: [0.22, 0.46, 0.74], dark: [0.05, 0.15, 0.42] } },
        footprint: { kind: 'placed', of: { kind: 'stroke', points: [[-1150, 0], [1150, 0]], stamp: { width: 900, depth: 900, corner: 0 } }, x: -2450, z: 0, angle: 0, scaleX: 1, scaleZ: 1 } },
    { type: 'paint', config: { color: [0, 0.8, 0.85], opacity: 1, blend: 'normal' },
        footprint: { kind: 'placed', of: { kind: 'stroke', points: [[-150, 0], [150, 0]], stamp: { width: 400, depth: 400, corner: 0 } }, x: -1250, z: -150, angle: 0, scaleX: 1, scaleZ: 1 } },
    { type: 'paint', config: { color: [0, 0, 1], opacity: 1, blend: 'normal' },
        footprint: { kind: 'placed', of: { kind: 'stroke', points: [[-100, 0], [100, 0]], stamp: { width: 160, depth: 160, corner: 0 } }, x: -1250, z: -150, angle: 0, scaleX: 1, scaleZ: 1 } }
];

test('the build the patch was measured on is coloured within 0 and 1, at the game\'s density too', () => {
    const highlands = getEnvironment('highlands');
    const elements = [...environmentElements(highlands, false), ...MEASURED_BUILD];

    for (const segments of [SEGMENTS, 200]) {
        const field = buildEnvironment(highlands, { segments, elements });
        assert.deepEqual(outOfRange(field).slice(0, 3), [], `at ${segments} segments`);
    }

    // And the paint is there to be measured: under it the ground has a channel
    // at 0, which is the colour the antialiased pixels carried below it.
    const field = buildEnvironment(highlands, { segments: 200, elements });
    const half = field.size / 2;
    const col = Math.round((-1250 + half) / field.step);
    const row = Math.round((-150 + half) / field.step);
    const [red, , blue] = field.color.slice((row * field.stride + col) * 3);
    assert.equal(+red.toFixed(3), 0, 'no red under the paint');
    assert.ok(blue > 0.85, `and a deep blue, ${blue.toFixed(2)}`);
});
