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
import LoadingScreen from '../components/ui/LoadingScreen';
import { useForm, Controller } from 'react-hook-form';
import PremiumSelect from '../components/ui/PremiumSelect';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().regex(/^[0-9]{10}$/, 'Phone number must be exactly 10 digits'),
  age: z.string().refine((val) => {
    const n = parseInt(val);
    return n >= 18 && n <= 99;
  }, 'Age must be between 18 and 99'),
  gender: z.string(),
  role: z.string(),
  assignedLocation: z.string().optional(),
  highestQualification: z.string(),
  monthlySalary: z.string().min(1, 'Salary details are required'),
  aadharNumber: z.string().length(12, 'Aadhar number must be 12 digits'),
  address1: z.string().min(1, 'Address Line 1 is required'),
  address2: z.string().min(1, 'Address Line 2 is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  country: z.string().min(1, 'Country is required'),
  pincode: z.string().length(6, 'Pincode must be 6 digits'),
  accessibleLocations: z.array(z.string()).optional(),
}).refine((data) => {
  if (['staff', 'branch_admin', 'chef'].includes(data.role) && !data.assignedLocation) return false;
  return true;
}, {
  message: "Please select a branch for this role",
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
  const [profileImagePreview, setProfileImagePreview] = useState(null);
  const [aadharImagePreview, setAadharImagePreview] = useState(null);
  const [locations, setLocations] = useState([]);
  const [activeStep, setActiveStep] = useState(1);

  // Manage object URLs for image previews so blobs are revoked on change/unmount
  useEffect(() => {
    if (!profileImage) {
      setProfileImagePreview(null);
      return;
    }
    const url = URL.createObjectURL(profileImage);
    setProfileImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [profileImage]);

  useEffect(() => {
    if (!image) {
      setAadharImagePreview(null);
      return;
    }
    const url = URL.createObjectURL(image);
    setAadharImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

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
      case 'super_admin': return [
        { value: 'admin', label: 'Main Admin' },
        { value: 'branch_admin', label: 'Branch Admin' },
        { value: 'staff', label: 'Staff Member' },
        { value: 'chef', label: 'Chef' }
      ];
      case 'admin': return [
        { value: 'branch_admin', label: 'Branch Admin' },
        { value: 'staff', label: 'Staff Member' },
        { value: 'chef', label: 'Chef' }
      ];
      case 'branch_admin': return [
        { value: 'staff', label: 'Staff Member' },
        { value: 'chef', label: 'Chef' }
      ];
      default: return [
        { value: 'staff', label: 'Staff Member' },
        { value: 'chef', label: 'Chef' }
      ];
    }
  };

  const nextStep = async () => {
    let fieldsToValidate = [];
    if (activeStep === 1) fieldsToValidate = ['name', 'email', 'age', 'gender', 'password'];
    else if (activeStep === 2) fieldsToValidate = ['phone', 'address1', 'address2', 'city', 'state', 'country', 'pincode'];
    else if (activeStep === 3) fieldsToValidate = ['role', 'assignedLocation', 'highestQualification', 'monthlySalary'];

    const isStepValid = await trigger(fieldsToValidate);
    if (isStepValid) setActiveStep(prev => prev + 1);
    else toast.error('Please fix the errors before continuing.');
  };

  const onSubmit = async (formData) => {
    const loadToast = toast.loading('Creating account...');
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
      toast.success('Account created successfully.', { id: loadToast });
      router.push('/login');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not create account. Please check your details.', { id: loadToast });
    }
  };

  const InputField = ({ label, name, type = "text", placeholder, error, ...props }) => (
    <div className="space-y-1.5">
      <label className="label block ml-0.5">{label}</label>
      <input
        {...register(name)}
        type={type}
        className={`input ${error ? '!border-[var(--color-danger)]' : ''}`}
        placeholder={placeholder}
        {...props}
      />
      {error && <p className="text-xs text-[var(--color-danger)] font-medium mt-1 ml-0.5">{error}</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] flex flex-col lg:flex-row transition-colors duration-300">
      {/* Brand Panel */}
      <div className="hidden lg:flex lg:w-[42%] relative overflow-hidden bg-[var(--color-primary)]">
        <img src="/images/signup_bg.png" className="absolute inset-0 w-full h-full object-cover opacity-20" alt="" />
        <div className="absolute inset-0 bg-[var(--color-primary)]/70" />

        <div className="relative z-10 w-full p-16 flex flex-col justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-white/15 flex items-center justify-center text-white">
              <UserPlus size={26} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight leading-none">CafeOS</h1>
              <p className="text-xs text-white/70 mt-1">New Account</p>
            </div>
          </div>

          <div className="space-y-10">
            <div className="max-w-md">
              <h2 className="text-4xl font-bold tracking-tight leading-tight">Create your account</h2>
              <p className="text-white/80 mt-4 text-base leading-relaxed">Set up your account to manage your cafe. Just follow the steps.</p>
            </div>

            <div className="space-y-3">
              {[
                { step: 1, label: "Basic Details" },
                { step: 2, label: "Address" },
                { step: 3, label: "Job Details" },
                { step: 4, label: "Documents" }
              ].map((s) => (
                <div key={s.step} className={`flex items-center gap-3 transition-opacity duration-300 ${activeStep >= s.step ? 'opacity-100' : 'opacity-50'}`}>
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-semibold border ${activeStep >= s.step ? 'bg-[var(--color-surface)] text-[var(--color-primary)] border-[var(--color-border)]' : 'border-[var(--color-border)] text-white/70'}`}>
                    {activeStep > s.step ? <CheckCircle2 size={15} /> : s.step}
                  </div>
                  <span className="text-sm font-medium text-white">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 lg:p-16 bg-[var(--color-bg)] relative overflow-y-auto custom-scrollbar">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="w-full max-w-xl relative z-10">
          {!isSetup && (
            <button onClick={() => activeStep > 1 ? setActiveStep(prev => prev - 1) : router.back()} className="mb-8 flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors text-sm font-medium group">
              <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" /> {activeStep > 1 ? 'Go Back' : 'Cancel'}
            </button>
          )}

          <div className="mb-8">
            <span className="text-sm font-medium text-[var(--color-primary)] mb-1 block">Step {activeStep} of 4</span>
            <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
              {activeStep === 1 ? 'Basic Details' : activeStep === 2 ? 'Address' : activeStep === 3 ? 'Job Details' : 'Documents'}
            </h2>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            <AnimatePresence mode="wait">
              {activeStep === 1 && (
                <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                  <div className="flex flex-col items-center mb-6 p-6 bg-[var(--color-primary-soft)] rounded-xl border border-[var(--color-border)] group relative overflow-hidden">
                    <label className="label mb-4">Profile Picture</label>
                    <div className="relative">
                      <div className="h-28 w-28 rounded-xl bg-[var(--color-surface)] border-2 border-dashed border-[var(--color-border)] flex items-center justify-center overflow-hidden transition-colors group-hover:border-[var(--color-primary)]">
                        {profileImagePreview ? <img src={profileImagePreview} alt="Preview" className="h-full w-full object-cover" /> : <UserIcon size={30} className="text-[var(--color-text-soft)]" />}
                        <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => setProfileImage(e.target.files[0])} accept="image/*" />
                      </div>
                      <div className="absolute -bottom-2 -right-2 h-9 w-9 rounded-lg bg-[var(--color-primary)] text-[var(--color-on-primary)] flex items-center justify-center"><UserPlus size={16} /></div>
                    </div>
                  </div>
                  <InputField label="Full Name" name="name" placeholder="Rahul Sharma" error={errors.name?.message} />
                  <InputField label="Email Address" name="email" type="email" placeholder="rahul@cafeos.com" error={errors.email?.message} />
                  <div className="grid grid-cols-2 gap-5">
                    <InputField label="Age" name="age" type="number" placeholder="24" error={errors.age?.message} onInput={(e) => { if (e.target.value.length > 2) e.target.value = e.target.value.slice(0, 2); }} />
                    <Controller name="gender" control={control} render={({ field }) => (
                      <div className="space-y-1.5">
                        <label className="label block ml-0.5">Gender</label>
                        <PremiumSelect value={field.value} onChange={field.onChange} options={[{ label: 'Male', value: 'Male' }, { label: 'Female', value: 'Female' }, { label: 'Other', value: 'Other' }]} />
                      </div>
                    )} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="label block ml-0.5">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        {...register('password')}
                        className={`input pr-11 ${errors.password ? '!border-[var(--color-danger)]' : ''}`}
                        placeholder="••••••••"
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors">
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {errors.password && <p className="text-xs text-[var(--color-danger)] font-medium mt-1 ml-0.5">{errors.password.message}</p>}
                  </div>
                </motion.div>
              )}

              {activeStep === 2 && (
                <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                  <InputField label="Phone Number" name="phone" placeholder="9876543210" error={errors.phone?.message} onInput={(e) => { if (e.target.value.length > 10) e.target.value = e.target.value.slice(0, 10); }} />
                  <InputField label="Address Line 1" name="address1" placeholder="Building/Flat No, Street Name" error={errors.address1?.message} />
                  <InputField label="Address Line 2" name="address2" placeholder="Locality, Landmark" error={errors.address2?.message} />
                  <div className="grid grid-cols-2 gap-6">
                    <InputField label="City" name="city" placeholder="Mumbai" error={errors.city?.message} />
                    <InputField label="State" name="state" placeholder="Maharashtra" error={errors.state?.message} />
                    <InputField label="Pincode" name="pincode" placeholder="400001" error={errors.pincode?.message} onInput={(e) => { if (e.target.value.length > 6) e.target.value = e.target.value.slice(0, 6); }} />
                    <InputField label="Country" name="country" placeholder="India" error={errors.country?.message} />
                  </div>
                </motion.div>
              )}

              {activeStep === 3 && (
                <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                  <Controller name="role" control={control} render={({ field }) => (
                    <div className="space-y-2">
                      <label className="label block ml-0.5">Your Role</label>
                      <PremiumSelect value={field.value} onChange={field.onChange} options={getAvailableRoles()} />
                    </div>
                  )} />
                  {!isSetup && (['staff', 'branch_admin', 'chef'].includes(selectedRole)) && (
                    <Controller name="assignedLocation" control={control} render={({ field }) => (
                      <div className="space-y-2">
                        <label className="label block ml-0.5">Select Branch</label>
                        <PremiumSelect value={field.value} onChange={field.onChange} options={locations.map(loc => ({ label: `${loc.city} - ${loc.name}`, value: loc._id }))} placeholder="Select Branch" />
                        {errors.assignedLocation && <p className="text-xs text-[var(--color-danger)] font-medium mt-1 ml-0.5">{errors.assignedLocation.message}</p>}
                      </div>
                    )} />
                  )}
                  {!isSetup && selectedRole === 'admin' && (
                    <Controller name="accessibleLocations" control={control} render={({ field }) => (
                      <div className="space-y-2">
                        <label className="label block ml-0.5">Branches This Admin Can Manage</label>
                        <PremiumSelect value={field.value} onChange={field.onChange} options={locations.map(loc => ({ label: `${loc.city} - ${loc.name}`, value: loc._id }))} multiple={true} placeholder="Select multiple branches" />
                      </div>
                    )} />
                  )}
                  <Controller name="highestQualification" control={control} render={({ field }) => (
                    <div className="space-y-2">
                      <label className="label block ml-0.5">Highest Qualification</label>
                      <PremiumSelect value={field.value} onChange={field.onChange} options={[{ label: '12th Pass', value: '12th Pass' }, { label: 'Diploma', value: 'Diploma' }, { label: 'Graduate', value: 'Graduate' }, { label: 'Post Graduate', value: 'Post Graduate' }]} />
                    </div>
                  )} />
                  <InputField label="Monthly Salary (₹)" name="monthlySalary" type="number" placeholder="28000" error={errors.monthlySalary?.message} />
                </motion.div>
              )}

              {activeStep === 4 && (
                <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                  <InputField label="Aadhar Number (12 Digits)" name="aadharNumber" placeholder="XXXX XXXX XXXX" error={errors.aadharNumber?.message} onInput={(e) => { if (e.target.value.length > 12) e.target.value = e.target.value.slice(0, 12); }} />
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)] ml-1">Upload Aadhar Image</label>
                    <div className="group relative flex flex-col items-center justify-center min-h-[240px] bg-[var(--color-surface)] border-2 border-dashed border-[var(--color-border)] rounded-xl hover:border-[var(--color-primary)] transition-colors cursor-pointer overflow-hidden">
                      <input type="file" className="absolute inset-0 z-10 opacity-0 cursor-pointer" onChange={(e) => setImage(e.target.files[0])} accept="image/*" />
                      {aadharImagePreview ? <img src={aadharImagePreview} alt="Aadhar" className="w-full h-full object-contain p-4" /> : <div className="flex flex-col items-center"><ImageIcon size={36} className="text-[var(--color-text-soft)] group-hover:text-[var(--color-primary)] transition-colors mb-3" /><p className="text-sm font-medium text-[var(--color-text-muted)]">Upload Aadhar Photo</p></div>}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex gap-4 pt-4">
              {activeStep < 4 ? (
                <Button type="button" onClick={nextStep} className="w-full !py-3" icon={ArrowRight}>Next Step</Button>
              ) : (
                <Button type="submit" loading={isSubmitting} disabled={!isValid || isSubmitting} className="w-full !py-3" icon={Zap}>Create Account</Button>
              )}
            </div>
          </form>

          <p className="mt-10 text-center text-xs text-[var(--color-text-muted)]">Cafe Management System &copy; 2026 CafeOS</p>
        </motion.div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<LoadingScreen message="Preparing signup" />}>
      <SignupContent />
    </Suspense>
  );
}
