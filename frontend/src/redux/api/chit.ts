import { api } from "./base";
import type { ApiSuccess, PaginatedData } from "../../interface/api";
import type { ChitBoard, ChitHistoryRow, ChitSchemeView } from "../../interface/chit";

/**
 * Chit fund endpoints.
 *
 * Everything is tagged `{ type: "Group", id: groupId }` rather than a new "Chit"
 * tag. That is deliberate: GroupListener already invalidates the Group tag on
 * every group socket event, so adding `chit:updated` to its event list is all the
 * realtime wiring this feature needs. A separate tag would mean editing
 * `tagTypes` in base.ts AND teaching the listener about it, to buy a slightly
 * narrower refetch of data that is cached anyway.
 */
export const chit = api.injectEndpoints({
  endpoints: (builder) => ({
    // The whole board for one group: scheme, the selected cycle, the caller's own
    // due and turn, the public order, and — only for the organiser — the
    // per-member roster.
    getChitBoard: builder.query<ChitBoard, { groupId: string; cycle?: number }>({
      query: ({ groupId, cycle }) => ({
        url: `/chit/${groupId}${cycle ? `?cycle=${cycle}` : ""}`,
        method: "GET",
      }),
      transformResponse: (res: { data: ChitBoard }) => res.data,
      providesTags: (_r, _e, { groupId }) => [{ type: "Group" as const, id: groupId }],
    }),

    getChitHistory: builder.query<
      PaginatedData<ChitHistoryRow>,
      { groupId: string; page?: number; limit?: number }
    >({
      query: ({ groupId, page = 1, limit = 10 }) => ({
        url: `/chit/${groupId}/history?page=${page}&limit=${limit}`,
        method: "GET",
      }),
      transformResponse: (res: { data: PaginatedData<ChitHistoryRow> }) => res.data,
      providesTags: (_r, _e, { groupId }) => [{ type: "Group" as const, id: groupId }],
    }),

    createChitScheme: builder.mutation<
      ApiSuccess<ChitSchemeView>,
      {
        groupId: string;
        amountPerMember: number;
        startDate: string;
        cycleIntervalDays: number;
        dueDays: number;
        organizerUserId?: string;
      }
    >({
      query: (body) => ({ url: "/chit/scheme", method: "POST", body }),
      invalidatesTags: (_r, _e, { groupId }) => [{ type: "Group" as const, id: groupId }, "Group"],
    }),

    updateChitScheme: builder.mutation<
      ApiSuccess<ChitSchemeView>,
      {
        groupId: string;
        amountPerMember?: number;
        startDate?: string;
        cycleIntervalDays?: number;
        dueDays?: number;
        participants?: { userId: string; position: number }[];
      }
    >({
      query: (body) => ({ url: "/chit/scheme", method: "PATCH", body }),
      invalidatesTags: (_r, _e, { groupId }) => [{ type: "Group" as const, id: groupId }, "Group"],
    }),

    activateChitScheme: builder.mutation<ApiSuccess<ChitSchemeView>, { groupId: string }>({
      query: (body) => ({ url: "/chit/activate", method: "POST", body }),
      invalidatesTags: (_r, _e, { groupId }) => [{ type: "Group" as const, id: groupId }, "Group"],
    }),

    rescheduleChit: builder.mutation<
      ApiSuccess<ChitSchemeView>,
      { groupId: string; startDate?: string; cycleIntervalDays?: number; dueDays?: number }
    >({
      query: (body) => ({ url: "/chit/reschedule", method: "POST", body }),
      invalidatesTags: (_r, _e, { groupId }) => [{ type: "Group" as const, id: groupId }, "Group"],
    }),

    cancelChitScheme: builder.mutation<
      ApiSuccess<ChitSchemeView>,
      { groupId: string; reason: string }
    >({
      query: (body) => ({ url: "/chit/cancel", method: "POST", body }),
      invalidatesTags: (_r, _e, { groupId }) => [{ type: "Group" as const, id: groupId }, "Group"],
    }),

    // Recording a contribution moves the group wallet, so it invalidates the
    // whole Group tag — the balance, the credits list and the roster all change.
    markChitDue: builder.mutation<
      ApiSuccess<{ dueId: string; amount: number }>,
      { groupId: string; dueId: string; paymentType?: string }
    >({
      query: (body) => ({ url: "/chit/due/mark", method: "POST", body }),
      invalidatesTags: (_r, _e, { groupId }) => [{ type: "Group" as const, id: groupId }, "Group"],
    }),

    unmarkChitDue: builder.mutation<
      ApiSuccess<{ dueId: string; amount: number }>,
      { groupId: string; dueId: string }
    >({
      query: (body) => ({ url: "/chit/due/unmark", method: "POST", body }),
      invalidatesTags: (_r, _e, { groupId }) => [{ type: "Group" as const, id: groupId }, "Group"],
    }),

    releaseChitPayout: builder.mutation<
      ApiSuccess<{ cycleNumber: number; payoutAmount: number; shortfall: number }>,
      { groupId: string; cycleId: string; acknowledgeShortfall?: boolean }
    >({
      query: (body) => ({ url: "/chit/payout", method: "POST", body }),
      invalidatesTags: (_r, _e, { groupId }) => [{ type: "Group" as const, id: groupId }, "Group"],
    }),
  }),
});

export const {
  useGetChitBoardQuery,
  useGetChitHistoryQuery,
  useCreateChitSchemeMutation,
  useUpdateChitSchemeMutation,
  useActivateChitSchemeMutation,
  useRescheduleChitMutation,
  useCancelChitSchemeMutation,
  useMarkChitDueMutation,
  useUnmarkChitDueMutation,
  useReleaseChitPayoutMutation,
} = chit;
