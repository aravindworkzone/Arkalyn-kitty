import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../helpers/AppError';
import { assertCanExport } from '../helpers/planLimits';
import {
    exportLedgerCsv,
    exportExpensesCsv,
    exportMembersCsv,
    exportAuditPackCsv,
    type CsvFile,
} from '../services/export.service';

// Exports break the app's usual `{ success, message, data }` envelope on
// purpose: the browser has to receive a file, not JSON wrapping a string. Errors
// still travel through the normal handler, so a 402 on an unentitled group is
// the standard envelope — only the success path is a download.
const sendCsv = (res: Response, file: CsvFile) => {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    // Exports reflect live state; a cached copy handed to an auditor next month
    // would be quietly wrong.
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(file.content);
};

type Sheet = 'ledger' | 'expenses' | 'members' | 'audit-pack';

const BUILDERS: Record<Sheet, (groupId: string) => Promise<CsvFile>> = {
    ledger: exportLedgerCsv,
    expenses: exportExpensesCsv,
    members: exportMembersCsv,
    'audit-pack': exportAuditPackCsv,
};

export const exportGroupCsv = asyncHandler(async (req: Request, res: Response) => {
    if (!req.group?._id) throw new AppError('Group not found', 400);

    const sheet = req.params.sheet as Sheet;
    const build = BUILDERS[sheet];
    if (!build) throw new AppError('Unknown export', 404);

    // Entitlement is checked here rather than as route middleware because the
    // rule reads the STORED tier, not the effective one — a lapsed Organization
    // group keeps the right to take its own records out. See
    // helpers/planLimits → canExportData.
    await assertCanExport(req.group._id);

    sendCsv(res, await build(req.group._id.toString()));
});
