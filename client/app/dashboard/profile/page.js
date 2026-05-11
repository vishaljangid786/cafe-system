'use client';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
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
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const [loading, setLoading] = useState(false);
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

  const tabs = [
    { id: 'details', label: 'My Details', icon: UserIcon },
    { id: 'security', label: 'Change Password', icon: Shield }
  ];

  return (
    <PageTransition>
      <div className="max-w-[1500px] mx-auto pb-20 space-y-10">
        {/* Cinematic Hero Section */}
        {activeTab === 'details' &&
          <SlideIn direction="down">
            <div className="relative overflow-hidden rounded-[3.5rem] bg-[var(--color-surface)] p-12 lg:p-20 text-[var(--color-text-primary)] shadow-2xl shadow-black/5 border border-[var(--color-border)]">
              <div className="relative z-10 flex flex-col lg:flex-row justify-between items-center gap-10">
                <div className="flex flex-col md:flex-row items-center gap-8">
                  <div className="relative h-40 w-40 rounded-[3rem] bg-white/5 p-2 backdrop-blur-xl border border-white/10 overflow-hidden group">
                    <div className="h-full w-full rounded-[2.5rem] overflow-hidden bg-[var(--color-bg-soft)] shadow-2xl flex items-center justify-center">
                      {(previewImage || user.profileImageUrl) ? (
                        <img src={previewImage || user.profileImageUrl} alt={user.name || 'Profile'} className="h-full w-full object-cover" />
                      ) : (
                        <UserIcon size={64} className="text-[var(--color-primary)] opacity-20" />
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
                    <span className="px-4 py-1.5 bg-[var(--color-primary)]/20 text-[var(--color-primary)] text-[9px] font-black uppercase tracking-[0.4em] rounded-full border border-[var(--color-primary)]/30">
                      {user.role.replace('_', ' ')} Command
                    </span>
                    <h1 className="text-5xl lg:text-7xl font-black tracking-tighter mt-4 leading-none">{user.name}</h1>
                    <p className="text-[var(--color-text-muted)] font-bold mt-4 tracking-tight flex items-center justify-center md:justify-start gap-2">
                      <Mail size={16} /> {user.email}
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  {isEditing ? (
                    <>
                      <Button onClick={handleSubmit} disabled={loading} className="!rounded-2xl px-8 py-6 font-black text-xs uppercase tracking-widest bg-[var(--color-primary)] text-white">
                        {loading ? <Loader2 className="animate-spin" /> : 'Save Changes'}
                      </Button>
                      <Button onClick={() => setIsEditing(false)} variant="outline" className="!rounded-2xl px-8 py-6 font-black text-xs uppercase tracking-widest border-primary text-primary  border-2 hover:bg-primary border-primary ">
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button onClick={() => setIsEditing(true)} className="!rounded-2xl px-8 py-6 font-black text-xs uppercase tracking-widest bg-primary border-2 border-primary hover:bg-accent hover:text-white transition-all">
                      Edit My Profile
                    </Button>
                  )}
                </div>
              </div>

              {/* Decoration */}
              <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-[var(--color-primary)]/10 to-transparent" />
              <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-[var(--color-primary)]/10 rounded-full blur-[100px]" />
            </div>
          </SlideIn>
        }

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 p-1.5 bg-[var(--color-surface)] rounded-[2rem] w-fit mx-auto border border-[var(--color-border)] shadow-sm">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 px-8 py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-[var(--color-primary)] text-black shadow-xl shadow-[var(--color-primary)]/10' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
            >
              <tab.icon size={16} /> {tab.label}
            </button>
          ))}
        </div>

        {/* Profile Details */}
        <AnimatePresence mode="wait">
          {activeTab === 'details' && (
            <motion.div key="details" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              <div className="lg:col-span-8 space-y-8">
                <div className="bg-[var(--color-surface)] rounded-[3rem] p-10 lg:p-14 border border-[var(--color-border)] shadow-sm">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--color-text-muted)] mb-10 flex items-center gap-3">
                    <Shield size={16} className="text-[var(--color-primary)]" /> Personal Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <DetailsField label="Full Name" name="name" value={formData.name} icon={UserIcon} isEditing={isEditing} onChange={handleChange} />
                    <DetailsField label="Mobile Number" name="phone" value={formData.phone} icon={Phone} isEditing={isEditing} onChange={handleChange} />
                    <DetailsField label="Age" name="age" value={formData.age} icon={Calendar} isEditing={isEditing} onChange={handleChange} type="number" />
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

              <div className="lg:col-span-4 space-y-8">
                <CardHover>
                  <div className="bg-[var(--color-surface-soft)] rounded-[3rem] p-10 text-[var(--color-text-primary)] shadow-xl border border-[var(--color-border)] relative overflow-hidden group">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--color-primary)] mb-8 flex items-center gap-2">
                      <Briefcase size={14} /> Work Details
                    </h3>
                    <div className="space-y-6 relative z-10">
                      <div>
                        <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">Designation</p>
                        <p className="text-2xl font-black text-foreground mt-1 tracking-tight capitalize">{user.role === 'location_admin' || user.role === 'branch_admin' ? 'branch admin' : user.role.replace('_', ' ')}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">Base Compensation</p>
                        <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 tracking-tight">₹{user.monthlySalary?.toLocaleString() || '0'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">Primary Sector</p>
                        <p className="text-xl font-black text-[var(--color-text-secondary)] mt-1 tracking-tight">{user.assignedLocation?.name || 'Global HQ'}</p>
                      </div>
                    </div>
                    <div className="absolute -bottom-10 -right-10 opacity-5 group-hover:opacity-10 transition-opacity">
                      <Zap size={150} />
                    </div>
                  </div>
                </CardHover>
              </div>
            </motion.div>
          )}


          {activeTab === 'security' && (
            <motion.div key="security" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="max-w-2xl mx-auto">
              <div className="bg-[var(--color-surface)] rounded-[3rem] p-10 lg:p-14 border border-[var(--color-border)] shadow-sm">
                <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--color-text-muted)] mb-10 flex items-center gap-3">
                  <Shield size={16} className="text-[var(--color-primary)]" /> Change Password
                </h3>

                <form className="space-y-8" onSubmit={async (e) => {
                  e.preventDefault();
                  const currentPassword = e.target.currentPassword.value;
                  const newPassword = e.target.newPassword.value;
                  const confirmPassword = e.target.confirmPassword.value;

                  if (newPassword !== confirmPassword) return toast.error('Error: Passwords do not match');

                  const loadToast = toast.loading('Updating your password...');
                  try {
                    await api.put('/users/change-password', { currentPassword, newPassword });
                    toast.success('Access credentials updated', { id: loadToast });
                    e.target.reset();
                  } catch (err) {
                    toast.error(err.response?.data?.message || 'Password update failed', { id: loadToast });
                  }
                }}>
                  <div className="space-y-6">
                    <DetailsField label="Current Password" name="currentPassword" icon={Shield} isEditing={true} type="password" />
                    <div className="h-px bg-[var(--color-border)] my-4" />
                    <DetailsField label="New Password" name="newPassword" icon={Zap} isEditing={true} type="password" />
                    <DetailsField label="Verify New Password" name="confirmPassword" icon={CheckCircle2} isEditing={true} type="password" />
                  </div>

                  <div className="pt-6">
                    <Button type="submit" className="w-full h-16 !text-xs font-black uppercase tracking-widest bg-[var(--color-primary)] text-white shadow-xl">
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

