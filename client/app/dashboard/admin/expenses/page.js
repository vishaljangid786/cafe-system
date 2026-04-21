'use client'

import { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { Receipt, MapPin, Calendar, ExternalLink, IndianRupee, Search, Filter, Image as ImageIcon, AlertCircle, Zap, Minus } from 'lucide-react';
import { PageTransition, SlideIn, CardHover } from '../../../components/ui/AnimatedContainer';
import { motion } from 'framer-motion';
import Modal from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';

export default function GlobalExpensesPage() {
  const { user, selectedLocation, globalSearch } = useAuth();
  const startInputRef = useRef(null);
  const endInputRef = useRef(null);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState([]);
  const [viewingExpense, setViewingExpense] = useState(null);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const query = new URLSearchParams();
        if (selectedLocation) {
          query.append('locationId', selectedLocation._id || selectedLocation);
        }
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
  }, [filters, selectedLocation]);

  const filteredExpenses = expenses.filter(exp => {
    if (!globalSearch) return true;
    const searchLower = globalSearch.toLowerCase();
    return exp.title?.toLowerCase().includes(searchLower) ||
      exp.description?.toLowerCase().includes(searchLower) ||
      exp.locationName?.toLowerCase().includes(searchLower);
  });

  const totalIncome = filteredExpenses.filter(e => e.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
  const totalExpenditure = filteredExpenses.filter(e => e.type !== 'income').reduce((acc, curr) => acc + curr.amount, 0);
  const totalProfit = filteredExpenses.reduce((acc, curr) => acc + (curr.profit || 0), 0);

  return (
    <PageTransition>
      <div className="space-y-8">
        <SlideIn direction="down">
          <div className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-2xl p-4 md:p-6 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col lg:flex-row lg:items-center justify-between gap-6 transition-colors">
            <div>
              <h1 className="text-2xl font-black text-gray-900 dark:text-zinc-100 flex items-center tracking-tight">
                <Receipt className="mr-3 text-amber-600" size={28} /> Global Fiscal Matrix
              </h1>
              <p className="text-gray-500 dark:text-zinc-500 text-sm mt-1 font-medium">Monitor all income, expenditures, and net profits.</p>
            </div>

            <div className="flex flex-wrap gap-3">


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
                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
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
                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>
        </SlideIn>

        {/* Summary Cards */}
        <SlideIn delay={0.1}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-2xl p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden group transition-colors">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Income</p>
              <h2 className="text-3xl font-black text-green-600 mt-2 tracking-tight">₹{totalIncome.toLocaleString()}</h2>
              <div className="absolute -right-4 -bottom-4 text-green-600/5 group-hover:scale-110 transition-transform"><IndianRupee size={120} /></div>
            </div>
            <div className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-2xl p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden group transition-colors">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Expenditure</p>
              <h2 className="text-3xl font-black text-rose-600 mt-2 tracking-tight">₹{totalExpenditure.toLocaleString()}</h2>
              <div className="absolute -right-4 -bottom-4 text-rose-600/5 group-hover:scale-110 transition-transform"><Minus size={120} /></div>
            </div>
            <div className="bg-amber-600 p-6 rounded-3xl shadow-xl shadow-amber-600/20 relative overflow-hidden group">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/70">Net Profit Yield</p>
              <h2 className="text-3xl font-black text-white mt-2 tracking-tight">₹{totalProfit.toLocaleString()}</h2>
              <div className="absolute -right-4 -bottom-4 text-white/10 group-hover:scale-110 transition-transform text-white"><Receipt size={120} /></div>
            </div>
          </div>
        </SlideIn>

        {/* Expense List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {loading ? (
            [1, 2, 3, 4].map(i => <div key={i} className="h-40 bg-gray-100 dark:bg-zinc-800 animate-pulse rounded-3xl"></div>)
          ) : filteredExpenses.length === 0 ? (
            <div className="col-span-full py-20 text-center bg-white/40 dark:bg-zinc-900/40 backdrop-blur-2xl rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 transition-colors">
              <p className="text-zinc-500 font-medium">No expenses found for this selection/search.</p>
            </div>
          ) : (
            filteredExpenses.map((exp, idx) => (
              <SlideIn key={exp._id} delay={0.2 + idx * 0.05}>
                <CardHover>
                  <div
                    onClick={() => setViewingExpense(exp)}
                    className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-2xl p-6 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex items-start justify-between group hover:border-amber-500/50 transition-all duration-300 relative h-full cursor-pointer"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3">
                        <div className={`p-3 rounded-2xl border ${exp.type === 'income' ? 'bg-green-500/10 border-green-500/20 text-green-600' : 'bg-rose-500/10 border-rose-500/20 text-rose-600'}`}>
                          <IndianRupee size={20} />
                        </div>
                        <div>
                          <h3 className="font-black text-gray-900 dark:text-zinc-100 leading-tight text-lg tracking-tight flex items-center gap-2">
                            {exp.title}
                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${exp.type === 'income' ? 'bg-green-500/10 text-green-500' : 'bg-rose-500/10 text-rose-500'}`}>
                              {exp.type || 'expense'}
                            </span>
                          </h3>
                          <p className="text-xs text-gray-400 dark:text-zinc-500 font-bold uppercase tracking-widest mt-1">
                            {new Date(exp.date).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-zinc-400 font-medium leading-relaxed whitespace-pre-line">{exp.description}</p>
                      <div className="flex items-center space-x-3 pt-2">
                        <span className="px-3 py-1 bg-gray-100 dark:bg-zinc-800 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-zinc-400 rounded-full flex items-center">
                          <MapPin size={10} className="mr-1.5 opacity-50" /> {exp.locationName}
                        </span>
                        <span className="px-3 py-1 bg-amber-50 dark:bg-amber-500/10 text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-500 rounded-full">
                          {exp.category || 'General'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end justify-between h-full min-w-[120px]">
                      <div>
                        <p className={`text-2xl font-black tracking-tighter ${exp.type === 'income' ? 'text-green-600' : 'text-rose-600'}`}>
                          {exp.type === 'income' ? '+' : '-'}₹{exp.amount.toLocaleString()}
                        </p>
                        {exp.profit > 0 && (user?.role === 'admin' || user?.role === 'super_admin') && (
                          <p className="text-[10px] font-black text-amber-600 text-right mt-1">
                            Yield: ₹{exp.profit.toLocaleString()}
                          </p>
                        )}
                      </div>
                      {exp.proofImage ? (
                        <motion.a
                          whileHover={{ scale: 1.1, rotate: 5 }}
                          onClick={(e) => e.stopPropagation()}
                          href={exp.proofImage}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-6 h-12 w-12 flex items-center justify-center bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl border border-amber-100 dark:border-amber-500/20 shadow-sm transition-all"
                          title="View Receipt"
                        >
                          <ImageIcon size={22} />
                        </motion.a>
                      ) : (
                        <div className="mt-6 text-[8px] font-black uppercase text-gray-300 dark:text-zinc-700 tracking-widest italic text-right">Digital Entry</div>
                      )}
                    </div>
                  </div>
                </CardHover>
              </SlideIn>
            ))
          )}
        </div>

        {/* Global Detail View Modal */}
        <Modal
          isOpen={!!viewingExpense}
          onClose={() => setViewingExpense(null)}
          title="Global Transaction Intelligence"
          maxWidth="max-w-2xl"
        >
          {viewingExpense && (
            <div className="space-y-8">
              <div className="flex flex-col md:flex-row justify-between gap-6 border-b border-zinc-100 dark:border-zinc-800 pb-8">
                <div>
                  <h2 className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight leading-none">{viewingExpense.title}</h2>
                  <div className="flex items-center gap-3 mt-3">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${viewingExpense.type === 'income' ? 'bg-green-500/10 text-green-500' : 'bg-rose-500/10 text-rose-500'}`}>
                      {viewingExpense.type || 'expense'}
                    </span>
                    <span className="text-[10px] text-amber-600 font-black uppercase tracking-widest border border-amber-500/20 px-3 py-1 rounded-full flex items-center gap-1.5">
                      <MapPin size={10} /> {viewingExpense.locationName}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-full">
                      {viewingExpense.category}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Fiscal Impact</p>
                  <p className={`text-3xl font-black ${viewingExpense.type === 'income' ? 'text-green-600' : 'text-rose-600'} tracking-tighter`}>
                    {viewingExpense.type === 'income' ? '+' : '-'}₹{viewingExpense.amount.toLocaleString()}
                  </p>
                  {viewingExpense.profit > 0 && (user?.role === 'admin' || user?.role === 'super_admin') && (
                    <p className="text-sm font-black text-amber-600 mt-1 italic tracking-tight">
                      System Yield: ₹{viewingExpense.profit.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Temporal Stamp</h4>
                    <p className="text-sm font-bold text-zinc-700 dark:text-zinc-200 flex items-center gap-2">
                      <Calendar size={16} className="text-amber-600" />
                      {new Date(viewingExpense.date).toLocaleDateString(undefined, { dateStyle: 'full' })}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Protocol Description</h4>
                    <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium whitespace-pre-line">
                        {viewingExpense.description || 'No descriptive data recorded for this entry.'}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Fiscal Proof / Receipt</h4>
                  {viewingExpense.proofImage ? (
                    <div className="group relative rounded-3xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 aspect-square">
                      <img
                        src={viewingExpense.proofImage}
                        alt="Fiscal Proof"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <a
                        href={viewingExpense.proofImage}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-black text-xs uppercase tracking-widest gap-2 backdrop-blur-sm"
                      >
                        Open Original <ImageIcon size={16} />
                      </a>
                    </div>
                  ) : (
                    <div className="rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 p-8 flex flex-col items-center justify-center text-zinc-400 aspect-square">
                      <AlertCircle size={32} className="mb-2 opacity-20" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-center">No Imagery Captured</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800">
                <Button
                  variant="outline"
                  className="w-full py-4 !rounded-2xl font-black text-xs uppercase tracking-widest"
                  onClick={() => setViewingExpense(null)}
                >
                  Return to Matrix
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </PageTransition>
  );
}
