import { PageBackground, PageContainer } from "../ui";

export default function GroupDetailSkeleton() {
  return (
    <div className="min-h-screen bg-surface text-fg">
      <PageBackground />
      {/* Same shell as the real screen, so nothing jumps when data lands. */}
      <PageContainer width="content" className="animate-pulse">
        <div className="h-4 w-12 bg-surface-hover rounded" />
        <div className="rounded-2xl bg-surface-raised border border-line p-5 sm:p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="h-3 w-24 bg-surface-hover rounded" />
              <div className="h-6 w-48 bg-line rounded" />
              <div className="h-3 w-32 bg-surface-hover rounded" />
            </div>
            <div className="w-10 h-10 rounded-xl bg-surface-hover" />
          </div>
          <div className="grid grid-cols-3 gap-3 pt-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-xl bg-surface-hover border border-line p-3 space-y-2">
                <div className="h-2.5 w-12 bg-line rounded" />
                <div className="h-5 w-16 bg-line rounded" />
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-6 lg:gap-8 lg:grid-cols-2">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-64 rounded-2xl bg-surface-raised border border-line" />
          ))}
        </div>
      </PageContainer>
    </div>
  );
}
