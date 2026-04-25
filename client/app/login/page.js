'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';
import { Coffee, Eye, EyeOff, ShieldCheck, Zap, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../components/ui/Button';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import api from '../services/api';

// Validation Schema
const loginSchema = z.object({
  email: z.string().email('Operational terminal email required').min(1, 'Email is required'),
  password: z.string().min(6, 'Protocol requires at least 6 characters'),
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
    const checkInitialSetup = async () => {
      try {
        const res = await api.get('/auth/initial-setup-check');
        if (res.data.success && res.data.data.isInitialSetup) {
          router.push('/setup');
          toast('System uninitialized. Redirecting to Master Setup...', { icon: '🛡️' });
        }
      } catch (error) {
        console.error('Setup check failed:', error.message || error);
      }
    };

    if (!loading && !user) {
      checkInitialSetup();
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!loading && user) {
      if (user.role === 'super_admin' || user.role === 'admin') router.push('/dashboard/admin');
      else if (user.role === 'branch_admin') router.push('/dashboard/branch-admin');
      else if (user.role === 'chef') router.push('/dashboard/chef');
      else router.push('/dashboard/staff');
    }
  }, [user, loading, router]);

  const onSubmit = async (data) => {
    setServerError('');
    const res = await login(data.email, data.password);
    if (res.success) {
      toast.success('Access Granted. Welcome back.');
    } else {
      setServerError(res.message);
      toast.error(res.message || 'Authentication protocol failure');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="h-12 w-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-300">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-600/10 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="flex flex-col items-center mb-10">
          <motion.div
            whileHover={{ scale: 1.05, rotate: 5 }}
            className="h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black shadow-2xl shadow-amber-500/20 mb-6"
          >
            <Coffee size={32} strokeWidth={2.5} />
          </motion.div>
          <h1 className="text-4xl font-black tracking-tight text-zinc-900 dark:text-white mb-2 text-center">
            Cafe<span className="text-amber-500">OS</span>
          </h1>
          <div className="flex items-center gap-2 px-3 py-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full">
            <ShieldCheck size={12} className="text-amber-500" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Secure Access Protocol</span>
          </div>
        </div>

        <div className="glass-card !bg-white/40 dark:!bg-zinc-900/40 backdrop-blur-2xl border-zinc-200 dark:border-zinc-800/50 p-8 md:p-10 rounded-2xl shadow-2xl">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <AnimatePresence mode="wait">
              {serverError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl flex items-center gap-3"
                >
                  <AlertCircle size={16} className="text-rose-500" />
                  <p className="text-xs text-rose-400 font-bold">{serverError}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 ml-1">Email Terminal</label>
              <input
                {...register('email')}
                className={`block w-full px-5 py-3.5 ${errors.email ? 'border-rose-500/50 ring-2 ring-rose-500/10' : ''}`}
                placeholder="admin@cafeos.com"
              />
              {errors.email && <p className="text-[10px] text-rose-400 font-bold mt-1 ml-1 uppercase tracking-wider">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 ml-1">Key Passphrase</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  {...register('password')}
                  className={`block w-full px-5 py-3.5 pr-12 ${errors.password ? 'border-rose-500/50 ring-2 ring-rose-500/10' : ''}`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-amber-500 transition-colors focus:outline-none"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <p className="text-[10px] text-rose-400 font-bold mt-1 ml-1 uppercase tracking-wider">{errors.password.message}</p>}
            </div>

            <div className="pt-4">
              <Button
                type="submit"
                loading={isSubmitting}
                disabled={!isValid || isSubmitting}
                className="w-full h-14 !text-base shadow-amber-500/20"
                variant="primary"
                icon={Zap}
              >
                Establish Connection
              </Button>
            </div>
          </form>

          <div className="mt-10 flex flex-col items-center gap-6">
            <div className="flex items-center gap-4 w-full">
              <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500">Quick Access</p>
              <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            </div>

            <div className="grid grid-cols-2 gap-3 w-full">
              {[
                { label: 'Super Admin', email: 'super@cafeos.com', color: 'amber' },
                { label: 'Admin', email: 'mangyawwas@gandhipath.com', color: 'blue' },
                { label: 'Branch Admin', email: 'mangyawas@branchadmin.com', color: 'orange' },
                { label: 'Chef', email: 'cheff@mangyawas.com', color: 'rose' },
                { label: 'Staff', email: 'staff@mangyawas.com', color: 'emerald' },
              ].map((testUser) => (
                <button
                  key={testUser.label}
                  type="button"
                  onClick={() => login(testUser.email, 'password123')}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-${testUser.color}-500/50 hover:bg-${testUser.color}-500/5 transition-all group`}
                >
                  <span className={`text-[9px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-${testUser.color}-500 transition-colors`}>
                    {testUser.label}
                  </span>
                  <span className="text-[8px] font-medium text-zinc-400 dark:text-zinc-600 truncate max-w-full">
                    {testUser.email.split('@')[0]}
                  </span>
                </button>
              ))}
            </div>

            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-600 mt-4">Authorized Access Only</p>
            <div className="h-px w-12 bg-zinc-200 dark:bg-zinc-800" />
            <button
              onClick={() => router.push('/signup')}
              className="text-xs font-bold text-zinc-500 hover:text-amber-500 transition-colors"
            >
              Need secondary clearance? <span className="text-amber-500 underline underline-offset-4">Register Branch</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
