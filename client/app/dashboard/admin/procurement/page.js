'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { can } from '@/app/config/actions';
import { digitsOnly, blockNonInteger, blockNegative } from '@/app/utils/inputValidation';
import toast from 'react-hot-toast';
import { PageTransition, SlideIn } from '../../../components/ui/AnimatedContainer';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import PremiumSelect from '@/app/components/ui/PremiumSelect';
import { Truck, Package, Plus, Trash2, Check, X, Building2 } from 'lucide-react';

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export default function ProcurementPage() {
  const { user } = useAuth();
  const branchScoped = ['branch_admin', 'location_admin'].includes(user?.role);

  const [tab, setTab] = useState('orders');
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState([]);
  const [branch, setBranch] = useState('');
  const [suppliers, setSuppliers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [ingredients, setIngredients] = useState([]);

  // forms
  const [supForm, setSupForm] = useState({ name: '', phone: '', gstin: '', paymentTerms: '' });
  const [poSupplier, setPoSupplier] = useState('');
  const [poItems, setPoItems] = useState([{ ingredient: '', name: '', unit: 'unit', quantity: '', unitCost: '' }]);
  const [poNotes, setPoNotes] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (!branchScoped) {
      api.get('/locations').then((r) => {
        const locs = r.data?.data || r.data || [];
        setLocations(locs);
        setBranch(locs[0]?._id || '');
      }).catch(() => {});
    }
  }, [user, branchScoped]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sup, po, ing] = await Promise.all([
        api.get('/suppliers'),
        api.get('/purchase-orders'),
        api.get('/inventory/ingredients').catch(() => ({ data: { data: [] } })),
      ]);
      setSuppliers(sup.data.data || []);
      setOrders(po.data.data || []);
      setIngredients(ing.data.data || []);
    } catch (e) {
      toast.error('Could not load procurement data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  const addSupplier = async () => {
    if (!supForm.name) return toast.error('Supplier name required');
    setBusy(true);
    try {
      await api.post('/suppliers', supForm);
      toast.success('Supplier added');
      setSupForm({ name: '', phone: '', gstin: '', paymentTerms: '' });
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Could not add supplier'); }
    finally { setBusy(false); }
  };

  const poTotal = poItems.reduce((a, i) => a + (Number(i.quantity) || 0) * (Number(i.unitCost) || 0), 0);

  const setItem = (idx, patch) => setPoItems((p) => p.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const onPickIngredient = (idx, ingId) => {
    const ing = ingredients.find((x) => x._id === ingId);
    setItem(idx, { ingredient: ingId, name: ing?.name || '', unit: ing?.unit || 'unit' });
  };

  const createPO = async () => {
    if (!poSupplier) return toast.error('Choose a supplier');
    const items = poItems.filter((i) => i.name && Number(i.quantity) > 0);
    if (items.length === 0) return toast.error('Add at least one item');
    if (!branchScoped && !branch) return toast.error('Choose a branch');
    setBusy(true);
    try {
      await api.post('/purchase-orders', { supplier: poSupplier, locationId: branchScoped ? undefined : branch, items, notes: poNotes });
      toast.success('Purchase order created');
      setPoItems([{ ingredient: '', name: '', unit: 'unit', quantity: '', unitCost: '' }]);
      setPoNotes(''); setPoSupplier('');
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Could not create PO'); }
    finally { setBusy(false); }
  };

  const receivePO = async (id) => {
    setBusy(true);
    try {
      await api.patch(`/purchase-orders/${id}/receive`);
      toast.success('Received — stock & expense recorded');
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Could not receive'); }
    finally { setBusy(false); }
  };

  const cancelPO = async (id) => {
    setBusy(true);
    try {
      await api.patch(`/purchase-orders/${id}/cancel`);
      toast.success('Order cancelled');
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Could not cancel'); }
    finally { setBusy(false); }
  };

  if (loading) return <LoadingScreen />;

  const inputCls = 'px-3 py-2.5 rounded-xl bg-(--color-surface-soft) border border-(--color-border) text-xs font-medium text-(--color-text-primary) outline-none focus:border-primary';

  return (
    <PageTransition>
      <div className="max-w-5xl mx-auto space-y-6">
        <SlideIn>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10 text-primary"><Truck size={22} /></div>
            <div>
              <h1 className="text-2xl font-semibold text-(--color-text-primary) tracking-tight">Procurement</h1>
              <p className="text-[11px] font-medium text-(--color-text-muted) tracking-normal">Suppliers & purchase orders</p>
            </div>
          </div>
        </SlideIn>

        <SlideIn delay={0.05}>
          <div className="flex gap-2">
            {[['orders', 'Purchase Orders'], ['suppliers', 'Suppliers']].map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`px-4 py-2.5 rounded-xl text-[11px] font-medium tracking-normal border transition-all ${tab === k ? 'bg-primary text-(--color-on-primary) border-primary font-semibold' : 'bg-(--color-surface-soft) text-(--color-text-muted) border-(--color-border)'}`}>
                {label}
              </button>
            ))}
          </div>
        </SlideIn>

        {tab === 'orders' && (
          <>
            {/* Create PO */}
            <SlideIn delay={0.1}>
              <div className="glass-card p-6 rounded-xl premium-shadow space-y-4">
                <h2 className="text-sm font-semibold text-(--color-text-primary)">New purchase order</h2>
                <div className="flex flex-wrap gap-3">
                  <div className="w-56">
                    <PremiumSelect value={poSupplier} onChange={setPoSupplier} options={suppliers.map((s) => ({ label: s.name, value: s._id }))} placeholder="Select supplier…" />
                  </div>
                  {!branchScoped && (
                    <div className="w-44">
                      <PremiumSelect value={branch} onChange={setBranch} options={locations.map((l) => ({ label: l.name, value: l._id }))} placeholder="Select branch" />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  {poItems.map((it, idx) => (
                    <div key={idx} className="flex flex-wrap gap-2 items-center">
                      <div className="flex-1 min-w-40">
                        <PremiumSelect value={it.ingredient} onChange={(v) => onPickIngredient(idx, v)} options={ingredients.map((ing) => ({ label: ing.name, value: ing._id }))} placeholder="Ingredient (links to stock)…" />
                      </div>
                      <input value={it.name} onChange={(e) => setItem(idx, { name: e.target.value })} placeholder="or item name" className={`${inputCls} w-36`} />
                      <input type="number" min="0" onKeyDown={blockNonInteger} value={it.quantity} onChange={(e) => setItem(idx, { quantity: e.target.value })} placeholder="Qty" className={`${inputCls} w-20`} />
                      <span className="text-[10px] text-(--color-text-muted) uppercase">{it.unit}</span>
                      <input type="number" min="0" onKeyDown={blockNegative} value={it.unitCost} onChange={(e) => setItem(idx, { unitCost: e.target.value })} placeholder="₹/unit" className={`${inputCls} w-24`} />
                      <span className="text-xs font-semibold text-(--color-text-primary) w-20 text-right">{money((Number(it.quantity) || 0) * (Number(it.unitCost) || 0))}</span>
                      {poItems.length > 1 && (
                        <button onClick={() => setPoItems((p) => p.filter((_, i) => i !== idx))} className="p-2 text-danger hover:bg-danger/10 rounded-lg"><Trash2 size={14} /></button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => setPoItems((p) => [...p, { ingredient: '', name: '', unit: 'unit', quantity: '', unitCost: '' }])}
                    className="flex items-center gap-1 text-[11px] font-medium tracking-normal text-primary hover:opacity-80"><Plus size={11} /> Add item</button>
                </div>

                <div className="flex items-center justify-between flex-wrap gap-3">
                  <input value={poNotes} onChange={(e) => setPoNotes(e.target.value)} placeholder="Notes (optional)" className={`${inputCls} flex-1 min-w-40`} />
                  <p className="text-sm font-medium text-(--color-text-primary)">Total: <span className="font-semibold text-primary">{money(poTotal)}</span></p>
                  {can(user, 'procurement.add') && (
                    <button onClick={createPO} disabled={busy} className="px-6 py-3 bg-primary text-(--color-on-primary) text-[11px] font-semibold tracking-normal rounded-xl hover:opacity-90 disabled:opacity-50">Create PO</button>
                  )}
                </div>
              </div>
            </SlideIn>

            {/* PO list */}
            <SlideIn delay={0.15}>
              <div className="glass-card p-6 rounded-xl premium-shadow space-y-3">
                <h2 className="text-sm font-semibold text-(--color-text-primary) flex items-center gap-2"><Package size={16} className="text-primary" /> Orders</h2>
                {orders.length === 0 && <p className="text-xs text-(--color-text-muted)">No purchase orders yet.</p>}
                <div className="divide-y divide-(--color-border)">
                  {orders.map((po) => (
                    <div key={po._id} className="py-3 flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <p className="text-xs font-medium text-(--color-text-primary)">{po.supplier?.name || 'Supplier'} · {money(po.totalAmount)} <span className="text-(--color-text-muted) text-[11px]">· {po.items?.length} items</span></p>
                        <p className="text-[10px] text-(--color-text-muted)">{po.locationId?.name || ''} · {new Date(po.createdAt).toLocaleDateString('en-IN')}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-medium tracking-normal px-2.5 py-1 rounded-lg ${po.status === 'received' ? 'bg-success/10 text-success' : po.status === 'cancelled' ? 'bg-danger/10 text-danger' : 'bg-amber-500/10 text-amber-500'}`}>{po.status}</span>
                        {po.status === 'ordered' && (
                          <>
                            {can(user, 'procurement.modify') && (
                              <button disabled={busy} onClick={() => receivePO(po._id)} className="flex items-center gap-1 px-3 py-2 bg-success/10 text-success text-[11px] font-medium rounded-lg border border-success/20 hover:bg-success hover:text-white disabled:opacity-50"><Check size={12} /> Receive</button>
                            )}
                            {can(user, 'procurement.modify') && (
                              <button disabled={busy} onClick={() => cancelPO(po._id)} className="flex items-center gap-1 px-3 py-2 bg-danger/10 text-danger text-[11px] font-medium rounded-lg border border-danger/20 hover:bg-danger hover:text-white disabled:opacity-50"><X size={12} /> Cancel</button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </SlideIn>
          </>
        )}

        {tab === 'suppliers' && (
          <>
            <SlideIn delay={0.1}>
              <div className="glass-card p-6 rounded-xl premium-shadow space-y-4">
                <h2 className="text-sm font-semibold text-(--color-text-primary)">Add supplier</h2>
                <div className="flex flex-wrap gap-3">
                  <input value={supForm.name} onChange={(e) => setSupForm({ ...supForm, name: e.target.value })} placeholder="Name" className={`${inputCls} flex-1 min-w-40`} />
                  <input type="tel" inputMode="numeric" maxLength={10} value={supForm.phone} onChange={(e) => setSupForm({ ...supForm, phone: digitsOnly(e.target.value, 10) })} placeholder="Phone" className={`${inputCls} w-36`} />
                  <input value={supForm.gstin} onChange={(e) => setSupForm({ ...supForm, gstin: e.target.value })} placeholder="GSTIN" className={`${inputCls} w-40`} />
                  <input value={supForm.paymentTerms} onChange={(e) => setSupForm({ ...supForm, paymentTerms: e.target.value })} placeholder="Terms (e.g. Net 15)" className={`${inputCls} w-36`} />
                  {can(user, 'procurement.add') && (
                    <button onClick={addSupplier} disabled={busy} className="px-6 py-2.5 bg-primary text-(--color-on-primary) text-[11px] font-semibold tracking-normal rounded-xl hover:opacity-90 disabled:opacity-50">Add</button>
                  )}
                </div>
              </div>
            </SlideIn>
            <SlideIn delay={0.15}>
              <div className="glass-card p-6 rounded-xl premium-shadow space-y-3">
                <h2 className="text-sm font-semibold text-(--color-text-primary) flex items-center gap-2"><Building2 size={16} className="text-primary" /> Suppliers</h2>
                {suppliers.length === 0 && <p className="text-xs text-(--color-text-muted)">No suppliers yet.</p>}
                <div className="divide-y divide-(--color-border)">
                  {suppliers.map((s) => (
                    <div key={s._id} className="py-3 flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <p className="text-xs font-medium text-(--color-text-primary)">{s.name}</p>
                        <p className="text-[10px] text-(--color-text-muted)">{[s.phone, s.gstin, s.paymentTerms].filter(Boolean).join(' · ') || '—'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </SlideIn>
          </>
        )}
      </div>
    </PageTransition>
  );
}
