import { api } from "./base";
import type { ApiSuccess } from "../../interface/api";
import type { JoinLink, JoinLinkPreview } from "../../interface/joinLink";

export const joinLink = api.injectEndpoints({
    endpoints: (builder) => ({
        // Admin side — the link itself.
        getJoinLink: builder.query<JoinLink | null, string>({
            query: (groupId) => ({ url: `/joinlink/group/${groupId}`, method: "GET" }),
            transformResponse: (res: { data: { link: JoinLink | null } }) => res.data.link,
            providesTags: (_r, _e, groupId) => [{ type: "Group", id: groupId }],
        }),
        createJoinLink: builder.mutation<ApiSuccess<JoinLink>, { groupId: string }>({
            query: (body) => ({ url: "/joinlink/create", method: "POST", body }),
            invalidatesTags: (_r, _e, { groupId }) => [{ type: "Group", id: groupId }],
        }),
        revokeJoinLink: builder.mutation<ApiSuccess<{ revoked: number }>, { groupId: string }>({
            query: (body) => ({ url: "/joinlink/revoke", method: "POST", body }),
            invalidatesTags: (_r, _e, { groupId }) => [{ type: "Group", id: groupId }],
        }),

        // Joiner side — no membership required, so nothing here is group-tagged.
        previewJoinLink: builder.query<JoinLinkPreview, string>({
            query: (token) => ({ url: `/joinlink/preview/${token}`, method: "GET" }),
            transformResponse: (res: { data: JoinLinkPreview }) => res.data,
        }),
        joinViaLink: builder.mutation<
            ApiSuccess<{ groupName: string; message: string }>,
            { token: string; contribution: number }
        >({
            query: (body) => ({ url: "/joinlink/join", method: "POST", body }),
            // The group list can gain an entry once an admin approves; the
            // pending request itself isn't visible to the joiner anywhere else.
            invalidatesTags: ["Group"],
        }),
    }),
});

export const {
    useGetJoinLinkQuery,
    useCreateJoinLinkMutation,
    useRevokeJoinLinkMutation,
    usePreviewJoinLinkQuery,
    useJoinViaLinkMutation,
} = joinLink;
