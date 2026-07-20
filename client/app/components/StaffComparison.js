'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '../services/api';
import { progress } from '@/app/components/ui/TopProgressBar';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import {
  ArrowLeft, ArrowLeftRight, Users, ShieldCheck, MapPin, Trophy, Minus,
} from 'lucide-react';
import PremiumSelect from './ui/PremiumSelect';
import useBranchScope from '../hooks/useBranchScope';
import { routeForPage } from '../config/routes';
import { formatIndianCompact } from '@/app/utils/formatNumber';

const inr = (n) => formatIndianCompact(n, { currency: true });
const num = (n) => (Number(n) || 0).toLocaleString('en-IN');

// Metric groups compared side-by-side. `better`: 'high' = bigger wins,
// 'low' = smaller wins, null = informational (no winner).
const GROUPS = [
  {
    title: 'Sales & Orders',
    rows: [
      { label: 'Total Sales', get: (s) => s.totalSales, fmt: inr, better: 'high' },
      { label: 'Orders Touched', get: (s) => s.orders, fmt: num, better: 'high' },
      { label: 'Completed Orders', get: (s) => s.completedOrders, fmt: num, better: 'high' },
      { label: 'Cancelled Orders', get: (s) => s.cancelledOrders, fmt: num, better: 'low' },
      { label: 'Avg Order Value', get: (s) => s.averageOrderValue, fmt: inr, better: 'high' },
    ],
  },
  {
    title: 'Profit & Coupons',
    rows: [
      { label: 'Estimated Profit', get: (s) => s.estimatedProfit, fmt: inr, better: 'high' },
      { label: 'Coupons Used', get: (s) => s.couponsUsed, fmt: num, better: null },
      { label: 'Discount Given', get: (s) => s.totalDiscount, fmt: inr, better: null },
    ],
  },
  {
    title: 'Attendance',
    rows: [
      { label: 'Present (days)', get: (s) => s.attendance?.present, fmt: num, better: 'high' },
      { label: 'Half-days', get: (s) => s.attendance?.halfDay, fmt: num, better: 'low' },
      { label: 'Absent (days)', get: (s) => s.attendance?.absent, fmt: num, better: 'low' },
      { label: 'Worked Hours', get: (s) => Math.round((s.attendance?.workedMinutes || 0) / 60), fmt: num, better: 'high' },
    ],
  },
  {
    title: 'Salary & Expenses',
    rows: [
      // monthlySalary lives on the staff object, the rest on summary — handled below.
      { label: 'Monthly Salary', get: (s) => s.monthlySalary, fmt: inr, better: null },
      { label: 'Expenses Created', get: (s) => s.expenses?.count, fmt: num, better: null },
      { label: 'Expense Total', get: (s) => s.expenses?.total, fmt: inr, better: null },
    ],
  },
];

// Merge the fields a row may read (summary + a couple of staff fields) into one
// flat object so getters work whether the value is on summary or staff.
const flatten = (report) => ({
  ...(report?.summary || {}),
  monthlySalary: report?.staff?.monthlySalary || 0,
});

