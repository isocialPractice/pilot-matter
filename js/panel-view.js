/**
 * The panel view - the one renderer the dock is drawn with.
 *
 * It takes what `js/build-panel.js` says the dock shows - a heading, the rows
 * the properties panel generated, the rows that slide the view, and the
 * answers that settle an edit - and draws them into the dock, reporting a
 * press, a typed value or an answer back to whoever asked. It knows nothing
 * about terrain or cameras: it draws rows and says what was done to them.
 *
 * The rows are built when what the dock shows changes shape - another tool,
 * another element, an edit begun or settled - and only their readings are
 * written on every other frame. A reading the pilot is typing into is left
 * alone while they type, so the camera moving under a field being edited does
 * not take the edit out from under them.
 *
 * The heading and the answers sit outside the part that scrolls, so a long
 * panel scrolls its fields and the accept and cancel are never below the fold.
 *
 * Beneath its first part the dock may hold sections, each under a heading of
 * its own - Select's panel is the camera and then what is being looked at. A
 * section that folds has a heading that is a button, opening and shutting it.
 * A section may end in a status line saying what its last answer came to, and
 * a line whose words have just changed is scrolled into view, since the
 * fields it sits in are short enough on a phone to hide it entirely.
 *
 * A colour row is drawn as a colour is chosen rather than stepped: its
 * swatches, the picker's strip in its four bands, the eye dropper and a hex
 * field. A row whose range asks for a slider has one beside its figure.
 */

import {
    isTypedRow, rangePlaces, readsAsPercent, cycleStep, COLOR_SWATCHES, PICKER_STOPS, PICKER_SHADES,
    pickerColor, hexColor, parseHex, sameColor, rangeNotice
} from './properties-panel.js';
import { OPTION_LEFT_MARK, OPTION_RIGHT_MARK } from './settings.js';

/**
 * The keys a field holding a figure steps its row by, in place of the browser's
 * own: the arrows a press, the page keys a coarse one.
 */
export const FIELD_STEP_KEYS = Object.freeze({
    ArrowUp:   Object.freeze({ step: 1,  coarse: false }),
    ArrowDown: Object.freeze({ step: -1, coarse: false }),
    PageUp:    Object.freeze({ step: 1,  coarse: true }),
    PageDown:  Object.freeze({ step: -1, coarse: true })
});

/** Every section's status line, in the order they are drawn: `{ id, text, refused }`. */
export function statusLines(content) {
    return (content?.sections ?? [])
        .filter(section => 'status' in section)
        .map(section => ({
            id: section.id,
            text: section.status?.text ?? '',
            refused: section.status?.refused === true
        }));
}

/**
 * The status line a draw should bring into view, or null for none: one whose
 * words have just changed into something to read, a refused one first.
 *
 * `said` is what each section's line last said. Three cases are deliberately
 * not news, because scrolling for one would take a view the pilot set by hand:
 *
 * - **A line that has not changed.** The dock redraws every frame.
 * - **A line gone empty.** There is nothing there to read.
 * - **A section's first line.** A panel opening on the line it always opens on
 *   is its resting state, not an answer - SAVE / LOAD's ASSETS section always
 *   says something, so a first draw would scroll straight past the NAME row
 *   above it on a phone. First is first on the screen, which `statusSaid`
 *   below is what decides.
 */
export function statusToShow(content, said) {
    const news = statusLines(content).filter(line =>
        line.text !== '' && said.has(line.id) && said.get(line.id) !== line.text);
    return news.find(line => line.refused) ?? news[0] ?? null;
}

/**
 * What each status line says now, for the next draw to tell news from a
 * redraw: the lines this draw carries, and only those.
 *
 * A section the draw does not carry is forgotten, so the section is on its
 * first line again when it comes back. That is what makes the third case
 * above hold, since a line can change while its section is off the screen:
 * LOAD ASSET takes the dock to the step and brings it back to a SAVE / LOAD
 * whose ASSETS line has changed from `no assets loaded` to `choose an asset`,
 * which is the panel's resting state for a library of one and not an answer
 * to scroll to. Only the panel's own redraws are a line's own again, which is
 * every draw a section stays on the screen for, a rebuild included - the
 * elements are made again, the words are not news again.
 */
