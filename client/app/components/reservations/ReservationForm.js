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
import { AnimatePresence, motion } from 'framer-motion';

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
      const timer = setTimeout(() => {
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
      }, 0);

      return () => clearTimeout(timer);
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
    const timer = setTimeout(() => {
      fetchLocations();
    }, 0);

    return () => clearTimeout(timer);
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
      const timer = setTimeout(() => {
        fetchTables(formData.locationId);
      }, 0);

      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        setTables([]);
        setFormData(prev => ({ ...prev, tableIds: [] }));
      }, 0);

      return () => clearTimeout(timer);
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
      const timer = setTimeout(() => {
        checkAvailability();
      }, 0);

      return () => clearTimeout(timer);
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
        toast.success('Reservation updated');
      } else {
        await api.post('/reservations', formData);
        toast.success('Reservation booked');
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
      title={editData ? "Edit Reservation" : "Book Reservation"}
      maxWidth="max-w-5xl"
    >
      <form onSubmit={handleSubmit} className="p-2 space-y-10">

        {/* Step 1: Event Details */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Info size={16} />
            </div>
            <h4 className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Event Information</h4>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-2">
              <PremiumSelect
                label="Event Category"
                value={selectedEventType}
                onChange={val => {
                  setSelectedEventType(val);
                  if (val !== 'Other') {
                    setFormData({ ...formData, eventName: val });
                  } else {
                    setFormData({ ...formData, eventName: '' });
                  }
                }}
                placeholder="Select Event Type"
                options={EVENT_DESIGNATIONS.map(d => ({ label: d, value: d }))}
              />
            </div>

            <div className="lg:col-span-7 space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) ml-1">Event Name</label>
              <div className="relative">
                <input
                  required
                  type="text"
                  placeholder={selectedEventType === 'Other' ? "Type a custom event name..." : "Pick a category, or choose 'Other' to type your own"}
                  disabled={selectedEventType !== 'Other' && selectedEventType !== ''}
                  className="w-full bg-(--color-surface) border border-(--color-border) rounded-xl px-5 py-4 focus:ring-2 focus:ring-primary/30 outline-none transition-all text-(--color-text-primary) font-bold placeholder:text-(--color-text-muted) disabled:opacity-60"
                  value={formData.eventName}
                  onChange={e => setFormData({ ...formData, eventName: e.target.value })}
                />
                {selectedEventType === 'Other' && (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-primary uppercase tracking-normal bg-primary/10 px-3 py-1 rounded-full border border-primary/20">Custom</span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Step 2: Booking Details */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-8 w-8 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
              <MapPin size={16} />
            </div>
            <h4 className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Booking Type & Branch</h4>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) ml-1">Booking Type</label>
                <div className="flex bg-(--color-bg-soft) p-1.5 rounded-xl border border-(--color-border)">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, reservationType: 'table' })}
                    className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-normal transition-all ${formData.reservationType === 'table' ? 'bg-primary text-(--color-on-primary) shadow-lg ' : 'text-(--color-text-muted) hover:text-(--color-text-primary)'}`}
                  >
                    Table
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, reservationType: 'full-location' })}
                    className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-normal transition-all ${formData.reservationType === 'full-location' ? 'bg-primary text-(--color-on-primary) shadow-lg ' : 'text-(--color-text-muted) hover:text-(--color-text-primary)'}`}
                  >
                    Full Branch
                  </button>
                </div>
              </div>

              <PremiumSelect
                icon={MapPin}
                label="Assigned Branch"
                value={formData.locationId}
                onChange={val => setFormData({ ...formData, locationId: val })}
                placeholder="Select Branch"
                options={locations.map(loc => ({ label: loc.name || loc.city, value: loc._id }))}
              />
            </div>

            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) ml-1">Date</label>
                <div className="relative">
                  <input
                    required
                    type="date"
                    className="w-full bg-(--color-surface) border border-(--color-border) rounded-xl px-5 py-4 focus:ring-2 focus:ring-primary/30 outline-none text-(--color-text-primary) font-bold"
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                  />
                  <Calendar className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-(--color-text-muted)" size={18} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) ml-1">Start Time</label>
                <div className="relative">
                  <input
                    required
                    type="time"
                    className="w-full bg-(--color-surface) border border-(--color-border) rounded-xl px-5 py-4 focus:ring-2 focus:ring-primary/30 outline-none text-(--color-text-primary) font-bold"
                    value={formData.startTime}
                    onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                  />
                  <Clock className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-(--color-text-muted)" size={18} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) ml-1">End Time</label>
                <div className="relative">
                  <input
                    required
                    type="time"
                    className="w-full bg-(--color-surface) border border-(--color-border) rounded-xl px-5 py-4 focus:ring-2 focus:ring-primary/30 outline-none text-(--color-text-primary) font-bold"
                    value={formData.endTime}
                    onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                  />
                  <Clock className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-(--color-text-muted)" size={18} />
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
                  <div className="h-8 w-8 rounded-lg bg-(--color-text-muted)/10 flex items-center justify-center text-(--color-text-muted)">
                    <LayoutGrid size={16} />
                  </div>
                  <h4 className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Select Tables</h4>
                </div>
                {formData.tableIds.length > 0 && (
                  <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-4 py-1.5 rounded-full uppercase tracking-normal">
                    {formData.tableIds.length} Tables Selected
                  </span>
                )}
              </div>

              <div className="p-6 bg-(--color-bg-soft) border border-(--color-border) rounded-xl">
                {tables.length === 0 ? (
                  <div className="py-10 text-center opacity-50 italic">No tables found for this branch.</div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
                    {tables.map(table => {
                      const isSelected = formData.tableIds.includes(table._id);
                      return (
                        <button
                          key={table._id}
                          type="button"
                          onClick={() => handleTableToggle(table._id)}
                          className={`relative group h-24 rounded-[1.5rem] border-2 flex flex-col items-center justify-center gap-1 transition-all duration-300 ${isSelected
                              ? 'bg-primary border-primary text-(--color-on-primary) shadow-sm  -translate-y-1'
                              : 'bg-(--color-surface) border-(--color-border) text-(--color-text-muted) hover:border-primary/50 hover:bg-primary/5'
                            }`}
                        >
                          <Users size={16} className={isSelected ? 'text-(--color-on-primary)' : 'text-(--color-text-muted)'} />
                          <span className={`text-base font-bold leading-none ${isSelected ? 'text-(--color-on-primary)' : ''}`}>T{table.tableNumber}</span>
                          <span className={`text-[9px] font-bold uppercase tracking-tight ${isSelected ? 'text-(--color-on-primary)/60' : 'text-(--color-text-muted)'}`}>{table.seats || 2} SEATS</span>
                          {isSelected && (
                            <div className="absolute -top-1.5 -right-1.5 h-6 w-6 bg-black rounded-full flex items-center justify-center text-primary shadow-lg ring-4 ring-primary">
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
              className={`p-6 rounded-xl border-2 flex items-center gap-5 ${checkingAvailability ? 'bg-(--color-bg-soft) border-(--color-border) text-(--color-text-muted)' :
                  availabilityStatus?.available ? 'bg-success/10 border-success/20 text-success' :
                    'bg-danger/10 border-danger/20 text-danger'
                }`}
            >
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${checkingAvailability ? 'bg-(--color-border)' :
                  availabilityStatus?.available ? 'bg-success/20' :
                    'bg-danger/20'
                }`}>
                {checkingAvailability ? (
                  <Loader2 className="animate-spin text-(--color-text-muted)" size={24} />
                ) : availabilityStatus?.available ? (
                  <CheckCircle2 size={24} />
                ) : (
                  <AlertTriangle size={24} />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold uppercase tracking-normal mb-1">Availability Check</p>
                <p className="text-xs font-bold opacity-80">
                  {checkingAvailability ? 'Checking availability...' : availabilityStatus?.message}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step 3: Customer & Payment */}
        <section className="pt-10 border-t border-(--color-border) grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Users className="text-primary" size={20} />
              <h4 className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Customer Details</h4>
            </div>
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) ml-1">Customer Full Name</label>
                <input
                  required
                  type="text"
                  className="w-full bg-(--color-surface) border border-(--color-border) rounded-xl px-5 py-4 focus:ring-2 focus:ring-primary/30 outline-none text-(--color-text-primary) font-bold"
                  value={formData.customerName}
                  onChange={e => setFormData({ ...formData, customerName: e.target.value })}
                  placeholder="e.g. John Wick"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) ml-1">Phone Number</label>
                <div className="relative">
                  <input
                    required
                    type="tel"
                    className="w-full bg-(--color-surface) border border-(--color-border) rounded-xl pl-12 pr-5 py-4 focus:ring-2 focus:ring-primary/30 outline-none text-(--color-text-primary) font-bold"
                    value={formData.customerPhone}
                    onChange={e => setFormData({ ...formData, customerPhone: e.target.value })}
                    placeholder="+91 XXXXX XXXXX"
                  />
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-(--color-text-muted)" size={18} />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <CreditCard className="text-primary" size={20} />
              <h4 className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Payment Details</h4>
            </div>
            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) ml-1">Total Amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-(--color-text-muted) font-bold">₹</span>
                  <input
                    type="number"
                    className="w-full bg-(--color-surface) border border-(--color-border) rounded-xl pl-10 pr-5 py-4 focus:ring-2 focus:ring-primary/30 outline-none text-(--color-text-primary) font-bold"
                    value={formData.totalAmount}
                    onChange={e => setFormData({ ...formData, totalAmount: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) ml-1">Advance Payment</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-(--color-text-muted) font-bold">₹</span>
                  <input
                    type="number"
                    className="w-full bg-(--color-surface) border border-(--color-border) rounded-xl pl-10 pr-5 py-4 focus:ring-2 focus:ring-primary/30 outline-none text-(--color-text-primary) font-bold"
                    value={formData.advancePayment}
                    onChange={e => setFormData({ ...formData, advancePayment: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>
            <PremiumSelect
              label="Payment Status"
              value={formData.paymentStatus}
              onChange={val => setFormData({ ...formData, paymentStatus: val })}
              options={[
                { label: 'Pending', value: 'pending' },
                { label: 'Partial Payment', value: 'partial' },
                { label: 'Paid', value: 'paid' }
              ]}
            />
          </div>
        </section>

        {/* Footer Actions - Fixed-style with backdrop blur */}
        <div className="pt-8 flex items-center justify-end gap-6 border-t border-(--color-border)">
          <button
            type="button"
            onClick={onClose}
            className="px-8 py-4 text-xs font-bold uppercase tracking-normal text-(--color-text-muted) hover:text-danger transition-all"
          >
            Cancel
          </button>
          <button
            disabled={loading || (availabilityStatus && !availabilityStatus.available)}
            type="submit"
            className="px-10 py-5 bg-primary hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed text-(--color-on-primary) font-bold rounded-xl transition-all shadow-sm  flex items-center gap-3 uppercase tracking-normal text-xs"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} strokeWidth={3} />}
            {editData ? 'Update Reservation' : 'Book Reservation'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
