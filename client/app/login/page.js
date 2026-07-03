'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';
import { Coffee, Eye, EyeOff, Zap, AlertCircle, Lock } from 'lucide-react';
import { sanitizeEmail } from '../utils/inputValidation';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../components/ui/Button';
import LoadingScreen from '../components/ui/LoadingScreen';
import QuickLogin from './QuickLogin';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address').min(1, 'Email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState('');
  const { login, user, loading } = useAuth();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
  });



  useEffect(() => {
    if (!loading && user) {
      if (user.role === 'super_admin' || user.role === 'admin') router.push('/dashboard/admin');
      else if (user.role === 'branch_admin' || user.role === 'location_admin') router.push('/dashboard/branch-admin');
      else if (user.role === 'chef') router.push('/dashboard/chef');
      else router.push('/dashboard/staff');
    }
  }, [user, loading, router]);

  const onSubmit = async (data) => {
    setServerError('');
    const res = await login(data.email, data.password);
    if (!res.success) {
      setServerError(res.message);
      toast.error(res.message || 'Login failed. Please check your details.');
    }
    // Success toast ("Welcome back, <name>") is shown by AuthContext — no duplicate here.
  };

  if (loading) {
    return <LoadingScreen message="Loading" />;
  }

  return (
    <div className="min-h-screen bg-(--color-bg-base) flex flex-col lg:flex-row transition-colors duration-300">
      {/* Brand Panel (Desktop Only) */}
      <div className="hidden lg:flex lg:w-[50%] relative overflow-hidden bg-primary">
        <img
          src="/images/login_bg.png"
          alt=""
          className="absolute inset-0 w-full h-full object-cover "
        />  
        <div className="absolute inset-0" />
        <div className="relative z-10 w-full p-16 flex flex-col justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-white/15 flex items-center justify-center text-white">
              <Coffee size={26} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight leading-none">CafeOS</h1>
              <p className="text-xs text-white/70 mt-1">Cafe Management</p>
            </div>
          </div>

          <div className="max-w-md">
            <h2 className="text-4xl font-bold tracking-tight leading-tight">
              Run your cafe, all in one place.
            </h2>
            <p className="text-white/80 mt-4 text-base leading-relaxed">
              Manage your branches, staff, and orders from a single, simple dashboard. Log in to continue.
            </p>
          </div>

          <div className="flex items-center gap-8 text-sm text-white/70">
            <span>Branches</span>
            <span>Staff</span>
            <span>Orders</span>
            <span>Reports</span>
          </div>
        </div>
      </div>

      {/* Form Panel */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-16 relative bg-(--color-bg)">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md relative z-10"
        >
          <div className="lg:hidden flex flex-col items-center mb-10">
            <div className="h-14 w-14 rounded-xl bg-primary flex items-center justify-center text-(--color-on-primary) mb-3">
              <Coffee size={28} strokeWidth={2.5} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-(--color-text-primary)">CafeOS</h1>
          </div>

          <div className="space-y-1 text-center lg:text-left mb-8">
            <h2 className="text-2xl font-bold text-(--color-text-primary)">Welcome back</h2>
            <p className="text-sm text-(--color-text-muted)">Enter your details to log in to your account.</p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
            <AnimatePresence mode="wait">
              {serverError && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="bg-[rgba(var(--color-danger-rgb),0.1)] border border-[rgba(var(--color-danger-rgb),0.2)] p-3 rounded-lg flex items-center gap-3"
                >
                  <AlertCircle size={18} className="text-danger shrink-0" />
                  <p className="text-sm text-danger font-medium">{serverError}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-1.5">
              <label className="label block ml-0.5">Email Address</label>
              <input
                {...register('email')}
                onChange={(e) => {
                  e.target.value = sanitizeEmail(e.target.value);
                  register('email').onChange(e);
                }}
                className={`input ${errors.email ? '!border-danger' : ''}`}
                placeholder="Enter your email"
              />
              {errors.email && <p className="text-xs text-danger font-medium mt-1 ml-0.5">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="label block ml-0.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  {...register('password')}
                  className={`input pr-11 ${errors.password ? '!border-danger' : ''}`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-(--color-text-muted) hover:text-primary transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-danger font-medium mt-1 ml-0.5">{errors.password.message}</p>}
            </div>

            <Button
              type="submit"
              loading={isSubmitting}
              disabled={!isValid || isSubmitting}
              className="w-full !py-3"
              icon={Zap}
            >
              Log In
            </Button>
          </form>

          <QuickLogin />

          <div className="mt-10 flex justify-center">
            <div className="flex items-center gap-2 px-3 py-1 bg-(--color-surface-soft) border border-(--color-border) rounded-full">
              <Lock size={11} className="text-primary" />
              <span className="text-xs text-(--color-text-muted)">Secure connection</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
