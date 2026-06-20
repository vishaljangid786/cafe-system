'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, Filter, ChevronRight, Loader2 } from 'lucide-react';
import PremiumSelect from './PremiumSelect';
import { motion, AnimatePresence } from 'framer-motion';

export default function UniversalDateFilter({
  onFilterChange,
  loading = false,
  className = ""
}) {
  const [filterType, setFilterType] = useState('all');
  const [selectedSubValue, setSelectedSubValue] = useState('');
  const [customDates, setCustomDates] = useState({ start: '', end: '' });

  // Format date to YYYY-MM-DD in local time
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Generate Past Weeks (Last 4 weeks)
  const getPastWeeks = () => {
    const weeks = [];
    for (let i = 1; i <= 4; i++) {
      const d = new Date();
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1) - (i * 7);
      const start = new Date(d.setDate(diff));
      const end = new Date(d.setDate(diff + 6));
      
      const label = `${i} Week${i > 1 ? 's' : ''} Ago (${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })})`;
      weeks.push({ label, value: `week_${i}` });
    }
    return weeks;
  };

  // Generate Past Months (Last 12 months)
  const getPastMonths = () => {
    const months = [];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    for (let i = 1; i <= 12; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const label = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      months.push({ label, value: `month_${i}` });
    }
    return months;
  };

  // Generate Past Years (Last 5 years)
  const getPastYears = () => {
    const years = [];
    const currentYear = new Date().getFullYear();
    for (let i = 1; i <= 5; i++) {
      const year = currentYear - i;
      years.push({ label: `${year}`, value: `year_${i}` });
    }
    return years;
  };

  const filterOptions = [
    { label: 'All Time', value: 'all' },
    { label: 'Today', value: 'today' },
    { label: 'Yesterday', value: 'yesterday' },
    { label: 'Last 7 Days', value: '7d' },
    { label: 'This Week', value: 'this_week' },
    { label: 'Past Week Selector', value: 'past_week' },
    { label: 'This Month', value: 'this_month' },
    { label: 'Past Month Selector', value: 'past_month' },
    { label: 'This Year', value: 'this_year' },
    { label: 'Past Year Selector', value: 'past_year' },
    { label: 'Financial Year', value: 'financial_year' },
    { label: 'Custom Date Range', value: 'custom' },
  ];

  const calculateDates = (type, subValue) => {
    const now = new Date();
    let start = '';
    let end = '';

    switch (type) {
      case 'today':
        start = formatDate(now);
        end = start;
        break;
      case 'yesterday':
        const yesterday = new Date();
        yesterday.setDate(now.getDate() - 1);
        start = formatDate(yesterday);
        end = start;
        break;
      case '7d':
        const last7 = new Date();
        last7.setDate(now.getDate() - 6);
        start = formatDate(last7);
        end = formatDate(now);
        break;
      case 'this_week':
        const dWeek = new Date();
        const day = dWeek.getDay();
        const diff = dWeek.getDate() - day + (day === 0 ? -6 : 1);
        start = formatDate(new Date(dWeek.setDate(diff)));
        end = formatDate(now);
        break;
      case 'past_week':
        if (subValue) {
          const weeksAgo = parseInt(subValue.split('_')[1]);
          const dPastWeek = new Date();
          const dayPW = dPastWeek.getDay();
          const diffPW = dPastWeek.getDate() - dayPW + (dayPW === 0 ? -6 : 1) - (weeksAgo * 7);
          start = formatDate(new Date(dPastWeek.setDate(diffPW)));
          end = formatDate(new Date(dPastWeek.setDate(diffPW + 6)));
        }
        break;
      case 'this_month':
        const dMonth = new Date();
        dMonth.setDate(1);
        start = formatDate(dMonth);
        end = formatDate(now);
        break;
      case 'past_month':
        if (subValue) {
          const monthsAgo = parseInt(subValue.split('_')[1]);
          const dPastMonth = new Date();
          dPastMonth.setMonth(dPastMonth.getMonth() - monthsAgo);
          dPastMonth.setDate(1);
          start = formatDate(dPastMonth);
          const lastDay = new Date(dPastMonth.getFullYear(), dPastMonth.getMonth() + 1, 0);
          end = formatDate(lastDay);
        }
        break;
      case 'this_year':
        const dYear = new Date();
        dYear.setMonth(0, 1);
        start = formatDate(dYear);
        end = formatDate(now);
        break;
      case 'past_year':
        if (subValue) {
          const yearsAgo = parseInt(subValue.split('_')[1]);
          const dPastYear = new Date();
          dPastYear.setFullYear(dPastYear.getFullYear() - yearsAgo);
          dPastYear.setMonth(0, 1);
          start = formatDate(dPastYear);
          dPastYear.setMonth(11, 31);
          end = formatDate(dPastYear);
        }
        break;
      case 'financial_year':
        const dFY = new Date();
        const fyYear = dFY.getFullYear();
        const fyMonth = dFY.getMonth();
        let startFYYear = fyYear;
        if (fyMonth < 3) { // Jan, Feb, Mar
          startFYYear = fyYear - 1;
        }
        start = formatDate(new Date(startFYYear, 3, 1)); // April 1
        end = formatDate(new Date(startFYYear + 1, 2, 31)); // March 31
        break;
      case 'custom':
        start = customDates.start;
        end = customDates.end;
        break;
      default:
        start = '';
        end = '';
    }

    return { start, end };
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      // Reset sub-values when type changes
      if (filterType !== 'past_week' && filterType !== 'past_month' && filterType !== 'past_year') {
        setSelectedSubValue('');
      }

      if (filterType !== 'custom') {
        const { start, end } = calculateDates(filterType, selectedSubValue);
        if (filterType === 'all' || start) {
          onFilterChange({ startDate: start, endDate: end, filterType });
        }
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [filterType, selectedSubValue]);

  useEffect(() => {
    if (filterType === 'custom' && customDates.start && customDates.end) {
      const timer = setTimeout(() => {
        onFilterChange({ startDate: customDates.start, endDate: customDates.end, filterType });
      }, 0);

      return () => clearTimeout(timer);
    }
  }, [customDates]);

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <div className="relative">
        <PremiumSelect
          icon={Calendar}
          value={filterType}
          onChange={(val) => setFilterType(val)}
          options={filterOptions}
          className="w-full"
          placeholder="Select Range"
        />

        {loading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <Loader2 className="animate-spin text-[var(--color-primary)]" size={18} />
          </div>
        )}
      </div>

      <AnimatePresence>
        {filterType === 'past_week' && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="flex-1"
          >
            <PremiumSelect
              icon={Clock}
              value={selectedSubValue}
              onChange={(val) => setSelectedSubValue(val)}
              options={getPastWeeks()}
              placeholder="Choose Week"
            />
          </motion.div>
        )}

        {filterType === 'past_month' && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="flex-1"
          >
            <PremiumSelect
              icon={Clock}
              value={selectedSubValue}
              onChange={(val) => setSelectedSubValue(val)}
              options={getPastMonths()}
              placeholder="Choose Month"
            />
          </motion.div>
        )}

        {filterType === 'past_year' && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="flex-1"
          >
            <PremiumSelect
              icon={Clock}
              value={selectedSubValue}
              onChange={(val) => setSelectedSubValue(val)}
              options={getPastYears()}
              placeholder="Choose Year"
            />
          </motion.div>
        )}

        {filterType === 'custom' && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="flex gap-2 p-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl items-center shrink-0"
          >
            <div className="flex items-center gap-2 pl-3">
              <span className="text-xs font-medium text-[var(--color-text-muted)] whitespace-nowrap">From</span>
              <input
                type="date"
                className="bg-transparent text-xs outline-none text-[var(--color-text-primary)] w-24"
                value={customDates.start}
                onChange={e => setCustomDates({ ...customDates, start: e.target.value })}
              />
            </div>
            <div className="w-px h-4 bg-[var(--color-border)]" />
            <div className="flex items-center gap-2 pr-3">
              <span className="text-xs font-medium text-[var(--color-text-muted)] whitespace-nowrap">To</span>
              <input
                type="date"
                className="bg-transparent text-xs outline-none text-[var(--color-text-primary)] w-24"
                value={customDates.end}
                onChange={e => setCustomDates({ ...customDates, end: e.target.value })}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
