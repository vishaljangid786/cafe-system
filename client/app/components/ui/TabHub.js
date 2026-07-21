'use client';
import { useMemo, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import { canViewPage } from '@/app/config/pages';

// One page that hosts several related sections as tabs.
//
// The app had grown one route per feature, which made the sidebar long and split
// work that belongs together (Revenue / Expenses / Payment Insights are the same
// job). A hub keeps every feature but collapses the navigation.
//
// Two rules make this safe to use for permission-sensitive sections:
//
//   1. A tab is only rendered when the viewer may open it. Gating is per TAB,
//      not per hub, so a branch admin who can see Revenue but not Payment
//      Insights lands on a Finance page with a single tab — never on a page
//      that shows them a section they'd be bounced out of.
//   2. Only the ACTIVE tab is mounted. Each section keeps the self-contained
//      fetching it had as a standalone page, and opening the hub never fires
//      every section's API calls at once.
//
// The layout's route guard still gates the URL itself, so this is the second
// layer, not the only one.
//
// Usage:
//   <TabHub
//     defaultTab="revenue"
//     tabs={[
//       { key: 'revenue', label: 'Revenue', icon: TrendingUp,
//         pageKey: 'page_revenue', render: () => <RevenuePage /> },
//     ]}
//   />
export default function TabHub({
  /**
   * [{ key, label, icon, pageKey?, visible?, render }]
   *   pageKey  gate on the viewer's allowedPages (the usual case)
   *   visible  (user) => boolean, for a tab whose rule is not just a page grant
   *   render   () => JSX for the tab body; called only while the tab is active
   */
  tabs = [],
  /** which tab opens first; falls back to the first one the viewer may see */
  defaultTab,
  /** shown when the viewer may not see a single tab */
  emptyMessage = "You don't have access to any section of this page.",
  className = '',
}) {
  const { user } = useAuth();

  const visibleTabs = useMemo(
    () => tabs.filter((t) => (t.visible ? t.visible(user) : canViewPage(user, t.pageKey))),
    [tabs, user]
  );

  const [active, setActive] = useState(defaultTab);

  // A route can ask for a tab this particular viewer isn't granted (they reached
  // /finance/expenses but only hold Revenue), so fall back rather than render
  // nothing — the guard already decided they may be on this page at all.
  const activeTab = visibleTabs.find((t) => t.key === active) || visibleTabs[0];

  if (!user) return null;

  if (!activeTab) {
    return (
      <div className="py-32 bg-(--color-surface) rounded-xl border border-dashed border-(--color-border) flex flex-col items-center justify-center text-(--color-text-muted)">
        <ShieldAlert size={48} className="mb-4 opacity-30" />
        <p className="text-sm font-medium">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* A lone tab is a page title, not a choice — don't make it look clickable. */}
      {visibleTabs.length > 1 && (
        <div className="inline-flex flex-wrap items-center gap-1 bg-(--color-surface) border border-(--color-border) rounded-xl p-1.5 shadow-sm">
          {visibleTabs.map((t) => {
            const Icon = t.icon;
            const on = activeTab.key === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setActive(t.key)}
                aria-current={on ? 'page' : undefined}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold tracking-normal transition-all ${
                  on
                    ? 'bg-primary text-(--color-on-primary) shadow-sm'
                    : 'text-(--color-text-muted) hover:text-(--color-text-primary) hover:bg-(--color-surface-soft)'
                }`}
              >
                {Icon && <Icon size={15} />}
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      {activeTab.render()}
    </div>
  );
}
