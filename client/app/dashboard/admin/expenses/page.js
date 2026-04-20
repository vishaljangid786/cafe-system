'use client'

import { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import { Receipt, MapPin, Calendar, ExternalLink, IndianRupee, Search, Filter, Image as ImageIcon } from 'lucide-react';
import { PageTransition, SlideIn, CardHover } from '../../../components/ui/AnimatedContainer';
import { motion } from 'framer-motion';

export default function GlobalExpensesPage() {
  const startInputRef = useRef(null);
  const endInputRef = useRef(null);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState([]);
  const [filters, setFilters] = useState({
    locationId: 'All',
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const query = new URLSearchParams();
        if (filters.locationId !== 'All') query.append('locationId', filters.locationId);
        if (filters.startDate) query.append('startDate', filters.startDate);
        if (filters.endDate) query.append('endDate', filters.endDate);

        const [expRes, locRes] = await Promise.all([
          api.get(`/expenses?${query.toString()}`),
          api.get('/locations')
        ]);
        setExpenses(expRes.data.data);
        setLocations(locRes.data.data);
      } catch (err) {
        console.error('Failed to fetch expenses matrix');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [filters]);

  const totalAmount = expenses.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <PageTransition>
      <div className="space-y-8">
        <SlideIn direction="down">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-zinc-800 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <h1 className="text-2xl font-black text-gray-900 dark:text-zinc-100 flex items-center tracking-tight">
                <Receipt className="mr-3 text-amber-600" size={28} /> Global Expenses Matrix
              </h1>
              <p className="text-gray-500 dark:text-zinc-500 text-sm mt-1 font-medium">Monitor all expenditures across the operational grid.</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="flex items-center space-x-2 bg-gray-50 dark:bg-zinc-800 p-1.5 rounded-xl border border-gray-200 dark:border-zinc-700">
                <MapPin size={18} className="ml-2 text-gray-400" />
                <select 
                  className="bg-transparent outline-none text-sm font-bold text-gray-700 dark:text-zinc-200 pr-8 appearance-none"
                  value={filters.locationId}
                  onChange={(e) => setFilters({...filters, locationId: e.target.value})}
                >
                  <option value="All">All Locations</option>
                  {locations.map(l => <option key={l._id} value={l._id}>{l.name}</option>)}
                </select>
              </div>

              <div className="flex items-center space-x-2 bg-gray-50 dark:bg-zinc-800 p-1.5 rounded-xl border border-gray-200 dark:border-zinc-700 px-3">
                <div 
                  onClick={() => startInputRef.current?.showPicker()}
                  className="flex items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700 p-1 rounded-lg transition-colors"
                >
                  <Calendar size={18} className="text-gray-400 mr-2" />
                  <input 
                    ref={startInputRef}
                    type="date" 
                    className="bg-transparent outline-none text-sm font-bold text-gray-700 dark:text-zinc-200 cursor-pointer"
                    value={filters.startDate}
                    onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                  />
                </div>
                <span className="text-gray-400 font-bold mx-1">to</span>
                <div 
                  onClick={() => endInputRef.current?.showPicker()}
                  className="flex items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700 p-1 rounded-lg transition-colors"
                >
                  <input 
                    ref={endInputRef}
                    type="date" 
                    className="bg-transparent outline-none text-sm font-bold text-gray-700 dark:text-zinc-200 cursor-pointer"
                    value={filters.endDate}
                    onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                  />
                </div>
              </div>
            </div>
          </div>
        </SlideIn>

        {/* Summary Card */}
        <SlideIn delay={0.1}>
          <div className="bg-zinc-900 dark:bg-amber-600 p-8 rounded-3xl text-white flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Receipt size={200} />
            </div>
            <div className="relative z-10">
              <p className="text-xs font-black uppercase tracking-[0.2em] opacity-60">Total Expenditure</p>
              <div className="flex items-baseline mt-2">
                <span className="text-5xl font-black">₹{totalAmount.toLocaleString()}</span>
                <span className="ml-3 text-amber-500 dark:text-amber-200 font-bold">INR</span>
              </div>
            </div>
            <div className="h-12 w-px bg-white/10 hidden md:block"></div>
            <div className="relative z-10 text-right md:text-left">
              <p className="text-xs font-black uppercase tracking-[0.2em] opacity-60">Entries Found</p>
              <p className="text-2xl font-black mt-2">{expenses.length} Records</p>
            </div>
          </div>
        </SlideIn>

        {/* Expense List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {loading ? (
            [1,2,3,4].map(i => <div key={i} className="h-40 bg-gray-100 dark:bg-zinc-800 animate-pulse rounded-3xl"></div>)
          ) : expenses.length === 0 ? (
            <div className="col-span-full py-20 text-center bg-white dark:bg-zinc-900 rounded-3xl border border-dashed border-gray-200 dark:border-zinc-800">
              <p className="text-gray-500 font-medium">No expenses recorded for this selection.</p>
            </div>
          ) : (
            expenses.map((exp, idx) => (
              <SlideIn key={exp._id} delay={0.2 + idx * 0.05}>
                <CardHover>
                  <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-zinc-800 flex items-start justify-between group hover:border-amber-500/50 transition-all duration-300 relative h-full">
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-2xl border border-red-100 dark:border-red-500/20">
                          <IndianRupee size={20} />
                        </div>
                        <div>
                          <h3 className="font-black text-gray-900 dark:text-zinc-100 leading-tight text-lg tracking-tight">{exp.title}</h3>
                          <p className="text-xs text-gray-400 dark:text-zinc-500 font-bold uppercase tracking-widest mt-1">
                            {new Date(exp.date).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-zinc-400 line-clamp-2 font-medium leading-relaxed">{exp.description}</p>
                      <div className="flex items-center space-x-3 pt-2">
                        <span className="px-3 py-1 bg-gray-100 dark:bg-zinc-800 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-zinc-400 rounded-full flex items-center">
                          <MapPin size={10} className="mr-1.5 opacity-50" /> {exp.locationName}
                        </span>
                        <span className="px-3 py-1 bg-amber-50 dark:bg-amber-500/10 text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-500 rounded-full">
                          {exp.category || 'General'}
                        </span>
                      </div>
                    </div>
                    
                      <div className="flex flex-col items-end justify-between h-full min-w-[100px]">
                        <p className="text-2xl font-black text-gray-900 dark:text-zinc-100 tracking-tighter">₹{exp.amount.toLocaleString()}</p>
                        {exp.proofImage ? (
                          <motion.a 
                            whileHover={{ scale: 1.1, rotate: 5 }}
                            href={exp.proofImage} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="mt-6 h-12 w-12 flex items-center justify-center bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl border border-amber-100 dark:border-amber-500/20 shadow-sm transition-all"
                            title="View Receipt"
                          >
                            <ImageIcon size={22} />
                          </motion.a>
                        ) : (
                          <div className="mt-6 text-[8px] font-black uppercase text-gray-300 dark:text-zinc-700 tracking-widest italic">Digital Entry</div>
                        )}
                      </div>
                  </div>
                </CardHover>
              </SlideIn>
            ))
          )}
        </div>
      </div>
    </PageTransition>
  );
}
