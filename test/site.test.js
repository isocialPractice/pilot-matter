import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, posix, relative, resolve } from 'node:path';
import { START_FIELDS } from '../js/config.js';
import { ENVIRONMENTS, MODE_ENVIRONMENTS } from '../js/environment/presets.js';
import { GAME_MODES } from '../js/game-modes.js';
import { renderApiReference, PAGE } from '../tools/build-api-reference.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SITE = join(ROOT, 'docs');

const read = (path) => readFileSync(join(ROOT, path), 'utf8');

/** Every HTML page under docs/, as a repository-relative posix path. */
function collectPages(directory = SITE) {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) return collectPages(path);
        if (!entry.name.endsWith('.html')) return [];
        return [relative(ROOT, path).split('\\').join('/')];
    });
}

const pages = collectPages().sort();
const sources = new Map(pages.map(page => [page, read(page)]));

const readme          = read('README.md');
const quickstartDoc   = read('QUICKSTART.md');
const cheatsheetDoc   = read('CHEATSHEET.md');
const designLanguage  = read('DESIGN_LANGUAGE.md');
const stylesheet      = read('docs/assets/site.css');

test('the site is the whole documentation rather than a landing page', () => {
    assert.ok(pages.length >= 20, `expected the README to split into pages, found ${pages.length}`);
    assert.ok(pages.includes('docs/index.html'), 'the site needs a home page');
    assert.ok(pages.includes('docs/quickstart.html'), 'QUICKSTART.md is a site page too');
    assert.ok(pages.includes('docs/cheatsheet.html'), 'CHEATSHEET.md is a site page too');
    assert.ok(pages.includes(PAGE.output),            'and so is the API reference');
});

// Pages serves by extension, and a type the browser will not render is a link
// that downloads a file rather than opening a page. The reference was exactly
// that for a while: docs/api.md, served as text/markdown, linked from the
// footer of every page on the site and from the home page as a card.
const RENDERED = new Set(['.html', '.css', '.js', '.png', '.svg', '.jpg', '.webp', '.ico']);

/**
 * Whether a link is one the browser opens rather than hands to the filesystem.
 *
 * A folder is opened as its own index.html, and it has no extension to read -
 * `posix.extname('controls/')` is `''`, and so is `posix.extname('controls')`.
 * Reading a target's extension and requiring it be one of `RENDERED` therefore
 * failed a link to a folder for having none, which is a link that works. So a
 * trailing slash, or no extension at all, is the directory index it names, and
 * what is left to fail is a target that names a type the browser downloads.
 */
