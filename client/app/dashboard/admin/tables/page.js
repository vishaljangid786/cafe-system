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
    } catch (error) {}
  };

  useEffect(() => {
    fetchTables();
    fetchLocations();
  }, [selectedLocation]);

  const filteredTables = tables.filter(t => 
    t.tableNumber.toString().includes(searchTerm) || 
    t.locationName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return (
    <div className="space-y-8">
      <div className="h-40 bg-white dark:bg-zinc-900 rounded-[2.5rem] animate-pulse"></div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
        {[1,2,3,4,5,6,7,8,9,10].map(i => <div key={i} className="h-44 bg-white dark:bg-zinc-900 rounded-[2.5rem] animate-pulse"></div>)}
      </div>
    </div>
  );

  return (
    <PageTransition>
      <div className="space-y-10">
        <SlideIn direction="down">
          <div className="bg-white dark:bg-zinc-900 p-10 rounded-[3rem] shadow-sm border border-gray-100 dark:border-zinc-800 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div>
              <h1 className="text-4xl font-black text-gray-900 dark:text-zinc-100 tracking-tighter flex items-center">
                <Coffee className="mr-4 text-amber-600" size={40} /> Network <span className="ml-3 text-amber-600">Matrices</span>
              </h1>
              <p className="text-gray-500 dark:text-zinc-500 text-sm mt-2 font-medium tracking-wide uppercase">Real-time floor plan synchronization across all locations.</p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="relative group w-full sm:w-64">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-amber-600 transition-colors" size={18} />
                <input 
                  type="text" 
                  placeholder="Scan Protocol..." 
                  className="w-full pl-14 pr-6 py-5 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 transition-all text-xs font-black uppercase tracking-widest outline-none"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="relative group w-full sm:w-64">
                <Filter className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <select 
                  className="w-full pl-14 pr-10 py-5 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 transition-all text-xs font-black uppercase tracking-widest outline-none appearance-none"
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                >
                  <option value="All">All Sectors</option>
                  {locations.map(l => <option key={l._id} value={l.name}>{l.name}</option>)}
                </select>
              </div>
            </div>
          </div>
        </SlideIn>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
          <AnimatePresence mode='popLayout'>
            {filteredTables.map((table, i) => (
              <SlideIn key={table._id} delay={i * 0.03}>
                <CardHover>
                  <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-zinc-800 relative group overflow-hidden">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest flex items-center">
                          <MapPin size={10} className="mr-1" /> {table.locationName}
                        </span>
                      </div>
                      <span className={`h-2 w-2 rounded-full ${
                        table.status === 'available' ? 'bg-green-500' :
                        table.status === 'booked' ? 'bg-amber-500' : 'bg-blue-500'
                      } shadow-sm shadow-current`}></span>
                    </div>
                    
                    <h3 className="text-4xl font-black text-gray-900 dark:text-zinc-100 mb-2 tracking-tighter">T{table.tableNumber}</h3>
                    
                    <div className="mt-4 flex flex-col space-y-2">
                       <span className={`text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest w-fit ${
                        table.status === 'available' ? 'bg-green-50 text-green-600 dark:bg-green-500/10' :
                        table.status === 'booked' ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/10' : 'bg-blue-50 text-blue-600 dark:bg-blue-500/10'
                      }`}>
                        {table.status}
                      </span>
                      {table.status !== 'available' && (
                        <span className="text-sm font-black text-gray-900 dark:text-zinc-100">₹{table.totalAmount?.toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                </CardHover>
              </SlideIn>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </PageTransition>
  );
}
