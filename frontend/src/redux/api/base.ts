import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query";
import { recordBounce } from "../../helpers/authBounce";

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
    if (path === "/login" || path === "/register") return;

    // A visitor who had a real session here has expired; one who never did was
    // turned away on their first try, which is a different message and — unlike
    // before — still a message. Saying nothing to first-time visitors is what
    // made a sign-in failure affecting everyone read as a new-user-only bug.
    const hadSession = sessionStorage.getItem("auth:hadSession");
    sessionStorage.removeItem("auth:hadSession");
    recordBounce(hadSession ? "expired" : "failed");

    window.location.href = "/login";
};

/**
 * What a failed refresh means. Only a 401 is proof the session is gone; a 429,
 * a 5xx or a dropped connection says nothing about the refresh token, and
 * treating those as "signed out" threw users with a perfectly valid session back
 * to the login page — a rate-limited refresh in particular used to lock someone
 * out until the window rolled over.
 */
type RefreshOutcome = "ok" | "rejected" | "unavailable";

// Single-flight refresh: when several requests 401 at once they all await the
// same /auth/refresh call, so the rotating refresh token is only consumed once.
let refreshPromise: Promise<RefreshOutcome> | null = null;

const runRefresh = (
    api: Parameters<typeof rawBaseQuery>[1],
    extraOptions: Parameters<typeof rawBaseQuery>[2]
): Promise<RefreshOutcome> => {
    if (refreshPromise) return refreshPromise;

    const pending = Promise.resolve(
        rawBaseQuery({ url: "/auth/refresh", method: "POST" }, api, extraOptions)
    )
        .then((res): RefreshOutcome => {
            if (!res.error) return "ok";
            return res.error.status === 401 ? "rejected" : "unavailable";
        })
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
        const outcome = await runRefresh(api, extraOptions);
        if (outcome === "ok") {
            result = await rawBaseQuery(args, api, extraOptions);
            if (result.error?.status === 401) {
                redirectToLogin();
            }
        } else if (outcome === "rejected") {
            redirectToLogin();
        }
        // "unavailable": surface the error to the caller and leave the session
        // alone. The user stays where they are and the next request can retry.
    }

    return result;
};

export const api = createApi({
    reducerPath: "api",
    baseQuery: baseQueryWithReauth,
    tagTypes: ["Auth", "Group", "User", "Category", "Expense", "Transaction", "Event", "Notification", "Admin", "AdminPromos", "Subscription"],
    endpoints: () => ({}),
});

export const LIST_TAG = "LIST" as const;
