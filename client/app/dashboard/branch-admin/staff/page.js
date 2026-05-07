'use client';
import { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import { Mail, MapPin, Phone, Users, Trash2, Plus, Loader2, Edit3, UserCheck, ShieldAlert, Info, Calendar, Award, Briefcase, Hash, Globe, CreditCard } from 'lucide-react';
import { PageTransition, SlideIn, CardHover } from '../../../components/ui/AnimatedContainer';
import Modal from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import Link from 'next/link';
import PremiumSelect from '../../../components/ui/PremiumSelect';

export default function BranchStaffPage() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [viewingStaff, setViewingStaff] = useState(null);
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', age: '', gender: 'Male',
    address1: '', city: '', state: '', pincode: '', monthlySalary: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 12;

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/users?page=${currentPage}&limit=${itemsPerPage}`);
      setStaff(res.data.data);
      setTotalPages(res.data.pagination.pages);
    } catch (error) {
      toast.error('Failed to sync staff roster');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStaff();
    }, 0);

    return () => clearTimeout(timer);
  }, [currentPage]);

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
      toast.success('Staff profile updated', { id: loadToast });
      setShowEditModal(false);
      fetchStaff();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Update failed', { id: loadToast });
    }
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm) return;
    const loadToast = toast.loading('Purging staff record...');
    try {
      await api.delete(`/users/${showDeleteConfirm}`);
      setStaff(staff.filter(s => s._id !== showDeleteConfirm));
      toast.success('Staff record removed', { id: loadToast });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Delete failed', { id: loadToast });
    } finally {
      setShowDeleteConfirm(null);
    }
  };

  if (loading) return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-64 bg-gray-100 dark:bg-zinc-800 animate-pulse rounded-[2.5rem]"></div>)}
    </div>
  );

  return (
    <PageTransition>
      <div className="space-y-10">
        <SlideIn direction="down">
          <div className="bg-white dark:bg-zinc-900 p-10 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div>
              <h1 className="text-3xl font-black text-gray-900 dark:text-zinc-100 flex items-center tracking-tight leading-none">
                <Users className="mr-4 text-blue-600" size={36} /> Branch <span className="ml-3 text-blue-600">Staff</span>
              </h1>
              <p className="text-gray-500 dark:text-zinc-500 text-sm mt-2 font-medium">Strategic roster management for operational staff.</p>
            </div>
            <div className="flex items-center space-x-6">

              <Link href="/signup">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-zinc-900 dark:bg-blue-600 text-white px-10 py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-blue-600/10 flex items-center"
                >
                  <Plus size={20} className="mr-3" strokeWidth={3} /> Add Staff
                </motion.button>
              </Link>
            </div>
          </div>
        </SlideIn>

        <div className="overflow-x-auto rounded-[2.5rem] border border-[var(--color-border)] bg-[var(--color-surface)]/40 backdrop-blur-3xl shadow-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-soft)]/50">
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.3em] text-[var(--color-text-muted)]">Staff Member</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.3em] text-[var(--color-text-muted)]">Contact Details</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.3em] text-[var(--color-text-muted)]">Role</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.3em] text-[var(--color-text-muted)]">Location</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.3em] text-[var(--color-text-muted)] text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((member, i) => (
                <motion.tr 
                  key={member._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => setViewingStaff(member)}
                  className="group border-b border-[var(--color-border)] hover:bg-[var(--color-primary)]/5 transition-all cursor-pointer"
                >
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-600 border border-blue-500/20 shadow-inner group-hover:scale-110 transition-transform font-black">
                        {member.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-black text-[var(--color-text-primary)]">{member.name}</p>
                        <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mt-0.5">ID: {member._id.slice(-6).toUpperCase()}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-xs font-bold text-[var(--color-text-primary)]">
                        <Mail size={12} className="text-blue-600" />
                        {member.email}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-medium text-[var(--color-text-muted)]">
                        <Phone size={12} />
                        {member.phone}
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20 text-[10px] font-black uppercase tracking-widest">
                      {member.role}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2 text-[var(--color-text-primary)]">
                      <MapPin size={14} className="text-blue-600" />
                      <span className="text-sm font-bold">{member.city}, {member.state}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => { e.stopPropagation(); handleEdit(member); }}
                        className="p-2.5 text-zinc-500 hover:text-blue-600 hover:bg-blue-500/10 rounded-xl transition-all"
                      >
                        <Edit3 size={18} />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(member._id); }}
                        className="p-2.5 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                      >
                        <Trash2 size={18} />
                      </motion.button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {staff.length === 0 && (
            <div className="p-20 text-center text-[var(--color-text-muted)]">
              <Users size={48} className="mx-auto mb-4 opacity-20" />
              <p className="text-sm font-black uppercase tracking-widest">Staff roster is empty</p>
            </div>
          )}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-8 py-6 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-[2.5rem] mt-10 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
              System Rule Page {currentPage} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-4 py-2 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-[10px] font-black uppercase tracking-widest disabled:opacity-30 transition-all hover:bg-gray-100 dark:hover:bg-zinc-700"
              >
                Previous
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-4 py-2 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-[10px] font-black uppercase tracking-widest disabled:opacity-30 transition-all hover:bg-gray-100 dark:hover:bg-zinc-700"
              >
                Next
              </button>
            </div>
          </div>
        )}

        <Modal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          title="Modify Staff Profile"
        >
          <form onSubmit={handleUpdate} className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Full Name</label>
                <input required className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-blue-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Email</label>
                <input required type="email" className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-blue-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Phone</label>
                <input required type="number" className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-blue-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none" value={formData.phone} onInput={e => { if (e.target.value.length > 10) e.target.value = e.target.value.slice(0, 10); }} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Age</label>
                <input required type="number" className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-blue-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none" value={formData.age} onInput={e => { if (e.target.value.length > 2) e.target.value = e.target.value.slice(0, 2); }} onChange={e => setFormData({ ...formData, age: e.target.value })} />
              </div>
              <div>
                <PremiumSelect 
                  label="Gender"
                  value={formData.gender}
                  onChange={(val) => setFormData({ ...formData, gender: val })}
                  options={[
                    { label: 'Male', value: 'Male' },
                    { label: 'Female', value: 'Female' },
                    { label: 'Other', value: 'Other' }
                  ]}
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Base Operations Address</label>
              <input required className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-blue-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none" value={formData.address1} onChange={e => setFormData({ ...formData, address1: e.target.value })} />
            </div>

            <div className="grid grid-cols-4 gap-6">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">City</label>
                <input required className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-blue-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none" value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">State</label>
                <input required className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-blue-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none" value={formData.state} onChange={e => setFormData({ ...formData, state: e.target.value })} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Pincode</label>
                <input required type="number" className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-blue-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none" value={formData.pincode} onInput={e => { if (e.target.value.length > 6) e.target.value = e.target.value.slice(0, 6); }} onChange={e => setFormData({ ...formData, pincode: e.target.value })} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Monthly Yield (₹)</label>
                <input required type="number" className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-blue-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none" value={formData.monthlySalary} onChange={e => setFormData({ ...formData, monthlySalary: e.target.value })} />
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-5 bg-zinc-900 dark:bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-blue-600/20 mt-4"
            >
              Update Staff Records
            </motion.button>
          </form>
        </Modal>

        <ConfirmDialog
          isOpen={!!showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(null)}
          onConfirm={handleDelete}
          title="Liquidate Record?"
          message="This staff record will be permanently purged from the system network."
        />

        {/* Detailed Staff Details Modal */}
        <Modal
          isOpen={!!viewingStaff}
          onClose={() => setViewingStaff(null)}
          title="Staff Details Information"
          maxWidth="max-w-3xl"
        >
          {viewingStaff && (
            <div className="space-y-8">
              {/* Header Profile */}
              <div className="flex flex-col md:flex-row items-center md:items-start gap-8 pb-8 border-b border-zinc-100 dark:border-zinc-800">
                <div className="relative group">
                  <div className="h-32 w-32 rounded-[2.5rem] bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center text-5xl font-black shadow-2xl shadow-blue-500/20 group-hover:scale-105 transition-transform">
                    {viewingStaff.name.charAt(0)}
                  </div>
                  <div className="absolute -bottom-2 -right-2 h-8 w-8 bg-green-500 border-4 border-white dark:border-zinc-950 rounded-full flex items-center justify-center text-white">
                    <UserCheck size={14} />
                  </div>
                </div>

                <div className="text-center md:text-left flex-1">
                  <h2 className="text-4xl font-black text-zinc-900 dark:text-zinc-100 tracking-tighter leading-none">{viewingStaff.name}</h2>
                  <p className="text-sm font-bold text-zinc-400 mt-2 flex items-center justify-center md:justify-start gap-2">
                    <Mail size={14} className="text-blue-600" /> {viewingStaff.email}
                  </p>
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-4">
                    <span className="px-3 py-1 bg-blue-500/10 text-blue-600 text-[10px] font-black uppercase tracking-widest rounded-full border border-blue-500/20">
                      {viewingStaff.role}
                    </span>
                    <span className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-[10px] font-black uppercase tracking-widest rounded-full">
                      ID: {viewingStaff._id.slice(-6).toUpperCase()}
                    </span>
                    <span className="px-3 py-1 bg-green-500/10 text-green-500 text-[10px] font-black uppercase tracking-widest rounded-full">
                      Active Deployment
                    </span>
                  </div>
                </div>

                <div className="bg-zinc-50 dark:bg-zinc-900/50 p-6 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 text-right min-w-[180px]">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Monthly Yield</p>
                  <p className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tighter">₹{viewingStaff.monthlySalary?.toLocaleString()}</p>
                </div>
              </div>

              {/* Data Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-8">
                  {/* Identity Section */}
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-6 flex items-center gap-2">
                      <CreditCard size={14} className="text-blue-600" /> Identity Credentials
                    </h3>
                    <div className="grid grid-cols-1 gap-6">
                      <div className="flex items-center gap-4 bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                        <Hash className="text-blue-600" size={20} />
                        <div>
                          <p className="text-[8px] font-black uppercase text-zinc-400 tracking-widest">Aadhar Index</p>
                          <p className="text-sm font-bold text-zinc-700 dark:text-zinc-200">{viewingStaff.aadharNumber || 'Not Indexed'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                        <Phone className="text-blue-600" size={20} />
                        <div>
                          <p className="text-[8px] font-black uppercase text-zinc-400 tracking-widest">Primary Contact</p>
                          <p className="text-sm font-bold text-zinc-700 dark:text-zinc-200">{viewingStaff.phone}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                        <Award className="text-blue-600" size={20} />
                        <div>
                          <p className="text-[8px] font-black uppercase text-zinc-400 tracking-widest">Academic Standing</p>
                          <p className="text-sm font-bold text-zinc-700 dark:text-zinc-200">{viewingStaff.highestQualification}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Demographic Section */}
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-6 flex items-center gap-2">
                      <Globe size={14} className="text-blue-600" /> Demographic Information
                    </h3>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                        <p className="text-[8px] font-black uppercase text-zinc-400 tracking-widest mb-1">Age</p>
                        <p className="text-lg font-black text-zinc-900 dark:text-zinc-100">{viewingStaff.age} Years</p>
                      </div>
                      <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                        <p className="text-[8px] font-black uppercase text-zinc-400 tracking-widest mb-1">Gender</p>
                        <p className="text-lg font-black text-zinc-900 dark:text-zinc-100">{viewingStaff.gender}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  {/* Address Section */}
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-6 flex items-center gap-2">
                      <MapPin size={14} className="text-blue-600" /> Operational Base
                    </h3>
                    <div className="bg-zinc-50 dark:bg-zinc-900/50 p-6 rounded-[2rem] border border-zinc-100 dark:border-zinc-800">
                      <p className="text-sm font-bold text-zinc-700 dark:text-zinc-200 leading-relaxed">
                        {viewingStaff.address1}<br />
                        {viewingStaff.address2 && <>{viewingStaff.address2}<br /></>}
                        {viewingStaff.city}, {viewingStaff.state}
                      </p>
                    </div>
                  </div>

                  {/* Document Proof Section */}
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-6 flex items-center gap-2">
                      <Info size={14} className="text-blue-600" /> Identity Proof (Aadhar)
                    </h3>
                    {viewingStaff.aadharImage ? (
                      <div className="group relative rounded-[2.5rem] overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 aspect-video">
                        <img
                          src={viewingStaff.aadharImage}
                          alt="Identity Proof"
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        />
                        <a
                          href={viewingStaff.aadharImage}
                          target="_blank"
                          rel="noreferrer"
                          className="absolute inset-0 bg-zinc-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-3 backdrop-blur-sm"
                        >
                          <Globe size={24} className="text-blue-500" />
                          <span className="font-black text-[10px] uppercase tracking-widest">Verify Original Scan</span>
                        </a>
                      </div>
                    ) : (
                      <div className="rounded-[2.5rem] border-2 border-dashed border-zinc-200 dark:border-zinc-800 p-10 flex flex-col items-center justify-center text-zinc-400 aspect-video">
                        <ShieldAlert size={32} className="mb-2 opacity-20" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-center">Identity Scan Missing</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="pt-8 border-t border-zinc-100 dark:border-zinc-800 flex gap-4">
                <Button
                  variant="outline"
                  className="flex-1 py-5 !rounded-2xl font-black text-xs uppercase tracking-widest"
                  onClick={() => setViewingStaff(null)}
                >
                  Terminate Inspection
                </Button>
                <Button
                  className="flex-1 py-5 !rounded-2xl font-black text-xs uppercase tracking-widest bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-2xl"
                  onClick={() => {
                    handleEdit(viewingStaff);
                    setViewingStaff(null);
                  }}
                >
                  Refine Credentials
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </PageTransition>
  );
}