function opensInBrowser(target) {
    const file = target.split(/[#?]/)[0];
    if (file === '' || file.endsWith('/')) return true;

    const extension = posix.extname(file).toLowerCase();
    return extension === '' || RENDERED.has(extension);
}

test('every document the site links is one the browser opens rather than downloads', () => {
    for (const [page, source] of sources) {
        for (const target of localTargets(source)) {
            assert.ok(opensInBrowser(target),
                `${page} links ${target}, which a browser downloads rather than opens`);
        }
    }
});

// No page links a folder today, so the check above passes either way and the
// first page to link one would have been the one to find out. These are the
// forms it has to read, held here rather than waiting on a page to carry them.
test('a folder is a page the browser opens, and a document is still a download', () => {
    for (const opened of [
        'controls/', 'controls', '../controls/', 'controls/#settings',
        'index.html', 'assets/site.css', 'assets/logo.png'
    ]) {
        assert.ok(opensInBrowser(opened), `${opened} is a link a browser opens`);
    }

    for (const downloaded of ['api.md', '../docs/api.md', 'notes.txt', 'world.zip', 'manual.pdf']) {
        assert.ok(!opensInBrowser(downloaded), `${downloaded} is a file a browser downloads`);
    }
});

// The reference is generated from the document rather than written beside it,
// so the deepest thing on the site cannot go stale against the deepest thing in
// the repository. Regenerating it here is what makes that true.
test('the API reference page is the API document, rendered', () => {
    assert.equal(sources.get(PAGE.output), renderApiReference(),
        `${PAGE.output} has drifted from ${PAGE.markdown} - run npm run docs:api`);
});

// A page that has lost its head is a page that renders unstyled, at the wrong
// width, under the wrong name - and every one of those is invisible until
// somebody opens that one page.
test('every page carries the head it needs to render', () => {
    for (const [page, source] of sources) {
        assert.match(source, /<!DOCTYPE html>/,                      `${page} has no doctype`);
        assert.match(source, /<html lang="en">/,                     `${page} does not declare its language`);
        assert.match(source, /<meta charset="utf-8">/,               `${page} has no charset`);
        assert.match(source, /<meta name="viewport"[^>]*width=device-width/, `${page} is not responsive`);
        assert.match(source, /<title>[^<]+<\/title>/,                `${page} has no title`);
        assert.match(source, /<meta name="description" content="[^"]+">/,    `${page} has no description`);
        assert.match(source, /<link rel="stylesheet" href="[^"]*assets\/site\.css">/, `${page} loads no stylesheet`);
        assert.match(source, /<script src="[^"]*assets\/site\.js"><\/script>/,        `${page} loads no script`);
        assert.match(source, /<link rel="icon" href="[^"]*favicon\.png">/,   `${page} has no icon`);
    }
});

test('every page opens on one heading and a way past the menu', () => {
    for (const [page, source] of sources) {
        const headings = source.match(/<h1[^>]*>/g) || [];
        assert.equal(headings.length, 1, `${page} should carry exactly one h1`);
        assert.match(source, /<a class="skip-link" href="#content">/, `${page} has no skip link`);
        assert.match(source, /<main class="page" id="content">/,     `${page} has nothing for it to skip to`);
    }
});

/**
 * The menu is written into every page rather than fetched, because a
 * documentation site that cannot be navigated without script is one that
 * cannot be navigated. The cost of that is a copy per page, so the copies
 * are checked: the relative prefix and the open group are the only two things
 * allowed to differ between them.
 */
function menuOf(source) {
    const match = source.match(/<nav class="sidebar"[\s\S]*?<\/nav>/);
    assert.ok(match, 'a page with no menu in it');
    return match[0]
        .replace(/href="\.\.\//g, 'href="')
        .replace(/<details class="nav-group" open>/g, '<details class="nav-group">');
}

test('every page carries the same menu', () => {
    const [first, ...rest] = pages;
    const expected = menuOf(sources.get(first));

    for (const page of rest) {
        assert.equal(menuOf(sources.get(page)), expected,
            `the menu in ${page} has drifted from the one in ${first}`);
    }
});

test('the menu is fixed, and its groups collapse', () => {
    const menu = menuOf(sources.get('docs/index.html'));
    assert.match(menu, /<details class="nav-group">/, 'many pages want collapsible groups');
    assert.match(stylesheet, /\.sidebar\s*\{[^}]*position:\s*fixed/, 'the menu should stay reachable while reading');
});

test('the group a page sits in is open when that page is being read', () => {
    for (const page of pages) {
        if (!page.startsWith('docs/controls/')) continue;
        assert.match(sources.get(page), /<details class="nav-group" open>/,
            `${page} sits in a group the menu leaves collapsed`);
    }
});

/**
 * A page with its sample code taken out. The reference page prints a host
 * page's own markup - `<script src="app.js">` and the like - and a sample is
 * something to read rather than something the site links, so a link check that
 * followed one would be failing on a file the site never claimed to have.
 */
const linkable = (source) => source.replace(/<pre>[\s\S]*?<\/pre>/g, '');

/** Every href and src on a page, minus the ones that leave the site. */
function localTargets(source) {
    return [...linkable(source).matchAll(/(?:href|src)="([^"]+)"/g)]
        .map(match => match[1])
        .filter(target => !/^(?:https?:|mailto:|#)/.test(target));
}

/**
 * Every id a page hands out, which is not every `id="..."` its source contains.
 *
 * The reference page prints a host page's own markup, and `escapeHtml` in the
 * builder escapes `<`, `>`, and `&` but not quotes, so an `id` inside a fenced
 * block reaches the page as the literal text ` id="app"`. Reading the raw
 * source counted that as an address: a worked example printing two of
 * `examples/host.html`'s ids, or one matching a heading's slug, would fail this
 * file over text that is not an id, on a page whose ids are all unique. So the
 * scan reads `linkable()` first, and a sample block stays something to read
 * rather than something the page does.
 *
 * Both of the checks that read an id read this one, which is why it sits above
 * the first of them. It did not before: the anchor check asked whether the
 * unstripped source `includes` the text `id="<fragment>"` while the duplicate
 * check asked here, so the file held two answers to what an id is, and a page
 * could offer an address by printing one.
 */
const idsOn = (source) => [...linkable(source).matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);

test('every link on every page reaches a file that exists', () => {
    for (const [page, source] of sources) {
        const from = dirname(join(ROOT, page));

        for (const target of localTargets(source)) {
            const path = resolve(from, target.split('#')[0]);
            assert.ok(existsSync(path),
                `${page} links ${target}, which is not there`);
        }
    }
});

/**
 * Every anchor a page links that reaches no id, as the `{ file, fragment }`
 * pairs that resolve nowhere. An empty list is a page whose links all land.
 *
 * The lift is the whole point of it. The check below did this inline, so the
 * case standing beside it could only reach the helpers underneath - `idsOn`
 * and `sameePageAnchors` - and never the resolution that read them. Naming
 * that resolution as a line of its own was not enough either: a check inlining
 * the raw `includes` again left the named line behind, unused and still read
 * by the case, which went on passing over a fix that was gone. So the whole
 * resolution lives here, the check is a call on it, and the case is the same
 * call over a page of its own - there is no line between the two left for a
 * raw read to move back into, which is what this pair came apart on three
 * releases running.
 *
 * `readPage` is how a page linked from this one is read, which the check
 * answers with the filesystem and a case answers with whatever it wants read.
 */
function unresolvedAnchors(page, source, readPage) {
    const here = join(ROOT, page);
    const from = dirname(here);
    const unresolved = [];

    for (const target of [...localTargets(source), ...sameePageAnchors(source)]) {
        const [file, fragment] = target.split('#');
        if (!fragment) continue;

        const path = file === '' ? here : resolve(from, file);
        if (!path.endsWith('.html')) continue;

        const target_source = path === here ? source : readPage(path);

        if (!idsOn(target_source).includes(fragment)) unresolved.push({ file, fragment });
    }

    return unresolved;
}

test('every anchor a page links to is an id that page has', () => {
    const readPage = (path) => readFileSync(path, 'utf8');

    for (const [page, source] of sources) {
        for (const { file, fragment } of unresolvedAnchors(page, source, readPage)) {
            assert.fail(`${page} links #${fragment} in ${file || 'itself'}, which has no such id`);
        }
    }
});

function sameePageAnchors(source) {
    return [...linkable(source).matchAll(/href="(#[^"]+)"/g)]
        .map(match => match[1])
        .filter(anchor => anchor !== '#content');
}

// The check above, run over a page that prints an id rather than hands one
// out. It used to ask the raw source whether it carried the text `id="app"`,
// which a printed `<div id="app">` answers for a page offering no such
// address, so a link to `#app` passed while scrolling nowhere. No page on the
// site prints an id today, and the first worked example to print one would
// have been what found that out.
//
// This runs `unresolvedAnchors` end to end rather than the helpers under it,
// and so does the check, so the two now share every line of the resolution: a
// raw read put back anywhere in it answers `#app` here and fails this case.
// That is the gap three releases left open. The fix could be undone with all
// 28 checks still green, because whatever the case asserted on and whatever
// the check ran were never quite the same thing.
test('an anchor into a sample block is not an address the page offers', () => {
    const page = '<h2 id="worked-example">Worked example</h2>\n'
        + '<p><a href="#app">the element it mounts on</a></p>\n'
        + '<p><a href="#worked-example">and the section carrying it</a></p>\n'
        + '<pre><code>&lt;div id="app"&gt;&lt;/div&gt;</code></pre>';

    const nothingOffPage = () => assert.fail('the sample page links nothing but itself');

    assert.deepEqual(unresolvedAnchors('docs/sample.html', page, nothingOffPage),
        [{ file: '', fragment: 'app' }],
        'an id inside a sample is text to read rather than a place to scroll to, '
        + 'while the heading beside it is an address a link reaches');

    assert.ok(page.includes('id="app"'),
        'though the source carries that text, which is what the check used to read');
});

// An id is only an address if it names one place, and the anchor check only asks
// that an anchor finds an id rather than that it finds one id. The generated
// reference is where that matters: the document heads a section `Options` under
// each half of the API, so the page carried two headings at `#options` and two
// at `#what-comes-back`, and a reader linking either reached the first one
// whichever they meant.
test('no page gives the same id to two things', () => {
    for (const [page, source] of sources) {
        const seen = new Set();

        for (const id of idsOn(source)) {
            assert.ok(!seen.has(id), `${page} carries more than one id="${id}"`);
            seen.add(id);
        }
    }
});

// No worked example prints an id today, so the check above passes either way
// and the first one to print a pair would have been the one to find out. Both
// halves are held here rather than left to whatever the site prints that day:
// what a sample says is not an address, and what the page itself says is.
test('a sample block prints markup rather than hands out ids', () => {
    const sample = '<p id="the-only-one">See:</p>\n'
        + '<pre><code>&lt;div id="app"&gt;&lt;p id="app"&gt;&lt;/p&gt;&lt;/div&gt;</code></pre>';

    assert.deepEqual(idsOn(sample), ['the-only-one'],
        'a sample block is something to read rather than markup the page carries');

    assert.deepEqual(idsOn('<h2 id="options">Options</h2>\n<h2 id="options">Options</h2>'),
        ['options', 'options'],
        'while a page that really does repeat an id still repeats it');
});

// The project site is served from /pilot-matter/ rather than from /, so an
// absolute path is a link that works locally and breaks the moment it is
// deployed. Relative is the only form that works in both places.
test('nothing on the site is linked by an absolute path', () => {
    for (const [page, source] of sources) {
        for (const target of localTargets(source)) {
            assert.ok(!target.startsWith('/'),
                `${page} links ${target} absolutely, which breaks on a project site`);
        }
    }
});

test('the site is styled by the design language rather than by taste', () => {
    const declared = new Set(
        (designLanguage.match(/#[0-9A-Fa-f]{6}/g) || []).map(hex => hex.toUpperCase())
    );

    const used = new Set();
    for (const source of [stylesheet, ...sources.values()]) {
        for (const hex of source.match(/#[0-9A-Fa-f]{6}\b/g) || []) used.add(hex.toUpperCase());
    }

    for (const hex of used) {
        assert.ok(declared.has(hex),
            `${hex} is used on the site but is not in DESIGN_LANGUAGE.md`);
    }
});

test('the design language states a contrast ratio for the pairs it assigns', () => {
    assert.match(designLanguage, /^## Contrast$/m, 'the ratios should have a section of their own');

    // Only the rows of the table, which are the pairs the site actually
    // renders. The prose around it names two pairs precisely because they
    // are the ones nothing draws, and their ratios are supposed to be low.
    const measured = designLanguage
        .split('\n')
        .filter(line => line.startsWith('|'))
        .flatMap(line => line.match(/\d+\.\d+:1/g) || []);

    assert.ok(measured.length >= 20, 'every pair the site renders should be measured');

    for (const ratio of measured) {
        assert.ok(parseFloat(ratio) >= 4.5,
            `${ratio} is below the floor for body text, so nothing should be using it`);
    }
});

test('the two colours that cannot carry text are named as colours that do not', () => {
    // Both are in the mark and both are on the site, as fills. A future
    // change that reaches for either as a text colour has this to read first.
    for (const hex of ['#87CEEB', '#90C090']) {
        assert.ok(designLanguage.includes(hex), `${hex} should be in the palette`);
    }

    assert.match(designLanguage, /1\.74:1/, 'sky on white, which is why it is never text on white');
    assert.match(designLanguage, /2\.07:1/, 'sage on white, for the same reason');
});

test('the site supports both light and dark', () => {
    assert.match(stylesheet, /\[data-theme="dark"\]/, 'a dark theme the toggle can ask for');
    assert.match(stylesheet, /prefers-color-scheme: dark/, 'and the one the reader\'s system asks for');
});

test('motion is dropped for a reader who has asked for it to be', () => {
    assert.match(stylesheet, /prefers-reduced-motion: reduce/);
});

test('QUICKSTART.md and its page say the same things', () => {
    const page = sources.get('docs/quickstart.html');

    for (const essential of ['npm run serve', 'localhost:8080', 'START FLIGHT', 'RUNWAY LANDING']) {
        assert.ok(quickstartDoc.includes(essential), `QUICKSTART.md should carry ${essential}`);
        assert.ok(page.includes(essential),          `the quickstart page should carry ${essential}`);
    }
});

test('CHEATSHEET.md and its page say the same things', () => {
    const page = sources.get('docs/cheatsheet.html');

    for (const essential of [
        'createTiledEnvironment', 'validateAircraftContract',
        'START AIRSPEED', 'CANYON COUNTRY', '40 units/s'
    ]) {
        assert.ok(cheatsheetDoc.includes(essential), `CHEATSHEET.md should carry ${essential}`);
        assert.ok(page.includes(essential),          `the cheatsheet page should carry ${essential}`);
    }
});

/**
 * Which page lists which of the things the code publishes.
 *
 * `docs/api.md` and the README are held to the source by `test/docs.test.js`,
 * so adding a start field or a world fails there until they name it. The site
 * says the same things over twenty-two pages and was held to none of it: the
 * settings page lists all eight start fields by label, the terrain page and the
 * cheatsheet list every world, and all three could go stale with nothing
 * failing. These are the pages carrying that material, so these are the pages
 * the code is read against.
 */
const CARRIES = [
    ['docs/controls/settings.html',   'start field', START_FIELDS.map(field => field.label)],
    ['docs/terrain.html',             'environment', [...ENVIRONMENTS, ...MODE_ENVIRONMENTS].map(world => world.label)],
    ['docs/cheatsheet.html',          'environment', [...ENVIRONMENTS, ...MODE_ENVIRONMENTS].map(world => world.label)],
    ['docs/controls/game-modes.html', 'game mode',   GAME_MODES.map(mode => mode.label)],
    ['docs/cheatsheet.html',          'game mode',   GAME_MODES.map(mode => mode.label)]
];

test('the pages listing what the simulator offers list what it actually offers', () => {
    for (const [page, material, labels] of CARRIES) {
        const source = sources.get(page);
        assert.ok(source, `${page} is not on the site`);
        assert.ok(labels.length > 0, `there are no ${material} labels to hold ${page} to`);

        for (const label of labels) {
            assert.ok(source.includes(label),
                `${page} does not name the ${label} ${material}, which the code publishes`);
        }
    }
});

// The README is the front door rather than the manual, and the check that
// sends the manual to a site reads exactly these two measures.
test('the README is short enough to be read rather than skimmed past', () => {
    assert.ok(readme.split('\n').length <= 300, 'the README should be under 300 lines');
    assert.ok(readme.length <= 30000,           'the README should be under 30000 characters');
});

test('the README points at the site, and at the pages it moved its sections to', () => {
    assert.ok(readme.includes('https://isocialpractice.github.io/pilot-matter/docs/index.html'),
        'the README should link the documentation site');

    for (const heading of ['Features', 'Getting Started', 'Controls', 'Simulator API', 'Testing']) {
        const linked = new RegExp(`^## \\[${heading}\\]\\(https://[^)]+\\)$`, 'm');
        assert.match(readme, linked, `the README's ${heading} heading should link its page`);
    }
});

test('the README keeps what is imperative to it', () => {
    assert.ok(readme.includes('npm run serve'), 'how to run it');
    assert.ok(readme.includes('npm test'),      'how to test it');
    assert.match(readme, /\| `W` \/ `↑` \| Pitch up/, 'and the controls');
});

test('the site is served whole, with nothing dropped for beginning with an underscore', () => {
    assert.ok(existsSync(join(ROOT, '.nojekyll')),
        'a site not built by Jekyll needs a .nojekyll at the published root');
});

test('the deploy workflow has every piece a Pages deploy needs', () => {
    const workflow = read('.github/workflows/workflow.yml');

    assert.match(workflow, /^on:$/m,                          'a trigger');
    assert.match(workflow, /branches: \[main\]/,              'limited to the default branch');
    assert.match(workflow, /workflow_dispatch:/,              'and one that can be run by hand');
    assert.match(workflow, /contents: read/,                  'permission to read the repository');
    assert.match(workflow, /pages: write/,                    'permission to publish');
    assert.match(workflow, /id-token: write/,                 'permission to prove who is publishing');
    assert.match(workflow, /^concurrency:$/m,                 'a group, so deploys cannot race');
    assert.match(workflow, /actions\/configure-pages/,        'the Pages environment');
    assert.match(workflow, /actions\/upload-pages-artifact/,  'the artifact');
    assert.match(workflow, /actions\/deploy-pages/,           'and the deploy');
    assert.match(workflow, /name: github-pages/,              'bound to the Pages environment');
});
