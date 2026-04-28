'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../services/api';
import { ShieldCheck, User, Mail, Lock, Phone, MapPin, Zap, ArrowRight, Loader2, Coffee, Shield, Activity, Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
    pincode: '110001',
    highestQualification: 'Post Graduate',
    monthlySalary: '0'
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
    const loadToast = toast.loading('Creating admin account...');

    try {
      const data = new FormData();
      Object.keys(formData).forEach(key => data.append(key, formData[key]));
      data.append('aadharImage', image);
      data.append('role', 'super_admin');

      await api.post('/auth/register', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast.success('Setup complete. Welcome!', { id: loadToast });
      router.push('/login');
    } catch (error) {
      const msg = error.response?.data?.message || error.message || 'Setup failed. Please check your details.';
      toast.error(msg, { id: loadToast });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-16 w-16 text-amber-500 animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-500/50 animate-pulse">Loading Setup</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#050505] flex flex-col lg:flex-row transition-colors duration-500 overflow-hidden">
      {/* Cinematic Side Panel */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden bg-zinc-900">
        <motion.div initial={{ scale: 1.1, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 1.5 }} className="absolute inset-0 z-0">
          <img
            src="/images/setup_bg.png"
            className="w-full h-full object-cover opacity-60 mix-blend-luminosity grayscale"
            alt=""
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#050505]/20 to-[#050505]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent opacity-90" />
        </motion.div>

        <div className="relative z-10 w-full p-20 flex flex-col justify-between">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>
            <div className="flex items-center gap-4 mb-8">
              <div className="h-14 w-14 rounded-2xl bg-amber-500 flex items-center justify-center text-black shadow-2xl shadow-amber-500/30">
                <ShieldCheck size={32} strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-4xl font-black tracking-tighter text-white leading-none">Cafe<span className="text-amber-500">OS</span></h1>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-500/60 mt-1 italic">Initial Setup</p>
              </div>
            </div>
          </motion.div>

          <div className="space-y-12">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }} className="max-w-md">
              <h2 className="text-5xl font-black text-white tracking-tighter leading-[0.9]">Admin <br /><span className="text-amber-500 italic">Setup</span></h2>
              <p className="text-zinc-400 font-medium mt-6 text-lg leading-relaxed border-l-2 border-amber-500/30 pl-6">
                System is not set up yet. Please create the main administrator account to start using the system.
              </p>
            </motion.div>

            <div className="flex items-center gap-10">
              {[
                { icon: Terminal, label: "Mode", value: "Setup" },
                { icon: Shield, label: "Security", value: "High Level" },
                { icon: Activity, label: "Status", value: "Ready" }
              ].map((item, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center gap-2 text-amber-500/50">
                    <item.icon size={12} />
                    <span className="text-[8px] font-black uppercase tracking-widest">{item.label}</span>
                  </div>
                  <p className="text-xs font-black text-zinc-100 uppercase tracking-tighter">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Setup Form Panel */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-20 bg-zinc-50 dark:bg-[#050505] relative overflow-y-auto custom-scrollbar">
        <div className="absolute inset-0 lg:hidden opacity-10 pointer-events-none">
          <img
            src="/images/setup_bg.png"
            className="w-full h-full object-cover blur-3xl"
            alt=""
          />
        </div>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-xl relative z-10 py-10">
          <div className="mb-12 text-center lg:text-left">
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-500 mb-2 block">System Setup</span>
            <h2 className="text-4xl font-black text-zinc-900 dark:text-zinc-100 tracking-tighter uppercase italic">Admin Details</h2>
            <p className="text-sm text-zinc-500 font-medium mt-2">Enter your details to create the main admin account.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2 md:col-span-2">
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">Full Name</label>
                <div className="relative group">
                  <User className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-amber-500 transition-colors" size={18} />
                  <input
                    required
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full pl-14 pr-6 py-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 transition-all outline-none text-sm font-bold text-zinc-900 dark:text-zinc-100 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10"
                    placeholder="E.g. Alexander Pierce"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">Email Address</label>
                <div className="relative group">
                  <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-amber-500 transition-colors" size={18} />
                  <input
                    required
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full pl-14 pr-6 py-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 transition-all outline-none text-sm font-bold text-zinc-900 dark:text-zinc-100 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10"
                    placeholder="admin@cafeos.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">Password</label>
                <div className="relative group">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-amber-500 transition-colors" size={18} />
                  <input
                    required
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className="w-full pl-14 pr-6 py-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 transition-all outline-none text-sm font-bold text-zinc-900 dark:text-zinc-100 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">Phone Number</label>
                <div className="relative group">
                  <Phone className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-amber-500 transition-colors" size={18} />
                  <input
                    required
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full pl-14 pr-6 py-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 transition-all outline-none text-sm font-bold text-zinc-900 dark:text-zinc-100 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10"
                    placeholder="+91 XXXXX XXXXX"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">Aadhar Number</label>
                <div className="relative group">
                  <Shield className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-amber-500 transition-colors" size={18} />
                  <input
                    required
                    name="aadharNumber"
                    value={formData.aadharNumber}
                    onChange={handleChange}
                    maxLength={12}
                    className="w-full pl-14 pr-6 py-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 transition-all outline-none text-sm font-bold text-zinc-900 dark:text-zinc-100 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10"
                    placeholder="12-digit Number"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">Pincode</label>
                <div className="relative group">
                  <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-amber-500 transition-colors" size={18} />
                  <input
                    required
                    name="pincode"
                    value={formData.pincode}
                    onChange={handleChange}
                    maxLength={6}
                    className="w-full pl-14 pr-6 py-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 transition-all outline-none text-sm font-bold text-zinc-900 dark:text-zinc-100 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10"
                    placeholder="6-digit Pincode"
                  />
                </div>
              </div>

              <div className="md:col-span-2 space-y-3">
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">Upload Aadhar Image</label>
                <div className="group relative flex flex-col items-center justify-center min-h-[200px] bg-white dark:bg-zinc-900 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-[2rem] hover:border-amber-500 transition-all cursor-pointer overflow-hidden shadow-xl">
                  <input type="file" required className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={handleImageChange} accept="image/*" />
                  {image ? (
                    <div className="w-full h-full flex flex-col items-center p-4">
                      <img src={URL.createObjectURL(image)} alt="Scan" className="w-full h-32 object-contain" />
                      <p className="mt-2 text-[10px] font-black text-amber-500 uppercase tracking-widest">{image.name}</p>
                    </div>
                  ) : (
                    <>
                      <Zap className="h-10 w-10 text-zinc-700 group-hover:text-amber-500 transition-colors mb-4" />
                      <p className="text-xs font-black text-zinc-500 uppercase tracking-widest text-center">Upload Photo</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-6">
              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-16 !text-xs font-black uppercase tracking-[0.3em] !rounded-2xl bg-amber-500 text-black hover:bg-amber-600 border-none transition-all shadow-xl shadow-amber-500/20"
                icon={ShieldCheck}
              >
                {submitting ? <Loader2 className="animate-spin" /> : 'Finish Setup'}
              </Button>
            </div>
          </form>

          <p className="mt-12 text-center text-[10px] font-black text-zinc-500 uppercase tracking-[0.5em]">Cafe Management System &copy; 2026 CafeOS</p>
        </motion.div>
      </div>
    </div>
  );
}
