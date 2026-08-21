import { Navigate, useParams } from "react-router-dom";
import { useChitCtx } from "../../hooks/useChitBoard";
import CollectionPanel from "../../components/chit/CollectionPanel";

/**
 * `/groups/:groupId/chit/collection` — the organiser's working surface.
 *
 * Guarded rather than merely unlinked: the rail hides it below canViewAll, but
 * the URL is still typeable, and the panel would otherwise render an empty
 * roster that reads as "nobody has paid" rather than "this is not yours to see".
 * The API sends no memberDues at all for a plain member, so there is nothing to
 * leak — this only stops the misleading empty state.
 */
export default function ChitCollectionPage() {
  const { groupId } = useParams();
  const ctx = useChitCtx();

  if (!ctx.isLoading && !ctx.canViewAll) {
    return <Navigate to={`/groups/${groupId}/chit`} replace />;
  }

  return <CollectionPanel ctx={ctx} />;
}
