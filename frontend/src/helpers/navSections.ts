import type { GroupSectionKey } from "../interface/group";

/**
 * Which tracked section the open route belongs to, for the sidebar's update
 * dots (hooks/useSectionUpdates.ts).
 *
 * The mapping is many-to-one on purpose. Report has no store of its own — it is
 * a breakdown of expenses — so reading it counts as reading the expense
 * section, and the chit's three pages share the one board behind them. Screens
 * that only write (the new-expense form, chit setup) map to the section they
 * write into, because landing back on the list afterwards should not find a dot
 * waiting for the row the user just added.
 *
 * Returns undefined outside a group, and for routes with nothing to track.
 */
export const sectionForPath = (
  pathname: string,
  groupId: string | undefined
): GroupSectionKey | undefined => {
  if (!groupId) return undefined;

  const prefix = `/groups/${groupId}`;
  if (!pathname.startsWith(prefix)) return undefined;

  // "" for the overview itself, "/expenses/new" for anything below it.
  const rest = pathname.slice(prefix.length).replace(/\/+$/, "");

  if (rest === "") return "overview";
  if (rest.startsWith("/chit")) return "chit";
  if (rest.startsWith("/credits")) return "credits";
  if (rest.startsWith("/expenses")) return "expenses";
  if (rest.startsWith("/categories")) return "categories";
  if (rest.startsWith("/activity")) return "activity";
  if (rest.startsWith("/reports")) return "expenses";
  if (rest.startsWith("/connections")) return "connections";
  if (rest.startsWith("/manage")) return "manage";

  return undefined;
};

export default sectionForPath;