export function statusSaid(content) {
    return new Map(statusLines(content).map(line => [line.id, line.text]));
}

/**
 * The key a row is found by: its range's name and which part of the range it
 * is, and for a row in a section the section it is in - two sections can hold
 * an element of the same kind, and each `HEIGHT MIN` has to be its own.
 */
export function rowKey(entry) {
    const key = `${entry.name}:${entry.row.part}`;
    return entry.section ? `${entry.section}/${key}` : key;
}

/** Every row the dock shows, its first part's and then each section's, in the order they are drawn. */
export function dockRows(content) {
    return [...(content?.rows ?? []), ...(content?.sections ?? []).flatMap(section => section.rows ?? [])];
}

/** The figure a typed field shows for a row, in the units the row reads in. */
export function fieldFigure(row, value) {
    if (readsAsPercent(row)) return Math.round(value * 100);
    return Number(Number(value).toFixed(rangePlaces(row.range)));
}

/** The CSS a picker band is painted with: the strip's stops at `shade` of their strength, the rest white. */
export function pickerBandStyle(shade) {
    const stops = PICKER_STOPS.map((_, i) => {
        const rgb = pickerColor(i / (PICKER_STOPS.length - 1), shade).map(channel => Math.round(channel * 255));
        return `rgb(${rgb.join(', ')}) ${((i / (PICKER_STOPS.length - 1)) * 100).toFixed(2)}%`;
    });
    return `linear-gradient(to right, ${stops.join(', ')})`;
}

/** True for a row drawn as a typed field rather than a reading between two marks. */
function typed(row) {
    return isTypedRow(row) && !row.gate;
}

/** What the dock shows, as a string that changes only when its rows do. */
function shapeOf(content) {
    return [
        content.kind, content.heading,
        ...(content.shapes ?? []).flatMap(row => row.tools.map(tool => `shape:${tool.id}`)),
        ...content.rows.map(rowKey),
        ...(content.nudges ?? []).map(nudge => `nudge:${nudge.id}`),
        ...(content.sections ?? []).flatMap(section => [
            `section:${section.id}:${section.heading}:${section.open ? 'open' : 'shut'}`,
            ...(section.text ? [`text:${section.id}/${section.text.id}`] : []),
            ...('status' in section ? [`status:${section.id}`] : []),
            ...(section.shapes ?? []).flatMap(row => row.tools.map(tool => `shape:${tool.id}`)),
            ...(section.rows ?? []).map(rowKey)
        ]),
        ...(content.actions ?? []).map(action => `action:${action.id}`)
    ].join('|');
}

export class PanelView {
    /**
     * `root` holds three parts, found by `data-dock`: the heading, the fields
     * that scroll, and the answers. `handlers` are told what was done:
     * `onStep(entry, step, coarse)`, `onType(entry, figure, field)`,
     * `onNudge(id, sign)`, `onAction(id)`, `onFold(id)` for a section's
     * heading pressed, `onShape(id)` for one of a mode's own tools,
     * `onColor(entry, rgb)` for a colour chosen at a colour row,
     * `onDropper(entry)` for its eye dropper pressed, and
     * `onText(id, text, section)` for a section's line of text let go of.
     */
    constructor(root, handlers = {}) {
        this.root     = root;
        this.heading  = root.querySelector('[data-dock="heading"]');
        this.fields   = root.querySelector('[data-dock="fields"]');
        this.answers  = root.querySelector('[data-dock="actions"]');
        this.handlers = handlers;
        this.shape    = null;
        this.content  = null;
        this.drawn    = new Map();
        // What each status line on the screen last said, by `statusSaid` -
        // kept across a rebuild of the same panel, dropped with the section.
        this.said     = new Map();

        root.addEventListener('click', (event) => this.onClick(event));
        root.addEventListener('change', (event) => this.onChange(event));
        root.addEventListener('input', (event) => this.onSlide(event));
        root.addEventListener('wheel', (event) => this.onWheel(event), { passive: true });
    }

