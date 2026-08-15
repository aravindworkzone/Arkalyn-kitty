import { api } from "./base";
import type { ApiSuccess } from "../../interface/api";
import type { GroupLink, GroupLinks } from "../../interface/groupLink";

/**
 * Group-to-group funding links.
 *
 * Every mutation touches TWO groups, so each invalidates the acting group's tag
 * and the plain 'Group' list tag — the counterpart's page is refreshed by the
 * GROUP_LINK_UPDATED socket event, which the server emits to both rooms.
 */
export const groupLink = api.injectEndpoints({
    endpoints: (builder) => ({
        getGroupLinks: builder.query<GroupLinks, string>({
            query: (groupId) => ({
                url: `/grouplink/${groupId}`,
                method: "GET",
            }),
            transformResponse: (res: { data: GroupLinks }) => res.data,
            providesTags: (_result, _error, groupId) => [{ type: "Group", id: groupId }],
        }),

        requestLink: builder.mutation<
            ApiSuccess<GroupLink>,
            { groupId: string; sourceGroupRef: string }
        >({
            query: (body) => ({ url: "/grouplink/request", method: "POST", body }),
            invalidatesTags: (_r, _e, { groupId }) => [{ type: "Group", id: groupId }, "Group"],
        }),

        approveLink: builder.mutation<ApiSuccess<GroupLink>, { groupId: string; linkId: string }>({
            query: (body) => ({ url: "/grouplink/approve", method: "POST", body }),
            invalidatesTags: (_r, _e, { groupId }) => [{ type: "Group", id: groupId }, "Group"],
        }),

        rejectLink: builder.mutation<ApiSuccess<GroupLink>, { groupId: string; linkId: string }>({
            query: (body) => ({ url: "/grouplink/reject", method: "POST", body }),
            invalidatesTags: (_r, _e, { groupId }) => [{ type: "Group", id: groupId }, "Group"],
        }),

        transferToLink: builder.mutation<
            ApiSuccess<GroupLink>,
            { groupId: string; linkId: string; amount: number; description?: string }
        >({
            query: (body) => ({ url: "/grouplink/transfer", method: "POST", body }),
            // A transfer moves the acting group's balance too, so the group
            // detail/summary caches have to go as well.
            invalidatesTags: (_r, _e, { groupId }) => [{ type: "Group", id: groupId }, "Group"],
        }),

        revokeLink: builder.mutation<ApiSuccess<GroupLink>, { groupId: string; linkId: string }>({
            query: (body) => ({ url: "/grouplink/revoke", method: "POST", body }),
            invalidatesTags: (_r, _e, { groupId }) => [{ type: "Group", id: groupId }, "Group"],
        }),
    }),
});

export const {
    useGetGroupLinksQuery,
    useRequestLinkMutation,
    useApproveLinkMutation,
    useRejectLinkMutation,
    useTransferToLinkMutation,
    useRevokeLinkMutation,
} = groupLink;
