'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../services/api';
import {
  UserPlus, User, MapPin, Image as ImageIcon,
  ArrowLeft, Briefcase, GraduationCap, Eye,
  EyeOff, ShieldCheck, Zap, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

// Validation Schema
const signupSchema = z.object({
  name: z.string().min(2, 'Identification requires at least 2 characters'),
  email: z.string().email('Operational terminal email required'),
  password: z.string().min(6, 'Protocol requires at least 6 characters'),
  phone: z.string().regex(/^\+?[0-9]{10,12}$/, 'Invalid contact node ID'),
  age: z.string().refine((val) => parseInt(val) >= 18, 'Minimum operational age is 18'),
  gender: z.string(),
  role: z.string(),
  assignedLocation: z.string().optional(),
  highestQualification: z.string(),
  monthlySalary: z.string().optional(),
  aadharNumber: z.string().length(12, 'Aadhar Node ID must be 12 digits'),
});

export default function SignupPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [image, setImage] = useState(null);
  const [locations, setLocations] = useState([]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting, isValid },
  } = useForm({
    resolver: zodResolver(signupSchema),
    mode: 'onChange',
    defaultValues: {
      gender: 'Male',
      highestQualification: '12th Pass',
      role: 'staff'
    }
  });

  const selectedRole = watch('role');

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const res = await api.get('/locations');
        setLocations(res.data.data);
      } catch (error) { }
    };
    fetchLocations();
  }, []);

  const getAvailableRoles = () => {
    if (!currentUser) return [{ value: 'super_admin', label: 'Super Admin' }];
    switch (currentUser.role) {
      case 'super_admin':
        return [
          { value: 'admin', label: 'Main Admin' },
          { value: 'location_admin', label: 'Location Admin' },
          { value: 'staff', label: 'Staff Member' }
        ];
      case 'admin':
        return [
          { value: 'location_admin', label: 'Location Admin' },
          { value: 'staff', label: 'Staff Member' }
        ];
      case 'location_admin':
        return [{ value: 'staff', label: 'Staff Member' }];
      default:
        return [{ value: 'staff', label: 'Staff Member' }];
    }
  };

  const availableRoles = getAvailableRoles();

  const handleImageChange = (e) => {
    setImage(e.target.files[0]);
  };

  const onSubmit = async (formData) => {
    const loadToast = toast.loading('Initializing personnel profile...');
    const data = new FormData();
    Object.keys(formData).forEach(key => {
      if (formData[key]) data.append(key, formData[key]);
    });
    if (image) data.append('aadharImage', image);
    else {
      toast.error('Identity scan required', { id: loadToast });
      return;
    }

    try {
      await api.post('/auth/register', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Registration sequence complete.', { id: loadToast });
      router.push('/login');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Sequence failure. Verify data.', { id: loadToast });
    }
  };

  const InputWrapper = ({ label, error, children }) => (
    <div className="space-y-2">
      <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 ml-1">{label}</label>
      {children}
      {error && <p className="text-[10px] text-rose-400 font-bold mt-1 ml-1 uppercase tracking-wider">{error}</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 py-12 px-4 relative overflow-hidden transition-colors duration-300">
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-amber-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-600/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-4xl mx-auto relative z-10">
        <div className="flex flex-col items-center mb-12">
          <Link href="/login" className="mb-8 flex items-center gap-2 text-zinc-500 hover:text-amber-500 transition-colors text-xs font-bold uppercase tracking-widest">
            <ArrowLeft size={14} /> Back to Terminal
          </Link>
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black shadow-2xl shadow-amber-500/20 mb-6">
            <UserPlus size={32} strokeWidth={2.5} />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-zinc-900 dark:text-white mb-2">Network <span className="text-amber-500">Expansion</span></h1>
          <p className="text-sm text-zinc-400 font-medium text-center max-w-md">Initialize new personnel identity within the CafeOS secure matrix.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Section: Identity */}
          <div className="glass-card !bg-white/40 dark:!bg-zinc-900/40 backdrop-blur-2xl border-zinc-200 dark:border-zinc-800/50 p-8 rounded-2xl shadow-2xl">
            <div className="flex items-center gap-3 mb-8 pb-4 border-b border-zinc-200 dark:border-zinc-800/50">
              <User size={18} className="text-amber-500" />
              <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-600 dark:text-zinc-300">Identity Core</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InputWrapper label="Full Name" error={errors.name?.message}>
                <input {...register('name')} className="w-full px-5 py-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-zinc-900 dark:text-white outline-none transition-all text-sm font-medium" placeholder="Rahul Sharma" />
              </InputWrapper>
              <InputWrapper label="Primary Email" error={errors.email?.message}>
                <input {...register('email')} className="w-full px-5 py-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-zinc-900 dark:text-white outline-none transition-all text-sm font-medium" placeholder="rahul@cafeos.com" />
              </InputWrapper>
              <InputWrapper label="Age" error={errors.age?.message}>
                <input {...register('age')} type="number" className="w-full px-5 py-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-zinc-900 dark:text-white outline-none transition-all text-sm font-medium" placeholder="24" />
              </InputWrapper>
              <InputWrapper label="Gender">
                <select {...register('gender')} className="w-full px-5 py-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-zinc-900 dark:text-white outline-none text-sm font-medium appearance-none">
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </InputWrapper>
              <InputWrapper label="Key Passphrase" error={errors.password?.message}>
                <div className="relative">
                  <input {...register('password')} type={showPassword ? "text" : "password"} className="w-full px-5 py-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-zinc-900 dark:text-white outline-none transition-all text-sm font-medium" placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-amber-500 transition-colors">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </InputWrapper>
              <InputWrapper label="Contact Node" error={errors.phone?.message}>
                <input {...register('phone')} className="w-full px-5 py-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-zinc-900 dark:text-white outline-none transition-all text-sm font-medium" placeholder="+91 XXXXX XXXXX" />
              </InputWrapper>
            </div>
          </div>

          {/* Section: Assignment */}
          <div className="glass-card !bg-white/40 dark:!bg-zinc-900/40 backdrop-blur-2xl border-zinc-200 dark:border-zinc-800/50 p-8 rounded-2xl shadow-2xl">
            <div className="flex items-center gap-3 mb-8 pb-4 border-b border-zinc-200 dark:border-zinc-800/50">
              <Briefcase size={18} className="text-amber-500" />
              <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-600 dark:text-zinc-300">Assignment Specs</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InputWrapper label="Protocol Role">
                <select {...register('role')} className="w-full px-5 py-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-zinc-900 dark:text-white outline-none text-sm font-medium appearance-none">
                  {availableRoles.map(role => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
              </InputWrapper>
              <InputWrapper label="Target Hub" error={errors.assignedLocation?.message}>
                <select {...register('assignedLocation')} className="w-full px-5 py-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-zinc-900 dark:text-white outline-none text-sm font-medium appearance-none disabled:opacity-50">
                  <option value="">Select Location</option>
                  {locations.map(loc => (
                    <option key={loc._id} value={loc._id}>{loc.city} - {loc.name}</option>
                  ))}
                </select>
              </InputWrapper>
              <InputWrapper label="Qualification">
                <select {...register('highestQualification')} className="w-full px-5 py-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-zinc-900 dark:text-white outline-none text-sm font-medium appearance-none">
                  <option value="12th Pass">12th Pass</option>
                  <option value="Diploma">Diploma</option>
                  <option value="Graduate">Graduate</option>
                  <option value="Post Graduate">Post Graduate</option>
                </select>
              </InputWrapper>
              {(selectedRole === 'staff' || selectedRole === 'location_admin') && (
                <InputWrapper label="Compensation (₹)" error={errors.monthlySalary?.message}>
                  <input {...register('monthlySalary')} type="number" className="w-full px-5 py-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-zinc-900 dark:text-white outline-none text-sm font-medium" placeholder="28000" />
                </InputWrapper>
              )}
            </div>
          </div>

          {/* Section: Verification */}
          <div className="glass-card !bg-white/40 dark:!bg-zinc-900/40 backdrop-blur-2xl border-zinc-200 dark:border-zinc-800/50 p-8 rounded-2xl shadow-2xl">
            <div className="flex items-center gap-3 mb-8 pb-4 border-b border-zinc-200 dark:border-zinc-800/50">
              <GraduationCap size={18} className="text-amber-500" />
              <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-600 dark:text-zinc-300">Identity Verification</h2>
            </div>

            <div className="space-y-6">
              <InputWrapper label="Aadhar Node ID" error={errors.aadharNumber?.message}>
                <input {...register('aadharNumber')} className="w-full px-5 py-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-zinc-900 dark:text-white outline-none text-sm font-medium" placeholder="XXXX XXXX XXXX" />
              </InputWrapper>

              <InputWrapper label="Identity Scan (.jpg / .png)">
                <div className="group relative flex flex-col items-center justify-center p-10 bg-zinc-100/50 dark:bg-zinc-950/50 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl hover:border-amber-500/50 transition-all cursor-pointer">
                  <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleImageChange} accept="image/*" />
                  <ImageIcon className="h-10 w-10 text-zinc-700 group-hover:text-amber-500 transition-colors mb-4" />
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest text-center">
                    {image ? <span className="text-amber-500">{image.name}</span> : 'Upload Identity Document Scan'}
                  </p>
                </div>
              </InputWrapper>
            </div>
          </div>

          <div className="pt-6">
            <Button
              type="submit"
              loading={isSubmitting}
              disabled={!isValid || isSubmitting}
              className="w-full h-16 !text-base shadow-amber-500/20"
              variant="primary"
              icon={Zap}
            >
              Initiate Onboarding sequence
            </Button>
          </div>
        </form>

        <p className="mt-12 text-center text-[10px] font-bold text-zinc-600 uppercase tracking-[0.4em]">
          Secure Terminal &copy; 2026 CafeOS
        </p>
      </div>
    </div>
  );
}
