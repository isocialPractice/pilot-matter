import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (path) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8');

const page     = read('examples/host.html');
const host     = read('examples/host.js');
const manifest = JSON.parse(read('package.json'));
const apiDoc   = read('docs/api.md');
const readme   = read('README.md');
const apiIndex = read('js/api/index.js');

const importMap = JSON.parse(page.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;

// The page is what a host page installing the package would write, so the
// specifier it imports by has to be one the manifest publishes rather than a
// path into the source that only works from inside this repository.
test('the example imports by the specifier the manifest publishes', () => {
    assert.ok(importMap[manifest.name], `the page should map "${manifest.name}"`);
    assert.equal(
        importMap[manifest.name].replace('../', './'),
        manifest.exports['.'],
        'and map it to the entry point the manifest publishes'
    );
});

test('every bare import the example makes is one the page maps to a module', () => {
    const mapped = Object.keys(importMap);

    for (const match of host.matchAll(/from\s+'([^'.][^']*)'/g)) {
        assert.ok(mapped.some(prefix => match[1] === prefix || match[1].startsWith(prefix)),
            `examples/host.js imports "${match[1]}", which the import map does not resolve`);
    }
});

// The browser resolves every import itself, so a name the example asks the API
// for and the API does not publish is a blank page rather than a failing test.
test('every name the example imports is one the API publishes', () => {
    const published = [...apiIndex.matchAll(/export\s*\{([^}]*)\}\s*from/g)]
        .flatMap(match => match[1].split(','))
        .map(name => name.trim().split(/\s+as\s+/).pop().trim())
        .filter(Boolean);

    const asked = [...host.matchAll(/import\s*\{([^}]*)\}\s*from\s*'pilot-matter'/g)]
        .flatMap(match => match[1].split(','))
        .map(name => name.trim())
        .filter(Boolean);

    assert.ok(asked.length > 0, 'the example should import something from the API');
    for (const name of asked) {
        assert.ok(published.includes(name), `examples/host.js imports ${name}, which the API does not publish`);
    }
});

test('every module the page and the example point at is a module that is there', () => {
    const root = fileURLToPath(new URL('../examples/', import.meta.url));
    const paths = [
        ...[...page.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1]),
        ...Object.values(importMap)
    ].filter(path => path.startsWith('.'));

    assert.ok(paths.length > 0, 'the page should point at something');
    for (const path of paths) {
        assert.ok(existsSync(fileURLToPath(new URL(path, `file:///${root.replace(/\\/g, '/')}`))),
            `examples/host.html points at ${path}, which does not exist`);
    }
});

test('every element the example writes to exists on the page it is drawn on', () => {
    const ids = [...host.matchAll(/getElementById\('([^']+)'\)/g)].map(match => match[1]);

    assert.ok(ids.length > 0, 'the example should look its elements up by id');
    for (const id of ids) {
        assert.ok(page.includes(`id="${id}"`), `examples/host.html is missing id="${id}"`);
    }
});

// The whole point of the example is that each half works without the other, so
// a page that only proved one direction would prove nothing.
test('the example flies the Pilot API over an environment of the host\'s own', () => {
    assert.match(host, /createPilot\(/, 'the example should build a pilot');
    assert.match(host, /terrain:\s*hostTerrain/, 'and fly it over the host\'s own ground');
    assert.match(host, /sampleHeight:\s*hostHeight/, 'supplied as the terrain contract');
    assert.match(host, /bounds:\s*boundsFromSize/, 'with the bounds that say where it stops');
    assert.doesNotMatch(host, /createEnvironment\(/,
        'the pilot half should not be quietly leaning on a bundled world');
});

test('the example flies an aircraft of the host\'s own over the Matter API', () => {
    assert.match(host, /createTiledEnvironment\(/, 'the example should build a world');
    assert.match(host, /buildHostAircraft\(/, 'and an aircraft of its own to fly over it');
    assert.match(host, /world\.attach\(/, 'adopted through the aircraft contract');
    assert.match(host, /isAircraftContractSatisfied\(/, 'which the host can check before it does');
    assert.match(host, /flown\.groundHeight\(\)/, 'and flown against the ground the world reports');
});

test('the example shows the world doing what a world does', () => {
    assert.match(host, /world\.setDaylight\(/, 'the day should move');
    assert.match(host, /world\.updateWater\(/, 'and the water with it');
    assert.match(host, /world\.register\(/, 'and something of the host\'s should be set down on the ground');
    assert.match(host, /tiles:\s*2/, 'and the world should be an assembly rather than one square');
});

test('the example is one a reader can be sent to', () => {
    assert.ok(apiDoc.includes('examples/host.html'), 'the API document should point at the example');
    assert.ok(readme.includes('examples/host.html'), 'and so should the README');
});
