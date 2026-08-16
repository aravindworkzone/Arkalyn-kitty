import mongoose from 'mongoose';
import Group from '../models/group.model';
import GroupTransaction from '../models/group_transaction.model';
import GroupMember from '../models/group_member.model';
import Expense from '../models/expense.model';
import { AppError } from '../helpers/AppError';
import { toCsv, csvFilename, type CsvValue } from '../helpers/csv';

// Export is the Organization tier's anchor feature: it is what turns a shared
// wallet into something a treasurer can hand to an auditor.
//
// One rule governs every query below: NO `.lean()`. Money fields carry the
// rupee<->paise getter pair from helpers/Money, and lean() returns raw BSON with
// the getters bypassed — every amount would silently export ×100. Slower
// hydration is the correct trade when the output is a financial record.
//
// Retention floors are also deliberately NOT applied. Retention limits what the
// UI *lists*; an export is the customer taking their own history out, and the
// tier that unlocks it has unlimited retention anyway. A lapsed group exporting
// under the survives-lapse rule gets everything it accrued while paying.

export interface CsvFile {
    filename: string;
    content: string;
}

const nameOf = (u: { name?: string; email?: string } | null | undefined): string =>
    u?.name || u?.email || 'Unknown';

// Resolves the human label used in filenames — displayId is the ID a treasurer
// actually recognises (`Grp-25-001`).
const groupLabel = async (groupId: mongoose.Types.ObjectId | string) => {
    const group = await Group.findById(groupId).select('name displayId');
    if (!group) throw new AppError('Group not found', 404);
    return { label: group.displayId || group.name, name: group.name, displayId: group.displayId };
};

// ---------------------------------------------------------------------------
// Ledger — the append-only CREDIT/DEBIT/REFUND stream. This is the sheet an
// auditor reconciles against, so it carries the running balance: a bare list of
// deltas forces them to recompute it in a spreadsheet, which is exactly the work
// the export exists to remove.
// ---------------------------------------------------------------------------
export const exportLedgerCsv = async (
    groupId: mongoose.Types.ObjectId | string
): Promise<CsvFile> => {
    const { label } = await groupLabel(groupId);

    const rows = await GroupTransaction.find({ groupId, isDeleted: false })
        .populate<{ performedBy: { name?: string; email?: string } | null }>('performedBy', 'name email')
        .populate<{ category: { name?: string } | null }>('category', 'name')
        .sort({ createdAt: 1 });

    let running = 0;
    const body: CsvValue[][] = rows.map((t) => {
        // REFUND puts money back into the pool, so it moves the balance the same
        // direction as a CREDIT. Getting this wrong is the one bug that would
        // make the export disagree with the app's own balance.
        const signed = t.action === 'DEBIT' ? -t.amount : t.amount;
        running += signed;

        return [
            t.createdAt,
            t.action,
            t.description,
            t.category?.name ?? '',
            signed,
            Number(running.toFixed(2)),
            nameOf(t.performedBy),
            t.referenceModel,
            t.referenceId?.toString() ?? '',
            t._id.toString(),
        ];
    });

    const content = toCsv(
        [
            'Date',
            'Type',
            'Description',
            'Category',
            'Amount (INR)',
            'Running balance (INR)',
            'Performed by',
            'Reference type',
            'Reference ID',
            'Entry ID',
        ],
        body
    );

    return { filename: csvFilename(label, 'ledger'), content };
};

