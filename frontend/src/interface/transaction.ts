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
