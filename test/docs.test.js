import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { API_VERSION, TELEMETRY_FIELDS } from '../js/api/contract.js';
import { START_FIELD_IDS } from '../js/config.js';
import { environmentIds } from '../js/environment/presets.js';

const read = (path) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8');

const apiDoc   = read('docs/api.md');
const readme   = read('README.md');
const manifest = JSON.parse(read('package.json'));
const apiIndex = read('js/api/index.js');

/**
 * Every name `js/api/index.js` publishes. The entry point is written entirely
 * as re-exports, so the names can be read off the source without loading the
 * renderer half of it.
 */
function publishedNames(source) {
    return [...source.matchAll(/export\s*\{([^}]*)\}\s*from/g)]
        .flatMap(match => match[1].split(','))
        .map(name => name.trim().split(/\s+as\s+/).pop().trim())
        .filter(Boolean);
}

const published = publishedNames(apiIndex);

test('the entry point publishes something to document', () => {
    assert.ok(published.length > 20, 'the API surface should be the whole of both halves');
    assert.ok(published.includes('createPilot'));
    assert.ok(published.includes('createEnvironment'));
});

// A surface that is documented everywhere except in the one place it was added
// is a surface a host finds by reading the source, which is what the document
// exists to save them.
test('every name the API publishes is named in the document', () => {
    for (const name of published) {
        assert.ok(apiDoc.includes(name), `docs/api.md does not mention ${name}`);
    }
});

test('the document names the version of the contracts it describes', () => {
    assert.ok(apiDoc.includes('API_VERSION'), 'the document should say how a host checks the version');
    assert.ok(apiDoc.includes(`!== ${API_VERSION}`), 'and check against the version it was written for');
});

test('the document carries the stability guarantee, and both sides of it', () => {
    assert.match(apiDoc, /^## Stability$/m, 'the guarantee should have a section of its own');
    assert.ok(apiDoc.includes('guaranteed to hold'), 'saying what holds');
    assert.ok(apiDoc.includes('not guaranteed'), 'and what does not');
});

test('the document works an example of each half', () => {
    assert.match(apiDoc, /^### Worked example: the Pilot API/m);
    assert.match(apiDoc, /^### Worked example: the Matter API/m);

    const examples = [...apiDoc.matchAll(/```javascript\n([\s\S]*?)```/g)].map(match => match[1]);
    assert.ok(examples.some(code => code.includes('createPilot(') && code.includes('.update(')),
        'the Pilot example should build a pilot and fly it');
    assert.ok(examples.some(code => code.includes('createEnvironment(') && code.includes('.attach(')),
        'the Matter example should build a world and fly something over it');
});

test('every field of the telemetry is written down', () => {
    for (const field of TELEMETRY_FIELDS) {
        assert.ok(apiDoc.includes(`\`${field}\``), `docs/api.md does not document telemetry.${field}`);
    }
});

test('every field of the start state is written down', () => {
    for (const id of START_FIELD_IDS) {
        assert.ok(apiDoc.includes(id), `docs/api.md does not document the ${id} start field`);
    }
});

test('every world a host can ask for by name is named in the document', () => {
    for (const id of environmentIds()) {
        assert.ok(apiDoc.includes(`'${id}'`), `docs/api.md does not name the ${id} environment`);
    }
});

// The document tells a host to import by these specifiers, so a specifier it
// names and the manifest does not is an import that fails on the host's page.
test('every specifier the document tells a host to import is one the manifest publishes', () => {
    const specifiers = [...apiDoc.matchAll(/from '(pilot-matter[^']*)'/g)].map(match => match[1]);
    assert.ok(specifiers.length > 0, 'the document should say what to import');

    for (const specifier of new Set(specifiers)) {
        const subpath = specifier === manifest.name ? '.' : `.${specifier.slice(manifest.name.length)}`;
        assert.ok(manifest.exports[subpath],
            `docs/api.md imports from "${specifier}", which package.json does not publish`);
    }
});

test('the readme points at the document rather than repeating it', () => {
    assert.ok(readme.includes('docs/api.md'), 'the README should link the API document');
});
