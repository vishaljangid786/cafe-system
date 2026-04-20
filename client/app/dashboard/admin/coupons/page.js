'use client';
import { 
  Tag, Ticket, Plus, Search, Calendar, 
  Users, Trash2, Edit2, CheckCircle2, 
  XCircle, Clock, IndianRupee, Copy,
  Percent, Hash, Info, Save, X, Activity
} from 'lucide-react';
import { PageTransition, SlideIn, CardHover } from '../../../components/ui/AnimatedContainer';
import Modal from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Card, CardTitle, CardDescription } from '../../../components/ui/Card';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useEffect, useState } from 'react';
import api from '../../../services/api';

export default function CouponsPage() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/coupons');
      setCoupons(res.data.data);
    } catch (error) {
      toast.error('Failed to sync offer hub');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    // Convert numbers
    data.discountValue = parseFloat(data.discountValue);
    data.maxDiscount = data.maxDiscount ? parseFloat(data.maxDiscount) : null;
    data.minOrderAmount = parseFloat(data.minOrderAmount || 0);
    data.usageLimit = data.usageLimit ? parseInt(data.usageLimit) : null;
    data.isActive = formData.get('isActive') === 'on';

    const loadToast = toast.loading(editingCoupon ? 'Reconfiguring offer...' : 'Deploying offer code...');
    try {
      if (editingCoupon) {
        await api.put(`/coupons/${editingCoupon._id}`, data);
        toast.success('Offer synchronized', { id: loadToast });
      } else {
        await api.post('/coupons', data);
        toast.success('Offer code broadcasted', { id: loadToast });
      }
      setShowModal(false);
      setEditingCoupon(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Broadcast failure', { id: loadToast });
    }
  };

  const deleteCoupon = async (id) => {
    if (!confirm('Deactivate this offer code permanently?')) return;
    const loadToast = toast.loading('Revoking offer...');
    try {
      await api.delete(`/coupons/${id}`);
      toast.success('Offer revoked', { id: loadToast });
      fetchData();
    } catch (error) {
      toast.error('Revocation failure', { id: loadToast });
    }
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    toast.success(`Copied: ${code}`);
  };

  const filteredCoupons = coupons.filter(c => 
    c.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && coupons.length === 0) return (
    <div className="flex justify-center items-center h-96">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
    </div>
  );

  return (
    <PageTransition>
      <div className="space-y-8 pb-20">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-4xl font-black tracking-tighter flex items-center gap-4">
              <Tag className="text-accent" size={36} strokeWidth={2.5} />
              Offers <span className="text-accent">Hub</span>
            </h1>
            <p className="text-muted-foreground font-medium mt-1">Manage fiscal incentives and operational coupons.</p>
          </div>
          <Button variant="primary" icon={Plus} onClick={() => setShowModal(true)}>Establish Offer</Button>
        </div>

        <SlideIn direction="down">
          <div className="bg-card p-6 rounded-3xl border border-border flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
              <input 
                type="text" 
                placeholder="Query offer codes..." 
                className="w-full pl-12 pr-4 py-3 bg-muted/50 border border-border rounded-2xl focus:ring-2 focus:ring-accent outline-none transition-all font-bold text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-3 bg-muted/30 px-4 py-2 rounded-2xl border border-border">
                <Activity size={16} className="text-accent" />
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Active Hubs: {coupons.filter(c => c.isActive).length}</span>
            </div>
          </div>
        </SlideIn>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredCoupons.map((coupon, i) => {
              const isExpired = new Date(coupon.expiryDate) < new Date();
              const isLimitReached = coupon.usageLimit && coupon.usedCount >= coupon.usageLimit;
              const status = !coupon.isActive ? 'Inactive' : isExpired ? 'Expired' : isLimitReached ? 'Maxed' : 'Active';
              const statusColor = status === 'Active' ? 'text-green-500' : 'text-red-500';
              const statusBg = status === 'Active' ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20';

              return (
                <SlideIn key={coupon._id} delay={i * 0.05}>
                  <CardHover>
                    <Card className={`relative overflow-hidden border border-border group ${(!coupon.isActive || isExpired) && 'opacity-60'}`}>
                      {/* Status Badge */}
                      <div className="absolute top-6 right-6">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${statusBg} ${statusColor}`}>
                          {status}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 mb-8">
                        <div className="h-16 w-16 rounded-[1.5rem] bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                          {coupon.discountType === 'percentage' ? <Percent size={28} /> : <IndianRupee size={28} />}
                        </div>
                        <div>
                          <h3 className="text-2xl font-black tracking-tight">{coupon.code}</h3>
                          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                             <Copy size={12} className="cursor-pointer hover:text-accent transition-colors" onClick={() => copyCode(coupon.code)} />
                             Code Signature
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="bg-muted/50 p-4 rounded-2xl border border-border">
                          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Value</p>
                          <p className="text-lg font-black text-foreground">
                            {coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : `₹${coupon.discountValue}`}
                          </p>
                        </div>
                        <div className="bg-muted/50 p-4 rounded-2xl border border-border">
                          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Usage</p>
                          <p className="text-lg font-black text-foreground">
                            {coupon.usedCount} <span className="text-xs text-muted-foreground">/ {coupon.usageLimit || '∞'}</span>
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
                          <span className="flex items-center gap-2"><Calendar size={14} className="text-accent" /> Expiry</span>
                          <span className="text-foreground">{new Date(coupon.expiryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
                          <span className="flex items-center gap-2"><IndianRupee size={14} className="text-accent" /> Min Order</span>
                          <span className="text-foreground">₹{coupon.minOrderAmount}</span>
                        </div>
                      </div>

                      <div className="mt-8 pt-6 border-t border-border flex justify-between items-center">
                        <div className="h-2 flex-1 bg-muted rounded-full overflow-hidden mr-6">
                           <motion.div 
                             initial={{ width: 0 }}
                             animate={{ width: coupon.usageLimit ? `${(coupon.usedCount / coupon.usageLimit) * 100}%` : '100%' }}
                             className={`h-full ${status === 'Active' ? 'bg-accent' : 'bg-muted-foreground'}`}
                           />
                        </div>
                        <div className="flex gap-2">
                           <button 
                             onClick={() => { setEditingCoupon(coupon); setShowModal(true); }}
                             className="p-2.5 rounded-xl bg-muted hover:bg-zinc-800 text-muted-foreground hover:text-accent transition-all"
                           >
                             <Edit2 size={16} />
                           </button>
                           <button 
                             onClick={() => deleteCoupon(coupon._id)}
                             className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition-all"
                           >
                             <Trash2 size={16} />
                           </button>
                        </div>
                      </div>
                    </Card>
                  </CardHover>
                </SlideIn>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Coupon Modal */}
        <Modal 
          isOpen={showModal} 
          onClose={() => { setShowModal(false); setEditingCoupon(null); }}
          title={editingCoupon ? "Reconfigure Offer" : "Deploy Offer Node"}
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">Offer Code</label>
                  <input name="code" defaultValue={editingCoupon?.code} required className="w-full px-4 py-3 bg-muted rounded-xl border border-border outline-none focus:ring-2 focus:ring-accent font-black uppercase tracking-tighter text-xl" placeholder="E.G. CAFE50" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">Discount Engine</label>
                  <select name="discountType" defaultValue={editingCoupon?.discountType || 'percentage'} required className="w-full px-4 py-3 bg-muted rounded-xl border border-border outline-none focus:ring-2 focus:ring-accent font-bold">
                    <option value="percentage">Percentage Logic (%)</option>
                    <option value="fixed">Fixed Subtraction (₹)</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">Benefit Value</label>
                    <input name="discountValue" type="number" defaultValue={editingCoupon?.discountValue} required className="w-full px-4 py-3 bg-muted rounded-xl border border-border outline-none focus:ring-2 focus:ring-accent font-bold" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">Max Cap (Optional)</label>
                    <input name="maxDiscount" type="number" defaultValue={editingCoupon?.maxDiscount} className="w-full px-4 py-3 bg-muted rounded-xl border border-border outline-none focus:ring-2 focus:ring-accent font-bold" />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">Expiry Timestamp</label>
                  <input name="expiryDate" type="date" defaultValue={editingCoupon?.expiryDate ? new Date(editingCoupon.expiryDate).toISOString().split('T')[0] : ''} required className="w-full px-4 py-3 bg-muted rounded-xl border border-border outline-none focus:ring-2 focus:ring-accent font-bold" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">Minimum Threshold</label>
                  <input name="minOrderAmount" type="number" defaultValue={editingCoupon?.minOrderAmount || 0} required className="w-full px-4 py-3 bg-muted rounded-xl border border-border outline-none focus:ring-2 focus:ring-accent font-bold" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">Usage Cap (Null = ∞)</label>
                  <input name="usageLimit" type="number" defaultValue={editingCoupon?.usageLimit} className="w-full px-4 py-3 bg-muted rounded-xl border border-border outline-none focus:ring-2 focus:ring-accent font-bold" />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-accent/5 p-4 rounded-2xl border border-accent/10">
               <input type="checkbox" name="isActive" id="isActive" defaultChecked={editingCoupon ? editingCoupon.isActive : true} className="w-5 h-5 rounded-lg accent-accent" />
               <label htmlFor="isActive" className="text-xs font-black uppercase tracking-widest cursor-pointer select-none">Operational Status (Broadcast Live)</label>
            </div>

            <Button type="submit" variant="primary" icon={Save} className="w-full py-4 !rounded-2xl">
              Initialize Offer Protocol
            </Button>
          </form>
        </Modal>

        {filteredCoupons.length === 0 && !loading && (
          <div className="text-center py-24 bg-accent/5 rounded-[3rem] border border-dashed border-accent/20">
            <Ticket size={48} className="mx-auto text-accent/20 mb-4" strokeWidth={1.5} />
            <h3 className="text-xl font-black text-foreground">No Offer Codes Synchronized</h3>
            <p className="text-muted-foreground font-medium mt-1">The offer matrix is currently dormant.</p>
            <Button variant="outline" className="mt-6" icon={Plus} onClick={() => setShowModal(true)}>Establish First Offer</Button>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
