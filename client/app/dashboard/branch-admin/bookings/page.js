'use client';
import { useState, useEffect } from 'react';
import api from '../../../services/api';
import { PageTransition, SlideIn } from '../../../components/ui/AnimatedContainer';
import { CardSkeleton } from '../../../components/ui/Skeleton';
import { CalendarDays, CheckCircle, XCircle, Clock, Users, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

export default function BranchAdminBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('');
  const [processingId, setProcessingId] = useState(null);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const params = {};
      if (dateFilter) params.date = dateFilter;
      
      const res = await api.get('/bookings', { params });
      setBookings(res.data.data);
    } catch (error) {
      toast.error('Failed to fetch bookings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [dateFilter]);

  const updateStatus = async (id, status) => {
    setProcessingId(id);
    try {
      await api.patch(`/bookings/${id}/status`, { status });
      toast.success(`Booking ${status} successfully`);
      fetchBookings(); // Refresh
    } catch (error) {
      toast.error(error.response?.data?.message || 'Action failed');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading && bookings.length === 0) {
    return (
      <div className="space-y-4">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="space-y-8">
        <SlideIn direction="down">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="text-3xl font-black tracking-tight flex items-center">
                <CalendarDays className="mr-3 text-amber-600" size={32} /> 
                Reservations <span className="ml-2 text-amber-600">Hub</span>
              </h1>
              <p className="text-muted-foreground text-sm font-medium mt-1">Manage cafe reservations for your location</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <CalendarDays size={16} className="text-muted-foreground" />
                </div>
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-border rounded-xl text-sm font-bold shadow-sm focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
            </div>
          </div>
        </SlideIn>

        <SlideIn direction="up" delay={0.1}>
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-900 border-b border-border text-xs uppercase tracking-widest text-muted-foreground">
                    <th className="px-6 py-4 font-black">Customer</th>
                    <th className="px-6 py-4 font-black">Date & Time</th>
                    <th className="px-6 py-4 font-black">Guests</th>
                    <th className="px-6 py-4 font-black">Status</th>
                    <th className="px-6 py-4 font-black text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <AnimatePresence>
                    {bookings.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-6 py-12 text-center text-muted-foreground">
                          No reservations found for the selected date.
                        </td>
                      </tr>
                    ) : (
                      bookings.map((booking) => (
                        <motion.tr 
                          key={booking._id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className="font-bold">{booking.userId?.name}</div>
                            <div className="text-xs text-muted-foreground">{booking.userId?.email}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-medium text-sm">{new Date(booking.date).toLocaleDateString()}</div>
                            <div className="text-xs text-muted-foreground flex items-center mt-1">
                              <Clock size={12} className="mr-1" /> {booking.startTime} - {booking.endTime}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center text-sm font-bold">
                              <Users size={14} className="mr-2 text-amber-500" />
                              {booking.numberOfGuests}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                              booking.status === 'confirmed' ? 'bg-green-50 text-green-600 border-green-200 dark:bg-green-500/10 dark:border-green-500/20' :
                              booking.status === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20' :
                              'bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:border-red-500/20'
                            }`}>
                              {booking.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            {booking.status === 'pending' && (
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => updateStatus(booking._id, 'confirmed')}
                                  disabled={processingId === booking._id}
                                  className="p-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg transition-colors border border-green-200 dark:bg-green-500/10 dark:border-green-500/20"
                                  title="Approve"
                                >
                                  {processingId === booking._id ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                                </button>
                                <button
                                  onClick={() => updateStatus(booking._id, 'cancelled')}
                                  disabled={processingId === booking._id}
                                  className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors border border-red-200 dark:bg-red-500/10 dark:border-red-500/20"
                                  title="Reject"
                                >
                                  {processingId === booking._id ? <Loader2 size={18} className="animate-spin" /> : <XCircle size={18} />}
                                </button>
                              </div>
                            )}
                            {booking.status === 'confirmed' && (
                              <button
                                onClick={() => updateStatus(booking._id, 'cancelled')}
                                disabled={processingId === booking._id}
                                className="text-xs font-bold text-red-500 hover:text-red-700 uppercase tracking-wider"
                              >
                                Cancel
                              </button>
                            )}
                          </td>
                        </motion.tr>
                      ))
                    )}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>
        </SlideIn>
      </div>
    </PageTransition>
  );
}
