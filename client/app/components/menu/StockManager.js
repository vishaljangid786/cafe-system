'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '@/app/context/AuthContext';
import { can } from '@/app/config/actions';
import Modal from '../ui/Modal';
import PremiumSelect from '../ui/PremiumSelect';
import {
  Plus, Minus, Search, Coffee, Trash2, Loader2, Eye, EyeOff, PackageOpen, ExternalLink,
} from 'lucide-react';

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const isSpecific = (id) => id && id !== 'All' && id !== 'all';

// Per-branch stock console: see live stock, bump it up/down, toggle availability,
// or remove an item. Stock is per-branch, so when viewing "All branches" a picker
// lets the owner choose which branch to manage.
export default function StockManager({ isOpen, onClose, branchId, branchName, menuHref, branches = [] }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(null); // `${id}:${action}`
  const [sel, setSel] = useState('');

  const list = Array.isArray(branches) ? branches : [];
  // Effective branch = an explicit in-modal pick, else the page's branch (if specific).
  const effectiveId = sel || (isSpecific(branchId) ? branchId : '');
  const scoped = !!effectiveId;
  const effectiveName = list.find((b) => (b._id || b) === effectiveId)?.name || (isSpecific(branchId) ? branchName : '') || 'Branch';

  const mayModify = can(user, 'menu.modify');
  const mayDelete = can(user, 'menu.delete');
  const stockOf = (it) => (typeof it.branchSpecificStock === 'number' ? it.branchSpecificStock : (typeof it.stock === 'number' ? it.stock : null));

  const load = useCallback(async () => {
    if (!isOpen || !effectiveId) { setItems([]); return; }
    setLoading(true);
    try {
      const res = await api.get(`/menu?locationId=${effectiveId}&limit=500`);
      setItems(res.data?.data || []);
    } catch { toast.error('Could not load stock'); }
    finally { setLoading(false); }
  }, [isOpen, effectiveId]);

  useEffect(() => { load(); }, [load]);

  const patchItem = (id, patch) => setItems((arr) => arr.map((x) => x._id === id ? { ...x, ...patch } : x));

  const adjust = async (it, delta) => {
    const cur = stockOf(it) ?? 0;
    if (delta < 0 && cur <= 0) return;
    setBusy(`${it._id}:adj`);
    const optimistic = Math.max(0, cur + delta);
    patchItem(it._id, { branchSpecificStock: optimistic, isAvailable: optimistic > 0 ? it.isAvailable : false });
    try {
      const res = await api.patch(`/menu/${it._id}/stock/adjust`, { delta, branchId: effectiveId });
      const s = res.data?.data;
      if (s && typeof s.stock === 'number') patchItem(it._id, { branchSpecificStock: s.stock, isAvailable: s.isAvailable });
    } catch (e) {
      patchItem(it._id, { branchSpecificStock: cur });
      toast.error(e.response?.data?.message || 'Stock update failed');
    } finally { setBusy(null); }
  };

  const setExact = async (it, value) => {
    const stock = Math.max(0, Math.floor(Number(value) || 0));
    setBusy(`${it._id}:set`);
    try {
      const res = await api.put(`/menu/${it._id}/stock`, { stock, branchId: effectiveId });
      const s = res.data?.data;
      if (s && typeof s.stock === 'number') patchItem(it._id, { branchSpecificStock: s.stock, isAvailable: s.isAvailable });
      else patchItem(it._id, { branchSpecificStock: stock });
    } catch (e) {
      toast.error(e.response?.data?.message || 'Stock update failed');
    } finally { setBusy(null); }
  };

  const toggle = async (it) => {
    setBusy(`${it._id}:tog`);
    try {
      await api.put(`/menu/${it._id}/availability`, {});
      patchItem(it._id, { isAvailable: !it.isAvailable });
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not change availability');
    } finally { setBusy(null); }
  };

  const remove = async (it) => {
    if (!window.confirm(`Remove "${it.name}" from the menu? This cannot be undone.`)) return;
    setBusy(`${it._id}:del`);
    try {
      await api.delete(`/menu/${it._id}`);
      setItems((arr) => arr.filter((x) => x._id !== it._id));
      toast.success('Item removed');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not remove the item');
    } finally { setBusy(null); }
  };

  const filtered = useMemo(
    () => items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase())),
    [items, search]
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Stock · ${scoped ? effectiveName : (branchName || 'Branch')}`} maxWidth="max-w-2xl">
      <div className="space-y-4">
        {list.length > 1 && (
          <PremiumSelect
            label="Branch"
            value={effectiveId}
            onChange={setSel}
            options={list.map((b) => ({ label: b.name || b.city || 'Branch', value: b._id || b }))}
            placeholder="Choose a branch to manage its stock"
          />
        )}

        {!scoped ? (
          <div className="py-12 text-center text-sm text-(--color-text-muted)">
            <PackageOpen size={40} className="mx-auto mb-3 opacity-30" />
            {list.length > 1 ? 'Choose a branch above to manage its stock.' : 'Pick a specific branch first to manage its stock.'}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-(--color-text-muted)" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search menu items…"
                  className="w-full bg-(--color-bg-soft) border border-(--color-border) rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 text-(--color-text-primary)" />
              </div>
              {menuHref && (
                <Link href={menuHref} className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 text-[11px] font-bold uppercase tracking-wide">
                  <Plus size={14} /> Add item
                </Link>
              )}
            </div>

            {loading ? (
              <div className="py-12 flex items-center justify-center text-(--color-text-muted)"><Loader2 className="animate-spin mr-2" size={16} /> Loading…</div>
            ) : (
              <div className="space-y-2 max-h-[55vh] overflow-y-auto custom-scrollbar pr-1">
                {filtered.map((it) => {
                  const stock = stockOf(it);
                  const out = it.isAvailable === false || (stock != null && stock <= 0);
                  return (
                    <div key={it._id} className="flex items-center gap-3 p-3 rounded-xl bg-(--color-surface) border border-(--color-border)">
                      <div className="h-11 w-11 rounded-lg overflow-hidden bg-(--color-bg-soft) flex items-center justify-center shrink-0">
                        {it.image ? <img src={it.image} alt={it.name} className="h-full w-full object-cover" /> : <Coffee size={18} className="text-(--color-text-muted)" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-(--color-text-primary) truncate">{it.name}</p>
                        <p className="text-[11px] font-bold text-(--color-text-muted)">
                          {money(it.discountedPrice || it.price)}
                          {out && <span className="ml-2 text-danger uppercase">out of stock</span>}
                        </p>
                      </div>

                      {mayModify ? (
                        <div className="flex items-center gap-1 rounded-lg border border-(--color-border) bg-(--color-bg-soft) p-1 shrink-0">
                          <button onClick={() => adjust(it, -1)} disabled={busy === `${it._id}:adj` || (stock ?? 0) <= 0} className="h-7 w-7 rounded-md flex items-center justify-center text-(--color-text-muted) hover:bg-(--color-surface) disabled:opacity-40"><Minus size={13} /></button>
                          <input
                            value={stock ?? 0}
                            onChange={(e) => patchItem(it._id, { branchSpecificStock: e.target.value.replace(/[^\d]/g, '') })}
                            onBlur={(e) => setExact(it, e.target.value)}
                            className="w-10 bg-transparent text-center text-sm font-bold text-(--color-text-primary) outline-none"
                          />
                          <button onClick={() => adjust(it, 1)} disabled={busy === `${it._id}:adj`} className="h-7 w-7 rounded-md flex items-center justify-center text-(--color-text-muted) hover:bg-(--color-surface)"><Plus size={13} /></button>
                        </div>
                      ) : (
                        <span className="text-sm font-bold text-(--color-text-primary) shrink-0">{stock ?? '—'}</span>
                      )}

                      {mayModify && (
                        <button onClick={() => toggle(it)} title={it.isAvailable ? 'Mark unavailable' : 'Mark available'}
                          className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border ${it.isAvailable ? 'bg-success/10 text-success border-success/20' : 'bg-(--color-bg-soft) text-(--color-text-muted) border-(--color-border)'}`}>
                          {it.isAvailable ? <Eye size={15} /> : <EyeOff size={15} />}
                        </button>
                      )}
                      {mayDelete && (
                        <button onClick={() => remove(it)} disabled={busy === `${it._id}:del`}
                          className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 bg-danger/10 text-danger border border-danger/20 disabled:opacity-50">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="py-12 text-center text-sm text-(--color-text-muted)">
                    <Coffee size={36} className="mx-auto mb-3 opacity-30" /> No items found.
                    {menuHref && <div className="mt-3"><Link href={menuHref} className="text-primary font-bold inline-flex items-center gap-1">Add your first item <ExternalLink size={13} /></Link></div>}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
