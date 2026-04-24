'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '../services/api';
import {
  UserPlus, User as UserIcon, MapPin, Image as ImageIcon,
  ArrowLeft, Briefcase, GraduationCap, Eye,
  EyeOff, ShieldCheck, Zap, AlertCircle,
  User
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
  monthlySalary: z.string().min(1, 'Compensation deployment required'),
  aadharNumber: z.string().length(12, 'Aadhar Node ID must be 12 digits'),
  address1: z.string().min(1, 'Address Line 1 is required'),
  address2: z.string().min(1, 'Address Line 2 is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  country: z.string().min(1, 'Country is required'),
  pincode: z.string().length(6, 'Pincode must be 6 digits'),
  accessibleLocations: z.array(z.string()).optional(),
}).refine((data) => {
  if ((data.role === 'staff' || data.role === 'branch_admin') && !data.assignedLocation) {
    return false;
  }
  return true;
}, {
  message: "Operational branch assignment required for this role",
  path: ["assignedLocation"],
});

const InputWrapper = ({ label, error, children }) => (
  <div className="space-y-2">
    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 ml-1">{label}</label>
    {children}
    {error && <p className="text-[10px] text-rose-400 font-bold mt-1 ml-1 uppercase tracking-wider">{error}</p>}
  </div>
);


