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
import { useEffect, useState, useRef } from 'react';
import api from '../../../services/api';
import { todayInput } from '@/app/utils/dateInput';
import { useAuth } from '../../../context/AuthContext';
import { can } from '@/app/config/actions';
import PremiumSelect from '../../../components/ui/PremiumSelect';
import { LoaderBlock } from '@/app/components/ui/Spinner';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { progress } from '@/app/components/ui/TopProgressBar';
import { TableSkeleton, CardSkeleton } from '@/app/components/ui/Skeleton';

export default function BookingsManagementPage() {
  const { user, selectedLocation, globalSearch } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const didInitRef = useRef(false);
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
    const isInitial = !didInitRef.current;
    if (isInitial) setLoading(true);
    else setRefetching(true);
    progress.start();
    try {
      const params = {
        date: dateFilter,
        locationId: selectedLocation?._id || selectedLocation
      };
      if (statusFilter !== 'All') params.status = statusFilter.toLowerCase();
      if (globalSearch) params.search = globalSearch;

      const res = await api.get(`/bookings?page=${currentPage}&limit=${itemsPerPage}`, { params });
      setBookings(res.data.data);
      setTotalPages(res.data.pagination?.pages || 1);
    } catch (error) {
      console.error('Could not load bookings. Please try again.');
    } finally {
      didInitRef.current = true;
      setLoading(false);
      setRefetching(false);
      progress.done();
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
      toast.error(error.response?.data?.message || 'Could not update the booking. Please try again.', { id: loadToast });
    }
  };

  const filteredBookings = bookings;

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed': return 'bg-success/10 text-success border-success/20';
      case 'cancelled': return 'bg-danger/10 text-danger border-danger/20';
      case 'completed': return 'bg-primary/10 text-primary border-primary/20';
      default: return 'bg-primary/10 text-primary border-primary/20';
    }
  };

  if (loading) return <LoadingScreen fullScreen={false} />;

  return (
    <PageTransition>
      <div className="space-y-6 pb-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight flex items-center gap-3 text-(--color-text-primary)">
              <CalendarDays className="text-primary" size={24} strokeWidth={2.5} />
              Booking <span className="text-primary">List</span>
            </h1>
            <p className="text-(--color-text-muted) font-medium mt-1">Manage and track all customer table bookings.</p>
          </div>

          <div className="flex gap-3 bg-(--color-surface-soft) p-1.5 rounded-xl border border-(--color-border) shadow-sm">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-primary text-(--color-on-primary) dark:text-(--color-on-primary) ' : 'text-(--color-text-muted) hover:text-(--color-text-primary) hover:bg-(--color-bg-soft)'}`}
            >
              <List size={20} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2.5 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-primary text-(--color-on-primary) dark:text-(--color-on-primary) ' : 'text-(--color-text-muted) hover:text-(--color-text-primary) hover:bg-(--color-bg-soft)'}`}
            >
              <LayoutGrid size={20} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <SlideIn direction="down">
          <div className="bg-(--color-surface)/40 p-5 rounded-xl border border-(--color-border) shadow-sm space-y-6  transition-colors">
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="flex gap-4 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-(--color-text-muted)" size={18} />
                  <input
                    type="date"
                    className="w-full pl-12 pr-4 py-2.5 bg-(--color-bg-soft) border border-(--color-border) rounded-xl focus:ring-2 focus:ring-primary outline-none font-medium text-sm text-(--color-text-primary) appearance-none"
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

        {refetching ? (
          viewMode === 'list' ? (
            <TableSkeleton rows={6} cols={5} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
            </div>
          )
        ) : viewMode === 'list' ? (
          /* List View */
          <div className="bg-(--color-surface)/40 rounded-xl border border-(--color-border) overflow-hidden shadow-sm  transition-colors">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-200">
                <thead>
                  <tr className="bg-(--color-surface-soft) border-b border-(--color-border)">
                    <th className="px-5 py-4 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Customer</th>
                    <th className="px-5 py-4 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Time & Date</th>
                    <th className="px-5 py-4 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Guests</th>
                    <th className="px-5 py-4 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Status</th>
                    <th className="px-5 py-4 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted) text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-(--color-border)">
                  {filteredBookings.map((booking, i) => (
                    <motion.tr
                      key={booking._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="hover:bg-primary/2 transition-colors group"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-xl bg-(--color-surface-soft) flex items-center justify-center text-primary font-medium text-xs border border-(--color-border)">
                            {booking.userId?.name?.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-(--color-text-primary) leading-none">{booking.userId?.name}</p>
                            <p className="text-[11px] text-(--color-text-muted) font-medium mt-1">{booking.userId?.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs font-medium text-(--color-text-primary) tracking-tight">
                            <Clock size={14} className="text-primary" />
                            {booking.startTime} — {booking.endTime}
                          </div>
                          <div className="text-[11px] text-(--color-text-muted) font-medium tracking-normal">
                            {new Date(booking.date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 text-xs font-medium text-(--color-text-primary)">
                          <Users size={16} className="text-(--color-text-muted)" />
                          {booking.numberOfGuests} People
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium uppercase tracking-normal flex items-center gap-1.5 w-fit border ${getStatusColor(booking.status)}`}>
                          {booking.status === 'confirmed' ? <CheckCircle2 size={10} /> : booking.status === 'cancelled' ? <XCircle size={10} /> : <AlertCircle size={10} />}
                          {booking.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {booking.status === 'pending' && can(user, 'reservations.modify') && (
                            <>
                              <button
                                onClick={() => updateStatus(booking._id, 'confirmed')}
                                className="p-2.5 rounded-xl bg-success/10 hover:bg-[rgba(var(--color-success-rgb),0.12)] text-success hover:text-(--color-on-primary) dark:hover:text-(--color-on-primary) transition-all"
                              >
                                <Check size={16} />
                              </button>
                              <button
                                onClick={() => updateStatus(booking._id, 'cancelled')}
                                className="p-2.5 rounded-xl bg-danger/10 hover:bg-[rgba(var(--color-danger-rgb),0.12)] text-danger hover:text-white transition-all"
                              >
                                <X size={16} />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => { setSelectedBooking(booking); setShowDetailModal(true); }}
                            className="p-2.5 rounded-xl bg-(--color-bg-soft) hover:bg-primary text-(--color-text-muted) hover:text-(--color-on-primary) dark:hover:text-(--color-on-primary) transition-all border border-(--color-border)"
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
                  <Card className="p-5! group relative overflow-hidden border-(--color-border) bg-(--color-surface)/40 shadow-sm transition-colors">
                    <div className={`absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity`}>
                      <CalendarDays size={80} className="text-primary" />
                    </div>

                    <div className="flex items-center gap-4 mb-6">
                      <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-medium">
                        {booking.userId?.name?.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-(--color-text-primary) tracking-tight leading-none">{booking.userId?.name}</h3>
                        <span className={`mt-2 inline-block px-2 py-0.5 rounded-lg text-[11px] font-medium uppercase tracking-normal border ${getStatusColor(booking.status)}`}>
                          {booking.status}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-3 text-(--color-text-muted)">
                        <Clock size={16} className="text-primary" />
                        <span className="text-xs font-medium text-(--color-text-primary)">{booking.startTime} — {booking.endTime}</span>
                      </div>
                      <div className="flex items-center gap-3 text-(--color-text-muted)">
                        <Users size={16} className="text-primary" />
                        <span className="text-xs font-medium text-(--color-text-primary)">{booking.numberOfGuests} People</span>
                      </div>
                      <div className="flex items-center gap-3 text-(--color-text-muted)">
                        <MapPin size={16} className="text-primary" />
                        <span className="text-xs font-medium text-(--color-text-primary) truncate">{booking.locationId?.name}</span>
                      </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-(--color-border) flex gap-2">
                      {booking.status === 'pending' && can(user, 'reservations.modify') ? (
                        <>
                          <button
                            onClick={() => updateStatus(booking._id, 'confirmed')}
                            className="flex-1 py-3 rounded-xl bg-success/10 hover:bg-[rgba(var(--color-success-rgb),0.12)] text-success hover:text-(--color-on-primary) dark:hover:text-(--color-on-primary) text-[11px] font-medium uppercase tracking-normal transition-all border border-success/20"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => updateStatus(booking._id, 'cancelled')}
                            className="flex-1 py-3 rounded-xl bg-danger/10 hover:bg-[rgba(var(--color-danger-rgb),0.12)] text-danger hover:text-white text-[11px] font-medium uppercase tracking-normal transition-all border border-danger/20"
                          >
                            Deny
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => { setSelectedBooking(booking); setShowDetailModal(true); }}
                          className="w-full py-3 rounded-xl bg-(--color-surface-soft) hover:bg-primary text-(--color-text-muted) hover:text-(--color-on-primary) dark:hover:text-(--color-on-primary) text-[11px] font-medium uppercase tracking-normal transition-all"
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
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-6">
                  <h4 className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Customer Details</h4>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Users size={18} className="text-primary" />
                      <div>
                        <p className="text-sm font-medium text-(--color-text-primary)">{selectedBooking.userId?.name}</p>
                        <p className="text-xs text-(--color-text-muted)">
                          {selectedBooking.userId?.role === 'location_admin' || selectedBooking.userId?.role === 'branch_admin' ? 'Branch Admin' : selectedBooking.userId?.role?.replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Mail size={18} className="text-primary" />
                      <p className="text-xs text-(--color-text-muted) font-medium">{selectedBooking.userId?.email}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone size={18} className="text-primary" />
                      <p className="text-xs text-(--color-text-muted) font-medium">{selectedBooking.userId?.phone || 'No phone number provided'}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h4 className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Booking Time</h4>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Calendar size={18} className="text-primary" />
                      <p className="text-sm font-medium text-(--color-text-primary)">{new Date(selectedBooking.date).toLocaleDateString(undefined, { dateStyle: 'full' })}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock size={18} className="text-primary" />
                      <p className="text-sm font-medium text-(--color-text-primary) tracking-normal">{selectedBooking.startTime} — {selectedBooking.endTime}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Users size={18} className="text-primary" />
                      <p className="text-sm font-medium text-(--color-text-primary)">{selectedBooking.numberOfGuests} People</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5 bg-(--color-bg-soft) border border-(--color-border) rounded-xl space-y-3">
                <h4 className="text-[11px] font-medium uppercase tracking-normal text-primary flex items-center gap-2">
                  <MessageSquare size={14} /> Customer Notes
                </h4>
                <p className="text-sm text-(--color-text-secondary) font-medium leading-relaxed">
                  {selectedBooking.specialRequests || "No extra notes for this booking."}
                </p>
              </div>

              <div className="flex gap-4">
                {selectedBooking.status === 'pending' && can(user, 'reservations.modify') ? (
                  <>
                    <Button
                      variant="primary"
                      icon={Check}
                      className="flex-1 py-3.5! shadow-sm  bg-success hover:bg-(--color-success-dark) text-(--color-on-primary) dark:text-(--color-on-primary)"
                      onClick={() => updateStatus(selectedBooking._id, 'confirmed')}
                    >
                      Confirm Booking
                    </Button>
                    <Button
                      variant="outline"
                      icon={X}
                      className="flex-1 py-3.5! text-danger border-danger/20 hover:bg-danger/10"
                      onClick={() => updateStatus(selectedBooking._id, 'cancelled')}
                    >
                      Cancel Booking
                    </Button>
                  </>
                ) : selectedBooking.status === 'confirmed' && can(user, 'reservations.modify') ? (
                  <Button
                    variant="primary"
                    icon={CheckCircle2}
                    className="w-full py-3.5! bg-primary text-(--color-on-primary) dark:text-(--color-on-primary) hover:opacity-90"
                    onClick={() => updateStatus(selectedBooking._id, 'completed')}
                  >
                    Mark as Completed
                  </Button>
                ) : (
                  <div className={`w-full py-3.5 text-center rounded-xl text-[11px] font-medium uppercase tracking-normal border ${getStatusColor(selectedBooking.status)}`}>
                    Booking {selectedBooking.status}
                  </div>
                )}
              </div>
            </div>
          )}
        </Modal>

        {filteredBookings.length === 0 && !loading && !refetching && (
          <div className="text-center py-20 bg-primary/2 rounded-2xl border border-dashed border-(--color-border)">
            <Calendar size={48} className="mx-auto text-(--color-text-muted) mb-6" strokeWidth={1} />
            <h3 className="text-2xl font-semibold text-(--color-text-primary) tracking-tight">No Bookings Found</h3>
            <p className="text-(--color-text-muted) font-medium mt-2 max-w-sm mx-auto">The list is currently empty for the selected filters.</p>
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 bg-(--color-surface)/40 rounded-xl border border-(--color-border) mt-6 shadow-sm  transition-colors">
            <p className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-4 py-2 rounded-xl bg-(--color-surface-soft) border border-(--color-border) text-[11px] font-medium uppercase tracking-normal disabled:opacity-30 transition-all hover:bg-(--color-surface) text-(--color-text-primary)"
              >
                Previous
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-4 py-2 rounded-xl bg-(--color-surface-soft) border border-(--color-border) text-[11px] font-medium uppercase tracking-normal disabled:opacity-30 transition-all hover:bg-(--color-surface) text-(--color-text-primary)"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
