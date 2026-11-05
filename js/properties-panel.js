/**
 * The properties panel - the one row builder every panel that edits declared
 * ranges is drawn from.
 *
 * A range is declared once, in a registry, with the helpers in
 * `js/environment/elements.js`: what kind it is, its bounds, its default. This
 * module turns a declaration and the values being held against it into rows -
 * what each row is labelled, what it reads, what one press moves it by, what a
 * typed figure means at it, and whether it is live - and writes an edited row
 * back. It never builds anything. It collects; the generator the registry
 * already has is what draws.
 *
 * There is one of it so there is one place a value is read off the wrong row,
 * and fixing that fixes every panel - the element editor, which was the first
 * caller and is pointed here rather than left beside it, and every tool's panel
 * after it. A range kind this module cannot draw draws no rows, which is what
 * lets a conformance test fail on the commit that declares one rather than on
 * the day a pilot opens a panel with an empty row in it.
 *
 * Pure module with no DOM or Three.js dependency, so every row can be unit
 * tested in Node and the drawing of them is somebody else's job.
 *
 * A row reads and writes a **holder**: `{ config }`, the values a range
 * resolved to, and for a gradient `{ shades, base }` beside it - the shade
 * either end is drawn at, and the colour that shade is measured against - so a
 * gradient end is stepped along its own hue rather than around the wheel.
 */

import { OPTION_LEFT_MARK, OPTION_RIGHT_MARK } from './settings.js';
import { CHOICE_FIELD, TOGGLE_FIELD } from './config.js';

/**
 * How far one press moves a range: a fiftieth of what the range allows, put on
 * the nearest of 1, 2, or 5 times a power of ten, so a peak height in the
 * hundreds moves by fifties and a ratio between nothing and one moves by
 * hundredths. Read off the declared bounds rather than configured, because a
 * step is a property of the range rather than another thing to keep in sync
 * with it.
 */
export const RANGE_STEPS = 50;

export function rangeStep(range) {
    // A range may name its own step, for a row where a fiftieth of the bounds
    // is the wrong press: a switch is two values and has to move between them
    // in one, rather than crawl from off to on in fifty hundredths.
    if (range.step > 0) return range.step;

    const raw = Math.abs(range.high - range.low) / RANGE_STEPS;
    if (!(raw > 0)) return 1;

    const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
    for (const nice of [1, 2, 5]) {
        if (raw <= nice * magnitude) return nice * magnitude;
    }
    return 10 * magnitude;
}

/**
 * How many decimal places a step is written to, which is also how many the
 * value it moves is rounded back to. A hundredth walked twenty times is not a
 * fifth unless it is put back on its own scale each time, and a readout
 * carrying the arithmetic's dust is a readout nobody trusts.
 */
export function stepPlaces(step) {
    return Math.max(0, -Math.floor(Math.log10(Math.abs(step))));
}

function clamp(value, low, high) {
    return Math.min(Math.max(value, low), high);
}

/** A number moved by a step, held to its bounds and put back on the step's own scale. */
export function moveValue(value, step, low, high) {
    return Number(clamp(value + step, low, high).toFixed(stepPlaces(step)));
}

// --- Colour ----------------------------------------------------------------

/**
 * How far either end of a gradient can be moved, as a multiple of the colour
 * the preset laid it down in.
 *
 * A colour is stepped along its own hue rather than around the wheel: the
 * arrow keys lighten and darken an end of a gradient and nothing else. Two
 * keys cannot walk a colour wheel and leave an element recognisable, and the
 * gradient helper exists precisely so no element shifts colour dramatically
 * across the ground it covers - a panel that let one do it with two presses
 * would be undoing the thing it is editing.
 */
export const SHADE_RANGE = { kind: 'scalar', low: 0.2, high: 2, default: 1 };

/** A colour lightened or darkened, kept inside what a colour channel holds. */
export function shadeColor(color, shade) {
    return color.map(channel => clamp(channel * shade, 0, 1));
}

// --- The switch on a gated range -------------------------------------------

/**
 * The row a gated range's switch is drawn as.
 *
 * It is a range like any other so the one stepper, the one typing path and the
 * one clamp all reach it - the panel has no second kind of row, and a switch
 * that needed one would need its own key handling, its own refusal notice and
 * its own place in every test that walks the rows. What it declares instead is
 * a step of its own: without it a press would move a fiftieth of the way from
 * off to on, which is a switch nobody can work.
 */
export const GATE_RANGE = { kind: 'scalar', low: 0, high: 1, default: 0, step: 1 };

/** What the switch reads as, which is a word rather than the number behind it. */
export const GATE_ON_LABEL  = 'ON';
export const GATE_OFF_LABEL = 'OFF';

/** True once the switch has been moved far enough to count as thrown. */
export function gateOn(value) {
    return Number(value) >= 0.5;
}

// --- The rows a range is drawn as --------------------------------------------

