'use client';
import { 
  Users, Search, Filter, Mail, Phone, MapPin, BadgeCheck, 
  Trash2, ShieldAlert, ShieldCheck, Plus, User as UserIcon, 
  Briefcase, CreditCard, GraduationCap, Calendar 
} from 'lucide-react';
import { PageTransition, SlideIn, CardHover } from '../../../components/ui/AnimatedContainer';
import Modal from '../../../components/ui/Modal';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import api from '../../../services/api';

export default function AllStaffPage() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('All');
  const [locations, setLocations] = useState([]);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);

  const fetchData = async () => {
    try {
      const [usersRes, locationsRes] = await Promise.all([
        api.get('/users'),
        api.get('/locations')
      ]);
      setStaff(usersRes.data.data.filter(u => u.role !== 'super_admin'));
      setLocations(locationsRes.data.data);
    } catch (error) {
      console.error('Failed to fetch personnel matrix');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (userId) => {
    if (!confirm('Are you sure you want to remove this user permanently?')) return;
    const loadToast = toast.loading('Removing user...');
    try {
      await api.delete(`/users/${userId}`);
      setStaff(staff.filter(s => s._id !== userId));
      toast.success('User removed successfully', { id: loadToast });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to remove user', { id: loadToast });
    }
  };

  const handleToggleBlock = async (userId, currentStatus) => {
    const action = currentStatus ? 'unblocking' : 'blocking';
    const loadToast = toast.loading(`User ${action}...`);
    try {
      await api.put(`/users/${userId}/block`);
      setStaff(staff.map(s => s._id === userId ? { ...s, isBlocked: !currentStatus } : s));
      toast.success(`User ${currentStatus ? 'unblocked' : 'blocked'} successfully`, { id: loadToast });
    } catch (error) {
      toast.error('Action failed', { id: loadToast });
    }
  };

  const filteredStaff = staff.filter(person => {
    const matchesSearch = person.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          person.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLocation = selectedLocation === 'All' || person.assignedLocation?.name === selectedLocation;
    return matchesSearch && matchesLocation;
  });

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-600"></div>
    </div>
  );

  return (
    <PageTransition>
      <div className="space-y-6">
        <SlideIn direction="down">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-gray-900 dark:text-zinc-100 flex items-center tracking-tight">
                <Users className="mr-3 text-amber-600" size={28} /> Personnel Matrix
              </h1>
              <p className="text-gray-500 dark:text-zinc-500 text-sm mt-1">Manage and monitor all assets across global locations.</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/signup">
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="bg-amber-600 dark:bg-amber-500 text-white px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-amber-600/20 flex items-center h-full"
                >
                  <Plus size={16} className="mr-2" strokeWidth={3} /> Add Personnel
                </motion.button>
              </Link>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Search by name or email..." 
                  className="pl-10 pr-4 py-2 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800 focus:ring-2 focus:ring-amber-500 outline-none w-full sm:w-64 transition-all text-sm dark:text-zinc-200"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <select 
                  className="pl-10 pr-8 py-2 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800 focus:ring-2 focus:ring-amber-500 outline-none appearance-none text-sm dark:text-zinc-200 font-bold"
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                >
                  <option value="All">All Locations</option>
                  {locations.map(l => (
                    <option key={l._id} value={l.name}>{l.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </SlideIn>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStaff.map((person, i) => (
            <SlideIn key={person._id} delay={i * 0.05}>
              <CardHover>
                <div className="group bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 hover:border-amber-500/30 transition-all duration-300 relative overflow-hidden h-full">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Users size={80} />
                  </div>
                  
                  <div className="flex items-start space-x-4">
                    <div className="h-14 w-14 rounded-2xl bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400 flex-shrink-0 border border-amber-200 dark:border-amber-500/20">
                      <span className="text-xl font-black uppercase">{person.name.charAt(0)}</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 dark:text-zinc-100 text-lg leading-tight">{person.name}</h3>
                      <span className="text-[10px] uppercase font-black tracking-widest text-amber-600 dark:text-amber-500">{person.role.replace('_', ' ')}</span>
                    </div>
                  </div>

                  <div className="mt-6 space-y-3">
                    <div className="flex items-center text-sm text-gray-600 dark:text-zinc-400">
                      <Mail size={16} className="mr-3 text-gray-400" />
                      {person.email}
                    </div>
                    <div className="flex items-center text-sm text-gray-600 dark:text-zinc-400">
                      <Phone size={16} className="mr-3 text-gray-400" />
                      {person.phone}
                    </div>
                    <div className="flex items-center text-sm text-gray-600 dark:text-zinc-400">
                      <MapPin size={16} className="mr-3 text-gray-400" />
                      {person.assignedLocation?.name || 'Central Command'}
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-gray-50 dark:border-zinc-800 flex justify-between items-center relative z-20">
                    <div className="flex space-x-2">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleToggleBlock(person._id, person.isBlocked); }}
                        className={`p-2 rounded-xl transition-all ${person.isBlocked ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                        title={person.isBlocked ? "Unblock User" : "Block User"}
                      >
                        {person.isBlocked ? <ShieldAlert size={16} /> : <ShieldCheck size={16} />}
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDelete(person._id); }}
                        className="p-2 bg-red-50 text-red-400 hover:bg-red-600 hover:text-white rounded-xl transition-all"
                        title="Delete User"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <button 
                      onClick={() => { setSelectedPerson(person); setShowProfileModal(true); }}
                      className="text-[10px] font-black uppercase tracking-widest text-amber-600 hover:text-amber-700 transition-colors"
                    >
                      View Profile
                    </button>
                  </div>
                </div>
              </CardHover>
            </SlideIn>
          ))}
        </div>
        
        {/* Profile Detail Modal */}
        <Modal 
          isOpen={showProfileModal} 
          onClose={() => setShowProfileModal(false)}
          title="Personnel Dossier"
        >
          {selectedPerson && (
            <div className="space-y-8">
              {/* Header Info */}
              <div className="flex items-center space-x-6 p-6 bg-gray-50 dark:bg-zinc-800/50 rounded-3xl border border-gray-100 dark:border-zinc-800">
                <div className="h-20 w-20 rounded-[2rem] bg-amber-500 flex items-center justify-center text-zinc-900 shadow-2xl shadow-amber-500/20">
                  <UserIcon size={40} strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-gray-900 dark:text-zinc-100 leading-tight">{selectedPerson.name}</h2>
                  <div className="flex items-center mt-2">
                    <span className="px-3 py-1 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[9px] font-black uppercase tracking-widest rounded-full border border-amber-200 dark:border-amber-500/30">
                      {selectedPerson.role.replace('_', ' ')}
                    </span>
                    <span className="ml-3 text-[10px] font-bold text-gray-500 dark:text-zinc-500 uppercase tracking-widest">
                      {selectedPerson.assignedLocation?.name || 'Central Network'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Detail Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Contact Information */}
                <div className="space-y-6">
                  <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center">
                    <Phone size={14} className="mr-2 text-amber-600" /> Communication Channels
                  </h3>
                  <div className="space-y-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-gray-400 font-bold uppercase mb-1">Primary Email</span>
                      <span className="text-sm font-bold text-gray-800 dark:text-zinc-200">{selectedPerson.email}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-gray-400 font-bold uppercase mb-1">Primary Mobile</span>
                      <span className="text-sm font-bold text-gray-800 dark:text-zinc-200">{selectedPerson.phone}</span>
                    </div>
                    {selectedPerson.alternatePhone && (
                      <div className="flex flex-col">
                        <span className="text-[10px] text-gray-400 font-bold uppercase mb-1">Alternate Line</span>
                        <span className="text-sm font-bold text-gray-800 dark:text-zinc-200">{selectedPerson.alternatePhone}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Personal Logistics */}
                <div className="space-y-6">
                  <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center">
                    <Briefcase size={14} className="mr-2 text-amber-600" /> Identity Attributes
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-gray-400 font-bold uppercase mb-1">Gender</span>
                      <span className="text-sm font-bold text-gray-800 dark:text-zinc-200">{selectedPerson.gender}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-gray-400 font-bold uppercase mb-1">Chronological Age</span>
                      <span className="text-sm font-bold text-gray-800 dark:text-zinc-200">{selectedPerson.age} Years</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-gray-400 font-bold uppercase mb-1">Qualifications</span>
                      <span className="text-sm font-bold text-gray-800 dark:text-zinc-200">{selectedPerson.highestQualification}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-gray-400 font-bold uppercase mb-1">Monthly Yield</span>
                      <span className="text-sm font-bold text-amber-600">₹{selectedPerson.monthlySalary?.toLocaleString() || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Domicile Information */}
              <div className="p-6 bg-zinc-50 dark:bg-zinc-800/30 rounded-3xl border border-gray-100 dark:border-zinc-800">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center mb-4">
                  <MapPin size={14} className="mr-2 text-amber-600" /> Domicile Coordinates
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <p className="text-sm font-bold text-gray-700 dark:text-zinc-300 leading-relaxed">
                    {selectedPerson.address1}<br />
                    {selectedPerson.address2 && <>{selectedPerson.address2}<br /></>}
                    {selectedPerson.city}, {selectedPerson.state}<br />
                    {selectedPerson.country}
                  </p>
                  <div className="flex flex-col justify-center">
                    <span className="text-[10px] text-gray-400 font-bold uppercase mb-1">Aadhar Verification</span>
                    <div className="flex items-center space-x-2">
                      <CreditCard size={16} className="text-amber-600" />
                      <span className="text-sm font-black tracking-tighter text-gray-800 dark:text-zinc-200">{selectedPerson.aadharNumber}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Proof Documentation */}
              {selectedPerson.aadharImage && (
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Credential Imagery</h3>
                  <div className="relative group rounded-3xl overflow-hidden border-2 border-dashed border-gray-200 dark:border-zinc-700">
                    <img 
                      src={selectedPerson.aadharImage} 
                      alt="Aadhar Proof" 
                      className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <a href={selectedPerson.aadharImage} target="_blank" rel="noopener noreferrer" className="px-6 py-2 bg-white text-zinc-900 rounded-full font-black text-[10px] uppercase tracking-widest shadow-2xl">
                        Inspect Full Document
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>
        
        {filteredStaff.length === 0 && (
          <SlideIn>
            <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-gray-200 dark:border-zinc-800">
              <p className="text-gray-500 dark:text-zinc-500">No staff members found matching your criteria.</p>
            </div>
          </SlideIn>
        )}
      </div>
    </PageTransition>
  );
}
