import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    ENVIRONMENT_FORMAT, ENVIRONMENT_VERSION, ENVIRONMENT_FILE_SUFFIX, ENVIRONMENT_FILE_LIMIT, ENVIRONMENT_NAME_LIMIT,
    DOCUMENT_FIELDS, DOCUMENT_REQUIRED, ROW_FIELDS,
    placementTypes, baseIds, cleanName, defaultEnvironmentName,
    environmentDocument, environmentText, environmentFileName, readEnvironmentDocument
} from '../js/environment-file.js';
import { ELEMENTS_BY_ID, getElement } from '../js/environment/elements.js';
import { BUILDER_ENVIRONMENTS } from '../js/environment/presets.js';
import { createEditorState, canvasWorld } from '../js/element-editor.js';
import { placeTemplate } from '../js/templates.js';
import { ERASE_TYPE } from '../js/environment/erase.js';

const schema = JSON.parse(readFileSync(new URL('../schemas/environment.schema.json', import.meta.url), 'utf8'));

/** A world as the builder keeps one: every kind of placement it commits, over the rows of an environment. */
function builtWorld(base = 'highlands') {
    const editor = createEditorState(base);
    const rows = canvasWorld(editor, base);
    const mountain = rows.find(row => row.type === 'mountain');
    if (mountain) mountain.config.height = [250, 600];
    // A row's id is its own, and is kept: one that is not the index it would
    // be named for shows that it is read back rather than made up.
    rows.at(-1).id = `${rows.at(-1).type}-17`;
    return {
        environment: base,
        placements: [
            { type: 'mountain', config: { count: 1, at: [1200, -800], height: [300, 700] }, seed: 301794027 },
            { type: 'water', config: { density: 1, color: { light: [0.22, 0.46, 0.74], dark: [0.05, 0.15, 0.42] } },
                footprint: { kind: 'placed', of: { kind: 'stroke', points: [[-1150, 0], [1150, 0]], stamp: { width: 900, depth: 900, corner: 0 } }, x: -2450, z: 0, angle: 0, scaleX: 1, scaleZ: 1 } },
            { type: 'grass', config: { density: 0.5 },
                footprint: { kind: 'placed', of: { kind: 'stroke', points: [[0, 0], [300, 40]], stamp: { width: 200, depth: 200, corner: 0 } }, x: 500, z: 500, angle: 0.3, scaleX: 1.2, scaleZ: 1 },
                clip: { kind: 'rect', x: 400, z: 400, width: 2000, depth: 2000, angle: 0, corner: 0 } },
            { type: 'paint', config: { color: [0, 0.8, 0.85], opacity: 1, blend: 'normal' },
                footprint: { kind: 'placed', of: { kind: 'stroke', points: [[-150, 0], [150, 0]], stamp: { width: 400, depth: 400, corner: 0 } }, x: -1250, z: -150, angle: 0, scaleX: 1, scaleZ: 1 } },
            { type: 'extrude', config: { height: 900, flatten: 1, topColor: [0.55, 0.54, 0.52], wallColor: [0.38, 0.37, 0.36], blend: 'tint' },
                footprint: { kind: 'placed', of: { kind: 'rect', x: 0, z: 0, width: 2400, depth: 2400, angle: 0, corner: 0 }, x: 0, z: 0, angle: 0, scaleX: 1, scaleZ: 1 } },
            { type: ERASE_TYPE, config: { target: 'grass', strength: 1, restore: true },
                footprint: { kind: 'stroke', points: [[0, 0], [100, 0]], stamp: { width: 100, depth: 100, corner: 0 } } },
            placeTemplate('basic-airport', [3000, 3000], 90)
        ],
        world: rows
    };
}

const SAVED = '2026-11-05T12:00:00.000Z';

// --- Written, and read back -----------------------------------------------------------

