import { api } from "./base";
import type { PaginatedNotifications } from "../../interface/notification";

export const notificationApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getNotifications: builder.query<
      PaginatedNotifications,
      { page?: number; limit?: number; unread?: boolean } | void
    >({
      query: (arg) => ({
        url: "/notifications",
        method: "GET",
        // `unread` is omitted rather than sent as false when it isn't asked
        // for, so the plain feed keeps the request — and the cache key — it
        // has always had.
        params: {
          page: arg?.page ?? 1,
          limit: arg?.limit ?? 20,
          ...(arg?.unread ? { unread: "true" } : {}),
        },
      }),
      transformResponse: (res: { data: PaginatedNotifications }) => res.data,
      providesTags: ["Notification"],
    }),
    getUnreadCount: builder.query<number, void>({
      query: () => ({ url: "/notifications/unread-count", method: "GET" }),
      transformResponse: (res: { data: { count: number } }) => res.data.count,
      providesTags: ["Notification"],
    }),
    markNotificationRead: builder.mutation<unknown, string>({
      query: (id) => ({ url: `/notifications/${id}/read`, method: "PATCH" }),
      invalidatesTags: ["Notification"],
    }),
    markAllNotificationsRead: builder.mutation<unknown, void>({
      query: () => ({ url: "/notifications/read-all", method: "PATCH" }),
      invalidatesTags: ["Notification"],
    }),
    deleteNotification: builder.mutation<unknown, string>({
      query: (id) => ({ url: `/notifications/${id}`, method: "DELETE" }),
      invalidatesTags: ["Notification"],
    }),
  }),
});

export const {
  useGetNotificationsQuery,
  useGetUnreadCountQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useDeleteNotificationMutation,
} = notificationApi;
