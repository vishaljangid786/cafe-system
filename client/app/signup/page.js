'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '../services/api';
import {
  UserPlus, User as UserIcon, MapPin, Image as ImageIcon,
  ArrowLeft, Briefcase, GraduationCap, Eye,
  EyeOff, ShieldCheck, Zap, AlertCircle,
  User, Terminal, Activity, Globe, Lock, ArrowRight, CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { useForm, Controller } from 'react-hook-form';
import PremiumSelect from '../components/ui/PremiumSelect';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

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
  if ((data.role === 'staff' || data.role === 'branch_admin') && !data.assignedLocation) return false;
  return true;
}, {
  message: "Operational branch assignment required for this role",
  path: ["assignedLocation"],
});

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSetup = searchParams.get('setup') === 'true';
  const { user: currentUser } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [image, setImage] = useState(null);
  const [profileImage, setProfileImage] = useState(null);
  const [locations, setLocations] = useState([]);
  const [activeStep, setActiveStep] = useState(1);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    trigger,
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
      case 'super_admin': return [{ value: 'admin', label: 'Main Admin' }, { value: 'branch_admin', label: 'Branch Admin' }, { value: 'staff', label: 'Staff Member' }];
      case 'admin': return [{ value: 'branch_admin', label: 'Branch Admin' }, { value: 'staff', label: 'Staff Member' }];
      case 'branch_admin': return [{ value: 'staff', label: 'Staff Member' }];
      default: return [{ value: 'staff', label: 'Staff Member' }];
    }
  };

  const nextStep = async () => {
    let fieldsToValidate = [];
    if (activeStep === 1) fieldsToValidate = ['name', 'email', 'age', 'gender', 'password'];
    else if (activeStep === 2) fieldsToValidate = ['phone', 'address1', 'address2', 'city', 'state', 'country', 'pincode'];
    else if (activeStep === 3) fieldsToValidate = ['role', 'assignedLocation', 'highestQualification', 'monthlySalary'];

    const isStepValid = await trigger(fieldsToValidate);
    if (isStepValid) setActiveStep(prev => prev + 1);
    else toast.error('Resolve validation errors to proceed.');
  };

  const onSubmit = async (formData) => {
    const loadToast = toast.loading('Initializing personnel profile...');
    const data = new FormData();
    Object.keys(formData).forEach(key => {
      if (formData[key]) {
        if (Array.isArray(formData[key])) formData[key].forEach(val => data.append(key, val));
        else data.append(key, formData[key]);
      }
    });
    if (image) data.append('aadharImage', image);
    if (profileImage) data.append('profileImage', profileImage);

    try {
      await api.post('/auth/register', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Registration sequence complete.', { id: loadToast });
      router.push('/login');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Sequence failure. Verify data.', { id: loadToast });
    }
  };

  const InputField = ({ label, name, type = "text", placeholder, error, ...props }) => (
    <div className="space-y-2">
      <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">{label}</label>
      <input
        {...register(name)}
        type={type}
        className={`w-full px-5 py-4 rounded-2xl bg-white dark:bg-zinc-900 border transition-all outline-none text-sm font-bold text-zinc-900 dark:text-zinc-100 ${error ? 'border-rose-500 ring-4 ring-rose-500/10' : 'border-zinc-200 dark:border-zinc-800 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10'}`}
        placeholder={placeholder}
        {...props}
      />
      {error && <p className="text-[9px] text-rose-500 font-black mt-2 ml-1 uppercase tracking-widest italic">{error}</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-white dark:bg-[#050505] flex flex-col lg:flex-row transition-colors duration-500">
      {/* Cinematic Panel */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden bg-zinc-900">
        <motion.div initial={{ scale: 1.1, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 1.5 }} className="absolute inset-0 z-0">
          <img src="/images/signup_bg.png" className="w-full h-full object-cover opacity-50 mix-blend-luminosity grayscale" alt="" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#050505]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent opacity-80" />
        </motion.div>

        <div className="relative z-10 w-full p-20 flex flex-col justify-between">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>
            <div className="flex items-center gap-4 mb-8">
              <div className="h-14 w-14 rounded-2xl bg-amber-500 flex items-center justify-center text-black shadow-2xl shadow-amber-500/30">
                <UserPlus size={28} strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-4xl font-black tracking-tighter text-white leading-none">Cafe<span className="text-amber-500">OS</span></h1>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-500/60 mt-1 italic">Expansion Protocol</p>
              </div>
            </div>
          </motion.div>

          <div className="space-y-12">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }} className="max-w-md">
              <h2 className="text-5xl font-black text-white tracking-tighter leading-[0.9]">Personnel <br /><span className="text-amber-500 italic">Initialization</span></h2>
              <p className="text-zinc-400 font-medium mt-6 text-lg leading-relaxed border-l-2 border-amber-500/30 pl-6">Establish a new operational identity within the Global Matrix. Follow the sequenced onboarding protocol to activate access.</p>
            </motion.div>

            <div className="space-y-4">
              {[
                { step: 1, label: "Identity Core" },
                { step: 2, label: "Geographical Node" },
                { step: 3, label: "Protocol Assignment" },
                { step: 4, label: "Verification Scan" }
              ].map((s) => (
                <div key={s.step} className={`flex items-center gap-4 transition-all duration-500 ${activeStep >= s.step ? 'opacity-100 translate-x-2' : 'opacity-30'}`}>
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-[10px] font-black border ${activeStep >= s.step ? 'bg-amber-500 border-amber-500 text-black shadow-lg shadow-amber-500/20' : 'border-zinc-700 text-zinc-500'}`}>
                    {activeStep > s.step ? <CheckCircle2 size={14} /> : s.step}
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 lg:p-20 bg-zinc-50 dark:bg-[#050505] relative overflow-y-auto custom-scrollbar">
        <div className="absolute inset-0 lg:hidden opacity-10 pointer-events-none">
          <img
            src="/images/signup_bg.png"
            className="w-full h-full object-cover blur-3xl"
            alt=""
          />
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-xl relative z-10">
          {!isSetup && (
            <button onClick={() => activeStep > 1 ? setActiveStep(prev => prev - 1) : router.back()} className="mb-10 flex items-center gap-2 text-zinc-400 hover:text-amber-500 transition-colors text-[10px] font-black uppercase tracking-widest group">
              <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> {activeStep > 1 ? 'Previous Sequence' : 'Abort Protocol'}
            </button>
          )}

          <div className="mb-12">
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-500 mb-2 block">Sequence {activeStep}/4</span>
            <h2 className="text-4xl font-black text-zinc-900 dark:text-zinc-100 tracking-tighter uppercase italic">
              {activeStep === 1 ? 'Identity Initialization' : activeStep === 2 ? 'Geographical Node' : activeStep === 3 ? 'Operational Specs' : 'Verification Scan'}
            </h2>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            <AnimatePresence mode="wait">
              {activeStep === 1 && (
                <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                  <div className="flex flex-col items-center mb-8 p-8 bg-amber-500/5 rounded-3xl border border-amber-500/10 group relative overflow-hidden">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-6">Personnel Profile Matrix</label>
                    <div className="relative">
                      <div className="h-32 w-32 rounded-3xl bg-white dark:bg-zinc-900 border-2 border-dashed border-zinc-200 dark:border-zinc-800 flex items-center justify-center overflow-hidden transition-all group-hover:border-amber-500 shadow-xl">
                        {profileImage ? <img src={URL.createObjectURL(profileImage)} alt="Preview" className="h-full w-full object-cover" /> : <UserIcon size={32} className="text-zinc-700" />}
                        <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => setProfileImage(e.target.files[0])} accept="image/*" />
                      </div>
                      <div className="absolute -bottom-2 -right-2 h-10 w-10 rounded-xl bg-amber-500 text-black flex items-center justify-center shadow-lg"><UserPlus size={18} /></div>
                    </div>
                  </div>
                  <InputField label="Operational Name" name="name" placeholder="Rahul Sharma" error={errors.name?.message} />
                  <InputField label="Primary Terminal (Email)" name="email" type="email" placeholder="rahul@cafeos.com" error={errors.email?.message} />
                  <div className="grid grid-cols-2 gap-6">
                    <InputField label="Biological Age" name="age" type="number" placeholder="24" error={errors.age?.message} />
                    <Controller name="gender" control={control} render={({ field }) => (
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">Gender Identity</label>
                        <PremiumSelect value={field.value} onChange={field.onChange} options={[{ label: 'Male', value: 'Male' }, { label: 'Female', value: 'Female' }, { label: 'Other', value: 'Other' }]} />
                      </div>
                    )} />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">Key Passphrase</label>
                    <div className="relative group">
                      <input
                        type={showPassword ? "text" : "password"}
                        {...register('password')}
                        className={`w-full px-5 py-4 rounded-2xl bg-white dark:bg-zinc-900 border transition-all outline-none text-sm font-bold text-zinc-900 dark:text-zinc-100 ${errors.password ? 'border-rose-500 ring-4 ring-rose-500/10' : 'border-zinc-200 dark:border-zinc-800 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10'}`}
                        placeholder="••••••••"
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-amber-500 transition-colors">
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {errors.password && <p className="text-[9px] text-rose-500 font-black mt-2 ml-1 uppercase tracking-widest italic">{errors.password.message}</p>}
                  </div>
                </motion.div>
              )}

              {activeStep === 2 && (
                <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                  <InputField label="Communication Node (Phone)" name="phone" placeholder="+91 XXXXX XXXXX" error={errors.phone?.message} />
                  <InputField label="Base Sector (Address 1)" name="address1" placeholder="Building/Flat No, Street Name" error={errors.address1?.message} />
                  <InputField label="Sub-Sector (Address 2)" name="address2" placeholder="Locality, Landmark" error={errors.address2?.message} />
                  <div className="grid grid-cols-2 gap-6">
                    <InputField label="City" name="city" placeholder="Mumbai" error={errors.city?.message} />
                    <InputField label="State/Jurisdiction" name="state" placeholder="Maharashtra" error={errors.state?.message} />
                    <InputField label="Regional Index (Pincode)" name="pincode" placeholder="400001" error={errors.pincode?.message} />
                    <InputField label="Sovereign Node (Country)" name="country" placeholder="India" error={errors.country?.message} />
                  </div>
                </motion.div>
              )}

              {activeStep === 3 && (
                <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                  <Controller name="role" control={control} render={({ field }) => (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">Protocol Role</label>
                      <PremiumSelect value={field.value} onChange={field.onChange} options={getAvailableRoles()} />
                    </div>
                  )} />
                  {!isSetup && (selectedRole === 'staff' || selectedRole === 'branch_admin') && (
                    <Controller name="assignedLocation" control={control} render={({ field }) => (
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">Target Branch Node</label>
                        <PremiumSelect value={field.value} onChange={field.onChange} options={locations.map(loc => ({ label: `${loc.city} - ${loc.name}`, value: loc._id }))} placeholder="Select Branch" />
                        {errors.assignedLocation && <p className="text-[9px] text-rose-500 font-black mt-2 ml-1 uppercase tracking-widest italic">{errors.assignedLocation.message}</p>}
                      </div>
                    )} />
                  )}
                  <Controller name="highestQualification" control={control} render={({ field }) => (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">Intellectual Clearance</label>
                      <PremiumSelect value={field.value} onChange={field.onChange} options={[{ label: '12th Pass', value: '12th Pass' }, { label: 'Diploma', value: 'Diploma' }, { label: 'Graduate', value: 'Graduate' }, { label: 'Post Graduate', value: 'Post Graduate' }]} />
                    </div>
                  )} />
                  <InputField label="Compensation Deployment (₹)" name="monthlySalary" type="number" placeholder="28000" error={errors.monthlySalary?.message} />
                </motion.div>
              )}

              {activeStep === 4 && (
                <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                  <InputField label="Aadhar Node ID (12 Digits)" name="aadharNumber" placeholder="XXXX XXXX XXXX" error={errors.aadharNumber?.message} />
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">Identity Document Scan</label>
                    <div className="group relative flex flex-col items-center justify-center min-h-[250px] bg-white dark:bg-zinc-900 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl hover:border-amber-500 transition-all cursor-pointer overflow-hidden shadow-xl">
                      <input type="file" className="absolute inset-0 z-10 opacity-0 cursor-pointer" onChange={(e) => setImage(e.target.files[0])} accept="image/*" />
                      {image ? <img src={URL.createObjectURL(image)} alt="Aadhar" className="w-full h-full object-contain p-4" /> : <div className="flex flex-col items-center"><ImageIcon size={40} className="text-zinc-700 group-hover:text-amber-500 transition-colors mb-4" /><p className="text-xs font-black text-zinc-500 uppercase tracking-widest">Upload Identity Scan</p></div>}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex gap-4 pt-6">
              {activeStep < 4 ? (
                <Button type="button" onClick={nextStep} className="w-full h-16 !text-xs font-black uppercase tracking-[0.3em] !rounded-2xl bg-amber-500 text-black hover:bg-amber-600 border-none transition-all shadow-xl shadow-amber-500/20" icon={ArrowRight}>Advance Sequence</Button>
              ) : (
                <Button type="submit" loading={isSubmitting} disabled={!isValid || isSubmitting} className="w-full h-16 !text-xs font-black uppercase tracking-[0.3em] !rounded-2xl bg-amber-500 text-black hover:bg-amber-600 border-none transition-all shadow-xl shadow-amber-500/20" icon={Zap}>Initiate Uplink</Button>
              )}
            </div>
          </form>

          <p className="mt-12 text-center text-[10px] font-black text-zinc-500 uppercase tracking-[0.5em]">Authorized Network Expansion Protocol &copy; 2026 CafeOS</p>
        </motion.div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050505] flex items-center justify-center"><div className="h-16 w-16 border-4 border-amber-500/10 border-t-amber-500 rounded-full animate-spin" /></div>}>
      <SignupContent />
    </Suspense>
  );
}