test('a world written and read back is the world it was', () => {
    for (const base of baseIds()) {
        const world = builtWorld(base);
        const read = readEnvironmentDocument(environmentText(environmentDocument(world, { name: 'Sample Valley', savedAt: SAVED })));
        assert.equal(read.ok, true, `${base}: ${read.problems.join('; ')}`);
        assert.deepEqual(read.world, world, `${base}: every row and every placement`);
        assert.equal(read.name, 'Sample Valley');
        assert.equal(read.savedAt, SAVED);
    }
});

test('a document is what a file holds, and shares nothing with the world it was written from', () => {
    const world = builtWorld();
    const document = environmentDocument(world, { name: 'Sample Valley', savedAt: SAVED });
    assert.deepEqual(Object.keys(document), ['format', 'version', 'name', 'savedAt', 'base', 'elements', 'placements']);
    assert.equal(document.format, ENVIRONMENT_FORMAT);
    assert.equal(document.version, ENVIRONMENT_VERSION);
    assert.equal(document.base, 'highlands');
    for (const row of document.elements) assert.deepEqual(Object.keys(row), ROW_FIELDS, 'a row\'s label and note are the element\'s, not the file\'s');
    document.placements[0].config.at[0] = 99;
    document.elements[0].config.height[0] = 1;
    assert.equal(world.placements[0].config.at[0], 1200);
    assert.equal(world.world[0].config.height[0], 250);
    assert.ok(environmentText(document).endsWith('}\n'), 'and its text ends as a file does');
    assert.match(environmentText(document), /\n  "format": "pilot-matter\.environment",\n/, 'indented, for a person to read');
});

test('what a footprint settled for the generator is never written, nor taken from a file', () => {
    const world = builtWorld();
    world.placements[1].config.drawn = { line: [1, 2, 3] };
    const document = environmentDocument(world, { savedAt: SAVED });
    assert.ok(!('drawn' in document.placements[1].config));

    const text = environmentText(document).replace('"density": 1,', '"density": 1, "drawn": { "line": [9] },');
    const read = readEnvironmentDocument(text);
    assert.equal(read.ok, true, read.problems.join('; '));
    assert.ok(!('drawn' in read.world.placements[1].config));
});

// --- Names --------------------------------------------------------------------------

test('a world is named as it was given, held to its length, or for the environment it was built on', () => {
    assert.equal(cleanName('  Sample   Valley  '), 'Sample Valley');
    assert.equal(cleanName('x'.repeat(80)).length, ENVIRONMENT_NAME_LIMIT);
    assert.equal(cleanName(7), '');
    assert.equal(defaultEnvironmentName('river-basin'), 'River Basin');
    assert.equal(defaultEnvironmentName('blank-canvas'), 'Blank Canvas');
    assert.equal(environmentDocument(builtWorld('dune-sea'), { savedAt: SAVED }).name, 'Dune Sea');
    assert.equal(environmentDocument({ environment: 'nowhere' }, { savedAt: SAVED }).base, 'highlands', 'an unknown base written as the default');
});

test('a world\'s file is its name in lower case with hyphens', () => {
    assert.equal(ENVIRONMENT_FILE_SUFFIX, '.pilot-matter.json');
    assert.equal(environmentFileName('Sample Valley'), 'sample-valley.pilot-matter.json');
    assert.equal(environmentFileName('  Acme Corp: North / South!  '), 'acme-corp-north-south.pilot-matter.json');
    assert.equal(environmentFileName(''), 'environment.pilot-matter.json');
    assert.equal(environmentFileName('***'), 'environment.pilot-matter.json');
});

// --- Held to what the builder allows ---------------------------------------------------

