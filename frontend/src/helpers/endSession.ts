import { api } from "../redux/api/base";
import { socket } from "../socket/socket";
import { clearGroupId } from "../redux/slice/group.slice";
import { clearRecentGroups } from "../hooks/useRecentGroups";
import { clearBacklogShown } from "./notificationBacklog";
import type { AppDispatch } from "../redux/store";

/**
 * Everything that has to be dropped when a session ends, in one place.
 *
 * The three exits — sign out, delete account, and the owner force-logout — each
 * carried their own copy of this, and SidebarFooter's said so in a comment
 * ("Mirrors page/ProfilePage.tsx's handleSignOut"). Two of them had already
 * fallen behind: neither cleared the group id or the recent-group list, so the
 * next account to sign in on the machine inherited the previous one's, and the
 * socket would try to join a group room it is not a member of.
 *
 * Called unconditionally, including when the network sign-out fails — a session
 * that cannot be ended server-side must still be ended locally.
 */
export const endSession = (dispatch: AppDispatch): void => {
    dispatch(api.util.resetApiState());
    dispatch(clearGroupId());
    // localStorage, so a page reload does not bring it back with it.
    clearRecentGroups();
    // sessionStorage survives a sign-out inside the same tab, so without this
    // the next account to sign in here would have its unread backlog swallowed
    // by the previous one's "already shown".
    clearBacklogShown();
    socket.disconnect();
};

export default endSession;
