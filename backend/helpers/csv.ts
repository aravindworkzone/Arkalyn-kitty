// Minimal RFC 4180 CSV writer.
//
// Hand-rolled rather than pulled from npm because the entire surface is one
// escape rule, and a dependency here would be a supply-chain risk sitting
// directly on top of customers' financial records.

export type CsvValue = string | number | boolean | Date | null | undefined;

// RFC 4180: wrap in quotes when the value contains a delimiter, a quote or a
// newline, and double any embedded quote.
//
// The leading-character guard is not in the spec — it defends against CSV
// injection. Excel and Sheets evaluate a cell starting with = + - or @ as a
// formula, so an expense titled `=HYPERLINK(...)` becomes live code the moment
// a treasurer opens the export. Prefixing a tab neutralises it while still
// displaying the original text.
const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r'];

const quote = (s: string): string =>
    /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;

export const csvCell = (value: CsvValue): string => {
    if (value === null || value === undefined) return '';

    // Numbers and dates skip the formula guard entirely. This matters: a DEBIT
    // exports as a negative amount, and `-` is a formula trigger — guarding it
    // would tab-prefix every debit in the ledger, turning the amount column into
    // text that Excel refuses to sum. The guard exists for user-authored strings,
    // which is the only place a hostile value can come from.
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? '' : value.toISOString();
    }
    if (typeof value === 'number') {
        // Amounts arrive as rupees via the Mongoose getters, so they are already
        // at most 2dp; callers that compute totals round before passing them in.
        return Number.isFinite(value) ? String(value) : '';
    }

    let s = String(value);
    if (s !== '' && FORMULA_TRIGGERS.includes(s[0] as string)) {
        s = `\t${s}`;
    }
    return quote(s);
};

export const csvRow = (values: CsvValue[]): string => values.map(csvCell).join(',');

// Builds a full CSV document. The BOM is deliberate: without it Excel on Windows
// reads the file as the system codepage and mangles every non-ASCII name — which
// on an Indian member roster is most of them.
export const toCsv = (headers: string[], rows: CsvValue[][]): string => {
    const lines = [csvRow(headers), ...rows.map(csvRow)];
    return `﻿${lines.join('\r\n')}\r\n`;
};

// `Grp-25-001 — ledger — 2026-08-16.csv`, with anything a filesystem or a
// Content-Disposition header would object to stripped out.
export const csvFilename = (groupLabel: string, sheet: string): string => {
    const safe = groupLabel.replace(/[^\w\-. ]+/g, '_').trim().slice(0, 60) || 'group';
    const stamp = new Date().toISOString().slice(0, 10);
    return `${safe}-${sheet}-${stamp}.csv`;
};