test('every range a file sets is held to its bounds, and nothing it leaves out is added', () => {
    const document = environmentDocument(builtWorld(), { savedAt: SAVED });
    document.placements[0].config.height = [-50, 99999];
    document.placements[1].config.density = 7;
    document.elements[0].config.height = [-10, 50000];
    const read = readEnvironmentDocument(JSON.stringify(document));
    assert.equal(read.ok, true, read.problems.join('; '));

    const { low, high } = getElement('mountain').ranges.height;
    assert.deepEqual(read.world.placements[0].config.height, [low, high], 'a placement\'s range');
    assert.equal(read.world.placements[1].config.density, 1);
    assert.deepEqual(read.world.world[0].config.height, [low, high], 'and a row\'s');
    assert.deepEqual(Object.keys(read.world.placements[0].config), ['count', 'at', 'height'], 'no range added that the file left out');
    assert.equal(read.world.placements.find(p => p.type === ERASE_TYPE).config.restore, true, 'and what is no range kept as it was');
});

test('a row\'s shades are held to what a shade may be', () => {
    const document = environmentDocument(builtWorld(), { savedAt: SAVED });
    const water = document.elements.find(row => row.type === 'water');
    water.shades.color = { light: 50, dark: -3 };
    const read = readEnvironmentDocument(JSON.stringify(document));
    assert.equal(read.ok, true, read.problems.join('; '));
    assert.deepEqual(read.world.world.find(row => row.type === 'water').shades.color, { light: 2, dark: 0.2 });
});

// --- Refused whole ----------------------------------------------------------------------

/** A good document to break one thing in. */
function good() {
    return JSON.parse(JSON.stringify(environmentDocument(builtWorld(), { name: 'Sample Valley', savedAt: SAVED })));
}

const BROKEN = [
    ['not JSON', () => '{ "format": ', /not JSON/],
    ['a list', () => '[]', /holds no object/],
    ['a number', () => '7', /holds no object/],
    ['another format', () => ({ ...good(), format: 'something-else' }), /format is not "pilot-matter\.environment"/],
    ['no format', () => { const d = good(); delete d.format; return d; }, /format/],
    ['no version', () => { const d = good(); delete d.version; return d; }, /^version/],
    ['a version of nought', () => ({ ...good(), version: 0 }), /^version/],
    ['a fractional version', () => ({ ...good(), version: 1.5 }), /^version/],
    ['a newer version', () => ({ ...good(), version: ENVIRONMENT_VERSION + 1 }), /newer Pilot Matter/],
    ['an unknown field', () => ({ ...good(), weather: 'storm' }), /^weather: not a field/],
    ['no base', () => { const d = good(); delete d.base; return d; }, /^base/],
    ['an unknown base', () => ({ ...good(), base: 'atlantis' }), /^base: no environment the builder offers is called "atlantis"/],
    ['a name that is not text', () => ({ ...good(), name: 42 }), /^name: not text/],
    ['a name too long', () => ({ ...good(), name: 'x'.repeat(ENVIRONMENT_NAME_LIMIT + 1) }), /^name: longer than/],
    ['a time that is not text', () => ({ ...good(), savedAt: 12 }), /^savedAt/],
    ['elements that are no list', () => ({ ...good(), elements: {} }), /^elements: not a list/],
    ['an element of no kind', () => { const d = good(); d.elements[0].type = 'volcano'; return d; }, /^elements\[0\]: no element is called "volcano"/],
    ['an element with no config', () => { const d = good(); delete d.elements[1].config; return d; }, /^elements\[1\]: config is not an object/],
    ['an element with a stray field', () => { const d = good(); d.elements[0].label = 'MINE'; return d; }, /^elements\[0\]: label is not a field/],
    ['shades that are not shades', () => { const d = good(); d.elements.find(r => r.type === 'water').shades.color = 'blue'; return d; }, /shades\.color: not a light and a dark/],
    ['placements that are no list', () => ({ ...good(), placements: 'all of them' }), /^placements: not a list/],
    ['a placement of no kind', () => { const d = good(); d.placements[0].type = 'castle'; return d; }, /^placements\[0\]: nothing the builder places is called "castle"/],
    ['a placement with no type', () => { const d = good(); delete d.placements[0].type; return d; }, /^placements\[0\]: nothing the builder places/],
    ['a placement that is not one', () => { const d = good(); d.placements[0] = 'mountain'; return d; }, /^placements\[0\]: not a placement/],
    ['a config that is no object', () => { const d = good(); d.placements[0].config = [1, 2]; return d; }, /^placements\[0\]: config is not an object/],
    ['a footprint that is no region', () => { const d = good(); d.placements[1].footprint = { kind: 'blob' }; return d; }, /^placements\[1\]: footprint is not a region/],
    ['a clip that is no region', () => { const d = good(); d.placements[2].clip = { kind: 'rect' }; return d; }, /^placements\[2\]: clip is not a region/],
    ['a seed that is no number', () => { const d = good(); d.placements[0].seed = 'seven'; return d; }, /^placements\[0\]: seed is not a number/],
    ['a point that is no point', () => { const d = good(); d.placements[0].config.at = ['east', 3]; return d; }, /^placements\[0\]: at is not a point/],
    ['a group with no template', () => { const d = good(); delete d.placements[6].template; return d; }, /^placements\[6\]: template is not named/],
    ['a group inside a group', () => { const d = good(); d.placements[6].members.push(structuredClone(d.placements[6])); return d; }, /members\[\d+\]: a group may not stand inside a group/],
    ['a member of no kind', () => { const d = good(); d.placements[6].members[0].type = 'castle'; return d; }, /^placements\[6\]\.members\[0\]: nothing the builder places/]
];

