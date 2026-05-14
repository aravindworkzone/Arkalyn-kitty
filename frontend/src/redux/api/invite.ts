import { api } from "./base";

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
  }),
});

export const { useAcceptInviteMutation, useRejectInviteMutation } = inviteApi;
