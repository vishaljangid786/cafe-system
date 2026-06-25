'use client';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { blockNonInteger } from '@/app/utils/inputValidation';
import {
  User as UserIcon, Mail, Phone, MapPin,
  Camera, Save, Loader2, Calendar, Award,
  Shield, Briefcase, Zap, Globe, ChevronDown,
  TrendingUp, Timer, ShoppingBag, Receipt,
  CheckCircle2, XCircle, AlertCircle, History,
  DollarSign, BarChart3, ChevronRight, Plus
} from 'lucide-react';
import { PageTransition, SlideIn, CardHover } from '../../components/ui/AnimatedContainer';
import { Button } from '../../components/ui/Button';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { progress } from '@/app/components/ui/TopProgressBar';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('details'); // details, stats, history, security

  // Staff Data
  const [chefStats, setChefStats] = useState(null);
  const [salaryHistory, setSalaryHistory] = useState([]);
  const [attendance, setAttendance] = useState([]);

  const [previewImage, setPreviewImage] = useState(null);
  const fileInputRef = useRef(null);

  // Filters
  const [statsFilter, setStatsFilter] = useState({ startDate: '', endDate: '' });
  const [historyFilter, setHistoryFilter] = useState({ startDate: '', endDate: '' });

  const [formData, setFormData] = useState({
    name: '', phone: '', age: '', gender: 'Male',
    address1: '', address2: '', city: '', state: '', country: '', pincode: ''
  });

  const fetchData = async () => {
    if (!user) return;
    progress.start();
    try {
      if (user.role === 'chef' || user.role === 'staff') {
        const statsParams = {};
        if (statsFilter.startDate) statsParams.startDate = statsFilter.startDate;
        if (statsFilter.endDate) statsParams.endDate = statsFilter.endDate;

        const historyParams = {};
        if (historyFilter.startDate) historyParams.startDate = historyFilter.startDate;
        if (historyFilter.endDate) historyParams.endDate = historyFilter.endDate;

        const statsEndpoint = user.role === 'chef' ? '/orders/my-stats-chef' : '/orders/my-stats-staff';
        const [statsRes, salaryRes, attRes] = await Promise.all([
          api.get(statsEndpoint, { params: statsParams }),
          api.get('/salary/my-history'), // Salary is fixed 6 months for now
          api.get('/attendance/my', { params: historyParams })
        ]);
        setChefStats(statsRes.data.data);
        setSalaryHistory(salaryRes.data.data);
        setAttendance(attRes.data.data);
      }
    } catch (error) {
      console.error('Failed to load performance metrics');
    } finally {
      setPageLoading(false);
      progress.done();
    }
  };

  useEffect(() => {
    if (user) {
      const timer = setTimeout(() => {
        setFormData({
          name: user.name || '',
          phone: user.phone || '',
          age: user.age || '',
          gender: user.gender || 'Male',
          address1: user.address1 || '',
          address2: user.address2 || '',
          city: user.city || '',
          state: user.state || '',
          country: user.country || '',
          pincode: user.pincode || ''
        });
        fetchData();
      }, 0);

      return () => clearTimeout(timer);
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Validation Logic
    if (name === 'age') {
      if (value && (value.length > 2 || isNaN(value))) return;
    }
    if (name === 'phone' || name === 'alternatePhone') {
      if (value && (value.length > 10 || isNaN(value))) return;
    }
    if (name === 'pincode') {
      if (value && (value.length > 6 || isNaN(value))) return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) setPreviewImage(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setLoading(true);
    const loadToast = toast.loading('Updating your profile...');
    try {
      const data = new FormData();
      Object.keys(formData).forEach(key => data.append(key, formData[key]));
      if (fileInputRef.current?.files[0]) data.append('profileImage', fileInputRef.current.files[0]);

      const res = await api.put('/users/update-profile', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUser(prev => ({ ...prev, ...res.data.data }));
      setIsEditing(false);
      toast.success('Profile updated successfully', { id: loadToast });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Update failed', { id: loadToast });
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;
  if (pageLoading) return <LoadingScreen fullScreen={false} />;

  const tabs = [
    { id: 'details', label: 'My Details', icon: UserIcon },
    { id: 'security', label: 'Change Password', icon: Shield }
  ];

  return (
    <PageTransition>
      <div className="max-w-375 mx-auto pb-20 space-y-8">
        {/* Hero Section */}
        {activeTab === 'details' &&
          <SlideIn direction="down">
            <div className="card rounded-xl p-6 lg:p-8 text-(--color-text-primary)">
              <div className="flex flex-col lg:flex-row justify-between items-center gap-8">
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <div className="relative h-32 w-32 rounded-xl bg-(--color-surface-soft) p-2 border border-(--color-border) overflow-hidden group">
                    <div className="h-full w-full rounded-lg overflow-hidden bg-(--color-surface-soft) flex items-center justify-center">
                      {(previewImage || user.profileImageUrl) ? (
                        <img src={previewImage || user.profileImageUrl} alt={user.name || 'Profile'} className="h-full w-full object-cover" />
                      ) : (
                        <UserIcon size={64} className="text-primary opacity-20" />
                      )}
                    </div>
                    {isEditing && (
                      <button onClick={() => fileInputRef.current?.click()} className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                        <Camera className="text-white" />
                      </button>
                    )}
                    <input type="file" ref={fileInputRef} onChange={handleImageChange} className="hidden" accept="image/*" />
                  </div>
                  <div className="text-center md:text-left">
                    <span className="badge bg-(--color-primary-soft) text-primary capitalize">
                      {user.role.replace('_', ' ')}
                    </span>
                    <h1 className="text-2xl lg:text-3xl font-bold tracking-tight mt-3 leading-tight">{user.name}</h1>
                    <p className="text-(--color-text-muted) font-medium mt-2 flex items-center justify-center md:justify-start gap-2">
                      <Mail size={16} /> {user.email}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  {isEditing ? (
                    <>
                      <Button onClick={handleSubmit} disabled={loading}>
                        {loading ? <Loader2 className="animate-spin" /> : 'Save Changes'}
                      </Button>
                      <Button onClick={() => setIsEditing(false)} variant="outline">
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button onClick={() => setIsEditing(true)}>
                      Edit Profile
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </SlideIn>
        }

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 p-1.5 panel rounded-lg w-fit mx-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-semibold transition-colors ${activeTab === tab.id ? 'bg-primary text-(--color-on-primary)' : 'text-(--color-text-muted) hover:text-(--color-text-primary)'}`}
            >
              <tab.icon size={16} /> {tab.label}
            </button>
          ))}
        </div>

        {/* Profile Details */}
        <AnimatePresence mode="wait">
          {activeTab === 'details' && (
            <motion.div key="details" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 space-y-6">
                <div className="card rounded-xl p-6 lg:p-8">
                  <h3 className="section-title mb-6 flex items-center gap-2">
                    <Shield size={16} className="text-primary" /> Personal Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <DetailsField label="Full Name" name="name" value={formData.name} icon={UserIcon} isEditing={isEditing} onChange={handleChange} />
                    <DetailsField label="Mobile Number" name="phone" value={formData.phone} icon={Phone} isEditing={isEditing} onChange={handleChange} />
                    <DetailsField label="Age" name="age" value={formData.age} icon={Calendar} isEditing={isEditing} onChange={handleChange} type="number" onKeyDown={blockNonInteger} />
                    <DetailsField label="City" name="city" value={formData.city} icon={MapPin} isEditing={isEditing} onChange={handleChange} />
                    <DetailsField label="State" name="state" value={formData.state} icon={MapPin} isEditing={isEditing} onChange={handleChange} />
                    <DetailsField label="Country" name="country" value={formData.country} icon={Globe} isEditing={isEditing} onChange={handleChange} />
                    <DetailsField label="Pincode" name="pincode" value={formData.pincode} icon={MapPin} isEditing={isEditing} onChange={handleChange} />
                    <div className="md:col-span-2">
                      <DetailsField label="Address Line 1" name="address1" value={formData.address1} icon={Globe} isEditing={isEditing} onChange={handleChange} />
                    </div>
                    <div className="md:col-span-2">
                      <DetailsField label="Address Line 2" name="address2" value={formData.address2} icon={Globe} isEditing={isEditing} onChange={handleChange} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-4 space-y-6">
                <CardHover>
                  <div className="card rounded-xl p-6 text-(--color-text-primary)">
                    <h3 className="label text-primary mb-6 flex items-center gap-2">
                      <Briefcase size={14} /> Work Details
                    </h3>
                    <div className="space-y-5">
                      <div>
                        <p className="label">Designation</p>
                        <p className="text-xl font-semibold text-(--color-text-primary) mt-1 tracking-tight capitalize">{user.role === 'location_admin' || user.role === 'branch_admin' ? 'branch admin' : user.role.replace('_', ' ')}</p>
                      </div>
                      <div>
                        <p className="label">Base Salary</p>
                        <p className="text-xl font-semibold text-success mt-1 tracking-tight">₹{user.monthlySalary?.toLocaleString() || '0'}</p>
                      </div>
                      <div>
                        <p className="label">Branch</p>
                        <p className="text-lg font-semibold text-(--color-text-secondary) mt-1 tracking-tight">{user.assignedLocation?.name || 'Head Office'}</p>
                      </div>
                    </div>
                  </div>
                </CardHover>
              </div>
            </motion.div>
          )}


          {activeTab === 'security' && (
            <motion.div key="security" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="max-w-2xl mx-auto">
              <div className="bg-(--color-surface) rounded-xl p-10 lg:p-14 border border-(--color-border) shadow-sm">
                <h3 className="text-[11px] font-bold uppercase tracking-normal text-(--color-text-muted) mb-10 flex items-center gap-3">
                  <Shield size={16} className="text-primary" /> Change Password
                </h3>

                <form className="space-y-8" onSubmit={async (e) => {
                  e.preventDefault();
                  const currentPassword = e.target.currentPassword.value;
                  const newPassword = e.target.newPassword.value;
                  const confirmPassword = e.target.confirmPassword.value;

                  if (newPassword !== confirmPassword) return toast.error('Passwords do not match');

                  const loadToast = toast.loading('Updating your password...');
                  try {
                    await api.put('/users/change-password', { currentPassword, newPassword });
                    toast.success('Password updated successfully', { id: loadToast });
                    e.target.reset();
                  } catch (err) {
                    toast.error(err.response?.data?.message || 'Password update failed', { id: loadToast });
                  }
                }}>
                  <div className="space-y-6">
                    <DetailsField label="Current Password" name="currentPassword" icon={Shield} isEditing={true} type="password" />
                    <div className="h-px bg-(--color-border) my-4" />
                    <DetailsField label="New Password" name="newPassword" icon={Zap} isEditing={true} type="password" />
                    <DetailsField label="Confirm New Password" name="confirmPassword" icon={CheckCircle2} isEditing={true} type="password" />
                  </div>

                  <div className="pt-6">
                    <Button type="submit" className="w-full h-16 !text-xs font-bold uppercase tracking-normal bg-primary text-white shadow-sm">
                      Confirm Change
                    </Button>
                  </div>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}

function DetailsField({ label, name, value, icon: Icon, isEditing, onChange, type = 'text', maxLength, onKeyDown }) {
  return (
    <div className="space-y-3">
      <label className="text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal ml-4">{label}</label>
      <div className={`relative group transition-all duration-300 ${!isEditing ? 'opacity-70' : ''}`}>
        <Icon className="absolute left-6 top-1/2 -translate-y-1/2 text-(--color-text-muted) group-focus-within:text-primary transition-colors" size={18} />
        <input
          name={name}
          type={type}
          disabled={!isEditing}
          value={value}
          onChange={onChange}
          maxLength={maxLength}
          onKeyDown={onKeyDown}
          className="w-full pl-16 pr-6 py-5 rounded-xl bg-(--color-bg-soft) border-2 border-transparent focus:border-primary/30 focus:bg-(--color-surface) outline-none text-xs font-bold transition-all shadow-inner placeholder:opacity-30 text-(--color-text-primary)"
          placeholder={`Enter ${label}...`}
        />
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, icon: Icon, color }) {
  const colors = {
    amber: 'text-primary bg-primary/10 border-primary/20',
    blue: 'text-primary bg-primary/10 border-primary/20',
    emerald: 'text-success bg-success/10 border-success/20',
    rose: 'text-danger bg-danger/10 border-danger/20'
  };

  return (
    <CardHover>
      <div className="bg-(--color-surface) p-8 rounded-xl border border-(--color-border) shadow-sm flex flex-col items-center text-center group">
        <div className={`h-14 w-14 rounded-xl ${colors[color]} flex items-center justify-center mb-6 transition-transform duration-500`}>
          <Icon size={24} />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) mb-2">{label}</p>
        <h4 className="text-3xl font-bold text-(--color-text-primary) tracking-tight mb-2">{value || '0'}</h4>
        <p className="text-[9px] font-bold text-(--color-text-muted) uppercase tracking-normal">{sub}</p>
      </div>
    </CardHover>
  );
}