    /**
     * A key in a field holding a figure: the up and down arrows step the row a
     * press, a coarse one with `shift`, and Page Up and Page Down a coarse one
     * always - the convention for a spin button - in place of the browser's own
     * step by 1. The field has the focus, which `update` leaves alone, so the
     * figure the step came to is written into it here.
     *
     * Called by the page, whose listener takes every key on its way down and
     * keeps a key typed into a field from the flight and the builder - so the
     * key never reaches a listener of the dock's own.
     */
    onKey(event) {
        const field = event.target;
        if (!(field instanceof HTMLInputElement) || field.type !== 'number' || this.content == null) return;

        const press = FIELD_STEP_KEYS[event.key];
        if (!press) return;
        event.preventDefault();

        const key = field.closest('.dock-row')?.dataset.row;
        const entry = this.entryFor(key);
        if (!entry?.live) return;

        this.handlers.onStep?.(entry, press.step, press.coarse || event.shiftKey === true);
        const stepped = this.entryFor(key);
        if (stepped) {
            field.value = String(fieldFigure(stepped.row, stepped.value));
            field.setCustomValidity('');
        }
    }

    /**
     * The wheel over a field with the focus scrolls the dock rather than the
     * figure: the field lets go of the focus before the wheel reaches it, which
     * is what a browser moves a focused figure by.
     */
    onWheel(event) {
        const field = event.target;
        if (field instanceof HTMLInputElement && field.type === 'number' && document.activeElement === field) field.blur();
    }

    /** Draws what the dock shows, or takes it off the screen for nothing. */
    render(content) {
        if (content == null) {
            this.root.style.display = 'none';
            this.shape = null;
            this.content = null;
            // Nothing is on the screen to have said anything, so the panel
            // that comes back is on its first line again.
            this.said = new Map();
            return;
        }

        this.root.style.display = 'flex';
        this.content = content;

        const shape = shapeOf(content);
        if (shape !== this.shape) this.build(content);
        this.shape = shape;
        this.update(content);
    }

    build(content) {
        this.heading.textContent = content.heading;
        this.fields.replaceChildren();
        this.answers.replaceChildren();
        this.drawn.clear();

        // A mode with tools of its own - the lasso, or Insert Runway's
        // templates - draws them first, a row of tiles to each row the artwork
        // groups them into.
        this.drawShapes(content.shapes);

        for (const entry of content.rows) this.drawRow(entry);

        for (const nudge of content.nudges ?? []) {
            const line = document.createElement('div');
            line.className = 'dock-row dock-nudge';
            line.dataset.nudge = nudge.id;

            const name = document.createElement('span');
            name.className = 'dock-label';
            name.textContent = nudge.label;

            line.append(name, stepButton(-1, `${nudge.label} back`), spacer(), stepButton(1, `${nudge.label} on`));
            this.fields.append(line);
        }

        for (const section of content.sections ?? []) {
            const heading = document.createElement(section.folds ? 'button' : 'h4');
            heading.className = 'dock-section';
            heading.dataset.section = section.id;
            heading.textContent = section.heading;
            if (section.folds) {
                heading.type = 'button';
                heading.setAttribute('aria-expanded', String(Boolean(section.open)));
            }
            this.fields.append(heading);
            this.drawShapes(section.shapes);
            for (const entry of section.rows ?? []) this.drawRow(entry);
            if (section.text) this.drawText(section);
            if ('status' in section) this.drawStatus(section);
        }

        for (const action of content.actions ?? []) {
            const answer = document.createElement('button');
            answer.type = 'button';
            answer.className = 'dock-action';
            answer.dataset.action = action.id;
            this.answers.append(answer);
        }
        this.answers.style.display = (content.actions ?? []).length ? 'flex' : 'none';
    }

    /**
     * A section's one line of text to type - the name SAVE / LOAD writes a
     * world under - as a label and a field, the field showing what it will
     * be written under until something is typed.
     */
    drawText(section) {
        const text = section.text;
        const line = document.createElement('label');
        line.className = 'dock-row dock-text-row';

        const name = document.createElement('span');
        name.className = 'dock-label';
        name.textContent = text.label;

        const field = document.createElement('input');
        field.type = 'text';
        field.className = 'dock-value dock-text';
        field.dataset.text = text.id;
        field.dataset.section = section.id;
        field.maxLength = text.max ?? 60;
        field.placeholder = text.placeholder ?? '';
        field.spellcheck = false;
        field.autocomplete = 'off';

        line.append(name, field);
        this.fields.append(line);
        this.drawn.set(`text:${section.id}/${text.id}`, { field });
    }

