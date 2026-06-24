'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '../services/api';
import { Plus, Minus, ShoppingBag, CheckCircle2, X } from 'lucide-react';

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

function OrderApp() {
  const params = useSearchParams();
  const branch = params.get('branch') || params.get('branchId') || '';
  const table = params.get('table') || params.get('tableId') || '';

  const [loading, setLoading] = useState(true);
  const [branchName, setBranchName] = useState('');
  const [items, setItems] = useState([]);
  const [cart, setCart] = useState([]); // { key, menuItem, name, price, quantity, modifiers:[{groupName,label}] }
  const [modItem, setModItem] = useState(null);
  const [modSel, setModSel] = useState({});
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [placing, setPlacing] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!branch) { setLoading(false); return; }
    api.get(`/public/menu?branchId=${branch}`)
      .then((r) => {
        // The axios interceptor turns a GET 404 ("Branch not found") into
        // {data:null}, so an invalid/stale branchId would otherwise render a blank
        // menu with no error. Treat a missing branch as an explicit failure.
        if (!r.data?.data?.branch) { setError('Could not load the menu. Please check the link.'); return; }
        setBranchName(r.data.data.branch.name || '');
        setItems(r.data.data.items || []);
      })
      .catch(() => setError('Could not load the menu. Please check the link.'))
      .finally(() => setLoading(false));
  }, [branch]);

  const priceOf = (it) => Number(it.discountedPrice || it.price || 0);

  const addItem = (it) => {
    if (Array.isArray(it.modifierGroups) && it.modifierGroups.length > 0) {
      setModSel({}); setModItem(it); return;
    }
    setCart((c) => {
      const i = c.findIndex((x) => x.menuItem === it._id && (!x.modifiers || x.modifiers.length === 0));
      if (i > -1) { const n = [...c]; n[i] = { ...n[i], quantity: n[i].quantity + 1 }; return n; }
      return [...c, { key: `${it._id}-${c.length}`, menuItem: it._id, name: it.name, price: priceOf(it), quantity: 1, modifiers: [] }];
    });
  };

  const toggleMod = (g, label) => setModSel((p) => {
    if (g.selectionType === 'single') return { ...p, [g.name]: { [label]: true } };
    const cur = { ...(p[g.name] || {}) }; cur[label] = !cur[label]; return { ...p, [g.name]: cur };
  });

  const confirmMods = () => {
    const it = modItem; if (!it) return;
    const modifiers = []; let delta = 0;
    for (const g of it.modifierGroups) {
      const chosen = Object.entries(modSel[g.name] || {}).filter(([, v]) => v).map(([l]) => l);
      if (g.required && chosen.length === 0) { setError(`Please choose ${g.name}`); return; }
      if (g.selectionType === 'multiple' && g.maxSelections > 0 && chosen.length > g.maxSelections) { setError(`Pick at most ${g.maxSelections} for ${g.name}`); return; }
      for (const label of chosen) {
        const opt = g.options.find((o) => o.label === label);
        if (opt) { modifiers.push({ groupName: g.name, label: opt.label }); delta += Number(opt.priceDelta) || 0; }
      }
    }
    setError('');
    setCart((c) => [...c, { key: `${it._id}-${c.length}`, menuItem: it._id, name: it.name, price: priceOf(it) + delta, quantity: 1, modifiers }]);
    setModItem(null); setModSel({});
  };

  const changeQty = (key, d) => setCart((c) => c.map((x) => x.key === key ? { ...x, quantity: x.quantity + d } : x).filter((x) => x.quantity > 0));

  const total = cart.reduce((a, x) => a + x.price * x.quantity, 0);

  const submit = async () => {
    if (cart.length === 0) return;
    setPlacing(true); setError('');
    try {
      await api.post('/public/order', {
        branchId: branch,
        tableId: table || undefined,
        orderType: table ? 'dine-in' : 'takeaway',
        items: cart.map((x) => ({ menuItem: x.menuItem, quantity: x.quantity, modifiers: x.modifiers })),
        customerName: name,
        customerPhone: phone,
      });
      setDone(true);
    } catch (e) {
      setError(e.response?.data?.message || 'Could not place the order. Please try again.');
    } finally { setPlacing(false); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-(--color-text-muted)">Loading menu…</div>;
  if (!branch) return <div className="min-h-screen flex items-center justify-center text-(--color-text-muted)">Invalid ordering link.</div>;

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-(--color-bg-base)">
        <div className="text-center space-y-3">
          <CheckCircle2 size={56} className="text-success mx-auto" />
          <h1 className="text-2xl font-bold text-(--color-text-primary)">Order placed!</h1>
          <p className="text-sm text-(--color-text-muted)">Please pay at the counter. Thank you!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-(--color-bg-base) pb-32">
      <div className="max-w-lg mx-auto p-5">
        <div className="text-center py-4">
          <h1 className="text-xl font-bold text-(--color-text-primary) tracking-tight">{branchName || 'Order'}</h1>
          <p className="text-[11px] font-bold text-(--color-text-muted) uppercase tracking-normal">{table ? 'Dine-in' : 'Takeaway'} · scan & order</p>
        </div>

        {error && <div className="mb-3 p-3 rounded-xl bg-danger/10 text-danger text-xs font-bold text-center">{error}</div>}

        <div className="space-y-2">
          {items.map((it) => (
            <div key={it._id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-(--color-surface) border border-(--color-border)">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`h-2 w-2 rounded-full shrink-0 ${it.dietaryType === 'veg' ? 'bg-success' : 'bg-danger'}`} />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-(--color-text-primary) truncate">{it.name}</p>
                  <p className="text-[11px] font-bold text-(--color-text-muted)">{money(priceOf(it))}{it.modifierGroups?.length ? ' · customizable' : ''}</p>
                </div>
              </div>
              <button onClick={() => addItem(it)} className="shrink-0 flex items-center gap-1 px-3 py-2 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-normal rounded-lg border border-primary/20 active:scale-95">
                <Plus size={13} /> Add
              </button>
            </div>
          ))}
          {items.length === 0 && <p className="text-center text-sm text-(--color-text-muted) py-8">No items available right now.</p>}
        </div>
      </div>

      {/* Cart bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 bg-(--color-surface) border-t border-(--color-border) shadow-2xl">
          <div className="max-w-lg mx-auto p-4 space-y-3">
            <div className="max-h-40 overflow-y-auto space-y-1.5">
              {cart.map((x) => (
                <div key={x.key} className="flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <span className="font-bold text-(--color-text-primary)">{x.name}</span>
                    {x.modifiers?.length > 0 && <span className="text-(--color-text-muted)"> · {x.modifiers.map((m) => m.label).join(', ')}</span>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => changeQty(x.key, -1)} className="h-6 w-6 rounded-lg bg-(--color-surface-soft) text-(--color-text-muted) flex items-center justify-center"><Minus size={12} /></button>
                    <span className="w-5 text-center font-bold text-(--color-text-primary)">{x.quantity}</span>
                    <button onClick={() => changeQty(x.key, 1)} className="h-6 w-6 rounded-lg bg-(--color-surface-soft) text-(--color-text-muted) flex items-center justify-center"><Plus size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)" className="flex-1 px-3 py-2.5 rounded-xl bg-(--color-surface-soft) border border-(--color-border) text-xs font-medium text-(--color-text-primary) outline-none" />
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className="w-28 px-3 py-2.5 rounded-xl bg-(--color-surface-soft) border border-(--color-border) text-xs font-medium text-(--color-text-primary) outline-none" />
            </div>
            <button onClick={submit} disabled={placing} className="w-full flex items-center justify-center gap-2 py-4 bg-primary text-(--color-on-primary) text-sm font-bold rounded-xl active:scale-[0.99] disabled:opacity-50">
              <ShoppingBag size={16} /> {placing ? 'Placing…' : `Place order · ${money(total)}`}
            </button>
            <p className="text-[10px] text-center text-(--color-text-muted)">Items priced at the counter; taxes added on the final bill.</p>
          </div>
        </div>
      )}

      {/* Modifier picker */}
      {modItem && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={() => setModItem(null)}>
          <div className="w-full max-w-md bg-(--color-surface) rounded-2xl p-5 space-y-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-(--color-text-primary)">{modItem.name}</h2>
              <button onClick={() => setModItem(null)} className="text-(--color-text-muted)"><X size={18} /></button>
            </div>
            {modItem.modifierGroups.map((g, gi) => (
              <div key={gi} className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-normal text-(--color-text-primary)">{g.name} <span className="text-(--color-text-muted)">{g.required ? '· required' : ''}</span></p>
                {g.options.map((o, oi) => {
                  const on = !!(modSel[g.name] && modSel[g.name][o.label]);
                  return (
                    <button key={oi} onClick={() => toggleMod(g, o.label)} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-bold ${on ? 'bg-primary/10 border-primary text-primary' : 'bg-(--color-surface-soft) border-(--color-border) text-(--color-text-primary)'}`}>
                      <span>{o.label}</span>{o.priceDelta ? <span className="text-xs">+{money(o.priceDelta)}</span> : null}
                    </button>
                  );
                })}
              </div>
            ))}
            <button onClick={confirmMods} className="w-full py-3.5 bg-primary text-(--color-on-primary) text-sm font-bold rounded-xl">Add to order</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PublicOrderPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-(--color-text-muted)">Loading…</div>}>
      <OrderApp />
    </Suspense>
  );
}
