'use client';
import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Calendar as CalendarIcon, Clock, Users, MapPin, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageTransition, SlideIn } from '../components/ui/AnimatedContainer';
import { motion, AnimatePresence } from 'framer-motion';
import PremiumSelect from '../components/ui/PremiumSelect';

export default function BookingPage() {
  const { user } = useAuth();
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [guests, setGuests] = useState(1);
  const [specialRequests, setSpecialRequests] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');

  const [availability, setAvailability] = useState(null);
  const [checking, setChecking] = useState(false);
  const [bookingInProgress, setBookingInProgress] = useState(false);
  const [myBookings, setMyBookings] = useState([]);

  const fetchLocations = async () => {
    try {
      // Public endpoint — no auth required
      const res = await api.get('/locations/public');
      setLocations(res.data.data.filter(loc => loc.status === 'active'));
    } catch (error) {
      toast.error('Failed to load locations');
    }
  };

  const fetchMyBookings = async () => {
    if (!user) return; // only fetch when authenticated
    try {
      const res = await api.get('/bookings/my');
      setMyBookings(res.data.data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchLocations();
    fetchMyBookings();
  }, [user]);

  const handleCheckAvailability = async (e) => {
    e.preventDefault();
    if (!selectedLocation || !date || !startTime || !endTime || !guests) {
      return toast.error('Please fill all required fields');
    }

    if (startTime >= endTime) {
      return toast.error('End time must be after start time');
    }

    setChecking(true);
    try {
      const res = await api.get('/bookings/check-availability', {
        params: { locationId: selectedLocation, date, startTime, endTime, numberOfGuests: guests }
      });
      setAvailability(res.data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to check availability');
      setAvailability(null);
    } finally {
      setChecking(false);
    }
  };

  const handleBook = async () => {
    if (!availability?.available) return;

    setBookingInProgress(true);
    const toastId = toast.loading('Confirming your reservation...');
    try {
      await api.post('/bookings', {
        locationId: selectedLocation,
        date,
        startTime,
        endTime,
        numberOfGuests: guests,
        specialRequests,
        ...(!user && { guestName, guestEmail, guestPhone })
      });
      toast.success('Booking confirmed successfully!', { id: toastId });

      // Reset form
      setSelectedLocation('');
      setDate('');
      setStartTime('');
      setEndTime('');
      setGuests(1);
      setSpecialRequests('');
      setGuestName(''); setGuestEmail(''); setGuestPhone('');
      setAvailability(null);

      fetchMyBookings();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to complete booking', { id: toastId });
    } finally {
      setBookingInProgress(false);
    }
  };

  const timeSlots = [
    "09:00", "10:00", "11:00", "12:00", "13:00", "14:00",
    "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00"
  ];

  return (
    <PageTransition>
      <div className="min-h-screen p-4 md:p-8 pt-20 max-w-7xl mx-auto">

        <SlideIn direction="down">
          <div className="mb-8 text-center">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3 text-(--color-text-primary)">
              Reserve Your <span className="text-primary">Table</span>
            </h1>
            <p className="text-(--color-text-muted) text-base max-w-2xl mx-auto">
              Select a location, pick a time, and secure your spot in seconds.
            </p>
          </div>
        </SlideIn>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Booking Form */}
          <SlideIn direction="up" delay={0.1} className="lg:col-span-2">
            <div className="card p-6 rounded-xl">
              <form onSubmit={handleCheckAvailability} className="relative z-10 space-y-6">
                {/* Location */}
                  <PremiumSelect
                    label="Select Location"
                    value={selectedLocation}
                    onChange={val => { setSelectedLocation(val); setAvailability(null); }}
                    options={[
                      { label: 'Choose a cafe...', value: '', disabled: true },
                      ...(locations.map(loc => ({ label: `${loc.name} - ${loc.city}`, value: loc._id })))
                    ]}
                  />

                {/* Date & Guests */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="label flex items-center">
                      <CalendarIcon size={14} className="mr-2" /> Date
                    </label>
                    <input
                      type="date"
                      min={new Date().toISOString().split('T')[0]}
                      value={date}
                      onChange={(e) => { setDate(e.target.value); setAvailability(null); }}
                      className="input"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="label flex items-center">
                      <Users size={14} className="mr-2" /> Number of Guests
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={guests}
                      onChange={(e) => { setGuests(e.target.value); setAvailability(null); }}
                      className="input"
                      required
                    />
                  </div>
                </div>

                {/* Time Slots */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <PremiumSelect 
                    label="Start Time"
                    value={startTime}
                    onChange={val => { setStartTime(val); setAvailability(null); }}
                    options={[
                      { label: 'Select start time...', value: '', disabled: true },
                      ...(timeSlots.map(time => ({ label: time, value: time })))
                    ]}
                  />

                  <PremiumSelect 
                    label="End Time"
                    value={endTime}
                    onChange={val => { setEndTime(val); setAvailability(null); }}
                    options={[
                      { label: 'Select end time...', value: '', disabled: true },
                      ...(timeSlots.map(time => ({ label: time, value: time })))
                    ]}
                  />
                </div>

                {/* Guest contact fields — shown only for unauthenticated visitors */}
                {!user && (
                  <div className="space-y-4 p-4 bg-(--color-primary-soft) rounded-lg border border-(--color-border)">
                    <p className="text-sm font-semibold text-primary">Guest Details (Required)</p>
                    <div className="space-y-1.5">
                      <label className="label">Your Name</label>
                      <input required={!user} value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Full name" className="input" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="label">Email</label>
                      <input type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} placeholder="your@email.com" className="input" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="label">Phone</label>
                      <input type="tel" value={guestPhone} onChange={e => setGuestPhone(e.target.value)} placeholder="Contact number" className="input" />
                    </div>
                  </div>
                )}

                {/* Special Requests */}
                <div className="space-y-1.5">
                  <label className="label">
                    Special Requests (Optional)
                  </label>
                  <textarea
                    value={specialRequests}
                    onChange={(e) => setSpecialRequests(e.target.value)}
                    placeholder="E.g., Window seat, anniversary celebration..."
                    className="input resize-none h-24"
                  />
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <button
                    type="submit"
                    disabled={checking}
                    className="w-full md:w-auto px-6 py-2.5 bg-primary hover:bg-(--color-primary-hover) text-(--color-on-primary) rounded-lg font-semibold text-sm transition-colors flex items-center justify-center disabled:opacity-50 active:scale-95"
                  >
                    {checking ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
                    Check Availability
                  </button>
                </div>
              </form>

              <AnimatePresence>
                {availability && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className={`mt-5 p-5 rounded-lg border ${availability.available ? 'bg-[rgba(var(--color-success-rgb),0.1)] border-[rgba(var(--color-success-rgb),0.2)]' : 'bg-[rgba(var(--color-danger-rgb),0.1)] border-[rgba(var(--color-danger-rgb),0.2)]'}`}
                  >
                    <div className="flex items-start">
                      {availability.available ? (
                        <CheckCircle className="text-success mr-3 shrink-0" size={22} />
                      ) : (
                        <XCircle className="text-danger mr-3 shrink-0" size={22} />
                      )}
                      <div>
                        <h4 className={`font-semibold text-base ${availability.available ? 'text-success' : 'text-danger'}`}>
                          {availability.available ? 'Slots Available!' : 'Not Available'}
                        </h4>
                        <p className="text-sm text-(--color-text-secondary) mt-1">{availability.message}</p>

                        {availability.available && (
                          <button
                            onClick={handleBook}
                            disabled={bookingInProgress}
                            className="mt-4 px-5 py-2.5 bg-primary hover:bg-(--color-primary-hover) text-(--color-on-primary) rounded-lg font-semibold text-sm transition-colors flex items-center active:scale-95"
                          >
                            {bookingInProgress && <Loader2 className="animate-spin mr-2" size={14} />}
                            Confirm Booking
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </SlideIn>

          {/* User's Bookings */}
          <SlideIn direction="left" delay={0.2}>
            <div className="card p-6 rounded-xl h-full flex flex-col">
              <h2 className="text-lg font-semibold mb-5 flex items-center text-(--color-text-primary)">
                <CalendarIcon className="mr-2 text-primary" size={20} /> My Schedule
              </h2>

              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                {myBookings.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-(--color-text-muted)">
                    <CalendarIcon size={44} className="mb-3 opacity-40" />
                    <p className="text-sm text-center">You have no upcoming bookings.</p>
                  </div>
                ) : (
                  myBookings.map(booking => (
                    <div key={booking._id} className="p-4 rounded-lg bg-(--color-surface-soft) border border-(--color-border) hover:border-(--color-border-strong) transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <span className={`chip capitalize ${booking.status === 'confirmed' ? 'bg-[rgba(var(--color-success-rgb),0.15)] text-success' :
                          booking.status === 'pending' ? 'bg-(--color-primary-soft) text-primary' :
                            'bg-[rgba(var(--color-danger-rgb),0.15)] text-danger'
                          }`}>
                          {booking.status}
                        </span>
                        <span className="text-xs text-(--color-text-muted)">{new Date(booking.date).toLocaleDateString()}</span>
                      </div>
                      <h3 className="font-semibold text-base mb-1 text-(--color-text-primary)">{booking.locationId?.name}</h3>
                      <div className="flex items-center text-sm text-(--color-text-muted) mb-1">
                        <Clock size={14} className="mr-1.5" /> {booking.startTime} - {booking.endTime}
                      </div>
                      <div className="flex items-center text-sm text-(--color-text-muted)">
                        <Users size={14} className="mr-1.5" /> {booking.numberOfGuests} Guests
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </SlideIn>

        </div>
      </div>
    </PageTransition>
  );
}
