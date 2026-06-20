'use client';
import { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import { Mail, MapPin, Phone, Users, Trash2, Plus, Edit3, UserCheck, ShieldAlert, Info, Calendar, Award, Briefcase, Hash, Globe, CreditCard } from 'lucide-react';
import { Skeleton } from '@/app/components/ui/Skeleton';
import { PageTransition, SlideIn, CardHover } from '../../../components/ui/AnimatedContainer';
import Modal from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import Link from 'next/link';
import PremiumSelect from '../../../components/ui/PremiumSelect';

export default function LocationStaffPage() {
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

  const fetchStaff = async () => {
    try {
      const res = await api.get('/users');
      setStaff(res.data.data);
    } catch (error) {
      toast.error('Failed to load staff list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStaff();
    }, 0);

    return () => clearTimeout(timer);
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
    const loadToast = toast.loading('Saving changes...');
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
    const loadToast = toast.loading('Removing staff member...');
    try {
      await api.delete(`/users/${showDeleteConfirm}`);
      setStaff(staff.filter(s => s._id !== showDeleteConfirm));
      toast.success('Staff member removed', { id: loadToast });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error removing staff', { id: loadToast });
    } finally {
      setShowDeleteConfirm(null);
    }
  };

  if (loading) return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-64 rounded-xl" />)}
    </div>
  );

  return (
    <PageTransition>
      <div className="space-y-10">
        <SlideIn direction="down">
          <div className="bg-[var(--color-surface)] dark:bg-[var(--color-surface)] p-10 rounded-xl shadow-sm border border-[var(--color-border)] dark:border-[var(--color-border)] flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div>
              <h1 className="text-3xl font-bold text-[var(--color-text-primary)] dark:text-[var(--color-text-primary)] flex items-center tracking-tight leading-none">
                <Users className="mr-4 text-[var(--color-primary)]" size={36} /> Branch <span className="ml-3 text-[var(--color-primary)]">Staff</span>
              </h1>
              <p className="text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] text-sm mt-2 font-medium">Manage your branch staff and their details.</p>
            </div>
            <div className="flex items-center space-x-6">

              <Link href="/signup">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-[var(--color-primary)] text-[var(--color-on-primary)] px-10 py-5 rounded-xl font-bold text-xs uppercase tracking-normal shadow-sm  flex items-center"
                >
                  <Plus size={20} className="mr-3" strokeWidth={3} /> Add Staff
                </motion.button>
              </Link>
            </div>
          </div>
        </SlideIn>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {staff.map((member, i) => (
            <SlideIn key={member._id} delay={i * 0.05}>
              <CardHover>
                <div
                  onClick={() => setViewingStaff(member)}
                  className="bg-[var(--color-surface)] dark:bg-[var(--color-surface)] rounded-xl shadow-sm border border-[var(--color-border)] dark:border-[var(--color-border)] p-8 relative group overflow-hidden h-full flex flex-col cursor-pointer"
                >
                  <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group- duration-700">
                    <Users size={120} />
                  </div>

                  <div className="flex items-center space-x-5 relative z-10">
                    <div className="h-16 w-16 rounded-xl bg-[var(--color-primary-soft)] flex items-center justify-center text-[var(--color-primary)] dark:text-[var(--color-primary)] border border-[var(--color-primary)]/20 shadow-inner">
                      <span className="text-2xl font-bold uppercase">{member.name.charAt(0)}</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-[var(--color-text-primary)] dark:text-[var(--color-text-primary)] text-xl tracking-tight leading-tight">{member.name}</h3>
                      <div className="flex items-center mt-1">
                        <UserCheck size={12} className="text-[var(--color-primary)] mr-2" />
                        <span className="text-[10px] font-bold text-[var(--color-primary)] dark:text-[var(--color-primary)] uppercase tracking-normal">{member.role}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 space-y-4 relative z-10 flex-grow">
                    <div className="flex items-center text-xs font-bold text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)] transition-colors">
                      <Mail size={16} className="mr-4 opacity-40" /> {member.email}
                    </div>
                    <div className="flex items-center text-xs font-bold text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">
                      <Phone size={16} className="mr-4 opacity-40" /> {member.phone}
                    </div>
                    <div className="flex items-center text-xs font-bold text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] truncate">
                      <MapPin size={16} className="mr-4 opacity-40" /> {member.city}, {member.state}
                    </div>
                  </div>

                  <div className="mt-10 pt-6 border-t border-[var(--color-border)] dark:border-[var(--color-border)] flex justify-end items-center relative z-10">
                    <div className="flex space-x-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEdit(member); }}
                        className="p-3 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)] dark:hover:bg-[var(--color-primary)]/10 rounded-xl transition-all"
                        title="Edit Profile"
                      >
                        <Edit3 size={20} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(member._id); }}
                        className="p-3 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)] dark:hover:bg-[var(--color-danger)]/10 rounded-xl transition-all"
                        title="Remove Staff"
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
            <div className="col-span-full py-32 bg-[var(--color-surface)] dark:bg-[var(--color-surface)] rounded-xl border-4 border-dashed border-[var(--color-border)] dark:border-[var(--color-border)] flex flex-col items-center justify-center opacity-30">
              <ShieldAlert size={64} className="mb-6" />
              <p className="font-bold text-sm uppercase tracking-normal">Staff list is empty</p>
            </div>
          )}
        </div>

        <Modal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          title="Edit Staff Profile"
        >
          <form onSubmit={handleUpdate} className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal mb-2 ml-1">Full Name</label>
                <input required className="w-full px-5 py-4 rounded-xl bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)]/50 border-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all text-sm font-bold dark:text-[var(--color-text-primary)] outline-none" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal mb-2 ml-1">Email Address</label>
                <input required type="email" className="w-full px-5 py-4 rounded-xl bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)]/50 border-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all text-sm font-bold dark:text-[var(--color-text-primary)] outline-none" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div>
                <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal mb-2 ml-1">Phone</label>
                <input required className="w-full px-5 py-4 rounded-xl bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)]/50 border-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all text-sm font-bold dark:text-[var(--color-text-primary)] outline-none" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal mb-2 ml-1">Age</label>
                <input required type="number" className="w-full px-5 py-4 rounded-xl bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)]/50 border-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all text-sm font-bold dark:text-[var(--color-text-primary)] outline-none" value={formData.age} onChange={e => setFormData({ ...formData, age: e.target.value })} />
              </div>
                <PremiumSelect 
                  label="Gender"
                  value={formData.gender}
                  onChange={val => setFormData({ ...formData, gender: val })}
                  options={[
                    { label: 'Male', value: 'Male' },
                    { label: 'Female', value: 'Female' },
                    { label: 'Other', value: 'Other' }
                  ]}
                />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal mb-2 ml-1">Address</label>
              <input required className="w-full px-5 py-4 rounded-xl bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)]/50 border-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all text-sm font-bold dark:text-[var(--color-text-primary)] outline-none" value={formData.address1} onChange={e => setFormData({ ...formData, address1: e.target.value })} />
            </div>

            <div className="grid grid-cols-4 gap-6">
              <div>
                <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal mb-2 ml-1">City</label>
                <input required className="w-full px-5 py-4 rounded-xl bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)]/50 border-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all text-sm font-bold dark:text-[var(--color-text-primary)] outline-none" value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal mb-2 ml-1">State</label>
                <input required className="w-full px-5 py-4 rounded-xl bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)]/50 border-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all text-sm font-bold dark:text-[var(--color-text-primary)] outline-none" value={formData.state} onChange={e => setFormData({ ...formData, state: e.target.value })} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal mb-2 ml-1">Pincode</label>
                <input required className="w-full px-5 py-4 rounded-xl bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)]/50 border-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all text-sm font-bold dark:text-[var(--color-text-primary)] outline-none" value={formData.pincode} onChange={e => setFormData({ ...formData, pincode: e.target.value })} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal mb-2 ml-1">Monthly Salary (₹)</label>
                <input required type="number" className="w-full px-5 py-4 rounded-xl bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)]/50 border-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all text-sm font-bold dark:text-[var(--color-text-primary)] outline-none" value={formData.monthlySalary} onChange={e => setFormData({ ...formData, monthlySalary: e.target.value })} />
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-5 bg-[var(--color-primary)] text-[var(--color-on-primary)] rounded-xl font-bold text-xs uppercase tracking-normal shadow-sm  mt-4"
            >
              Update Staff Records
            </motion.button>
          </form>
        </Modal>

        <ConfirmDialog
          isOpen={!!showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(null)}
          onConfirm={handleDelete}
          title="Remove Staff Member?"
          message="This staff member will be permanently removed from the system."
        />

        {/* Detailed Staff Details Modal */}
        <Modal
          isOpen={!!viewingStaff}
          onClose={() => setViewingStaff(null)}
          title="Staff Details"
          maxWidth="max-w-3xl"
        >
          {viewingStaff && (
            <div className="space-y-8">
              {/* Header Profile */}
              <div className="flex flex-col md:flex-row items-center md:items-start gap-8 pb-8 border-b border-[var(--color-border)] dark:border-[var(--color-border)]">
                <div className="relative group">
                  <div className="h-32 w-32 rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary)] text-white flex items-center justify-center text-5xl font-bold shadow-sm  group- transition-transform">
                    {viewingStaff.name.charAt(0)}
                  </div>
                  <div className="absolute -bottom-2 -right-2 h-8 w-8 bg-[var(--color-success)] border-4 border-[var(--color-border)] dark:border-[var(--color-border)] rounded-full flex items-center justify-center text-white">
                    <UserCheck size={14} />
                  </div>
                </div>

                <div className="text-center md:text-left flex-1">
                  <h2 className="text-4xl font-bold text-[var(--color-text-primary)] dark:text-[var(--color-text-primary)] tracking-tight leading-none">{viewingStaff.name}</h2>
                  <p className="text-sm font-bold text-[var(--color-text-muted)] mt-2 flex items-center justify-center md:justify-start gap-2">
                    <Mail size={14} className="text-[var(--color-primary)]" /> {viewingStaff.email}
                  </p>
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-4">
                    <span className="px-3 py-1 bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-[10px] font-bold uppercase tracking-normal rounded-full border border-[var(--color-primary)]/20">
                      {viewingStaff.role}
                    </span>
                    <span className="px-3 py-1 bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)] text-[var(--color-text-muted)] text-[10px] font-bold uppercase tracking-normal rounded-full">
                      ID: {viewingStaff._id.slice(-6).toUpperCase()}
                    </span>
                    <span className="px-3 py-1 bg-[var(--color-success)]/10 text-[var(--color-success)] text-[10px] font-bold uppercase tracking-normal rounded-full">
                      Working
                    </span>
                  </div>
                </div>

                <div className="bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)]/50 p-6 rounded-xl border border-[var(--color-border)] dark:border-[var(--color-border)] text-right min-w-[180px]">
                  <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal mb-1">Monthly Salary</p>
                  <p className="text-3xl font-bold text-[var(--color-text-primary)] dark:text-[var(--color-text-primary)] tracking-tight">₹{viewingStaff.monthlySalary?.toLocaleString()}</p>
                </div>
              </div>

              {/* Data Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-8">
                  {/* Identity Section */}
                  <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)] mb-6 flex items-center gap-2">
                      <CreditCard size={14} className="text-[var(--color-primary)]" /> Staff Details
                    </h3>
                    <div className="grid grid-cols-1 gap-6">
                      <div className="flex items-center gap-4 bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)]/50 p-4 rounded-xl border border-[var(--color-border)] dark:border-[var(--color-border)]">
                        <Hash className="text-[var(--color-primary)]" size={20} />
                        <div>
                          <p className="text-[8px] font-bold uppercase text-[var(--color-text-muted)] tracking-normal">Aadhar Number</p>
                          <p className="text-sm font-bold text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)]">{viewingStaff.aadharNumber || 'Not Indexed'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)]/50 p-4 rounded-xl border border-[var(--color-border)] dark:border-[var(--color-border)]">
                        <Phone className="text-[var(--color-primary)]" size={20} />
                        <div>
                          <p className="text-[8px] font-bold uppercase text-[var(--color-text-muted)] tracking-normal">Phone Number</p>
                          <p className="text-sm font-bold text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)]">{viewingStaff.phone}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)]/50 p-4 rounded-xl border border-[var(--color-border)] dark:border-[var(--color-border)]">
                        <Award className="text-[var(--color-primary)]" size={20} />
                        <div>
                          <p className="text-[8px] font-bold uppercase text-[var(--color-text-muted)] tracking-normal">Qualification</p>
                          <p className="text-sm font-bold text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)]">{viewingStaff.highestQualification}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Demographic Section */}
                  <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)] mb-6 flex items-center gap-2">
                      <Globe size={14} className="text-[var(--color-primary)]" /> Personal Details
                    </h3>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)]/50 p-4 rounded-xl border border-[var(--color-border)] dark:border-[var(--color-border)]">
                        <p className="text-[8px] font-bold uppercase text-[var(--color-text-muted)] tracking-normal mb-1">Age</p>
                        <p className="text-lg font-bold text-[var(--color-text-primary)] dark:text-[var(--color-text-primary)]">{viewingStaff.age} Years</p>
                      </div>
                      <div className="bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)]/50 p-4 rounded-xl border border-[var(--color-border)] dark:border-[var(--color-border)]">
                        <p className="text-[8px] font-bold uppercase text-[var(--color-text-muted)] tracking-normal mb-1">Gender</p>
                        <p className="text-lg font-bold text-[var(--color-text-primary)] dark:text-[var(--color-text-primary)]">{viewingStaff.gender}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  {/* Address Section */}
                  <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)] mb-6 flex items-center gap-2">
                      <MapPin size={14} className="text-[var(--color-primary)]" /> Address
                    </h3>
                    <div className="bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)]/50 p-6 rounded-xl border border-[var(--color-border)] dark:border-[var(--color-border)]">
                      <p className="text-sm font-bold text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)] leading-relaxed">
                        {viewingStaff.address1}<br />
                        {viewingStaff.address2 && <>{viewingStaff.address2}<br /></>}
                        {viewingStaff.city}, {viewingStaff.state}
                      </p>
                    </div>
                  </div>

                  {/* Document Proof Section */}
                  <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)] mb-6 flex items-center gap-2">
                      <Info size={14} className="text-[var(--color-primary)]" /> Aadhar Card
                    </h3>
                    {viewingStaff.aadharImage ? (
                      <div className="group relative rounded-xl overflow-hidden border border-[var(--color-border)] dark:border-[var(--color-border)] bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)] aspect-video">
                        <img
                          src={viewingStaff.aadharImage}
                          alt="Aadhar Card"
                          className="w-full h-full object-cover group- transition-transform duration-700"
                        />
                        <a
                          href={viewingStaff.aadharImage}
                          target="_blank"
                          rel="noreferrer"
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-3 "
                        >
                          <Globe size={24} className="text-[var(--color-primary)]" />
                          <span className="font-bold text-[10px] uppercase tracking-normal">View Original Image</span>
                        </a>
                      </div>
                    ) : (
                      <div className="rounded-xl border-2 border-dashed border-[var(--color-border)] dark:border-[var(--color-border)] p-10 flex flex-col items-center justify-center text-[var(--color-text-muted)] aspect-video">
                        <ShieldAlert size={32} className="mb-2 opacity-20" />
                        <p className="text-[10px] font-bold uppercase tracking-normal text-center">Aadhar Image Missing</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="pt-8 border-t border-[var(--color-border)] dark:border-[var(--color-border)] flex gap-4">
                <Button
                  variant="outline"
                  className="flex-1 py-5 !rounded-xl font-bold text-xs uppercase tracking-normal"
                  onClick={() => setViewingStaff(null)}
                >
                  Close
                </Button>
                <Button
                  className="flex-1 py-5 !rounded-xl font-bold text-xs uppercase tracking-normal bg-[var(--color-surface-soft)] text-[var(--color-text-primary)] border border-[var(--color-border)] shadow-sm"
                  onClick={() => {
                    handleEdit(viewingStaff);
                    setViewingStaff(null);
                  }}
                >
                  Edit Details
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </PageTransition>
  );
}