function StaffPickCard({ side, report, placeholder }) {
  const staff = report?.staff;
  if (!staff) {
    return (
      <div className="rounded-xl border border-dashed border-(--color-border) bg-(--color-surface-soft)/40 p-5 text-center">
        <p className="text-[11px] font-medium text-(--color-text-muted)">{placeholder}</p>
      </div>
    );
  }
  const branch = staff.assignedLocation?.name
    ? `${staff.assignedLocation.city ? staff.assignedLocation.city + ' - ' : ''}${staff.assignedLocation.name}`
    : (Array.isArray(staff.accessibleLocations) && staff.accessibleLocations.length ? `${staff.accessibleLocations.length} branches` : 'Not assigned');
  // Static class strings (Tailwind JIT can't see interpolated class names).
  const isA = side === 'a';
  const wrapCls = isA ? 'border-primary/20 bg-primary/5' : 'border-secondary/20 bg-secondary/5';
  const avatarCls = isA ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-secondary/10 border-secondary/20 text-secondary';
  return (
    <div className={`rounded-xl border ${wrapCls} p-5`}>
      <div className="flex items-center gap-3">
        <div className={`h-12 w-12 rounded-xl border ${avatarCls} flex items-center justify-center font-semibold text-lg overflow-hidden shrink-0`}>
          {staff.profileImageUrl ? <img src={staff.profileImageUrl} alt={staff.name} className="h-full w-full object-cover" /> : (staff.name?.charAt(0) || '?')}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-(--color-text-primary) truncate">{staff.name}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-[10px] font-medium text-(--color-text-muted)">
            <span className="inline-flex items-center gap-1 uppercase tracking-wide"><ShieldCheck size={11} /> {String(staff.role || '').replace('_', ' ')}</span>
            <span className="inline-flex items-center gap-1"><MapPin size={11} /> {branch}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CompareRow({ label, aVal, bVal, fmt, better }) {
  const a = Number(aVal) || 0;
  const b = Number(bVal) || 0;
  let aWin = false, bWin = false;
  if (better === 'high') { aWin = a > b; bWin = b > a; }
  else if (better === 'low') { aWin = a < b && a >= 0; bWin = b < a && b >= 0; }
  const total = Math.abs(a) + Math.abs(b);
  const aPct = total > 0 ? (Math.abs(a) / total) * 100 : 50;
  const bPct = 100 - aPct;
  const valCls = (win, isWinnable) => `text-sm font-semibold ${win ? 'text-success' : isWinnable ? 'text-(--color-text-muted)' : 'text-(--color-text-primary)'}`;
  const winnable = better === 'high' || better === 'low';
  return (
    <div className="py-3 border-b border-(--color-border)/60 last:border-0">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="flex items-center justify-start gap-2">
          {aWin && <Trophy size={12} className="text-success shrink-0" />}
          <span className={valCls(aWin, winnable)}>{fmt(a)}</span>
        </div>
        <span className="text-[11px] font-medium text-(--color-text-muted) text-center px-2">{label}</span>
        <div className="flex items-center justify-end gap-2">
          <span className={valCls(bWin, winnable)}>{fmt(b)}</span>
          {bWin && <Trophy size={12} className="text-success shrink-0" />}
        </div>
      </div>
      <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-(--color-surface-soft)">
        <div className="bg-primary/70" style={{ width: `${aPct}%` }} />
        <div className="bg-secondary/70" style={{ width: `${bPct}%` }} />
      </div>
    </div>
  );
}

export default function StaffComparison({ user }) {
  const router = useRouter();
  const reportsHref = routeForPage(user?.role, 'page_staffreports');
  const { singleBranchId } = useBranchScope();

  const [staffList, setStaffList] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState('');
  const [range, setRange] = useState({ startDate: '', endDate: '' });
  const [leftReport, setLeftReport] = useState(null);
  const [rightReport, setRightReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const didInit = useRef(false);

  // Staff list (already scoped to the viewer's role/branch by the API) populates
  // both selectors. Reuses the staff-reports list — no extra endpoint.
  useEffect(() => {
    const load = async () => {
      if (!didInit.current) setListLoading(true);
      try {
        const params = {};
        if (singleBranchId && singleBranchId !== 'all') params.branch = singleBranchId;
        const res = await api.get('/analytics/staff-reports', { params });
        setStaffList(res.data?.data || []);
      } catch (e) {
        console.error('Failed to load staff list');
      } finally {
        didInit.current = true;
        setListLoading(false);
      }
    };
    load();
  }, [singleBranchId]);

  // Fetch both staff's full reports whenever the pair or date range changes.
  useEffect(() => {
    if (!leftId || !rightId) { setLeftReport(null); setRightReport(null); return; }
    let ignore = false;
    const load = async () => {
      setReportLoading(true);
      progress.start();
      try {
        const params = {};
        if (range.startDate) params.startDate = range.startDate;
        if (range.endDate) params.endDate = range.endDate;
        if (singleBranchId && singleBranchId !== 'all') params.branch = singleBranchId;
        const [l, r] = await Promise.all([
          api.get(`/analytics/staff-reports/${leftId}`, { params }),
          api.get(`/analytics/staff-reports/${rightId}`, { params }),
        ]);
        if (!ignore) {
          setLeftReport(l.data?.data || null);
          setRightReport(r.data?.data || null);
        }
      } catch (e) {
        if (!ignore) console.error(e.response?.data?.message || 'Could not load the comparison');
      } finally {
        if (!ignore) { setReportLoading(false); progress.done(); }
      }
    };
    load();
    return () => { ignore = true; };
  }, [leftId, rightId, range, singleBranchId]);

  const options = useMemo(
    () => staffList.map((s) => ({
      value: s._id,
      label: `${s.name}${s.role ? ` · ${String(s.role).replace('_', ' ')}` : ''}`,
    })),
    [staffList],
  );
  const leftOptions = useMemo(() => [{ label: 'Select staff…', value: '' }, ...options.filter((o) => o.value !== rightId)], [options, rightId]);
  const rightOptions = useMemo(() => [{ label: 'Select staff…', value: '' }, ...options.filter((o) => o.value !== leftId)], [options, leftId]);

  const swap = () => { setLeftId(rightId); setRightId(leftId); };

  const a = useMemo(() => flatten(leftReport), [leftReport]);
  const b = useMemo(() => flatten(rightReport), [rightReport]);

  // Tally decisive wins (only rows with a winnable metric) for the headline.
  const tally = useMemo(() => {
    if (!leftReport || !rightReport) return { a: 0, b: 0 };
    let aw = 0, bw = 0;
    GROUPS.forEach((g) => g.rows.forEach((row) => {
      if (row.better !== 'high' && row.better !== 'low') return;
      const av = Number(row.get(a)) || 0;
      const bv = Number(row.get(b)) || 0;
      if (av === bv) return;
      const aBetter = row.better === 'high' ? av > bv : av < bv;
      if (aBetter) aw += 1; else bw += 1;
    }));
    return { a: aw, b: bw };
  }, [leftReport, rightReport, a, b]);

  if (listLoading) return <LoadingScreen fullScreen={false} />;

  const bothSelected = leftId && rightId && leftReport && rightReport;

  return (
    <div className="max-w-360 mx-auto pb-10 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push(reportsHref)}
            className="p-2.5 rounded-xl border border-(--color-border) bg-(--color-surface) text-(--color-text-muted) hover:text-primary transition-all shrink-0"
            title="Back to staff reports"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-(--color-text-primary) tracking-tight flex items-center gap-2.5">
              <div className="h-6 w-6 rounded-lg bg-primary flex items-center justify-center">
                <Users size={16} className="text-(--color-on-primary)" />
              </div>
              Staff Comparison
            </h1>
            <p className="text-xs text-(--color-text-secondary) mt-1 font-medium ml-8.5">Compare two team members side-by-side on sales, profit, attendance and more.</p>
          </div>
        </div>
      </div>

      {/* Selectors */}
      <div className="rounded-xl border border-(--color-border) bg-(--color-surface) p-4">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr_1fr_1fr] gap-3 items-end">
          <PremiumSelect label="Staff A" value={leftId} onChange={setLeftId} options={leftOptions} />
          <div className="flex justify-center pb-1">
            <button
              onClick={swap}
              disabled={!leftId || !rightId}
              className="p-3 rounded-xl border border-(--color-border) text-(--color-text-muted) hover:text-primary hover:border-primary/40 transition-all disabled:opacity-30"
              title="Swap"
            >
              <ArrowLeftRight size={16} />
            </button>
          </div>
          <PremiumSelect label="Staff B" value={rightId} onChange={setRightId} options={rightOptions} />
          <div>
            <label className="text-[11px] font-medium text-(--color-text-muted) ml-1">From</label>
            <input type="date" value={range.startDate} onChange={(e) => setRange((r) => ({ ...r, startDate: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl border border-(--color-border) bg-(--color-surface) text-sm font-medium text-(--color-text-primary) outline-none focus:border-primary" />
          </div>
          <div>
            <label className="text-[11px] font-medium text-(--color-text-muted) ml-1">To</label>
            <input type="date" value={range.endDate} onChange={(e) => setRange((r) => ({ ...r, endDate: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl border border-(--color-border) bg-(--color-surface) text-sm font-medium text-(--color-text-primary) outline-none focus:border-primary" />
          </div>
        </div>
      </div>

      {!leftId || !rightId ? (
        <div className="rounded-xl border border-dashed border-(--color-border) bg-(--color-surface-soft)/40 py-12 text-center">
          <Users size={40} className="mx-auto text-(--color-text-muted) mb-4" />
          <p className="text-sm font-medium text-(--color-text-muted)">Select two staff members to compare.</p>
        </div>
      ) : reportLoading && !bothSelected ? (
        <LoadingScreen fullScreen={false} />
      ) : bothSelected ? (
        <div className="space-y-6">
          {/* Staff cards + headline */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4 items-center">
            <StaffPickCard side="a" report={leftReport} placeholder="Staff A" />
            <div className="flex flex-col items-center justify-center px-2">
              <span className="text-[11px] font-medium text-(--color-text-muted)">Wins</span>
              <div className="flex items-center gap-2 text-lg font-semibold">
                <span className={tally.a > tally.b ? 'text-success' : 'text-(--color-text-muted)'}>{tally.a}</span>
                <Minus size={14} className="text-(--color-text-muted) rotate-90" />
                <span className={tally.b > tally.a ? 'text-success' : 'text-(--color-text-muted)'}>{tally.b}</span>
              </div>
            </div>
            <StaffPickCard side="b" report={rightReport} placeholder="Staff B" />
          </div>

          {/* Metric groups */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {GROUPS.map((g) => (
              <div key={g.title} className="rounded-xl border border-(--color-border) bg-(--color-surface) overflow-hidden">
                <div className="px-5 py-3 border-b border-(--color-border) bg-(--color-surface-soft)/40">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-(--color-text-primary)">{g.title}</h3>
                </div>
                <div className="px-5 py-1">
                  {g.rows.map((row) => (
                    <CompareRow
                      key={row.label}
                      label={row.label}
                      aVal={row.get(a)}
                      bVal={row.get(b)}
                      fmt={row.fmt}
                      better={row.better}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-(--color-text-muted) text-center">
            Bar shows each metric&apos;s share between the two. Trophy marks the better value where higher/lower clearly wins; salary, coupons and discounts are shown for context only.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-(--color-border) py-12 text-center">
          <p className="text-sm font-medium text-(--color-text-muted)">No data for this comparison.</p>
        </div>
      )}
    </div>
  );
}