test('a file that is not a whole environment is refused whole, its first problem named', () => {
    for (const [name, make, first] of BROKEN) {
        const made = make();
        const read = readEnvironmentDocument(typeof made === 'string' ? made : JSON.stringify(made));
        assert.equal(read.ok, false, `${name} should be refused`);
        assert.equal(read.world, null, `${name}: nothing read`);
        assert.match(read.problems[0] ?? '', first, `${name}: ${read.problems[0]}`);
    }
});

test('every problem with a file is listed, the first first', () => {
    const document = good();
    document.weather = 'storm';
    document.name = 42;
    document.placements[0].type = 'castle';
    const read = readEnvironmentDocument(JSON.stringify(document));
    assert.deepEqual(read.problems.map(problem => problem.split(':')[0]), ['weather', 'name', 'placements[0]']);
});

test('reading never throws, whatever it is handed', () => {
    for (const given of [undefined, null, 7, {}, [], '', 'null', '"text"', 'true', `${'['.repeat(5000)}${']'.repeat(5000)}`]) {
        const read = readEnvironmentDocument(given);
        assert.equal(read.ok, false, JSON.stringify(given)?.slice(0, 20));
        assert.ok(read.problems.length > 0);
    }
});

test('a file larger than an environment may be is refused before it is parsed', () => {
    assert.equal(ENVIRONMENT_FILE_LIMIT, 50 * 1024 * 1024);
    const huge = 'x'.repeat(ENVIRONMENT_FILE_LIMIT + 1);
    assert.match(readEnvironmentDocument(huge).problems[0], /larger than an environment file may be/);
});

// --- The schema ---------------------------------------------------------------------------

test('the schema names the same fields, the same required ones and the same limits as the module', () => {
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
    assert.deepEqual(Object.keys(schema.properties), DOCUMENT_FIELDS);
    assert.deepEqual(schema.required, DOCUMENT_REQUIRED);
    assert.equal(schema.additionalProperties, false);
    assert.equal(schema.properties.format.const, ENVIRONMENT_FORMAT);
    assert.equal(schema.properties.version.maximum, ENVIRONMENT_VERSION);
    assert.equal(schema.properties.name.maxLength, ENVIRONMENT_NAME_LIMIT);
    assert.deepEqual(schema.properties.base.enum, BUILDER_ENVIRONMENTS.map(environment => environment.id));
    assert.deepEqual(schema.$defs.elementType.enum, [...ELEMENTS_BY_ID.keys()]);
    assert.deepEqual(Object.keys(schema.$defs.row.properties), ROW_FIELDS);
    assert.deepEqual(
        [...schema.$defs.elementType.enum, ...schema.$defs.placement.properties.type.anyOf[1].enum],
        placementTypes()
    );
});

