'use client';
import { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import { Filter, ChevronRight, ChevronDown, Search, Users, Target, UserCheck, Mail, Phone, MapPin, Edit3, Trash2, ShieldAlert, Layers, Info, Hash, Award, CreditCard, Globe, Grid2X2, List, Plus } from 'lucide-react';
import PremiumSelect from '../../../components/ui/PremiumSelect';
import { PageTransition, SlideIn, CardHover } from '../../../components/ui/AnimatedContainer';
import Modal from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { useAuth } from '../../../context/AuthContext';
import ExportActions from '../../../components/ui/ExportActions';


export default function LocationStaffPage() {
  const { user: currentUser } = useAuth();
  const canManageStaff = currentUser?.role === 'super_admin' || currentUser?.permissions?.manageStaff === true;

  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [viewingStaff, setViewingStaff] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'tree'
  const [expandedBranchs, setExpandedBranchs] = useState({});
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', age: '', gender: 'Male',
    address1: '', city: '', state: '', pincode: '', monthlySalary: ''
  });
  const [locations, setLocations] = useState([]);
  const [locationFilter, setLocationFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [salaryFilter, setSalaryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [attendanceStaff, setAttendanceStaff] = useState(null);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceStatus, setAttendanceStatus] = useState('present');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const limit = 9; // Show 9 per page (3x3 grid)
  
  const columns = [
    { header: 'Name', key: 'name' },
    { header: 'Email', key: 'email' },
    { header: 'Phone', key: 'phone' },
    { header: 'Role', key: 'role' },
    { header: 'Branch', key: 'assignedLocation.name' },
    { header: 'City', key: 'assignedLocation.city' },
    { header: 'Salary', key: 'monthlySalary' }
  ];

  useEffect(() => {
    fetchLocations();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStaff();
    }, 0);

    return () => clearTimeout(timer);
  }, [roleFilter, locationFilter, statusFilter, salaryFilter, viewMode, page, searchQuery]);

  const fetchLocations = async () => {
    try {
      const res = await api.get('/locations');
      setLocations(res.data.data);
    } catch (error) {
      console.error("Failed to fetch locations");
    }
  };

  const fetchStaff = async () => {
    setLoading(true);
    try {
      // If in tree mode, we always want all available staff to build the hierarchy
      const params = viewMode === 'tree' ? {} : {
        role: roleFilter,
        locationId: locationFilter,
        status: statusFilter,
        salaryRange: salaryFilter,
        search: searchQuery,
        page,
        limit: viewMode === 'tree' ? 1000 : limit
      };
      const res = await api.get('/users', { params });
      setStaff(res.data.data);
      if (res.data.pagination) {
        setPagination(res.data.pagination);
      }
    } catch (error) {
      toast.error('Failed to load staff list');
    } finally {
      setLoading(false);
    }
  };

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

  const handleAdd = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const loadToast = toast.loading('Adding new staff member...');
    try {
      // In a real scenario, we might want to generate a temporary password 
      // or send an invite. For now, we'll use a default password 'Staff@123'
      const data = {
        ...formData,
        password: 'Staff@123',
        confirmPassword: 'Staff@123',
        role: formData.role || 'staff',
        assignedLocation: formData.assignedLocation || locationFilter || ''
      };

      await api.post('/auth/register', data);
      toast.success('Staff member added successfully', { id: loadToast });
      setShowAddModal(false);
      fetchStaff();
      // Reset form
      setFormData({
        name: '', email: '', phone: '', age: '', gender: 'Male',
        address1: '', city: '', state: '', country: 'India', pincode: '', monthlySalary: '',
        role: 'staff', assignedLocation: '', aadharNumber: '', highestQualification: '12th Pass'
      });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add staff', { id: loadToast });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkAttendance = async () => {
    const loadToast = toast.loading(`Marking ${attendanceStaff.name} as ${attendanceStatus}...`);
    try {
      await api.post('/attendance/mark', {
        userId: attendanceStaff._id,
        date: attendanceDate,
        status: attendanceStatus
      });
      toast.success('Attendance rule synchronized', { id: loadToast });
      setShowAttendanceModal(false);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to sync attendance', { id: loadToast });
    }
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm) return;
    const loadToast = toast.loading('Deleting staff record...');
    try {
      await api.delete(`/users/${showDeleteConfirm}`);
      setStaff(staff.filter(s => s._id !== showDeleteConfirm));
      toast.success('Staff details removed', { id: loadToast });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Delete failed', { id: loadToast });
    } finally {
      setShowDeleteConfirm(null);
    }
  };

  // No longer needed client-side, using backend filtered data
  const staffToDisplay = staff;

  const toggleBranch = (nodeId) => {
    setExpandedBranchs(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  };

  const StaffBranch = ({ member, childMembers, level = 0 }) => {
    const isExpanded = expandedBranchs[member._id];
    const hasChildren = childMembers && childMembers.length > 0;

    return (
      <div className="space-y-4">
        <div
          className={`group flex items-center p-6 rounded-[2rem] border transition-all cursor-pointer ${isExpanded ? 'bg-[var(--color-primary)]/5 border-[var(--color-primary)]/20 shadow-lg' : 'bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-primary)]/20'
            } ${!searchQuery || (member.name && member.name.toLowerCase().includes(searchQuery.toLowerCase())) ? 'opacity-100' : 'opacity-40 scale-[0.98]'}`}
          onClick={() => hasChildren && toggleBranch(member._id)}
          style={{ marginLeft: `${level * 40}px` }}
        >
          <div className="flex items-center gap-4 flex-1">
            {hasChildren ? (
              isExpanded ? <ChevronDown size={20} className="text-[var(--color-primary-dark)] dark:text-[var(--color-primary)]" /> : <ChevronRight size={20} className="text-[var(--color-text-muted)]" />
            ) : (
              <div className="w-5" />
            )}

            <div className={`h-12 w-12 rounded-2xl flex items-center justify-center font-black border ${member.role === 'system_group' ? 'bg-[var(--color-surface-soft)] text-[var(--color-text-muted)] border-[var(--color-border)]' : 'bg-[var(--color-primary)]/10 text-[var(--color-primary-dark)] dark:text-[var(--color-primary)] border-[var(--color-primary)]/10'
              }`}>
              {member.role === 'system_group' ? <Layers size={20} /> : member.name.charAt(0)}
            </div>

            <div>
              <p className="font-black text-[var(--color-text-primary)] text-lg leading-none">{member.name}</p>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--color-primary-dark)] dark:text-[var(--color-primary)]">
                  {member.role === 'system_group' ? 'Department' : (member.role === 'location_admin' || member.role === 'branch_admin') ? 'Branch Admin' : member.role.replace('_', ' ')}
                </span>
                {member.assignedLocation && (
                  <span className="text-[9px] font-bold text-[var(--color-text-muted)] flex items-center gap-1">
                    <MapPin size={10} /> {member.assignedLocation.city} - {member.assignedLocation.name}
                  </span>
                )}
                {member.role === 'admin' && member.accessibleLocations?.length > 0 && (
                  <span className="text-[9px] font-bold text-[var(--color-primary)] flex items-center gap-1">
                    <Layers size={10} /> {member.accessibleLocations.length} Branches Linked
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {member.role !== 'system_group' && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); setViewingStaff(member); }}
                    className="p-3 hover:bg-[var(--color-surface-soft)] rounded-xl transition-all text-[var(--color-text-muted)] hover:text-blue-500"
                  >
                    <Info size={18} />
                  </button>
                  {canManageStaff && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEdit(member); }}
                        className="p-3 hover:bg-[var(--color-surface-soft)] rounded-xl transition-all text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                      >
                        <Edit3 size={18} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(member._id); }}
                        className="p-3 hover:bg-[var(--color-surface)] rounded-xl transition-all text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
                      >
                        <Trash2 size={18} />
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && hasChildren && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden border-l-2 border-[var(--color-primary)]/10 ml-6"
            >
              <div className="space-y-4 py-4">
                {childMembers.map(child => (
                  <StaffBranch key={child._id} member={child} childMembers={child.children} level={level + 1} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderHierarchy = () => {
    const admins = staff.filter(u => u.role === 'admin');
    const branchAdmins = staff.filter(u => u.role === 'branch_admin');
    const operationalStaff = staff.filter(u => ['staff', 'chef'].includes(u.role));

    let roots = [];

    // Helper to match staff to an admin's scope
    const getAdminChildren = (admin) => {
      const accessibleLocs = admin.accessibleLocations || [];
      const accessibleLocIds = accessibleLocs.map(loc => (loc._id || loc).toString());

      // Group branch staff by location to show a clear mapping
      return accessibleLocs.map(loc => {
        const locId = (loc._id || loc).toString();
        const locName = loc.name || 'Unknown Branch';

        const branchAdminsInLoc = branchAdmins.filter(ba => {
          const baLocId = (ba.assignedLocation?._id || ba.assignedLocation)?.toString();
          return baLocId === locId;
        });

        const staffInLoc = operationalStaff.filter(s => {
          const sLocId = (s.assignedLocation?._id || s.assignedLocation)?.toString();
          return sLocId === locId;
        });

        // Combine branch admin and their staff into a sub-hierarchy
        const mappedBranchAdmins = branchAdminsInLoc.map(ba => ({
          ...ba,
          children: staffInLoc.filter(s => {
            // In our system, staff are directly under the branch, 
            // but we show them as children of the branch admin for visual hierarchy
            return true;
          })
        }));

        // If no branch admin, show independent staff under the location node
        const independentStaff = mappedBranchAdmins.length === 0 ? staffInLoc : [];

        return {
          _id: `loc_${locId}_${admin._id}`,
          name: locName,
          role: 'system_group',
          children: [...mappedBranchAdmins, ...independentStaff]
        };
      });
    };

    if (currentUser?.role === 'super_admin') {
      // Admins are the primary roots
      const mappedAdmins = admins.map(admin => ({
        ...admin,
        children: getAdminChildren(admin)
      }));

      // Identify independent nodes (those not managed by any Main Admin)
      const linkedBranchAdminIds = new Set(mappedAdmins.flatMap(a =>
        a.children.flatMap(locBranch => locBranch.children.filter(c => c.role === 'branch_admin').map(ba => ba._id))
      ));

      const independentBranches = branchAdmins.filter(ba => !linkedBranchAdminIds.has(ba._id)).map(ba => {
        const baLocId = (ba.assignedLocation?._id || ba.assignedLocation)?.toString();
        const staffChildren = operationalStaff.filter(s => {
          const sLocId = (s.assignedLocation?._id || s.assignedLocation)?.toString();
          return sLocId === baLocId;
        });
        return { ...ba, children: staffChildren };
      });

      const linkedStaffIds = new Set([
        ...mappedAdmins.flatMap(a =>
          a.children.flatMap(locBranch => locBranch.children.flatMap(c => {
            if (c.role === 'branch_admin' && c.children) {
              return [c._id, ...c.children.map(s => s._id)];
            }
            return [c._id];
          }))
        ),
        ...independentBranches.flatMap(ba => [ba._id, ...ba.children.map(s => s._id)])
      ]);

      const independentStaff = operationalStaff.filter(s => !linkedStaffIds.has(s._id));
      roots = [...mappedAdmins, ...independentBranches, ...independentStaff];
    } else if (currentUser?.role === 'admin') {
      roots = getAdminChildren(currentUser);
    } else if (currentUser?.role === 'branch_admin') {
      const myLocId = (currentUser.assignedLocation?._id || currentUser.assignedLocation)?.toString();
      const myLocName = currentUser.assignedLocation?.name?.toLowerCase().trim();

      roots = operationalStaff.filter(s => {
        const sLoc = s.assignedLocation;
        if (!sLoc) return false;
        return (sLoc._id || sLoc).toString() === myLocId ||
          sLoc.name?.toLowerCase().trim() === myLocName;
      });
    }

    return (
      <div className="space-y-6">
        {roots.length > 0 ? roots.map(root => (
          <StaffBranch key={root._id} member={root} childMembers={root.children} />
        )) : (
          <div className="py-32 bg-[var(--color-surface)] rounded-[3rem] border-4 border-dashed border-[var(--color-border)] flex flex-col items-center justify-center opacity-30">
            <ShieldAlert size={64} className="mb-6" />
            <p className="font-black text-sm uppercase tracking-widest">No staff data linked</p>
          </div>
        )}
      </div>
    );
  };

  if (loading) return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-64 bg-[var(--color-surface-soft)] animate-pulse rounded-[2.5rem]"></div>)}
    </div>
  );

  return (
    <PageTransition>
      <div className="space-y-10">
        <SlideIn direction="down">
          <div className="bg-[var(--color-surface)] rounded-[2rem] border border-[var(--color-border)] p-6 md:p-8 shadow-sm flex flex-col gap-6">

            {/* Top Row */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">

              {/* Left: Title */}
              <div className="flex items-start gap-4">
                <div className="h-14 w-14 rounded-xl bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)]">
                  <Users size={26} strokeWidth={2.5} />
                </div>

                <div>
                  <h1 className="text-2xl md:text-3xl font-black text-[var(--color-text-primary)] tracking-tight">
                    Staff <span className="text-[var(--color-primary)]">Team</span>
                  </h1>

                  <p className="text-sm text-[var(--color-text-muted)] mt-1 flex items-center gap-2">
                    <Target size={14} className="text-[var(--color-primary)]" />
                    Manage your cafe team and staff members
                  </p>
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-3 flex-wrap">

                {/* View Switch */}
                <div className="flex bg-[var(--color-surface-soft)] p-1 rounded-xl border border-[var(--color-border)]">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-lg transition ${viewMode === 'list'
                      ? 'bg-[var(--color-surface)] text-[var(--color-primary)] shadow-sm'
                      : 'text-[var(--color-text-muted)]'
                      }`}
                  >
                    <List size={18} />
                  </button>

                  <button
                    onClick={() => {
                      setViewMode('tree');
                      setSearchQuery('');
                      setRoleFilter('');
                      setLocationFilter('');
                      setPage(1);
                    }}
                    className={`p-2 rounded-lg transition ${viewMode === 'tree'
                      ? 'bg-[var(--color-surface)] text-[var(--color-primary)] shadow-sm'
                      : 'text-[var(--color-text-muted)]'
                      }`}
                  >
                    <Grid2X2 size={18} />
                  </button>
                </div>
                
                <ExportActions 
                  data={staff} 
                  columns={columns} 
                  filename="Staff_Directory" 
                />

                {/* Add Button */}
                {canManageStaff && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setFormData({
                        name: '', email: '', phone: '', age: '', gender: 'Male',
                        address1: '', city: '', state: '', country: 'India', pincode: '', monthlySalary: '',
                        role: 'staff', assignedLocation: locationFilter || '', aadharNumber: '', highestQualification: '12th Pass'
                      });
                      setShowAddModal(true);
                    }}
                    className="flex items-center gap-2 bg-[var(--color-primary)] text-black dark:text-black px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-[var(--color-primary)]/30"
                  >
                    <Plus size={16} />
                    Add Staff
                  </motion.button>
                )}
              </div>
            </div>

            {/* Bottom Row (Filters) */}
            {viewMode === 'list' && (
              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">

                {/* 🔍 Premium Search */}
                <div className="relative flex-1 group">
                  {/* Glow Effect */}
                  <div className="absolute inset-0 rounded-xl bg-[var(--color-primary)]/0 group-focus-within:bg-[var(--color-primary)]/10 blur-xl transition-all" />

                  {/* Input */}
                  <div className="relative flex items-center">
                    <Search size={16} className="absolute left-3 text-[var(--color-text-muted)] group-focus-within:text-[var(--color-primary)] transition-colors" />

                    <input
                      type="text"
                      placeholder="Search staff by name, email..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setPage(1);
                      }}
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[var(--color-bg-soft)] border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 text-sm font-medium outline-none transition-all shadow-sm text-[var(--color-text-primary)]"
                    />

                    {/* Clear Button */}
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* 🎯 Compact Role Filter */}
                <PremiumSelect
                  icon={Filter}
                  value={roleFilter}
                  onChange={(val) => {
                    setRoleFilter(val);
                    setPage(1);
                  }}
                  options={[
                    { label: 'All Roles', value: '' },
                    ...(currentUser?.role === 'super_admin'
                      ? [{ label: 'Main Admin', value: 'admin' }]
                      : []),
                    { label: 'Branch Admin', value: 'branch_admin' },
                    { label: 'Staff', value: 'staff' }
                  ]}
                  className="min-w-[130px] max-w-[150px]"
                />

                {/* 📊 Status Filter */}
                <PremiumSelect
                  icon={UserCheck}
                  value={statusFilter}
                  onChange={(val) => {
                    setStatusFilter(val);
                    setPage(1);
                  }}
                  options={[
                    { label: 'All Status', value: '' },
                    { label: 'Active', value: 'active' },
                    { label: 'Suspended', value: 'blocked' }
                  ]}
                  className="min-w-[130px] max-w-[150px]"
                />

                {/* 💰 Salary Range Filter */}
                <PremiumSelect
                  icon={CreditCard}
                  value={salaryFilter}
                  onChange={(val) => {
                    setSalaryFilter(val);
                    setPage(1);
                  }}
                  options={[
                    { label: 'Any Salary', value: '' },
                    { label: 'Under 20k', value: '0-20000' },
                    { label: '20k - 50k', value: '20000-50000' },
                    { label: '50k - 100k', value: '50000-100000' },
                    { label: 'Over 100k', value: '100000-1000000' }
                  ]}
                  className="min-w-[140px] max-w-[170px]"
                />

                {/* 📍 Compact Location Filter */}
                <PremiumSelect
                  icon={MapPin}
                  value={locationFilter}
                  onChange={(val) => {
                    setLocationFilter(val);
                    setPage(1);
                  }}
                  options={[
                    { label: 'All Locations', value: '' },
                    ...locations.map(loc => ({
                      label: `${loc.city} - ${loc.name}`,
                      value: loc._id
                    }))
                  ]}
                  className="min-w-[150px] max-w-[180px]"
                />
              </div>
            )}
          </div>
        </SlideIn>

        {viewMode === 'list' ? (
          <>
            <div className="overflow-x-auto rounded-[2.5rem] border border-[var(--color-border)] bg-[var(--color-surface)]/40 backdrop-blur-3xl shadow-2xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-soft)]/50">
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.3em] text-[var(--color-text-muted)]">Staff Member</th>
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.3em] text-[var(--color-text-muted)]">Contact Info</th>
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.3em] text-[var(--color-text-muted)]">Role</th>
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.3em] text-[var(--color-text-muted)]">Branch</th>
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.3em] text-[var(--color-text-muted)] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {staffToDisplay.map((member, i) => (
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
                          <div className="h-12 w-12 rounded-2xl bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)] border border-[var(--color-primary)]/20 shadow-inner group-hover:scale-110 transition-transform font-black">
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
                            <Mail size={12} className="text-[var(--color-primary)]" />
                            {member.email}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] font-medium text-[var(--color-text-muted)]">
                            <Phone size={12} />
                            {member.phone}
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="px-3 py-1 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20 text-[10px] font-black uppercase tracking-widest">
                          {(member.role === 'location_admin' || member.role === 'branch_admin') ? 'Branch Admin' : member.role === 'admin' ? 'Main Admin' : member.role}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2 text-[var(--color-text-primary)]">
                          <MapPin size={14} className="text-[var(--color-primary)]" />
                          <span className="text-sm font-bold">
                            {member.assignedLocation ? `${member.assignedLocation.city} - ${member.assignedLocation.name}` : 'Not Assigned'}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex justify-end gap-2 transition-opacity">
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setAttendanceStaff(member);
                              setAttendanceDate(new Date().toISOString().split('T')[0]);
                              setShowAttendanceModal(true);
                            }}
                            className="p-2.5 text-[var(--color-success)] hover:bg-[var(--color-success)]/10 rounded-xl transition-all"
                          >
                            <UserCheck size={18} />
                          </motion.button>
                          {canManageStaff && (
                            <>
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={(e) => { e.stopPropagation(); handleEdit(member); }}
                                className="p-2.5 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 rounded-xl transition-all"
                              >
                                <Edit3 size={18} />
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(member._id); }}
                                className="p-2.5 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 rounded-xl transition-all"
                              >
                                <Trash2 size={18} />
                              </motion.button>
                            </>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              {staffToDisplay.length === 0 && (
                <div className="p-20 text-center text-[var(--color-text-muted)]">
                  <Users size={48} className="mx-auto mb-4 opacity-20" />
                  <p className="text-sm font-black uppercase tracking-widest">No staff found</p>
                </div>
              )}
            </div>

            {/* Pagination Controls */}
            {viewMode === 'list' && pagination.pages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-12">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="p-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] disabled:opacity-30 hover:text-[var(--color-primary)] transition-all shadow-sm"
                >
                  <ChevronRight size={20} className="rotate-180" />
                </button>

                <div className="flex items-center gap-2">
                  {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                    // Show 5 pages around current
                    let pageNum = page;
                    if (page <= 3) pageNum = i + 1;
                    else if (page >= pagination.pages - 2) pageNum = pagination.pages - 4 + i;
                    else pageNum = page - 2 + i;
                    
                    if (pageNum <= 0 || pageNum > pagination.pages) return null;

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`h-12 w-12 rounded-2xl font-black text-xs transition-all ${page === pageNum
                          ? 'bg-[var(--color-primary)] text-black shadow-xl shadow-[var(--color-primary)]/20 scale-110'
                          : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)]'
                          }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  disabled={page === pagination.pages}
                  onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                  className="p-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] disabled:opacity-30 hover:text-[var(--color-primary)] transition-all shadow-sm"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </>
        ) : (
          <SlideIn direction="up">
            {renderHierarchy()}
          </SlideIn>
        )}

        <Modal
          isOpen={showEditModal || showAddModal}
          onClose={() => {
            setShowEditModal(false);
            setShowAddModal(false);
          }}
          title={showAddModal ? "Add New Staff Member" : "Edit Staff Details"}
        >
          <form onSubmit={showAddModal ? handleAdd : handleUpdate} className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mb-2 ml-1">Full Name</label>
                <input required className="w-full px-5 py-4 rounded-2xl bg-[var(--color-bg-soft)] border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-primary)] transition-all text-sm font-bold text-[var(--color-text-primary)] outline-none" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mb-2 ml-1">Email</label>
                <input required type="email" className="w-full px-5 py-4 rounded-2xl bg-[var(--color-bg-soft)] border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-primary)] transition-all text-sm font-bold text-[var(--color-text-primary)] outline-none" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div>
                <label className="block text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mb-2 ml-1">Phone</label>
                <input required type="number" className="w-full px-5 py-4 rounded-2xl bg-[var(--color-bg-soft)] border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-primary)] transition-all text-sm font-bold text-[var(--color-text-primary)] outline-none" value={formData.phone} onInput={e => { if (e.target.value.length > 10) e.target.value = e.target.value.slice(0, 10); }} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mb-2 ml-1">Age</label>
                <input required type="number" className="w-full px-5 py-4 rounded-2xl bg-[var(--color-bg-soft)] border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-primary)] transition-all text-sm font-bold text-[var(--color-text-primary)] outline-none" value={formData.age} onInput={e => { if (e.target.value.length > 2) e.target.value = e.target.value.slice(0, 2); }} onChange={e => setFormData({ ...formData, age: e.target.value })} />
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

            {showAddModal && (
              <div className="grid grid-cols-2 gap-6">
                <PremiumSelect
                  label="Role"
                  value={formData.role || 'staff'}
                  onChange={(val) => setFormData({ ...formData, role: val })}
                  options={[
                    { label: 'Staff Member', value: 'staff' },
                    { label: 'Kitchen Chef', value: 'chef' },
                    { label: 'Branch Admin', value: 'branch_admin' }
                  ]}
                />
                <PremiumSelect
                  label="Assign Branch"
                  value={formData.assignedLocation || ''}
                  onChange={(val) => setFormData({ ...formData, assignedLocation: val })}
                  options={locations.map(loc => ({
                    label: `${loc.city} - ${loc.name}`,
                    value: loc._id
                  }))}
                />
              </div>
            )}

            <div>
              <label className="block text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mb-2 ml-1">Address</label>
              <input required className="w-full px-5 py-4 rounded-2xl bg-[var(--color-bg-soft)] border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-primary)] transition-all text-sm font-bold text-[var(--color-text-primary)] outline-none" value={formData.address1} onChange={e => setFormData({ ...formData, address1: e.target.value })} />
            </div>

              <div className="grid grid-cols-4 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mb-2 ml-1">City</label>
                  <input required className="w-full px-5 py-4 rounded-2xl bg-[var(--color-bg-soft)] border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-primary)] transition-all text-sm font-bold text-[var(--color-text-primary)] outline-none" value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mb-2 ml-1">State</label>
                  <input required className="w-full px-5 py-4 rounded-2xl bg-[var(--color-bg-soft)] border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-primary)] transition-all text-sm font-bold text-[var(--color-text-primary)] outline-none" value={formData.state} onChange={e => setFormData({ ...formData, state: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mb-2 ml-1">Country</label>
                  <input required className="w-full px-5 py-4 rounded-2xl bg-[var(--color-bg-soft)] border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-primary)] transition-all text-sm font-bold text-[var(--color-text-primary)] outline-none" value={formData.country} onChange={e => setFormData({ ...formData, country: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mb-2 ml-1">Pincode</label>
                  <input required type="number" className="w-full px-5 py-4 rounded-2xl bg-[var(--color-bg-soft)] border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-primary)] transition-all text-sm font-bold text-[var(--color-text-primary)] outline-none" value={formData.pincode} onInput={e => { if (e.target.value.length > 6) e.target.value = e.target.value.slice(0, 6); }} onChange={e => setFormData({ ...formData, pincode: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6">
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mb-2 ml-1">Aadhar Number</label>
                  <input type="number" className="w-full px-5 py-4 rounded-2xl bg-[var(--color-bg-soft)] border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-primary)] transition-all text-sm font-bold text-[var(--color-text-primary)] outline-none" value={formData.aadharNumber} onInput={e => { if (e.target.value.length > 12) e.target.value = e.target.value.slice(0, 12); }} onChange={e => setFormData({ ...formData, aadharNumber: e.target.value })} />
                </div>
                <div>
                  <PremiumSelect
                    label="Qualification"
                    value={formData.highestQualification}
                    onChange={(val) => setFormData({ ...formData, highestQualification: val })}
                    options={[
                      { label: '10th Pass', value: '10th Pass' },
                      { label: '12th Pass', value: '12th Pass' },
                      { label: 'Diploma', value: 'Diploma' },
                      { label: 'Graduate', value: 'Graduate' },
                      { label: 'Post Graduate', value: 'Post Graduate' }
                    ]}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mb-2 ml-1">Salary (₹)</label>
                <input required type="number" className="w-full px-5 py-4 rounded-2xl bg-[var(--color-bg-soft)] border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-primary)] transition-all text-sm font-bold text-[var(--color-text-primary)] outline-none" value={formData.monthlySalary} onChange={e => setFormData({ ...formData, monthlySalary: e.target.value })} />
              </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={isSubmitting}
              className="w-full py-5 bg-[var(--color-primary)] text-black dark:text-black rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-[var(--color-primary)]/20 mt-4 disabled:opacity-50"
            >
              {showAddModal ? "Confirm Deployment" : "Update Record"}
            </motion.button>
          </form>
        </Modal>

        <ConfirmDialog
          isOpen={!!showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(null)}
          onConfirm={handleDelete}
          title="Delete Record?"
          message="This record will be permanently deleted from the system."
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
                  <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">Staff <span className="text-blue-600">Details</span></h2>
                  <p className="text-sm font-bold text-zinc-400 mt-2 flex items-center justify-center md:justify-start gap-2">
                    <Mail size={14} className="text-blue-600" /> {viewingStaff.email}
                  </p>
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-4">
                    <span className="px-3 py-1 bg-blue-500/10 text-blue-600 text-[10px] font-black uppercase tracking-widest rounded-full border border-blue-500/20">
                      {(viewingStaff.role === 'location_admin' || viewingStaff.role === 'branch_admin') ? 'Branch Admin' : viewingStaff.role}
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
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Monthly Salary</p>
                  <p className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tighter">₹{viewingStaff.monthlySalary?.toLocaleString()}</p>
                </div>
              </div>

              {/* Data Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-8">
                  {/* Identity Section */}
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-6 flex items-center gap-2">
                      <CreditCard size={14} className="text-blue-600" /> Staff Details
                    </h3>
                    <div className="grid grid-cols-1 gap-6">
                      <div className="flex items-center gap-4 bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                        <Hash className="text-blue-600" size={20} />
                        <div>
                          <p className="text-[8px] font-black uppercase text-zinc-400 tracking-widest">Aadhar Number</p>
                          <p className="text-sm font-bold text-zinc-700 dark:text-zinc-200">{viewingStaff.aadharNumber || 'Not Added'}</p>
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
                          <p className="text-[8px] font-black uppercase text-zinc-400 tracking-widest">Qualification</p>
                          <p className="text-sm font-bold text-zinc-700 dark:text-zinc-200">{viewingStaff.highestQualification}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Demographic Section */}
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-6 flex items-center gap-2">
                      <Globe size={14} className="text-blue-600" /> Personal Info
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
                      <MapPin size={14} className="text-blue-600" /> Address
                    </h3>
                    <div className="bg-zinc-50 dark:bg-zinc-900/50 p-6 rounded-[2rem] border border-zinc-100 dark:border-zinc-800">
                      <p className="text-sm font-bold text-zinc-700 dark:text-zinc-200 leading-relaxed">
                        {viewingStaff.address1}<br />
                        {viewingStaff.address2 && <>{viewingStaff.address2}<br /></>}
                        {viewingStaff.city}, {viewingStaff.state} - {viewingStaff.pincode}
                      </p>
                    </div>
                  </div>

                  {/* Document Proof Section */}
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-6 flex items-center gap-2">
                      <Info size={14} className="text-blue-600" /> Aadhar Card
                    </h3>
                    {viewingStaff.aadharImage ? (
                      <div className="group relative rounded-[2.5rem] overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 aspect-video">
                        <img
                          src={viewingStaff.aadharImage}
                          alt="Aadhar Card"
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        />
                        <a
                          href={viewingStaff.aadharImage}
                          target="_blank"
                          rel="noreferrer"
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-3 backdrop-blur-sm"
                        >
                          <Globe size={24} className="text-[var(--color-primary)]" />
                          <span className="font-black text-[10px] uppercase tracking-widest">Verify Original Scan</span>
                        </a>
                      </div>
                    ) : (
                      <div className="rounded-[2.5rem] border-2 border-dashed border-[var(--color-border)] p-10 flex flex-col items-center justify-center text-[var(--color-text-muted)] aspect-video">
                        <ShieldAlert size={32} className="mb-2 opacity-20" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-center">Aadhar Scan Missing</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="pt-8 border-t border-[var(--color-border)] flex gap-4">
                <Button
                  variant="outline"
                  className="flex-1 py-5 !rounded-2xl font-black text-xs uppercase tracking-widest"
                  onClick={() => setViewingStaff(null)}
                >
                  Close
                </Button>
                <Button
                  className="flex-1 py-5 !rounded-2xl font-black text-xs uppercase tracking-widest bg-[var(--color-text-primary)] text-[var(--color-surface)] shadow-2xl"
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

        <Modal
          isOpen={showAttendanceModal}
          onClose={() => setShowAttendanceModal(false)}
          title="Mark Daily Attendance"
          className="max-w-md"
        >
          {attendanceStaff && (
            <div className="space-y-8">
              <div className="flex items-center gap-4 p-4 bg-[var(--color-surface-soft)] rounded-2xl border border-[var(--color-border)]">
                <div className="h-12 w-12 rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center font-black">
                  {attendanceStaff.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-black text-[var(--color-text-primary)]">{attendanceStaff.name}</p>
                  <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">{attendanceStaff.role.replace('_', ' ')}</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mb-2 ml-1">Service Date</label>
                  <input 
                    type="date" 
                    className="w-full px-5 py-4 rounded-2xl bg-[var(--color-bg-soft)] border border-[var(--color-border)] text-sm font-bold text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    value={attendanceDate}
                    onChange={e => setAttendanceDate(e.target.value)}
                  />
                </div>

                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mb-2 ml-1">Status System Rule</label>
                  <div className="grid grid-cols-3 gap-3">
                    {['present', 'absent', 'half-day'].map(status => (
                      <button
                        key={status}
                        onClick={() => setAttendanceStatus(status)}
                        className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${attendanceStatus === status ? 'bg-[var(--color-primary)] text-black dark:text-black border-[var(--color-primary)]' : 'bg-[var(--color-surface-soft)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:border-[var(--color-primary)]/30'}`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleMarkAttendance}
                className="w-full py-5 bg-[var(--color-primary)] text-black dark:text-black rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-[var(--color-primary)]/20"
              >
                Sync Attendance
              </motion.button>
            </div>
          )}
        </Modal>
      </div>
    </PageTransition>
  );
}