function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSetup = searchParams.get('setup') === 'true';
  const { user: currentUser } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [image, setImage] = useState(null);
  const [profileImage, setProfileImage] = useState(null);
  const [locations, setLocations] = useState([]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting, isValid },
  } = useForm({
    resolver: zodResolver(signupSchema),
    mode: 'onTouched',
    defaultValues: {
      gender: 'Male',
      highestQualification: 'Post Graduate',
      role: isSetup ? 'super_admin' : 'staff',
      country: 'India'
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
    if (isSetup) return [{ value: 'super_admin', label: 'Super Admin' }];
    if (!currentUser) return [{ value: 'super_admin', label: 'Super Admin' }];
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
      if (formData[key]) {
        if (Array.isArray(formData[key])) {
          formData[key].forEach(val => data.append(key, val));
        } else {
          data.append(key, formData[key]);
        }
      }
    });
    if (image) data.append('aadharImage', image);
    if (profileImage) data.append('profileImage', profileImage);

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


  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 py-12 px-4 relative overflow-hidden transition-colors duration-300">
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-amber-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-600/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-4xl mx-auto relative z-10">
        <div className="flex flex-col items-center mb-12">
         
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black shadow-2xl shadow-amber-500/20 mb-6">
            <UserPlus size={32} strokeWidth={2.5} />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-zinc-900 dark:text-white mb-2">Network <span className="text-amber-500">Expansion</span></h1>
          <p className="text-sm text-zinc-400 font-medium text-center max-w-md">Initialize new personnel identity within the CafeOS secure matrix.</p>
        </div>
         {!isSetup && (
            <button 
              onClick={() => router.back()}
              className="mb-8 flex items-center gap-2 text-zinc-500 hover:text-amber-500 transition-colors text-xs font-bold uppercase tracking-widest"
            >
              <ArrowLeft size={14} />  Go Back</button>
          )}

        <form onSubmit={handleSubmit(onSubmit, (errs) => {
          if (Object.keys(errs).length > 0) {
            toast.error('Protocol violation: Please fill all fields accurately.');
          }
        })} className="space-y-8">
          {/* Section: Identity */}
          <div className="glass-card !bg-white/40 dark:!bg-zinc-900/40 backdrop-blur-2xl border-zinc-200 dark:border-zinc-800/50 p-8 rounded-2xl shadow-2xl">
            <div className="flex items-center gap-3 mb-8 pb-4 border-b border-zinc-200 dark:border-zinc-800/50">
              <User size={18} className="text-amber-500" />
              <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-600 dark:text-zinc-300">Identity Core</h2>
            </div>

            <div className="flex flex-col items-center mb-10 p-6 bg-amber-500/5 rounded-[2.5rem] border border-amber-500/10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <UserIcon size={100} />
              </div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-6 relative z-10">Personnel Profile Picture (Optional)</label>
              <div className="relative group/img z-10">
                <div className="h-32 w-32 rounded-[2.5rem] bg-white dark:bg-zinc-950 border-2 border-dashed border-zinc-200 dark:border-zinc-800 flex items-center justify-center overflow-hidden group-hover/img:border-amber-500/50 transition-all shadow-inner">
                  {profileImage ? (
                    <img src={URL.createObjectURL(profileImage)} alt="Profile Preview" className="h-full w-full object-cover" />
                  ) : (
                    <UserIcon size={32} className="text-zinc-400 group-hover/img:text-amber-500 transition-colors" />
                  )}
                  <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => setProfileImage(e.target.files[0])} accept="image/*" />
                </div>
                <div className="absolute -bottom-2 -right-2 h-10 w-10 rounded-2xl bg-amber-500 text-black flex items-center justify-center shadow-lg pointer-events-none group-hover/img:scale-110 transition-transform">
                  <UserPlus size={18} />
                </div>
              </div>
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
              <div className="md:col-span-2">
                <InputWrapper label="Address Line 1" error={errors.address1?.message}>
                  <input {...register('address1')} className="w-full px-5 py-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-zinc-900 dark:text-white outline-none transition-all text-sm font-medium" placeholder="Building/Flat No, Street Name" />
                </InputWrapper>
              </div>
              <div className="md:col-span-2">
                <InputWrapper label="Address Line 2" error={errors.address2?.message}>
                  <input {...register('address2')} className="w-full px-5 py-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-zinc-900 dark:text-white outline-none transition-all text-sm font-medium" placeholder="Locality, Landmark (Optional)" />
                </InputWrapper>
              </div>
              <InputWrapper label="City" error={errors.city?.message}>
                <input {...register('city')} className="w-full px-5 py-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-zinc-900 dark:text-white outline-none transition-all text-sm font-medium" placeholder="Mumbai" />
              </InputWrapper>
              <InputWrapper label="State" error={errors.state?.message}>
                <input {...register('state')} className="w-full px-5 py-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-zinc-900 dark:text-white outline-none transition-all text-sm font-medium" placeholder="Maharashtra" />
              </InputWrapper>
              <InputWrapper label="Country" error={errors.country?.message}>
                <input {...register('country')} className="w-full px-5 py-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-zinc-900 dark:text-white outline-none transition-all text-sm font-medium" placeholder="India" />
              </InputWrapper>
              <InputWrapper label="Pincode" error={errors.pincode?.message}>
                <input {...register('pincode')} className="w-full px-5 py-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-zinc-900 dark:text-white outline-none transition-all text-sm font-medium" placeholder="400001" />
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
              {!isSetup && (selectedRole === 'staff' || selectedRole === 'branch_admin') && (
                <InputWrapper label="Target Branch" error={errors.assignedLocation?.message}>
                  <select {...register('assignedLocation')} className="w-full px-5 py-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-zinc-900 dark:text-white outline-none text-sm font-medium appearance-none disabled:opacity-50">
                    <option value="">Select Branch</option>
                    {locations.map(loc => (
                      <option key={loc._id} value={loc._id}>{loc.city} - {loc.name}</option>
                    ))}
                  </select>
                </InputWrapper>
              )}

              {!isSetup && selectedRole === 'admin' && (
                <div className="md:col-span-2 space-y-3">
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-1">Accessible Jurisdictions (Multiple)</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {locations.map(loc => (
                      <label key={loc._id} className="flex items-center gap-3 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 cursor-pointer hover:border-amber-500/50 transition-all">
                        <input 
                          type="checkbox" 
                          value={loc._id}
                          className="w-4 h-4 rounded border-zinc-300 text-amber-500 focus:ring-amber-500 bg-transparent"
                          onChange={(e) => {
                            const current = watch('accessibleLocations') || [];
                            if (e.target.checked) {
                              setValue('accessibleLocations', [...current, loc._id]);
                            } else {
                              setValue('accessibleLocations', current.filter(id => id !== loc._id));
                            }
                          }}
                        />
                        <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-tight">{loc.name} <span className="text-zinc-400 font-medium">({loc.city})</span></span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <InputWrapper label="Qualification">
                <select {...register('highestQualification')} className="w-full px-5 py-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-zinc-900 dark:text-white outline-none text-sm font-medium appearance-none">
                  <option value="12th Pass">12th Pass</option>
                  <option value="Diploma">Diploma</option>
                  <option value="Graduate">Graduate</option>
                  <option value="Post Graduate">Post Graduate</option>
                </select>
              </InputWrapper>
              {(selectedRole === 'staff' || selectedRole === 'branch_admin' || selectedRole === 'admin') && (
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

              <InputWrapper label="Identity Scan (.jpg / .png) (Optional)">
                <div className="group relative flex flex-col items-center justify-center min-h-[200px] bg-zinc-100/50 dark:bg-zinc-950/50 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl hover:border-amber-500/50 transition-all cursor-pointer overflow-hidden">
                  <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={handleImageChange} accept="image/*" />
                  {image ? (
                    <div className="w-full h-full p-2 flex flex-col items-center">
                      <img src={URL.createObjectURL(image)} alt="Aadhar Preview" className="w-full h-48 object-contain rounded-xl shadow-lg" />
                      <div className="mt-3 px-4 py-1.5 bg-amber-500/10 rounded-full border border-amber-500/20">
                        <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">{image.name}</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <ImageIcon className="h-10 w-10 text-zinc-700 group-hover:text-amber-500 transition-colors mb-4" />
                      <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest text-center">Upload Identity Document Scan</p>
                    </>
                  )}
                </div>
              </InputWrapper>
            </div>
          </div>

          <div className="pt-6">
            <Button
              type="submit"
              loading={isSubmitting}
              disabled={isSubmitting}
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

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="h-12 w-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
      </div>
    }>
      <SignupContent />
    </Suspense>
  );
}
