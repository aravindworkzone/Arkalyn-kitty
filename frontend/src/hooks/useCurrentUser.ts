import { useEffect } from "react";
import { useGetUserQuery } from "../redux/api/auth";
import type { CurrentUser } from "../interface/user";

export function useCurrentUser() {
    const { data, isLoading, isError, error } = useGetUserQuery();
    const isAuthenticated = !!data?.data?.user;

    // Record that a real session existed so a later refresh failure can tell an
    // expired user apart from a first-time visitor and show the right message.
    useEffect(() => {
        if (isAuthenticated) sessionStorage.setItem("auth:hadSession", "1");
    }, [isAuthenticated]);

    return {
        user: data?.data?.user ?? null as CurrentUser | null,
        isLoading,
        isAuthenticated,
        isAppOwner: data?.data?.user?.role === "APP_OWNER",
        userId: data?.data?.user?._id ?? null as string | null,
        isError,
        error,
    };
}
