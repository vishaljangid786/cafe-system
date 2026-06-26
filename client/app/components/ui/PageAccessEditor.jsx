'use client';

// Shared editor for page access + per-page action permissions.
// Used by BOTH Add Member and the Permission Manager so the two screens stay
// identical. Renders each page as a card: the page-open toggle (this is the
// "View / can open" gate) plus — for CRUD pages — a row of Add / Modify / Delete /
// Approve chips that grant those exact abilities. Action chips are only enabled
// once the page itself is granted.

import { Check } from 'lucide-react';
import { PAGE_GROUPS } from '@/app/config/pages';
import { ACTIONS_BY_PAGE } from '@/app/config/actions';

export default function PageAccessEditor({
  selectedPages,
  onTogglePage,
  canGrantPage,
  selectedActions,
  onToggleAction,
  canGrantAction,
}) {
  return (
    <div className="space-y-4">
      {Object.entries(PAGE_GROUPS).map(([group, pages]) => (
        <div key={group}>
          <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) mb-2 ml-1">{group}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {pages.map(({ key, label }) => {
              const pageChecked = selectedPages.includes(key);
              const pageAllowed = canGrantPage(key);
              const scope = ACTIONS_BY_PAGE[key];
              return (
                <div
                  key={key}
                  className={`rounded-xl border transition-colors ${pageChecked ? 'border-primary/40 bg-primary/5' : 'border-(--color-border) bg-(--color-surface-soft)'}`}
                >
                  {/* Page-open toggle */}
                  <button
                    type="button"
                    onClick={() => pageAllowed && onTogglePage(key)}
                    disabled={!pageAllowed}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold text-left transition-all ${pageChecked ? 'text-primary' : 'text-(--color-text-muted)'} ${!pageAllowed ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <span className="flex flex-col">
                      {label}
                      {!pageAllowed && <span className="text-[9px] text-danger normal-case">You don&apos;t have this</span>}
                    </span>
                    <span className={`h-4 w-4 rounded-md border flex items-center justify-center shrink-0 ${pageChecked ? 'bg-primary border-primary text-white' : 'border-(--color-border)'}`}>
                      {pageChecked && <Check size={12} strokeWidth={3} />}
                    </span>
                  </button>

                  {/* Per-page action chips (Add / Modify / Delete / Approve) */}
                  {scope && (
                    <div className={`px-3 pb-3 pt-1 flex flex-wrap gap-1.5 ${pageChecked ? '' : 'opacity-40'}`}>
                      {scope.actions.map((a) => {
                        const actionKey = `${scope.scope}.${a.action}`;
                        const checked = selectedActions.includes(actionKey);
                        const allowed = canGrantAction(actionKey);
                        const disabled = !pageChecked || !allowed;
                        return (
                          <button
                            type="button"
                            key={actionKey}
                            onClick={() => !disabled && onToggleAction(actionKey)}
                            disabled={disabled}
                            title={!allowed ? "You can't grant this" : a.label}
                            className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-normal transition-all flex items-center gap-1 ${checked ? 'border-primary bg-primary text-white' : 'border-(--color-border) bg-(--color-surface) text-(--color-text-muted)'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary/50'}`}
                          >
                            {checked && <Check size={10} strokeWidth={3} />}
                            {a.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
