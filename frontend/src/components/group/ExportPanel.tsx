import { useState } from 'react';
import { Card, Button, Note, UpgradeNote } from '../ui';
import { canExport } from '../../helpers/plans';
import { downloadGroupExport, ExportError, type ExportSheet } from '../../utils/downloadExport';
import type { PlanView } from '../../interface/subscription';

/**
 * The Organization tier's anchor feature, and the reason a committee pays for
 * this app rather than keeping a spreadsheet: a ledger their auditor accepts.
 *
 * Admins only, matching the route. An export is the whole group's financial
 * record — every contribution, settlement and email in one portable file — so
 * reading a chart in-app and walking away with the roster are different acts.
 */

interface Sheet {
    id: ExportSheet;
    label: string;
    hint: string;
}

const SHEETS: Sheet[] = [
    {
        id: 'audit-pack',
        label: 'Audit pack',
        hint: 'All three sheets in one file — what most auditors ask for.',
    },
    {
        id: 'ledger',
        label: 'Ledger',
        hint: 'Every credit, debit and refund with a running balance.',
    },
    {
        id: 'expenses',
        label: 'Expenses',
        hint: 'One row per expense, including reversed entries and splits.',
    },
    {
        id: 'members',
        label: 'Members',
        hint: 'Contributions and settlements, departed members included.',
    },
];

interface ExportPanelProps {
    groupId: string;
    subscription: PlanView | null | undefined;
    /** Only admins may export; hide the panel entirely for everyone else. */
    isAdmin: boolean;
}

export default function ExportPanel({ groupId, subscription, isAdmin }: ExportPanelProps) {
    const [busy, setBusy] = useState<ExportSheet | null>(null);
    const [error, setError] = useState<string | null>(null);

    if (!isAdmin) return null;

    // `canExport` deliberately disagrees with `features.dataExport` for a lapsed
    // group: the server still serves the download, so gating the button on the
    // effective plan would hide something the API would happily return.
    const allowed = canExport(subscription);
    const lapsed = allowed && !subscription?.features.dataExport;

    const run = async (sheet: ExportSheet) => {
        setError(null);
        setBusy(sheet);
        try {
            await downloadGroupExport(groupId, sheet);
        } catch (e) {
            setError(
                e instanceof ExportError ? e.message : 'Export failed. Please try again.'
            );
        } finally {
            setBusy(null);
        }
    };

    return (
        <Card title="Export records">
            {!allowed ? (
                <UpgradeNote groupId={groupId} variant="blocked">
                    Export this group's ledger, expenses and member register as CSV — the
                    file an auditor or treasurer needs. Available on Organization.
                </UpgradeNote>
            ) : (
                <div className="flex flex-col gap-3">
                    {lapsed && (
                        <Note tone="info">
                            This group's plan has lapsed. Exports stay available so you can
                            take your records with you.
                        </Note>
                    )}

                    <div className="grid gap-2 sm:grid-cols-2">
                        {SHEETS.map((sheet) => (
                            <div
                                key={sheet.id}
                                className="flex flex-col gap-2 rounded-xl border border-line p-3"
                            >
                                <div>
                                    <p className="text-theme-sm font-semibold">{sheet.label}</p>
                                    <p className="text-theme-2xs text-fg-muted">{sheet.hint}</p>
                                </div>
                                <Button
                                    variant={sheet.id === 'audit-pack' ? 'primary' : 'secondary'}
                                    size="sm"
                                    loading={busy === sheet.id}
                                    loadingLabel="Preparing…"
                                    // One at a time: the sheets share the same
                                    // queries, and a treasurer clicking all four
                                    // would fan out four full-table reads.
                                    disabled={busy !== null}
                                    onClick={() => run(sheet.id)}
                                >
                                    Download CSV
                                </Button>
                            </div>
                        ))}
                    </div>

                    {error && <Note tone="error">{error}</Note>}
                </div>
            )}
        </Card>
    );
}
