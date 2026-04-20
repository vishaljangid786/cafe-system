'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../services/api';
import {
  UserPlus, User, MapPin, Image as ImageIcon,
  Loader2, ArrowLeft, Briefcase, GraduationCap, Eye,
  EyeClosed,
} from 'lucide-react';
import { PageTransition } from '../components/ui/AnimatedContainer';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import Link from 'next/link';


import { useAuth } from '../context/AuthContext';

export default function SignupPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [image, setImage] = useState(null);
  // Determine available roles based on current user's hierarchy
  const getAvailableRoles = () => {
    if (!currentUser) return [{ value: 'staff', label: 'Staff Member' }];

    switch (currentUser.role) {
      case 'super_admin':
        return [
          { value: 'admin', label: 'Main Admin' },
          { value: 'branch_admin', label: 'Branch Admin' },
          { value: 'staff', label: 'Staff Member' }
        ];
      case 'admin':
        return [
          { value: 'branch_admin', label: 'Branch Admin' },
          { value: 'staff', label: 'Staff Member' }
        ];
      case 'branch_admin':
        return [
          { value: 'staff', label: 'Staff Member' }
        ];
      default:
        return [{ value: 'staff', label: 'Staff Member' }];
    }
  };

  const availableRoles = getAvailableRoles();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    gender: 'Male',
    age: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    country: 'India',
    alternatePhone: '',
    role: availableRoles[0]?.value || 'staff',
    branchName: currentUser?.role === 'branch_admin' ? currentUser.branchName : '',
    aadharNumber: '',
    highestQualification: '12th Pass',
    monthlySalary: ''
  });

  useEffect(() => {
    if (currentUser?.role === 'branch_admin' && currentUser.branchName) {
      setFormData(prev => ({
        ...prev,
        branchName: currentUser.branchName,
        role: 'staff'
      }));
    }
  }, [currentUser]);

  const handleImageChange = (e) => {
    setImage(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const loadToast = toast.loading('Creating personnel profile...');

    const data = new FormData();
    Object.keys(formData).forEach(key => {
      if (formData[key] !== '') {
        data.append(key, formData[key]);
      }
    });
    if (image) data.append('aadharImage', image);

    try {
      await api.post('/auth/register', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Registration successful!', { id: loadToast });
      router.push('/login');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Registration failed. Check all fields.', { id: loadToast });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md px-4">

          <div className="flex items-center justify-center mb-6">

            <div className="h-20 w-20 bg-amber-500 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-amber-500/20 rotate-3 hover:rotate-0 transition-transform">
              <UserPlus className="text-zinc-900" size={36} strokeWidth={2.5} />
            </div>
          </div>
          <h2 className="text-center text-4xl font-black text-gray-900 dark:text-zinc-100 tracking-tight leading-none">
            Network <span className="text-amber-600">Expansion</span>
          </h2>
          <p className="mt-4 text-center text-sm font-medium text-gray-500 dark:text-zinc-500 max-w-[280px] mx-auto">
            Initialize a new secure identity within the Cafe Management System.
          </p>
        </div>


        <div className="mt-12 sm:mx-auto sm:w-full sm:max-w-4xl px-4 pb-20">
          <Link href="/login" className="flex cursor-pointer items-center text-amber-600 font-black text-[14px] uppercase tracking-widest mb-8 hover:opacity-80 transition-opacity">
            <ArrowLeft size={16} className="mr-2" /> Back to Dashboard
          </Link>
          <div className="bg-white dark:bg-zinc-900 py-12 px-8 sm:px-12 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] rounded-[4rem] border border-gray-100 dark:border-zinc-800 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-16 opacity-[0.03] -mr-10 -mt-10">
              <UserPlus size={300} />
            </div>

            <form className="space-y-12 relative z-10" onSubmit={handleSubmit}>
              {/* Section 1: Core Identity */}
              <div className="space-y-8">
                <div className="flex items-center space-x-3">
                  <div className="h-8 w-8 rounded-xl bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center text-amber-600">
                    <User size={16} strokeWidth={3} />
                  </div>
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">Core Identity</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Legal Full Name</label>
                    <input required type="text" className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none" placeholder="e.g. Rahul Sharma" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Age (Years)</label>
                    <input required type="number" min="18" className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none" placeholder="25" value={formData.age} onChange={e => setFormData({ ...formData, age: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Gender</label>
                    <select className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none appearance-none" value={formData.gender} onChange={e => setFormData({ ...formData, gender: e.target.value })}>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Primary Email</label>
                    <input required type="email" className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none" placeholder="rahul@example.com" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Access Password</label>
                    <div className="relative">
                      <input
                        required
                        type={showPassword ? "text" : "password"}
                        minLength="6"
                        className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none pr-12"
                        placeholder="Min 6 characters"
                        value={formData.password}
                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-amber-600 transition-colors focus:outline-none"
                      >
                        {showPassword ? <EyeClosed size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Contact & Location */}
              <div className="space-y-8">
                <div className="flex items-center space-x-3">
                  <div className="h-8 w-8 rounded-xl bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center text-amber-600">
                    <MapPin size={16} strokeWidth={3} />
                  </div>
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">Communication & Location</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Phone Number</label>
                    <input required type="tel" className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none" placeholder="+91 XXXXX XXXXX" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Alternate Contact (Optional)</label>
                    <input type="tel" className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none" placeholder="+91 XXXXX XXXXX" value={formData.alternatePhone} onChange={e => setFormData({ ...formData, alternatePhone: e.target.value })} />
                  </div>
                  <div className="lg:col-span-3">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Permanent Address Line 1</label>
                    <input required type="text" className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none" placeholder="House No, Building, Street" value={formData.address1} onChange={e => setFormData({ ...formData, address1: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">City</label>
                    <input required type="text" className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none" placeholder="Mumbai" value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">State / Province</label>
                    <input required type="text" className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none" placeholder="Maharashtra" value={formData.state} onChange={e => setFormData({ ...formData, state: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Country</label>
                    <input required type="text" className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none" placeholder="India" value={formData.country} onChange={e => setFormData({ ...formData, country: e.target.value })} />
                  </div>
                </div>
              </div>

              {/* Section 3: Professional Details */}
              <div className="space-y-8">
                <div className="flex items-center space-x-3">
                  <div className="h-8 w-8 rounded-xl bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center text-amber-600">
                    <Briefcase size={16} strokeWidth={3} />
                  </div>
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">Professional Assignment</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">System Role</label>
                    <select className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none appearance-none" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
                      {availableRoles.map(role => (
                        <option key={role.value} value={role.value}>{role.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Highest Qualification</label>
                    <select className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none appearance-none" value={formData.highestQualification} onChange={e => setFormData({ ...formData, highestQualification: e.target.value })}>
                      <option value="12th Pass">12th Pass</option>
                      <option value="Diploma">Diploma</option>
                      <option value="Graduate">Graduate</option>
                      <option value="Post Graduate">Post Graduate</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Branch Name</label>
                    <input
                      required={formData.role !== 'admin'}
                      type="text"
                      disabled={currentUser?.role === 'branch_admin'}
                      className={`w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none ${currentUser?.role === 'branch_admin' ? 'opacity-50 cursor-not-allowed' : ''}`}
                      placeholder="e.g. Bandra Branch"
                      value={formData.branchName}
                      onChange={e => setFormData({ ...formData, branchName: e.target.value })}
                    />
                  </div>
                  {formData.role === 'staff' && (
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Monthly Salary (₹)</label>
                      <input required type="number" className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none" placeholder="25000" value={formData.monthlySalary} onChange={e => setFormData({ ...formData, monthlySalary: e.target.value })} />
                    </div>
                  )}
                </div>
              </div>

              {/* Section 4: Identity Documents */}
              <div className="space-y-8">
                <div className="flex items-center space-x-3">
                  <div className="h-8 w-8 rounded-xl bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center text-amber-600">
                    <GraduationCap size={16} strokeWidth={3} />
                  </div>
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">Identity Verification</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-1">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Aadhar Number</label>
                    <input required type="text" className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 transition-all text-sm font-bold dark:text-zinc-100 outline-none" placeholder="XXXX XXXX XXXX" value={formData.aadharNumber} onChange={e => setFormData({ ...formData, aadharNumber: e.target.value })} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Aadhar Card Verification Image</label>
                    <div className="group relative flex flex-col items-center justify-center p-12 bg-gray-50 dark:bg-zinc-800/50 border-2 border-dashed border-gray-200 dark:border-zinc-700 rounded-[3rem] hover:border-amber-500 transition-all cursor-pointer">
                      <input required type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleImageChange} accept="image/*" />
                      <ImageIcon className="h-12 w-12 text-gray-400 dark:text-zinc-600 mb-4 group-hover:scale-110 transition-transform" />
                      <p className="text-[10px] font-black text-gray-600 dark:text-zinc-400 uppercase tracking-widest">
                        {image ? <span className="text-amber-600">{image.name}</span> : 'Select Identity Scan'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-12">
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  disabled={loading}
                  type="submit"
                  className="w-full py-6 rounded-[2.5rem] shadow-2xl text-xs font-black uppercase tracking-[0.3em] text-white bg-zinc-900 dark:bg-amber-600 hover:bg-black dark:hover:bg-amber-700 transition-all shadow-amber-600/20 flex items-center justify-center"
                >
                  {loading ? <Loader2 className="animate-spin mr-3" size={24} /> : 'Onboard Personnel'}
                </motion.button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
