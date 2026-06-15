import type { PlanTier, PlanView } from "./subscription";

export interface IUser {
    _id: string;
    name: string;
    email: string;
    password: string;
    createdAt?: Date;
    updatedAt?: Date;
}

// The shape returned by GET /user/me — the authenticated user plus their
// computed subscription view. Used to type the getUser query (replacing `any`).
export interface CurrentUser {
    _id: string;
    name: string;
    email: string;
    role: "USER" | "APP_OWNER";
    status: "ACTIVE" | "SUSPENDED" | "DELETED";
    plan: PlanTier;
    planExpiresAt: string | null;
    createdAt?: string;
    subscription: PlanView;
    // Masked personal API key (Developer section). null when no key exists.
    // The plaintext is never part of /me — only returned once at generation.
    apiKey: { prefix: string; createdAt: string | null } | null;
}
