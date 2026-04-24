'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../services/api';
import { ShieldCheck, User, Mail, Lock, Phone, MapPin, Zap, ArrowRight, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Button } from '../components/ui/Button';

export default function SetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [image, setImage] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    aadharNumber: '',
    age: '25',
    gender: 'Male',
    address1: 'Primary HQ',
    city: 'System',
    state: 'Global',
    country: 'India',
    highestQualification: 'Post Graduate'
  });

  useEffect(() => {
    const checkSetupStatus = async () => {
      try {
        const res = await api.get('/auth/initial-setup-check');
        if (!res.data.data.isInitialSetup) {
          router.push('/login');
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('Setup status check failed:', error.message || error);
        setLoading(false);
      }
    };
    checkSetupStatus();
  }, [router]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleImageChange = (e) => {
    setImage(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!image) {
      toast.error('Identity scan (Aadhar) is required');
      return;
    }
    setSubmitting(true);
    const loadToast = toast.loading('Initializing primary Super Admin...');

    try {
      const data = new FormData();
      Object.keys(formData).forEach(key => data.append(key, formData[key]));
      data.append('aadharImage', image);
      data.append('role', 'super_admin');

      await api.post('/auth/register', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast.success('System initialized. Welcome, Super Admin.', { id: loadToast });
      router.push('/login');
    } catch (error) {
      const msg = error.response?.data?.message || error.message || 'Setup failure. Verify parameters.';
      toast.error(msg, { id: loadToast });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <Loader2 className="h-12 w-12 text-amber-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-amber-500/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-orange-600/10 rounded-full blur-[150px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl z-10"
      >
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black shadow-2xl shadow-amber-500/30 mb-8">
            <ShieldCheck size={40} strokeWidth={2.5} />
          </div>
          <h1 className="text-5xl font-black tracking-tight mb-3">System <span className="text-amber-500">Initialization</span></h1>
          <p className="text-zinc-500 dark:text-zinc-400 max-w-md text-lg">Establish the primary Super Admin identity to activate the CafeOS neural network.</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card !bg-white/60 dark:!bg-zinc-900/60 backdrop-blur-3xl border-zinc-200 dark:border-zinc-800/50 p-10 rounded-3xl shadow-2xl space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3 md:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500 ml-1">Identity Name</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                <input 
                  required
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full pl-12 pr-6 py-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-950/50 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-sm font-bold"
                  placeholder="Rahul Sharma"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500 ml-1">Core Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                <input 
                  required
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full pl-12 pr-6 py-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-950/50 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-sm font-bold"
                  placeholder="admin@cafeos.com"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500 ml-1">Secure Passphrase</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                <input 
                  required
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full pl-12 pr-6 py-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-950/50 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-sm font-bold"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500 ml-1">Communication Node</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                <input 
                  required
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full pl-12 pr-6 py-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-950/50 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-sm font-bold"
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500 ml-1">Aadhar Node ID</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                <input 
                  required
                  name="aadharNumber"
                  value={formData.aadharNumber}
                  onChange={handleChange}
                  maxLength={12}
                  className="w-full pl-12 pr-6 py-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-950/50 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-sm font-bold"
                  placeholder="12-digit UIDAI number"
                />
              </div>
            </div>

            <div className="md:col-span-2 space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500 ml-1">Identity Scan (Aadhar)</label>
              <div className="group relative flex flex-col items-center justify-center p-8 bg-zinc-100/50 dark:bg-zinc-950/50 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl hover:border-amber-500/50 transition-all cursor-pointer">
                <input type="file" required className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleImageChange} accept="image/*" />
                <Zap className="h-8 w-8 text-zinc-700 group-hover:text-amber-500 transition-colors mb-2" />
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest text-center">
                  {image ? <span className="text-amber-500">{image.name}</span> : 'Upload Identity Document (.jpg, .png)'}
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800/50">
            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-16 !text-lg !font-black uppercase tracking-[0.2em] shadow-2xl shadow-amber-500/20 group"
              variant="primary"
            >
              {submitting ? (
                <Loader2 className="animate-spin mr-2" />
              ) : (
                <>Activate Master Protocol <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" /></>
              )}
            </Button>
          </div>
        </form>

        <p className="mt-8 text-center text-[10px] font-bold text-zinc-500 uppercase tracking-[0.5em]">
          CafeOS Secure Initialization Interface &copy; 2026
        </p>
      </motion.div>
    </div>
  );
}
