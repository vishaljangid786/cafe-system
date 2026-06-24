'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import api from '../../../services/api';
import {
  Store, Plus, Edit2, Trash2, MapPin, Users, ShieldCheck, X, UserPlus, Image as ImageIcon, Receipt, Mail, Phone,
} from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { progress } from '@/app/components/ui/TopProgressBar';
import { PageTransition, SlideIn } from '../../../components/ui/AnimatedContainer';
import { motion, AnimatePresence } from 'framer-motion';
import PremiumSelect from '../../../components/ui/PremiumSelect';

const EMPTY_FORM = {
  name: '', logo: '', gstin: '',
  address: { line1: '', line2: '', city: '', state: '', country: 'India', pincode: '' },
  contact: { phone: '', email: '' },
  adminMode: 'new',
  admin: { name: '', email: '', password: '', phone: '', gender: 'Other' },
  adminUserId: '',
};

export default function CafesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isSuper = user?.role === 'super_admin';

  const [cafes, setCafes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null); // cafe being edited (or null = create)
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Gate: only super_admin and admins (cafe owners) may open this page.
  useEffect(() => {
    if (user && !['super_admin', 'admin'].includes(user.role) && !user.permissions?.manageBranches) {
      toast.error('Access denied.');
      router.push('/dashboard');
    }
  }, [user, router]);

  const fetchCafes = async () => {
    progress.start();
    try {
      const res = await api.get('/cafes');
      setCafes(res.data.data || []);
    } catch (e) {
      console.error('Failed to load cafes');
    } finally {
      setLoading(false);
      progress.done();
    }
  };

  // Only super_admins assign existing users as admins, so only they need the list.
  const fetchUsers = async () => {
    if (!isSuper) return;
    try {
      const res = await api.get('/users');
      setUsers((res.data.data || []).filter((u) => u.role !== 'super_admin'));
    } catch (e) {
      console.error('Failed to load users');
    }
  };

  useEffect(() => {
    const t = setTimeout(() => {
      fetchCafes();
      fetchUsers();
    }, 0);
    return () => clearTimeout(t);
  }, [isSuper]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (cafe) => {
    setEditing(cafe);
    setForm({
      ...EMPTY_FORM,
      name: cafe.name || '',
      logo: cafe.logo || '',
      gstin: cafe.gstin || '',
      address: { ...EMPTY_FORM.address, ...(cafe.address || {}) },
      contact: { ...EMPTY_FORM.contact, ...(cafe.contact || {}) },
      adminMode: 'new',
    });
    setShowModal(true);
  };

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setAddress = (k, v) => setForm((f) => ({ ...f, address: { ...f.address, [k]: v } }));
  const setContact = (k, v) => setForm((f) => ({ ...f, contact: { ...f.contact, [k]: v } }));
  const setAdmin = (k, v) => setForm((f) => ({ ...f, admin: { ...f.admin, [k]: v } }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Cafe name is required');
    setSaving(true);
    const loadToast = toast.loading(editing ? 'Saving cafe...' : 'Creating cafe...');
    try {
      if (editing) {
        await api.patch(`/cafes/${editing._id}`, {
          name: form.name, logo: form.logo, gstin: form.gstin,
          address: form.address, contact: form.contact,
        });
      } else {
        const payload = {
          name: form.name, logo: form.logo, gstin: form.gstin,
          address: form.address, contact: form.contact,
          adminMode: form.adminMode,
        };
        if (form.adminMode === 'new') payload.admin = form.admin;
        if (form.adminMode === 'existing') payload.adminUserId = form.adminUserId;
        await api.post('/cafes', payload);
      }
      toast.success(editing ? 'Cafe updated' : 'Cafe created', { id: loadToast });
      setShowModal(false);
      setForm(EMPTY_FORM);
      setEditing(null);
      fetchCafes();
    } catch (err) {
      const msg = err.response?.data?.message
        || err.response?.data?.errors?.map((o) => Object.values(o)[0]).join(', ')
        || 'Something went wrong. Please try again.';
      toast.error(msg, { id: loadToast });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cafe) => {
    if (!confirm(`Delete cafe "${cafe.name}"? Its branches must be removed first.`)) return;
    const loadToast = toast.loading('Deleting cafe...');
    try {
      await api.delete(`/cafes/${cafe._id}`);
      toast.success('Cafe deleted', { id: loadToast });
      fetchCafes();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete cafe', { id: loadToast });
    }
  };

  const handleAddAdmin = async (cafe) => {
    const payload = { adminMode: form.adminMode };
    if (form.adminMode === 'new') payload.admin = form.admin;
    if (form.adminMode === 'existing') payload.adminUserId = form.adminUserId;
    const loadToast = toast.loading('Adding admin...');
    try {
      await api.post(`/cafes/${cafe._id}/admins`, payload);
      toast.success('Admin added', { id: loadToast });
      setForm((f) => ({ ...f, admin: EMPTY_FORM.admin, adminUserId: '' }));
      fetchCafes();
      const fresh = await api.get(`/cafes/${cafe._id}`);
      setEditing(fresh.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not add admin', { id: loadToast });
    }
  };

  const handleRemoveAdmin = async (cafe, adminId) => {
    const loadToast = toast.loading('Removing admin...');
    try {
      await api.delete(`/cafes/${cafe._id}/admins/${adminId}`);
      toast.success('Admin removed', { id: loadToast });
      fetchCafes();
      const fresh = await api.get(`/cafes/${cafe._id}`);
      setEditing(fresh.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not remove admin', { id: loadToast });
    }
  };

  if (loading) return <LoadingScreen fullScreen={false} />;

  const inputCls = 'w-full px-5 py-3.5 rounded-xl border border-(--color-border) bg-(--color-bg-soft) text-(--color-text-primary) outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all font-bold text-sm';
  const labelCls = 'block text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) mb-2 ml-1';

  return (
    <PageTransition>
      <div className="space-y-8">
        <SlideIn direction="down">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <h1 className="text-3xl font-bold text-(--color-text-primary) flex items-center tracking-tight leading-none">
                <Store className="mr-4 text-primary" size={34} strokeWidth={2.5} /> Cafe <span className="ml-3 text-primary">Management</span>
              </h1>
              <p className="text-(--color-text-secondary) text-sm mt-3 font-medium">
                {isSuper ? 'Create and manage every cafe (brand). Each cafe owns its own branches and bills.' : 'Manage your cafe brand details shown on receipts.'}
              </p>
            </div>
            {isSuper && (
              <motion.button
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                onClick={openCreate}
                className="flex items-center justify-center px-8 py-4 bg-primary text-(--color-on-primary) rounded-xl font-bold uppercase tracking-normal text-[10px] shadow-sm hover:opacity-90 transition-all whitespace-nowrap"
              >
                <Plus className="mr-2" size={16} /> New Cafe
              </motion.button>
            )}
          </div>
        </SlideIn>

        {cafes.length === 0 ? (
          <div className="p-20 text-center text-(--color-text-muted) rounded-xl border border-dashed border-(--color-border)">
            <Store size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-sm font-bold uppercase tracking-normal">No cafes yet</p>
            {isSuper && <p className="text-xs mt-2">Click “New Cafe” to create your first brand.</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {cafes.map((cafe, i) => (
              <SlideIn key={cafe._id} delay={i * 0.04} direction="up">
                <div className="h-full rounded-xl border border-(--color-border) bg-(--color-surface)/60 p-6 flex flex-col gap-5 hover:border-primary/30 transition-all shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="h-14 w-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 overflow-hidden">
                        {cafe.logo ? <img src={cafe.logo} alt={cafe.name} className="h-full w-full object-cover" /> : <Store size={24} />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-base font-bold text-(--color-text-primary) truncate">{cafe.name}</p>
                        {cafe.gstin ? (
                          <p className="text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal mt-0.5 truncate">GSTIN: {cafe.gstin}</p>
                        ) : (
                          <p className="text-[10px] font-medium text-(--color-text-muted) mt-0.5 truncate">{cafe.address?.city || 'No address set'}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => openEdit(cafe)} className="p-2.5 rounded-xl bg-(--color-surface-soft) text-(--color-text-secondary) border border-(--color-border) hover:text-primary transition-all" title="Edit">
                        <Edit2 size={15} />
                      </button>
                      {isSuper && (
                        <button onClick={() => handleDelete(cafe)} className="p-2.5 rounded-xl bg-danger/10 text-danger border border-danger/20 hover:bg-danger hover:text-white transition-all" title="Delete">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-(--color-surface-soft) border border-(--color-border) p-3">
                      <div className="flex items-center gap-2 text-(--color-text-muted)"><MapPin size={13} /><span className="text-[9px] font-bold uppercase tracking-normal">Branches</span></div>
                      <p className="text-2xl font-bold text-(--color-text-primary) mt-1">{cafe.branchCount ?? 0}</p>
                    </div>
                    <div className="rounded-xl bg-(--color-surface-soft) border border-(--color-border) p-3">
                      <div className="flex items-center gap-2 text-(--color-text-muted)"><Users size={13} /><span className="text-[9px] font-bold uppercase tracking-normal">Admins</span></div>
                      <p className="text-2xl font-bold text-(--color-text-primary) mt-1">{cafe.admins?.length ?? 0}</p>
                    </div>
                  </div>

                  {cafe.admins?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {cafe.admins.slice(0, 3).map((a) => (
                        <span key={a._id} className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                          <ShieldCheck size={11} /> {a.name}
                        </span>
                      ))}
                      {cafe.admins.length > 3 && (
                        <span className="text-[10px] font-bold px-2 py-1 text-(--color-text-muted)">+{cafe.admins.length - 3} more</span>
                      )}
                    </div>
                  )}
                </div>
              </SlideIn>
            ))}
          </div>
        )}

        {/* Create / Edit modal */}
        <AnimatePresence>
          {showModal && (
            <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(false)} className="absolute inset-0 bg-black/80" />
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 30 }}
                className="bg-(--color-surface) rounded-xl max-w-3xl w-full shadow-sm relative z-10 border border-(--color-border) max-h-[90vh] flex flex-col"
              >
                <div className="flex justify-between items-center px-8 py-6 border-b border-(--color-border) shrink-0">
                  <h2 className="text-2xl font-bold text-(--color-text-primary) tracking-tight">
                    {editing ? 'Edit' : 'Create'} <span className="text-primary">Cafe</span>
                  </h2>
                  <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-(--color-surface-soft) text-(--color-text-muted)"><X size={22} /></button>
                </div>

                <div className="overflow-y-auto custom-scrollbar p-8">
                  <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Brand details */}
                    <section className="space-y-5">
                      <h3 className="text-xs font-bold uppercase tracking-normal text-(--color-text-muted) flex items-center gap-2"><Store size={14} className="text-primary" /> Brand Details</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                          <label className={labelCls}>Cafe Name *</label>
                          <input className={inputCls} value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="e.g. Brew Haven" required />
                        </div>
                        <div>
                          <label className={labelCls}>GSTIN</label>
                          <input className={inputCls} value={form.gstin} onChange={(e) => setField('gstin', e.target.value)} placeholder="22AAAAA0000A1Z5" />
                        </div>
                        <div className="md:col-span-2">
                          <label className={labelCls}><ImageIcon size={11} className="inline mr-1" /> Logo URL</label>
                          <input className={inputCls} value={form.logo} onChange={(e) => setField('logo', e.target.value)} placeholder="https://… (shown on receipts)" />
                        </div>
                      </div>
                    </section>

                    {/* Address + contact (appear on receipt) */}
                    <section className="space-y-5">
                      <h3 className="text-xs font-bold uppercase tracking-normal text-(--color-text-muted) flex items-center gap-2"><Receipt size={14} className="text-primary" /> Receipt Address & Contact</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="md:col-span-2">
                          <label className={labelCls}>Address Line 1</label>
                          <input className={inputCls} value={form.address.line1} onChange={(e) => setAddress('line1', e.target.value)} />
                        </div>
                        <div><label className={labelCls}>City</label><input className={inputCls} value={form.address.city} onChange={(e) => setAddress('city', e.target.value)} /></div>
                        <div><label className={labelCls}>State</label><input className={inputCls} value={form.address.state} onChange={(e) => setAddress('state', e.target.value)} /></div>
                        <div><label className={labelCls}>Pincode</label><input className={inputCls} value={form.address.pincode} onChange={(e) => setAddress('pincode', e.target.value)} /></div>
                        <div><label className={labelCls}><Phone size={11} className="inline mr-1" /> Phone</label><input className={inputCls} value={form.contact.phone} onChange={(e) => setContact('phone', e.target.value)} /></div>
                        <div className="md:col-span-2"><label className={labelCls}><Mail size={11} className="inline mr-1" /> Email</label><input className={inputCls} value={form.contact.email} onChange={(e) => setContact('email', e.target.value)} /></div>
                      </div>
                    </section>

                    {/* Admin assignment — create mode (super_admin only) */}
                    {!editing && isSuper && (
                      <section className="space-y-5">
                        <h3 className="text-xs font-bold uppercase tracking-normal text-(--color-text-muted) flex items-center gap-2"><ShieldCheck size={14} className="text-primary" /> Cafe Admin (Owner)</h3>
                        <PremiumSelect
                          label="How to assign the admin"
                          value={form.adminMode}
                          onChange={(v) => setField('adminMode', v)}
                          options={[
                            { label: 'Create a new admin account', value: 'new' },
                            { label: 'Assign an existing user', value: 'existing' },
                            { label: 'No admin for now', value: 'none' },
                          ]}
                        />
                        {form.adminMode === 'new' && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div><label className={labelCls}>Admin Name *</label><input className={inputCls} value={form.admin.name} onChange={(e) => setAdmin('name', e.target.value)} /></div>
                            <div><label className={labelCls}>Email *</label><input type="email" className={inputCls} value={form.admin.email} onChange={(e) => setAdmin('email', e.target.value)} /></div>
                            <div><label className={labelCls}>Password *</label><input type="password" className={inputCls} value={form.admin.password} onChange={(e) => setAdmin('password', e.target.value)} placeholder="Min 6 characters" /></div>
                            <div><label className={labelCls}>Phone *</label><input className={inputCls} value={form.admin.phone} onChange={(e) => setAdmin('phone', e.target.value)} placeholder="10-digit" /></div>
                            <div>
                              <PremiumSelect label="Gender" value={form.admin.gender} onChange={(v) => setAdmin('gender', v)}
                                options={[{ label: 'Male', value: 'Male' }, { label: 'Female', value: 'Female' }, { label: 'Other', value: 'Other' }]} />
                            </div>
                          </div>
                        )}
                        {form.adminMode === 'existing' && (
                          <PremiumSelect
                            label="Select user to make admin"
                            placeholder="Choose a user"
                            value={form.adminUserId}
                            onChange={(v) => setField('adminUserId', v)}
                            options={users.map((u) => ({ label: `${u.name} — ${u.email} (${u.role})`, value: u._id }))}
                          />
                        )}
                      </section>
                    )}

                    <div className="flex gap-4 pt-2">
                      <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-6 py-4 rounded-xl text-xs font-bold uppercase tracking-normal text-(--color-text-muted) bg-(--color-surface-soft) hover:bg-(--color-bg-soft) transition-all">Cancel</button>
                      <button type="submit" disabled={saving} className="flex-1 px-6 py-4 rounded-xl text-xs font-bold uppercase tracking-normal text-(--color-on-primary) bg-primary hover:opacity-90 shadow-sm transition-all disabled:opacity-50">
                        {editing ? 'Save Changes' : 'Create Cafe'}
                      </button>
                    </div>
                  </form>

                  {/* Admin management — edit mode (super_admin only) */}
                  {editing && isSuper && (
                    <section className="mt-10 pt-8 border-t border-(--color-border) space-y-5">
                      <h3 className="text-xs font-bold uppercase tracking-normal text-(--color-text-muted) flex items-center gap-2"><Users size={14} className="text-primary" /> Cafe Admins</h3>
                      <div className="space-y-2">
                        {(editing.admins || []).length === 0 && (
                          <p className="text-xs text-(--color-text-muted) italic">No admins assigned yet.</p>
                        )}
                        {(editing.admins || []).map((a) => (
                          <div key={a._id} className="flex items-center justify-between p-3.5 rounded-xl bg-(--color-surface-soft) border border-(--color-border)">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">{a.name?.charAt(0)}</div>
                              <div className="min-w-0"><p className="text-sm font-bold text-(--color-text-primary) truncate">{a.name}</p><p className="text-[10px] text-(--color-text-muted) truncate">{a.email}</p></div>
                            </div>
                            <button onClick={() => handleRemoveAdmin(editing, a._id)} className="p-2 rounded-lg bg-danger/10 text-danger hover:bg-danger hover:text-white transition-all shrink-0"><X size={14} /></button>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-xl border border-dashed border-(--color-border) p-5 space-y-4">
                        <p className="text-[11px] font-bold uppercase tracking-normal text-(--color-text-muted) flex items-center gap-2"><UserPlus size={13} /> Add an admin</p>
                        <PremiumSelect value={form.adminMode} onChange={(v) => setField('adminMode', v)}
                          options={[{ label: 'New admin account', value: 'new' }, { label: 'Existing user', value: 'existing' }]} />
                        {form.adminMode === 'new' ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input className={inputCls} placeholder="Name" value={form.admin.name} onChange={(e) => setAdmin('name', e.target.value)} />
                            <input className={inputCls} placeholder="Email" value={form.admin.email} onChange={(e) => setAdmin('email', e.target.value)} />
                            <input className={inputCls} type="password" placeholder="Password" value={form.admin.password} onChange={(e) => setAdmin('password', e.target.value)} />
                            <input className={inputCls} placeholder="Phone (10-digit)" value={form.admin.phone} onChange={(e) => setAdmin('phone', e.target.value)} />
                          </div>
                        ) : (
                          <PremiumSelect placeholder="Choose a user" value={form.adminUserId} onChange={(v) => setField('adminUserId', v)}
                            options={users.map((u) => ({ label: `${u.name} — ${u.email}`, value: u._id }))} />
                        )}
                        <button type="button" onClick={() => handleAddAdmin(editing)} className="w-full px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-normal text-(--color-on-primary) bg-primary hover:opacity-90 transition-all">Add Admin</button>
                      </div>
                    </section>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}