/**
 * The rows one declared range is drawn as, and what each of them reads and
 * writes in the holder's configuration.
 *
 * A span is two rows, because a span is two numbers and the pilot means to
 * move one of them. A gradient is two rows for the same reason, one per end.
 * A gated range is three: the switch, and then the two bounds it turns on. A
 * scalar and a choice are one row each.
 *
 * A kind this panel has no rows for draws none, rather than a number row it
 * does not know is wrong: an empty answer is one a conformance test can see.
 */
export function rangeRows(name, range) {
    if (range.kind === 'span') {
        return [
            { part: 'min', label: `${label(name)} MIN`, range, at: 0 },
            { part: 'max', label: `${label(name)} MAX`, range, at: 1 }
        ];
    }

    // The switch is listed above the bounds it governs, so a reader meets the
    // question before the two answers to it. The bounds stay listed while it is
    // off: a pilot setting a footprint sets the numbers and then turns it on as
    // often as the other way round, and a pair of rows that appeared and
    // disappeared under the cursor would move every row below them.
    if (range.kind === 'gated') {
        return [
            { part: 'on',  label: label(name),           range: GATE_RANGE, gate: true },
            { part: 'min', label: `${label(name)} MIN`,  range, gated: true, at: 0 },
            { part: 'max', label: `${label(name)} MAX`,  range, gated: true, at: 1 }
        ];
    }

    // A mode is the switch and nothing else, so it is the gate row without the
    // two bounds under it. `bare` is what says the switch is the whole value
    // rather than one half of a pair: everything else about the row - the step
    // of 1, the word it reads as, the notice it refuses a figure with - is the
    // gate's, because a switch is a switch whatever it is switching.
    if (range.kind === TOGGLE_FIELD) {
        return [{ part: 'on', label: label(name), range: GATE_RANGE, gate: true, bare: true }];
    }

    if (range.kind === 'gradient') {
        return [
            { part: 'light', label: `${label(name)} LIGHT`, range: SHADE_RANGE, shade: 'light' },
            { part: 'dark',  label: `${label(name)} DARK`,  range: SHADE_RANGE, shade: 'dark'  }
        ];
    }

    // One of a list, stepped along the list a value at a time. It holds no
    // figure, so nothing is typed into it.
    if (range.kind === CHOICE_FIELD) {
        return [{ part: 'value', label: label(name), range, choice: true }];
    }

    if (range.kind === 'scalar') {
        return [{ part: 'value', label: label(name), range }];
    }

    return [];
}

/** A range's name as the panel writes it: `treeHeight` reads as `TREE HEIGHT`. */
export function label(name) {
    return name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toUpperCase();
}

/** What a row is currently reading, in the holder's configuration. */
export function rowValue(holder, name, row) {
    if (row.shade) return holder.shades[name][row.shade];
    // Both read before `row.at`, which a gated bound carries too: a gated
    // range holds its pair one level in, under `range`, so reading it as a span
    // would read the `on` and the `range` as the two bounds.
    if (row.gate) {
        return (row.bare ? holder.config[name] : holder.config[name].on) ? 1 : 0;
    }
    if (row.gated) return holder.config[name].range[row.at];
    if (row.at != null) return holder.config[name][row.at];
    return holder.config[name];
}

/**
 * What the panel writes beside a range: the reading, kept to the precision the
 * step moves it by, a shade as the percentage of the preset's colour it is
 * being drawn at, a switch as a word, and a choice as the value it holds.
 */
export function rowValueLabel(row, value) {
    if (row.shade) return `${Math.round(value * 100)}%`;
    if (row.gate) return gateOn(value) ? GATE_ON_LABEL : GATE_OFF_LABEL;
    if (row.choice) return label(String(value));
    return value.toFixed(stepPlaces(rangeStep(row.range)));
}

/** A row as the line a panel draws: the label, and the reading between the marks that say it steps. */
export function rangeEntryText(entry) {
    // A row being typed into is not being stepped, so the marks that say it is
    // come off while the typing is in hand - the same reading the settings
    // panel gives a row of its own being typed into.
    if (entry.typing) return `${entry.label}  ${entry.valueLabel}`;
    return `${entry.label}  ${OPTION_LEFT_MARK} ${entry.valueLabel} ${OPTION_RIGHT_MARK}`;
}

/**
 * Writes one value into the holder behind the row that holds it, whichever
 * way the pilot arrived at it.
 *
 * A span cannot be crossed over itself: raising a minimum stops at the maximum
 * and lowering a maximum stops at the minimum, because a range whose ends have
 * swapped is a range the generator has to guess about. A gradient end is held
 * as the shade it is being drawn at, and the colour is worked out from the one
 * it is measured against, so that colour stays the thing the row is read off.
 *
 * It is one function rather than a branch in each caller because the stepper
 * and the typing both end here: a typed figure that skipped the span rule
 * would be a way of writing a crossed-over range that stepping cannot produce.
 */
export function writeRowValue(holder, name, row, value) {
    if (row.shade) {
        holder.shades[name][row.shade] = value;
        holder.config[name][row.shade] = shadeColor(holder.base[name][row.shade], value);
        return;
    }

    if (row.gate) {
        const on = gateOn(value);
        if (row.bare) holder.config[name] = on;
        else holder.config[name].on = on;
        return;
    }

    if (row.gated) {
        writePair(holder.config[name].range, row.at, value);
        return;
    }

    if (row.at != null) {
        writePair(holder.config[name], row.at, value);
        return;
    }

    holder.config[name] = value;
}

