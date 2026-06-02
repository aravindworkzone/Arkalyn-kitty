import { useMemo } from "react";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import type { SerializedError } from "@reduxjs/toolkit";

// The single error shape the backend ever returns (see backend utils/response.ts):
//   { success: false, message: string, errors?: [{ field?, message }] }
interface ApiErrorEnvelope {
    success?: boolean;
    message?: string;
    errors?: Array<{ field?: string; message: string }>;
}

export type ApiError = FetchBaseQueryError | SerializedError | undefined | null;

const isObject = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null;

const envelopeOf = (error: unknown): ApiErrorEnvelope | null => {
    if (isObject(error) && "data" in error && isObject(error.data)) {
        return error.data as ApiErrorEnvelope;
    }
    return null;
};

/**
 * Normalizes any RTK Query error into a single human-readable string. Handles the
 * backend envelope, RTK's transport-level errors (network/parse/timeout), and the
 * SerializedError thrown by unexpected client-side failures — so callers never
 * have to reach into `error.data.message` or guess the shape.
 */
export const getApiErrorMessage = (
    error: unknown,
    fallback = "Something went wrong. Please try again."
): string => {
    if (!isObject(error)) return fallback;

    // Backend envelope (validation or thrown AppError).
    const envelope = envelopeOf(error);
    if (envelope?.errors?.length) {
        return envelope.errors[0].message || envelope.message || fallback;
    }
    if (envelope?.message) return envelope.message;

    // RTK transport-level errors carry a string `status`.
    if ("status" in error) {
        switch (error.status) {
            case "FETCH_ERROR":
                return "Can't reach the server. Check your connection and try again.";
            case "TIMEOUT_ERROR":
                return "The request timed out. Please try again.";
            case "PARSING_ERROR":
                return "We received an unexpected response from the server.";
            default:
                // Numeric HTTP status with no usable body.
                if (typeof error.status === "number") {
                    if (error.status === 401) return "Your session has expired. Please sign in again.";
                    if (error.status === 403) return "You don't have permission to do that.";
                    if (error.status === 404) return "We couldn't find what you were looking for.";
                    if (error.status === 429) return "Too many requests. Please slow down and try again.";
                    if (error.status >= 500) return "The server ran into a problem. Please try again shortly.";
                }
        }
    }

    // SerializedError (thrown client-side).
    if (error && "message" in error && typeof error.message === "string") {
        return error.message;
    }

    return fallback;
};

/**
 * Field-level errors from the backend's Zod validation, ready to merge into
 * useFieldError. Empty array when the error isn't a field-validation failure.
 */
export const getApiFieldErrors = (
    error: unknown
): Array<{ field: string; message: string }> => {
    const envelope = envelopeOf(error);
    if (!envelope?.errors?.length) return [];
    return envelope.errors
        .filter((e): e is { field: string; message: string } => Boolean(e.field))
        .map((e) => ({ field: e.field, message: e.message }));
};

/**
 * Hook form: pass an RTK Query `error` and get a memoized, human-readable
 * message plus any field-level errors. Returns `message: null` when there's no
 * error, so it slots straight into conditional rendering.
 */
export const useApiError = (error: unknown, fallback?: string) => {
    return useMemo(
        () => ({
            message: error ? getApiErrorMessage(error, fallback) : null,
            fieldErrors: getApiFieldErrors(error),
            isError: Boolean(error),
        }),
        [error, fallback]
    );
};
