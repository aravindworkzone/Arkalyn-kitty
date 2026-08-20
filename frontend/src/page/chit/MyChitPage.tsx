import { useChitCtx } from "../../hooks/useChitBoard";
import MyContributionPanel from "../../components/chit/MyContributionPanel";
import ThisCyclePanel from "../../components/chit/ThisCyclePanel";

/**
 * `/groups/:groupId/chit` — what the member came for.
 *
 * Their own due and its date, then whose turn this cycle is and when their own
 * payout lands. Nothing here is about anyone else's payment record, which is what
 * makes it the landing page for every role: the organiser is a participant too
 * and pays like everybody else, so they need this page as much as a member does.
 */
export default function MyChitPage() {
  const ctx = useChitCtx();
  return (
    <>
      <MyContributionPanel ctx={ctx} />
      <ThisCyclePanel ctx={ctx} />
    </>
  );
}
