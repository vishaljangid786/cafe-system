'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';
import { Coffee, Eye, EyeOff, Zap, AlertCircle, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../components/ui/Button';
import LoadingScreen from '../components/ui/LoadingScreen';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address').min(1, 'Email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const QUICK_LOGIN_PASSWORD = '123456'; 

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
    console.log('Submitting login form with data:', data);
    const res = await login(data.email, data.password);
    console.log('Login response:', res);
    if (res.success) {
      toast.success('Login successful. Welcome back.');
    } else {
      setServerError(res.message);
      toast.error(res.message || 'Login failed. Please check your details.');
    }
  };

  const handleQuickLogin = async (email) => {
    setServerError('');
    const res = await login(email, QUICK_LOGIN_PASSWORD);

    if (!res.success) {
      const message = res.message || 'Quick login failed. Please try again.';
      setServerError(message);
      toast.error(message);
    }
  };

  if (loading) {
    return <LoadingScreen message="Loading" />;
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] flex flex-col lg:flex-row transition-colors duration-300">
      {/* Brand Panel (Desktop Only) */}
      <div className="hidden lg:flex lg:w-[50%] relative overflow-hidden bg-[var(--color-primary)]">
        <img
          src="/images/login_bg.png"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-[var(--color-primary)]/70" />

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
      <div className="flex-1 flex items-center justify-center p-8 lg:p-16 relative bg-[var(--color-bg)]">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md relative z-10"
        >
          <div className="lg:hidden flex flex-col items-center mb-10">
            <div className="h-14 w-14 rounded-xl bg-[var(--color-primary)] flex items-center justify-center text-[var(--color-on-primary)] mb-3">
              <Coffee size={28} strokeWidth={2.5} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">CafeOS</h1>
          </div>

          <div className="space-y-1 text-center lg:text-left mb-8">
            <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">Welcome back</h2>
            <p className="text-sm text-[var(--color-text-muted)]">Enter your details to log in to your account.</p>
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
                  <AlertCircle size={18} className="text-[var(--color-danger)] shrink-0" />
                  <p className="text-sm text-[var(--color-danger)] font-medium">{serverError}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-1.5">
              <label className="label block ml-0.5">Email Address</label>
              <input
                {...register('email')}
                className={`input ${errors.email ? '!border-[var(--color-danger)]' : ''}`}
                placeholder="admin@cafeos.com"
              />
              {errors.email && <p className="text-xs text-[var(--color-danger)] font-medium mt-1 ml-0.5">{errors.email.message}</p>}
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
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-[var(--color-danger)] font-medium mt-1 ml-0.5">{errors.password.message}</p>}
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

          {/* Quick Login (Testing) */}
          <div className="mt-10 space-y-5">
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-[var(--color-border)]" />
              <p className="text-xs font-medium text-[var(--color-text-muted)]">Quick Login (Testing Only)</p>
              <div className="h-px flex-1 bg-[var(--color-border)]" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-2.5">
              {[
                { label: 'Super', email: 'superadmin@cafe.com' },
                { label: 'Admin', email: 'admin@cafeos.com' },
                { label: 'Branch', email: 'branch1@cafeos.com' },
                { label: 'Chef', email: 'chef1@cafeos.com' },
                { label: 'Staff', email: 'staff1@cafeos.com' },
              ].map((testUser) => (
                <button
                  key={testUser.label}
                  type="button"
                  onClick={() => handleQuickLogin(testUser.email)}
                  className="flex flex-col items-center justify-center p-3 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] transition-colors group"
                >
                  <span className="text-sm font-medium text-[var(--color-text-secondary)] group-hover:text-[var(--color-primary)] transition-colors">
                    {testUser.label}
                  </span>
                  <span className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                    pass: {QUICK_LOGIN_PASSWORD}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex justify-center pt-2">
              <div className="flex items-center gap-2 px-3 py-1 bg-[var(--color-surface-soft)] border border-[var(--color-border)] rounded-full">
                <Lock size={11} className="text-[var(--color-primary)]" />
                <span className="text-xs text-[var(--color-text-muted)]">Secure connection</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
