'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';
import { Coffee, Eye, EyeOff, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageTransition, SlideIn } from '../components/ui/AnimatedContainer';
import { motion } from 'framer-motion';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false)
  
  const { login, user, loading } = useAuth();
  const router = useRouter();

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      if (user.role === 'super_admin' || user.role === 'admin') router.push('/dashboard/admin');
      else if (user.role === 'branch_admin') router.push('/dashboard/branch-admin');
      else router.push('/dashboard/staff');
    }
  }, [user, loading, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const res = await login(email, password);
    if (res.success) {
      toast.success('Login successful! Redirecting...');
    } else {
      setError(res.message);
      toast.error(res.message || 'Login failed');
    }
    setIsLoading(false);
  };

  if (loading) return null; // Prevent flicker

  return (
    <PageTransition>
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 transition-colors duration-500 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <SlideIn direction="down">
          <div className="sm:mx-auto sm:w-full sm:max-w-md">
            <motion.div 
              initial={{ rotate: -20, scale: 0.8 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="flex justify-center text-amber-600"
            >
              <Coffee size={64} strokeWidth={2.5} />
            </motion.div>
            <h2 className="mt-6 text-center text-3xl font-black text-gray-900 dark:text-zinc-100 tracking-tight">
              Welcome <span className="text-amber-600">Back</span>
            </h2>
            <p className="mt-2 text-center text-sm text-gray-500 dark:text-zinc-500 font-medium">
              Enterprise Cafe Management System
            </p>
          </div>
        </SlideIn>

        <SlideIn delay={0.2}>
          <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
            <div className="bg-white dark:bg-zinc-900 py-10 px-8 shadow-2xl shadow-amber-600/5 rounded-3xl border border-gray-100 dark:border-zinc-800">
              <form className="space-y-6" onSubmit={handleSubmit}>
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-red-50 dark:bg-red-500/10 border-l-4 border-red-500 p-4 rounded-r-xl"
                  >
                    <p className="text-sm text-red-700 dark:text-red-400 font-bold">{error}</p>
                  </motion.div>
                )}
                
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-500 dark:text-zinc-500 mb-2">Email address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                    placeholder="admin@cafe.com"
                  />
                </div>

                <div className="relative">
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-500 dark:text-zinc-500 mb-2">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500 outline-none transition-all pr-12"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-amber-600 transition-colors focus:outline-none"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex justify-center py-4 px-4 rounded-xl shadow-lg shadow-amber-600/20 text-sm font-black uppercase tracking-widest text-white bg-amber-600 hover:bg-amber-700 focus:outline-none transition-all disabled:bg-amber-400"
                  >
                    {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Secure Sign In'}
                  </button>
                </motion.div>
              </form>

              <div className="mt-8 pt-8 border-t border-gray-50 dark:border-zinc-800 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-zinc-600">
                  Authorized Personnel Only
                </p>
              </div>
            </div>
          </div>
        </SlideIn>
      </div>
    </PageTransition>
  );
}
