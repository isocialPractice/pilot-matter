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

/**
 * Every export table in `docs/api.md`, as its rows. Read on its own so the
 * number of tables this pattern found can be held against the number the
 * document carries: a table it can no longer read - one reformatted, a column
 * renamed, the file saved with CRLF endings - leaves the scrape without
 * leaving a mark, and every name that table held stops being checked.
 */
function exportTables(doc) {
    return [...doc.matchAll(/^\| Export \| Is \|\n\|[-| ]+\|\n((?:\|.*\n)+)/gm)]
        .map(table => table[1].trim().split('\n'));
}

/**
 * The number of export tables the document is written with, counted off the
 * leading `Export` cell of each header row and nothing else. Deliberately the
 * loosest read in this file: it is what the strict pattern above is measured
 * against, so it has to hold where that one gives way rather than give way
 * beside it - a second column renamed or a separator row rewritten takes a
 * table out of the scrape while leaving it counted here.
 */
function exportTableCount(doc) {
    return [...doc.matchAll(/^\|[ \t]*Export[ \t]*\|/gm)].length;
}

/**
 * Every name `docs/api.md` presents as an export of the package: the leading
 * code spans of each export table's rows, and the names the worked examples
 * take off the bare specifier. A row's first cell can carry several at once
 * (`` `FLYING`, `LANDED`, `CRASHED` ``), and a function is written with the
 * arguments it takes, which are not part of the name.
 */
function documentedNames(doc) {
    const listed = exportTables(doc).flat()
        .flatMap(row => [...(row.split('|')[1] ?? '').matchAll(/`([^`]+)`/g)])
        .map(match => match[1]);

    const imported = [...doc.matchAll(/import\s*\{([^}]*)\}\s*from\s*'pilot-matter'/g)]
        .flatMap(match => match[1].split(','));

    return [...new Set([...listed, ...imported].map(name => name.trim().replace(/\(.*$/, '').trim()))]
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

// And the other way round, which is the direction a host actually reads the
// document in. A name the document presents as an export of `pilot-matter`
// that the entry point does not publish is a line a host copies onto its page
// and gets `SyntaxError: The requested module does not provide an export
// named ...` from - and everything above this passes on it, because every
// check above asks only whether the document kept up with the surface.
test('every name the document presents as an export is one the API publishes', () => {
    const documented = documentedNames(apiDoc);
    const headers = exportTableCount(apiDoc);

    // Guard the read rather than the count. The fifteen `from 'pilot-matter'`
    // import lines carry 25 names between them, so `documented` clears 20 on
    // those alone: a scrape that read no export table at all would still pass
    // the line below, and every name the tables hold would then be checked
    // against nothing. Held against the header rows - the loosest thing a
    // table can be recognized by - a table that has gone out of the pattern's
    // reach fails here rather than leaving quietly.
    assert.ok(headers > 0, 'the document should present its exports in tables');
    assert.equal(exportTables(apiDoc).length, headers,
        'docs/api.md carries an export table this file can no longer read');

    assert.ok(documented.length > 20, 'the document should present the whole of both halves');
    assert.ok(documented.includes('createPilot'));

    for (const name of documented) {
        assert.ok(published.includes(name),
            `docs/api.md presents ${name} as an export, which js/api/index.js does not publish`);
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
