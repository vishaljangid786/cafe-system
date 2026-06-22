'use client';
import { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import { Mail, MapPin, Phone, Users, Trash2, Plus, Edit3, UserCheck, ShieldAlert, Info, Calendar, Award, Briefcase, Hash, Globe, CreditCard } from 'lucide-react';
import { Skeleton, TableSkeleton } from '@/app/components/ui/Skeleton';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { progress } from '@/app/components/ui/TopProgressBar';
import { PageTransition, SlideIn, CardHover } from '../../../components/ui/AnimatedContainer';
import Modal from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import PremiumSelect from '../../../components/ui/PremiumSelect';

export default function BranchStaffPage() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const didInitRef = useRef(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [viewingStaff, setViewingStaff] = useState(null);
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', age: '', gender: 'Male',
    address1: '', city: '', state: '', pincode: '', monthlySalary: ''
  });
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '', phone: '', monthlySalary: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 12;

  const fetchStaff = async () => {
    const isInitial = !didInitRef.current;
    if (isInitial) setLoading(true); else setRefetching(true);
    progress.start();
    try {
      const res = await api.get(`/users?page=${currentPage}&limit=${itemsPerPage}`);
      setStaff(res.data.data);
      setTotalPages(res.data.pagination.pages);
    } catch (error) {
      toast.error('Could not load staff. Please try again.');
    } finally {
      didInitRef.current = true;
      setLoading(false);
      setRefetching(false);
      progress.done();
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
    const loadToast = toast.loading('Saving changes...');
    try {
      await api.put(`/users/${editingStaff._id}`, formData);
      toast.success('Staff details updated', { id: loadToast });
      setShowEditModal(false);
      fetchStaff();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not save changes', { id: loadToast });
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const loadToast = toast.loading('Adding staff member...');
    try {
      await api.post('/auth/register', { ...createForm, role: 'staff' });
      toast.success('Staff member added', { id: loadToast });
      setShowCreateModal(false);
      setCreateForm({ name: '', email: '', password: '', phone: '', monthlySalary: '' });
      fetchStaff();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not add staff member', { id: loadToast });
    }
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm) return;
    const loadToast = toast.loading('Removing staff member...');
    try {
      await api.delete(`/users/${showDeleteConfirm}`);
      setStaff(staff.filter(s => s._id !== showDeleteConfirm));
      toast.success('Staff member removed', { id: loadToast });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not remove staff member', { id: loadToast });
    } finally {
      setShowDeleteConfirm(null);
    }
  };

  if (loading) return <LoadingScreen fullScreen={false} />;

  return (
    <PageTransition>
      <div className="space-y-10">
        <SlideIn direction="down">
          <div className="bg-(--color-surface) dark:bg-(--color-surface) p-10 rounded-xl shadow-sm border border-(--color-border) dark:border-(--color-border) flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div>
              <h1 className="text-3xl font-bold text-(--color-text-primary) dark:text-(--color-text-primary) flex items-center tracking-tight leading-none">
                <Users className="mr-4 text-primary" size={36} /> Branch <span className="ml-3 text-primary">Staff</span>
              </h1>
              <p className="text-(--color-text-muted) dark:text-(--color-text-muted) text-sm mt-2 font-medium">Manage your cafe team and staff members.</p>
            </div>
            <div className="flex items-center space-x-6">

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowCreateModal(true)}
                className="bg-primary text-(--color-on-primary) px-10 py-5 rounded-xl font-bold text-xs uppercase tracking-normal shadow-sm  flex items-center"
              >
                <Plus size={20} className="mr-3" strokeWidth={3} /> Add Staff
              </motion.button>
            </div>
          </div>
        </SlideIn>

        {refetching ? (
          <TableSkeleton rows={6} cols={5} />
        ) : (
        <div className="overflow-x-auto rounded-xl border border-(--color-border) bg-(--color-surface)/40  shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-(--color-border) bg-(--color-surface-soft)/50">
                <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Staff Member</th>
                <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Contact Details</th>
                <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Role</th>
                <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Location</th>
                <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) text-right">Actions</th>
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
                  className="group border-b border-(--color-border) hover:bg-primary/5 transition-all cursor-pointer"
                >
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-inner transition-transform font-bold">
                        {member.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-(--color-text-primary)">{member.name}</p>
                        <p className="text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal mt-0.5">ID: {member._id.slice(-6).toUpperCase()}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-xs font-bold text-(--color-text-primary)">
                        <Mail size={12} className="text-primary" />
                        {member.email}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-medium text-(--color-text-muted)">
                        <Phone size={12} />
                        {member.phone}
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold uppercase tracking-normal">
                      {member.role}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2 text-(--color-text-primary)">
                      <MapPin size={14} className="text-primary" />
                      <span className="text-sm font-bold">{member.city}, {member.state}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end gap-2 transition-opacity">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => { e.stopPropagation(); handleEdit(member); }}
                        className="p-2.5 text-(--color-text-muted) hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
                      >
                        <Edit3 size={18} />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(member._id); }}
                        className="p-2.5 text-(--color-text-muted) hover:text-danger hover:bg-danger/10 rounded-xl transition-all"
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
            <div className="p-20 text-center text-(--color-text-muted)">
              <Users size={48} className="mx-auto mb-4 opacity-20" />
              <p className="text-sm font-bold uppercase tracking-normal">No staff added yet</p>
            </div>
          )}
        </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-8 py-6 bg-(--color-surface) dark:bg-(--color-surface) border border-(--color-border) dark:border-(--color-border) rounded-xl mt-10 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-4 py-2 rounded-xl bg-(--color-surface-soft) dark:bg-(--color-surface) border border-(--color-border) dark:border-(--color-border) text-[10px] font-bold uppercase tracking-normal disabled:opacity-30 transition-all hover:bg-(--color-surface-soft) dark:hover:bg-(--color-surface-soft)"
              >
                Previous
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-4 py-2 rounded-xl bg-(--color-surface-soft) dark:bg-(--color-surface) border border-(--color-border) dark:border-(--color-border) text-[10px] font-bold uppercase tracking-normal disabled:opacity-30 transition-all hover:bg-(--color-surface-soft) dark:hover:bg-(--color-surface-soft)"
              >
                Next
              </button>
            </div>
          </div>
        )}

        <Modal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          title="Edit Staff Details"
        >
          <form onSubmit={handleUpdate} className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal mb-2 ml-1">Full Name</label>
                <input required className="w-full px-5 py-4 rounded-xl bg-(--color-surface-soft) dark:bg-(--color-surface)/50 border-none focus:ring-2 focus:ring-primary transition-all text-sm font-bold dark:text-(--color-text-primary) outline-none" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal mb-2 ml-1">Email</label>
                <input required type="email" className="w-full px-5 py-4 rounded-xl bg-(--color-surface-soft) dark:bg-(--color-surface)/50 border-none focus:ring-2 focus:ring-primary transition-all text-sm font-bold dark:text-(--color-text-primary) outline-none" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div>
                <label className="block text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal mb-2 ml-1">Phone</label>
                <input required type="number" className="w-full px-5 py-4 rounded-xl bg-(--color-surface-soft) dark:bg-(--color-surface)/50 border-none focus:ring-2 focus:ring-primary transition-all text-sm font-bold dark:text-(--color-text-primary) outline-none" value={formData.phone} onInput={e => { if (e.target.value.length > 10) e.target.value = e.target.value.slice(0, 10); }} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal mb-2 ml-1">Age</label>
                <input required type="number" className="w-full px-5 py-4 rounded-xl bg-(--color-surface-soft) dark:bg-(--color-surface)/50 border-none focus:ring-2 focus:ring-primary transition-all text-sm font-bold dark:text-(--color-text-primary) outline-none" value={formData.age} onInput={e => { if (e.target.value.length > 2) e.target.value = e.target.value.slice(0, 2); }} onChange={e => setFormData({ ...formData, age: e.target.value })} />
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
              <label className="block text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal mb-2 ml-1">Address</label>
              <input required className="w-full px-5 py-4 rounded-xl bg-(--color-surface-soft) dark:bg-(--color-surface)/50 border-none focus:ring-2 focus:ring-primary transition-all text-sm font-bold dark:text-(--color-text-primary) outline-none" value={formData.address1} onChange={e => setFormData({ ...formData, address1: e.target.value })} />
            </div>

            <div className="grid grid-cols-4 gap-6">
              <div>
                <label className="block text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal mb-2 ml-1">City</label>
                <input required className="w-full px-5 py-4 rounded-xl bg-(--color-surface-soft) dark:bg-(--color-surface)/50 border-none focus:ring-2 focus:ring-primary transition-all text-sm font-bold dark:text-(--color-text-primary) outline-none" value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal mb-2 ml-1">State</label>
                <input required className="w-full px-5 py-4 rounded-xl bg-(--color-surface-soft) dark:bg-(--color-surface)/50 border-none focus:ring-2 focus:ring-primary transition-all text-sm font-bold dark:text-(--color-text-primary) outline-none" value={formData.state} onChange={e => setFormData({ ...formData, state: e.target.value })} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal mb-2 ml-1">Pincode</label>
                <input required type="number" className="w-full px-5 py-4 rounded-xl bg-(--color-surface-soft) dark:bg-(--color-surface)/50 border-none focus:ring-2 focus:ring-primary transition-all text-sm font-bold dark:text-(--color-text-primary) outline-none" value={formData.pincode} onInput={e => { if (e.target.value.length > 6) e.target.value = e.target.value.slice(0, 6); }} onChange={e => setFormData({ ...formData, pincode: e.target.value })} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal mb-2 ml-1">Monthly Salary (₹)</label>
                <input required type="number" className="w-full px-5 py-4 rounded-xl bg-(--color-surface-soft) dark:bg-(--color-surface)/50 border-none focus:ring-2 focus:ring-primary transition-all text-sm font-bold dark:text-(--color-text-primary) outline-none" value={formData.monthlySalary} onChange={e => setFormData({ ...formData, monthlySalary: e.target.value })} />
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-5 bg-primary text-(--color-on-primary) rounded-xl font-bold text-xs uppercase tracking-normal shadow-sm  mt-4"
            >
              Update Staff Details
            </motion.button>
          </form>
        </Modal>

        <ConfirmDialog
          isOpen={!!showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(null)}
          onConfirm={handleDelete}
          title="Remove Staff Member?"
          message="This staff member will be permanently deleted."
        />

        {/* Detailed Staff Details Modal */}
        <Modal
          isOpen={!!viewingStaff}
          onClose={() => setViewingStaff(null)}
          title="Staff Member Details"
          maxWidth="max-w-3xl"
        >
          {viewingStaff && (
            <div className="space-y-8">
              {/* Header Profile */}
              <div className="flex flex-col md:flex-row items-center md:items-start gap-8 pb-8 border-b border-(--color-border) dark:border-(--color-border)">
                <div className="relative group">
                  <div className="h-32 w-32 rounded-xl bg-gradient-to-br from-primary to-primary text-white flex items-center justify-center text-5xl font-bold shadow-sm  transition-transform">
                    {viewingStaff.name.charAt(0)}
                  </div>
                  <div className="absolute -bottom-2 -right-2 h-8 w-8 bg-success border-4 border-(--color-border) dark:border-(--color-border) rounded-full flex items-center justify-center text-white">
                    <UserCheck size={14} />
                  </div>
                </div>

                <div className="text-center md:text-left flex-1">
                  <h2 className="text-4xl font-bold text-(--color-text-primary) dark:text-(--color-text-primary) tracking-tight leading-none">{viewingStaff.name}</h2>
                  <p className="text-sm font-bold text-(--color-text-muted) mt-2 flex items-center justify-center md:justify-start gap-2">
                    <Mail size={14} className="text-primary" /> {viewingStaff.email}
                  </p>
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-4">
                    <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-normal rounded-full border border-primary/20">
                      {viewingStaff.role}
                    </span>
                    <span className="px-3 py-1 bg-(--color-surface-soft) dark:bg-(--color-surface) text-(--color-text-muted) text-[10px] font-bold uppercase tracking-normal rounded-full">
                      ID: {viewingStaff._id.slice(-6).toUpperCase()}
                    </span>
                    <span className="px-3 py-1 bg-success/10 text-success text-[10px] font-bold uppercase tracking-normal rounded-full">
                      Active Member
                    </span>
                  </div>
                </div>

                <div className="bg-(--color-surface-soft) dark:bg-(--color-surface)/50 p-6 rounded-xl border border-(--color-border) dark:border-(--color-border) text-right min-w-[180px]">
                  <p className="text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal mb-1">Monthly Salary</p>
                  <p className="text-3xl font-bold text-(--color-text-primary) dark:text-(--color-text-primary) tracking-tight">₹{viewingStaff.monthlySalary?.toLocaleString()}</p>
                </div>
              </div>

              {/* Data Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-8">
                  {/* Identity Section */}
                  <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) mb-6 flex items-center gap-2">
                      <CreditCard size={14} className="text-primary" /> Staff Details
                    </h3>
                    <div className="grid grid-cols-1 gap-6">
                      <div className="flex items-center gap-4 bg-(--color-surface-soft) dark:bg-(--color-surface)/50 p-4 rounded-xl border border-(--color-border) dark:border-(--color-border)">
                        <Hash className="text-primary" size={20} />
                        <div>
                          <p className="text-[8px] font-bold uppercase text-(--color-text-muted) tracking-normal">Aadhar Number</p>
                          <p className="text-sm font-bold text-(--color-text-secondary) dark:text-(--color-text-muted)">{viewingStaff.aadharNumber || 'Not added'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 bg-(--color-surface-soft) dark:bg-(--color-surface)/50 p-4 rounded-xl border border-(--color-border) dark:border-(--color-border)">
                        <Phone className="text-primary" size={20} />
                        <div>
                          <p className="text-[8px] font-bold uppercase text-(--color-text-muted) tracking-normal">Primary Contact</p>
                          <p className="text-sm font-bold text-(--color-text-secondary) dark:text-(--color-text-muted)">{viewingStaff.phone}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 bg-(--color-surface-soft) dark:bg-(--color-surface)/50 p-4 rounded-xl border border-(--color-border) dark:border-(--color-border)">
                        <Award className="text-primary" size={20} />
                        <div>
                          <p className="text-[8px] font-bold uppercase text-(--color-text-muted) tracking-normal">Qualification</p>
                          <p className="text-sm font-bold text-(--color-text-secondary) dark:text-(--color-text-muted)">{viewingStaff.highestQualification}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Demographic Section */}
                  <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) mb-6 flex items-center gap-2">
                      <Globe size={14} className="text-primary" /> Personal Information
                    </h3>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="bg-(--color-surface-soft) dark:bg-(--color-surface)/50 p-4 rounded-xl border border-(--color-border) dark:border-(--color-border)">
                        <p className="text-[8px] font-bold uppercase text-(--color-text-muted) tracking-normal mb-1">Age</p>
                        <p className="text-lg font-bold text-(--color-text-primary) dark:text-(--color-text-primary)">{viewingStaff.age} Years</p>
                      </div>
                      <div className="bg-(--color-surface-soft) dark:bg-(--color-surface)/50 p-4 rounded-xl border border-(--color-border) dark:border-(--color-border)">
                        <p className="text-[8px] font-bold uppercase text-(--color-text-muted) tracking-normal mb-1">Gender</p>
                        <p className="text-lg font-bold text-(--color-text-primary) dark:text-(--color-text-primary)">{viewingStaff.gender}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  {/* Address Section */}
                  <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) mb-6 flex items-center gap-2">
                      <MapPin size={14} className="text-primary" /> Address
                    </h3>
                    <div className="bg-(--color-surface-soft) dark:bg-(--color-surface)/50 p-6 rounded-xl border border-(--color-border) dark:border-(--color-border)">
                      <p className="text-sm font-bold text-(--color-text-secondary) dark:text-(--color-text-muted) leading-relaxed">
                        {viewingStaff.address1}<br />
                        {viewingStaff.address2 && <>{viewingStaff.address2}<br /></>}
                        {viewingStaff.city}, {viewingStaff.state}
                      </p>
                    </div>
                  </div>

                  {/* Document Proof Section */}
                  <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) mb-6 flex items-center gap-2">
                      <Info size={14} className="text-primary" /> Aadhar Card
                    </h3>
                    {viewingStaff.aadharImage ? (
                      <div className="group relative rounded-xl overflow-hidden border border-(--color-border) dark:border-(--color-border) bg-(--color-surface-soft) dark:bg-(--color-surface) aspect-video">
                        <img
                          src={viewingStaff.aadharImage}
                          alt="Aadhar Card"
                          className="w-full h-full object-cover transition-transform duration-700"
                        />
                        <a
                          href={viewingStaff.aadharImage}
                          target="_blank"
                          rel="noreferrer"
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-3 "
                        >
                          <Globe size={24} className="text-primary" />
                          <span className="font-bold text-[10px] uppercase tracking-normal">View Full Image</span>
                        </a>
                      </div>
                    ) : (
                      <div className="rounded-xl border-2 border-dashed border-(--color-border) dark:border-(--color-border) p-10 flex flex-col items-center justify-center text-(--color-text-muted) aspect-video">
                        <ShieldAlert size={32} className="mb-2 opacity-20" />
                        <p className="text-[10px] font-bold uppercase tracking-normal text-center">No Aadhar image uploaded</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="pt-8 border-t border-(--color-border) dark:border-(--color-border) flex gap-4">
                <Button
                  variant="outline"
                  className="flex-1 py-5 !rounded-xl font-bold text-xs uppercase tracking-normal"
                  onClick={() => setViewingStaff(null)}
                >
                  Close
                </Button>
                <Button
                  className="flex-1 py-5 !rounded-xl font-bold text-xs uppercase tracking-normal bg-(--color-surface-soft) text-(--color-text-primary) border border-(--color-border) shadow-sm"
                  onClick={() => {
                    handleEdit(viewingStaff);
                    setViewingStaff(null);
                  }}
                >
                  Edit Staff
                </Button>
              </div>
            </div>
          )}
        </Modal>

        {/* Create Staff Modal */}
        <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Add New Staff">
          <form onSubmit={handleCreate} className="space-y-5 p-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-normal text-(--color-text-muted) mb-2">Full Name</label>
              <input required className="w-full px-5 py-4 rounded-xl border border-(--color-border) bg-(--color-surface) text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40" value={createForm.name} onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))} placeholder="Staff member's name" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-normal text-(--color-text-muted) mb-2">Email</label>
              <input required type="email" className="w-full px-5 py-4 rounded-xl border border-(--color-border) bg-(--color-surface) text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40" value={createForm.email} onChange={e => setCreateForm(p => ({ ...p, email: e.target.value }))} placeholder="email@cafe.com" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-normal text-(--color-text-muted) mb-2">Password</label>
              <input required type="password" minLength={6} className="w-full px-5 py-4 rounded-xl border border-(--color-border) bg-(--color-surface) text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40" value={createForm.password} onChange={e => setCreateForm(p => ({ ...p, password: e.target.value }))} placeholder="Min 6 characters" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-normal text-(--color-text-muted) mb-2">Phone</label>
              <input type="tel" className="w-full px-5 py-4 rounded-xl border border-(--color-border) bg-(--color-surface) text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40" value={createForm.phone} onChange={e => setCreateForm(p => ({ ...p, phone: e.target.value }))} placeholder="Contact number" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-normal text-(--color-text-muted) mb-2">Monthly Salary</label>
              <input type="number" min="0" className="w-full px-5 py-4 rounded-xl border border-(--color-border) bg-(--color-surface) text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40" value={createForm.monthlySalary} onChange={e => setCreateForm(p => ({ ...p, monthlySalary: e.target.value }))} placeholder="0" />
            </div>
            <div className="flex gap-4 pt-2">
              <Button type="submit" className="flex-1">Create Staff</Button>
              <Button type="button" variant="outline" className="flex-1" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            </div>
          </form>
        </Modal>
      </div>
    </PageTransition>
  );
}
