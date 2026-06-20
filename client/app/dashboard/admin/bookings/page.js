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
import PremiumSelect from '../../../components/ui/PremiumSelect';
import { LoaderBlock } from '@/app/components/ui/Spinner';

export default function BookingsManagementPage() {
  const { user, selectedLocation, globalSearch } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 20;

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
      if (globalSearch) params.search = globalSearch;

      const res = await api.get(`/bookings?page=${currentPage}&limit=${itemsPerPage}`, { params });
      setBookings(res.data.data);
      setTotalPages(res.data.pagination.pages);
    } catch (error) {
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchBookings();
    }, 0);

    return () => clearTimeout(timer);
  }, [selectedLocation, dateFilter, statusFilter, currentPage, globalSearch]);

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

  const filteredBookings = bookings;

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed': return 'bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/20';
      case 'cancelled': return 'bg-[var(--color-danger)]/10 text-[var(--color-danger)] border-[var(--color-danger)]/20';
      case 'completed': return 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/20';
      default: return 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/20';
    }
  };

  if (loading && bookings.length === 0) return (
    <LoaderBlock label="Loading Bookings" minHeight="24rem" />
  );

  return (
    <PageTransition>
      <div className="space-y-8 pb-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-4xl font-black tracking-tighter flex items-center gap-4 text-[var(--color-text-primary)]">
              <CalendarDays className="text-[var(--color-primary)]" size={36} strokeWidth={2.5} />
              Booking <span className="text-[var(--color-primary)]">List</span>
            </h1>
            <p className="text-[var(--color-text-muted)] font-medium mt-1">Manage and track all customer table bookings.</p>
          </div>

          <div className="flex gap-3 bg-[var(--color-surface-soft)] p-1.5 rounded-2xl border border-[var(--color-border)] shadow-sm">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-[var(--color-primary)] text-black dark:text-black shadow-lg shadow-[var(--color-primary)]/20' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-soft)]'}`}
            >
              <List size={20} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2.5 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-[var(--color-primary)] text-black dark:text-black shadow-lg shadow-[var(--color-primary)]/20' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-soft)]'}`}
            >
              <LayoutGrid size={20} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <SlideIn direction="down">
          <div className="bg-[var(--color-surface)]/40 p-8 rounded-[2.5rem] border border-[var(--color-border)] shadow-sm space-y-6 backdrop-blur-md transition-colors">
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="flex gap-4 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={18} />
                  <input
                    type="date"
                    className="w-full pl-12 pr-4 py-4 bg-[var(--color-bg-soft)] border border-[var(--color-border)] rounded-2xl focus:ring-2 focus:ring-[var(--color-primary)] outline-none font-bold text-sm text-[var(--color-text-primary)] appearance-none"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                  />
                </div>
                <PremiumSelect 
                  label="Status"
                  value={statusFilter}
                  onChange={(val) => setStatusFilter(val)}
                  options={[
                    { label: 'All Status', value: 'All' },
                    { label: 'Pending', value: 'Pending' },
                    { label: 'Confirmed', value: 'Confirmed' },
                    { label: 'Cancelled', value: 'Cancelled' },
                    { label: 'Completed', value: 'Completed' }
                  ]}
                />
              </div>
            </div>
          </div>
        </SlideIn>

        {viewMode === 'list' ? (
          /* List View */
          <div className="bg-[var(--color-surface)]/40 rounded-[2.5rem] border border-[var(--color-border)] overflow-hidden shadow-sm backdrop-blur-md transition-colors">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-[var(--color-surface-soft)] border-b border-[var(--color-border)]">
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Customer</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Time & Date</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Guests</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Status</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {filteredBookings.map((booking, i) => (
                    <motion.tr
                      key={booking._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="hover:bg-blue-500/[0.02] transition-colors group"
                    >
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-xl bg-[var(--color-surface-soft)] flex items-center justify-center text-[var(--color-primary)] font-black text-xs border border-[var(--color-border)]">
                            {booking.userId?.name?.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-black text-[var(--color-text-primary)] leading-none">{booking.userId?.name}</p>
                            <p className="text-[10px] text-[var(--color-text-muted)] font-medium mt-1">{booking.userId?.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs font-bold text-[var(--color-text-primary)] uppercase tracking-tight">
                            <Clock size={14} className="text-[var(--color-primary)]" />
                            {booking.startTime} — {booking.endTime}
                          </div>
                          <div className="text-[10px] text-[var(--color-text-muted)] font-black uppercase tracking-widest">
                            {new Date(booking.date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2 text-xs font-black text-[var(--color-text-primary)]">
                          <Users size={16} className="text-[var(--color-text-muted)]" />
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
                                className="p-2.5 rounded-xl bg-[var(--color-success)]/10 hover:bg-[var(--color-success)] text-[var(--color-success)] hover:text-black dark:hover:text-black transition-all"
                              >
                                <Check size={16} />
                              </button>
                              <button
                                onClick={() => updateStatus(booking._id, 'cancelled')}
                                className="p-2.5 rounded-xl bg-[var(--color-danger)]/10 hover:bg-[var(--color-danger)] text-[var(--color-danger)] hover:text-white transition-all"
                              >
                                <X size={16} />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => { setSelectedBooking(booking); setShowDetailModal(true); }}
                            className="p-2.5 rounded-xl bg-[var(--color-bg-soft)] hover:bg-[var(--color-primary)] text-[var(--color-text-muted)] hover:text-black dark:hover:text-black transition-all border border-[var(--color-border)]"
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
                  <Card className="!p-8 group relative overflow-hidden border-[var(--color-border)] bg-[var(--color-surface)]/40 shadow-sm transition-colors">
                    <div className={`absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity`}>
                      <CalendarDays size={80} className="text-[var(--color-primary)]" />
                    </div>

                    <div className="flex items-center gap-4 mb-8">
                      <div className="h-12 w-12 rounded-2xl bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 flex items-center justify-center text-[var(--color-primary)] font-black">
                        {booking.userId?.name?.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-[var(--color-text-primary)] tracking-tight leading-none">{booking.userId?.name}</h3>
                        <span className={`mt-2 inline-block px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-[0.2em] border ${getStatusColor(booking.status)}`}>
                          {booking.status}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-3 text-[var(--color-text-muted)]">
                        <Clock size={16} className="text-[var(--color-primary)]" />
                        <span className="text-xs font-bold text-[var(--color-text-primary)]">{booking.startTime} — {booking.endTime}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[var(--color-text-muted)]">
                        <Users size={16} className="text-[var(--color-primary)]" />
                        <span className="text-xs font-bold text-[var(--color-text-primary)]">{booking.numberOfGuests} Persons</span>
                      </div>
                      <div className="flex items-center gap-3 text-[var(--color-text-muted)]">
                        <MapPin size={16} className="text-[var(--color-primary)]" />
                        <span className="text-xs font-bold text-[var(--color-text-primary)] truncate">{booking.locationId?.name}</span>
                      </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-[var(--color-border)] flex gap-2">
                      {booking.status === 'pending' ? (
                        <>
                          <button
                            onClick={() => updateStatus(booking._id, 'confirmed')}
                            className="flex-1 py-3 rounded-xl bg-[var(--color-success)]/10 hover:bg-[var(--color-success)] text-[var(--color-success)] hover:text-black dark:hover:text-black text-[10px] font-black uppercase tracking-widest transition-all border border-[var(--color-success)]/20"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => updateStatus(booking._id, 'cancelled')}
                            className="flex-1 py-3 rounded-xl bg-[var(--color-danger)]/10 hover:bg-[var(--color-danger)] text-[var(--color-danger)] hover:text-white text-[10px] font-black uppercase tracking-widest transition-all border border-[var(--color-danger)]/20"
                          >
                            Deny
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => { setSelectedBooking(booking); setShowDetailModal(true); }}
                          className="w-full py-3 rounded-xl bg-[var(--color-surface-soft)] hover:bg-[var(--color-primary)] text-[var(--color-text-muted)] hover:text-black dark:hover:text-black text-[10px] font-black uppercase tracking-widest transition-all"
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
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Customer Details</h4>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Users size={18} className="text-[var(--color-primary)]" />
                      <div>
                        <p className="text-sm font-black text-[var(--color-text-primary)]">{selectedBooking.userId?.name}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {selectedBooking.userId?.role === 'location_admin' || selectedBooking.userId?.role === 'branch_admin' ? 'Branch Admin' : selectedBooking.userId?.role?.replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Mail size={18} className="text-[var(--color-primary)]" />
                      <p className="text-xs text-[var(--color-text-muted)] font-bold">{selectedBooking.userId?.email}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone size={18} className="text-[var(--color-primary)]" />
                      <p className="text-xs text-[var(--color-text-muted)] font-bold">{selectedBooking.userId?.phone || 'No contact provided'}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Booking Time</h4>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Calendar size={18} className="text-[var(--color-primary)]" />
                      <p className="text-sm font-black text-[var(--color-text-primary)]">{new Date(selectedBooking.date).toLocaleDateString(undefined, { dateStyle: 'full' })}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock size={18} className="text-[var(--color-primary)]" />
                      <p className="text-sm font-black text-[var(--color-text-primary)] tracking-widest">{selectedBooking.startTime} — {selectedBooking.endTime}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Users size={18} className="text-[var(--color-primary)]" />
                      <p className="text-sm font-black text-[var(--color-text-primary)]">{selectedBooking.numberOfGuests} Persons</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-[var(--color-bg-soft)] border border-[var(--color-border)] rounded-3xl space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-primary)] flex items-center gap-2">
                  <MessageSquare size={14} /> Customer Notes
                </h4>
                <p className="text-sm text-[var(--color-text-secondary)] font-medium leading-relaxed">
                  {selectedBooking.specialRequests || "No extra notes for this booking."}
                </p>
              </div>

              <div className="flex gap-4">
                {selectedBooking.status === 'pending' ? (
                  <>
                    <Button
                      variant="primary"
                      icon={Check}
                      className="flex-1 !py-5 shadow-2xl shadow-[var(--color-success)]/20 bg-[var(--color-success)] hover:bg-[var(--color-success-dark)] text-black dark:text-black"
                      onClick={() => updateStatus(selectedBooking._id, 'confirmed')}
                    >
                      Confirm Booking
                    </Button>
                    <Button
                      variant="outline"
                      icon={X}
                      className="flex-1 !py-5 text-[var(--color-danger)] border-[var(--color-danger)]/20 hover:bg-[var(--color-danger)]/10"
                      onClick={() => updateStatus(selectedBooking._id, 'cancelled')}
                    >
                      Cancel Booking
                    </Button>
                  </>
                ) : selectedBooking.status === 'confirmed' ? (
                  <Button
                    variant="primary"
                    icon={CheckCircle2}
                    className="w-full !py-5 bg-[var(--color-primary)] text-black dark:text-black hover:opacity-90"
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
          <div className="text-center py-32 bg-blue-600/[0.02] rounded-[4rem] border border-dashed border-[var(--color-border)]">
            <Calendar size={64} className="mx-auto text-[var(--color-text-muted)] mb-6" strokeWidth={1} />
            <h3 className="text-2xl font-black text-[var(--color-text-primary)] tracking-tight">No Bookings Found</h3>
            <p className="text-[var(--color-text-muted)] font-medium mt-2 max-w-sm mx-auto">The list is currently empty for the selected filters.</p>
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-8 py-6 bg-[var(--color-surface)]/40 rounded-[2.5rem] border border-[var(--color-border)] mt-10 shadow-sm backdrop-blur-md transition-colors">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
              System Rule Page {currentPage} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-4 py-2 rounded-xl bg-[var(--color-surface-soft)] border border-[var(--color-border)] text-[10px] font-black uppercase tracking-widest disabled:opacity-30 transition-all hover:bg-[var(--color-surface)] text-[var(--color-text-primary)]"
              >
                Prev Branch
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-4 py-2 rounded-xl bg-[var(--color-surface-soft)] border border-[var(--color-border)] text-[10px] font-black uppercase tracking-widest disabled:opacity-30 transition-all hover:bg-[var(--color-surface)] text-[var(--color-text-primary)]"
              >
                Next Branch
              </button>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
