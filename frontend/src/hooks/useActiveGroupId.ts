import { useLocation } from "react-router-dom";

/**
 * The group whose screen is currently open, or undefined outside a group.
 *
 * Deliberately NOT useParams(). The sidebar and AppLayout sit in a pathless
 * layout route, above the routes that declare `:groupId` — useParams resolves
 * against the nearest match in the current route context, which for them is the
 * layout itself, so it comes back empty. Reading the pathname is the reliable
 * way to see a param owned by a descendant route.
 *
 * `/groups/new` is the create screen, not a group id, so it is excluded — the
 * sidebar must stay in its dashboard variant there.
 */
export function useActiveGroupId(): string | undefined {
    const { pathname } = useLocation();
    const match = /^\/groups\/([^/]+)/.exec(pathname);
    const id = match?.[1];
    return id && id !== "new" ? id : undefined;
}

export default useActiveGroupId;
