'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowDown, ArrowUp, TrendingUp } from 'lucide-react';
import api from '../../services/api';
import { Money } from '../ui/Money';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const currentMonthValue = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const prettyMonth = (val) => {
  const [y, m] = String(val).split('-').map(Number);
  if (!y || !m) return '';
  return `${MONTHS[m - 1]} ${y}`;
};

// Overview cash-flow summary: money received vs money paid out for one month.
// Data is scoped server-side to the caller's role/branch (staff/chef see only
// their own activity), so no branch UI lives here — pass `locationId` when a
// specific branch is in scope.
export default function CashFlowCard({ locationId }) {
  const [month, setMonth] = useState(currentMonthValue);
  const [category, setCategory] = useState('all');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { month };
      if (locationId) params.locationId = locationId;
      if (category !== 'all') params.category = category;
      const res = await api.get('/analytics/cash-flow', { params });
      setData(res.data?.data || null);
    } catch (e) {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [month, category, locationId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const moneyIn = data?.moneyIn || 0;
  const moneyOut = data?.moneyOut || 0;
  const stock = data?.stockPurchases || 0;
  const otherExp = data?.otherExpenses || 0;
  const outstanding = data?.outstanding || 0;
  const net = data?.netCashFlow ?? (moneyIn - moneyOut);
  const byCategory = data?.byCategory || [];

  const barMax = Math.max(moneyIn, moneyOut, 1);
  const inWidth = `${Math.min(100, (moneyIn / barMax) * 100)}%`;
  const outWidth = `${Math.min(100, (moneyOut / barMax) * 100)}%`;

  return (
    <div className="bg-(--color-surface) border border-(--color-border) rounded-2xl p-5 sm:p-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-(--color-text-primary) leading-none">
            Cash Flow — {prettyMonth(month)}
          </h2>
        </div>
        <span className="text-xs sm:text-sm text-(--color-text-muted)">money received vs money paid out</span>
      </div>

      {/* Filters: month + category chips */}
      <div className="flex flex-wrap items-center gap-2 mt-4">
        <input
          type="month"
          value={month}
          max={currentMonthValue()}
          onChange={(e) => setMonth(e.target.value || currentMonthValue())}
          className="bg-(--color-surface-soft) border border-(--color-border) rounded-lg px-2.5 py-1.5 text-xs font-medium outline-none text-(--color-text-primary) focus:border-primary/40 cursor-pointer"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCategory('all')}
            className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors
              ${category === 'all' ? 'bg-primary text-(--color-on-primary)' : 'bg-(--color-surface-soft) text-(--color-text-muted) hover:text-(--color-text-primary)'}`}
          >
            All
          </button>
          {byCategory.map((c) => (
            <button
              key={c.category}
              type="button"
              onClick={() => setCategory(c.category)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors
                ${category === c.category ? 'bg-primary text-(--color-on-primary)' : 'bg-(--color-surface-soft) text-(--color-text-muted) hover:text-(--color-text-primary)'}`}
            >
              {c.category}
            </button>
          ))}
        </div>
      </div>

      {/* Tiles */}
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 transition-opacity ${loading ? 'opacity-60' : 'opacity-100'}`}>
        {/* Money In */}
        <div className="rounded-xl border border-success/20 bg-linear-to-br from-success/8 to-transparent p-4">
          <div className="flex items-center gap-2">
            <span className="h-7 w-7 rounded-lg bg-success/15 text-success flex items-center justify-center shrink-0">
              <ArrowDown size={16} strokeWidth={2.5} />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-(--color-text-muted)">Money In</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-success">
            <Money value={moneyIn} />
          </div>
          <div className="mt-3 h-2 rounded-full bg-(--color-surface-soft) overflow-hidden">
            <div className="h-full rounded-full bg-success transition-all duration-500" style={{ width: inWidth }} />
          </div>
          <p className="mt-2 text-[11px] text-(--color-text-muted)">
            <Money value={moneyIn} /> sales collected
          </p>
        </div>

        {/* Money Out */}
        <div className="rounded-xl border border-danger/20 bg-linear-to-br from-danger/8 to-transparent p-4">
          <div className="flex items-center gap-2">
            <span className="h-7 w-7 rounded-lg bg-danger/15 text-danger flex items-center justify-center shrink-0">
              <ArrowUp size={16} strokeWidth={2.5} />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-(--color-text-muted)">Money Out</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-danger">
            <Money value={moneyOut} />
          </div>
          <div className="mt-3 h-2 rounded-full bg-(--color-surface-soft) overflow-hidden">
            <div className="h-full rounded-full bg-danger transition-all duration-500" style={{ width: outWidth }} />
          </div>
          <p className="mt-2 text-[11px] text-(--color-text-muted)">
            {category === 'all' ? (
              <><Money value={stock} /> stock · <Money value={otherExp} /> expenses</>
            ) : (
              <>{category}</>
            )}
          </p>
        </div>
      </div>

      {/* Net cash flow */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-3 rounded-xl bg-(--color-surface-soft) border border-(--color-border) px-4 py-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-(--color-text-muted)">Net Cash Flow</p>
          <p className="text-xs text-(--color-text-muted) mt-0.5">
            money in − out · <Money value={outstanding} /> still outstanding
          </p>
        </div>
        <div className={`flex items-center gap-1.5 text-2xl font-bold ${net >= 0 ? 'text-success' : 'text-danger'}`}>
          <TrendingUp size={20} strokeWidth={2.5} className={net >= 0 ? '' : 'rotate-180'} />
          <Money value={net} />
        </div>
      </div>
    </div>
  );
}
