import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { BaseQueryFn } from "@reduxjs/toolkit/query";

const baseQuery = fetchBaseQuery({
    baseUrl: "http://localhost:5000/api",
    credentials: "include"
});

export const baseQueryWithReauth: BaseQueryFn<
  string | { url: string; method?: string; body?: unknown },
  unknown,
  unknown
> = async (args, api, extraOptions) => {
  try {
        let result = await baseQuery(args, api, extraOptions);
        return result;
    } catch (error: any) {
        if (error?.status === 401) {
            window.location.href = "/login";
        }
        return error;
    }
}

export const api = createApi({
    reducerPath: "api",
    baseQuery: baseQueryWithReauth,
    tagTypes: ["Auth", "Group", "User"],
    endpoints: () => ({})
})