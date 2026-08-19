import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
    DEFAULT_PORT,
    DEFAULT_DOCUMENT,
    FALLBACK_CONTENT_TYPE,
    contentTypeFor,
    resolveRequestPath
} from '../tools/serve.mjs';

const manifest = JSON.parse(readFileSync(
    fileURLToPath(new URL('../package.json', import.meta.url)),
    'utf8'
));

test('the manifest exposes the serve script', () => {
    assert.equal(manifest.scripts.serve, 'node tools/serve.mjs');
});

test('a bare request serves the default document', () => {
    assert.equal(resolveRequestPath('/'), DEFAULT_DOCUMENT);
    assert.equal(resolveRequestPath('/?cache=0'), DEFAULT_DOCUMENT);
    assert.equal(resolveRequestPath('/#hud'), DEFAULT_DOCUMENT);
});

test('module and asset paths resolve relative to the project root', () => {
    assert.equal(resolveRequestPath('/js/main.js'), 'js/main.js');
    assert.equal(resolveRequestPath('/favicon.png'), 'favicon.png');
    assert.equal(resolveRequestPath('/js/main.js?v=2'), 'js/main.js');
});

test('a trailing slash asks for that folder default document', () => {
    assert.equal(resolveRequestPath('/js/'), `js/${DEFAULT_DOCUMENT}`);
});

test('redundant and empty path segments collapse', () => {
    assert.equal(resolveRequestPath('/./js//main.js'), 'js/main.js');
});

test('percent-encoded paths are decoded', () => {
    assert.equal(resolveRequestPath('/js/main%2Ejs'), 'js/main.js');
    assert.equal(resolveRequestPath('/my%20file.png'), 'my file.png');
});

test('a path that climbs out of the project root is refused', () => {
    assert.equal(resolveRequestPath('/../secrets.env'), null);
    assert.equal(resolveRequestPath('/js/../../secrets.env'), null);
    assert.equal(resolveRequestPath('/%2e%2e/secrets.env'), null);
    assert.equal(resolveRequestPath('/..%2fsecrets.env'), null);
});

test('a Windows separator or a null byte is refused rather than served', () => {
    assert.equal(resolveRequestPath('/..\\secrets.env'), null);
    assert.equal(resolveRequestPath('/js\\main.js'), null);
    assert.equal(resolveRequestPath('/index.html%00.png'), null);
});

test('a malformed or non-absolute request is refused', () => {
    assert.equal(resolveRequestPath('/%E0%A4%A'), null);
    assert.equal(resolveRequestPath('js/main.js'), null);
    assert.equal(resolveRequestPath(''), null);
    assert.equal(resolveRequestPath(undefined), null);
});

test('the simulator files are served as the types a browser needs', () => {
    assert.equal(contentTypeFor('index.html'), 'text/html; charset=utf-8');
    assert.equal(contentTypeFor('js/main.js'), 'text/javascript; charset=utf-8');
    assert.equal(contentTypeFor('tools/serve.mjs'), 'text/javascript; charset=utf-8');
    assert.equal(contentTypeFor('favicon.png'), 'image/png');
    assert.equal(contentTypeFor('package.json'), 'application/json; charset=utf-8');
});

test('content types are matched case insensitively', () => {
    assert.equal(contentTypeFor('BANNER.PNG'), 'image/png');
    assert.equal(contentTypeFor('Index.HTML'), 'text/html; charset=utf-8');
});

test('an unknown or missing extension falls back to a binary type', () => {
    assert.equal(contentTypeFor('LICENSE'), FALLBACK_CONTENT_TYPE);
    assert.equal(contentTypeFor('archive.tar.zzz'), FALLBACK_CONTENT_TYPE);
    assert.equal(contentTypeFor(''), FALLBACK_CONTENT_TYPE);
});

test('the default port matches the one the README tells you to open', () => {
    const readme = readFileSync(
        fileURLToPath(new URL('../README.md', import.meta.url)),
        'utf8'
    );
    assert.equal(DEFAULT_PORT, 8080);
    assert.ok(readme.includes(`http://localhost:${DEFAULT_PORT}`),
        'the README should point at the port the serve script uses');
});
