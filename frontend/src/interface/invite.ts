// A join awaiting admin sign-off: the invitee accepted and declared a
// contribution, but no membership exists until an admin approves.
// Served by GET /invite/pending/:groupId.
export interface JoinRequest {
  _id: string;
  groupId: string;
  invitedUser: { _id: string; name: string; email: string };
  invitedBy: { _id: string; name: string } | null;
  contribution: number;
  respondedAt: string | null;
  createdAt: string;
}
