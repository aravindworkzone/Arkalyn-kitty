export interface GroupTransaction {
  _id: string;
  action: string;
  amount: number;
  description: string;
  performedBy: { _id: string; name: string };
  referenceModel: string;
  createdAt: string;
}

export interface GroupCredit {
  _id: string;
  amount: number;
  description: string;
  performedBy: { _id: string; name: string; email?: string };
  referenceModel: string;
  createdAt: string;
  // Set by the server on rows a chit contribution wrote. removeCreditService
  // refuses to delete these, so the UI must not offer the button — undoing one
  // belongs on the chit board, which unwinds the due, the cycle total, the
  // member's contribution and the wallet together.
  isChitCredit?: boolean;
  // Set by the server on money another group sent over a connection (a Family
  // group repaying or depositing into a Reserve). Also not removable here.
  isLinkCredit?: boolean;
}

export interface GroupEvent {
  _id: string;
  eventType: string;
  performedBy: { _id: string; name: string };
  metadata: Record<string, any>;
  createdAt: string;
}

// Whole-group transaction totals by action (from getBasicTransaction).
export interface BasicTransactionTotals {
  CREDIT?: number;
  DEBIT?: number;
  REFUND?: number;
}
