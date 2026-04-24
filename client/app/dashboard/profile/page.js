'use client';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import {
  User as UserIcon, Mail, Phone, MapPin,
  Camera, Save, Loader2, Calendar, Award,
  Shield, Briefcase, Zap, Globe, ChevronDown,
  TrendingUp, Timer, ShoppingBag, Receipt,
  CheckCircle2, XCircle, AlertCircle, History,
  DollarSign, BarChart3, ChevronRight, Plus
} from 'lucide-react';
import { PageTransition, SlideIn, CardHover } from '../../components/ui/AnimatedContainer';
import { Button } from '../../components/ui/Button';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('identity'); // identity, stats, history, security

  // Personnel Data
  const [chefStats, setChefStats] = useState(null);
  const [salaryHistory, setSalaryHistory] = useState([]);
  const [attendance, setAttendance] = useState([]);

  const [previewImage, setPreviewImage] = useState(null);
  const fileInputRef = useRef(null);

  // Filters
  const [statsFilter, setStatsFilter] = useState({ startDate: '', endDate: '' });
  const [historyFilter, setHistoryFilter] = useState({ startDate: '', endDate: '' });

  const [formData, setFormData] = useState({
    name: '', phone: '', age: '', gender: 'Male',
    address1: '', city: '', state: '', country: ''
  });

  const fetchData = async () => {
    if (!user) return;
    try {
      if (user.role === 'chef' || user.role === 'staff') {
        const statsParams = {};
        if (statsFilter.startDate) statsParams.startDate = statsFilter.startDate;
        if (statsFilter.endDate) statsParams.endDate = statsFilter.endDate;

        const historyParams = {};
        if (historyFilter.startDate) historyParams.startDate = historyFilter.startDate;
        if (historyFilter.endDate) historyParams.endDate = historyFilter.endDate;

        const statsEndpoint = user.role === 'chef' ? '/orders/my-stats-chef' : '/orders/my-stats-staff';
        const [statsRes, salaryRes, attRes] = await Promise.all([
          api.get(statsEndpoint, { params: statsParams }),
          api.get('/salary/my-history'), // Salary is fixed 6 months for now
          api.get('/attendance/my', { params: historyParams })
        ]);
        setChefStats(statsRes.data.data);
        setSalaryHistory(salaryRes.data.data);
        setAttendance(attRes.data.data);
      }
    } catch (error) {
      console.error('Failed to load performance metrics');
    }
  };

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        phone: user.phone || '',
        age: user.age || '',
        gender: user.gender || 'Male',
        address1: user.address1 || '',
        city: user.city || '',
        state: user.state || '',
        country: user.country || ''
      });
      fetchData();
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) setPreviewImage(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setLoading(true);
    const loadToast = toast.loading('Synchronizing profile updates...');
    try {
      const data = new FormData();
      Object.keys(formData).forEach(key => data.append(key, formData[key]));
      if (fileInputRef.current?.files[0]) data.append('profileImage', fileInputRef.current.files[0]);

      const res = await api.put('/users/update-profile', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUser(prev => ({ ...prev, ...res.data.data }));
      setIsEditing(false);
      toast.success('Personnel Details updated', { id: loadToast });
    } catch (error) {
      toast.error('Update failed', { id: loadToast });
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  const tabs = [
    { id: 'identity', label: 'Identity Matrix', icon: UserIcon },
    ...(user.role === 'chef' || user.role === 'staff' ? [
      { id: 'stats', label: 'Operational Performance', icon: TrendingUp },
      { id: 'history', label: 'Service History', icon: History }
    ] : []),
    { id: 'security', label: 'Security Protocol', icon: Shield }
  ];

  return (
    <PageTransition>
      <div className="max-w-[1500px] mx-auto pb-20 space-y-10">
        {/* Cinematic Hero Section */}

        {activeTab === 'identity' &&
          <SlideIn direction="down">
            <div className="relative overflow-hidden rounded-[3.5rem] bg-white dark:bg-zinc-900 p-12 lg:p-20 text-zinc-900 dark:text-white shadow-2xl shadow-black/5 border border-zinc-100 dark:border-zinc-800">
              <div className="relative z-10 flex flex-col lg:flex-row justify-between items-center gap-10">
                <div className="flex flex-col md:flex-row items-center gap-8">
                  <div className="relative h-40 w-40 rounded-[3rem] bg-white/5 p-2 backdrop-blur-xl border border-white/10 overflow-hidden group">
                    <div className="h-full w-full rounded-[2.5rem] overflow-hidden bg-gray-100 shadow-2xl dark:bg-zinc-800 flex items-center justify-center">
                      {(previewImage || user.profileImageUrl) ? (
                        <img src={previewImage || user.profileImageUrl} className="h-full w-full object-cover" />
                      ) : (
                        <UserIcon size={64} className="text-amber-500 opacity-20 dark:opacity-20" />
                      )}
                    </div>
                    {isEditing && (
                      <button onClick={() => fileInputRef.current?.click()} className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                        <Camera className="text-white" />
                      </button>
                    )}
                    <input type="file" ref={fileInputRef} onChange={handleImageChange} className="hidden" accept="image/*" />
                  </div>
                  <div className="text-center md:text-left">
                    <span className="px-4 py-1.5 bg-amber-500/20 text-amber-500 text-[9px] font-black uppercase tracking-[0.4em] rounded-full border border-amber-500/30">
                      {user.role.replace('_', ' ')} Command
                    </span>
                    <h1 className="text-5xl lg:text-7xl font-black tracking-tighter mt-4 leading-none">{user.name}</h1>
                    <p className="text-zinc-500 dark:text-zinc-400 font-bold mt-4 tracking-tight flex items-center justify-center md:justify-start gap-2">
                      <Mail size={16} /> {user.email}
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  {isEditing ? (
                    <>
                      <Button onClick={handleSubmit} disabled={loading} className="!rounded-2xl px-8 py-6 font-black text-xs uppercase tracking-widest bg-amber-500 text-black">
                        {loading ? <Loader2 className="animate-spin" /> : 'Sync Matrix'}
                      </Button>
                      <Button onClick={() => setIsEditing(false)} variant="outline" className="!rounded-2xl px-8 py-6 font-black text-xs uppercase tracking-widest border-white/10 text-white">
                        Abort
                      </Button>
                    </>
                  ) : (
                    <Button onClick={() => setIsEditing(true)} className="!rounded-2xl px-8 py-6 font-black text-xs uppercase tracking-widest bg-zinc-100 dark:bg-zinc-800 text-amber-500 border border-zinc-200 dark:border-white/5 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all">
                      Edit Personnel Parameters
                    </Button>
                  )}
                </div>
              </div>

              {/* Decoration */}
              <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-amber-500/10 to-transparent" />
              <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-amber-500/10 rounded-full blur-[100px]" />
            </div>
          </SlideIn>
        }

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 p-1.5 bg-zinc-100 dark:bg-zinc-900 rounded-[2rem] w-fit mx-auto border border-zinc-200/50 dark:border-zinc-800/50 shadow-sm">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 px-8 py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-white dark:bg-zinc-800 text-amber-500 shadow-xl shadow-amber-500/10' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'}`}
            >
              <tab.icon size={16} /> {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content Matrix */}
        <AnimatePresence mode="wait">
          {activeTab === 'identity' && (
            <motion.div key="identity" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              <div className="lg:col-span-8 space-y-8">
                <div className="bg-white dark:bg-zinc-900 rounded-[3rem] p-10 lg:p-14 border border-zinc-100 dark:border-zinc-800 shadow-sm">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400 mb-10 flex items-center gap-3">
                    <Shield size={16} className="text-amber-500" /> Identity Matrix
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <IdentityField label="Full Name" name="name" value={formData.name} icon={UserIcon} isEditing={isEditing} onChange={handleChange} />
                    <IdentityField label="Contact Protocol" name="phone" value={formData.phone} icon={Phone} isEditing={isEditing} onChange={handleChange} />
                    <IdentityField label="Temporal Age" name="age" value={formData.age} icon={Calendar} isEditing={isEditing} onChange={handleChange} type="number" />
                    <IdentityField label="Regional Sector" name="city" value={formData.city} icon={MapPin} isEditing={isEditing} onChange={handleChange} />
                    <div className="md:col-span-2">
                      <IdentityField label="Geospatial Axis (Address)" name="address1" value={formData.address1} icon={Globe} isEditing={isEditing} onChange={handleChange} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-4 space-y-8">
                <CardHover>
                  <div className="bg-zinc-100 dark:bg-zinc-950 rounded-[3rem] p-10 text-zinc-900 dark:text-white shadow-xl border border-zinc-200 dark:border-zinc-800 relative overflow-hidden group">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500 mb-8 flex items-center gap-2">
                      <Briefcase size={14} /> Employment Node
                    </h3>
                    <div className="space-y-6 relative z-10">
                      <div>
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Designation</p>
                        <p className="text-2xl font-black text-zinc-900 dark:text-white mt-1 tracking-tight capitalize">{user.role === 'location_admin' || user.role === 'branch_admin' ? 'branch admin' : user.role.replace('_', ' ')}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Base Compensation</p>
                        <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 tracking-tight">₹{user.monthlySalary?.toLocaleString() || '0'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Primary Sector</p>
                        <p className="text-xl font-black text-zinc-700 dark:text-zinc-300 mt-1 tracking-tight">{user.assignedLocation?.name || 'Global HQ'}</p>
                      </div>
                    </div>
                    <div className="absolute -bottom-10 -right-10 opacity-5 group-hover:opacity-10 transition-opacity">
                      <Zap size={150} />
                    </div>
                  </div>
                </CardHover>
              </div>
            </motion.div>
          )}

          {activeTab === 'stats' && (
            <motion.div key="stats" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-10">
              {/* Performance Filter */}
              <div className="flex flex-col md:flex-row items-end gap-6 bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm">
                <div className="flex-1 space-y-3">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-4">Start Horizon</label>
                  <input
                    type="date"
                    value={statsFilter.startDate}
                    onChange={(e) => setStatsFilter(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-6 py-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-2 border-transparent focus:border-amber-500/20 outline-none text-xs font-bold transition-all"
                  />
                </div>
                <div className="flex-1 space-y-3">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-4">End Horizon</label>
                  <input
                    type="date"
                    value={statsFilter.endDate}
                    onChange={(e) => setStatsFilter(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-6 py-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-2 border-transparent focus:border-amber-500/20 outline-none text-xs font-bold transition-all"
                  />
                </div>
                <button
                  onClick={fetchData}
                  className="px-8 py-4 bg-amber-500 text-black rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all"
                >
                  Apply Filter
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard label="Total Handled" value={chefStats?.totalOrders} sub="Cumulative Volume" icon={ShoppingBag} color="amber" />
                {user.role === 'chef' ? (
                  <>
                    <MetricCard label="Avg Prep Efficiency" value={`${chefStats?.avgPrepTime || 0}m`} sub="ACCEPTED → READY" icon={Timer} color="blue" />
                    <MetricCard label="Fulfillment Quality" value={`${((chefStats?.totalOrders - chefStats?.rejectionsCount) / (chefStats?.totalOrders || 1) * 100).toFixed(0)}%`} sub="Approval Rating" icon={Award} color="emerald" />
                    <MetricCard label="System Rejections" value={chefStats?.rejectionsCount} sub="Corrective Actions" icon={XCircle} color="rose" />
                  </>
                ) : (
                  <>
                    <MetricCard label="Placed by Me" value={chefStats?.createdCount} sub="Frontline Initiation" icon={Plus} color="blue" />
                    <MetricCard label="Served by Me" value={chefStats?.servedCount} sub="Service Completion" icon={CheckCircle2} color="emerald" />
                    <MetricCard label="System Activity" value={Math.round((chefStats?.servedCount / (chefStats?.totalOrders || 1)) * 100)} sub="Fulfillment %" icon={Zap} color="rose" />
                  </>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Recent Activity */}
                <div className="glass-morphism rounded-[3rem] border border-zinc-100 dark:border-zinc-800 p-10">
                  <h3 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400 mb-8 flex items-center gap-3">
                    <History size={16} className="text-amber-500" /> Recent Culinary Dispatch
                  </h3>
                  <div className="space-y-4">
                    {chefStats?.recentOrders?.map((order, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 group hover:border-amber-500/30 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 font-black text-xs">
                            T{order.table?.tableNumber}
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{new Date(order.createdAt).toLocaleDateString()}</p>
                            <p className="text-xs font-bold text-zinc-800 dark:text-zinc-100 mt-0.5 line-clamp-1">{order.items.map(it => it.menuItem?.name).join(', ')}</p>
                          </div>
                        </div>
                        <div className={`text-[9px] font-black uppercase px-2 py-1 rounded-md ${order.status === 'SERVED' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                          {order.status}
                        </div>
                      </div>
                    ))}
                    {!chefStats?.recentOrders?.length && (
                      <div className="h-40 flex flex-col items-center justify-center opacity-30 italic text-xs font-bold">No orders processed in this sector.</div>
                    )}
                  </div>
                </div>

                {/* Performance Analytics (Placeholders for complex charts if needed) */}
                <div className="glass-morphism rounded-[3rem] border border-zinc-100 dark:border-zinc-800 p-10 flex flex-col items-center justify-center text-center space-y-6">
                  <div className="h-24 w-24 rounded-full border-4 border-amber-500/20 border-t-amber-500 flex items-center justify-center">
                    <TrendingUp className="text-amber-500" size={32} />
                  </div>
                  <div>
                    <h4 className="text-xl font-black tracking-tight">Performance Quotient</h4>
                    <p className="text-xs text-zinc-500 mt-2 max-w-xs mx-auto">Your preparation speed is <span className="text-amber-500 font-bold">12% faster</span> than the branch average this month.</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="text-center">
                      <p className="text-[9px] font-black uppercase text-zinc-400">Streak</p>
                      <p className="text-lg font-black">14 Days</p>
                    </div>
                    <div className="w-px h-10 bg-zinc-100 dark:bg-zinc-800" />
                    <div className="text-center">
                      <p className="text-[9px] font-black uppercase text-zinc-400">Peak</p>
                      <p className="text-lg font-black">7:00 PM</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div key="history" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-10">
              {/* History Filter */}
              <div className="flex flex-col md:flex-row items-end gap-6 bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm">
                <div className="flex-1 space-y-3">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-4">Start Date</label>
                  <input
                    type="date"
                    value={historyFilter.startDate}
                    onChange={(e) => setHistoryFilter(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-6 py-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-2 border-transparent focus:border-blue-500/20 outline-none text-xs font-bold transition-all"
                  />
                </div>
                <div className="flex-1 space-y-3">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-4">End Date</label>
                  <input
                    type="date"
                    value={historyFilter.endDate}
                    onChange={(e) => setHistoryFilter(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-6 py-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-2 border-transparent focus:border-blue-500/20 outline-none text-xs font-bold transition-all"
                  />
                </div>
                <button
                  onClick={fetchData}
                  className="px-8 py-4 bg-blue-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all"
                >
                  Apply Filter
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* Salary History */}
                <div className="lg:col-span-7 space-y-8">
                  <div className="bg-white dark:bg-zinc-900 rounded-[3rem] p-10 border border-zinc-100 dark:border-zinc-800 shadow-sm">
                    <h3 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400 mb-10 flex items-center gap-3">
                      <DollarSign size={16} className="text-emerald-500" /> Compensation Ledger
                    </h3>
                    <div className="space-y-4">
                      {salaryHistory.map((entry, i) => (
                        <div key={i} className="flex items-center justify-between p-6 bg-zinc-50 dark:bg-zinc-800/40 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 group hover:border-emerald-500/30 transition-all">
                          <div className="flex items-center gap-6">
                            <div className="h-12 w-12 rounded-2xl bg-zinc-900 dark:bg-zinc-950 flex items-center justify-center text-emerald-400 shadow-lg">
                              <Receipt size={20} />
                            </div>
                            <div>
                              <p className="text-lg font-black text-zinc-900 dark:text-zinc-100 tracking-tight">{new Date(entry.month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
                              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">{entry.payableDays} Effective Days</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-black text-emerald-500 tracking-tighter">₹{Math.round(entry.calculatedSalary).toLocaleString()}</p>
                            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 mt-1 flex items-center gap-1 justify-end">
                              Disbursed <CheckCircle2 size={10} className="text-emerald-500" />
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Attendance Snapshots */}
                <div className="lg:col-span-5 space-y-8">
                  <div className="bg-white dark:bg-zinc-900 rounded-[3rem] p-10 border border-zinc-100 dark:border-zinc-800 shadow-sm h-full">
                    <h3 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400 mb-10 flex items-center gap-3">
                      <Calendar size={16} className="text-blue-500" /> Attendance Matrix
                    </h3>
                    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                      {attendance.slice(0, 15).map((att, i) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/30 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                          <div className="flex items-center gap-4">
                            <div className={`h-2 w-2 rounded-full ${att.status === 'present' ? 'bg-emerald-500' : att.status === 'absent' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                            <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{new Date(att.date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                          </div>
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${att.status === 'present' ? 'text-emerald-500 bg-emerald-500/10' : 'text-rose-500 bg-rose-500/10'}`}>
                            {att.status}
                          </span>
                        </div>
                      ))}
                      {!attendance.length && (
                        <div className="h-60 flex flex-col items-center justify-center opacity-30 italic text-xs font-bold">No presence records available.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
          {activeTab === 'security' && (
            <motion.div key="security" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="max-w-2xl mx-auto">
              <div className="bg-white dark:bg-zinc-900 rounded-[3rem] p-10 lg:p-14 border border-zinc-100 dark:border-zinc-800 shadow-sm">
                <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-400 mb-10 flex items-center gap-3">
                  <Shield size={16} className="text-amber-500" /> Access Protocol
                </h3>

                <form className="space-y-8" onSubmit={async (e) => {
                  e.preventDefault();
                  const currentPassword = e.target.currentPassword.value;
                  const newPassword = e.target.newPassword.value;
                  const confirmPassword = e.target.confirmPassword.value;

                  if (newPassword !== confirmPassword) return toast.error('Parity failure: Passwords do not match');

                  const loadToast = toast.loading('Reconfiguring access credentials...');
                  try {
                    await api.put('/users/change-password', { currentPassword, newPassword });
                    toast.success('Access credentials updated', { id: loadToast });
                    e.target.reset();
                  } catch (err) {
                    toast.error(err.response?.data?.message || 'Protocol reconfiguration failed', { id: loadToast });
                  }
                }}>
                  <div className="space-y-6">
                    <IdentityField label="Current Passphrase" name="currentPassword" icon={Shield} isEditing={true} type="password" />
                    <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-4" />
                    <IdentityField label="New Passphrase" name="newPassword" icon={Zap} isEditing={true} type="password" />
                    <IdentityField label="Verify New Passphrase" name="confirmPassword" icon={CheckCircle2} isEditing={true} type="password" />
                  </div>

                  <div className="pt-6">
                    <Button type="submit" className="w-full h-16 !text-xs font-black uppercase tracking-widest bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black shadow-xl">
                      Authorize Reconfiguration
                    </Button>
                  </div>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}

function IdentityField({ label, name, value, icon: Icon, isEditing, onChange, type = 'text' }) {
  return (
    <div className="space-y-3">
      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] ml-4">{label}</label>
      <div className={`relative group transition-all duration-300 ${!isEditing ? 'opacity-70' : ''}`}>
        <Icon className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-amber-500 transition-colors" size={18} />
        <input
          name={name}
          type={type}
          disabled={!isEditing}
          value={value}
          onChange={onChange}
          className="w-full pl-16 pr-6 py-5 rounded-[2rem] bg-zinc-50 dark:bg-zinc-800/50 border-2 border-transparent focus:border-amber-500/30 focus:bg-white dark:focus:bg-zinc-800 outline-none text-xs font-bold transition-all shadow-inner placeholder:opacity-30"
          placeholder={`Input ${label}...`}
        />
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, icon: Icon, color }) {
  const colors = {
    amber: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    blue: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    rose: 'text-rose-500 bg-rose-500/10 border-rose-500/20'
  };

  return (
    <CardHover>
      <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm flex flex-col items-center text-center group">
        <div className={`h-14 w-14 rounded-2xl ${colors[color]} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500`}>
          <Icon size={24} />
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-2">{label}</p>
        <h4 className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tighter mb-2">{value || '0'}</h4>
        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{sub}</p>
      </div>
    </CardHover>
  );
}
