'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/app/services/api';
import { digitsOnly, sanitizeEmail, blockNonInteger, blockNegative } from '@/app/utils/inputValidation';
import { todayInput } from '@/app/utils/dateInput';
import { stateOptions } from '@/app/utils/indianStates';
import { runValidation, required, email, phone, age, pincode, aadhaar, nonNegativeAmount, hasErrors, firstError } from '@/app/utils/validators';
import { Filter, ChevronRight, ChevronDown, Search, Users, Target, UserCheck, UserX, Mail, Phone, MapPin, Edit3, Trash2, Shield, ShieldAlert, Layers, Info, Hash, Award, CreditCard, Globe, Grid2X2, List, Plus, Eye } from 'lucide-react';
import RowActionsMenu from './RowActionsMenu';
import PremiumSelect from '@/app/components/ui/PremiumSelect';
import { PageTransition, SlideIn, CardHover } from '@/app/components/ui/AnimatedContainer';
import Modal from '@/app/components/ui/Modal';
import { Button } from '@/app/components/ui/Button';
import ImpactDeleteModal from '@/app/components/ui/ImpactDeleteModal';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { useAuth } from '@/app/context/AuthContext';
import ExportActions from '@/app/components/ui/ExportActions';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { progress } from '@/app/components/ui/TopProgressBar';
import { TableSkeleton, ListSkeleton } from '@/app/components/ui/Skeleton';
import { Money } from '@/app/components/ui/Money';
import { canViewPage } from '@/app/config/pages';
import { routeForPage } from '@/app/config/routes';
import UserPermissionEditor from '@/app/components/ui/UserPermissionEditor';


