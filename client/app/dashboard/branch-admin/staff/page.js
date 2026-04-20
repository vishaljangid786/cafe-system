'use client';
import { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import { Mail, MapPin, Phone, Users, Trash2, Plus, Loader2, Edit3, UserCheck, ShieldAlert } from 'lucide-react';
import { PageTransition, SlideIn, CardHover } from '../../../components/ui/AnimatedContainer';
import Modal from '../../../components/ui/Modal';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function BranchStaffPage() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', age: '', gender: 'Male',
    address1: '', city: '', state: '', pincode: '', monthlySalary: ''
  });

  const fetchStaff = async () => {
    try {
      const res = await api.get('/users');
      setStaff(res.data.data.filter(u => u.role === 'staff'));
    } catch (error) {
      toast.error('Failed to sync personnel roster');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleEdit = (member) => {
    setEditingStaff(member);
    setFormData({
      name: member.name || '',
      email: member.email || '',
      phone: member.phone || '',
      age: member.age || '',
      gender: member.gender || 'Male',
      address1: member.address1 || '',
      city: member.city || '',
      state: member.state || '',
      pincode: member.pincode || '',
      monthlySalary: member.monthlySalary || ''
    });
    setShowEditModal(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    const loadToast = toast.loading('Synchronizing updates...');
    try {
      await api.put(`/users/${editingStaff._id}`, formData);
      toast.success('Personnel profile updated', { id: loadToast });
      setShowEditModal(false);
      fetchStaff();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Update failed', { id: loadToast });
    }
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm) return;
    const loadToast = toast.loading('Purging personnel record...');
    try {
      await api.delete(`/users/${showDeleteConfirm}`);
      setStaff(staff.filter(s => s._id !== showDeleteConfirm));
      toast.success('Personnel liquidated', { id: loadToast });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Purge protocol failure', { id: loadToast });
    } finally {
      setShowDeleteConfirm(null);
    }
  };

  if (loading) return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {[1,2,3,4,5,6].map(i => <div key={i} className="h-64 bg-gray-100 dark:bg-zinc-800 animate-pulse rounded-[2.5rem]"></div>)}
    </div>
  );

  return (
    <PageTransition>
      <div className="space-y-10">
        <SlideIn direction="down">
          <div className="bg-white dark:bg-zinc-900 p-10 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div>
              <h1 className="text-3xl font-black text-gray-900 dark:text-zinc-100 flex items-center tracking-tight leading-none">
                <Users className="mr-4 text-amber-600" size={36} /> Branch <span className="ml-3 text-amber-600">Personnel</span>
              </h1>
              <p className="text-gray-500 dark:text-zinc-500 text-sm mt-2 font-medium">Strategic roster management for operational personnel.</p>
            </div>
            <div className="flex items-center space-x-6">
              <div className="flex -space-x-4 hidden sm:flex">
                {staff.slice(0, 5).map((m, i) => (
                  <div key={i} className="h-12 w-12 rounded-2xl border-4 border-white dark:border-zinc-900 bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center text-xs font-black uppercase text-amber-600 shadow-sm">
                    {m.name.charAt(0)}
                  </div>
                ))}
                {staff.length > 5 && (
                  <div className="h-12 w-12 rounded-2xl border-4 border-white dark:border-zinc-900 bg-zinc-900 flex items-center justify-center text-xs font-black text-white shadow-sm">
                    +{staff.length - 5}
                  </div>
                )}
              </div>
              <Link href="/signup">
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-zinc-900 dark:bg-amber-600 text-white px-10 py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-amber-600/10 flex items-center"
                >
                  <Plus size={20} className="mr-3" strokeWidth={3} /> Authorize Staff
                </motion.button>
              </Link>
            </div>
          </div>
        </SlideIn>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {staff.map((member, i) => (
            <SlideIn key={member._id} delay={i * 0.05}>
              <CardHover>
                <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-zinc-800 p-8 relative group overflow-hidden h-full flex flex-col">
                  <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-125 duration-700">
                    <Users size={120} />
                  </div>
                  
                  <div className="flex items-center space-x-5 relative z-10">
                    <div className="h-16 w-16 rounded-2xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400 border border-amber-200/20 shadow-inner">
                      <span className="text-2xl font-black uppercase">{member.name.charAt(0)}</span>
                    </div>
                    <div>
                      <h3 className="font-black text-gray-900 dark:text-zinc-100 text-xl tracking-tight leading-tight">{member.name}</h3>
                      <div className="flex items-center mt-1">
                        <UserCheck size={12} className="text-amber-600 mr-2" />
                        <span className="text-[10px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-widest">{member.role}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-8 space-y-4 relative z-10 flex-grow">
                    <div className="flex items-center text-xs font-bold text-gray-500 dark:text-zinc-400 group-hover:text-amber-600 transition-colors">
                      <Mail size={16} className="mr-4 opacity-40" /> {member.email}
                    </div>
                    <div className="flex items-center text-xs font-bold text-gray-500 dark:text-zinc-400">
                      <Phone size={16} className="mr-4 opacity-40" /> {member.phone}
                    </div>
                    <div className="flex items-center text-xs font-bold text-gray-500 dark:text-zinc-400 truncate">
                      <MapPin size={16} className="mr-4 opacity-40" /> {member.city}, {member.state}
                    </div>
                  </div>

                  <div className="mt-10 pt-6 border-t border-gray-50 dark:border-zinc-800 flex justify-between items-center relative z-10">
                    <div className="flex items-baseline">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 mr-3">Volume</span>
                      <span className="font-black text-gray-900 dark:text-zinc-100 text-lg">₹{member.monthlySalary?.toLocaleString() || '0'}</span>
                    </div>
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => handleEdit(member)}
                        className="p-3 text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-2xl transition-all"
                        title="Modify Profile"
                      >
                        <Edit3 size={20} />
                      </button>
                      <button 
                        onClick={() => setShowDeleteConfirm(member._id)}
                        className="p-3 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-2xl transition-all"
                        title="Liquidate Entry"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              </CardHover>
            </SlideIn>
          ))}
          {staff.length === 0 && (
            <div className="col-span-full py-32 bg-white dark:bg-zinc-900 rounded-[3rem] border-4 border-dashed border-gray-50 dark:border-zinc-800 flex flex-col items-center justify-center opacity-30">
              <ShieldAlert size={64} className="mb-6" />
              <p className="font-black text-sm uppercase tracking-widest">Roster is currently empty</p>
            </div>
          )}
        </div>

        <Modal 
          isOpen={showEditModal} 
          onClose={() => setShowEditModal(false)}
          title="Modify Personnel Profile"
        >
          <form onSubmit={handleUpdate} className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Full Name</label>
                <input required className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Email Node</label>
                <input required type="email" className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Phone</label>
                <input required className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Age</label>
                <input required type="number" className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Gender</label>
                <select className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none" value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})}>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Base Operations Address</label>
              <input required className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none" value={formData.address1} onChange={e => setFormData({...formData, address1: e.target.value})} />
            </div>

            <div className="grid grid-cols-4 gap-6">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">City</label>
                <input required className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">State</label>
                <input required className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none" value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Pincode</label>
                <input required className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none" value={formData.pincode} onChange={e => setFormData({...formData, pincode: e.target.value})} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Monthly Yield (₹)</label>
                <input required type="number" className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none" value={formData.monthlySalary} onChange={e => setFormData({...formData, monthlySalary: e.target.value})} />
              </div>
            </div>

            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-5 bg-zinc-900 dark:bg-amber-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-amber-600/20 mt-4"
            >
              Update Personnel Records
            </motion.button>
          </form>
        </Modal>

        <ConfirmDialog
          isOpen={!!showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(null)}
          onConfirm={handleDelete}
          title="Liquidate Record?"
          message="This personnel record will be permanently purged from the system network."
        />
      </div>
    </PageTransition>
  );
}