function DetailsField({ label, name, value, icon: Icon, isEditing, onChange, type = 'text', maxLength }) {
  return (
    <div className="space-y-3">
      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] ml-4">{label}</label>
      <div className={`relative group transition-all duration-300 ${!isEditing ? 'opacity-70' : ''}`}>
        <Icon className="absolute left-6 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-[var(--color-primary)] transition-colors" size={18} />
        <input
          name={name}
          type={type}
          disabled={!isEditing}
          value={value}
          onChange={onChange}
          maxLength={maxLength}
          className="w-full pl-16 pr-6 py-5 rounded-[2rem] bg-[var(--color-bg-soft)] border-2 border-transparent focus:border-[var(--color-primary)]/30 focus:bg-[var(--color-surface)] outline-none text-xs font-bold transition-all shadow-inner placeholder:opacity-30 text-[var(--color-text-primary)]"
          placeholder={`Input ${label}...`}
        />
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, icon: Icon, color }) {
  const colors = {
    amber: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    blue: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    rose: 'text-rose-500 bg-rose-500/10 border-rose-500/20'
  };

  return (
    <CardHover>
      <div className="bg-[var(--color-surface)] p-8 rounded-[2.5rem] border border-[var(--color-border)] shadow-sm flex flex-col items-center text-center group">
        <div className={`h-14 w-14 rounded-2xl ${colors[color]} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500`}>
          <Icon size={24} />
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-2">{label}</p>
        <h4 className="text-3xl font-black text-[var(--color-text-primary)] tracking-tighter mb-2">{value || '0'}</h4>
        <p className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">{sub}</p>
      </div>
    </CardHover>
  );
}
