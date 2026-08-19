import { useGetGroupByIdQuery } from "../redux/api/group";
import { groupFeaturesOf, groupTypeOf } from "../helpers/groupTypes";
import type { GroupType, GroupTypeFeatures } from "../interface/group";

// Reads ONE GROUP's type and the features it grants, off the cached group query —
// no extra request. Shaped exactly like useGroupPlan, and for the same reason:
// the server resolves the answer and ships it, so the UI gates on the identical
// object the API will enforce.
//
// Prefers the server's `features`/`groupTypeName` and falls back to deriving from
// `purpose` while the query is in flight (or on a payload that predates the
// fields). The fallback is FAMILY — today's full feature set — so a slow response
// never briefly hides controls the user does have.
export function useGroupType(groupId: string | undefined) {
  const { data: group, isLoading } = useGetGroupByIdQuery(groupId!, { skip: !groupId });

  const type: GroupType = group?.groupTypeName ?? groupTypeOf(group?.purpose);
  const features: GroupTypeFeatures = group?.features ?? groupFeaturesOf(group?.purpose);

  return {
    isLoading,
    type,
    features,
    isReserve: type === "RESERVE",
    isChit: type === "CHIT",
    // True once the group is really loaded — lets callers tell "no expenses"
    // apart from "not loaded yet", which the fallback hides.
    isResolved: Boolean(group),
  };
}
