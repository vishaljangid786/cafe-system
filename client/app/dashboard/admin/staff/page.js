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


export default function LocationStaffPage() {
  const { user: currentUser } = useAuth();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [viewingStaff, setViewingStaff] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'tree'
  const [expandedNodes, setExpandedNodes] = useState({});
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', age: '', gender: 'Male',
    address1: '', city: '', state: '', pincode: '', monthlySalary: ''
  });
  const [locations, setLocations] = useState([]);
  const [locationFilter, setLocationFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const limit = 9; // Show 9 per page (3x3 grid)

  useEffect(() => {
    fetchLocations();
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [roleFilter, locationFilter, viewMode, page, searchQuery]);

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
      // If in tree mode, we always want all available personnel to build the hierarchy
      const params = viewMode === 'tree' ? {} : {
        role: roleFilter,
        locationId: locationFilter,
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

  const handleDelete = async () => {
    if (!showDeleteConfirm) return;
    const loadToast = toast.loading('Deleting staff record...');
    try {
      await api.delete(`/users/${showDeleteConfirm}`);
      setStaff(staff.filter(s => s._id !== showDeleteConfirm));
      toast.success('Staff record deleted', { id: loadToast });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Delete failed', { id: loadToast });
    } finally {
      setShowDeleteConfirm(null);
    }
  };

  // No longer needed client-side, using backend filtered data
  const staffToDisplay = staff;

  const toggleNode = (nodeId) => {
    setExpandedNodes(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  };

  const StaffNode = ({ member, children, level = 0 }) => {
    const isExpanded = expandedNodes[member._id];
    const hasChildren = children && children.length > 0;

    return (
      <div className="space-y-4">
        <div
          className={`group flex items-center p-6 rounded-[2rem] border transition-all cursor-pointer ${isExpanded ? 'bg-amber-500/5 border-amber-500/20 shadow-lg' : 'bg-white dark:bg-zinc-900 border-gray-100 dark:border-zinc-800 hover:border-amber-500/20'
            } ${!searchQuery || (member.name && member.name.toLowerCase().includes(searchQuery.toLowerCase())) ? 'opacity-100' : 'opacity-40 scale-[0.98]'}`}
          onClick={() => hasChildren && toggleNode(member._id)}
          style={{ marginLeft: `${level * 40}px` }}
        >
          <div className="flex items-center gap-4 flex-1">
            {hasChildren ? (
              isExpanded ? <ChevronDown size={20} className="text-amber-600" /> : <ChevronRight size={20} className="text-zinc-400" />
            ) : (
              <div className="w-5" />
            )}

            <div className={`h-12 w-12 rounded-2xl flex items-center justify-center font-black border ${member.role === 'system_group' ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200/20' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 border-amber-200/10'
              }`}>
              {member.role === 'system_group' ? <Layers size={20} /> : member.name.charAt(0)}
            </div>

            <div>
              <p className="font-black text-gray-900 dark:text-zinc-100 text-lg leading-none">{member.name}</p>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-600">
                  {member.role === 'system_group' ? 'Department' : (member.role === 'location_admin' || member.role === 'branch_admin') ? 'Branch Admin' : member.role.replace('_', ' ')}
                </span>
                {member.assignedLocation && (
                  <span className="text-[9px] font-bold text-zinc-400 flex items-center gap-1">
                    <MapPin size={10} /> {member.assignedLocation.city} - {member.assignedLocation.name}
                  </span>
                )}
                {member.role === 'admin' && member.accessibleLocations?.length > 0 && (
                  <span className="text-[9px] font-bold text-amber-500 flex items-center gap-1">
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
                    className="p-3 hover:bg-white dark:hover:bg-zinc-800 rounded-xl transition-all text-zinc-400 hover:text-blue-500"
                  >
                    <Info size={18} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleEdit(member); }}
                    className="p-3 hover:bg-white dark:hover:bg-zinc-800 rounded-xl transition-all text-zinc-400 hover:text-amber-600"
                  >
                    <Edit3 size={18} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(member._id); }}
                    className="p-3 hover:bg-white dark:hover:bg-zinc-800 rounded-xl transition-all text-zinc-400 hover:text-rose-500"
                  >
                    <Trash2 size={18} />
                  </button>
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
              className="overflow-hidden border-l-2 border-amber-500/10 ml-6"
            >
              <div className="space-y-4 py-4">
                {children.map(child => (
                  <StaffNode key={child._id} member={child} children={child.children} level={level + 1} />
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

    // Helper to match personnel to an admin's scope
    const getAdminChildren = (admin) => {
      const accessibleLocs = admin.accessibleLocations || [];
      const accessibleLocIds = accessibleLocs.map(loc => (loc._id || loc).toString());

      // Group branch personnel by location to show a clear mapping
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
        a.children.flatMap(locNode => locNode.children.filter(c => c.role === 'branch_admin').map(ba => ba._id))
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
          a.children.flatMap(locNode => locNode.children.flatMap(c => {
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
          <StaffNode key={root._id} member={root} children={root.children} />
        )) : (
          <div className="py-32 bg-white dark:bg-zinc-900 rounded-[3rem] border-4 border-dashed border-gray-50 dark:border-zinc-800 flex flex-col items-center justify-center opacity-30">
            <ShieldAlert size={64} className="mb-6" />
            <p className="font-black text-sm uppercase tracking-widest">No personnel telemetry linked</p>
          </div>
        )}
      </div>
    );
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
          <div className="bg-white dark:bg-zinc-900 rounded-[2rem] border border-gray-100 dark:border-zinc-800 p-6 md:p-8 shadow-sm flex flex-col gap-6">

            {/* Top Row */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">

              {/* Left: Title */}
              <div className="flex items-start gap-4">
                <div className="h-14 w-14 rounded-xl bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center text-amber-600">
                  <Users size={26} strokeWidth={2.5} />
                </div>

                <div>
                  <h1 className="text-2xl md:text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
                    Staff <span className="text-amber-600">Management</span>
                  </h1>

                  <p className="text-sm text-zinc-500 mt-1 flex items-center gap-2">
                    <Target size={14} className="text-amber-600" />
                    Manage and monitor your entire workforce
                  </p>
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-3 flex-wrap">

                {/* View Switch */}
                <div className="flex bg-gray-100 dark:bg-zinc-800 p-1 rounded-xl border border-gray-200 dark:border-zinc-700">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-lg transition ${viewMode === 'list'
                      ? 'bg-white dark:bg-zinc-900 text-amber-600 shadow-sm'
                      : 'text-zinc-500'
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
                      ? 'bg-white dark:bg-zinc-900 text-amber-600 shadow-sm'
                      : 'text-zinc-500'
                      }`}
                  >
                    <Grid2X2 size={18} />
                  </button>
                </div>

                {/* Add Button */}
                <Link href="/signup">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center gap-2 bg-zinc-900 dark:bg-amber-600 text-white px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg"
                  >
                    <Plus size={16} />
                    Add Staff
                  </motion.button>
                </Link>
              </div>
            </div>

            {/* Bottom Row (Filters) */}
            {viewMode === 'list' && (
              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">

                {/* 🔍 Premium Search */}
                <div className="relative flex-1 group">
                  {/* Glow Effect */}
                  <div className="absolute inset-0 rounded-xl bg-amber-500/0 group-focus-within:bg-amber-500/10 blur-xl transition-all" />

                  {/* Input */}
                  <div className="relative flex items-center">
                    <Search size={16} className="absolute left-3 text-zinc-400 group-focus-within:text-amber-600 transition-colors" />

                    <input
                      type="text"
                      placeholder="Search staff by name, email..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setPage(1);
                      }}
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-sm font-medium outline-none transition-all shadow-sm"
                    />

                    {/* Clear Button */}
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 text-zinc-400 hover:text-red-500 transition"
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {staffToDisplay.map((member, i) => (
              <SlideIn key={member._id} delay={i * 0.05}>
                <CardHover>
                  <div
                    onClick={() => setViewingStaff(member)}
                    className="bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-zinc-800 p-8 relative group overflow-hidden h-full flex flex-col cursor-pointer"
                  >
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10  transition-all duration-300 scale-">
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
                          <span className="text-[10px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-widest">{(member.role === 'location_admin' || member.role === 'branch_admin') ? 'Branch Admin' : member.role === 'admin' ? 'Main Admin' : member.role}</span>
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

                    <div className="mt-10 pt-6 border-t border-gray-50 dark:border-zinc-800 flex justify-end items-center relative z-10">
                      <div className="flex space-x-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEdit(member); }}
                          className="p-3 text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-2xl transition-all"
                          title="Edit Profile"
                        >
                          <Edit3 size={20} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(member._id); }}
                          className="p-3 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-2xl transition-all"
                          title="Delete Record"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                  </div>
                </CardHover>
              </SlideIn>
            ))}
            {staffToDisplay.length === 0 && (
              <div className="col-span-full py-32 bg-white dark:bg-zinc-900 rounded-[3rem] border-4 border-dashed border-gray-50 dark:border-zinc-800 flex flex-col items-center justify-center opacity-30">
                <ShieldAlert size={64} className="mb-6" />
                <p className="font-black text-sm uppercase tracking-widest">No staff found</p>
              </div>
            )}

            {/* Pagination Controls */}
            {viewMode === 'list' && pagination.pages > 1 && (
              <div className="col-span-full flex justify-center items-center gap-4 mt-8">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 text-zinc-500 disabled:opacity-30 hover:text-amber-600 transition-all shadow-sm"
                >
                  <ChevronRight size={20} className="rotate-180" />
                </button>

                <div className="flex items-center gap-2">
                  {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`h-12 w-12 rounded-2xl font-black text-xs transition-all ${page === p
                        ? 'bg-amber-600 text-white shadow-xl shadow-amber-600/20 scale-110'
                        : 'bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 text-zinc-500 hover:text-amber-600'
                        }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <button
                  disabled={page === pagination.pages}
                  onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                  className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 text-zinc-500 disabled:opacity-30 hover:text-amber-600 transition-all shadow-sm"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </div>
        ) : (
          <SlideIn direction="up">
            {renderHierarchy()}
          </SlideIn>
        )}

        <Modal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          title="Edit Staff Profile"
        >
          <form onSubmit={handleUpdate} className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Full Name</label>
                <input required className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Email</label>
                <input required type="email" className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Phone</label>
                <input required type="number" className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none" value={formData.phone} onInput={e => { if (e.target.value.length > 10) e.target.value = e.target.value.slice(0, 10); }} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Age</label>
                <input required type="number" className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none" value={formData.age} onInput={e => { if (e.target.value.length > 2) e.target.value = e.target.value.slice(0, 2); }} onChange={e => setFormData({ ...formData, age: e.target.value })} />
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
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Address</label>
              <input required className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none" value={formData.address1} onChange={e => setFormData({ ...formData, address1: e.target.value })} />
            </div>

            <div className="grid grid-cols-4 gap-6">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">City</label>
                <input required className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none" value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">State</label>
                <input required className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none" value={formData.state} onChange={e => setFormData({ ...formData, state: e.target.value })} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Pincode</label>
                <input required type="number" className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none" value={formData.pincode} onInput={e => { if (e.target.value.length > 6) e.target.value = e.target.value.slice(0, 6); }} onChange={e => setFormData({ ...formData, pincode: e.target.value })} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Salary (₹)</label>
                <input required type="number" className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none" value={formData.monthlySalary} onChange={e => setFormData({ ...formData, monthlySalary: e.target.value })} />
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-5 bg-zinc-900 dark:bg-amber-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-amber-600/20 mt-4 "
            >
              Update Record
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

        {/* Detailed Personnel Details Modal */}
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
                  <div className="h-32 w-32 rounded-[2.5rem] bg-gradient-to-br from-amber-500 to-amber-700 text-white flex items-center justify-center text-5xl font-black shadow-2xl shadow-amber-500/20 group-hover:scale-105 transition-transform">
                    {viewingStaff.name.charAt(0)}
                  </div>
                  <div className="absolute -bottom-2 -right-2 h-8 w-8 bg-green-500 border-4 border-white dark:border-zinc-950 rounded-full flex items-center justify-center text-white">
                    <UserCheck size={14} />
                  </div>
                </div>

                <div className="text-center md:text-left flex-1">
                  <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">Staff <span className="text-amber-600">Details</span></h2>
                  <p className="text-sm font-bold text-zinc-400 mt-2 flex items-center justify-center md:justify-start gap-2">
                    <Mail size={14} className="text-amber-600" /> {viewingStaff.email}
                  </p>
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-4">
                    <span className="px-3 py-1 bg-amber-500/10 text-amber-600 text-[10px] font-black uppercase tracking-widest rounded-full border border-amber-500/20">
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
                      <CreditCard size={14} className="text-amber-600" /> Identity Details
                    </h3>
                    <div className="grid grid-cols-1 gap-6">
                      <div className="flex items-center gap-4 bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                        <Hash className="text-amber-600" size={20} />
                        <div>
                          <p className="text-[8px] font-black uppercase text-zinc-400 tracking-widest">Aadhar Number</p>
                          <p className="text-sm font-bold text-zinc-700 dark:text-zinc-200">{viewingStaff.aadharNumber || 'Not Added'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                        <Phone className="text-amber-600" size={20} />
                        <div>
                          <p className="text-[8px] font-black uppercase text-zinc-400 tracking-widest">Primary Contact</p>
                          <p className="text-sm font-bold text-zinc-700 dark:text-zinc-200">{viewingStaff.phone}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                        <Award className="text-amber-600" size={20} />
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
                      <Globe size={14} className="text-amber-600" /> Personal Info
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
                      <MapPin size={14} className="text-amber-600" /> Address
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
                      <Info size={14} className="text-amber-600" /> Identity Proof (Aadhar)
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
                          <Globe size={24} className="text-amber-500" />
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
                  Close
                </Button>
                <Button
                  className="flex-1 py-5 !rounded-2xl font-black text-xs uppercase tracking-widest bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-2xl"
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
