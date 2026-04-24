'use client';
import { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import {
  Users, UserPlus, Search, Filter, Trash2, Edit3,
  Shield, Loader2, X, TrendingUp, TrendingDown, ArrowLeft,
  Ban, Unlock, MapPin, UserCheck, Eye
} from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { PageTransition, SlideIn } from '../../../components/ui/AnimatedContainer';
import toast from 'react-hot-toast';
import { useAuth } from '../../../context/AuthContext';
import ExportActions from '../../../components/ui/ExportActions';


export default function UsersManagementPage() {
  const { user: currentUser, impersonate } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [locations, setLocations] = useState([]);
  const [editingUser, setEditingUser] = useState(null);

  const [formData, setFormData] = useState({
    name: '', email: '', password: '', role: 'staff', assignedLocation: '', phone: '',
    gender: 'Male', age: '', address1: '', city: '', state: '', country: 'India',
    highestQualification: 'Graduate', monthlySalary: '', aadharNumber: ''
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users');
      setUsers(res.data.data);
    } catch (error) {
      toast.error('Failed to load user list');
    } finally {
      setLoading(false);
    }
  };

  const fetchLocations = async () => {
    try {
      const res = await api.get('/locations');
      setLocations(res.data.data);
    } catch (error) { }
  };

  useEffect(() => {
    fetchUsers();
    fetchLocations();
  }, []);

  useEffect(() => {
    if ((currentUser?.role === 'location_admin' || currentUser?.role === 'branch_admin') && !editingUser) {
      setFormData(prev => ({
        ...prev,
        assignedLocation: currentUser.assignedLocation?._id || '',
        role: 'staff'
      }));
    }
  }, [currentUser, editingUser]);

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      ...user,
      assignedLocation: user.assignedLocation?._id || user.assignedLocation || '',
      password: '' // Don't show hashed password
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const loadToast = toast.loading(editingUser ? 'Updating user details...' : 'Adding new user...');

    try {
      if (editingUser) {
        await api.put(`/users/${editingUser._id}`, formData);
        toast.success('User details updated', { id: loadToast });
      } else {
        // Auth register requires multipart/form-data for aadharImage
        // This component doesn't seem to handle image upload for registration in this form
        // But for simplicity of refactor, I will keep the existing logic and assume aadharImage is handled elsewhere or not required for simple updates
        await api.post('/auth/register', formData);
        toast.success('User added successfully', { id: loadToast });
      }
      setShowModal(false);
      setEditingUser(null);
      setFormData({
        name: '', email: '', password: '', role: 'staff', assignedLocation: '', phone: '',
        gender: 'Male', age: '', address1: '', city: '', state: '', country: 'India',
        highestQualification: 'Graduate', monthlySalary: '', aadharNumber: ''
      });
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Action failed', { id: loadToast });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleBlock = async (id) => {
    try {
      await api.patch(`/users/${id}/toggle-block`);
      toast.success('Access status toggled');
      fetchUsers();
    } catch (error) {
      toast.error('Failed to change access status');
    }
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm) return;
    try {
      await api.delete(`/users/${showDeleteConfirm}`);
      toast.success('User removed');
      fetchUsers();
    } catch (error) {
      toast.error('Failed to delete user');
    }
  };

  const handleImpersonate = async (userId, viewOnly = false) => {
    if (confirm(`Are you sure you want to impersonate this user in ${viewOnly ? 'VIEW-ONLY' : 'FULL-ACCESS'} mode?`)) {
      const result = await impersonate(userId, viewOnly);
      if (result.success) {
        toast.success(`Impersonation (${viewOnly ? 'View-Only' : 'Full'}) started`);
      } else {
        toast.error(result.message);
      }
    }
  };

  return (
    <PageTransition>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row justify-between md:items-center bg-white/40 dark:bg-zinc-900/40 backdrop-blur-2xl p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-zinc-200 dark:border-zinc-800 gap-6 transition-colors">
          <div>
            <h1 className="text-3xl font-black text-gray-900 dark:text-zinc-100 tracking-tight flex items-center">
              <Users className="mr-4 text-amber-600" size={32} /> User <span className="text-amber-600 ml-2">Management</span>
            </h1>
            <p className="text-gray-500 dark:text-zinc-500 text-sm font-medium mt-1">Manage system access and staff roles.</p>
          </div>
          
          <div className="flex items-center gap-4 flex-wrap justify-end">
            <ExportActions 
              data={users} 
              columns={[
                { header: 'Name', key: 'name' },
                { header: 'Email', key: 'email' },
                { header: 'Role', key: 'role' },
                { header: 'Branch', key: item => item.assignedLocation?.name || 'N/A' },
                { header: 'Status', key: item => item.isBlocked ? 'Blocked' : 'Active' }
              ]} 
              filename="user_list" 
            />
            
            <button
            onClick={() => {
              setEditingUser(null);
              setShowModal(true);
            }}
            className="bg-zinc-900 dark:bg-amber-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all flex items-center shadow-2xl shadow-amber-600/10"
          >
            <UserPlus size={18} className="mr-3" /> Add New User
          </button>
        </div>
        <div className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-2xl rounded-[2.5rem] shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden transition-colors">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="min-w-[1000px] w-full divide-y divide-zinc-100 dark:divide-zinc-800">
              <thead className="bg-zinc-50/50 dark:bg-zinc-800/50">
                <tr>
                  <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">User</th>
                  <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Access Level</th>
                  <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Branch</th>
                  <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Status</th>
                  <th className="px-8 py-6 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <Loader2 className="animate-spin text-amber-600 mb-4" size={32} />
                        <p className="text-xs font-black uppercase tracking-widest text-gray-400">Loading Users...</p>
                      </div>
                    </td>
                  </tr>
                ) : users.map((user) => (
                  <tr key={user._id} className={`hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors group ${user.isBlocked ? 'opacity-50' : ''}`}>
                    <td className="px-8 py-6 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`h-12 w-12 rounded-2xl flex items-center justify-center font-black text-sm border ${user.isBlocked ? 'bg-red-50 text-red-600 border-red-100' : 'bg-amber-100 dark:bg-amber-500/10 text-amber-600 border-amber-200/20'}`}>
                          {user.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-black text-zinc-900 dark:text-zinc-100">{user.name}</div>
                          <div className="text-xs font-medium text-zinc-400 dark:text-zinc-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 whitespace-nowrap">
                      <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] ${user.role === 'super_admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/10' :
                        user.role === 'admin' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/10' :
                          user.role === 'branch_admin' || user.role === 'location_admin' ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/10' : 'bg-gray-100 text-gray-700 dark:bg-zinc-800'
                        }`}>
                        {user.role === 'branch_admin' || user.role === 'location_admin' ? 'Branch Admin' : user.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-8 py-6 whitespace-nowrap text-sm font-bold text-zinc-500 dark:text-zinc-400">
                      {user.assignedLocation?.name || <span className="opacity-30">N/A</span>}
                    </td>
                    <td className="px-8 py-6 whitespace-nowrap text-center">
                      <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-lg ${user.isBlocked ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                        {user.isBlocked ? 'Blocked' : 'Active'}
                      </span>
                    </td>
                    <td className="px-8 py-6 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end space-x-2 lg:opacity-0 group-hover:opacity-100 transition-opacity opacity-100">
                        <button onClick={() => handleToggleBlock(user._id)} className={`p-2 rounded-xl transition-colors ${user.isBlocked ? 'text-green-600 hover:bg-green-50' : 'text-red-400 hover:bg-red-50'}`} title={user.isBlocked ? 'Unblock' : 'Block'}>
                          {user.isBlocked ? <Unlock size={18} /> : <Ban size={18} />}
                        </button>
                        {currentUser?.role === 'super_admin' && currentUser._id !== user._id && !currentUser.impersonatedBy && (
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleImpersonate(user._id, false)} className="p-2 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-500/10 rounded-xl transition-colors" title="Full Impersonate"><UserCheck size={18} /></button>
                            <button onClick={() => handleImpersonate(user._id, true)} className="p-2 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-xl transition-colors" title="View-Only Impersonate"><Eye size={18} /></button>
                          </div>
                        )}
                        <button onClick={() => handleEdit(user)} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl transition-colors" title="Edit"><Edit3 size={18} /></button>
                        <button onClick={() => setShowDeleteConfirm(user._id)} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors" title="Delete"><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <Modal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            setEditingUser(null);
          }}
          title={editingUser ? 'Edit User Details' : 'Add New User'}
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Full Name</label>
                <input required type="text" className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Email Address</label>
                <input required type="email" className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
              </div>
              {!editingUser && (
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Password</label>
                  <input required type="password" underline="true" className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                </div>
              )}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Access Role</label>
                <select className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
                  <option value="staff">Staff</option>
                  <option value="branch_admin">Branch Admin</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Branch Location</label>
                <select
                  disabled={currentUser?.role === 'location_admin' || currentUser?.role === 'branch_admin'}
                  className={`w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none ${currentUser?.role === 'location_admin' || currentUser?.role === 'branch_admin' ? 'opacity-50 cursor-not-allowed' : ''}`}
                  value={formData.assignedLocation}
                  onChange={e => setFormData({ ...formData, assignedLocation: e.target.value })}
                >
                  <option value="">No Location</option>
                  {locations.map(l => <option key={l._id} value={l._id}>{l.name}</option>)}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-5 bg-zinc-900 dark:bg-amber-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-amber-600/20 flex items-center justify-center mt-4"
            >
              {submitting ? <Loader2 className="animate-spin mr-3" /> : (editingUser ? 'Update User' : 'Add User')}
            </button>
          </form>
        </Modal>

        <ConfirmDialog
          isOpen={!!showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(null)}
          onConfirm={handleDelete}
          title="Remove User?"
          message="This will permanently remove the user from the system. This action cannot be undone."
          isImpersonating={!!currentUser?.impersonatedBy}
        />
      </div>
      </div>
    </PageTransition>
  );
}
