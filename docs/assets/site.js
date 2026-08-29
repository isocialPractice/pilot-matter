/*
 * Pilot Matter documentation site.
 *
 * Everything the site needs and nothing it does not: the stored theme, the
 * drawer the menu opens into on a narrow screen, the entry the menu marks as
 * the page being read, and an anchor on every heading. The pages are readable
 * with none of it running - the menu is markup, the theme falls back to the
 * one the reader's system asks for, and the headings keep their ids.
 */

(function () {
    'use strict';

    var STORAGE_KEY = 'pilot-matter-docs-theme';
    var root = document.documentElement;

    /*
     * Marked before the body is parsed, so the stylesheet knows whether the
     * menu can be a drawer. Without this class the menu stands in the page
     * and is reached by scrolling, which is the only way it is reachable at
     * all when the script has not run.
     */
    root.classList.add('js');

    /*
     * The theme is applied before the body is parsed, so a reader who chose
     * dark never sees a light frame flash past on the way to it.
     */
    function storedTheme() {
        try {
            var stored = window.localStorage.getItem(STORAGE_KEY);
            return stored === 'light' || stored === 'dark' ? stored : null;
        } catch (error) {
            // A browser refusing storage costs the choice its memory and
            // nothing else: the system preference still decides.
            return null;
        }
    }

    function storeTheme(theme) {
        try {
            window.localStorage.setItem(STORAGE_KEY, theme);
        } catch (error) {
            /* nothing to do, and nothing lost but the memory of it */
        }
    }

    function systemPrefersDark() {
        return typeof window.matchMedia === 'function'
            && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    function activeTheme() {
        return root.getAttribute('data-theme')
            || (systemPrefersDark() ? 'dark' : 'light');
    }

    var initial = storedTheme();
    if (initial) root.setAttribute('data-theme', initial);

    function ready(run) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', run);
        } else {
            run();
        }
    }

    ready(function () {
        setUpTheme();
        setUpDrawer();
        markCurrentPage();
        addHeadingAnchors();
    });

    /* ---- The theme toggle ---- */

    function setUpTheme() {
        var button = document.querySelector('[data-theme-toggle]');
        if (!button) return;

        function label() {
            var next = activeTheme() === 'dark' ? 'light' : 'dark';
            button.setAttribute('aria-label', 'Switch to the ' + next + ' theme');
            button.textContent = activeTheme() === 'dark' ? 'Light' : 'Dark';
        }

        label();

        button.addEventListener('click', function () {
            var next = activeTheme() === 'dark' ? 'light' : 'dark';
            root.setAttribute('data-theme', next);
            storeTheme(next);
            label();
        });
    }

    /* ---- The drawer the menu opens into below 960px ---- */

    function setUpDrawer() {
        var toggle  = document.querySelector('[data-menu-toggle]');
        var sidebar = document.querySelector('.sidebar');
        var scrim   = document.querySelector('.scrim');
        if (!toggle || !sidebar) return;

        function setOpen(open) {
            sidebar.setAttribute('data-open', open ? 'true' : 'false');
            if (scrim) scrim.setAttribute('data-open', open ? 'true' : 'false');
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        }

        setOpen(false);

        toggle.addEventListener('click', function () {
            setOpen(sidebar.getAttribute('data-open') !== 'true');
        });

        if (scrim) scrim.addEventListener('click', function () { setOpen(false); });

        // Following a link inside the drawer is the reader leaving it, and a
        // drawer still open over the page they asked for is one they have to
        // close before they can read it.
        sidebar.addEventListener('click', function (event) {
            if (event.target.closest('a')) setOpen(false);
        });

        document.addEventListener('keydown', function (event) {
            if (event.key !== 'Escape') return;
            if (sidebar.getAttribute('data-open') !== 'true') return;
            setOpen(false);
            toggle.focus();
        });
    }

    /* ---- The entry for the page being read ---- */

    function markCurrentPage() {
        var here = normalise(window.location.pathname);

        var links = document.querySelectorAll('.sidebar a[href]');
        for (var i = 0; i < links.length; i += 1) {
            var link = links[i];
            if (normalise(new URL(link.getAttribute('href'), window.location.href).pathname) !== here) {
                continue;
            }

            link.setAttribute('aria-current', 'page');

            // A page inside a collapsed group is a page the menu is not
            // showing the reader they are on, so the group it sits in opens.
            var group = link.closest('details.nav-group');
            while (group) {
                group.open = true;
                group = group.parentElement && group.parentElement.closest('details.nav-group');
            }
        }
    }

    function normalise(pathname) {
        var path = decodeURIComponent(pathname || '');
        return path.replace(/index\.html$/, '').replace(/\/$/, '');
    }

    /* ---- An anchor on every heading that has an id ---- */

    function addHeadingAnchors() {
        var headings = document.querySelectorAll('.content h2[id], .content h3[id], .content h4[id]');
        for (var i = 0; i < headings.length; i += 1) {
            var heading = headings[i];
            var anchor = document.createElement('a');
            anchor.className = 'heading-anchor';
            anchor.href = '#' + heading.id;
            anchor.setAttribute('aria-label', 'Link to this section');
            anchor.textContent = '#';
            heading.appendChild(document.createTextNode(' '));
            heading.appendChild(anchor);
        }
    }
}());
