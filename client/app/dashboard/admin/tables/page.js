'use client';
import { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import { Coffee, Plus, Check, Users, ShoppingBag, X, Zap, Receipt, Trash2, Edit3, Loader2, Filter, Search, MapPin } from 'lucide-react';
import { PageTransition, SlideIn, CardHover } from '../../../components/ui/AnimatedContainer';
import Modal from '../../../components/ui/Modal';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuth } from '@/app/context/AuthContext';
import Dropdown from '../../../components/ui/Dropdown';

export default function AdminTablesPage() {
  const { user } = useAuth();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchTables = async () => {
    try {
      const url = selectedLocation === 'All' ? '/tables' : `/tables?locationName=${selectedLocation}`;
      const res = await api.get(url);
      setTables(res.data.data);
    } catch (error) {
      toast.error('Failed to sync master floor plan');
    } finally {
      setLoading(false);
    }
  };

  const fetchLocations = async () => {
    try {
      const res = await api.get('/locations');
      setLocations(res.data.data);
    } catch (error) { }
  };

  useEffect(() => {
    fetchTables();
    fetchLocations();
  }, [selectedLocation]);

  const filteredTables = tables.filter(t =>
    t.tableNumber.toString().includes(searchTerm) ||
    t.locationName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const locationOptions = [
    { value: 'All', label: 'All Sectors' },
    ...locations.map(l => ({ value: l.name, label: l.name }))
  ];

  if (loading) return (
    <div className="space-y-8">
      <div className="h-40 bg-white dark:bg-zinc-900 rounded-[3rem] animate-pulse"></div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => <div key={i} className="h-44 bg-white dark:bg-zinc-900 rounded-[2.5rem] animate-pulse"></div>)}
      </div>
    </div>
  );

  return (
    <PageTransition>
      <div className="space-y-10">
        <SlideIn direction="down">
          <div className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-2xl p-10 rounded-[3.5rem] shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col lg:flex-row lg:items-center justify-between gap-8 transition-colors">
            <div>
              <h1 className="text-4xl font-black text-zinc-900 dark:text-zinc-100 tracking-tighter flex items-center">
                <Coffee className="mr-4 text-amber-600" size={40} /> Network <span className="ml-3 text-amber-600">Matrices</span>
              </h1>
              <p className="text-zinc-500 dark:text-zinc-500 text-sm mt-2 font-medium tracking-wide uppercase">Real-time floor plan synchronization across all locations.</p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
              <div className="relative group w-full sm:w-72">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-amber-600 transition-colors" size={18} />
                <input
                  type="text"
                  placeholder="Scan Protocol..."
                  className="w-full pl-16 pr-6 py-5 rounded-[2rem] bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all text-xs font-black uppercase tracking-widest outline-none"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <Dropdown
                options={locationOptions}
                value={selectedLocation}
                onChange={setSelectedLocation}
                className="w-full sm:w-72"
                placeholder="Sector Filter"
                icon={Filter}
              />
            </div>
          </div>
        </SlideIn>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
          <AnimatePresence mode='popLayout'>
            {filteredTables.map((table, i) => (
              <SlideIn key={table._id} delay={i * 0.03}>
                <CardHover>
                  <div className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-2xl p-8 rounded-[3rem] border border-zinc-200 dark:border-zinc-800 relative group overflow-hidden transition-colors">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest flex items-center">
                          <MapPin size={10} className="mr-1.5 text-amber-600" /> {table.locationName}
                        </span>
                      </div>
                      <span className={`h-2.5 w-2.5 rounded-full ${table.status === 'available' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' :
                        table.status === 'booked' ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]'
                        }`}></span>
                    </div>

                    <h3 className="text-5xl font-black text-zinc-900 dark:text-zinc-100 mb-2 tracking-tighter">T{table.tableNumber}</h3>

                    <div className="mt-6 flex flex-col space-y-3">
                      <span className={`text-[9px] font-black px-3.5 py-1.5 rounded-full uppercase tracking-widest w-fit border ${table.status === 'available' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20' :
                        table.status === 'booked' ? 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:border-amber-500/20' : 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-500/10 dark:border-rose-500/20'
                        }`}>
                        {table.status}
                      </span>
                      {table.status !== 'available' && (
                        <div className="flex items-center gap-2 pt-2 border-t border-zinc-50 dark:border-zinc-800">
                          <Receipt size={14} className="text-zinc-400" />
                          <span className="text-lg font-black text-zinc-900 dark:text-zinc-100 tracking-tight">₹{table.totalAmount?.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardHover>
              </SlideIn>
            ))}
          </AnimatePresence>
        </div>

        {!loading && filteredTables.length === 0 && (
          <div className="text-center py-40 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-2xl rounded-[5rem] border border-dashed border-zinc-200 dark:border-zinc-800 transition-colors">
            <Coffee size={64} className="mx-auto text-zinc-200 dark:text-zinc-800 mb-8" strokeWidth={1} />
            <h3 className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tighter">No Active Terminals</h3>
            <p className="text-zinc-500 font-medium mt-3 max-w-sm mx-auto uppercase text-xs tracking-widest">No grid nodes match your current diagnostic parameters.</p>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