/** One end of a pair of bounds, held to the other so the pair cannot cross. */
function writePair(pair, at, value) {
    pair[at] = at === 0 ? Math.min(value, pair[1]) : Math.max(value, pair[0]);
}

/** How many ordinary steps a coarse step is, for any row not read as a percentage. */
export const COARSE_STEPS = 10;

/** How many points a coarse step moves a row read as a percentage. */
export const COARSE_POINTS = 10;

/**
 * The step `shift` makes of a press: ten points on a row read as a percentage,
 * added rather than compounded - 100%, 110%, 120%, not 121% - and ten of a
 * row's own steps on any other. The same for a click on a spinner and an arrow
 * key, so the mouse and the keyboard step alike, and for every panel the rows
 * are drawn in.
 */
export function coarseStep(row, step) {
    const sign = Math.sign(Number(step) || 0);
    if (row?.shade) return sign * (COARSE_POINTS / 100) / rangeStep(SHADE_RANGE);
    return sign * COARSE_STEPS * Math.max(Math.abs(Number(step) || 0), 1);
}

/**
 * Steps a row along what its range allows: a number by the range's step, held
 * to its bounds, and a choice along its list a value at a time, stopping at
 * either end rather than going round.
 *
 * Returns true when the row was written, which is whenever the press asked for
 * a value other than the one the row held.
 */
export function stepRow(holder, name, row, step) {
    if (!step) return false;

    const held = rowValue(holder, name, row);
    const next = row.choice
        ? stepChoice(row.range, held, step)
        : moveValue(held, step * rangeStep(row.range), row.range.low, row.range.high);
    if (next === held) return false;

    writeRowValue(holder, name, row, next);
    return true;
}

function stepChoice(range, held, step) {
    const values = range.values ?? [];
    if (values.length === 0) return held;

    const at   = values.indexOf(held);
    const from = at >= 0 ? at : Math.max(values.indexOf(range.default), 0);
    return values[clamp(from + Math.trunc(step), 0, values.length - 1)];
}

// --- Typing a figure into a row ------------------------------------------------

/**
 * True for a row a figure can be typed into, which is every row holding a
 * number. A choice holds one of a list, so a digit pressed at one means
 * nothing - which is what the settings panel's choice rows already say.
 */
export function isTypedRow(row) {
    return row != null && !row.choice && row.range != null;
}

/**
 * The value a typed figure stands for, in the units the row reads in.
 *
 * Every row but a gradient end reads the number it holds, so the figure is the
 * value. A gradient end reads as the percentage of the preset's colour it is
 * being drawn at, so a pilot typing 150 at a row reading 150% means a shade of
 * 1.5 - the figure on screen is the figure they are answering.
 */
export function typedRowValue(row, typed) {
    if (!Number.isFinite(typed)) return null;
    return row?.shade ? typed / 100 : typed;
}

/**
 * What the row says when a press is refused: the bounds the range was declared
 * with, written the way the row writes a value, so a gradient end is refused
 * against percentages and a height against feet.
 */
export function rangeNotice(row) {
    const range = row?.range;
    if (!range) return '';
    return `${rowValueLabel(row, range.low)} TO ${rowValueLabel(row, range.high)}`;
}

// --- Gates -----------------------------------------------------------------------

/**
 * True while a range's gate is open: every field it names holds one of the
 * values that open it. A range with no gate is always open.
 *
 * A field is read from the holder's own values; one written `ctx.<name>` is
 * read from the context the panel is handed instead, which is how a gate asks
 * about the session - whether a selection is live - rather than about the
 * element. Nothing else is reached for: a gate resolves against what it was
 * given and nothing more.
 */
export function gateOpen(range, values = {}, context = {}) {
    const when = range?.when;
    if (when == null) return true;

    return Object.entries(when).every(([field, opening]) => {
        const held = field.startsWith('ctx.') ? context?.[field.slice(4)] : values?.[field];
        const allowed = Array.isArray(opening) ? opening : [opening];
        return allowed.some(value => Object.is(value, held));
    });
}

/**
 * Every row a set of ranges is drawn as, with what each reads, what it says,
 * and whether it is live, for one holder.
 *
 * A row whose range is gated shut is still listed - with its value kept - and
 * marked not live, so a panel draws it disabled and a press at it moves
 * nothing. Opening the gate again gives back the value it held rather than the
 * default, because the value never went anywhere.
 */
export function panelRows(ranges, holder, context = {}) {
    const rows = [];

    for (const [name, range] of Object.entries(ranges ?? {})) {
        const live = gateOpen(range, holder?.config, context);
        for (const row of rangeRows(name, range)) {
            const value = rowValue(holder, name, row);
            rows.push({ name, row, value, valueLabel: rowValueLabel(row, value), live });
        }
    }

    return rows;
}
