import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { resolveEnvironmentOptions } from '../js/api/contract.js';
import { buildEnvironment, getEnvironment } from '../js/environment/presets.js';
import { sampleHeight, DEFAULT_SIZE } from '../js/environment/elements.js';
import {
    standingObjects, obstacleTop, insideObject, placeObject, objectHeight, isObject,
    OBJECT_TYPE, OBJECT_REACH
} from '../js/objects.js';
import { expandGroups } from '../js/templates.js';
import { ERASE_TYPE } from '../js/environment/erase.js';
import { prefabById } from '../js/prefabs.js';

const source = name => readFileSync(fileURLToPath(new URL(`../js/${name}`, import.meta.url)), 'utf8');

const matter = source('api/matter.js');
const index = source('api/index.js');

/**
 * A description of the shape the builder keeps: the environment's own ground,
 * a runway template placed whole, an object standing on it, and a batch that
 * erased a second object. Every kind of placement that is not an element, which
 * is what the API used to throw on.
 */
function builtDescription() {
    return [
        { type: 'mountain', config: { count: 4, height: [200, 500], radius: [400, 900] }, seed: 11 },
        {
            type: 'group',
            template: 'basic-runway',
            config: { at: [2000, -1500], heading: 120, length: 2400, width: 240 },
            members: [{ type: 'runway', role: 'strip', config: { at: [0, 0], heading: [0, 0] } }]
        },
        placeObject('glass-cluster', [600, -200], { heading: 30, scale: 1 }),
        placeObject('cottage', [-3000, 2500], { heading: 0, scale: 1 }),
        {
            type: ERASE_TYPE,
            config: {},
            footprint: { kind: 'disc', x: -3000, z: 2500, radius: 400 }
        }
    ];
}

// --- The option --------------------------------------------------------------

test('a world is built with its objects unless a host says otherwise', () => {
    assert.equal(resolveEnvironmentOptions({}).objects, true, 'a world is its ground and what stands on it');
    assert.equal(resolveEnvironmentOptions({ objects: true }).objects, true);
    assert.equal(resolveEnvironmentOptions({ objects: false }).objects, false, 'and a host may stand its own');

    // Read the way every other boolean in the options is read, so a host that
    // leaves it out of an options object gets the default rather than off.
    assert.equal(resolveEnvironmentOptions({ objects: undefined }).objects, true);
    assert.equal(resolveEnvironmentOptions({ objects: 0 }).objects, true, 'only false turns it off, as with lights and fog');
});

// --- What the pipeline does with a built world's description -----------------

test('a built world\'s description lays its ground, and its objects stand on that ground', () => {
    const description = builtDescription();
    const preset = getEnvironment('highlands');

    // The ground, through the pipeline the API now puts a description through:
    // the group becomes its strip, the erase batch is cut out, and the objects
    // are left out because they change no ground.
    const field = buildEnvironment(preset, { size: DEFAULT_SIZE, segments: 100, elements: description, seed: 7 });
    assert.ok(field.runways.length > 0, 'the template\'s strip was cut, which the API used to throw on');

    // And what stands on it, laid out at the point it stands, on the height the
    // field reads there - which is what `createEnvironment` now hands back.
    const objects = standingObjects(expandGroups(description, DEFAULT_SIZE), {
        groundAt: (x, z) => sampleHeight(field, x, z),
        originX: 0,
        originZ: 0,
        size: DEFAULT_SIZE
    });

    assert.equal(objects.length, 1, 'the cottage was erased, the cluster stands');
    const [tower] = objects;
    assert.equal(tower.prefab, 'glass-cluster');
    assert.equal(tower.x, 600);
    assert.equal(tower.z, -200);
    // It stands on the ground the field drew rather than at sea level, and on
    // the highest of the ground under its own footprint rather than the lowest,
    // which is what the plinth between the two is for.
    const corners = footprintCorners(tower.footprint).map(([x, z]) => sampleHeight(field, x, z));
    assert.ok(tower.stand >= Math.min(...corners),
        `${tower.stand} should be ground under its own footprint, which runs ${Math.min(...corners)} to ${Math.max(...corners)}`);
    assert.ok(tower.stand >= tower.base, 'the stand is the high side of the plinth');
    assert.ok(tower.stand > 0, 'and the ground under it is the field\'s rather than sea level');
    assert.ok(tower.top > tower.stand, 'and it reaches above it');
});

/** The four corners of a footprint in the world, for reading the ground at them. */
function footprintCorners({ x, z, width, depth, angle }) {
    const cos = Math.cos(angle), sin = Math.sin(angle);
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => {
        const lx = u * width / 2, lz = v * depth / 2;
        return [x + lx * cos + lz * sin, z - lx * sin + lz * cos];
    });
}

test('the roof over a point is answered where an object stands, and nowhere else', () => {
    const field = buildEnvironment(getEnvironment('open-country'), { size: DEFAULT_SIZE, segments: 100, elements: [], seed: 3 });
    const ground = (x, z) => sampleHeight(field, x, z);
    const placements = [placeObject('glass-cluster', [0, 0], { heading: 0, scale: 1 })];
    const objects = standingObjects(placements, { groundAt: ground, size: DEFAULT_SIZE });

    const roof = obstacleTop(objects, 0, 0);
    assert.ok(roof != null, 'there is something over the middle of it');
    assert.ok(roof > ground(0, 0), 'standing over the ground rather than in it');
    assert.equal(roof, objects[0].top);
    assert.equal(roof, objects[0].stand + objectHeight(placements[0]));

    assert.equal(insideObject(objects[0], 0, 0), true);
    assert.equal(obstacleTop(objects, 6000, 6000), null, 'and nothing over open ground');
    assert.equal(obstacleTop([], 0, 0), null, 'nor over a world that stands nothing');
});

