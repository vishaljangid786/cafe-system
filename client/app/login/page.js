'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';
import { Coffee, Eye, EyeOff, ShieldCheck, Zap, AlertCircle, Terminal, Activity, Globe, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../components/ui/Button';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import api from '../services/api';

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

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-base)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-16 w-16 border-4 border-[var(--color-primary)]/10 border-t-[var(--color-primary)] rounded-full animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[var(--color-primary)]/50 animate-pulse">Loading System</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] flex flex-col lg:flex-row transition-colors duration-500">
      {/* Cinematic Visual Panel (Desktop Only) */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden bg-zinc-900">
        <motion.div
          initial={{ scale: 1.1, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="absolute inset-0 z-0"
        >
          <img
            src="/images/login_bg.png"
            alt="Cinematic Background"
            className="w-full h-full object-cover opacity-60 mix-blend-luminosity grayscale group-hover:grayscale-0 transition-all duration-1000"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-zinc-900/20 to-zinc-900 dark:to-[var(--color-bg-base)]" />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent opacity-80" />
        </motion.div>

        {/* Diagnostic Overlays */}
        <div className="relative z-10 w-full p-20 flex flex-col justify-between">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5, duration: 1 }}
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="h-14 w-14 rounded-2xl bg-[var(--color-primary)] flex items-center justify-center text-black shadow-2xl shadow-[var(--color-primary)]/30">
                <Coffee size={28} strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-4xl font-black tracking-tighter text-white leading-none">
                  Cafe<span className="text-[var(--color-primary)]">OS</span>
                </h1>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[var(--color-primary)]/60 mt-1 italic">Smart Cafe Management</p>
              </div>
            </div>
          </motion.div>

          <div className="space-y-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 1 }}
              className="max-w-md"
            >
              <h2 className="text-6xl font-black text-white tracking-tighter leading-[0.9]">
                Modern <br />
                <span className="text-[var(--color-primary)] italic">Cafe Management</span>
              </h2>
              <p className="text-zinc-400 font-medium mt-6 text-lg leading-relaxed border-l-2 border-[var(--color-primary)]/30 pl-6">
                Manage your cafe branches, staff, and orders all in one place. Please login to your account to continue.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="flex items-center gap-10"
            >
              {[
                { icon: Terminal, label: "System", value: "Online" },
                { icon: Activity, label: "Speed", value: "Fast" },
                { icon: Globe, label: "Network", value: "Connected" }
              ].map((item, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center gap-2 text-[var(--color-primary)]/50">
                    <item.icon size={12} />
                    <span className="text-[8px] font-black uppercase tracking-widest">{item.label}</span>
                  </div>
                  <p className="text-xs font-black text-zinc-100 uppercase tracking-tighter">{item.value}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>

      {/* Control Center Form Panel */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-20 relative bg-[var(--color-bg)]">
        <div className="absolute inset-0 lg:hidden opacity-20 pointer-events-none">
          <img
            src="/images/login_bg.png"
            className="w-full h-full object-cover blur-3xl"
            alt=""
          />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md relative z-10"
        >
          <div className="lg:hidden flex flex-col items-center mb-12">
            <div className="h-16 w-16 rounded-2xl bg-[var(--color-primary)] flex items-center justify-center text-black shadow-2xl shadow-[var(--color-primary)]/20 mb-4">
              <Coffee size={32} strokeWidth={2.5} />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-[var(--color-text-primary)]">Cafe<span className="text-[var(--color-primary)]">OS</span></h1>
          </div>

          <div className="space-y-1 text-center lg:text-left mb-10">
            <h2 className="text-3xl font-black text-[var(--color-text-primary)] tracking-tighter uppercase italic">Login</h2>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--color-text-muted)]">Please enter your details to log in to your account</p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <AnimatePresence mode="wait">
              {serverError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl flex items-center gap-3"
                >
                  <AlertCircle size={18} className="text-rose-500" />
                  <p className="text-xs text-rose-500 font-black uppercase tracking-widest">{serverError}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] ml-1">Email Address</label>
              <div className="relative group">
                <input
                  {...register('email')}
                  className={`block w-full px-5 py-4 rounded-2xl bg-[var(--color-surface)] border transition-all duration-300 outline-none text-sm font-bold text-[var(--color-text-primary)] ${errors.email
                    ? 'border-[var(--color-danger)] ring-4 ring-[var(--color-danger)]/10'
                    : 'border-[var(--color-border)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10'
                    }`}
                  placeholder="admin@cafeos.com"
                />
              </div>
              {errors.email && <p className="text-[9px] text-rose-500 font-black mt-2 ml-1 uppercase tracking-widest italic">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] ml-1">Password</label>
              <div className="relative group">
                <input
                  type={showPassword ? "text" : "password"}
                  {...register('password')}
                  className={`block w-full px-5 py-4 rounded-2xl bg-[var(--color-surface)] border transition-all duration-300 outline-none text-sm font-bold text-[var(--color-text-primary)] ${errors.password
                    ? 'border-[var(--color-danger)] ring-4 ring-[var(--color-danger)]/10'
                    : 'border-[var(--color-border)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10'
                    }`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <p className="text-[9px] text-[var(--color-danger)] font-black mt-2 ml-1 uppercase tracking-widest italic">{errors.password.message}</p>}
            </div>

            <Button
              type="submit"
              loading={isSubmitting}
              disabled={!isValid || isSubmitting}
              className="w-full h-16 !text-xs font-black uppercase tracking-[0.3em] !rounded-2xl shadow-xl shadow-[var(--color-primary)]/20 bg-[var(--color-primary)] text-[var(--color-bg-base)] hover:bg-[var(--color-primary-dark)] border-none transition-all duration-500"
              icon={Zap}
            >
              Login to Account
            </Button>
          </form>

          {/* Quick Links Grid */}
          <div className="mt-12 space-y-8">
            <div className="flex items-center gap-4">
              <div className="h-[1px] flex-1 bg-[var(--color-border)]" />
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--color-text-muted)]">Quick Login (Testing Only)</p>
              <div className="h-[1px] flex-1 bg-[var(--color-border)]" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-3">
              {[
                { label: 'Super', email: 'super@cafeos.com' },
                { label: 'Admin', email: 'admin@cafeos.com' },
                { label: 'Branch', email: 'branch1@cafeos.com' },
                { label: 'Chef', email: 'chef1@cafeos.com' },
                { label: 'Staff', email: 'staff1@cafeos.com' },
              ].map((testUser) => (
                <button
                  key={testUser.label}
                  type="button"
                  onClick={() => login(testUser.email, 'AdminAdmin')}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl border border-[var(--color-border)] hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-primary)]/[0.02] transition-all group"
                >
                  <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)] transition-colors">
                    {testUser.label}
                  </span>
                  <span className="text-[7px] font-bold text-[var(--color-text-muted)] mt-1 truncate max-w-full italic">
                    TEST-LOGIN
                  </span>
                </button>
              ))}
            </div>

            <div className="flex flex-col items-center gap-6 pt-4">
              <div className="flex items-center gap-2 px-3 py-1 bg-[var(--color-bg-soft)] border border-[var(--color-border)] rounded-full">
                <Lock size={10} className="text-[var(--color-primary)]" />
                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Secure Connection Active</span>
              </div>

            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
