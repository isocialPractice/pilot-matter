import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const indexHtml = readFileSync(
    fileURLToPath(new URL('../index.html', import.meta.url)),
    'utf8'
);
const manifest = JSON.parse(readFileSync(
    fileURLToPath(new URL('../package.json', import.meta.url)),
    'utf8'
));

// The browser tab shows the title next to the favicon, so the two should
// name the same thing rather than a leftover working title.
test('the page title is the name of the game', () => {
    const match = indexHtml.match(/<title>([^<]*)<\/title>/);
    assert.ok(match, 'index.html should have a title');
    assert.equal(match[1].trim(), 'Pilot Matter');
});

test('the title matches the name the manifest ships under', () => {
    assert.equal(manifest.name, 'pilot-matter');
});

test('the page still points at the favicon the title sits beside', () => {
    assert.ok(/rel="icon"/.test(indexHtml), 'index.html should link a favicon');
    assert.ok(indexHtml.includes('favicon.png'), 'the favicon link should resolve to favicon.png');
});

test('the page keeps a description for link previews', () => {
    const match = indexHtml.match(/<meta name="description" content="([^"]*)"/);
    assert.ok(match, 'index.html should carry a description');
    assert.ok(match[1].startsWith('Pilot Matter'), 'the description should lead with the game name');
});
