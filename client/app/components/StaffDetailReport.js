'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/app/services/api';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { progress } from '@/app/components/ui/TopProgressBar';
import {
  ArrowLeft,
  ArrowLeftRight,
  BadgeCheck,
  CalendarCheck,
  ClipboardList,
  CreditCard,
  Filter,
  FilterX,
  IndianRupee,
  Mail,
  MapPin,
  Phone,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
  Ticket,
  Trash2,
  User as UserIcon,
  Utensils,
  WalletCards,
} from 'lucide-react';
import PremiumSelect from './ui/PremiumSelect';
import useBranchScope from '../hooks/useBranchScope';
import { routeForPage } from '../config/routes';
import { Money } from '@/app/components/ui/Money';
import { formatIndianCompact } from '@/app/utils/formatNumber';

const ORDER_STATUSES = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED', 'REJECTED'];
const PAYMENT_TYPES = ['CASH', 'CARD', 'UPI', 'ONLINE', 'GIFT_CARD', 'OTHER'];
const ORDER_TYPES = ['dine-in', 'takeaway', 'delivery'];
const RESERVATION_STATUSES = ['pending', 'confirmed', 'cancelled', 'no-show'];
const EXPENSE_STATUSES = ['pending', 'approved', 'rejected', 'live', 'completed'];

const shortDateTime = (value) => (value ? new Date(value).toLocaleString() : '-');
const shortDate = (value) => (value ? new Date(value).toLocaleDateString() : '-');
const activityText = (entry) => {
  const details = entry?.details;
  if (typeof details === 'string') return details;
  if (details?.message) return details.message;
  if (details?.description) return details.description;
  return entry?.locationId?.name || 'System activity';
};

function Stat({ icon: Icon, label, value, sub, tone = 'primary' }) {
  // Static tone -> class map: a dynamic `text-${tone}` gets purged by Tailwind, so the
  // tone colors never render. This keeps the icon tint working.
  const tones = { primary: 'text-primary', warning: 'text-warning', danger: 'text-danger', success: 'text-success' };
  return (
    <div className="rounded-xl border border-(--color-border) bg-(--color-surface) p-5 min-h-30">
      <div className="flex items-center gap-2 text-(--color-text-muted)">
        <Icon size={14} className={tones[tone] || 'text-primary'} />
        <span className="text-[11px] font-medium uppercase tracking-normal">{label}</span>
      </div>
      <p className="text-2xl font-semibold text-(--color-text-primary) mt-2 break-words">{value}</p>
      {sub && <p className="text-[11px] text-(--color-text-muted) mt-1">{sub}</p>}
    </div>
  );
}

