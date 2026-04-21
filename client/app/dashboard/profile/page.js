'use client';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import {
  User as UserIcon, Mail, Phone, MapPin,
  Camera, Save, Loader2, Calendar, Award,
  Hash, Shield, Briefcase,
  Zap,
  Globe,
  ChevronDown
} from 'lucide-react';
import { PageTransition, SlideIn } from '../../components/ui/AnimatedContainer';
import { Button } from '../../components/ui/Button';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    age: '',
    gender: 'Male',
    address1: '',
    address2: '',
    city: '',
    state: '',
    country: '',
    alternatePhone: '',
    highestQualification: 'Graduate'
  });

  useEffect(() => {
    if (user) {
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
        alternatePhone: user.alternatePhone || '',
        highestQualification: user.highestQualification || 'Graduate'
      });
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPreviewImage(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setLoading(true);
    const loadToast = toast.loading('Synchronizing profile updates...');

    try {
      const data = new FormData();
      Object.keys(formData).forEach(key => data.append(key, formData[key]));

      if (fileInputRef.current?.files[0]) {
        data.append('profileImage', fileInputRef.current.files[0]);
      }

      const res = await api.put('/users/update-profile', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setUser(prev => ({ ...prev, ...res.data.data }));
      setIsEditing(false);
      toast.success('Personnel dossier updated successfully', { id: loadToast });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Update failed', { id: loadToast });
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <PageTransition>
      <div className="max-w-[1400px] mx-auto pb-20">
        {/* Modern Header Section */}
        <SlideIn direction="down">
          <div className="relative mb-10 overflow-hidden rounded-[3rem] bg-zinc-900 p-10 lg:p-16 text-white shadow-2xl shadow-zinc-900/20">
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
              <div className="text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-4 mb-4">
                  <span className="px-4 py-1.5 bg-amber-500/20 text-amber-500 text-[10px] font-black uppercase tracking-[0.3em] rounded-full border border-amber-500/30 backdrop-blur-md">
                    Personnel Management
                  </span>
                </div>
                <h1 className="text-5xl lg:text-7xl font-black tracking-tighter leading-none">
                  {user.name}
                </h1>
                <p className="text-zinc-400 font-bold mt-6 max-w-xl text-lg leading-relaxed">
                  {user.email}
                </p>
              </div>

              <div className="flex flex-col items-center md:items-end gap-6">
                {!isEditing ? (
                  <Button
                    onClick={() => setIsEditing(true)}
                    className="!rounded-[2rem] px-10 py-8 font-black uppercase tracking-[0.2em] text-xs shadow-2xl shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all group"
                  >
                    <Save size={18} className="mr-3 group-hover:rotate-12 transition-transform" />
                    Edit Intelligence
                  </Button>
                ) : (
                  <div className="flex gap-4">
                    <Button
                      onClick={handleSubmit}
                      disabled={loading}
                      className="!rounded-[2rem] px-10 py-8 font-black uppercase tracking-[0.2em] text-xs shadow-2xl shadow-amber-500/20"
                    >
                      {loading ? <Loader2 className="animate-spin mr-3" /> : <Save size={18} className="mr-3" />}
                      Sync Changes
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsEditing(false);
                        setPreviewImage(null);
                      }}
                      className="!rounded-[2rem] px-10 py-8 font-black uppercase tracking-[0.2em] text-xs border-white/10 text-white hover:bg-white/5"
                    >
                      Abort
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Decorative Elements */}
            <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-amber-500/10 to-transparent pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute top-10 right-10 opacity-10">
              <Shield size={200} />
            </div>
          </div>
        </SlideIn>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Left Column: Visual Identity */}
          <div className="lg:col-span-4 space-y-10">
            <SlideIn direction="left" delay={0.1}>
              <div className="bg-white dark:bg-zinc-900 rounded-[3rem] p-10 border border-zinc-100 dark:border-zinc-800 shadow-xl relative overflow-hidden group">
                {/* Profile Image Container */}
                <div className="relative mx-auto w-56 h-56 mb-10">
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-400 to-amber-600 rounded-[4rem] rotate-6 group-hover:rotate-12 transition-transform duration-700 opacity-20" />
                  <div className="absolute inset-0 bg-gradient-to-tr from-amber-500 to-orange-600 rounded-[4rem] -rotate-3 group-hover:-rotate-6 transition-transform duration-700 opacity-20" />

                  <div className="relative h-full w-full rounded-[3.5rem] bg-zinc-100 dark:bg-zinc-800 p-2 shadow-2xl overflow-hidden border border-white dark:border-zinc-700">
                    <div className="h-full w-full rounded-[3rem] overflow-hidden flex items-center justify-center bg-white dark:bg-zinc-950">
                      {(previewImage || user.profileImageUrl) ? (
                        <img
                          src={previewImage || user.profileImageUrl}
                          alt="Profile"
                          className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-700"
                        />
                      ) : (
                        <UserIcon size={80} className="text-amber-500 opacity-20" strokeWidth={1} />
                      )}
                    </div>
                  </div>

                  {isEditing && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute -bottom-2 -right-2 h-14 w-14 bg-amber-500 text-white rounded-2xl flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all z-30 border-4 border-white dark:border-zinc-900"
                    >
                      <Camera size={24} />
                    </button>
                  )}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageChange}
                    className="hidden"
                    accept="image/*"
                  />
                </div>

                <div className="text-center space-y-4">
                  <h2 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-100 leading-none">{user.name}</h2>
                  <div className="flex items-center justify-center gap-3">
                    <span className="px-4 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-[10px] font-black uppercase tracking-widest rounded-full">
                      ID: {user._id.slice(-6).toUpperCase()}
                    </span>
                    <span className="px-4 py-1.5 bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-widest rounded-full border border-emerald-500/20">
                      Authorized
                    </span>
                  </div>
                </div>

                <div className="mt-12 pt-10 border-t border-zinc-50 dark:border-zinc-800 space-y-6">
                  <div className="flex items-center gap-5 p-5 bg-zinc-50/50 dark:bg-zinc-800/30 rounded-[2rem] border border-transparent hover:border-amber-500/20 transition-all group/item">
                    <div className="h-12 w-12 rounded-2xl bg-white dark:bg-zinc-900 flex items-center justify-center text-amber-500 shadow-sm group-hover/item:scale-110 transition-transform">
                      <Mail size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-1">Protocol Email</p>
                      <p className="text-sm font-bold text-zinc-700 dark:text-zinc-200 truncate">{user.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-5 p-5 bg-zinc-50/50 dark:bg-zinc-800/30 rounded-[2rem] border border-transparent hover:border-amber-500/20 transition-all group/item">
                    <div className="h-12 w-12 rounded-2xl bg-white dark:bg-zinc-900 flex items-center justify-center text-amber-500 shadow-sm group-hover/item:scale-110 transition-transform">
                      <Briefcase size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-1">Assigned Role</p>
                      <p className="text-sm font-bold text-zinc-700 dark:text-zinc-200 uppercase tracking-tighter">{user.role.replace('_', ' ')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </SlideIn>

            <SlideIn direction="left" delay={0.2}>
              <div className="bg-zinc-900 rounded-[3rem] p-10 text-white shadow-2xl shadow-zinc-900/20 relative overflow-hidden">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500 mb-8 flex items-center gap-3">
                  <Zap size={14} /> Operational Node
                </h3>
                <div className="space-y-6">
                  <div className="p-6 bg-white/5 rounded-[2rem] border border-white/5 backdrop-blur-md">
                    <p className="text-xs font-medium text-zinc-400 leading-relaxed">
                      Assigned Sector:
                    </p>
                    <p className="text-xl font-black text-white mt-2 tracking-tight">
                      {user.assignedLocation?.name || 'Global HQ Command'}
                    </p>
                    <div className="flex items-center gap-2 mt-4 text-amber-500">
                      <MapPin size={14} />
                      <span className="text-[10px] font-black uppercase tracking-widest">{user.assignedLocation?.city || 'Central District'}</span>
                    </div>
                  </div>
                </div>
                {/* Decoration */}
                <div className="absolute -bottom-10 -right-10 opacity-10">
                  <Globe size={120} />
                </div>
              </div>
            </SlideIn>
          </div>

          {/* Right Column: Detailed Parameters */}
          <div className="lg:col-span-8 space-y-10">
            <SlideIn direction="right" delay={0.3}>
              <div className="bg-white dark:bg-zinc-900 rounded-[3rem] p-10 lg:p-14 border border-zinc-100 dark:border-zinc-800 shadow-xl">
                <div className="flex items-center gap-6 mb-12">
                  <div className="h-16 w-16 rounded-3xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                    <UserIcon size={32} strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-100 leading-none">Personnel Credentials</h3>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] mt-3">Core Identity Matrix</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-2">Identified Name</label>
                    <div className={`relative group transition-all duration-300 ${!isEditing ? 'opacity-70' : ''}`}>
                      <UserIcon className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-amber-500 transition-colors" size={20} />
                      <input
                        name="name"
                        disabled={!isEditing}
                        value={formData.name}
                        onChange={handleChange}
                        className="w-full pl-16 pr-6 py-5 rounded-[2rem] bg-zinc-50 dark:bg-zinc-800/50 border-2 border-transparent focus:border-amber-500/30 focus:bg-white dark:focus:bg-zinc-800 outline-none text-sm font-bold transition-all shadow-inner"
                        placeholder="System Name"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-2">Contact Protocol</label>
                    <div className={`relative group transition-all duration-300 ${!isEditing ? 'opacity-70' : ''}`}>
                      <Phone className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-amber-500 transition-colors" size={20} />
                      <input
                        name="phone"
                        disabled={!isEditing}
                        value={formData.phone}
                        onChange={handleChange}
                        className="w-full pl-16 pr-6 py-5 rounded-[2rem] bg-zinc-50 dark:bg-zinc-800/50 border-2 border-transparent focus:border-amber-500/30 focus:bg-white dark:focus:bg-zinc-800 outline-none text-sm font-bold transition-all shadow-inner"
                        placeholder="+91 XXXXX XXXXX"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-2">Temporal Age</label>
                    <div className={`relative group transition-all duration-300 ${!isEditing ? 'opacity-70' : ''}`}>
                      <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-amber-500 transition-colors" size={20} />
                      <input
                        name="age"
                        type="number"
                        disabled={!isEditing}
                        value={formData.age}
                        onChange={handleChange}
                        className="w-full pl-16 pr-6 py-5 rounded-[2rem] bg-zinc-50 dark:bg-zinc-800/50 border-2 border-transparent focus:border-amber-500/30 focus:bg-white dark:focus:bg-zinc-800 outline-none text-sm font-bold transition-all shadow-inner"
                        placeholder="Cycle Age"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-2">Academic Standing</label>
                    <div className={`relative group transition-all duration-300 ${!isEditing ? 'opacity-70' : ''}`}>
                      <Award className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-amber-500 transition-colors" size={20} />
                      <select
                        name="highestQualification"
                        disabled={!isEditing}
                        value={formData.highestQualification}
                        onChange={handleChange}
                        className="w-full pl-16 pr-12 py-5 rounded-[2rem] bg-zinc-50 dark:bg-zinc-800/50 border-2 border-transparent focus:border-amber-500/30 focus:bg-white dark:focus:bg-zinc-800 outline-none text-sm font-bold transition-all shadow-inner appearance-none cursor-pointer"
                      >
                        {['12th Pass', 'Diploma', 'Graduate', 'Post Graduate'].map(q => (
                          <option key={q} value={q}>{q}</option>
                        ))}
                      </select>
                      {isEditing && <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={18} />}
                    </div>
                  </div>
                </div>

                <div className="mt-20">
                  <div className="flex items-center gap-6 mb-12">
                    <div className="h-16 w-16 rounded-3xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                      <MapPin size={32} strokeWidth={1.5} />
                    </div>
                    <div>
                      <h3 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-100 leading-none">Geospatial Residency</h3>
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] mt-3">Base Operational Coordinates</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                    <div className="md:col-span-3 space-y-4">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-2">Primary Axis (Address Line 1)</label>
                      <input
                        name="address1"
                        disabled={!isEditing}
                        value={formData.address1}
                        onChange={handleChange}
                        className="w-full px-8 py-5 rounded-[2rem] bg-zinc-50 dark:bg-zinc-800/50 border-2 border-transparent focus:border-amber-500/30 focus:bg-white dark:focus:bg-zinc-800 outline-none text-sm font-bold transition-all shadow-inner disabled:opacity-70"
                        placeholder="Street / Sector"
                      />
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-2">City Hub</label>
                      <input
                        name="city"
                        disabled={!isEditing}
                        value={formData.city}
                        onChange={handleChange}
                        className="w-full px-8 py-5 rounded-[2rem] bg-zinc-50 dark:bg-zinc-800/50 border-2 border-transparent focus:border-amber-500/30 focus:bg-white dark:focus:bg-zinc-800 outline-none text-sm font-bold transition-all shadow-inner disabled:opacity-70"
                        placeholder="District"
                      />
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-2">Regional State</label>
                      <input
                        name="state"
                        disabled={!isEditing}
                        value={formData.state}
                        onChange={handleChange}
                        className="w-full px-8 py-5 rounded-[2rem] bg-zinc-50 dark:bg-zinc-800/50 border-2 border-transparent focus:border-amber-500/30 focus:bg-white dark:focus:bg-zinc-800 outline-none text-sm font-bold transition-all shadow-inner disabled:opacity-70"
                        placeholder="Province"
                      />
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-2">Country Code</label>
                      <input
                        name="country"
                        disabled={!isEditing}
                        value={formData.country}
                        onChange={handleChange}
                        className="w-full px-8 py-5 rounded-[2rem] bg-zinc-50 dark:bg-zinc-800/50 border-2 border-transparent focus:border-amber-500/30 focus:bg-white dark:focus:bg-zinc-800 outline-none text-sm font-bold transition-all shadow-inner disabled:opacity-70"
                        placeholder="Sovereign"
                      />
                    </div>
                  </div>
                </div>

                {isEditing && (
                  <div className="mt-20 p-10 bg-zinc-900 rounded-[3rem] flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl shadow-zinc-900/40">
                    <div>
                      <h4 className="text-xl font-black text-white tracking-tight">Confirm Data Synchronization?</h4>
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-2">Protocol updates will propagate immediately</p>
                    </div>
                    <div className="flex gap-4 w-full md:w-auto">
                      <Button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="flex-1 md:flex-none !rounded-[1.5rem] px-10 py-6 font-black uppercase tracking-widest text-[10px] shadow-xl shadow-amber-500/20"
                      >
                        {loading ? <Loader2 className="animate-spin mr-3" /> : <Save className="mr-3" size={16} />}
                        Sync
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsEditing(false);
                          setPreviewImage(null);
                        }}
                        className="flex-1 md:flex-none !rounded-[1.5rem] px-10 py-6 font-black uppercase tracking-widest text-[10px] border-white/10 text-white hover:bg-white/5"
                      >
                        Abort
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </SlideIn>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
