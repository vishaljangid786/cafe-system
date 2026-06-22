'use client';
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { progress } from '@/app/components/ui/TopProgressBar';
import { TableSkeleton } from '@/app/components/ui/Skeleton';
import { 
  CalendarDays, Plus, Search, Filter, 
  MapPin, Clock, Users, Phone, 
  MoreVertical, CheckCircle2, XCircle, 
  AlertCircle, ChevronDown, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReservationForm from '../../components/reservations/ReservationForm';
import ReservationDetails from '../../components/reservations/ReservationDetails';
import { useAuth } from '../../context/AuthContext';
import { format } from 'date-fns';
import api from '../../services/api';
import ExportActions from '../../components/ui/ExportActions';
import PremiumSelect from '../../components/ui/PremiumSelect';

export default function ReservationsPage() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const didInitRef = useRef(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    locationId: '',
    date: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 20;
  const [locations, setLocations] = useState([]);
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const { user } = useAuth();

  const fetchReservations = async () => {
    const isInitial = !didInitRef.current;
    if (isInitial) setLoading(true);
    else setRefetching(true);
    progress.start();
    try {
      const params = {
        ...filters,
        search: searchTerm,
        page: currentPage,
        limit: itemsPerPage
      };
      const { data } = await api.get('/reservations', {
        params
      });
      setReservations(data.data);
      setTotalPages(data.pagination.pages);
    } catch (error) {
      console.error('Error fetching reservations:', error);
    } finally {
      didInitRef.current = true;
      setLoading(false);
      setRefetching(false);
      progress.done();
    }
  };

  const fetchLocations = async () => {
    try {
      const { data } = await api.get('/locations');
      setLocations(data.data);
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchReservations();
      fetchLocations();
    }, 0);

    return () => clearTimeout(timer);
  }, [filters, searchTerm, currentPage]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed': return 'bg-success/10 text-success border-success/20';
      case 'pending': return 'bg-primary/10 text-primary border-primary/20';
      case 'cancelled': return 'bg-danger/10 text-danger border-danger/20';
      default: return 'bg-(--color-text-muted)/10 text-(--color-text-muted) border-(--color-text-muted)/20';
    }
  };

  if (loading) return <LoadingScreen fullScreen={false} />;

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-(--color-text-primary) flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <CalendarDays size={24} />
            </div>
            Reservations
          </h1>
          <p className="text-(--color-text-secondary) mt-1">Manage table and full-location bookings across all branches.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <ExportActions 
            data={reservations} 
            columns={[
              { header: 'Event Name', key: 'eventName' },
              { header: 'Type', key: 'reservationType' },
              { header: 'Customer', key: 'customerName' },
              { header: 'Phone', key: 'customerPhone' },
              { header: 'Date', key: item => format(new Date(item.date), 'MMM dd, yyyy') },
              { header: 'Time', key: item => `${item.startTime} - ${item.endTime}` },
              { header: 'Location', key: item => item.locationId?.name || 'N/A' },
              { header: 'Total Amount', key: 'totalAmount' },
              { header: 'Status', key: 'status' }
            ]} 
            filename="reservations_report" 
          />
          <button 
            onClick={() => {
              setSelectedReservation(null);
              setIsFormOpen(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-secondary text-white font-bold rounded-xl transition-all shadow-lg "
          >
            <Plus size={20} />
            New Reservation
          </button>
        </div>
      </div>

      {/* Stats Quick View */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Bookings', value: reservations.length, icon: CalendarDays, color: 'var(--color-secondary)' },
          { label: 'Confirmed Today', value: reservations.filter(r => r.status === 'confirmed').length, icon: CheckCircle2, color: 'var(--color-success)' },
          { label: 'Pending Requests', value: reservations.filter(r => r.status === 'pending').length, icon: AlertCircle, color: 'var(--color-primary)' },
          { label: 'Cancelled', value: reservations.filter(r => r.status === 'cancelled').length, icon: XCircle, color: 'var(--color-danger)' },
        ].map((stat, i) => (
          <div key={i} className="glass-card p-4 rounded-xl border border-(--color-border)">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg" style={{ backgroundColor: `${stat.color}1a`, color: stat.color }}>
                <stat.icon size={20} />
              </div>
              <span className="text-2xl font-bold text-(--color-text-primary)">{stat.value}</span>
            </div>
            <p className="text-xs font-medium text-(--color-text-muted) mt-2 uppercase tracking-wider">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filters & Search */}
      <div className="glass-morphism p-6 rounded-xl border border-(--color-border) shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          <div className="md:col-span-5 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-(--color-text-muted)" size={18} />
            <input 
              type="text" 
              placeholder="Search by event, customer or phone..."
              className="w-full pl-12 pr-4 py-3 bg-(--color-surface) border border-(--color-border) rounded-xl text-sm font-medium text-(--color-text-primary) outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="md:col-span-3">
            <PremiumSelect 
              value={filters.locationId}
              onChange={(val) => setFilters({...filters, locationId: val})}
              options={[
                { label: 'All Branches', value: '' },
                ...locations.map(loc => ({ label: loc.name || loc.city, value: loc._id }))
              ]}
            />
          </div>

          <div className="md:col-span-2">
            <PremiumSelect 
              value={filters.status}
              onChange={(val) => setFilters({...filters, status: val})}
              options={[
                { label: 'All Statuses', value: '' },
                { label: 'Pending', value: 'pending' },
                { label: 'Confirmed', value: 'confirmed' },
                { label: 'Cancelled', value: 'cancelled' }
              ]}
            />
          </div>

          <div className="md:col-span-2">
            <input 
              type="date"
              className="w-full px-4 py-3 bg-(--color-surface) border border-(--color-border) rounded-xl text-sm font-medium text-(--color-text-primary) outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              value={filters.date}
              onChange={(e) => setFilters({...filters, date: e.target.value})}
            />
          </div>
        </div>
      </div>

      {/* Main Content Table */}
      <div className="glass-morphism rounded-xl border border-(--color-border) overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-(--color-surface-soft) text-(--color-text-muted) text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Event & Type</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Date & Time</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">Payment</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-(--color-border)">
              {refetching ? (
                <tr>
                  <td colSpan={7} className="p-0">
                    <TableSkeleton rows={6} cols={7} />
                  </td>
                </tr>
              ) : reservations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-(--color-text-muted)">
                    No reservations found matching your criteria.
                  </td>
                </tr>
              ) : (
                reservations.map((res) => (
                  <tr 
                    key={res._id} 
                    onClick={() => {
                      setSelectedReservation(res);
                      setIsDetailsOpen(true);
                    }}
                    className="hover:bg-(--color-surface-soft)/60 transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div className="font-bold text-(--color-text-primary)">{res.eventName}</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${res.reservationType === 'full-location' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-primary/10 text-primary border-primary/20'}`}>
                          {res.reservationType === 'full-location' ? 'Full Location' : 'Table Booking'}
                        </span>
                        {res.reservationType === 'table' && (
                          <span className="text-[10px] text-(--color-text-muted)">
                            {res.tableIds?.length} Tables
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-sm">{res.customerName}</div>
                      <div className="flex items-center gap-1 text-xs text-(--color-text-muted) mt-0.5">
                        <Phone size={12} />
                        {res.customerPhone}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium">{format(new Date(res.date), 'MMM dd, yyyy')}</div>
                      <div className="flex items-center gap-1 text-xs text-(--color-text-muted) mt-0.5">
                        <Clock size={12} />
                        {res.startTime} - {res.endTime}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-sm text-(--color-text-secondary)">
                        <MapPin size={14} className="text-primary" />
                        {res.locationId?.name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold">${res.totalAmount}</div>
                      <span className={`text-[10px] font-bold uppercase tracking-tight ${res.paymentStatus === 'paid' ? 'text-success' : res.paymentStatus === 'partial' ? 'text-primary' : 'text-(--color-text-muted)'}`}>
                        {res.paymentStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(res.status)}`}>
                        {res.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <button className="p-2 text-(--color-text-muted) hover:text-primary hover:bg-primary/10 rounded-lg transition-all">
                        <MoreVertical size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-8 py-6 bg-(--color-surface-soft) border-t border-(--color-border)">
            <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-4 py-2 rounded-xl bg-(--color-surface) border border-(--color-border) text-[10px] font-bold uppercase tracking-normal disabled:opacity-30 transition-all hover:bg-(--color-surface-soft)"
              >
                Previous
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-4 py-2 rounded-xl bg-(--color-surface) border border-(--color-border) text-[10px] font-bold uppercase tracking-normal disabled:opacity-30 transition-all hover:bg-(--color-surface-soft)"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Reservation Form Modal */}
      <AnimatePresence>
        {isFormOpen && (
          <ReservationForm 
            isOpen={isFormOpen} 
            onClose={() => {
              setIsFormOpen(false);
              setSelectedReservation(null);
            }} 
            editData={selectedReservation}
            onSuccess={() => {
              setIsFormOpen(false);
              setSelectedReservation(null);
              fetchReservations();
            }}
          />
        )}
      </AnimatePresence>
      {/* Reservation Details Modal */}
      <AnimatePresence>
        {isDetailsOpen && selectedReservation && (
          <ReservationDetails
            isOpen={isDetailsOpen}
            onClose={() => {
              setIsDetailsOpen(false);
              setSelectedReservation(null);
            }}
            reservation={selectedReservation}
            onModify={(res) => {
              setSelectedReservation(res);
              setIsFormOpen(true);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
