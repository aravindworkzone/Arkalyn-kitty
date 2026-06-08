import { useGetUserQuery } from "../redux/api/auth";
import type { CurrentUser } from "../interface/user";

export function useCurrentUser() {
    const { data, isLoading, isError, error } = useGetUserQuery();

    return {
        user: data?.data?.user ?? null as CurrentUser | null,
        isLoading,
        isAuthenticated: !!data?.data?.user,
        isAppOwner: data?.data?.user?.role === "APP_OWNER",
        userId: data?.data?.user?._id ?? null as string | null,
        isError,
        error,
    };
}