// Team tab of the People hub: canonical staff directory for every admin role. The
// admin/users page and the branch-admin / location-admin staff pages are thin
// wrappers around this component — the server scopes GET /users per requester.
export default function TeamDirectory() {
  const router = useRouter();
  const { user: currentUser, locations: authLocations, impersonate } = useAuth();
  const canManageStaff = currentUser?.role === 'super_admin' || currentUser?.permissions?.manageStaff === true;
  // Block/Unblock + role/branch reassignment keep their historical admin/users reach.
  const isTopAdmin = ['super_admin', 'admin'].includes(currentUser?.role);
  // Per-row permission editing: same actors the Permissions page serves
  // (location_admin is barred from PUT /users/:id/permissions server-side).
  const canEditPermissions = ['super_admin', 'admin', 'branch_admin'].includes(currentUser?.role)
    && canViewPage(currentUser, 'page_permissions');
  // "Login As" moved here from its own tab. The base right to impersonate at all;
  // canImpersonateMember() then applies the same per-target hierarchy the old
  // Login As page enforced (the server re-checks on every attempt).
  const canImpersonateBase = ['super_admin', 'admin', 'branch_admin', 'location_admin'].includes(currentUser?.role)
    || currentUser?.permissions?.impersonateUsers === true;
  const staffReportsBase = routeForPage(currentUser?.role, 'page_staffreports');
  const addMemberRoute = routeForPage(currentUser?.role, 'page_addmember');

  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const didInitRef = useRef(false);
  const [roleFilter, setRoleFilter] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [viewingStaff, setViewingStaff] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'tree'
  const [expandedBranchs, setExpandedBranchs] = useState({});
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', phone: '', age: '', gender: 'Male',
    address1: '', city: '', state: '', pincode: '', monthlySalary: '',
    accessibleLocations: []
  });
  const [locations, setLocations] = useState([]);
  const [locationFilter, setLocationFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [salaryFilter, setSalaryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [permissionUser, setPermissionUser] = useState(null); // row whose access is being edited
  const [impersonateTarget, setImpersonateTarget] = useState(null); // row being logged-in-as (confirm popup)
  const [notifyImpersonate, setNotifyImpersonate] = useState(true); // notify the user vs ghost mode
  const [impersonating, setImpersonating] = useState(false);
  const [editRole, setEditRole] = useState('staff');
  const [editBranchIds, setEditBranchIds] = useState([]);
  const [editAssignedLocation, setEditAssignedLocation] = useState('');
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [attendanceStaff, setAttendanceStaff] = useState(null);
  const [attendanceDate, setAttendanceDate] = useState(todayInput());
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
    const isInitial = !didInitRef.current;
    if (isInitial) setLoading(true);
    else setRefetching(true);
    progress.start();
    try {
      // In tree mode we need EVERY user to build the full hierarchy, so request a
      // high limit (was sending {} which made the backend default to just 10,
      // cutting off staff/chef once there were more than 10 users).
      const params = viewMode === 'tree' ? { limit: 1000 } : {
        role: roleFilter,
        locationId: locationFilter,
        status: statusFilter,
        salaryRange: salaryFilter,
        search: searchQuery,
        page,
        limit
      };
      const res = await api.get('/users', { params });
      setStaff(res.data.data);
      if (res.data.pagination) {
        setPagination(res.data.pagination);
      }
    } catch (error) {
      console.error('Could not load staff list');
    } finally {
      didInitRef.current = true;
      setLoading(false);
      setRefetching(false);
      progress.done();
    }
  };

  // The user list uses .lean(), so its aadharNumber is the ENCRYPTED value.
  // Fetch the single-user record (decrypted Aadhaar + full details) for edit/view.
  const handleEdit = async (member) => {
    setEditingStaff(member);
    const fill = (m) => {
      setFormData({
        name: m.name || '',
        email: m.email || '',
        password: '',
        phone: m.phone || '',
        age: m.age || '',
        gender: m.gender || 'Male',
        address1: m.address1 || '',
        city: m.city || '',
        state: m.state || '',
        country: m.country || 'India',
        pincode: m.pincode || '',
        monthlySalary: m.monthlySalary || '',
        aadharNumber: m.aadharNumber || '',
        highestQualification: m.highestQualification || '12th Pass'
      });
      setEditRole(m.role || 'staff');
      setEditBranchIds(getMemberBranchIds(m));
      setEditAssignedLocation(m.assignedLocation?._id || m.assignedLocation || '');
    };
    fill(member);
    setShowEditModal(true);
    try {
      const res = await api.get(`/users/${member._id}`);
      setEditingStaff(res.data.data); // full record: decrypted Aadhaar + card image
      fill(res.data.data);
    } catch (err) { /* keep list data */ }
  };

  const handleViewStaff = async (member) => {
    setViewingStaff(member); // show instantly with list data
    try {
      const res = await api.get(`/users/${member._id}`);
      setViewingStaff(res.data.data); // enrich with decrypted Aadhaar + full details
    } catch (err) { /* keep list data */ }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();

    // Validate the profile fields with a specific message before saving.
    const errors = runValidation(formData, {
      name: [required('Name')],
      email: [required('Email'), email],
      phone: [required('Phone'), phone],
      age: [age],
      city: [required('City')],
      pincode: [pincode],
      aadharNumber: [aadhaar],
      monthlySalary: [nonNegativeAmount],
    });
    if (hasErrors(errors)) { toast.error(firstError(errors)); return; }

    setIsSubmitting(true);
    const loadToast = toast.loading('Saving changes...');
    try {
      const payload = { ...formData };
      if (isTopAdmin) {
        // Role + branch reassignment (the server only honors these fields for
        // super_admin/admin actors — same reach the old Users page had).
        const role = editRole || editingStaff?.role || 'staff';
        payload.role = role;
        if (role === 'branch_admin') {
          const branchIds = editBranchIds.length > 0 ? editBranchIds : (editAssignedLocation ? [editAssignedLocation] : []);
          payload.assignedLocation = branchIds[0] || '';
          payload.accessibleLocations = branchIds;
        } else if (role === 'admin') {
          payload.accessibleLocations = editBranchIds;
          delete payload.assignedLocation;
        } else {
          payload.assignedLocation = editAssignedLocation;
        }
        // Don't send empty optional fields (avoids ObjectId cast errors on the backend).
        if (payload.assignedLocation === '') delete payload.assignedLocation;
      }
      if (payload.monthlySalary === '') delete payload.monthlySalary;
      await api.put(`/users/${editingStaff._id}`, payload);
      toast.success('Staff details updated', { id: loadToast });
      setShowEditModal(false);
      fetchStaff();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not update. Please try again.', { id: loadToast });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleBlock = async (member) => {
    const loadToast = toast.loading(member.isBlocked ? 'Unblocking user...' : 'Blocking user...');
    try {
      await api.patch(`/users/${member._id}/toggle-block`);
      toast.success(member.isBlocked ? 'User unblocked' : 'User blocked', { id: loadToast });
      fetchStaff();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not update user. Please try again.', { id: loadToast });
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
      toast.success('Attendance saved', { id: loadToast });
      setShowAttendanceModal(false);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not save attendance. Please try again.', { id: loadToast });
    }
  };

  const handleDelete = async ({ mode, replacementId, purgeKeys }) => {
    if (!showDeleteConfirm) return;
    const loadToast = toast.loading('Removing staff record...');
    try {
      const res = await api.delete(`/users/${showDeleteConfirm}`, { data: { mode, replacementId, purgeKeys } });
      // A cascade removes the team as well, so refetch instead of splicing one
      // row out of local state and leaving the rest of the list stale.
      if (mode === 'cascade' || mode === 'reassign') fetchStaff();
      else setStaff(staff.filter((s) => s._id !== showDeleteConfirm));
      toast.success(res.data?.message || 'Staff member removed', { id: loadToast, duration: 6000 });
      setShowDeleteConfirm(null);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not delete. Please try again.', { id: loadToast });
    }
  };

  // No longer needed client-side, using backend filtered data
  const staffToDisplay = staff;

  const getMemberBranchIds = (member) => {
    const ids = [];
    if (member?.assignedLocation) ids.push(member.assignedLocation._id || member.assignedLocation);
    if (Array.isArray(member?.accessibleLocations)) {
      member.accessibleLocations.forEach((loc) => ids.push(loc._id || loc));
    }
    return [...new Set(ids.filter(Boolean).map((id) => id.toString()))];
  };

  // Mirrors the old Login As page's hierarchy: who THIS actor may sign in as.
  const canImpersonateMember = (member) => {
    if (!canImpersonateBase || !member) return false;
    if (member._id === currentUser?._id || member.isBlocked) return false; // never self, never blocked
    const role = currentUser?.role;
    if (role === 'super_admin') return true;
    if (role === 'admin') return member.role !== 'super_admin';
    if (role === 'branch_admin' || role === 'location_admin') {
      if (!['staff', 'chef'].includes(member.role)) return false;
      const mine = getMemberBranchIds(currentUser);
      return mine.includes((member.assignedLocation?._id || member.assignedLocation)?.toString());
    }
    // A non-admin granted impersonateUsers may sign in as anyone but a super admin.
    return member.role !== 'super_admin';
  };

  const doImpersonate = async () => {
    const member = impersonateTarget;
    if (!member) return;
    setImpersonating(true);
    toast.loading(`Logging in as ${member.name}...`, { id: 'impersonate' });
    try {
      const res = await impersonate(member._id, false, notifyImpersonate);
      if (res?.success) toast.success(`Logged in as ${member.name}`, { id: 'impersonate' });
      else toast.error(res?.message || 'Could not log in as this user', { id: 'impersonate' });
    } catch (err) {
      toast.error('Could not log in as this user', { id: 'impersonate' });
    } finally {
      setImpersonating(false);
      setImpersonateTarget(null);
    }
  };

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
          className={`group flex items-center p-5 rounded-xl border transition-all cursor-pointer ${isExpanded ? 'bg-primary/5 border-primary/20 shadow-sm' : 'bg-(--color-surface) border-(--color-border) hover:border-primary/20'
            } ${!searchQuery || (member.name && member.name.toLowerCase().includes(searchQuery.toLowerCase())) ? 'opacity-100' : 'opacity-40 scale-[0.98]'}`}
          onClick={() => hasChildren && toggleBranch(member._id)}
          style={{ marginLeft: `${level * 40}px` }}
        >
          <div className="flex items-center gap-4 flex-1">
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center font-semibold border ${member.role === 'system_group' ? 'bg-(--color-surface-soft) text-(--color-text-muted) border-(--color-border)' : 'bg-primary/10 text-primary-dark dark:text-primary border-primary/10'
              }`}>
              {member.role === 'system_group' ? <Layers size={20} /> : member.name.charAt(0)}
            </div>

            <div>
              <p className="font-medium text-(--color-text-primary) text-lg leading-none">{member.name}</p>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-[11px] font-medium tracking-normal text-primary-dark dark:text-primary">
                  {member.role === 'system_group' ? 'Department' : (member.role === 'location_admin' || member.role === 'branch_admin') ? 'Branch Admin' : member.role.replace('_', ' ')}
                </span>
                {member.assignedLocation && (
                  <span className="text-[11px] font-medium text-(--color-text-muted) flex items-center gap-1">
                    <MapPin size={10} /> {member.assignedLocation.city} - {member.assignedLocation.name}
                  </span>
                )}
                {['admin', 'branch_admin'].includes(member.role) && member.accessibleLocations?.length > 0 && (
                  <span className="text-[11px] font-medium text-primary flex items-center gap-1">
                    <Layers size={10} /> {member.accessibleLocations.length} Branches Linked
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex gap-1 transition-opacity">
              {member.role !== 'system_group' && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleViewStaff(member); }}
                    className="p-3 hover:bg-(--color-surface-soft) rounded-xl transition-all text-(--color-text-muted) hover:text-primary"
                    title="View details"
                  >
                    <Info size={18} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); router.push(`${staffReportsBase}/${member._id}`); }}
                    className="p-3 hover:bg-(--color-surface-soft) rounded-xl transition-all text-(--color-text-muted) hover:text-primary"
                    title="View report"
                  >
                    <Award size={18} />
                  </button>
                  {canEditPermissions && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setPermissionUser(member); }}
                      className="p-3 hover:bg-(--color-surface-soft) rounded-xl transition-all text-(--color-text-muted) hover:text-primary"
                      title="Edit permissions"
                    >
                      <Shield size={18} />
                    </button>
                  )}
                  {canManageStaff && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEdit(member); }}
                        className="p-3 hover:bg-(--color-surface-soft) rounded-xl transition-all text-(--color-text-muted) hover:text-primary"
                        title="Edit details"
                      >
                        <Edit3 size={18} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(member._id); }}
                        className="p-3 hover:bg-(--color-surface) rounded-xl transition-all text-(--color-text-muted) hover:text-danger"
                        title="Remove staff member"
                      >
                        <Trash2 size={18} />
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
            {hasChildren && (
              isExpanded ? <ChevronDown size={20} className="text-primary-dark dark:text-primary shrink-0" /> : <ChevronRight size={20} className="text-(--color-text-muted) shrink-0" />
            )}
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && hasChildren && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden border-l-2 border-primary/10 ml-6"
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

        const branchAdminsInLoc = branchAdmins.filter(ba => getMemberBranchIds(ba).includes(locId));

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
        const baLocIds = getMemberBranchIds(ba);
        const staffChildren = operationalStaff.filter(s => {
          const sLocId = (s.assignedLocation?._id || s.assignedLocation)?.toString();
          return baLocIds.includes(sLocId);
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
    } else if (currentUser?.role === 'branch_admin' || currentUser?.role === 'location_admin') {
      const myLocIds = getMemberBranchIds(currentUser);
      const myLocName = currentUser.assignedLocation?.name?.toLowerCase().trim();

      roots = operationalStaff.filter(s => {
        const sLoc = s.assignedLocation;
        if (!sLoc) return false;
        return myLocIds.includes((sLoc._id || sLoc).toString()) ||
          sLoc.name?.toLowerCase().trim() === myLocName;
      });
    }

    return (
      <div className="space-y-6">
        {roots.length > 0 ? roots.map(root => (
          <StaffBranch key={root._id} member={root} childMembers={root.children} />
        )) : (
          <div className="py-32 bg-(--color-surface) rounded-xl border-4 border-dashed border-(--color-border) flex flex-col items-center justify-center opacity-30">
            <ShieldAlert size={64} className="mb-6" />
            <p className="font-medium text-sm tracking-normal">No staff to show</p>
          </div>
        )}
      </div>
    );
  };

  if (loading) return <LoadingScreen fullScreen={false} />;

  return (
    <PageTransition>
      <div className="space-y-6">
        <SlideIn direction="down">
          <div className="bg-(--color-surface) rounded-xl border border-(--color-border) p-5 md:p-6 shadow-sm flex flex-col gap-6">

            {/* Top Row */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">

              {/* Left: Title */}
              <div className="flex items-start gap-4">
                <div className="h-6 w-6 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Users size={16} strokeWidth={2.5} />
                </div>

                <div>
                  <h1 className="text-2xl sm:text-3xl font-semibold text-(--color-text-primary) tracking-tight">
                    All <span className="text-primary">Users</span>
                  </h1>

                  <p className="text-sm text-(--color-text-muted) mt-1 flex items-center gap-2">
                    <Target size={14} className="text-primary" />
                    Manage your cafe team and staff members
                  </p>
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-3 flex-wrap">

                {/* View Switch */}
                <div className="flex bg-(--color-surface-soft) p-1 rounded-xl border border-(--color-border)">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-lg transition ${viewMode === 'list'
                      ? 'bg-(--color-surface) text-primary shadow-sm'
                      : 'text-(--color-text-muted)'
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
                      ? 'bg-(--color-surface) text-primary shadow-sm'
                      : 'text-(--color-text-muted)'
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
                    onClick={() => router.push(addMemberRoute)}
                    className="flex items-center gap-2 bg-primary text-(--color-on-primary) dark:text-(--color-on-primary) px-5 py-3 rounded-xl text-xs font-semibold tracking-normal shadow-sm "
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
                  <div className="absolute inset-0 rounded-xl bg-primary/0 group-focus-within:bg-primary/10 blur-xl transition-all" />

                  {/* Input */}
                  <div className="relative flex items-center">
                    <Search size={16} className="absolute left-3 text-(--color-text-muted) group-focus-within:text-primary transition-colors" />

                    <input
                      type="text"
                      placeholder="Search staff by name, email..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setPage(1);
                      }}
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-(--color-bg-soft) border border-(--color-border) focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm font-medium outline-none transition-all shadow-sm text-(--color-text-primary)"
                    />

                    {/* Clear Button */}
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 text-(--color-text-muted) hover:text-danger transition"
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
                    { label: 'Staff', value: 'staff' },
                    { label: 'Chef', value: 'chef' }
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
                    { label: 'Blocked', value: 'blocked' }
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
                  className="min-w-35 max-w-[170px]"
                />

                {/* 📍 Compact Location Filter (hidden when only one branch is accessible) */}
                {(authLocations?.length || 0) > 1 && (
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
                    className="min-w-[150px] max-w-45"
                  />
                )}
              </div>
            )}
          </div>
        </SlideIn>

        {refetching ? (
          viewMode === 'list' ? <TableSkeleton rows={9} cols={5} /> : <ListSkeleton items={6} />
        ) : viewMode === 'list' ? (
          <>
            <div className="overflow-x-auto rounded-xl border border-(--color-border) bg-(--color-surface)/40  shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-(--color-border) bg-(--color-surface-soft)/50">
                  <th className="px-5 py-4 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Member Name</th>
                    <th className="px-5 py-4 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Contact Info</th>
                    <th className="px-5 py-4 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Role</th>
                    <th className="px-5 py-4 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Branch</th>
                    <th className="px-5 py-4 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted) text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {staffToDisplay.map((member, i) => (
                    <motion.tr 
                      key={member._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => handleViewStaff(member)}
                      className="group border-b border-(--color-border) hover:bg-primary/5 transition-all cursor-pointer"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-4">
                          <div className="relative shrink-0">
                            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-inner transition-transform font-semibold overflow-hidden">
                              {member.profileImageUrl ? (
                                <img src={member.profileImageUrl} alt="" className="h-full w-full object-cover" />
                              ) : (
                                member.name.charAt(0)
                              )}
                            </div>
                            <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-(--color-surface) ${member.isBlocked ? 'bg-danger' : 'bg-success'}`} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-(--color-text-primary)">{member.name}</p>
                            <p className="text-[11px] font-medium text-(--color-text-muted) tracking-normal mt-0.5">ID: {member._id.slice(-6).toUpperCase()}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 text-xs font-medium text-(--color-text-primary)">
                            <Mail size={12} className="text-primary" />
                            {member.email}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] font-medium text-(--color-text-muted)">
                            <Phone size={12} />
                            {member.phone}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-[11px] font-medium tracking-normal">
                          {(member.role === 'location_admin' || member.role === 'branch_admin') ? 'Branch Admin' : member.role === 'admin' ? 'Main Admin' : member.role}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 text-(--color-text-primary)">
                          <MapPin size={14} className="text-primary" />
                          <span className="text-sm font-medium">
                            {member.role === 'branch_admin' && getMemberBranchIds(member).length > 1
                              ? `${getMemberBranchIds(member).length} Branches`
                              : member.assignedLocation ? `${member.assignedLocation.city} - ${member.assignedLocation.name}` : 'Not Assigned'}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                          {/* All row actions collapse into one floating ⋮ menu. Each
                              item is shown only to a viewer permitted to use it. */}
                          <RowActionsMenu
                            items={[
                              { key: 'view', icon: Info, label: 'View details', onClick: () => handleViewStaff(member) },
                              { key: 'report', icon: Award, label: 'View report', onClick: () => router.push(`${staffReportsBase}/${member._id}`) },
                              { key: 'loginas', icon: Eye, label: 'Login as user', show: canImpersonateMember(member), onClick: () => { setNotifyImpersonate(true); setImpersonateTarget(member); } },
                              { key: 'attendance', icon: UserCheck, label: 'Mark attendance', onClick: () => { setAttendanceStaff(member); setAttendanceDate(new Date().toISOString().split('T')[0]); setShowAttendanceModal(true); } },
                              { key: 'permissions', icon: Shield, label: 'Edit permissions', show: canEditPermissions, onClick: () => setPermissionUser(member) },
                              { key: 'block', icon: member.isBlocked ? UserCheck : UserX, label: member.isBlocked ? 'Unblock user' : 'Block user', show: isTopAdmin, danger: !member.isBlocked, onClick: () => handleToggleBlock(member) },
                              { key: 'edit', icon: Edit3, label: 'Edit details', show: canManageStaff, onClick: () => handleEdit(member) },
                              { key: 'delete', icon: Trash2, label: 'Remove staff member', show: canManageStaff, danger: true, onClick: () => setShowDeleteConfirm(member._id) },
                            ]}
                          />
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              {staffToDisplay.length === 0 && (
                <div className="p-10 text-center text-(--color-text-muted)">
                  <Users size={48} className="mx-auto mb-4 opacity-20" />
                  <p className="text-sm font-medium tracking-normal">No staff found</p>
                </div>
              )}
            </div>

            {/* Pagination Controls */}
            {viewMode === 'list' && pagination.pages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-6">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="p-4 rounded-xl bg-(--color-surface) border border-(--color-border) text-(--color-text-muted) disabled:opacity-30 hover:text-primary transition-all shadow-sm"
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
                        className={`h-12 w-12 rounded-xl font-semibold text-xs transition-all ${page === pageNum
                          ? 'bg-primary text-(--color-on-primary) shadow-sm  scale-110'
                          : 'bg-(--color-surface) border border-(--color-border) text-(--color-text-muted) hover:text-primary'
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
                  className="p-4 rounded-xl bg-(--color-surface) border border-(--color-border) text-(--color-text-muted) disabled:opacity-30 hover:text-primary transition-all shadow-sm"
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
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          title="Edit Staff Details"
        >
          <form onSubmit={handleUpdate} className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-[11px] font-medium text-(--color-text-muted) tracking-normal mb-2 ml-1">Full Name</label>
                <input required className="w-full px-5 py-4 rounded-xl bg-(--color-bg-soft) border border-(--color-border) focus:ring-2 focus:ring-primary transition-all text-sm font-medium text-(--color-text-primary) outline-none" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-(--color-text-muted) tracking-normal mb-2 ml-1">Email</label>
                <input required type="email" className="w-full px-5 py-4 rounded-xl bg-(--color-bg-soft) border border-(--color-border) focus:ring-2 focus:ring-primary transition-all text-sm font-medium text-(--color-text-primary) outline-none" value={formData.email} onChange={e => setFormData({ ...formData, email: sanitizeEmail(e.target.value) })} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
              <div>
                <label className="block text-[11px] font-medium text-(--color-text-muted) tracking-normal mb-2 ml-1">Phone</label>
                <input required type="tel" inputMode="numeric" maxLength={10} className="w-full px-5 py-4 rounded-xl bg-(--color-bg-soft) border border-(--color-border) focus:ring-2 focus:ring-primary transition-all text-sm font-medium text-(--color-text-primary) outline-none" value={formData.phone} onChange={e => setFormData({ ...formData, phone: digitsOnly(e.target.value, 10) })} />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-(--color-text-muted) tracking-normal mb-2 ml-1">Age</label>
                <input required type="number" min="18" max="99" onKeyDown={blockNonInteger} className="w-full px-5 py-4 rounded-xl bg-(--color-bg-soft) border border-(--color-border) focus:ring-2 focus:ring-primary transition-all text-sm font-medium text-(--color-text-primary) outline-none" value={formData.age} onChange={e => setFormData({ ...formData, age: e.target.value })} />
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

            {/* Role & branch reassignment — historically a Users-page feature; the
                server only honors these fields for super_admin/admin actors. */}
            {isTopAdmin && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 pt-6 border-t border-(--color-border)">
                <PremiumSelect
                  label="Staff Role"
                  value={editRole}
                  onChange={(val) => {
                    setEditRole(val);
                    setEditBranchIds(['branch_admin', 'admin'].includes(val) ? getMemberBranchIds(editingStaff) : []);
                  }}
                  options={[
                    { label: 'Staff', value: 'staff' },
                    { label: 'Chef', value: 'chef' },
                    { label: 'Branch Admin', value: 'branch_admin' },
                    { label: 'Admin', value: 'admin' }
                  ]}
                />
                {['branch_admin', 'admin'].includes(editRole) ? (
                  <div>
                    <PremiumSelect
                      label="Managed Branches"
                      value={editBranchIds}
                      onChange={setEditBranchIds}
                      options={locations.map(loc => ({
                        label: `${loc.city} - ${loc.name}`,
                        value: loc._id
                      }))}
                      multiple
                      placeholder="Select branches"
                    />
                    {editRole === 'branch_admin' && (
                      <p className="text-[11px] font-medium text-(--color-text-muted) mt-2 ml-1">First selected branch is saved as the primary branch.</p>
                    )}
                  </div>
                ) : (
                  <PremiumSelect
                    label="Assigned Branch"
                    value={editAssignedLocation}
                    onChange={setEditAssignedLocation}
                    options={[
                      { label: 'No branch (Global)', value: '' },
                      ...locations.map(loc => ({
                        label: `${loc.city} - ${loc.name}`,
                        value: loc._id
                      }))
                    ]}
                    placeholder="Select branch"
                  />
                )}
              </div>
            )}

            <div>
              <label className="block text-[11px] font-medium text-(--color-text-muted) tracking-normal mb-2 ml-1">Address</label>
              <input required className="w-full px-5 py-4 rounded-xl bg-(--color-bg-soft) border border-(--color-border) focus:ring-2 focus:ring-primary transition-all text-sm font-medium text-(--color-text-primary) outline-none" value={formData.address1} onChange={e => setFormData({ ...formData, address1: e.target.value })} />
            </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
                <div>
                  <label className="block text-[11px] font-medium text-(--color-text-muted) tracking-normal mb-2 ml-1">City</label>
                  <input required className="w-full px-5 py-4 rounded-xl bg-(--color-bg-soft) border border-(--color-border) focus:ring-2 focus:ring-primary transition-all text-sm font-medium text-(--color-text-primary) outline-none" value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} />
                </div>
                <div>
                  <PremiumSelect label="State" value={formData.state} onChange={(v) => setFormData({ ...formData, state: v })} options={stateOptions(formData.state)} placeholder="Select state" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-(--color-text-muted) tracking-normal mb-2 ml-1">Country</label>
                  <input required className="w-full px-5 py-4 rounded-xl bg-(--color-bg-soft) border border-(--color-border) focus:ring-2 focus:ring-primary transition-all text-sm font-medium text-(--color-text-primary) outline-none" value={formData.country} onChange={e => setFormData({ ...formData, country: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-(--color-text-muted) tracking-normal mb-2 ml-1">Pincode</label>
                  <input required type="text" inputMode="numeric" maxLength={6} className="w-full px-5 py-4 rounded-xl bg-(--color-bg-soft) border border-(--color-border) focus:ring-2 focus:ring-primary transition-all text-sm font-medium text-(--color-text-primary) outline-none" value={formData.pincode} onChange={e => setFormData({ ...formData, pincode: digitsOnly(e.target.value, 6) })} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                <div className="col-span-2">
                  <label className="block text-[11px] font-medium text-(--color-text-muted) tracking-normal mb-2 ml-1">Aadhar Number</label>
                  <input type="text" inputMode="numeric" maxLength={12} className="w-full px-5 py-4 rounded-xl bg-(--color-bg-soft) border border-(--color-border) focus:ring-2 focus:ring-primary transition-all text-sm font-medium text-(--color-text-primary) outline-none" value={formData.aadharNumber} onChange={e => setFormData({ ...formData, aadharNumber: digitsOnly(e.target.value, 12) })} />
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

              {/* Aadhaar card image preview (from the enriched GET /users/:id record) */}
              <div>
                <label className="block text-[11px] font-medium text-(--color-text-muted) tracking-normal mb-2 ml-1">Aadhaar Card Image</label>
                {editingStaff?.aadharImage ? (
                  <a href={editingStaff.aadharImage} target="_blank" rel="noopener noreferrer" className="block w-fit">
                    <img src={editingStaff.aadharImage} alt="Aadhaar card" className="max-h-52 w-auto rounded-xl border border-(--color-border) object-contain bg-(--color-bg-soft)" />
                    <span className="text-[11px] font-medium text-primary mt-1.5 inline-block">Open full image ↗</span>
                  </a>
                ) : (
                  <div className="p-6 rounded-xl border border-dashed border-(--color-border) text-center text-xs font-medium text-(--color-text-muted)">
                    No Aadhaar image uploaded
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-medium text-(--color-text-muted) tracking-normal mb-2 ml-1">Salary (₹)</label>
                <input required type="number" min="0" onKeyDown={blockNegative} className="w-full px-5 py-4 rounded-xl bg-(--color-bg-soft) border border-(--color-border) focus:ring-2 focus:ring-primary transition-all text-sm font-medium text-(--color-text-primary) outline-none" value={formData.monthlySalary} onChange={e => setFormData({ ...formData, monthlySalary: e.target.value })} />
              </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={isSubmitting}
              className="w-full py-5 bg-primary text-(--color-on-primary) dark:text-(--color-on-primary) rounded-xl font-semibold text-xs tracking-normal shadow-sm  mt-4 disabled:opacity-50"
            >
              Save Changes
            </motion.button>
          </form>
        </Modal>

        {/* Replaces a flat "are you sure": shows what the removal touches, what
            survives, and — for a lead — who can take their place. */}
        <ImpactDeleteModal
          isOpen={!!showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(null)}
          entity="user"
          id={showDeleteConfirm}
          name={staff.find((s) => s._id === showDeleteConfirm)?.name}
          onConfirm={handleDelete}
        />

        {/* Detailed Staff Details Modal */}
        <Modal
          isOpen={!!viewingStaff}
          onClose={() => setViewingStaff(null)}
          title="Staff Details"
          maxWidth="max-w-3xl"
        >
          {viewingStaff && (
            <div className="space-y-6">
              {/* Header Profile */}
              <div className="flex flex-col md:flex-row items-center md:items-start gap-5 pb-8 border-b border-(--color-border) dark:border-(--color-border)">
                <div className="relative group">
                  <div className="h-32 w-32 rounded-xl bg-gradient-to-br from-primary to-primary text-white flex items-center justify-center text-5xl font-semibold shadow-sm  transition-transform overflow-hidden">
                    {viewingStaff.profileImageUrl ? (
                      <img src={viewingStaff.profileImageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      viewingStaff.name.charAt(0)
                    )}
                  </div>
                  <div className={`absolute -bottom-2 -right-2 h-8 w-8 ${viewingStaff.isBlocked ? 'bg-danger' : 'bg-success'} border-4 border-(--color-border) dark:border-(--color-border) rounded-full flex items-center justify-center text-white`}>
                    {viewingStaff.isBlocked ? <UserX size={14} /> : <UserCheck size={14} />}
                  </div>
                </div>

                <div className="text-center md:text-left flex-1">
                  <h2 className="text-2xl font-semibold text-(--color-text-primary) dark:text-(--color-text-primary) tracking-tight">Staff <span className="text-primary">Details</span></h2>
                  <p className="text-sm font-medium text-(--color-text-muted) mt-2 flex items-center justify-center md:justify-start gap-2">
                    <Mail size={14} className="text-primary" /> {viewingStaff.email}
                  </p>
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-4">
                    <span className="px-2.5 py-1 bg-primary/10 text-primary text-[11px] font-medium tracking-normal rounded-full border border-primary/20">
                      {(viewingStaff.role === 'location_admin' || viewingStaff.role === 'branch_admin') ? 'Branch Admin' : viewingStaff.role}
                    </span>
                    <span className="px-2.5 py-1 bg-(--color-surface-soft) dark:bg-(--color-surface) text-(--color-text-muted) text-[11px] font-medium tracking-normal rounded-full">
                      ID: {viewingStaff._id.slice(-6).toUpperCase()}
                    </span>
                    <span className={`px-2.5 py-1 text-[11px] font-medium tracking-normal rounded-full ${viewingStaff.isBlocked ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}`}>
                      {viewingStaff.isBlocked ? 'Blocked' : 'Active'}
                    </span>
                  </div>
                </div>

                <div className="bg-(--color-surface-soft) dark:bg-(--color-surface)/50 p-5 rounded-xl border border-(--color-border) dark:border-(--color-border) text-right min-w-45">
                  <p className="text-[11px] font-medium text-(--color-text-muted) tracking-normal mb-1">Monthly Salary</p>
                  <p className="text-3xl font-semibold text-(--color-text-primary) dark:text-(--color-text-primary) tracking-tight"><Money value={viewingStaff.monthlySalary} /></p>
                </div>
              </div>

              {/* Data Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-6">
                  {/* Identity Section */}
                  <div>
                    <h3 className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted) mb-6 flex items-center gap-2">
                      <CreditCard size={14} className="text-primary" /> Staff Details
                    </h3>
                    <div className="grid grid-cols-1 gap-6">
                      <div className="flex items-center gap-4 bg-(--color-surface-soft) dark:bg-(--color-surface)/50 p-4 rounded-xl border border-(--color-border) dark:border-(--color-border)">
                        <Hash className="text-primary" size={20} />
                        <div>
                          <p className="text-[11px] font-medium text-(--color-text-muted) tracking-normal">Aadhar Number</p>
                          <p className="text-sm font-medium text-(--color-text-secondary) dark:text-(--color-text-muted)">{viewingStaff.aadharNumber || 'Not Added'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 bg-(--color-surface-soft) dark:bg-(--color-surface)/50 p-4 rounded-xl border border-(--color-border) dark:border-(--color-border)">
                        <Phone className="text-primary" size={20} />
                        <div>
                          <p className="text-[11px] font-medium text-(--color-text-muted) tracking-normal">Primary Contact</p>
                          <p className="text-sm font-medium text-(--color-text-secondary) dark:text-(--color-text-muted)">{viewingStaff.phone}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 bg-(--color-surface-soft) dark:bg-(--color-surface)/50 p-4 rounded-xl border border-(--color-border) dark:border-(--color-border)">
                        <Award className="text-primary" size={20} />
                        <div>
                          <p className="text-[11px] font-medium text-(--color-text-muted) tracking-normal">Qualification</p>
                          <p className="text-sm font-medium text-(--color-text-secondary) dark:text-(--color-text-muted)">{viewingStaff.highestQualification}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Demographic Section */}
                  <div>
                    <h3 className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted) mb-6 flex items-center gap-2">
                      <Globe size={14} className="text-primary" /> Personal Info
                    </h3>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="bg-(--color-surface-soft) dark:bg-(--color-surface)/50 p-4 rounded-xl border border-(--color-border) dark:border-(--color-border)">
                        <p className="text-[11px] font-medium text-(--color-text-muted) tracking-normal mb-1">Age</p>
                        <p className="text-lg font-medium text-(--color-text-primary) dark:text-(--color-text-primary)">{viewingStaff.age} Years</p>
                      </div>
                      <div className="bg-(--color-surface-soft) dark:bg-(--color-surface)/50 p-4 rounded-xl border border-(--color-border) dark:border-(--color-border)">
                        <p className="text-[11px] font-medium text-(--color-text-muted) tracking-normal mb-1">Gender</p>
                        <p className="text-lg font-medium text-(--color-text-primary) dark:text-(--color-text-primary)">{viewingStaff.gender}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Address Section */}
                  <div>
                    <h3 className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted) mb-6 flex items-center gap-2">
                      <MapPin size={14} className="text-primary" /> Address
                    </h3>
                    <div className="bg-(--color-surface-soft) dark:bg-(--color-surface)/50 p-5 rounded-xl border border-(--color-border) dark:border-(--color-border)">
                      <p className="text-sm font-medium text-(--color-text-secondary) dark:text-(--color-text-muted) leading-relaxed">
                        {viewingStaff.address1}<br />
                        {viewingStaff.address2 && <>{viewingStaff.address2}<br /></>}
                        {viewingStaff.city}, {viewingStaff.state} - {viewingStaff.pincode}
                      </p>
                    </div>
                  </div>

                  {/* Document Proof Section */}
                  <div>
                    <h3 className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted) mb-6 flex items-center gap-2">
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
                          <span className="font-medium text-[11px] tracking-normal">View Full Image</span>
                        </a>
                      </div>
                    ) : (
                      <div className="rounded-xl border-2 border-dashed border-(--color-border) p-6 flex flex-col items-center justify-center text-(--color-text-muted) aspect-video">
                        <ShieldAlert size={32} className="mb-2 opacity-20" />
                        <p className="text-[11px] font-medium tracking-normal text-center">No Aadhar Card Uploaded</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="pt-8 border-t border-(--color-border) flex flex-col sm:flex-row gap-4">
                <Button
                  variant="outline"
                  className="flex-1 py-5 !rounded-xl font-medium text-xs tracking-normal"
                  onClick={() => setViewingStaff(null)}
                >
                  Close
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 py-5 !rounded-xl font-medium text-xs tracking-normal"
                  onClick={() => router.push(`${staffReportsBase}/${viewingStaff._id}`)}
                >
                  View Report
                </Button>
                <Button
                  className="flex-1 py-5 !rounded-xl font-semibold text-xs tracking-normal bg-(--color-text-primary) text-(--color-surface) shadow-sm"
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
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 bg-(--color-surface-soft) rounded-xl border border-(--color-border)">
                <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-semibold">
                  {attendanceStaff.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-(--color-text-primary)">{attendanceStaff.name}</p>
                  <p className="text-[11px] font-medium text-(--color-text-muted) tracking-normal">{attendanceStaff.role.replace('_', ' ')}</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-[11px] font-medium text-(--color-text-muted) tracking-normal mb-2 ml-1">Date</label>
                  <input
                    type="date"
                    className="w-full px-5 py-4 rounded-xl bg-(--color-bg-soft) border border-(--color-border) text-sm font-medium text-(--color-text-primary) outline-none focus:ring-2 focus:ring-primary"
                    value={attendanceDate}
                    onChange={e => setAttendanceDate(e.target.value)}
                  />
                </div>

                <div className="space-y-3">
                  <label className="block text-[11px] font-medium text-(--color-text-muted) tracking-normal mb-2 ml-1">Status</label>
                  <div className="grid grid-cols-3 gap-3">
                    {['present', 'absent', 'half-day'].map(status => (
                      <button
                        key={status}
                        onClick={() => setAttendanceStatus(status)}
                        className={`py-3 rounded-xl text-[11px] font-medium tracking-normal border transition-all ${attendanceStatus === status ? 'bg-primary text-(--color-on-primary) dark:text-(--color-on-primary) border-primary' : 'bg-(--color-surface-soft) text-(--color-text-muted) border-(--color-border) hover:border-primary/30'}`}
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
                className="w-full py-5 bg-primary text-(--color-on-primary) dark:text-(--color-on-primary) rounded-xl font-semibold text-xs tracking-normal shadow-sm "
              >
                Save Attendance
              </motion.button>
            </div>
          )}
        </Modal>

        {/* Per-row permission editing (shared with the Permissions page).
            Payload always includes `permissions` — see UserPermissionEditor. */}
        <UserPermissionEditor
          isOpen={!!permissionUser}
          onClose={() => setPermissionUser(null)}
          targetUser={permissionUser}
          onSaved={fetchStaff}
        />

        {/* Login As confirm — replaces the old Login As tab. Choose whether the
            user is notified (transparency) or signed into silently (ghost mode). */}
        <Modal
          isOpen={!!impersonateTarget}
          onClose={() => { if (!impersonating) setImpersonateTarget(null); }}
          title="Log in as user"
          maxWidth="max-w-md"
        >
          {impersonateTarget && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-(--color-surface-soft) border border-(--color-border)">
                <span className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-semibold shrink-0">
                  {impersonateTarget.name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-(--color-text-primary) truncate">{impersonateTarget.name}</p>
                  <p className="text-xs text-(--color-text-muted) truncate">{impersonateTarget.email}</p>
                </div>
              </div>

              <div
                onClick={() => setNotifyImpersonate((v) => !v)}
                className={`rounded-xl p-4 border flex items-center justify-between gap-4 cursor-pointer transition-colors ${notifyImpersonate ? 'border-primary/40 bg-primary/5' : 'border-(--color-border) bg-(--color-surface-soft)'}`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${notifyImpersonate ? 'bg-primary/10 text-primary' : 'bg-(--color-surface) text-(--color-text-muted)'}`}>
                    {notifyImpersonate ? <Shield size={18} /> : <ShieldAlert size={18} />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-(--color-text-primary)">{notifyImpersonate ? 'Notify the user' : 'Ghost mode'}</p>
                    <p className="text-[11px] text-(--color-text-muted) mt-0.5 leading-relaxed">
                      {notifyImpersonate
                        ? 'They get a notification that you (your name & role) signed into their account.'
                        : 'You log in silently — the user is NOT notified that you accessed their account.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button" role="switch" aria-checked={notifyImpersonate}
                  onClick={(e) => { e.stopPropagation(); setNotifyImpersonate((v) => !v); }}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${notifyImpersonate ? 'bg-primary' : 'bg-(--color-border-strong)'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${notifyImpersonate ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              <p className="text-[11px] font-medium text-danger">Caution: every action you take while signed in as this user is logged.</p>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 !rounded-xl" onClick={() => setImpersonateTarget(null)} disabled={impersonating}>Cancel</Button>
                <Button variant="primary" icon={Eye} className="flex-1 !rounded-xl" onClick={doImpersonate} loading={impersonating} disabled={impersonating}>
                  {impersonating ? 'Signing in…' : 'Login As'}
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </PageTransition>
  );
}
