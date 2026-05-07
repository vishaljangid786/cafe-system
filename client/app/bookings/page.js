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

  const [availability, setAvailability] = useState(null);
  const [checking, setChecking] = useState(false);
  const [bookingInProgress, setBookingInProgress] = useState(false);
  const [myBookings, setMyBookings] = useState([]);

  const fetchLocations = async () => {
    try {
      const res = await api.get('/locations');
      setLocations(res.data.data.filter(loc => loc.status === 'active'));
    } catch (error) {
      toast.error('Failed to load locations');
    }
  };

  const fetchMyBookings = async () => {
    try {
      const res = await api.get('/bookings/my');
      setMyBookings(res.data.data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    const init = async () => {
      await fetchLocations();
      await fetchMyBookings();
    };
    init();
  }, []);

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
        specialRequests
      });
      toast.success('Booking confirmed successfully!', { id: toastId });

      // Reset form
      setSelectedLocation('');
      setDate('');
      setStartTime('');
      setEndTime('');
      setGuests(1);
      setSpecialRequests('');
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
      <div className="min-h-screen bg-background text-foreground p-4 md:p-8 pt-20 max-w-7xl mx-auto">

        <SlideIn direction="down">
          <div className="mb-10 text-center">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
              Reserve Your <span className="text-blue-600">Table</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Select a location, pick a time, and secure your spot in seconds.
            </p>
          </div>
        </SlideIn>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Booking Form */}
          <SlideIn direction="up" delay={0.1} className="lg:col-span-2">
            <div className="bg-white/5 dark:bg-zinc-900/50 backdrop-blur-xl border border-border p-8 rounded-3xl shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 text-blue-600/10 pointer-events-none">
                <CalendarIcon size={200} />
              </div>

              <form onSubmit={handleCheckAvailability} className="relative z-10 space-y-8">
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center">
                      <CalendarIcon size={14} className="mr-2" /> Date
                    </label>
                    <input
                      type="date"
                      min={new Date().toISOString().split('T')[0]}
                      value={date}
                      onChange={(e) => { setDate(e.target.value); setAvailability(null); }}
                      className="w-full bg-background border border-border rounded-2xl px-5 py-4 font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center">
                      <Users size={14} className="mr-2" /> Number of Guests
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={guests}
                      onChange={(e) => { setGuests(e.target.value); setAvailability(null); }}
                      className="w-full bg-background border border-border rounded-2xl px-5 py-4 font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
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

                {/* Special Requests */}
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                    Special Requests (Optional)
                  </label>
                  <textarea
                    value={specialRequests}
                    onChange={(e) => setSpecialRequests(e.target.value)}
                    placeholder="E.g., Window seat, anniversary celebration..."
                    className="w-full bg-background border border-border rounded-2xl px-5 py-4 font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none h-24"
                  />
                </div>

                <div className="pt-4 flex items-center justify-between">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={checking}
                    className="w-full md:w-auto px-8 py-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-lg transition-all flex items-center justify-center disabled:opacity-50"
                  >
                    {checking ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
                    Check Availability
                  </motion.button>
                </div>
              </form>

              <AnimatePresence>
                {availability && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className={`mt-6 p-6 rounded-2xl border ${availability.available ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}
                  >
                    <div className="flex items-start">
                      {availability.available ? (
                        <CheckCircle className="text-green-500 mr-4 shrink-0" size={24} />
                      ) : (
                        <XCircle className="text-red-500 mr-4 shrink-0" size={24} />
                      )}
                      <div>
                        <h4 className={`font-black text-lg ${availability.available ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {availability.available ? 'Slots Available!' : 'Not Available'}
                        </h4>
                        <p className="text-sm font-medium opacity-80 mt-1">{availability.message}</p>

                        {availability.available && (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleBook}
                            disabled={bookingInProgress}
                            className="mt-4 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-600/20 transition-all flex items-center"
                          >
                            {bookingInProgress && <Loader2 className="animate-spin mr-2" size={14} />}
                            Confirm Booking
                          </motion.button>
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
            <div className="bg-white/5 dark:bg-zinc-900/50 backdrop-blur-xl border border-border p-8 rounded-3xl shadow-xl h-full flex flex-col">
              <h2 className="text-xl font-black mb-6 uppercase tracking-widest flex items-center">
                <CalendarIcon className="mr-2 text-blue-600" size={20} /> My Schedule
              </h2>

              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
                {myBookings.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                    <CalendarIcon size={48} className="mb-4" />
                    <p className="font-medium text-center">You have no upcoming bookings.</p>
                  </div>
                ) : (
                  myBookings.map(booking => (
                    <div key={booking._id} className="p-4 rounded-2xl bg-background border border-border hover:border-blue-500/30 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${booking.status === 'confirmed' ? 'bg-green-500/20 text-green-500' :
                          booking.status === 'pending' ? 'bg-blue-500/20 text-blue-500' :
                            'bg-red-500/20 text-red-500'
                          }`}>
                          {booking.status}
                        </span>
                        <span className="text-xs font-bold text-muted-foreground">{new Date(booking.date).toLocaleDateString()}</span>
                      </div>
                      <h3 className="font-black text-lg mb-1">{booking.locationId?.name}</h3>
                      <div className="flex items-center text-sm text-muted-foreground font-medium mb-1">
                        <Clock size={14} className="mr-1.5" /> {booking.startTime} - {booking.endTime}
                      </div>
                      <div className="flex items-center text-sm text-muted-foreground font-medium">
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
