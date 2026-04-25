'use client';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  X, Calendar, Clock, Users, 
  MapPin, Phone, CreditCard, 
  AlertTriangle, CheckCircle2, 
  Loader2, Info,
  ChevronDown,
  LayoutGrid
} from 'lucide-react';
import Modal from '../ui/Modal';
import { toast } from 'react-hot-toast';
import api from '../../services/api';
import PremiumSelect from '../ui/PremiumSelect';
import { AnimatePresence,motion } from 'framer-motion';

const EVENT_DESIGNATIONS = [
  'Birthday Celebration',
  'Corporate Lunch',
  'Anniversary Dinner',
  'Business Meeting',
  'Family Gathering',
  'Engagement Party',
  'Farewell Celebration',
  'Team Outing',
  'Product Launch',
  'Other'
];

export default function ReservationForm({ isOpen, onClose, onSuccess, editData = null }) {
  const [loading, setLoading] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availabilityStatus, setAvailabilityStatus] = useState(null); // { available: boolean, message: string }
  const [selectedEventType, setSelectedEventType] = useState('');
  
  const [locations, setLocations] = useState([]);
  const [tables, setTables] = useState([]);
  
  const [formData, setFormData] = useState({
    eventName: '',
    reservationType: 'table',
    locationId: '',
    tableIds: [],
    date: '',
    startTime: '',
    endTime: '',
    isFullDay: false,
    customerName: '',
    customerPhone: '',
    totalAmount: 0,
    advancePayment: 0,
    paymentStatus: 'pending',
    notes: ''
  });

  useEffect(() => {
    if (editData) {
      const matchedPreset = EVENT_DESIGNATIONS.find(
        d => d !== 'Other' && d === editData.eventName
      );
      if (matchedPreset) {
        setSelectedEventType(matchedPreset);
      } else if (editData.eventName) {
        setSelectedEventType('Other');
      }
      setFormData({
        ...editData,
        locationId: editData.locationId?._id || editData.locationId,
        tableIds: editData.tableIds?.map(t => t._id || t) || [],
        date: editData.date ? new Date(editData.date).toISOString().split('T')[0] : ''
      });
    }
  }, [editData]);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const { data } = await api.get('/locations');
        setLocations(data.data);
      } catch (error) {
        console.error('Error fetching locations:', error);
      }
    };
    fetchLocations();
  }, []);

  useEffect(() => {
    const fetchTables = async (locId) => {
      try {
        const { data } = await api.get('/tables', {
          params: { locationId: locId }
        });
        setTables(data.data);
      } catch (error) {
        console.error('Error fetching tables:', error);
      }
    };

    if (formData.locationId) {
      fetchTables(formData.locationId);
    } else {
      setTables([]);
      setFormData(prev => ({ ...prev, tableIds: [] }));
    }
  }, [formData.locationId]);

  // Check availability when core fields change
  useEffect(() => {
    const checkAvailability = async () => {
      try {
        setCheckingAvailability(true);
        const { data } = await api.get('/reservations/availability', {
          params: {
            locationId: formData.locationId,
            date: formData.date,
            startTime: formData.startTime,
            endTime: formData.endTime,
            reservationType: formData.reservationType,
            tableIds: formData.tableIds,
            excludeId: editData?._id
          }
        });
        setAvailabilityStatus(data);
      } catch (error) {
        console.error('Error checking availability:', error);
      } finally {
        setCheckingAvailability(false);
      }
    };

    const { locationId, date, startTime, endTime } = formData;
    if (locationId && date && startTime && endTime) {
      checkAvailability();
    }
  }, [formData.locationId, formData.date, formData.startTime, formData.endTime, formData.reservationType, formData.tableIds, editData?._id]);

  const handleTableToggle = (tableId) => {
    setFormData(prev => {
      const isSelected = prev.tableIds.includes(tableId);
      const newTableIds = isSelected 
        ? prev.tableIds.filter(id => id !== tableId)
        : [...prev.tableIds, tableId];
      return { ...prev, tableIds: newTableIds };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (availabilityStatus && !availabilityStatus.available) {
      toast.error('Selected slot is not available');
      return;
    }

    try {
      setLoading(true);
      if (editData) {
        await api.put(`/reservations/${editData._id}`, formData);
        toast.success('Reservation synchronized successfully');
      } else {
        await api.post('/reservations', formData);
        toast.success('Reservation established successfully');
      }
      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to process reservation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={editData ? "Synchronize Reservation" : "Establish Reservation"} 
      maxWidth="max-w-5xl"
    >
      <form onSubmit={handleSubmit} className="p-2 space-y-10">
        
        {/* Step 1: Identity & Designation */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Info size={16} />
            </div>
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Event Identity Protocol</h4>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-2">
                <PremiumSelect 
                  label="Event Category"
                  value={selectedEventType}
                  onChange={val => {
                    setSelectedEventType(val);
                    if (val !== 'Other') {
                      setFormData({...formData, eventName: val});
                    } else {
                      setFormData({...formData, eventName: ''});
                    }
                  }}
                  placeholder="Select Designation"
                  options={EVENT_DESIGNATIONS.map(d => ({ label: d, value: d }))}
                />
            </div>

            <div className="lg:col-span-7 space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Protocol Designation (Name)</label>
              <div className="relative">
                <input
                  required
                  type="text"
                  placeholder={selectedEventType === 'Other' ? "Type custom designation..." : "Select category or type 'Other'"}
                  disabled={selectedEventType !== 'Other' && selectedEventType !== ''}
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-amber-500/30 outline-none transition-all text-zinc-900 dark:text-zinc-100 font-bold placeholder:text-zinc-500 disabled:opacity-60"
                  value={formData.eventName}
                  onChange={e => setFormData({...formData, eventName: e.target.value})}
                />
                {selectedEventType === 'Other' && (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-amber-500 uppercase tracking-widest bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">Custom</span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Step 2: Logistics & Matrix */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
              <MapPin size={16} />
            </div>
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Operational Logistics</h4>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Type Selector</label>
                <div className="flex bg-zinc-100 dark:bg-zinc-950 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, reservationType: 'table'})}
                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${formData.reservationType === 'table' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
                  >
                    Table
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, reservationType: 'full-location'})}
                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${formData.reservationType === 'full-location' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
                  >
                    Full Branch
                  </button>
                </div>
              </div>

                <PremiumSelect 
                  icon={MapPin}
                  label="Assigned Branch"
                  value={formData.locationId}
                  onChange={val => setFormData({...formData, locationId: val})}
                  placeholder="Select Branch"
                  options={locations.map(loc => ({ label: loc.name || loc.city, value: loc._id }))}
                />
            </div>

            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Calendar Date</label>
                <div className="relative">
                  <input 
                    required
                    type="date" 
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-amber-500/30 outline-none text-zinc-900 dark:text-zinc-100 font-bold"
                    value={formData.date}
                    onChange={e => setFormData({...formData, date: e.target.value})}
                  />
                  <Calendar className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Matrix Start</label>
                <div className="relative">
                  <input 
                    required
                    type="time" 
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-amber-500/30 outline-none text-zinc-900 dark:text-zinc-100 font-bold"
                    value={formData.startTime}
                    onChange={e => setFormData({...formData, startTime: e.target.value})}
                  />
                  <Clock className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Matrix End</label>
                <div className="relative">
                  <input 
                    required
                    type="time" 
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-amber-500/30 outline-none text-zinc-900 dark:text-zinc-100 font-bold"
                    value={formData.endTime}
                    onChange={e => setFormData({...formData, endTime: e.target.value})}
                  />
                  <Clock className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Table Selection - Dedicated Full-Width Section */}
        <AnimatePresence>
          {formData.reservationType === 'table' && formData.locationId && (
            <motion.section
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-6 overflow-hidden"
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-zinc-500/10 flex items-center justify-center text-zinc-500">
                    <LayoutGrid size={16} />
                  </div>
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Table Mapping Specification</h4>
                </div>
                {formData.tableIds.length > 0 && (
                  <span className="text-[10px] font-black text-amber-500 bg-amber-500/10 border border-amber-500/20 px-4 py-1.5 rounded-full uppercase tracking-widest">
                    {formData.tableIds.length} Nodes Selected
                  </span>
                )}
              </div>

              <div className="p-6 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem]">
                {tables.length === 0 ? (
                  <div className="py-10 text-center opacity-50 italic">No operational tables found for this branch.</div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
                    {tables.map(table => {
                      const isSelected = formData.tableIds.includes(table._id);
                      return (
                        <button
                          key={table._id}
                          type="button"
                          onClick={() => handleTableToggle(table._id)}
                          className={`relative group h-24 rounded-[1.5rem] border-2 flex flex-col items-center justify-center gap-1 transition-all duration-300 ${
                            isSelected
                              ? 'bg-amber-500 border-amber-500 text-black shadow-xl shadow-amber-500/30 -translate-y-1'
                              : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:border-amber-500/50 hover:bg-amber-500/5'
                          }`}
                        >
                          <Users size={16} className={isSelected ? 'text-black' : 'text-zinc-500'} />
                          <span className={`text-base font-black leading-none ${isSelected ? 'text-black' : ''}`}>T{table.tableNumber}</span>
                          <span className={`text-[9px] font-black uppercase tracking-tighter ${isSelected ? 'text-black/60' : 'text-zinc-500'}`}>{table.seats || 2} SEATS</span>
                          {isSelected && (
                            <div className="absolute -top-1.5 -right-1.5 h-6 w-6 bg-black rounded-full flex items-center justify-center text-amber-500 shadow-lg ring-4 ring-amber-500">
                              <CheckCircle2 size={12} strokeWidth={3} />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Availability Feedback Overlay-style */}
        <AnimatePresence>
          {(checkingAvailability || availabilityStatus) && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`p-6 rounded-[2rem] border-2 flex items-center gap-5 ${
                checkingAvailability ? 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-500' :
                availabilityStatus?.available ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                'bg-rose-500/10 border-rose-500/20 text-rose-500'
              }`}
            >
              <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${
                checkingAvailability ? 'bg-zinc-200 dark:bg-zinc-800' :
                availabilityStatus?.available ? 'bg-emerald-500/20' :
                'bg-rose-500/20'
              }`}>
                {checkingAvailability ? (
                  <Loader2 className="animate-spin text-zinc-400" size={24} />
                ) : availabilityStatus?.available ? (
                  <CheckCircle2 size={24} />
                ) : (
                  <AlertTriangle size={24} />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-black uppercase tracking-widest mb-1">Schedule Diagnostics</p>
                <p className="text-xs font-bold opacity-80">
                  {checkingAvailability ? 'Scanning temporal matrix for scheduling conflicts...' : availabilityStatus?.message}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step 3: Client & Fiscal Matrix */}
        <section className="pt-10 border-t border-zinc-200 dark:border-zinc-800 grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Users className="text-amber-500" size={20} />
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Client Details</h4>
            </div>
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Client Full Name</label>
                <input 
                  required
                  type="text" 
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-amber-500/30 outline-none text-zinc-900 dark:text-zinc-100 font-bold"
                  value={formData.customerName}
                  onChange={e => setFormData({...formData, customerName: e.target.value})}
                  placeholder="e.g. John Wick"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Communication Access</label>
                <div className="relative">
                  <input 
                    required
                    type="tel" 
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl pl-12 pr-5 py-4 focus:ring-2 focus:ring-amber-500/30 outline-none text-zinc-900 dark:text-zinc-100 font-bold"
                    value={formData.customerPhone}
                    onChange={e => setFormData({...formData, customerPhone: e.target.value})}
                    placeholder="+91 XXXXX XXXXX"
                  />
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <CreditCard className="text-amber-500" size={20} />
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Fiscal Yield Protocol</h4>
            </div>
            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Total Valuation</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">₹</span>
                  <input 
                    type="number" 
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl pl-10 pr-5 py-4 focus:ring-2 focus:ring-amber-500/30 outline-none text-zinc-900 dark:text-zinc-100 font-black"
                    value={formData.totalAmount}
                    onChange={e => setFormData({...formData, totalAmount: Number(e.target.value)})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Advance Token</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">₹</span>
                  <input 
                    type="number" 
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl pl-10 pr-5 py-4 focus:ring-2 focus:ring-amber-500/30 outline-none text-zinc-900 dark:text-zinc-100 font-black"
                    value={formData.advancePayment}
                    onChange={e => setFormData({...formData, advancePayment: Number(e.target.value)})}
                  />
                </div>
              </div>
            </div>
              <PremiumSelect 
                label="Fiscal Status"
                value={formData.paymentStatus}
                onChange={val => setFormData({...formData, paymentStatus: val})}
                options={[
                  { label: 'Pending Settlement', value: 'pending' },
                  { label: 'Partial Liquidation', value: 'partial' },
                  { label: 'Fully Authorized', value: 'paid' }
                ]}
              />
          </div>
        </section>

        {/* Footer Actions - Fixed-style with backdrop blur */}
        <div className="pt-8 flex items-center justify-end gap-6 border-t border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="px-8 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-500 hover:text-rose-500 transition-all"
          >
            Abort Protocol
          </button>
          <button
            disabled={loading || (availabilityStatus && !availabilityStatus.available)}
            type="submit"
            className="px-10 py-5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-black font-black rounded-2xl transition-all shadow-2xl shadow-amber-500/30 flex items-center gap-3 uppercase tracking-widest text-xs"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} strokeWidth={3} />}
            {editData ? 'Update Protocol Matrix' : 'Establish Reservation'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
