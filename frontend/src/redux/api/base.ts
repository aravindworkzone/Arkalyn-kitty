import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query";

const rawBaseQuery = fetchBaseQuery({
    baseUrl: import.meta.env.VITE_API_URL,
    credentials: "include",
});

// Auth endpoints must never trigger a refresh attempt: /auth/refresh would
// recurse, and a 401 from login/signup just means bad credentials.
const isAuthEndpoint = (url: string): boolean =>
    url.startsWith("/auth/login") ||
    url.startsWith("/auth/signup") ||
    url.startsWith("/auth/refresh");

const redirectToLogin = (): void => {
    const path = window.location.pathname;
    if (path !== "/login" && path !== "/register") {
        window.location.href = "/login";
    }
};

// Single-flight refresh: when several requests 401 at once they all await the
// same /auth/refresh call, so the rotating refresh token is only consumed once.
let refreshPromise: Promise<boolean> | null = null;

const runRefresh = (
    api: Parameters<typeof rawBaseQuery>[1],
    extraOptions: Parameters<typeof rawBaseQuery>[2]
): Promise<boolean> => {
    if (refreshPromise) return refreshPromise;

    const pending = Promise.resolve(
        rawBaseQuery({ url: "/auth/refresh", method: "POST" }, api, extraOptions)
    )
        .then((res) => !res.error)
        .finally(() => { refreshPromise = null; });

    refreshPromise = pending;
    return pending;
};

export const baseQueryWithReauth: BaseQueryFn<
    string | FetchArgs,
    unknown,
    FetchBaseQueryError
> = async (args, api, extraOptions) => {
    let result = await rawBaseQuery(args, api, extraOptions);

    if (result.error?.status === 401) {
        const url = typeof args === "string" ? args : args.url;

        if (isAuthEndpoint(url)) {
            return result;
        }

        // Access token is missing or expired — mint a fresh one from the
        // refresh-token cookie, then replay the original request.
        const refreshed = await runRefresh(api, extraOptions);
        if (refreshed) {
            result = await rawBaseQuery(args, api, extraOptions);
            if (result.error?.status === 401) {
                redirectToLogin();
            }
        } else {
            redirectToLogin();
        }
    }

    return result;
};

export const api = createApi({
    reducerPath: "api",
    baseQuery: baseQueryWithReauth,
    tagTypes: ["Auth", "Group", "User", "Category", "Expense", "Transaction", "Event", "Notification", "Admin", "AdminPromos"],
    endpoints: () => ({}),
});

export const LIST_TAG = "LIST" as const;
