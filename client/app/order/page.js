'use client';

import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import QRCode from 'react-qr-code';
import api from '../services/api';
import {
  Plus, Minus, ShoppingBag, CheckCircle2, X, Users, Flame, Utensils,
  Loader2, Smartphone, Wallet, ArrowLeft, ArrowRight, Clock, XCircle,
} from 'lucide-react';

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

// Build a standard UPI intent URL that any UPI app (GPay/PhonePe/Paytm) can open.
const buildUpiUrl = ({ vpa, name, amount, note }) => {
  const p = new URLSearchParams();
  p.set('pa', vpa);
  if (name) p.set('pn', name);
  if (amount) p.set('am', Number(amount).toFixed(2));
  p.set('cu', 'INR');
  if (note) p.set('tn', note);
  return `upi://pay?${p.toString()}`;
};

function OrderApp() {
  const params = useSearchParams();
  const branch = params.get('branch') || params.get('branchId') || '';
  const table = params.get('table') || params.get('tableId') || '';

  const [loading, setLoading] = useState(true);
  const [branchInfo, setBranchInfo] = useState(null);
  const [tableInfo, setTableInfo] = useState(null);
  const [payCfg, setPayCfg] = useState({ acceptUpi: false, acceptCash: true, upiVpa: '', upiName: '', requireApproval: true });
  const [items, setItems] = useState([]);
  const [popular, setPopular] = useState([]);
  const [error, setError] = useState('');

  const [cart, setCart] = useState([]); // { key, menuItem, name, price, quantity, modifiers:[{groupName,label}] }
  const [modItem, setModItem] = useState(null);
  const [modSel, setModSel] = useState({});

  const [step, setStep] = useState('menu'); // menu | checkout | upi | placing | placed
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [partySize, setPartySize] = useState(1);
  const [memberNames, setMemberNames] = useState([]); // string[]
  const [payChoice, setPayChoice] = useState(''); // 'pay_now_upi' | 'pay_later'
  const [laterMethod, setLaterMethod] = useState('CASH'); // CASH | UPI
  const [upiRef, setUpiRef] = useState('');
  const [placing, setPlacing] = useState(false);

  const [placed, setPlaced] = useState(null); // { orderId, status, approvalStatus, method }
  const [liveStatus, setLiveStatus] = useState(null); // { confirmed, declined, status, approvalStatus }
  const pollRef = useRef(null);

  const capacity = tableInfo?.capacity || 12;

  useEffect(() => {
    if (!branch) { setLoading(false); return; }
    const url = table
      ? `/public/menu?branchId=${branch}&tableId=${table}`
      : `/public/menu?branchId=${branch}`;
    api.get(url)
      .then((r) => {
        const d = r.data?.data || {};
        setBranchInfo(d.branch || null);
        setTableInfo(d.table || null);
        setPayCfg(d.payments || { acceptCash: true });
        setItems(d.items || []);
        setPopular(d.popular || []);
      })
      .catch(() => setError('Could not load the menu. Please check the link or ask our staff.'))
      .finally(() => setLoading(false));
  }, [branch, table]);

  // Default the pay choice once we know what the branch accepts.
  useEffect(() => {
    if (payChoice) return;
    if (payCfg.acceptUpi) setPayChoice('pay_now_upi');
    else setPayChoice('pay_later');
    if (!payCfg.acceptCash && payCfg.acceptUpi) setLaterMethod('UPI');
  }, [payCfg, payChoice]);

  // Poll the order status while it awaits staff confirmation.
  useEffect(() => {
    if (step !== 'placed' || !placed?.orderId) return;
    if (liveStatus?.confirmed || liveStatus?.declined) return;
    const tick = async () => {
      try {
        const r = await api.get(`/public/order/${placed.orderId}`);
        setLiveStatus(r.data?.data || null);
      } catch { /* keep polling */ }
    };
    tick();
    pollRef.current = setInterval(tick, 4000);
    return () => clearInterval(pollRef.current);
  }, [step, placed, liveStatus?.confirmed, liveStatus?.declined]);

  const priceOf = (it) => Number(it.discountedPrice || it.price || 0);
  const itemById = useMemo(() => {
    const m = new Map();
    items.forEach((it) => m.set(it._id, it));
    return m;
  }, [items]);

  const popularItems = useMemo(
    () => popular.map((p) => itemById.get(p.menuItem?.toString?.() || p.menuItem)).filter(Boolean),
    [popular, itemById]
  );

  const addItem = (it) => {
    if (!it) return;
    if (Array.isArray(it.modifierGroups) && it.modifierGroups.length > 0) {
      setModSel({}); setModItem(it); return;
    }
    setCart((c) => {
      const i = c.findIndex((x) => x.menuItem === it._id && (!x.modifiers || x.modifiers.length === 0));
      if (i > -1) { const n = [...c]; n[i] = { ...n[i], quantity: n[i].quantity + 1 }; return n; }
      return [...c, { key: `${it._id}-${c.length}-${Math.round(priceOf(it))}`, menuItem: it._id, name: it.name, price: priceOf(it), quantity: 1, modifiers: [] }];
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
    setCart((c) => [...c, { key: `${it._id}-${c.length}-${Date.now()}`, menuItem: it._id, name: it.name, price: priceOf(it) + delta, quantity: 1, modifiers }]);
    setModItem(null); setModSel({});
  };

  const changeQty = (key, d) => setCart((c) => c.map((x) => x.key === key ? { ...x, quantity: x.quantity + d } : x).filter((x) => x.quantity > 0));
  const cartCount = cart.reduce((a, x) => a + x.quantity, 0);
  const total = cart.reduce((a, x) => a + x.price * x.quantity, 0);

  // Keep member-name slots in sync with the party size.
  const setParty = (n) => {
    const size = Math.max(1, Math.min(capacity, n));
    setPartySize(size);
    setMemberNames((prev) => {
      const next = prev.slice(0, size);
      while (next.length < size) next.push('');
      return next;
    });
  };
  useEffect(() => { setParty(1); /* eslint-disable-next-line */ }, [tableInfo]);

  const upiUrl = payCfg.upiVpa
    ? buildUpiUrl({ vpa: payCfg.upiVpa, name: payCfg.upiName || branchInfo?.name, amount: total, note: `Order ${tableInfo ? `T${tableInfo.tableNumber}` : ''}`.trim() })
    : '';

  const doPlace = async () => {
    if (cart.length === 0) return;
    if (!name.trim()) { setError('Please enter your name'); setStep('checkout'); return; }
    setPlacing(true); setError('');
    try {
      const r = await api.post('/public/order', {
        branchId: branch,
        tableId: table || undefined,
        orderType: table ? 'dine-in' : 'takeaway',
        items: cart.map((x) => ({ menuItem: x.menuItem, quantity: x.quantity, modifiers: x.modifiers })),
        customerName: name.trim(),
        customerPhone: phone.trim(),
        members: memberNames.map((m) => m.trim()).filter(Boolean),
        numberOfPeople: partySize,
        paymentChoice: payChoice,
        payLaterMethod: payChoice === 'pay_later' ? laterMethod : undefined,
        upiRef: payChoice === 'pay_now_upi' ? upiRef.trim() : undefined,
      });
      const data = r.data?.data;
      setPlaced(data);
      setLiveStatus({ status: data?.status, approvalStatus: data?.approvalStatus, confirmed: !['AWAITING_APPROVAL'].includes(data?.status) });
      setStep('placed');
    } catch (e) {
      setError(e.response?.data?.message || 'Could not place the order. Please try again.');
      setStep('checkout');
    } finally { setPlacing(false); }
  };

  const proceedFromCheckout = () => {
    if (!name.trim()) { setError('Please enter your name'); return; }
    setError('');
    if (payChoice === 'pay_now_upi') setStep('upi');
    else doPlace();
  };

  const resetAll = () => {
    setCart([]); setStep('menu'); setPlaced(null); setLiveStatus(null);
    setUpiRef(''); setError(''); setName(name); // keep name for convenience
  };

  // ---- render helpers -------------------------------------------------------

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-(--color-bg-base) text-(--color-text-muted)"><Loader2 className="animate-spin mr-2" size={18} /> Loading menu…</div>;
  }
  if (!branch) {
    return <div className="min-h-screen flex items-center justify-center bg-(--color-bg-base) text-(--color-text-muted) p-6 text-center text-sm">Invalid ordering link. Please scan the QR code on your table again.</div>;
  }

  const Header = () => (
    <div className="text-center pt-6 pb-4">
      <div className="mx-auto mb-2 h-11 w-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
        <Utensils size={20} className="text-primary" />
      </div>
      <h1 className="text-xl font-bold text-(--color-text-primary) tracking-tight">{branchInfo?.name || 'Order'}</h1>
      <p className="text-[11px] font-bold text-(--color-text-muted) uppercase tracking-wide mt-0.5">
        {tableInfo ? `Table ${tableInfo.tableNumber}${tableInfo.tableName ? ` · ${tableInfo.tableName}` : ''} · seats up to ${tableInfo.capacity}` : 'Takeaway · scan & order'}
      </p>
    </div>
  );

  // ===== PLACED / STATUS =====
  if (step === 'placed') {
    const confirmed = liveStatus?.confirmed;
    const declined = liveStatus?.declined;
    return (
      <div className="min-h-screen bg-(--color-bg-base) flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center space-y-5">
          {declined ? (
            <>
              <XCircle size={64} className="text-danger mx-auto" />
              <h1 className="text-2xl font-bold text-(--color-text-primary)">Order not confirmed</h1>
              <p className="text-sm text-(--color-text-muted)">Your order could not be confirmed. Please speak to our staff at the counter.</p>
            </>
          ) : confirmed ? (
            <>
              <CheckCircle2 size={64} className="text-success mx-auto" />
              <h1 className="text-2xl font-bold text-(--color-text-primary)">Order confirmed! 🎉</h1>
              <p className="text-sm text-(--color-text-muted)">Your order is now with the kitchen. Sit back and relax{name ? `, ${name}` : ''}!</p>
            </>
          ) : (
            <>
              <div className="relative mx-auto h-16 w-16">
                <Clock size={64} className="text-primary mx-auto" />
                <Loader2 size={22} className="animate-spin text-primary absolute -bottom-1 -right-1" />
              </div>
              <h1 className="text-xl font-bold text-(--color-text-primary)">Order received!</h1>
              <p className="text-sm text-(--color-text-muted)">
                {placed?.method === 'UPI' && placed?.approvalStatus === 'pending'
                  ? 'We are verifying your UPI payment. This confirms automatically once our staff checks it — you can leave your table meanwhile.'
                  : 'Please pay at the counter. Our staff will confirm your order shortly — you can leave your table meanwhile.'}
              </p>
              <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-primary bg-primary/10 border border-primary/20 rounded-full px-3 py-1.5">
                <Loader2 size={12} className="animate-spin" /> Waiting for staff confirmation
              </div>
            </>
          )}

          {placed?.total != null && (
            <div className="rounded-2xl bg-(--color-surface) border border-(--color-border) p-4 text-left">
              <div className="flex justify-between text-sm"><span className="text-(--color-text-muted)">Order</span><span className="font-bold text-(--color-text-primary)">#{String(placed.orderId).slice(-6).toUpperCase()}</span></div>
              <div className="flex justify-between text-sm mt-1"><span className="text-(--color-text-muted)">Amount</span><span className="font-bold text-(--color-text-primary)">{money(placed.total)}</span></div>
              <div className="flex justify-between text-sm mt-1"><span className="text-(--color-text-muted)">Payment</span><span className="font-bold text-(--color-text-primary)">{placed.method === 'UPI' ? 'UPI' : 'Cash'}</span></div>
            </div>
          )}

          <button onClick={resetAll} className="w-full py-3.5 bg-primary text-(--color-on-primary) text-sm font-bold rounded-xl active:scale-[0.99]">
            Place another order
          </button>
        </div>
      </div>
    );
  }

  // ===== UPI PAY =====
  if (step === 'upi') {
    return (
      <div className="min-h-screen bg-(--color-bg-base) p-5">
        <div className="max-w-md mx-auto">
          <button onClick={() => setStep('checkout')} className="flex items-center gap-1.5 text-xs font-bold text-(--color-text-muted) mb-2"><ArrowLeft size={14} /> Back</button>
          <div className="text-center space-y-1 mb-5">
            <h1 className="text-xl font-bold text-(--color-text-primary)">Pay {money(total)} via UPI</h1>
            <p className="text-xs text-(--color-text-muted)">Scan with any UPI app, or tap the button on your phone.</p>
          </div>

          {payCfg.upiVpa ? (
            <>
              <div className="bg-white p-5 rounded-2xl border border-(--color-border) w-fit mx-auto shadow-sm">
                <QRCode value={upiUrl} size={200} />
              </div>
              <p className="text-center text-[11px] font-bold text-(--color-text-muted) mt-3">{payCfg.upiName || branchInfo?.name}</p>
              <p className="text-center text-xs font-mono text-(--color-text-primary) mt-0.5">{payCfg.upiVpa}</p>

              <a href={upiUrl} className="mt-4 w-full flex items-center justify-center gap-2 py-3.5 bg-primary text-(--color-on-primary) text-sm font-bold rounded-xl active:scale-[0.99]">
                <Smartphone size={16} /> Open UPI app to pay
              </a>

              <div className="mt-5 space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wide text-(--color-text-muted)">UPI reference / UTR (optional)</label>
                <input value={upiRef} onChange={(e) => setUpiRef(e.target.value)} placeholder="e.g. 4012 3456 7890" className="w-full px-4 py-3 rounded-xl bg-(--color-surface) border border-(--color-border) text-sm font-medium text-(--color-text-primary) outline-none focus:ring-2 focus:ring-primary/20" />
                <p className="text-[11px] text-(--color-text-muted)">Adding the reference helps our staff confirm your order faster.</p>
              </div>
            </>
          ) : (
            <div className="text-center text-sm text-(--color-text-muted) py-8">UPI is not configured for this branch. Please pay at the counter instead.</div>
          )}

          {error && <div className="mt-4 p-3 rounded-xl bg-danger/10 text-danger text-xs font-bold text-center">{error}</div>}

          <button onClick={doPlace} disabled={placing} className="mt-5 w-full flex items-center justify-center gap-2 py-4 bg-success text-white text-sm font-bold rounded-xl active:scale-[0.99] disabled:opacity-50">
            {placing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} {placing ? 'Submitting…' : "I've paid — submit order"}
          </button>
          <p className="text-[11px] text-center text-(--color-text-muted) mt-2">Your order is confirmed once our staff verifies the payment.</p>
        </div>
      </div>
    );
  }

  // ===== CHECKOUT =====
  if (step === 'checkout') {
    return (
      <div className="min-h-screen bg-(--color-bg-base) p-5 pb-40">
        <div className="max-w-md mx-auto">
          <button onClick={() => setStep('menu')} className="flex items-center gap-1.5 text-xs font-bold text-(--color-text-muted) mb-2"><ArrowLeft size={14} /> Back to menu</button>
          <h1 className="text-xl font-bold text-(--color-text-primary) mb-4">Almost there</h1>

          {error && <div className="mb-3 p-3 rounded-xl bg-danger/10 text-danger text-xs font-bold text-center">{error}</div>}

          {/* Your details */}
          <div className="space-y-3 bg-(--color-surface) border border-(--color-border) rounded-2xl p-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wide text-(--color-text-muted)">Your name <span className="text-danger">*</span></label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name" className="w-full px-4 py-3 rounded-xl bg-(--color-bg-soft) border border-(--color-border) text-sm font-medium text-(--color-text-primary) outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wide text-(--color-text-muted)">Phone (optional)</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric" placeholder="For order updates & rewards" className="w-full px-4 py-3 rounded-xl bg-(--color-bg-soft) border border-(--color-border) text-sm font-medium text-(--color-text-primary) outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>

          {/* Party members */}
          {tableInfo && (
            <div className="mt-4 bg-(--color-surface) border border-(--color-border) rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <label className="text-[11px] font-bold uppercase tracking-wide text-(--color-text-muted) flex items-center gap-1.5"><Users size={13} /> Who's at the table?</label>
                <div className="flex items-center gap-2">
                  <button onClick={() => setParty(partySize - 1)} className="h-7 w-7 rounded-lg bg-(--color-bg-soft) text-(--color-text-primary) flex items-center justify-center"><Minus size={13} /></button>
                  <span className="w-6 text-center text-sm font-bold text-(--color-text-primary)">{partySize}</span>
                  <button onClick={() => setParty(partySize + 1)} className="h-7 w-7 rounded-lg bg-(--color-bg-soft) text-(--color-text-primary) flex items-center justify-center"><Plus size={13} /></button>
                </div>
              </div>
              <p className="text-[11px] text-(--color-text-muted) mb-2">Up to {capacity} guests. Add names (optional) to split later.</p>
              <div className="space-y-2">
                {memberNames.map((m, i) => (
                  <input
                    key={i}
                    value={m}
                    onChange={(e) => setMemberNames((prev) => prev.map((x, idx) => idx === i ? e.target.value : x))}
                    placeholder={`Guest ${i + 1}${i === 0 ? ' (you)' : ''}`}
                    className="w-full px-4 py-2.5 rounded-xl bg-(--color-bg-soft) border border-(--color-border) text-sm font-medium text-(--color-text-primary) outline-none focus:ring-2 focus:ring-primary/20"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Payment */}
          <div className="mt-4 bg-(--color-surface) border border-(--color-border) rounded-2xl p-4">
            <label className="text-[11px] font-bold uppercase tracking-wide text-(--color-text-muted) mb-3 block">How would you like to pay?</label>
            <div className="space-y-2">
              {payCfg.acceptUpi && (
                <button onClick={() => setPayChoice('pay_now_upi')} className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${payChoice === 'pay_now_upi' ? 'border-primary bg-primary/10' : 'border-(--color-border) bg-(--color-bg-soft)'}`}>
                  <Smartphone size={18} className={payChoice === 'pay_now_upi' ? 'text-primary' : 'text-(--color-text-muted)'} />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-(--color-text-primary)">Pay now via UPI</p>
                    <p className="text-[11px] text-(--color-text-muted)">Prepay instantly — GPay, PhonePe, Paytm</p>
                  </div>
                  {payChoice === 'pay_now_upi' && <CheckCircle2 size={18} className="text-primary" />}
                </button>
              )}
              <button onClick={() => setPayChoice('pay_later')} className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${payChoice === 'pay_later' ? 'border-primary bg-primary/10' : 'border-(--color-border) bg-(--color-bg-soft)'}`}>
                <Wallet size={18} className={payChoice === 'pay_later' ? 'text-primary' : 'text-(--color-text-muted)'} />
                <div className="flex-1">
                  <p className="text-sm font-bold text-(--color-text-primary)">Pay at the counter</p>
                  <p className="text-[11px] text-(--color-text-muted)">Settle later by cash or UPI</p>
                </div>
                {payChoice === 'pay_later' && <CheckCircle2 size={18} className="text-primary" />}
              </button>

              {payChoice === 'pay_later' && (payCfg.acceptCash || payCfg.acceptUpi) && (
                <div className="flex gap-2 pt-1">
                  {payCfg.acceptCash && (
                    <button onClick={() => setLaterMethod('CASH')} className={`flex-1 py-2.5 rounded-xl text-xs font-bold border ${laterMethod === 'CASH' ? 'border-primary text-primary bg-primary/10' : 'border-(--color-border) text-(--color-text-muted)'}`}>Cash</button>
                  )}
                  {payCfg.acceptUpi && (
                    <button onClick={() => setLaterMethod('UPI')} className={`flex-1 py-2.5 rounded-xl text-xs font-bold border ${laterMethod === 'UPI' ? 'border-primary text-primary bg-primary/10' : 'border-(--color-border) text-(--color-text-muted)'}`}>UPI</button>
                  )}
                </div>
              )}
            </div>
          </div>

          <p className="text-[11px] text-center text-(--color-text-muted) mt-3">Your order is sent to the kitchen only after our staff confirms the payment.</p>
        </div>

        {/* Sticky proceed bar */}
        <div className="fixed bottom-0 inset-x-0 bg-(--color-surface) border-t border-(--color-border) shadow-2xl">
          <div className="max-w-md mx-auto p-4">
            <button onClick={proceedFromCheckout} disabled={placing} className="w-full flex items-center justify-center gap-2 py-4 bg-primary text-(--color-on-primary) text-sm font-bold rounded-xl active:scale-[0.99] disabled:opacity-50">
              {placing ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              {payChoice === 'pay_now_upi' ? `Continue to UPI · ${money(total)}` : `Place order · ${money(total)}`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===== MENU =====
  const MenuRow = (it) => {
    const inCartQty = cart.filter((x) => x.menuItem === it._id).reduce((a, x) => a + x.quantity, 0);
    return (
      <div key={it._id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-(--color-surface) border border-(--color-border)">
        <div className="flex items-center gap-3 min-w-0">
          {it.image
            ? <img src={it.image} alt={it.name} className="h-12 w-12 rounded-lg object-cover shrink-0" />
            : <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${it.dietaryType === 'veg' ? 'bg-success' : 'bg-danger'}`} />}
          <div className="min-w-0">
            <p className="text-sm font-bold text-(--color-text-primary) truncate">{it.name}</p>
            <p className="text-[11px] font-bold text-(--color-text-muted)">{money(priceOf(it))}{it.modifierGroups?.length ? ' · customizable' : ''}</p>
          </div>
        </div>
        <button onClick={() => addItem(it)} className="shrink-0 flex items-center gap-1 px-3 py-2 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wide rounded-lg border border-primary/20 active:scale-95">
          <Plus size={13} /> {inCartQty > 0 ? inCartQty : 'Add'}
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-(--color-bg-base) pb-32">
      <div className="max-w-lg mx-auto px-5">
        <Header />

        {error && <div className="mb-3 p-3 rounded-xl bg-danger/10 text-danger text-xs font-bold text-center">{error}</div>}

        {popularItems.length > 0 && (
          <div className="mb-5">
            <h2 className="text-[11px] font-bold uppercase tracking-wide text-(--color-text-muted) flex items-center gap-1.5 mb-2"><Flame size={13} className="text-primary" /> Popular here</h2>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
              {popularItems.map((it) => (
                <button key={it._id} onClick={() => addItem(it)} className="shrink-0 w-32 text-left bg-(--color-surface) border border-(--color-border) rounded-xl p-2 active:scale-95">
                  <div className="h-20 w-full rounded-lg overflow-hidden bg-(--color-bg-soft) mb-2 flex items-center justify-center">
                    {it.image ? <img src={it.image} alt={it.name} className="h-full w-full object-cover" /> : <Utensils size={20} className="text-(--color-text-muted)" />}
                  </div>
                  <p className="text-xs font-bold text-(--color-text-primary) truncate">{it.name}</p>
                  <p className="text-[11px] font-bold text-primary">{money(priceOf(it))}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        <h2 className="text-[11px] font-bold uppercase tracking-wide text-(--color-text-muted) mb-2">Menu</h2>
        <div className="space-y-2">
          {items.map((it) => MenuRow(it))}
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
                    <button onClick={() => changeQty(x.key, -1)} className="h-6 w-6 rounded-lg bg-(--color-bg-soft) text-(--color-text-muted) flex items-center justify-center"><Minus size={12} /></button>
                    <span className="w-5 text-center font-bold text-(--color-text-primary)">{x.quantity}</span>
                    <button onClick={() => changeQty(x.key, 1)} className="h-6 w-6 rounded-lg bg-(--color-bg-soft) text-(--color-text-muted) flex items-center justify-center"><Plus size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => { setError(''); setStep('checkout'); }} className="w-full flex items-center justify-center gap-2 py-4 bg-primary text-(--color-on-primary) text-sm font-bold rounded-xl active:scale-[0.99]">
              <ShoppingBag size={16} /> Review &amp; pay · {cartCount} item{cartCount > 1 ? 's' : ''} · {money(total)}
            </button>
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
                <p className="text-xs font-bold uppercase tracking-wide text-(--color-text-primary)">{g.name} <span className="text-(--color-text-muted)">{g.required ? '· required' : ''}</span></p>
                {g.options.map((o, oi) => {
                  const on = !!(modSel[g.name] && modSel[g.name][o.label]);
                  return (
                    <button key={oi} onClick={() => toggleMod(g, o.label)} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-bold ${on ? 'bg-primary/10 border-primary text-primary' : 'bg-(--color-bg-soft) border-(--color-border) text-(--color-text-primary)'}`}>
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
