import { api } from "./base";
import type { ApiSuccess } from "../../interface/api";
import type { JoinRequest } from "../../interface/invite";

export const inviteApi = api.injectEndpoints({
  endpoints: (builder) => ({
    acceptInvite: builder.mutation<unknown, { inviteId: string; contribution: number }>({
      query: (body) => ({ url: "/invite/accept", method: "POST", body }),
      invalidatesTags: ["Notification", "Group"],
    }),
    rejectInvite: builder.mutation<unknown, { inviteId: string }>({
      query: (body) => ({ url: "/invite/reject", method: "POST", body }),
      invalidatesTags: ["Notification"],
    }),
    getPendingJoinRequests: builder.query<JoinRequest[], string>({
      query: (groupId) => ({ url: `/invite/pending/${groupId}`, method: "GET" }),
      transformResponse: (res: { data: { requests: JoinRequest[] } }) => res.data.requests,
      providesTags: (_result, _error, groupId) => [{ type: "Group", id: groupId }],
    }),
    approveJoin: builder.mutation<ApiSuccess<null>, { groupId: string; inviteId: string }>({
      query: (body) => ({ url: "/invite/approve", method: "POST", body }),
      // Approving mints a member and moves money, so the whole group view is stale.
      invalidatesTags: (_result, _error, arg) => [
        { type: "Group", id: arg.groupId },
        "Group",
        "Notification",
      ],
    }),
    declineJoin: builder.mutation<ApiSuccess<null>, { groupId: string; inviteId: string }>({
      query: (body) => ({ url: "/invite/decline", method: "POST", body }),
      invalidatesTags: (_result, _error, arg) => [
        { type: "Group", id: arg.groupId },
        "Notification",
      ],
    }),
  }),
});

export const {
  useAcceptInviteMutation,
  useRejectInviteMutation,
  useGetPendingJoinRequestsQuery,
  useApproveJoinMutation,
  useDeclineJoinMutation,
} = inviteApi;
