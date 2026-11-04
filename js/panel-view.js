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
 */

import { isTypedRow, rangeStep, stepPlaces } from './properties-panel.js';
import { OPTION_LEFT_MARK, OPTION_RIGHT_MARK } from './settings.js';

/** The key a row is found by: its range's name and which part of the range it is. */
export function rowKey(entry) {
    return `${entry.name}:${entry.row.part}`;
}

/** The figure a typed field shows for a row, in the units the row reads in. */
export function fieldFigure(row, value) {
    if (row.shade) return Math.round(value * 100);
    return Number(Number(value).toFixed(stepPlaces(rangeStep(row.range))));
}

/** True for a row drawn as a typed field rather than a reading between two marks. */
function typed(row) {
    return isTypedRow(row) && !row.gate;
}

/** What the dock shows, as a string that changes only when its rows do. */
function shapeOf(content) {
    return [
        content.kind, content.heading,
        ...content.rows.map(rowKey),
        ...(content.nudges ?? []).map(nudge => `nudge:${nudge.id}`),
        ...(content.actions ?? []).map(action => `action:${action.id}`)
    ].join('|');
}

export class PanelView {
    /**
     * `root` holds three parts, found by `data-dock`: the heading, the fields
     * that scroll, and the answers. `handlers` are told what was done:
     * `onStep(entry, step)`, `onType(entry, figure, field)`,
     * `onNudge(id, sign)` and `onAction(id)`.
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

        root.addEventListener('click', (event) => this.onClick(event));
        root.addEventListener('change', (event) => this.onChange(event));
    }

    /** Draws what the dock shows, or takes it off the screen for nothing. */
    render(content) {
        if (content == null) {
            this.root.style.display = 'none';
            this.shape = null;
            this.content = null;
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

        for (const entry of content.rows) {
            const key  = rowKey(entry);
            const line = document.createElement('div');
            line.className = 'dock-row';
            line.dataset.row = key;

            const name = document.createElement('span');
            name.className = 'dock-label';
            name.textContent = entry.row.label;

            const down = stepButton(-1, `${entry.row.label} down`);
            const up   = stepButton(1, `${entry.row.label} up`);

            let reading;
            if (typed(entry.row)) {
                reading = document.createElement('input');
                reading.type = 'number';
                reading.inputMode = 'decimal';
                reading.className = 'dock-value';
                reading.setAttribute('aria-label', entry.row.label);
            } else {
                reading = document.createElement('span');
                reading.className = 'dock-value';
            }

            line.append(name, down, reading, up);
            this.fields.append(line);
            this.drawn.set(key, { line, reading, down, up });
        }

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

        for (const action of content.actions ?? []) {
            const answer = document.createElement('button');
            answer.type = 'button';
            answer.className = 'dock-action';
            answer.dataset.action = action.id;
            answer.textContent = action.label;
            this.answers.append(answer);
        }
        this.answers.style.display = (content.actions ?? []).length ? 'flex' : 'none';
    }

    /** Writes every reading, leaving alone the one being typed into. */
    update(content) {
        for (const entry of content.rows) {
            const drawn = this.drawn.get(rowKey(entry));
            if (!drawn) continue;

            const held = !entry.live;
            drawn.line.classList.toggle('locked', held);
            drawn.down.disabled = held;
            drawn.up.disabled = held;

            if (drawn.reading instanceof HTMLInputElement) {
                drawn.reading.disabled = held;
                if (document.activeElement !== drawn.reading) {
                    drawn.reading.value = String(fieldFigure(entry.row, entry.value));
                    drawn.reading.setCustomValidity('');
                }
            } else {
                drawn.reading.textContent = entry.valueLabel;
            }
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

        const step = Number(button.dataset.step);
        if (!step) return;

        const line = button.closest('.dock-row');
        if (line?.dataset.nudge) {
            this.handlers.onNudge?.(line.dataset.nudge, step);
            return;
        }

        const entry = this.entryFor(line?.dataset.row);
        if (entry?.live) this.handlers.onStep?.(entry, step);
    }

    onChange(event) {
        const field = event.target;
        if (!(field instanceof HTMLInputElement) || this.content == null) return;

        const entry = this.entryFor(field.closest('.dock-row')?.dataset.row);
        if (entry?.live) this.handlers.onType?.(entry, Number(field.value), field);
    }

    entryFor(key) {
        return this.content?.rows.find(entry => rowKey(entry) === key) ?? null;
    }
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
