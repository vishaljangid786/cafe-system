'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/app/services/api';
import { useAuth } from '@/app/context/AuthContext';
import { 
  Users, UserPlus, Search,
  Shield, Mail, Phone, Edit, UserCheck,
  UserX
} from 'lucide-react';
import { PageTransition } from '@/app/components/ui/AnimatedContainer';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import PremiumSelect from '@/app/components/ui/PremiumSelect';
import { Button } from '@/app/components/ui/Button';
import Modal from '@/app/components/ui/Modal';
import ConfirmDialog from '@/app/components/ui/ConfirmDialog';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { progress } from '@/app/components/ui/TopProgressBar';
import { TableSkeleton } from '@/app/components/ui/Skeleton';

export default function UsersPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (user && !['super_admin', 'admin'].includes(user.role)) {
      toast.error('Access denied. Admin permission required.');
      router.push('/dashboard');
    }
  }, [user, router]);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const didInitRef = useRef(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [locations, setLocations] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 10;
  
  // New States
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  const fetchUsers = async () => {
    const isInitial = !didInitRef.current;
    if (isInitial) setLoading(true);
    else setRefetching(true);
    progress.start();
    try {
      const params = new URLSearchParams();
      params.append('page', currentPage);
      params.append('limit', itemsPerPage);
      if (searchTerm) params.append('search', searchTerm);
      if (roleFilter !== 'all') params.append('role', roleFilter);
      if (locationFilter !== 'all') params.append('locationId', locationFilter);
      
      const res = await api.get(`/users?${params.toString()}`);
      
      // Client-side filtering for status since backend doesn't support it yet
      let data = res.data.data;
      if (statusFilter === 'active') data = data.filter(u => !u.isBlocked);
      if (statusFilter === 'blocked') data = data.filter(u => u.isBlocked);
      
      setUsers(data);
      setTotalPages(res.data.pagination?.pages || 1);
    } catch (err) {
      toast.error('Could not load users');
    } finally {
      didInitRef.current = true;
      setLoading(false);
      setRefetching(false);
      progress.done();
    }
  };

  const fetchLocations = async () => {
    try {
      const res = await api.get('/locations');
      setLocations(res.data.data);
    } catch (err) {
      console.error('Failed to load locations');
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLocations();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 300); // Debounce search

    return () => clearTimeout(timer);
  }, [searchTerm, roleFilter, locationFilter, statusFilter, currentPage]);

  const toggleUserStatus = async (userId, currentStatus) => {
    try {
      await api.patch(`/users/${userId}/toggle-block`);
      toast.success(`User settings saved`);
      fetchUsers();
    } catch (err) {
      toast.error('Could not update user. Please try again.');
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setShowEditModal(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    try {
      setSaving(true);
      await api.put(`/users/${editingUser._id}`, data);
      toast.success('User updated successfully');
      setShowEditModal(false);
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update user. Please try again.');
    } finally {
      setSaving(false);
    }
  };


  const handleDelete = async () => {
    try {
      setSaving(true);
      await api.delete(`/users/${userToDelete._id}`);
      toast.success('User deleted');
      setShowDeleteConfirm(false);
      setUserToDelete(null);
      fetchUsers();
    } catch (err) {
      toast.error('Could not delete user. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = users; // Server-side handles most filtering now

  const getRoleStyle = (role) => {
    if (role === 'admin') return 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/20';
    if (role === 'branch_admin') return 'bg-[var(--color-secondary)]/10 text-[var(--color-secondary)] border-[var(--color-secondary)]/20';
    return 'bg-[var(--color-text-muted)]/10 text-[var(--color-text-muted)] border-[var(--color-text-muted)]/20';
  };

  if (loading) return <LoadingScreen fullScreen={false} />;

  return (
    <PageTransition>
      <div className="space-y-10 pb-20">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="px-4 py-1.5 bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-[10px] font-bold uppercase tracking-normal rounded-full border border-[var(--color-primary)]/20 ">
              Role: ADMIN
            </span>
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-text-muted)]" />
              <span className="text-[var(--color-text-muted)] text-[10px] font-bold uppercase tracking-normal">User Management</span>
            </div>
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[var(--color-text-primary)] flex items-center gap-3 sm:gap-4 italic uppercase">
              <Users className="text-[var(--color-primary)] h-10 w-10 sm:h-14 sm:w-14 lg:h-16 lg:w-16 " />
              Users <span className="text-[var(--color-text-muted)] not-italic">List</span>
            </h1>
          </div>

          <Button 
            variant="primary" 
            className="h-12 sm:h-16 w-full md:w-auto px-6 sm:px-10 !rounded-xl shadow-sm "
            icon={UserPlus}
            onClick={() => router.push('/signup')}
          >
            Add New Staff
          </Button>
        </div>

        {/* Quick Search & Filter */}
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="md:col-span-2 lg:col-span-3 relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-[var(--color-primary)] transition-colors" size={20} />
            <input 
              type="text" 
              placeholder="Search by name, email..."
              className="w-full pl-14 pr-6 py-5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-sm font-bold text-[var(--color-text-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <PremiumSelect
            value={roleFilter}
            onChange={(val) => {
              setRoleFilter(val);
              setCurrentPage(1);
            }}
            options={[
              { label: 'All Roles', value: 'all' },
              { label: 'Admin', value: 'admin' },
              { label: 'Branch Manager', value: 'branch_admin' },
              { label: 'Chef', value: 'chef' },
              { label: 'Staff', value: 'staff' }
            ]}
          />
          <PremiumSelect
            value={locationFilter}
            onChange={(val) => {
              setLocationFilter(val);
              setCurrentPage(1);
            }}
            options={[
              { label: 'All Locations', value: 'all' },
              ...locations.map(loc => ({ label: loc.name, value: loc._id }))
            ]}
          />
          <PremiumSelect
            value={statusFilter}
            onChange={(val) => {
              setStatusFilter(val);
              setCurrentPage(1);
            }}
            options={[
              { label: 'All Status', value: 'all' },
              { label: 'Active', value: 'active' },
              { label: 'Blocked', value: 'blocked' }
            ]}
          />
        </div>

        {/* User List */}
        <div className="bg-[var(--color-surface)]/40  rounded-xl sm:rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
          {refetching ? (
            <div className="p-6">
              <TableSkeleton rows={6} cols={5} />
            </div>
          ) : (
          <>
          {filteredUsers.length === 0 && (
            <div className="p-10 text-center text-sm text-[var(--color-text-muted)]">
              No users found for current filters.
            </div>
          )}

          {/* Mobile cards */}
          <div className="md:hidden p-4 space-y-3">
            {filteredUsers.map((u, idx) => (
              <motion.div
                key={u._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-12 w-12 rounded-xl bg-[var(--color-surface-soft)] border border-[var(--color-border)] flex items-center justify-center relative shrink-0 overflow-hidden">
                      {u.profileImageUrl ? (
                        <img src={u.profileImageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Users size={20} className="text-[var(--color-primary)]" />
                      )}
                      <div className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[var(--color-surface)] ${!u.isBlocked ? 'bg-[var(--color-success)]' : 'bg-[var(--color-danger)]'}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[var(--color-text-primary)] truncate">{u.name}</p>
                      <p className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal mt-0.5">ID: {u._id.substring(u._id.length - 8).toUpperCase()}</p>
                    </div>
                  </div>
                  <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[9px] font-bold uppercase tracking-wider ${getRoleStyle(u.role)}`}>
                    <Shield size={10} />
                    {u.role.replace('_', ' ')}
                  </div>
                </div>

                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                    <Mail size={12} className="text-[var(--color-primary)]/60 shrink-0" />
                    <span className="text-xs font-bold truncate">{u.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                    <Phone size={12} className="text-[var(--color-primary)]/60 shrink-0" />
                    <span className="text-xs font-bold">{u.phone || 'N/A'}</span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => toggleUserStatus(u._id, u.isBlocked)}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
                      !u.isBlocked
                        ? 'bg-[var(--color-danger)]/10 text-[var(--color-danger)] border-[var(--color-danger)]/20 hover:bg-[var(--color-danger)] hover:text-white'
                        : 'bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/20 hover:bg-[var(--color-success)] hover:text-white'
                    }`}
                    title={!u.isBlocked ? 'Block user' : 'Unblock user'}
                  >
                    <span className="inline-flex items-center justify-center gap-1.5">
                      {!u.isBlocked ? <UserX size={14} /> : <UserCheck size={14} />}
                      {!u.isBlocked ? 'Block' : 'Unblock'}
                    </span>
                  </button>
                  <button 
                    onClick={() => handleEdit(u)}
                    className="p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] text-[var(--color-text-secondary)] text-xs font-bold hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]/30 transition-all inline-flex items-center justify-center gap-1.5"
                  >
                    <Edit size={14} />
                    Edit
                  </button>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="responsive-table-container hidden md:block">
            <table className="w-full min-w-[760px] text-left border-separate border-spacing-0 bg-[var(--color-surface)]">
              <thead>
                <tr className="bg-[var(--color-surface-soft)] text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)]">
                  <th className="px-4 sm:px-10 py-4 sm:py-6">Name</th>
                  <th className="px-4 sm:px-10 py-4 sm:py-6">Contact</th>
                  <th className="px-4 sm:px-10 py-4 sm:py-6">Location</th>
                  <th className="px-4 sm:px-10 py-4 sm:py-6">Role</th>
                  <th className="px-4 sm:px-10 py-4 sm:py-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y border-[var(--color-border)]">
                {filteredUsers.map((u, idx) => (
                  <motion.tr 
                    key={u._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="group hover:bg-[var(--color-primary)]/[0.02] transition-all"
                  >
                    <td className="px-4 sm:px-10 py-5 sm:py-8">
                      <div className="flex items-center gap-5">
                        <div className="h-14 w-14 rounded-xl bg-[var(--color-surface-soft)] border border-[var(--color-border)] flex items-center justify-center relative transition-transform overflow-hidden shadow-lg">
                          {u.profileImageUrl ? (
                            <img src={u.profileImageUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <Users size={24} className="text-[var(--color-primary)]" />
                          )}
                          <div className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[var(--color-surface)] ${!u.isBlocked ? 'bg-[var(--color-success)]' : 'bg-[var(--color-danger)]'}`} />
                        </div>
                        <div>
                          <p className="text-base font-bold text-[var(--color-text-primary)] italic tracking-tight">{u.name}</p>
                          <p className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal mt-0.5">ID: {u._id.substring(u._id.length - 8).toUpperCase()}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 sm:px-10 py-5 sm:py-8">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                          <Mail size={12} className="text-[var(--color-primary)]/50" />
                          <span className="text-xs font-bold">{u.email}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                          <Phone size={12} className="text-[var(--color-primary)]/50" />
                          <span className="text-xs font-bold">{u.phone || 'N/A'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 sm:px-10 py-5 sm:py-8">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-[var(--color-text-primary)] italic">{u.assignedLocation?.name || 'Global'}</span>
                        <span className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal">{u.assignedLocation?.city || 'HQ'}</span>
                      </div>
                    </td>
                    <td className="px-4 sm:px-10 py-5 sm:py-8">
                      <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-[9px] font-bold uppercase tracking-normal ${getRoleStyle(u.role)}`}>
                        <Shield size={10} />
                        {u.role.replace('_', ' ')}
                      </div>
                    </td>
                    <td className="px-4 sm:px-10 py-5 sm:py-8 text-right">
                      <div className="flex items-center justify-end gap-2 sm:gap-3  transition-opacity">
                        <button 
                          onClick={() => toggleUserStatus(u._id, u.isBlocked)}
                          className={`p-3 rounded-xl border transition-all ${
                            !u.isBlocked 
                            ? 'bg-[var(--color-danger)]/10 text-[var(--color-danger)] border-[var(--color-danger)]/20 hover:bg-[var(--color-danger)] hover:text-white' 
                            : 'bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/20 hover:bg-[var(--color-success)] hover:text-white'
                          }`}
                          title={!u.isBlocked ? 'Block user' : 'Unblock user'}
                        >
                          {!u.isBlocked ? <UserX size={18} /> : <UserCheck size={18} />}
                        </button>
                        <button 
                          onClick={() => handleEdit(u)}
                          className="p-3 bg-[var(--color-surface-soft)] border border-[var(--color-border)] rounded-xl text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]/30 transition-all"
                        >
                          <Edit size={18} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
          )}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-8 py-6 bg-[var(--color-surface)]/40  border border-[var(--color-border)] rounded-xl shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)]">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="h-10 px-6 !rounded-xl text-[10px] uppercase font-bold tracking-normal"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                className="h-10 px-6 !rounded-xl text-[10px] uppercase font-bold tracking-normal"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}


        {/* Edit User Modal */}
        <Modal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          title={`Edit User: ${editingUser?.name}`}
        >
          {editingUser && (
            <form onSubmit={handleUpdate} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)] ml-1">Full Name</label>
                  <input required name="name" defaultValue={editingUser.name} className="w-full px-5 py-4 rounded-xl bg-[var(--color-surface-soft)] border border-[var(--color-border)] text-sm font-bold text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)] ml-1">Email Address</label>
                  <input required type="email" name="email" defaultValue={editingUser.email} className="w-full px-5 py-4 rounded-xl bg-[var(--color-surface-soft)] border border-[var(--color-border)] text-sm font-bold text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)] ml-1">Phone Number</label>
                  <input name="phone" defaultValue={editingUser.phone} className="w-full px-5 py-4 rounded-xl bg-[var(--color-surface-soft)] border border-[var(--color-border)] text-sm font-bold text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]" placeholder="10 Digit Number" maxLength="10" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)] ml-1">Age</label>
                  <input type="number" name="age" defaultValue={editingUser.age} className="w-full px-5 py-4 rounded-xl bg-[var(--color-surface-soft)] border border-[var(--color-border)] text-sm font-bold text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]" placeholder="Min 18" min="18" max="99" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)] ml-1">Gender</label>
                  <select name="gender" defaultValue={editingUser.gender || 'Male'} className="w-full px-5 py-4 rounded-xl bg-[var(--color-surface-soft)] border border-[var(--color-border)] text-sm font-bold text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)] appearance-none">
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)] ml-1">Staff Role</label>
                  <select name="role" defaultValue={editingUser.role} className="w-full px-5 py-4 rounded-xl bg-[var(--color-surface-soft)] border border-[var(--color-border)] text-sm font-bold text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)] appearance-none">
                    <option value="staff">Staff</option>
                    <option value="chef">Chef</option>
                    <option value="branch_admin">Branch Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)] ml-1">Address Details</label>
                  <input name="address1" defaultValue={editingUser.address1} className="w-full px-5 py-4 rounded-xl bg-[var(--color-surface-soft)] border border-[var(--color-border)] text-sm font-bold text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]" placeholder="Street Address" />
                </div>
                <div className="grid grid-cols-2 gap-4 md:col-span-2">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)] ml-1">City</label>
                    <input name="city" defaultValue={editingUser.city} className="w-full px-5 py-4 rounded-xl bg-[var(--color-surface-soft)] border border-[var(--color-border)] text-sm font-bold text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]" placeholder="City" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)] ml-1">Pincode</label>
                    <input name="pincode" defaultValue={editingUser.pincode} className="w-full px-5 py-4 rounded-xl bg-[var(--color-surface-soft)] border border-[var(--color-border)] text-sm font-bold text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]" placeholder="6 Digits" maxLength="6" />
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-center pt-6 border-t border-[var(--color-border)]">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="text-[var(--color-danger)] border-[var(--color-danger)]/20 hover:bg-[var(--color-danger)]/10"
                  onClick={() => {
                    setUserToDelete(editingUser);
                    setShowDeleteConfirm(true);
                    setShowEditModal(false);
                  }}
                >
                  Delete User
                </Button>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={() => setShowEditModal(false)}>Cancel</Button>
                  <Button type="submit" variant="primary" disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            </form>
          )}
        </Modal>

        {/* Delete Confirmation */}
        <ConfirmDialog
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
          title="Delete User"
          message={`Are you sure you want to permanently delete ${userToDelete?.name}? This cannot be undone.`}
          confirmLabel="Delete Permanently"
          cancelLabel="Cancel"
          variant="danger"
          loading={saving}
        />
      </div>
    </PageTransition>
  );
}
