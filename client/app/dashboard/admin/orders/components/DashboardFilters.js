import PremiumSelect from '../../../../components/ui/PremiumSelect';
import UniversalDateFilter from '../../../../components/ui/UniversalDateFilter';
import { LayoutGrid, List, FilterX } from 'lucide-react';

export default function DashboardFilters({
  user,
  locations,
  branchFilter,
  setBranchFilter,
  statusFilter,
  setStatusFilter,
  typeFilter = '',
  setTypeFilter,
  dateRange,
  setDateRange,
  viewMode,
  setViewMode,
  resetFilters,
  loading,
  cafes = [],
  cafeFilter = 'all',
  setCafeFilter,
  staffMembers = [],
  staffFilter = '',
  setStaffFilter,
}) {
  // "Who placed it" filter — list the staff/chefs/branch-admins this operator manages.
  // Branch & cafe scope is controlled by the global Navbar filter, not here.
  const showStaffFilter = staffMembers.length > 0 && typeof setStaffFilter === 'function';
  return (
    <div className="bg-(--color-surface) p-2 rounded-xl border border-(--color-border) shadow-sm space-y-2">
      {showStaffFilter && (
        <div className="px-1">
          <PremiumSelect
            value={staffFilter}
            onChange={setStaffFilter}
            placeholder="All Staff Members"
            options={[
              { label: 'All Staff Members', value: '' },
              ...staffMembers.map((s) => ({ label: `${s.name} · ${String(s.role || '').replace('_', ' ')}`, value: s._id })),
            ]}
            className="h-11"
          />
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-center">
        {/* Status Selector */}
        <div className="lg:col-span-3 ">
          <PremiumSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { label: 'All Statuses', value: '' },
              { label: 'Placed', value: 'PLACED' },
              { label: 'Accepted', value: 'ACCEPTED' },
              { label: 'Preparing', value: 'PREPARING' },
              { label: 'Ready', value: 'READY' },
              { label: 'Served', value: 'SERVED' },
              { label: 'Cancelled', value: 'CANCELLED' }
            ]}
            className="h-11"
          />
        </div>

        {/* Order Type Selector — Dine-in / Takeaway / Delivery */}
        <div className="lg:col-span-3 ">
          <PremiumSelect
            value={typeFilter}
            onChange={setTypeFilter}
            options={[
              { label: 'All Types', value: '' },
              { label: 'Dine-in', value: 'dine-in' },
              { label: 'Takeaway', value: 'takeaway' },
              { label: 'Delivery', value: 'delivery' },
            ]}
            className="h-11"
          />
        </div>

        {/* Temporal Controller */}
        <div className="lg:col-span-3 flex items-center">
          <UniversalDateFilter
            onFilterChange={({ startDate, endDate }) => setDateRange({ start: startDate, end: endDate })}
            loading={loading}
            className="w-full"
          />
        </div>

        {/* View Toggle */}
        <div className="lg:col-span-2 bg-(--color-surface-soft) rounded-xl p-1.5 border border-(--color-border) flex items-center justify-center gap-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`flex-1 h-11 rounded-xl flex items-center justify-center transition-all ${viewMode === 'grid' ? 'bg-primary text-(--color-on-primary) shadow-lg shadow-primary/20' : 'text-(--color-text-muted) hover:text-primary'}`}
          >
            <LayoutGrid size={18} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`flex-1 h-11 rounded-xl flex items-center justify-center transition-all ${viewMode === 'list' ? 'bg-primary text-(--color-on-primary) shadow-lg shadow-primary/20' : 'text-(--color-text-muted) hover:text-primary'}`}
          >
            <List size={18} />
          </button>
        </div>

        {/* Reset */}
        <div className="lg:col-span-1">
          <button
            onClick={resetFilters}
            className="w-full h-14 bg-(--color-surface-soft) hover:bg-danger/10 hover:text-danger hover:border-danger/30 rounded-xl border border-(--color-border) text-(--color-text-muted) flex items-center justify-center transition-all group"
          >
            <FilterX size={20} className="group-hover:rotate-12 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}