/**
 * Node has no JSON Schema validator installed, so this is one: the parts of
 * the 2020-12 vocabulary the schema uses, and nothing more. It is what lets a
 * hand-made document be read the way the schema says, rather than the way this
 * test's author thought the schema said.
 */
function valid(value, rule, root = schema) {
    if (rule === true || rule == null) return true;
    if (rule.$ref) return valid(value, rule.$ref.replace('#/', '').split('/').reduce((at, key) => at[key], root), root);
    const kind = Array.isArray(value) ? 'array' : value === null ? 'null' : Number.isInteger(value) ? 'integer' : typeof value;
    if (rule.type) {
        const types = [rule.type].flat();
        if (!types.some(type => type === kind || (type === 'number' && kind === 'integer'))) return false;
    }
    if ('const' in rule && JSON.stringify(value) !== JSON.stringify(rule.const)) return false;
    if (rule.enum && !rule.enum.some(each => JSON.stringify(each) === JSON.stringify(value))) return false;
    if (rule.minimum != null && !(value >= rule.minimum)) return false;
    if (rule.maximum != null && !(value <= rule.maximum)) return false;
    if (rule.maxLength != null && typeof value === 'string' && value.length > rule.maxLength) return false;
    if (rule.minLength != null && typeof value === 'string' && value.length < rule.minLength) return false;
    if (kind === 'array') {
        if (rule.minItems != null && value.length < rule.minItems) return false;
        if (rule.maxItems != null && value.length > rule.maxItems) return false;
        if (rule.items && !value.every(item => valid(item, rule.items, root))) return false;
    }
    if (kind === 'object') {
        for (const key of rule.required ?? []) if (!(key in value)) return false;
        for (const [key, item] of Object.entries(value)) {
            if (rule.properties && key in rule.properties) {
                if (!valid(item, rule.properties[key], root)) return false;
            } else if (rule.additionalProperties === false) {
                return false;
            } else if (typeof rule.additionalProperties === 'object' && !valid(item, rule.additionalProperties, root)) {
                return false;
            }
        }
    }
    if (rule.anyOf && !rule.anyOf.some(each => valid(value, each, root))) return false;
    if (rule.allOf && !rule.allOf.every(each => valid(value, each, root))) return false;
    if (rule.not && valid(value, rule.not, root)) return false;
    if (rule.if && valid(value, rule.if, root) && rule.then && !valid(value, rule.then, root)) return false;
    return true;
}

test('a written document is one the schema takes', () => {
    for (const base of baseIds()) {
        assert.ok(valid(environmentDocument(builtWorld(base), { name: 'Sample Valley', savedAt: SAVED }), schema), base);
    }
});

test('a hand-made document is taken or refused the way the schema says', () => {
    const made = [good(), { format: ENVIRONMENT_FORMAT, version: 1, base: 'lakeside' },
        { ...good(), $schema: './environment.schema.json' }];
    for (const [, make] of BROKEN) {
        const document = make();
        if (typeof document !== 'string') made.push(document);
    }
    // Breaks the schema has no word for - a region's arithmetic, a point's
    // numbers - are the module's alone; every other is both's.
    const moduleOnly = new Set(['a footprint that is no region', 'a clip that is no region', 'a point that is no point']);
    let compared = 0;
    for (const document of made) {
        const name = BROKEN.find(([, make]) => JSON.stringify(make()) === JSON.stringify(document))?.[0];
        if (moduleOnly.has(name)) continue;
        assert.equal(readEnvironmentDocument(JSON.stringify(document)).ok, valid(document, schema), name ?? 'a good document');
        compared++;
    }
    assert.ok(compared >= 25, `${compared} compared`);
});
