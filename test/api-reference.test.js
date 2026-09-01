import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { anchors, markdownToHtml, PAGE, slug } from '../tools/build-api-reference.mjs';

const BUILDER = new URL('../tools/build-api-reference.mjs', import.meta.url).href;

const document = readFileSync(new URL(`../${PAGE.markdown}`, import.meta.url), 'utf8');

/**
 * Converts in a process of its own, under a clock.
 *
 * The failure this file is here for is a loop that reads a line it never
 * consumes, and that loop is synchronous. Nothing inside this process can
 * interrupt it - not the runner's own timeout - so a regression would hang the
 * test run rather than fail it, which is the whole of the complaint: a CI job
 * with nothing to say for itself. A child process can be killed, so the
 * conversion runs in one and a run away comes back as a failed assertion.
 */
function convertApart(markdown, timeout = 20000) {
    const script = `import(${JSON.stringify(BUILDER)}).then(`
        + `({ markdownToHtml }) => process.stdout.write(markdownToHtml(${JSON.stringify(markdown)})));`;

    try {
        return execFileSync(process.execPath, ['-e', script], {
            encoding: 'utf8',
            timeout,
            maxBuffer: 4 * 1024 * 1024
        });
    } catch (error) {
        if (error.signal || error.code === 'ETIMEDOUT') {
            assert.fail(`the converter did not return within ${timeout}ms, `
                + 'which is a line it is reading rather than consuming');
        }

        return assert.fail(`the converter failed: ${error.stderr || error.message}`);
    }
}

test('a pipe line with no rule under it is the text it is, and the converter returns', () => {
    const html = convertApart('# Reference\n\n| a | b |\n\nAnd the line after it.\n');

    assert.match(html, /<p>\| a \| b \|<\/p>/, 'the line should render as what it says');
    assert.match(html, /<p>And the line after it\.<\/p>/, 'and the document should carry on past it');
});

test('a table whose rule row is mistyped renders rather than hangs', () => {
    const html = convertApart([
        '## Options',
        '',
        '| Option | What it does |',
        '| --- | ---',
        '| `seed` | Picks the world |',
        ''
    ].join('\n'));

    assert.ok(!html.includes('<table>'), 'a table without its rule is not a table');
    assert.match(html, /<p>\| Option \| What it does \|<\/p>/, 'so its rows are read as text');
    assert.match(html, /<p>\| <code>seed<\/code> \| Picks the world \|<\/p>/, 'every one of them');
});

test('a table with the rule under it is still a table', () => {
    const html = markdownToHtml([
        '## Options',
        '',
        '| Option | Default |',
        '| --- | --- |',
        '| `seed` | `1` |',
        ''
    ].join('\n'));

    assert.match(html, /<th>Option<\/th><th>Default<\/th>/, 'a head row');
    assert.match(html, /<td><code>seed<\/code><\/td><td><code>1<\/code><\/td>/, 'and a body row');
});

// `anchors()` is exported and was exercised only through whatever headings
// `docs/api.md` happens to carry, which is a document with no heading that
// collides. So the addresses it hands out are held here directly.
test('a slug is the address a heading wants, punctuation and case dropped', () => {
    assert.equal(slug('What comes back'), 'what-comes-back');
    assert.equal(slug('  Options: the full set!  '), 'options-the-full-set');
    assert.equal(slug('createPilot(options)'), 'createpilotoptions');
});

test('a heading that slugs the same as one above it takes the next free address', () => {
    const anchor = anchors();

    assert.equal(anchor('Options'), 'options', 'the first asks for it and gets it');
    assert.equal(anchor('Options'), 'options-1', 'the second takes a counted suffix');
    assert.equal(anchor('Options'), 'options-2', 'and the count carries on');
    assert.equal(anchor('What comes back'), 'what-comes-back', 'a different slug is unaffected');
});

// The suffix is itself a slug something can ask for, from either direction, and
// a count that does not look at what it has already given out answers both with
// the same address - which is the defect, returned by the fix for it.
test('a heading that slugs to a suffix already handed out does not get it twice', () => {
    const forwards = anchors();
    assert.equal(forwards('Options'), 'options');
    assert.equal(forwards('Options'), 'options-1');
    assert.equal(forwards('Options 1'), 'options-1-1', 'rather than a second #options-1');

    const backwards = anchors();
    assert.equal(backwards('Options 1'), 'options-1', 'it asked first, so it keeps it');
    assert.equal(backwards('Options'), 'options');
    assert.equal(backwards('Options'), 'options-2', 'and the repeat steps past the taken one');
    assert.equal(backwards('Options'), 'options-3', 'without offering it again either');
});

test('every heading in the document is given an address of its own', () => {
    const anchor = anchors();
    const seen = new Set();

    // Fenced blocks go first: the converter never reads a heading out of one,
    // and a sample that opens a line with `##` is not a section of the page.
    const prose = document.replace(/^```[\s\S]*?^```/gm, '');

    for (const [, text] of prose.matchAll(/^#{2,6}\s+(.*)$/gm)) {
        const given = anchor(text);
        assert.ok(!seen.has(given), `${text} was handed #${given}, which is already taken`);
        seen.add(given);
    }
});

test('the blocks the document is written in still render as themselves', () => {
    const html = markdownToHtml([
        '# Dropped',
        '',
        '## Kept',
        '',
        'A paragraph that runs',
        'across two lines.',
        '',
        '- One item',
        '- Another item',
        '',
        '```',
        'const value = 1 < 2;',
        '```'
    ].join('\n'));

    assert.ok(!html.includes('Dropped'), 'the level 1 heading becomes the page h1 instead');
    assert.match(html, /<h2 id="kept">Kept<\/h2>/);
    assert.match(html, /<p>A paragraph that runs across two lines\.<\/p>/);
    assert.match(html, /<li>One item<\/li>/);
    assert.match(html, /<li>Another item<\/li>/);
    assert.match(html, /<pre><code>const value = 1 &lt; 2;<\/code><\/pre>/);
});