// ---------------------------------------------------------------------------
// Expenses — one row per expense, with the split rendered inline. Soft-deleted
// rows are included and flagged rather than dropped: "what was entered and later
// reversed" is precisely what an audit asks about, and the ledger already
// carries the matching REFUND.
// ---------------------------------------------------------------------------
export const exportExpensesCsv = async (
    groupId: mongoose.Types.ObjectId | string
): Promise<CsvFile> => {
    const { label } = await groupLabel(groupId);

    const rows = await Expense.find({ groupId })
        .populate<{ category: { name?: string } | null }>('category', 'name')
        .populate<{ creditCategory: { name?: string } | null }>('creditCategory', 'name')
        .populate<{ paidBy: { name?: string; email?: string } | null }>('paidBy', 'name email')
        .populate<{ fundedByGroup: { name?: string; displayId?: string } | null }>('fundedByGroup', 'name displayId')
        .populate<{ splitBetween: { userId: { name?: string; email?: string } | null; amount: number }[] }>(
            'splitBetween.userId',
            'name email'
        )
        .sort({ date: 1 });

    const body: CsvValue[][] = rows.map((e) => {
        const split = (e.splitBetween ?? [])
            .map((s: any) => `${nameOf(s.userId)}: ${s.amount}`)
            .join('; ');

        return [
            e.date,
            e.title,
            e.description ?? '',
            e.category?.name ?? '',
            e.creditCategory?.name ?? '',
            e.amount,
            nameOf(e.paidBy),
            e.paymentType,
            e.fundedByGroup ? `${e.fundedByGroup.name} (${e.fundedByGroup.displayId ?? ''})` : 'Own wallet',
            split,
            e.isDeleted ? 'REVERSED' : 'ACTIVE',
            e._id.toString(),
        ];
    });

    const content = toCsv(
        [
            'Date',
            'Title',
            'Description',
            'Category',
            'Credit bucket',
            'Amount (INR)',
            'Paid by',
            'Payment type',
            'Funded by',
            'Split',
            'Status',
            'Expense ID',
        ],
        body
    );

    return { filename: csvFilename(label, 'expenses'), content };
};

// ---------------------------------------------------------------------------
// Members — the contribution and settlement register. Departed members are kept
// (flagged via `leftMode`) because their money passed through the pool and a
// register that silently drops them will not reconcile against the ledger.
// ---------------------------------------------------------------------------
export const exportMembersCsv = async (
    groupId: mongoose.Types.ObjectId | string
): Promise<CsvFile> => {
    const { label } = await groupLabel(groupId);

    const rows = await GroupMember.find({ groupId })
        .populate<{ userId: { name?: string; email?: string } | null }>('userId', 'name email')
        .sort({ createdAt: 1 });

    const body: CsvValue[][] = rows.map((m: any) => [
        nameOf(m.userId),
        m.userId?.email ?? '',
        m.role,
        m.contribution,
        m.settlement ? 'Yes' : 'No',
        m.settlementAmount ?? 0,
        m.leftMode ?? '',
        m.isDeleted ? 'REMOVED' : 'ACTIVE',
        m.createdAt,
    ]);

    const content = toCsv(
        [
            'Member',
            'Email',
            'Role',
            'Total contributed (INR)',
            'Settled',
            'Settled amount (INR)',
            'Exit mode',
            'Status',
            'Joined',
        ],
        body
    );

    return { filename: csvFilename(label, 'members'), content };
};

// ---------------------------------------------------------------------------
// Audit pack — all three sheets concatenated into one downloadable file, each
// under a titled banner.
//
// A single CSV rather than a zip: zipping needs a dependency and a binary
// response path, and the thing a committee actually wants is one attachment they
// can forward. Excel opens it, the banners keep the sections apart, and the
// individual sheets remain available for anyone importing programmatically.
// ---------------------------------------------------------------------------
export const exportAuditPackCsv = async (
    groupId: mongoose.Types.ObjectId | string
): Promise<CsvFile> => {
    const { label, name, displayId } = await groupLabel(groupId);

    const [ledger, expenses, members] = await Promise.all([
        exportLedgerCsv(groupId),
        exportExpensesCsv(groupId),
        exportMembersCsv(groupId),
    ]);

    // Strip each sheet's BOM before concatenating — one at the top of the
    // combined file is correct, three interleaved is corruption.
    const strip = (s: string) => s.replace(/^﻿/, '');

    const header =
        `﻿Arkalyn Kitty — Audit Pack\r\n` +
        `Group,${name}\r\n` +
        `Group ID,${displayId ?? ''}\r\n` +
        `Generated,${new Date().toISOString()}\r\n\r\n`;

    const content =
        header +
        `LEDGER\r\n${strip(ledger.content)}\r\n` +
        `EXPENSES\r\n${strip(expenses.content)}\r\n` +
        `MEMBERS\r\n${strip(members.content)}`;

    return { filename: csvFilename(label, 'audit-pack'), content };
};
