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

        // A Reserve admin sets the Reserve's fixed credit limit. `groupId` is
        // the Reserve. Contributions never change it.
        setReserveLimit: builder.mutation<
            ApiSuccess<{ creditLimit: number }>,
            { groupId: string; creditLimit: number }
        >({
            query: (body) => ({ url: "/grouplink/reserve-limit", method: "POST", body }),
            invalidatesTags: (_r, _e, { groupId }) => [{ type: "Group", id: groupId }, "Group"],
        }),

        // The Family group (host) sends money to its Reserve: it pays off what
        // is owed first, and any rest is deposited into the Reserve.
        sendToReserve: builder.mutation<
            ApiSuccess<GroupLink>,
            { groupId: string; linkId: string; amount: number }
        >({
            query: (body) => ({ url: "/grouplink/send-to-reserve", method: "POST", body }),
            // Moves the acting group's balance too, so the group detail/summary
            // caches have to go as well.
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
    useSetReserveLimitMutation,
    useSendToReserveMutation,
    useRevokeLinkMutation,
} = groupLink;