    /**
     * A section's line saying what its last answer came to - a file saved, a
     * world loaded, or why one was refused - read out as it changes, and held
     * until the next, so it is not a notice that is gone before it is read.
     */
    drawStatus(section) {
        const status = document.createElement('p');
        status.className = 'dock-status';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        this.fields.append(status);
        this.drawn.set(`status:${section.id}`, { status });
    }

    /**
     * Scrolls a section's status line into the fields' window, so a line that
     * has just changed is read rather than drawn below the fold.
     *
     * The fields are what scrolls, and the dock leaves them where the pilot
     * left them when it redraws - which on a short phone is the top, with 62
     * of 210 px in view: room for the ENVIRONMENT heading and the NAME row,
     * and none for the line under them saying why a file was refused. The
     * dock then looked exactly as it had before, which is the one thing a
     * refusal must not do.
     *
     * Its first line is put at the top of the window rather than merely
     * brought to the nearest edge, because a refusal is four lines of which
     * one fits: scrolled to its foot it reads as the end of a sentence whose
     * start is missing.
     */
    showStatus(id) {
        const line = this.drawn.get(`status:${id}`)?.status;
        if (!line || !this.fields) return;
        const box = line.getBoundingClientRect();
        const view = this.fields.getBoundingClientRect();
        if (box.height === 0) return;
        if (box.top >= view.top - 1 && box.bottom <= view.bottom + 1) return;
        this.fields.scrollTop += box.top - view.top;
    }

    /** Draws rows of tiles, one to each row the artwork groups them into. A tile with no art to it is a card: its name alone. */
    drawShapes(rows) {
        for (const row of rows ?? []) {
            const line = document.createElement('div');
            line.className = 'dock-shapes';
            line.dataset.shapeRow = row.row;
            for (const tool of row.tools) {
                const tile = document.createElement('button');
                tile.type = 'button';
                tile.className = 'dock-shape';
                tile.dataset.shape = tool.id;
                tile.title = tool.name;
                tile.setAttribute('aria-label', tool.name);
                if (tool.art) {
                    const mark = document.createElement('img');
                    mark.src = tool.art;
                    mark.alt = '';
                    mark.draggable = false;
                    tile.append(mark);
                } else {
                    tile.classList.add('dock-card');
                }
                const name = document.createElement('span');
                name.textContent = tool.label;
                tile.append(name);
                line.append(tile);
            }
            this.fields.append(line);
        }
    }

    /**
     * Draws a colour row: the swatches, two rows of four; the picker, a band
     * for each shade of its strip; and beneath them the eye dropper and the
     * hex field the colour is read out in and can be typed into.
     */
    drawColorRow(entry) {
        const key  = rowKey(entry);
        const line = document.createElement('div');
        line.className = 'dock-color';
        line.dataset.row = key;

        const swatches = document.createElement('div');
        swatches.className = 'dock-swatches';
        for (const swatch of COLOR_SWATCHES) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'dock-swatch';
            button.dataset.swatch = swatch.id;
            button.style.background = hexColor(swatch.rgb);
            button.title = swatch.label;
            button.setAttribute('aria-label', `${entry.row.label} ${swatch.label}`);
            swatches.append(button);
        }

        const picker = document.createElement('div');
        picker.className = 'dock-picker';
        picker.setAttribute('role', 'presentation');
        for (const shade of PICKER_SHADES) {
            const band = document.createElement('button');
            band.type = 'button';
            band.className = 'dock-picker-band';
            band.dataset.shade = String(shade);
            band.style.background = pickerBandStyle(shade);
            band.setAttribute('aria-label', `${entry.row.label} at ${Math.round(shade * 100)} percent`);
            picker.append(band);
        }