test('a road is in what stands on a world and is never in the way of anything', () => {
    const roads = prefabById('road-straight');
    assert.ok(roads, 'the catalogue holds a road');
    assert.equal(roads.recipe.drape, true, 'which is draped rather than stood');

    const field = buildEnvironment(getEnvironment('open-country'), { size: DEFAULT_SIZE, segments: 100, elements: [], seed: 3 });
    const objects = standingObjects([placeObject('road-straight', [0, 0], {})], {
        groundAt: (x, z) => sampleHeight(field, x, z),
        size: DEFAULT_SIZE
    });

    assert.equal(objects.length, 1, 'it is one of the objects a host is handed');
    assert.equal(objects[0].drape, true);
    assert.equal(objects[0].solid, false, 'and nothing solid, so nothing has to climb over it');
    assert.equal(obstacleTop(objects, 0, 0), null);
});

// --- The API's own wiring ----------------------------------------------------

test('the API puts a description through the pipeline the simulator does', () => {
    assert.match(matter, /import \{ resolveErasures \} from '\.\.\/environment\/erase\.js';/);
    assert.match(matter, /import \{ expandGroups \} from '\.\.\/templates\.js';/);
    assert.match(matter, /import \{ isObject, standingObjects, obstacleTop, OBJECT_REACH \} from '\.\.\/objects\.js';/);
    assert.match(matter, /import \{ objectGroup, disposeObjectGroup \} from '\.\.\/object-mesh\.js';/);

    assert.match(matter, /const placements = resolveErasures\(\s*expandGroups\(described\(\), field\.size\)\.filter\(placement => !isObject\(placement\)\)\s*\);/,
        'a group becomes its members, a batch is cut out, and an object changes no ground');

    // The same three steps `buildEnvironment` takes, read off that function so
    // the two cannot drift into laying different ground from one description.
    assert.match(source('environment/presets.js'),
        /resolveErasures\(\s*expandGroups\(elements \?\? environmentElements\(environment, runway\), field\.size\)\.filter\(placement => !isObject\(placement\)\)\s*\)/);
});

test('the API stands what a description places, on the ground it drew, and lets it go', () => {
    assert.match(matter, /function stand\(\) \{/);
    assert.match(matter, /if \(!resolved\.objects\) \{\s*objects = \[\];\s*return;\s*\}/,
        'objects: false stands none');
    assert.match(matter, /objects = standingObjects\(expandGroups\(described\(\), resolved\.size\), \{\s*groundAt: ground,\s*originX: origin\.x,\s*originZ: origin\.z,\s*size: resolved\.size\s*\}\);/);
    assert.match(matter, /objectMesh = objectGroup\(objects, \{ groundAt: ground \}\);/);

    // Stood after the ground is drawn, because an object reads the height under
    // its own footprint and a join moves that ground.
    const draw = matter.slice(matter.indexOf('function draw()'));
    const body = draw.slice(0, draw.indexOf('\n    }'));
    assert.ok(body.indexOf('group.add(mesh)') < body.indexOf('stand()'),
        'the ground is down before anything stands on it');
    assert.ok(body.indexOf('stand()') >= 0, 'and a redraw stands it again');

    assert.match(matter, /get objects\(\) \{ return objects; \},/);
    assert.match(matter, /obstacleTop\(x, z\) \{ return obstacleTop\(objects, x, z\); \},/);

    const dispose = matter.slice(matter.indexOf('dispose() {'));
    assert.match(dispose.slice(0, 400), /if \(objectMesh\) \{\s*group\.remove\(objectMesh\);\s*disposeObjectGroup\(objectMesh\);\s*objectMesh = null;\s*\}/,
        'and what was drawn is given back');
});

test('an assembly answers for what stands on it across its joins', () => {
    const tiled = matter.slice(matter.indexOf('export function createTiledEnvironment'));
    assert.match(tiled, /get objects\(\) \{ return built\.flatMap\(tile => tile\.objects\); \},/);
    assert.match(tiled, /for \(const \[dx, dz\] of \[\[0, 0\], \[-OBJECT_REACH, 0\], \[OBJECT_REACH, 0\], \[0, -OBJECT_REACH\], \[0, OBJECT_REACH\]\]\) \{/,
        'every square the point could be reached from, not only the one it falls on');
    assert.match(tiled, /const over = tile\.obstacleTop\(x, z\);/);

    // How far an object reaches past an edge has one home, read by both the
    // simulator's tiles and the assembly. Two copies would be two answers to
    // the same question at a join.
    assert.equal(OBJECT_REACH, 300);
    assert.match(source('terrain.js'), /import \{ standingObjects, obstacleTop, OBJECT_REACH \} from '\.\/objects\.js';/);
    assert.doesNotMatch(source('terrain.js'), /const OBJECT_REACH =/, 'and no second copy of it');
});

test('a host can read a built world\'s file and what stands on it without the renderer', () => {
    assert.match(index, /readEnvironmentDocument, environmentDocument, environmentText\s*\} from '\.\.\/environment-file\.js';/,
        'the file a built world is saved as, read and written');
    assert.match(index, /standingObjects, insideObject, obstacleTop\s*\} from '\.\.\/objects\.js';/);

    // Both are pure: a host checking a file or reading what stands on a world
    // takes neither a renderer nor a loader with it.
    for (const name of ['environment-file.js', 'objects.js']) {
        assert.doesNotMatch(source(name), /from 'three'/, `${name} should stay pure`);
        assert.doesNotMatch(source(name), /globalThis\.document|window\./, `${name} should stay pure`);
    }

    assert.equal(OBJECT_TYPE, 'object');
    assert.equal(isObject({ type: OBJECT_TYPE }), true);
});
