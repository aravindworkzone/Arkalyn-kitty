import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ManagementTabs, { type ManagementTabDef } from "../../components/groupSettings/ManagementTabs";
import { useChitCtx } from "../../hooks/useChitBoard";
import TurnOrderPanel from "../../components/chit/TurnOrderPanel";
import CycleHistoryPanel from "../../components/chit/CycleHistoryPanel";

/**
 * `/groups/:groupId/chit/cycles` — the rotation, from two angles.
 *
 * **Turn order** is the promise: the fixed sequence, who has been paid, who is
 * next. **History** is the record: what each finished cycle actually collected
 * and handed over, with the caller's own marker against it.
 *
 * They are two views of one subject rather than two subjects, which is why this
 * is a rail inside one page rather than two more entries in the sidebar. A member
 * checking "when is my turn" and one checking "did cycle 2 really pay out" are on
 * the same errand.
 *
 * `?view=` rather than a path segment, so the section's own URL stays
 * /chit/cycles and the sidebar has one entry to highlight. It replaces
 * rather than pushes: flipping between two views of the same list is not a step
 * worth walking back through.
 */

const VIEWS = ["order", "history"] as const;
type CycleView = (typeof VIEWS)[number];

export default function ChitCyclesPage() {
  const { t } = useTranslation();
  const ctx = useChitCtx();
  const [searchParams, setSearchParams] = useSearchParams();

  const param = searchParams.get("view") as CycleView | null;
  const view: CycleView = param && VIEWS.includes(param) ? param : "order";

  const switchView = (next: CycleView) => {
    const params = new URLSearchParams(searchParams);
    params.set("view", next);
    setSearchParams(params, { replace: true });
  };

  const tabs: ManagementTabDef<CycleView>[] = [
    { id: "order", label: t("chit.viewOrder", "Turn order"), show: true },
    { id: "history", label: t("chit.viewHistory", "History"), show: true },
  ];

  return (
    <>
      {/* Sticky, as ManagementTabs is everywhere else. Nothing stacks above it —
          the chit sections are sidebar destinations, not a second rail. */}
      <ManagementTabs
        tabs={tabs}
        activeTab={view}
        onSwitchTab={switchView}
        ariaLabel={t("chit.viewsAria", "Cycle views")}
      />

      {view === "order" ? <TurnOrderPanel ctx={ctx} /> : <CycleHistoryPanel ctx={ctx} />}
    </>
  );
}