function Section({ icon: Icon, title, count, children }) {
  return (
    <div className="rounded-xl border border-(--color-border) bg-(--color-surface) overflow-hidden">
      <div className="px-5 py-4 border-b border-(--color-border) flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-normal text-(--color-text-muted) flex items-center gap-2">
          <Icon size={14} className="text-primary" />
          {title}
        </h3>
        {count !== undefined && (
          <span className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">
            {count}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function EmptyRow({ colSpan, text }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-10 px-5 text-center text-xs text-(--color-text-muted) italic">
        {text}
      </td>
    </tr>
  );
}

export default function StaffDetailReport({ staffId, user }) {
  const router = useRouter();
  const reportsHref = routeForPage(user?.role, 'page_staffreports');

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const didInitRef = useRef(false);
  const { singleBranchId } = useBranchScope();
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    status: '',
    paymentType: '',
    orderType: '',
    reservationStatus: '',
    expenseStatus: '',
    expenseType: '',
  });

  useEffect(() => {
    if (!staffId) return;

    let ignore = false;
    const load = async () => {
      const isInitial = !didInitRef.current;
      if (isInitial) setLoading(true);
      else setRefetching(true);
      progress.start();

      try {
        const params = {};
        Object.entries(filters).forEach(([key, value]) => {
          if (value) params[key] = value;
        });
        if (singleBranchId !== 'all') params.branch = singleBranchId;
        const res = await api.get(`/analytics/staff-reports/${staffId}`, { params });
        if (!ignore) setReport(res.data?.data || null);
      } catch (error) {
        if (!ignore) console.error(error.response?.data?.message || 'Could not load this staff report');
      } finally {
        if (!ignore) {
          didInitRef.current = true;
          setLoading(false);
          setRefetching(false);
          progress.done();
        }
      }
    };

    load();
    return () => { ignore = true; };
  }, [staffId, filters, singleBranchId]);

  const staff = report?.staff;
  const summary = report?.summary || {};
  const orders = report?.orders || [];
  const coupons = report?.coupons || [];
  const reservations = report?.reservations || [];
  const attendance = report?.attendance || [];
  const expenses = report?.expenses || [];
  const cashSessions = report?.cashSessions || [];
  const transactions = report?.transactions || [];
  const waste = report?.waste || [];
  const activity = report?.activity || [];

  const hasFilters = Object.values(filters).some(Boolean);

  const branchName = useMemo(() => {
    if (staff?.assignedLocation?.name) return `${staff.assignedLocation.city || ''}${staff.assignedLocation.city ? ' - ' : ''}${staff.assignedLocation.name}`;
    if (Array.isArray(staff?.accessibleLocations) && staff.accessibleLocations.length) {
      return `${staff.accessibleLocations.length} branches`;
    }
    return 'Not assigned';
  }, [staff]);

  const resetFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      status: '',
      paymentType: '',
      orderType: '',
      reservationStatus: '',
      expenseStatus: '',
      expenseType: '',
    });
  };

  const inputCls = 'w-full px-4 py-2.5 rounded-xl border border-(--color-border) bg-(--color-surface) text-sm font-medium text-(--color-text-primary) outline-none focus:border-primary';

  if (loading) return <LoadingScreen fullScreen={false} />;

  return (
    <div className="max-w-400 mx-auto pb-10 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={() => router.push(reportsHref)}
            className="p-2.5 rounded-xl border border-(--color-border) bg-(--color-surface) text-(--color-text-muted) hover:text-primary transition-all shrink-0"
            title="Back to staff reports"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-semibold text-lg overflow-hidden shrink-0">
            {staff?.profileImageUrl ? <img src={staff.profileImageUrl} alt={staff.name} className="h-full w-full object-cover" /> : (staff?.name?.charAt(0) || '?')}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-(--color-text-primary) tracking-tight truncate">
              {staff?.name || 'Staff Member'} Report
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-[11px] font-medium text-(--color-text-muted)">
              {staff?.role && <span className="inline-flex items-center gap-1 uppercase tracking-wide"><ShieldCheck size={12} /> {String(staff.role).replace('_', ' ')}</span>}
              <span className="inline-flex items-center gap-1"><MapPin size={12} /> {branchName}</span>
              {staff?.phone && <span className="inline-flex items-center gap-1"><Phone size={12} /> {staff.phone}</span>}
              {staff?.email && <span className="inline-flex items-center gap-1 truncate"><Mail size={12} /> {staff.email}</span>}
            </div>
          </div>
        </div>
        {refetching && (
          <span className="text-[11px] font-medium uppercase tracking-normal text-primary">
            Refreshing report...
          </span>
        )}
      </div>

      <div className="rounded-xl border border-(--color-border) bg-(--color-surface) p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-(--color-text-muted)">
            <Filter size={14} className="text-primary" />
            <span className="text-[11px] font-medium uppercase tracking-normal">Filter this staff report</span>
          </div>
          {hasFilters && (
            <button
              onClick={resetFilters}
              className="px-3 py-2 rounded-xl border border-(--color-border) text-(--color-text-muted) hover:text-danger hover:border-danger/40 text-[11px] font-medium uppercase inline-flex items-center gap-2"
            >
              <FilterX size={13} /> Clear
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="label block mb-1.5 ml-0.5">Date Range</label>
            <div className="flex items-center gap-2">
              <input type="date" className={`${inputCls} flex-1 min-w-0 h-11`} value={filters.startDate} onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))} />
              <span className="text-(--color-text-muted) text-xs shrink-0">–</span>
              <input type="date" className={`${inputCls} flex-1 min-w-0 h-11`} value={filters.endDate} onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label block mb-1.5 ml-0.5">Order Status</label>
            <PremiumSelect
              className="h-11"
              value={filters.status}
              onChange={(value) => setFilters((f) => ({ ...f, status: value }))}
              options={[{ label: 'All Order Statuses', value: '' }, ...ORDER_STATUSES.map((status) => ({ label: status, value: status }))]}
            />
          </div>
          <div>
            <label className="label block mb-1.5 ml-0.5">Payment</label>
            <PremiumSelect
              className="h-11"
              value={filters.paymentType}
              onChange={(value) => setFilters((f) => ({ ...f, paymentType: value }))}
              options={[{ label: 'All Payments', value: '' }, ...PAYMENT_TYPES.map((type) => ({ label: type, value: type }))]}
            />
          </div>
          <div>
            <label className="label block mb-1.5 ml-0.5">Order Type</label>
            <PremiumSelect
              className="h-11"
              value={filters.orderType}
              onChange={(value) => setFilters((f) => ({ ...f, orderType: value }))}
              options={[{ label: 'All Order Types', value: '' }, ...ORDER_TYPES.map((type) => ({ label: type, value: type }))]}
            />
          </div>
          <div>
            <label className="label block mb-1.5 ml-0.5">Reservation</label>
            <PremiumSelect
              className="h-11"
              value={filters.reservationStatus}
              onChange={(value) => setFilters((f) => ({ ...f, reservationStatus: value }))}
              options={[{ label: 'All Reservations', value: '' }, ...RESERVATION_STATUSES.map((status) => ({ label: status, value: status }))]}
            />
          </div>
          <div>
            <label className="label block mb-1.5 ml-0.5">Expense</label>
            <PremiumSelect
              className="h-11"
              value={filters.expenseStatus}
              onChange={(value) => setFilters((f) => ({ ...f, expenseStatus: value }))}
              options={[{ label: 'All Expenses', value: '' }, ...EXPENSE_STATUSES.map((status) => ({ label: status, value: status }))]}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat icon={ShoppingBag} label="Orders Touched" value={summary.orders || 0} sub={`${summary.completedOrders || 0} completed`} />
        <Stat icon={IndianRupee} label="Sales" value={<Money value={summary.totalSales} />} sub={`Avg ${formatIndianCompact(summary.averageOrderValue, { currency: true })}`} />
        <Stat icon={Ticket} label="Coupons Used" value={summary.couponsUsed || 0} sub={`${formatIndianCompact(summary.totalDiscount, { currency: true })} discount`} tone="warning" />
        <Stat icon={CalendarCheck} label="Reservations" value={summary.reservations || 0} sub={`${formatIndianCompact(summary.reservationAdvance, { currency: true })} advance`} />
        <Stat icon={BadgeCheck} label="Attendance" value={`${summary.attendance?.present || 0} present`} sub={`${summary.attendance?.halfDay || 0} half-day, ${summary.attendance?.absent || 0} absent`} />
        <Stat icon={ReceiptText} label="Expenses" value={summary.expenses?.count || 0} sub={<Money value={summary.expenses?.total} />} />
        <Stat icon={ArrowLeftRight} label="Ledger Entries" value={summary.transactions?.count || 0} sub={`${formatIndianCompact(summary.transactions?.revenue, { currency: true })} in / ${formatIndianCompact(summary.transactions?.expense, { currency: true })} out`} />
        <Stat icon={Trash2} label="Waste Logged" value={summary.waste?.count || 0} sub={`${Math.round((summary.waste?.quantity || 0) * 100) / 100} units`} tone="danger" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Section icon={UserIcon} title="Role Breakdown">
          <div className="p-5 grid grid-cols-2 gap-3">
            {Object.entries(summary.orderRoleCounts || {}).map(([role, count]) => (
              <div key={role} className="rounded-lg bg-(--color-surface-soft)/60 p-3">
                <p className="text-[11px] font-medium uppercase text-(--color-text-muted)">{role}</p>
                <p className="text-xl font-semibold text-(--color-text-primary)">{count}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section icon={CreditCard} title="Payment Mix">
          <div className="p-5 space-y-2">
            {Object.entries(summary.paymentBreakdown || {}).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between text-xs">
                <span className="font-medium text-(--color-text-secondary)">{type}</span>
                <span className="font-medium text-(--color-text-primary)">{count}</span>
              </div>
            ))}
            {Object.keys(summary.paymentBreakdown || {}).length === 0 && <p className="text-xs text-(--color-text-muted) italic">No payment data.</p>}
          </div>
        </Section>

        <Section icon={Utensils} title="Top Items">
          <div className="p-5 space-y-2">
            {(summary.topItems || []).slice(0, 5).map((item) => (
              <div key={item.name} className="flex items-center justify-between gap-3 text-xs">
                <span className="font-medium text-(--color-text-secondary) truncate">{item.name}</span>
                <span className="font-medium text-(--color-text-primary)">x{item.quantity}</span>
              </div>
            ))}
            {(summary.topItems || []).length === 0 && <p className="text-xs text-(--color-text-muted) italic">No item data.</p>}
          </div>
        </Section>
      </div>

      <Section icon={Ticket} title="Coupons Used" count={coupons.length}>
        <div className="p-5 flex flex-wrap gap-2">
          {coupons.map((coupon) => (
            <div key={coupon.code} className="px-3 py-2 rounded-xl bg-warning/10 border border-warning/20 text-[11px] font-medium text-warning">
              {coupon.code} <span className="opacity-70">x{coupon.count}</span>
              {coupon.discount > 0 && <span className="text-(--color-text-muted) ml-1">(<Money value={coupon.discount} />)</span>}
            </div>
          ))}
          {coupons.length === 0 && <p className="text-xs text-(--color-text-muted) italic">No coupons or manual discounts in this filter.</p>}
        </div>
      </Section>

      <Section icon={ShoppingBag} title="Previous Orders" count={orders.length}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-(--color-border) bg-(--color-surface-soft)/40 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">
                <th className="py-3 px-5">Order</th>
                <th className="py-3 px-5">Date / Time</th>
                <th className="py-3 px-5">Involvement</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5">Items</th>
                <th className="py-3 px-5">Coupon</th>
                <th className="py-3 px-5">Payment</th>
                <th className="py-3 px-5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-(--color-border)/50">
              {orders.map((order) => (
                <tr key={order._id} className="hover:bg-(--color-surface-soft)/30">
                  <td className="py-3 px-5 text-[11px] font-medium text-primary">#{order.shortId}</td>
                  <td className="py-3 px-5 text-[11px] text-(--color-text-secondary)">{shortDateTime(order.createdAt)}</td>
                  <td className="py-3 px-5 text-[11px] text-(--color-text-muted)">{(order.involvedAs || []).join(', ') || '-'}</td>
                  <td className="py-3 px-5 text-[11px] font-medium uppercase">{order.status}</td>
                  <td className="py-3 px-5 text-[11px] text-(--color-text-muted) max-w-80 truncate">
                    {(order.items || []).map((item) => `${item.quantity}x ${item.menuItem?.name || item.itemName || 'Item'}`).join(', ')}
                  </td>
                  <td className="py-3 px-5 text-[11px] font-medium text-warning">{order.coupon?.code || (Number(order.discountAmount) > 0 ? <Money value={order.discountAmount} /> : '-')}</td>
                  <td className="py-3 px-5 text-[11px] text-(--color-text-muted)">{order.paymentType || '-'}</td>
                  <td className="py-3 px-5 text-right text-sm font-semibold text-(--color-text-primary)"><Money value={order.grandTotal ?? order.totalAmount} /></td>
                </tr>
              ))}
              {orders.length === 0 && <EmptyRow colSpan={8} text="No orders found for this staff member in the selected filters." />}
            </tbody>
          </table>
        </div>
      </Section>

      <Section icon={CalendarCheck} title="Reservations" count={reservations.length}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-(--color-border) bg-(--color-surface-soft)/40 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">
                <th className="py-3 px-5">Event</th>
                <th className="py-3 px-5">Customer</th>
                <th className="py-3 px-5">Date</th>
                <th className="py-3 px-5">Time</th>
                <th className="py-3 px-5">Branch</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-(--color-border)/50">
              {reservations.map((reservation) => (
                <tr key={reservation._id} className="hover:bg-(--color-surface-soft)/30">
                  <td className="py-3 px-5 text-[11px] font-medium text-(--color-text-primary)">{reservation.eventName || '-'}</td>
                  <td className="py-3 px-5 text-[11px] text-(--color-text-secondary)">{reservation.customerName || '-'}</td>
                  <td className="py-3 px-5 text-[11px] text-(--color-text-muted)">{shortDate(reservation.date)}</td>
                  <td className="py-3 px-5 text-[11px] text-(--color-text-muted)">{reservation.startTime}{reservation.endTime ? `-${reservation.endTime}` : ''}</td>
                  <td className="py-3 px-5 text-[11px] text-(--color-text-muted)">{reservation.locationId?.name || '-'}</td>
                  <td className="py-3 px-5 text-[11px] font-medium uppercase">{reservation.status}</td>
                  <td className="py-3 px-5 text-right text-sm font-semibold text-(--color-text-primary)"><Money value={reservation.totalAmount} /></td>
                </tr>
              ))}
              {reservations.length === 0 && <EmptyRow colSpan={7} text="No reservations created by this staff member in the selected filters." />}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Section icon={BadgeCheck} title="Attendance" count={attendance.length}>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-(--color-border) bg-(--color-surface-soft)/40 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">
                  <th className="py-3 px-5">Date</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5">Check In</th>
                  <th className="py-3 px-5">Check Out</th>
                  <th className="py-3 px-5">Branch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--color-border)/50">
                {attendance.map((record) => (
                  <tr key={record._id} className="hover:bg-(--color-surface-soft)/30">
                    <td className="py-3 px-5 text-[11px] font-medium text-(--color-text-primary)">{record.date}</td>
                    <td className="py-3 px-5 text-[11px] font-medium uppercase">{record.status}</td>
                    <td className="py-3 px-5 text-[11px] text-(--color-text-muted)">{record.checkIn ? shortDateTime(record.checkIn) : '-'}</td>
                    <td className="py-3 px-5 text-[11px] text-(--color-text-muted)">{record.checkOut ? shortDateTime(record.checkOut) : '-'}</td>
                    <td className="py-3 px-5 text-[11px] text-(--color-text-muted)">{record.locationId?.name || '-'}</td>
                  </tr>
                ))}
                {attendance.length === 0 && <EmptyRow colSpan={5} text="No attendance records in the selected filters." />}
              </tbody>
            </table>
          </div>
        </Section>

        <Section icon={ReceiptText} title="Expenses / Income Created" count={expenses.length}>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-(--color-border) bg-(--color-surface-soft)/40 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">
                  <th className="py-3 px-5">Title</th>
                  <th className="py-3 px-5">Date</th>
                  <th className="py-3 px-5">Type</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--color-border)/50">
                {expenses.map((expense) => (
                  <tr key={expense._id} className="hover:bg-(--color-surface-soft)/30">
                    <td className="py-3 px-5 text-[11px] font-medium text-(--color-text-primary) max-w-70 truncate">{expense.title}</td>
                    <td className="py-3 px-5 text-[11px] text-(--color-text-muted)">{shortDate(expense.date)}</td>
                    <td className="py-3 px-5 text-[11px] font-medium uppercase">{expense.type}</td>
                    <td className="py-3 px-5 text-[11px] font-medium uppercase">{expense.status}</td>
                    <td className="py-3 px-5 text-right text-sm font-semibold text-(--color-text-primary)"><Money value={expense.amount} /></td>
                  </tr>
                ))}
                {expenses.length === 0 && <EmptyRow colSpan={5} text="No expenses or income records created by this staff member." />}
              </tbody>
            </table>
          </div>
        </Section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Section icon={WalletCards} title="Cash Drawer Activity" count={cashSessions.length}>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-(--color-border) bg-(--color-surface-soft)/40 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">
                  <th className="py-3 px-5">Opened</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5">Branch</th>
                  <th className="py-3 px-5 text-right">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--color-border)/50">
                {cashSessions.map((session) => (
                  <tr key={session._id} className="hover:bg-(--color-surface-soft)/30">
                    <td className="py-3 px-5 text-[11px] text-(--color-text-secondary)">{shortDateTime(session.openedAt)}</td>
                    <td className="py-3 px-5 text-[11px] font-medium uppercase">{session.status}</td>
                    <td className="py-3 px-5 text-[11px] text-(--color-text-muted)">{session.locationId?.name || '-'}</td>
                    <td className="py-3 px-5 text-right text-sm font-semibold text-(--color-text-primary)"><Money value={session.variance} /></td>
                  </tr>
                ))}
                {cashSessions.length === 0 && <EmptyRow colSpan={4} text="No cash drawer activity for this staff member." />}
              </tbody>
            </table>
          </div>
        </Section>

        <Section icon={ClipboardList} title="Recent Activity" count={activity.length}>
          <div className="divide-y divide-(--color-border)/50">
            {activity.slice(0, 8).map((entry) => (
              <div key={entry._id} className="p-4 hover:bg-(--color-surface-soft)/30">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-(--color-text-primary) uppercase truncate">{entry.action}</p>
                    <p className="text-[11px] text-(--color-text-muted) mt-1 truncate">{activityText(entry)}</p>
                  </div>
                  <span className="text-[11px] font-medium text-(--color-text-muted) shrink-0">{shortDate(entry.timestamp)}</span>
                </div>
              </div>
            ))}
            {activity.length === 0 && <p className="p-6 text-center text-xs text-(--color-text-muted) italic">No recent audit activity for this staff member.</p>}
          </div>
        </Section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Section icon={ArrowLeftRight} title="Ledger / Transactions" count={transactions.length}>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-(--color-border) bg-(--color-surface-soft)/40 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">
                  <th className="py-3 px-5">Title</th>
                  <th className="py-3 px-5">Date</th>
                  <th className="py-3 px-5">Type</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--color-border)/50">
                {transactions.map((txn) => (
                  <tr key={txn._id} className="hover:bg-(--color-surface-soft)/30">
                    <td className="py-3 px-5 text-[11px] font-medium text-(--color-text-primary) max-w-70 truncate">{txn.title || txn.category || txn.description || '-'}</td>
                    <td className="py-3 px-5 text-[11px] text-(--color-text-muted)">{shortDate(txn.date)}</td>
                    <td className="py-3 px-5 text-[11px] font-medium uppercase">{String(txn.type || '-').replace(/_/g, ' ')}</td>
                    <td className="py-3 px-5 text-[11px] font-medium uppercase">{txn.status}</td>
                    <td className="py-3 px-5 text-right text-sm font-semibold text-(--color-text-primary)"><Money value={txn.totalAmount} /></td>
                  </tr>
                ))}
                {transactions.length === 0 && <EmptyRow colSpan={5} text="No ledger entries recorded by this staff member." />}
              </tbody>
            </table>
          </div>
        </Section>

        <Section icon={Trash2} title="Waste Logged" count={waste.length}>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-(--color-border) bg-(--color-surface-soft)/40 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">
                  <th className="py-3 px-5">Ingredient</th>
                  <th className="py-3 px-5 text-right">Qty</th>
                  <th className="py-3 px-5">Reason</th>
                  <th className="py-3 px-5">Date</th>
                  <th className="py-3 px-5">Branch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--color-border)/50">
                {waste.map((record) => (
                  <tr key={record._id} className="hover:bg-(--color-surface-soft)/30">
                    <td className="py-3 px-5 text-[11px] font-medium text-(--color-text-primary)">{record.ingredient?.name || '-'}</td>
                    <td className="py-3 px-5 text-right text-[11px] font-medium text-(--color-text-primary)">{record.quantity}{record.ingredient?.unit ? ` ${record.ingredient.unit}` : ''}</td>
                    <td className="py-3 px-5 text-[11px] font-medium uppercase">{record.reason || '-'}</td>
                    <td className="py-3 px-5 text-[11px] text-(--color-text-muted)">{shortDate(record.date)}</td>
                    <td className="py-3 px-5 text-[11px] text-(--color-text-muted)">{record.branch?.name || '-'}</td>
                  </tr>
                ))}
                {waste.length === 0 && <EmptyRow colSpan={5} text="No waste logged by this staff member in the selected filters." />}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </div>
  );
}
