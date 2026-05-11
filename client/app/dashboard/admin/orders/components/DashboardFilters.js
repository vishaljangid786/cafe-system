import PremiumSelect from '../../../components/ui/PremiumSelect';
import UniversalDateFilter from '../../../components/ui/UniversalDateFilter';
import { Globe, LayoutGrid, List, FilterX } from 'lucide-react';

export default function DashboardFilters({ 
  user, 
  locations, 
  branchFilter, 
  setBranchFilter, 
  statusFilter, 
  setStatusFilter, 
  dateRange, 
  setDateRange, 
  viewMode, 
  setViewMode, 
  resetFilters, 
  loading 
}) {
  return (
    <div className="bg-[var(--color-surface)] p-2 rounded-[3.5rem] border border-[var(--color-border)] shadow-2xl space-y-2">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
        {/* Sector Selector */}
        <div className="lg:col-span-3 ">
          {user?.role === 'branch_admin' ? (
            <div className="h-11 w-full flex items-center px-6 text-[var(--color-primary)] gap-3 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-primary)]/20 shadow-inner">
              <Globe size={16} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">{locations.find(l => l._id === branchFilter)?.name || 'Restricted Session'}</span>
            </div>
          ) : (
            <PremiumSelect
              value={branchFilter}
              onChange={setBranchFilter}
              options={[
                { label: 'Global Monitor', value: 'all' },
                ...locations.map(loc => ({ label: loc.name, value: loc._id }))
              ]}
              className="h-11"
            />
          )}
        </div>

        {/* Status Selector */}
        <div className="lg:col-span-2 ">
          <PremiumSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { label: 'All Types', value: '' },
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

        {/* Temporal Controller */}
        <div className="lg:col-span-4 flex items-center">
          <UniversalDateFilter
            onFilterChange={({ startDate, endDate }) => setDateRange({ start: startDate, end: endDate })}
            loading={loading}
            className="w-full"
          />
        </div>

        {/* View Toggle */}
        <div className="lg:col-span-2 bg-[var(--color-surface-soft)] rounded-[2.5rem] p-1.5 border border-[var(--color-border)] flex items-center justify-center gap-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`flex-1 h-11 rounded-2xl flex items-center justify-center transition-all ${viewMode === 'grid' ? 'bg-primary text-black shadow-lg shadow-primary/20' : 'text-[var(--color-text-muted)] hover:text-primary'}`}
          >
            <LayoutGrid size={18} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`flex-1 h-11 rounded-2xl flex items-center justify-center transition-all ${viewMode === 'list' ? 'bg-primary text-black shadow-lg shadow-primary/20' : 'text-[var(--color-text-muted)] hover:text-primary'}`}
          >
            <List size={18} />
          </button>
        </div>

        {/* Reset */}
        <div className="lg:col-span-1">
          <button
            onClick={resetFilters}
            className="w-full h-14 bg-[var(--color-surface-soft)] hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/30 rounded-2xl border border-[var(--color-border)] text-[var(--color-text-muted)] flex items-center justify-center transition-all group"
          >
            <FilterX size={20} className="group-hover:rotate-12 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}
