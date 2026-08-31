import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { markdownToHtml } from '../tools/build-api-reference.mjs';

const BUILDER = new URL('../tools/build-api-reference.mjs', import.meta.url).href;

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