        const tools = document.createElement('div');
        tools.className = 'dock-color-tools';

        const dropper = document.createElement('button');
        dropper.type = 'button';
        dropper.className = 'dock-dropper';
        dropper.dataset.dropper = 'on';
        dropper.title = 'Eye dropper: take a colour off the ground';
        dropper.setAttribute('aria-label', 'Eye dropper');
        dropper.setAttribute('aria-pressed', 'false');

        const hexLabel = document.createElement('label');
        hexLabel.className = 'dock-label';
        hexLabel.textContent = 'HEX INPUT';
        const hex = document.createElement('input');
        hex.type = 'text';
        hex.className = 'dock-value dock-hex';
        hex.maxLength = 7;
        hex.spellcheck = false;
        hex.autocomplete = 'off';
        hex.setAttribute('aria-label', `${entry.row.label} hex input`);
        hexLabel.append(hex);

        tools.append(dropper, hexLabel);
        line.append(swatches, picker, tools);
        this.fields.append(line);
        this.drawn.set(key, { line, reading: hex, swatches, dropper, color: true });
    }

    /**
     * Draws one row: its label and its reading.
     *
     * A row holding a figure is the label and the field the figure is typed
     * into, the field carrying its own up and down inside its right edge - the
     * panel's, not the browser's, which moved a field by 1 whatever the row
     * allowed, ignored `shift`, and on a phone was not drawn at all. A row with
     * no figure to type - a switch or a choice - is the label and its reading
     * between the two marks that step it, the reading itself a box that steps
     * it on. The marks' cells stay in the grid either way, so the column of
     * readings is one column whichever kind each row is.
     */
    drawRow(entry) {
        if (entry.row.color) {
            this.drawColorRow(entry);
            return;
        }

        const key  = rowKey(entry);
        const line = document.createElement('div');
        line.className = 'dock-row';
        line.dataset.row = key;

        const name = document.createElement('span');
        name.className = 'dock-label';
        name.textContent = entry.row.label;

        let reading, down, up;
        if (typed(entry.row)) {
            reading = document.createElement('input');
            reading.type = 'number';
            reading.inputMode = 'decimal';
            reading.className = 'dock-value';
            reading.setAttribute('aria-label', entry.row.label);
            // The bounds, for whatever reads the field out, and no step: the
            // panel steps the row, and a figure typed between two presses is
            // never one the browser should call off its step.
            reading.step = 'any';
            reading.min = String(fieldFigure(entry.row, entry.row.range.low));
            reading.max = String(fieldFigure(entry.row, entry.row.range.high));

            down = spinButton(-1, `${entry.row.label} down`);
            up   = spinButton(1, `${entry.row.label} up`);
            const spin = document.createElement('span');
            spin.className = 'dock-spin';
            spin.append(up, down);

            const field = document.createElement('span');
            field.className = 'dock-field';
            field.append(reading, spin);
            line.append(name, field);
        } else {
            down = stepButton(-1, `${entry.row.label} down`);
            up   = stepButton(1, `${entry.row.label} up`);
            reading = document.createElement('button');
            reading.type = 'button';
            reading.className = 'dock-value dock-pick';
            reading.dataset.cycle = 'true';
            line.append(name, down, reading, up);
        }

        // A value set by eye has a slider beside its figure, across the
        // row's whole range, moving the same value the steps and the figure do.
        let slider = null;
        if (entry.row.range?.slider === true && typed(entry.row)) {
            slider = document.createElement('input');
            slider.type = 'range';
            slider.className = 'dock-slider';
            slider.min = String(entry.row.range.low);
            slider.max = String(entry.row.range.high);
            slider.step = '1';
            slider.setAttribute('aria-label', `${entry.row.label} slider`);
            line.classList.add('dock-row-slider');
            line.append(slider);
        }

        this.fields.append(line);
        this.drawn.set(key, { line, reading, down, up, slider });
    }

    /** Writes every reading, leaving alone the one being typed into. */
    update(content) {
        // An answer's label and whether it can be pressed can change without
        // the panel changing shape - Extrude's one button reads both off the
        // stage its draft is at.
        for (const action of content.actions ?? []) {
            const answer = this.answers.querySelector(`.dock-action[data-action="${action.id}"]`);
            if (!answer) continue;
            if (answer.textContent !== action.label) answer.textContent = action.label;
            answer.disabled = action.disabled === true;
        }

        const shapes = [...(content.shapes ?? []), ...(content.sections ?? []).flatMap(section => section.shapes ?? [])];
        for (const row of shapes) {
            for (const tool of row.tools) {
                this.fields.querySelector(`.dock-shape[data-shape="${tool.id}"]`)?.setAttribute('aria-pressed', String(tool.live));
            }
        }

        // Read before the lines are written, since writing one is what makes
        // it no longer news.
        const show = statusToShow(content, this.said);

        for (const section of content.sections ?? []) {
            const text = section.text ? this.drawn.get(`text:${section.id}/${section.text.id}`) : null;
            if (text && document.activeElement !== text.field) {
                text.field.value = section.text.value ?? '';
                text.field.placeholder = section.text.placeholder ?? '';
            }
            const status = this.drawn.get(`status:${section.id}`);
            if (status) {
                const said = section.status?.text ?? '';
                if (status.status.textContent !== said) status.status.textContent = said;
                status.status.classList.toggle('refused', section.status?.refused === true);
            }
        }

        // Written after the lines, and only for the sections this draw drew.
        this.said = statusSaid(content);

        if (show) this.showStatus(show.id);

        for (const entry of dockRows(content)) {
            const drawn = this.drawn.get(rowKey(entry));
            if (!drawn) continue;

            if (drawn.color) {
                this.updateColorRow(drawn, entry, content);
                continue;
            }

            const held = !entry.live;
            drawn.line.classList.toggle('locked', held);
            drawn.down.disabled = held;
            drawn.up.disabled = held;

            drawn.reading.disabled = held;
            if (drawn.reading instanceof HTMLInputElement) {
                if (document.activeElement !== drawn.reading) {
                    drawn.reading.value = String(fieldFigure(entry.row, entry.value));
                    drawn.reading.setCustomValidity('');
                }
            } else {
                drawn.reading.textContent = entry.valueLabel;
                drawn.reading.setAttribute('aria-label', `${entry.row.label} ${entry.valueLabel}`);
            }

            if (drawn.slider) {
                drawn.slider.disabled = held;
                if (document.activeElement !== drawn.slider) drawn.slider.value = String(entry.value);
            }
        }
    }

    /** Writes a colour row: the swatch it is lit, the hex field, and the dropper pressed while it is armed. */
    updateColorRow(drawn, entry, content) {
        const held = !entry.live;
        drawn.line.classList.toggle('locked', held);
        for (const button of drawn.swatches.querySelectorAll('.dock-swatch')) {
            const swatch = COLOR_SWATCHES.find(each => each.id === button.dataset.swatch);
            button.setAttribute('aria-pressed', String(sameColor(swatch?.rgb, entry.value)));
            button.disabled = held;
        }
        // The eye dropper is offered where it can be armed - Free Paint's own
        // panel, which says whether it is, and an extrusion's surfaces, which
        // name the row it is armed for - and not on a colour row reached any
        // other way, such as a paint batch picked with Select.
        drawn.dropper.hidden = content.dropping === undefined;
        drawn.dropper.setAttribute('aria-pressed', String(content.dropping === true || content.dropping === entry.name));
        drawn.dropper.disabled = held;
        drawn.reading.disabled = held;
        drawn.line.style.setProperty('--dock-color', hexColor(entry.value));
        if (document.activeElement !== drawn.reading) {
            drawn.reading.value = entry.valueLabel;
            drawn.reading.setCustomValidity('');
        }
    }

    onClick(event) {
        const button = event.target.closest('button');
        if (!button || !this.root.contains(button) || this.content == null) return;

        // A button pressed with the pointer gives the focus back, so the keys
        // go on working the canvas; one reached by the keyboard keeps it.
        if (event.detail > 0) button.blur();

        if (button.dataset.action) {
            this.handlers.onAction?.(button.dataset.action);
            return;
        }

        if (button.dataset.section) {
            this.handlers.onFold?.(button.dataset.section);
            return;
        }

        if (button.dataset.shape) {
            this.handlers.onShape?.(button.dataset.shape);
            return;
        }

        // A colour row's own buttons: a swatch, a band of the picker - read
        // at the point along it the press landed - and the eye dropper.
        const colorLine = button.closest('.dock-color');
        if (colorLine) {
            const entry = this.entryFor(colorLine.dataset.row);
            if (!entry?.live) return;
            if (button.dataset.dropper) {
                this.handlers.onDropper?.(entry);
                return;
            }
            if (button.dataset.swatch) {
                const swatch = COLOR_SWATCHES.find(each => each.id === button.dataset.swatch);
                if (swatch) this.handlers.onColor?.(entry, [...swatch.rgb]);
                return;
            }
            if (button.dataset.shade) {
                const box = button.getBoundingClientRect();
                const along = box.width > 0 ? (event.clientX - box.left) / box.width : 0;
                this.handlers.onColor?.(entry, pickerColor(along, Number(button.dataset.shade)));
            }
            return;
        }

        // A switch's or a choice's reading is a box that steps it on, from
        // the last value back round to the first.
        if (button.dataset.cycle) {
            const entry = this.entryFor(button.closest('.dock-row')?.dataset.row);
            if (entry?.live) this.handlers.onStep?.(entry, cycleStep(entry.row, entry.value), false);
            return;
        }

        const step = Number(button.dataset.step);
        if (!step) return;

        const line = button.closest('.dock-row');
        if (line?.dataset.nudge) {
            this.handlers.onNudge?.(line.dataset.nudge, step);
            return;
        }

        // `shift` with the press is a coarse step - ten points, or ten steps.
        const entry = this.entryFor(line?.dataset.row);
        if (entry?.live) this.handlers.onStep?.(entry, step, event.shiftKey === true);
    }

    onChange(event) {
        const field = event.target;
        if (!(field instanceof HTMLInputElement) || this.content == null) return;
        if (field.type === 'range') return;

        // A section's line of text, taken as it stands when it is let go of.
        if (field.classList.contains('dock-text')) {
            this.handlers.onText?.(field.dataset.text, field.value, field.dataset.section);
            return;
        }

        // A hex figure typed at a colour row: taken when it is a colour, and
        // refused - the field keeping what was typed - when it is not.
        if (field.classList.contains('dock-hex')) {
            const entry = this.entryFor(field.closest('.dock-color')?.dataset.row);
            if (!entry?.live) return;
            const rgb = parseHex(field.value);
            if (rgb == null) {
                field.setCustomValidity(rangeNotice(entry.row));
                field.reportValidity();
                return;
            }
            field.setCustomValidity('');
            field.blur();
            this.handlers.onColor?.(entry, rgb);
            return;
        }

        const entry = this.entryFor(field.closest('.dock-row')?.dataset.row);
        if (entry?.live) this.handlers.onType?.(entry, Number(field.value), field);
    }

    /** A slider moved: its row given the value it is at, as it moves. */
    onSlide(event) {
        const slider = event.target;
        if (!(slider instanceof HTMLInputElement) || slider.type !== 'range' || this.content == null) return;

        const entry = this.entryFor(slider.closest('.dock-row')?.dataset.row);
        if (entry?.live) this.handlers.onType?.(entry, Number(slider.value), slider);
    }

    entryFor(key) {
        return dockRows(this.content).find(entry => rowKey(entry) === key) ?? null;
    }
}

/** The panel's own up and down inside a field, stepping the row the way its arrows did. */
function spinButton(step, name) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = step < 0 ? 'dock-spin-down' : 'dock-spin-up';
    button.dataset.step = String(step);
    button.tabIndex = -1;
    button.setAttribute('aria-label', name);
    return button;
}

function stepButton(step, name) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'dock-step';
    button.dataset.step = String(step);
    button.textContent = step < 0 ? OPTION_LEFT_MARK : OPTION_RIGHT_MARK;
    button.setAttribute('aria-label', name);
    return button;
}

function spacer() {
    const gap = document.createElement('span');
    gap.className = 'dock-value';
    return gap;
}
