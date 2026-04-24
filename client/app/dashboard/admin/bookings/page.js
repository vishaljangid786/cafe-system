'use client';
import {
  Calendar, Clock, Users,
  CheckCircle2, XCircle, AlertCircle,
  Mail, Phone, MapPin, CalendarDays, Zap,
  Check, X, MessageSquare, LayoutGrid, List
} from 'lucide-react';
import { PageTransition, SlideIn, CardHover } from '../../../components/ui/AnimatedContainer';
import Modal from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Card, CardTitle, CardDescription } from '../../../components/ui/Card';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useEffect, useState } from 'react';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';

export default function BookingsManagementPage() {
  const { user, selectedLocation, globalSearch } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'

  // Filter states
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);

  // Modal state
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const params = {
        date: dateFilter,
        locationId: selectedLocation?._id || selectedLocation
      };
      if (statusFilter !== 'All') params.status = statusFilter.toLowerCase();

      const res = await api.get('/bookings', { params });
      setBookings(res.data.data);
    } catch (error) {
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [selectedLocation, dateFilter, statusFilter]);

  const updateStatus = async (id, status) => {
    const loadToast = toast.loading(`Updating status to ${status}...`);
    try {
      await api.patch(`/bookings/${id}/status`, { status });
      toast.success(`Booking ${status}`, { id: loadToast });
      fetchBookings();
      setShowDetailModal(false);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Update failed', { id: loadToast });
    }
  };

  const filteredBookings = bookings.filter(booking => {
    if (!globalSearch) return true;
    const searchLower = globalSearch.toLowerCase();
    return booking.userId?.name?.toLowerCase().includes(searchLower) ||
      booking.userId?.email?.toLowerCase().includes(searchLower);
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'cancelled': return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      case 'completed': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default: return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    }
  };

  if (loading && bookings.length === 0) return (
    <div className="flex justify-center items-center h-96">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
    </div>
  );

  return (
    <PageTransition>
      <div className="space-y-8 pb-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-4xl font-black tracking-tighter flex items-center gap-4 text-zinc-900 dark:text-zinc-100">
              <CalendarDays className="text-amber-600" size={36} strokeWidth={2.5} />
              Booking <span className="text-amber-600">List</span>
            </h1>
            <p className="text-zinc-500 font-medium mt-1">Manage and track all customer table bookings.</p>
          </div>

          <div className="flex gap-3 bg-zinc-100 dark:bg-zinc-900/50 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800'}`}
            >
              <List size={20} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2.5 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800'}`}
            >
              <LayoutGrid size={20} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <SlideIn direction="down">
          <div className="bg-white/40 dark:bg-zinc-900/50 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6 backdrop-blur-md transition-colors">
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="flex gap-4 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" size={18} />
                  <input
                    type="date"
                    className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none font-bold text-sm text-zinc-900 dark:text-zinc-100 appearance-none"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                  />
                </div>
                <select
                  className="flex-1 md:w-48 px-6 py-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none font-bold text-sm text-zinc-900 dark:text-zinc-100 appearance-none"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="All">All Status</option>
                  <option value="Pending">Pending</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Cancelled">Cancelled</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            </div>
          </div>
        </SlideIn>

        {viewMode === 'list' ? (
          /* List View */
          <div className="bg-white/40 dark:bg-zinc-900/30 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm backdrop-blur-md transition-colors">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-zinc-50/50 dark:bg-zinc-950/50 border-b border-zinc-100 dark:border-zinc-800">
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Customer</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Time & Date</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Guests</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Status</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                  {filteredBookings.map((booking, i) => (
                    <motion.tr
                      key={booking._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="hover:bg-zinc-800/20 transition-colors group"
                    >
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-amber-500 font-black text-xs border border-zinc-200 dark:border-zinc-700">
                            {booking.userId?.name?.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-black text-zinc-900 dark:text-zinc-100 leading-none">{booking.userId?.name}</p>
                            <p className="text-[10px] text-zinc-500 font-medium mt-1">{booking.userId?.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">
                            <Clock size={14} className="text-amber-500" />
                            {booking.startTime} — {booking.endTime}
                          </div>
                          <div className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">
                            {new Date(booking.date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2 text-xs font-black text-zinc-900 dark:text-zinc-100">
                          <Users size={16} className="text-zinc-500" />
                          {booking.numberOfGuests} Persons
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 w-fit border ${getStatusColor(booking.status)}`}>
                          {booking.status === 'confirmed' ? <CheckCircle2 size={10} /> : booking.status === 'cancelled' ? <XCircle size={10} /> : <AlertCircle size={10} />}
                          {booking.status}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex justify-end gap-2">
                          {booking.status === 'pending' && (
                            <>
                              <button
                                onClick={() => updateStatus(booking._id, 'confirmed')}
                                className="p-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white transition-all"
                              >
                                <Check size={16} />
                              </button>
                              <button
                                onClick={() => updateStatus(booking._id, 'cancelled')}
                                className="p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white transition-all"
                              >
                                <X size={16} />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => { setSelectedBooking(booking); setShowDetailModal(true); }}
                            className="p-2.5 rounded-xl bg-zinc-800 hover:bg-amber-600 text-zinc-400 hover:text-white transition-all"
                          >
                            <Zap size={16} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredBookings.map((booking, i) => (
              <SlideIn key={booking._id} delay={i * 0.05}>
                <CardHover>
                  <Card className="!p-8 group relative overflow-hidden border-zinc-200 dark:border-zinc-800 bg-white/40 dark:bg-zinc-900/50 shadow-sm transition-colors">
                    <div className={`absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity`}>
                      <CalendarDays size={80} className="text-amber-500" />
                    </div>

                    <div className="flex items-center gap-4 mb-8">
                      <div className="h-12 w-12 rounded-2xl bg-amber-600/10 border border-amber-600/20 flex items-center justify-center text-amber-500 font-black">
                        {booking.userId?.name?.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-100 tracking-tight leading-none">{booking.userId?.name}</h3>
                        <span className={`mt-2 inline-block px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-[0.2em] border ${getStatusColor(booking.status)}`}>
                          {booking.status}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-3 text-zinc-400">
                        <Clock size={16} className="text-amber-500" />
                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{booking.startTime} — {booking.endTime}</span>
                      </div>
                      <div className="flex items-center gap-3 text-zinc-400">
                        <Users size={16} className="text-amber-500" />
                        <span className="text-xs font-bold text-zinc-100">{booking.numberOfGuests} Persons</span>
                      </div>
                      <div className="flex items-center gap-3 text-zinc-400">
                        <MapPin size={16} className="text-amber-500" />
                        <span className="text-xs font-bold text-zinc-100 truncate">{booking.locationId?.name}</span>
                      </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800/50 flex gap-2">
                      {booking.status === 'pending' ? (
                        <>
                          <button
                            onClick={() => updateStatus(booking._id, 'confirmed')}
                            className="flex-1 py-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all border border-emerald-500/20"
                          >
                            Authorize
                          </button>
                          <button
                            onClick={() => updateStatus(booking._id, 'cancelled')}
                            className="flex-1 py-3 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all border border-rose-500/20"
                          >
                            Deny
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => { setSelectedBooking(booking); setShowDetailModal(true); }}
                          className="w-full py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-amber-600 text-zinc-600 dark:text-zinc-400 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                          View Details
                        </button>
                      )}
                    </div>
                  </Card>
                </CardHover>
              </SlideIn>
            ))}
          </div>
        )}

        {/* Detail Modal */}
        <Modal
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          title="Booking Details"
          className="max-w-2xl"
        >
          {selectedBooking && (
            <div className="space-y-10">
              <div className="grid grid-cols-2 gap-10">
                <div className="space-y-6">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Customer Details</h4>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Users size={18} className="text-amber-500" />
                      <div>
                        <p className="text-sm font-black text-zinc-900 dark:text-zinc-100">{selectedBooking.userId?.name}</p>
                        <p className="text-xs text-zinc-500">
                          {selectedBooking.userId?.role === 'location_admin' || selectedBooking.userId?.role === 'branch_admin' ? 'Branch Admin' : selectedBooking.userId?.role?.replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Mail size={18} className="text-amber-500" />
                      <p className="text-xs text-zinc-400 font-bold">{selectedBooking.userId?.email}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone size={18} className="text-amber-500" />
                      <p className="text-xs text-zinc-400 font-bold">{selectedBooking.userId?.phone || 'No contact provided'}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Booking Time</h4>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Calendar size={18} className="text-amber-500" />
                      <p className="text-sm font-black text-zinc-900 dark:text-zinc-100">{new Date(selectedBooking.date).toLocaleDateString(undefined, { dateStyle: 'full' })}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock size={18} className="text-amber-500" />
                      <p className="text-sm font-black text-zinc-100 tracking-widest">{selectedBooking.startTime} — {selectedBooking.endTime}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Users size={18} className="text-amber-500" />
                      <p className="text-sm font-black text-zinc-100">{selectedBooking.numberOfGuests} Persons</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-500 flex items-center gap-2">
                  <MessageSquare size={14} /> Customer Notes
                </h4>
                <p className="text-sm text-zinc-300 font-medium leading-relaxed">
                  {selectedBooking.specialRequests || "No extra notes for this booking."}
                </p>
              </div>

              <div className="flex gap-4">
                {selectedBooking.status === 'pending' ? (
                  <>
                    <Button
                      variant="primary"
                      icon={Check}
                      className="flex-1 !py-5 shadow-2xl shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => updateStatus(selectedBooking._id, 'confirmed')}
                    >
                      Confirm Booking
                    </Button>
                    <Button
                      variant="outline"
                      icon={X}
                      className="flex-1 !py-5 text-rose-500 border-rose-500/20 hover:bg-rose-500/10"
                      onClick={() => updateStatus(selectedBooking._id, 'cancelled')}
                    >
                      Cancel Booking
                    </Button>
                  </>
                ) : selectedBooking.status === 'confirmed' ? (
                  <Button
                    variant="primary"
                    icon={CheckCircle2}
                    className="w-full !py-5 bg-blue-600 hover:bg-blue-700"
                    onClick={() => updateStatus(selectedBooking._id, 'completed')}
                  >
                    Mark as Completed
                  </Button>
                ) : (
                  <div className={`w-full py-5 text-center rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] border ${getStatusColor(selectedBooking.status)}`}>
                    Booking {selectedBooking.status}
                  </div>
                )}
              </div>
            </div>
          )}
        </Modal>

        {filteredBookings.length === 0 && !loading && (
          <div className="text-center py-32 bg-amber-600/[0.02] rounded-[4rem] border border-dashed border-zinc-800">
            <Calendar size={64} className="mx-auto text-zinc-800 mb-6" strokeWidth={1} />
            <h3 className="text-2xl font-black text-zinc-100 tracking-tight">No Bookings Found</h3>
            <p className="text-zinc-500 font-medium mt-2 max-w-sm mx-auto">The list is currently empty for the selected filters.</p>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
