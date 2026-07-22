'use client';

import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import QRCode from 'react-qr-code';
import api from '../services/api';
import { Money } from '../components/ui/Money';
import { formatIndianCompact } from '../utils/formatNumber';
import {
  Plus, Minus, ShoppingBag, CheckCircle2, X, Users, Flame, Utensils,
  Loader2, Smartphone, Wallet, ArrowLeft, ArrowRight, Clock, XCircle, Trash2,
} from 'lucide-react';

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

const OrderHeader = ({ branchInfo, tableInfo }) => (
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

function OrderApp() {
  const params = useSearchParams();
  const branch = params.get('branch') || params.get('branchId') || '';
  const table = params.get('table') || params.get('tableId') || '';
  const qrToken = params.get('token') || params.get('qrToken') || '';

  const [loading, setLoading] = useState(true);
  const [branchInfo, setBranchInfo] = useState(null);
  const [tableInfo, setTableInfo] = useState(null);
  const [payCfg, setPayCfg] = useState({ acceptUpi: false, acceptCash: true, upiVpa: '', upiName: '', requireApproval: true });
  const [items, setItems] = useState([]);
  const [popular, setPopular] = useState([]);
  const [error, setError] = useState('');
  const [freeTables, setFreeTables] = useState([]);      // available tables to offer
  const [scannedTable, setScannedTable] = useState(null); // the table from the QR (may be taken)
  const [needsTableChoice, setNeedsTableChoice] = useState(false); // scanned table is booked

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

  // ── Customer identity (CRM) ────────────────────────────────────────────────
  // The browser holds an opaque HMAC token, never a phone lookup key. A recognised
  // customer is greeted and never asked to fill the form again.
  const [crmCfg, setCrmCfg] = useState({ askProfileOnScan: true, profileRequired: false });
  const [customerToken, setCustomerToken] = useState(null);
  const [profile, setProfile] = useState(null);      // { name, phone, gender, dob, email, dobLocked }
  const [offer, setOffer] = useState({ discountPercent: 0, maxDiscount: null, minOrder: 0, label: '' });
  const [showProfileSheet, setShowProfileSheet] = useState(false);
  const [profileMode, setProfileMode] = useState('new'); // 'new' | 'edit'
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [pForm, setPForm] = useState({ name: '', phone: '', gender: '', dob: '', email: '' });

  const capacity = tableInfo?.capacity || 12;

  useEffect(() => {
    if (!branch) { setLoading(false); return; }
    const url = table
      ? `/public/menu?branchId=${branch}&tableId=${table}&token=${encodeURIComponent(qrToken)}`
      : `/public/menu?branchId=${branch}`;
    api.get(url)
      .then((r) => {
        const d = r.data?.data || {};
        setBranchInfo(d.branch || null);
        setPayCfg(d.payments || { acceptCash: true });
        setCrmCfg(d.crm || { askProfileOnScan: true, profileRequired: false });
        setItems(d.items || []);
        setPopular(d.popular || []);
        setFreeTables(d.freeTables || []);
        const t = d.table || null;
        setScannedTable(t);
        if (t && t.available === false) {
          // The scanned table is already booked/in use — ask the guest to pick a free
          // one before ordering (they can still choose to order here / takeaway).
          setNeedsTableChoice(true);
          setTableInfo(null);
        } else {
          setNeedsTableChoice(false);
          setTableInfo(t); // available table, or null for a takeaway/branch-wide QR
        }
      })
      .catch(() => setError('Could not load the menu. Please check the link or ask our staff.'))
      .finally(() => setLoading(false));
  }, [branch, table, qrToken]);

  // Recognise a returning customer (or decide to ask). Runs once the branch is known.
  useEffect(() => {
    if (!branch || loading) return;
    let cancelled = false;

    const stored = (() => {
      try { return localStorage.getItem('cafeos_customer_token'); } catch { return null; }
    })();

    const askIfAllowed = () => {
      if (cancelled) return;
      // Only ask when the branch wants it, and not again in this browsing session
      // after they dismissed it.
      let dismissed = false;
      try { dismissed = sessionStorage.getItem('cafeos_profile_skipped') === '1'; } catch { /* ignore */ }
      if (crmCfg.askProfileOnScan && !dismissed) {
        setProfileMode('new');
        setShowProfileSheet(true);
      }
    };

    if (!stored) { askIfAllowed(); return undefined; }

    api.get(`/public/customer/me?token=${encodeURIComponent(stored)}&branchId=${branch}`)
      .then((r) => {
        if (cancelled) return;
        const d = r.data?.data || {};
        if (d.known) {
          setCustomerToken(stored);
          setProfile(d.profile);
          setOffer(d.offer || { discountPercent: 0 });
          // Pre-fill checkout so a known customer never retypes their details.
          if (d.profile?.name) setName(d.profile.name);
        } else {
          // Stale/foreign token — drop it and treat as a first visit.
          try { localStorage.removeItem('cafeos_customer_token'); } catch { /* ignore */ }
          askIfAllowed();
        }
      })
      .catch(() => { if (!cancelled) askIfAllowed(); });

    return () => { cancelled = true; };
  }, [branch, loading, crmCfg.askProfileOnScan]);

  const openProfileEditor = () => {
    setProfileError('');
    setProfileMode('edit');
    setPForm({
      name: profile?.name || '',
      phone: '', // never round-trip the masked value back as an edit
      gender: profile?.gender || '',
      dob: profile?.dob ? String(profile.dob).slice(0, 10) : '',
      email: profile?.email || '',
    });
    setShowProfileSheet(true);
  };

  const submitProfile = async () => {
    setProfileError('');
    const digits = (pForm.phone || '').replace(/\D/g, '');
    if (profileMode === 'new') {
      if (!pForm.name.trim()) return setProfileError('Please enter your name');
      if (digits.length < 10) return setProfileError('Please enter a valid 10-digit mobile number');
    }
    setSavingProfile(true);
    try {
      if (profileMode === 'new') {
        const r = await api.post('/public/customer/profile', {
          branchId: branch,
          tableId: table || undefined,
          qrToken: qrToken || undefined,
          name: pForm.name.trim(),
          phone: digits,
          gender: pForm.gender || undefined,
          dob: pForm.dob || undefined,
          email: pForm.email || undefined,
        });
        const d = r.data?.data || {};
        try { localStorage.setItem('cafeos_customer_token', d.customerToken); } catch { /* ignore */ }
        setCustomerToken(d.customerToken);
        setProfile(d.profile);
        setOffer(d.offer || { discountPercent: 0 });
        setName(d.profile?.name || pForm.name.trim());
        setPhone(digits);
      } else {
        const body = { token: customerToken, branchId: branch, name: pForm.name.trim() };
        if (pForm.gender) body.gender = pForm.gender;
        if (pForm.email !== undefined) body.email = pForm.email;
        if (digits.length >= 10) body.phone = digits;
        if (!profile?.dobLocked && pForm.dob) body.dob = pForm.dob;
        const r = await api.patch('/public/customer/profile', body);
        const d = r.data?.data || {};
        setProfile(d.profile);
        setOffer(d.offer || offer);
        setName(d.profile?.name || pForm.name.trim());
      }
      setShowProfileSheet(false);
    } catch (err) {
      setProfileError(err.response?.data?.message || 'Could not save your details. Please try again.');
    } finally {
      setSavingProfile(false);
    }
  };

  const skipProfile = async () => {
    try { sessionStorage.setItem('cafeos_profile_skipped', '1'); } catch { /* ignore */ }
    setShowProfileSheet(false);
    // Fire-and-forget: with no token this records nothing and creates no customer.
    api.post('/public/customer/skip', { branchId: branch, token: customerToken || undefined })
      .catch(() => { /* dismissing a form must never surface an error */ });
  };

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
        const r = await api.get(`/public/order/${placed.orderId}?branchId=${branch}`);
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
    if (it.tracksStock && (Number(it.stock) || 0) <= 0) { setError(`${it.name} is out of stock`); return; }
    if (it.tracksStock) {
      const inCart = cart.filter((x) => x.menuItem === it._id).reduce((a, x) => a + x.quantity, 0);
      if (inCart >= Number(it.stock)) { setError(`Only ${it.stock} ${it.name} available`); return; }
    }
    setError('');
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
  const removeLine = (key) => setCart((c) => c.filter((x) => x.key !== key));
  const cartCount = cart.reduce((a, x) => a + x.quantity, 0);
  const total = cart.reduce((a, x) => a + x.price * x.quantity, 0);

  // Quantity is controlled in ONE place — the menu card. These helpers drive its
  // stepper: `plain` = the cart line for this item with no modifiers.
  const plainLine = (it) => cart.find((x) => x.menuItem === it._id && (!x.modifiers || x.modifiers.length === 0));
  const plainQty = (it) => plainLine(it)?.quantity || 0;
  const totalQtyOf = (it) => cart.filter((x) => x.menuItem === it._id).reduce((a, x) => a + x.quantity, 0);
  const decPlain = (it) => { const l = plainLine(it); if (l) changeQty(l.key, -1); };

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
        // Order on the CHOSEN table (the scanned one if it was free, or the free table
        // the guest picked) — not necessarily the raw QR table, which may be booked.
        tableId: tableInfo?._id || undefined,
        orderType: tableInfo?._id ? 'dine-in' : 'takeaway',
        qrToken: tableInfo?._id ? (tableInfo.qrToken || qrToken) : undefined,
        items: cart.map((x) => ({ menuItem: x.menuItem, quantity: x.quantity, modifiers: x.modifiers })),
        customerName: name.trim(),
        customerPhone: phone.trim(),
        members: memberNames.map((m) => m.trim()).filter(Boolean),
        numberOfPeople: partySize,
        paymentChoice: payChoice,
        payLaterMethod: payChoice === 'pay_later' ? laterMethod : undefined,
        upiRef: payChoice === 'pay_now_upi' ? upiRef.trim() : undefined,
        // Identity only — the server resolves the customer and computes any
        // discount itself. The browser never sends a discount amount.
        customerToken: customerToken || undefined,
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

  // Guest resolved the "table is booked" prompt: order on a chosen table, or as takeaway.
  const chooseTable = (t) => { setTableInfo(t); setNeedsTableChoice(false); setError(''); };
  const orderTakeaway = () => { setTableInfo(null); setNeedsTableChoice(false); setError(''); };

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

  // ===== TABLE ALREADY BOOKED → pick a free table =====
  if (needsTableChoice) {
    return (
      <div className="min-h-screen bg-(--color-bg-base) p-5">
        <div className="max-w-md mx-auto">
          <OrderHeader branchInfo={branchInfo} tableInfo={tableInfo} />
          <div className="rounded-2xl bg-warning/10 border border-warning/30 p-4 text-center mb-5">
            <h2 className="text-base font-bold text-(--color-text-primary)">
              Table {scannedTable?.tableNumber}{scannedTable?.tableName ? ` · ${scannedTable.tableName}` : ''} is already booked
            </h2>
            <p className="text-xs text-(--color-text-muted) mt-1">
              {freeTables.length > 0
                ? 'Please pick one of the free tables below to place your order.'
                : 'No free tables are available right now.'}
            </p>
          </div>

          {freeTables.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-(--color-text-muted) px-1">Free tables</p>
              {freeTables.map((t) => (
                <button
                  key={t._id}
                  onClick={() => chooseTable(t)}
                  className="w-full flex items-center justify-between py-3.5 px-4 rounded-xl bg-(--color-surface) border border-(--color-border) hover:border-primary active:scale-[0.99] transition-colors"
                >
                  <span className="flex items-center gap-2 text-sm font-bold text-(--color-text-primary)">
                    <Utensils size={15} className="text-primary" />
                    Table {t.tableNumber}{t.tableName ? ` · ${t.tableName}` : ''}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-(--color-text-muted)">
                    <Users size={12} /> {t.capacity}
                    <ArrowRight size={14} className="text-primary ml-1" />
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="mt-5 space-y-2">
            <button
              onClick={orderTakeaway}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary text-(--color-on-primary) text-sm font-bold rounded-xl active:scale-[0.99]"
            >
              <ShoppingBag size={16} /> Order as takeaway
            </button>
            {scannedTable && (
              <button
                onClick={() => chooseTable(scannedTable)}
                className="w-full py-3 text-xs font-semibold text-(--color-text-muted) hover:text-(--color-text-primary) underline"
              >
                I&apos;m seated here — order at Table {scannedTable.tableNumber} anyway
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

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
              <div className="flex justify-between text-sm mt-1"><span className="text-(--color-text-muted)">Amount</span><span className="font-bold text-(--color-text-primary)"><Money value={placed.total} /></span></div>
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
            <h1 className="text-xl font-bold text-(--color-text-primary)">Pay <Money value={total} /> via UPI</h1>
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

          {/* Your order — review + direct remove per line */}
          <div className="mb-4 bg-(--color-surface) border border-(--color-border) rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[11px] font-bold uppercase tracking-wide text-(--color-text-muted)">Your order · {cartCount} item{cartCount > 1 ? 's' : ''}</h2>
              <button onClick={() => setStep('menu')} className="text-[11px] font-bold text-primary flex items-center gap-1"><Plus size={12} /> Add more</button>
            </div>
            {cart.length === 0 ? (
              <p className="text-sm text-(--color-text-muted) text-center py-4">Your cart is empty. Add items from the menu.</p>
            ) : (
              <>
                <div className="space-y-2.5">
                  {cart.map((x) => (
                    <div key={x.key} className="flex items-center gap-3">
                      <span className="h-6 min-w-6 px-1.5 rounded-md bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">{x.quantity}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-(--color-text-primary) truncate">{x.name}</p>
                        {x.modifiers?.length > 0 && <p className="text-[11px] text-(--color-text-muted) truncate">{x.modifiers.map((m) => m.label).join(', ')}</p>}
                      </div>
                      <span className="text-sm font-bold text-(--color-text-primary) shrink-0"><Money value={x.price * x.quantity} /></span>
                      <button onClick={() => removeLine(x.key)} title="Remove" className="h-8 w-8 rounded-lg bg-danger/10 text-danger flex items-center justify-center shrink-0 active:scale-90"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
                {/* Display only — the authoritative discount comes back on the
                    order response, because the server computes it. */}
                {offer.discountPercent > 0 && total >= (offer.minOrder || 0) && (
                  <div className="flex justify-between items-center mt-3 text-success">
                    <span className="text-[11px] font-bold uppercase tracking-wide">
                      New customer −{offer.discountPercent}%
                    </span>
                    <span className="text-xs font-bold">
                      −<Money value={Math.min(
                        (total * offer.discountPercent) / 100,
                        offer.maxDiscount == null ? Infinity : Number(offer.maxDiscount)
                      )} />
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-(--color-border)">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-(--color-text-muted)">Total</span>
                  <span className="text-lg font-bold text-(--color-text-primary)"><Money value={total} /></span>
                </div>
              </>
            )}
          </div>

          {/* Your details */}
          <div className="space-y-3 bg-(--color-surface) border border-(--color-border) rounded-2xl p-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wide text-(--color-text-muted)">Your name <span className="text-danger">*</span></label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name" className="w-full px-4 py-3 rounded-xl bg-(--color-bg-soft) border border-(--color-border) text-sm font-medium text-(--color-text-primary) outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wide text-(--color-text-muted)">Phone (optional)</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" maxLength={10} placeholder="10-digit mobile (for updates & rewards)" className="w-full px-4 py-3 rounded-xl bg-(--color-bg-soft) border border-(--color-border) text-sm font-medium text-(--color-text-primary) outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>

          {/* Party members */}
          {tableInfo && (
            <div className="mt-4 bg-(--color-surface) border border-(--color-border) rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <label className="text-[11px] font-bold uppercase tracking-wide text-(--color-text-muted) flex items-center gap-1.5"><Users size={13} /> Who&apos;s at the table?</label>
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
            <button onClick={proceedFromCheckout} disabled={placing || cart.length === 0} className="w-full flex items-center justify-center gap-2 py-4 bg-primary text-(--color-on-primary) text-sm font-bold rounded-xl active:scale-[0.99] disabled:opacity-50">
              {placing ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              {cart.length === 0 ? 'Add items to continue' : payChoice === 'pay_now_upi' ? `Continue to UPI · ${formatIndianCompact(total, { currency: true })}` : `Place order · ${formatIndianCompact(total, { currency: true })}`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===== MENU =====
  const StockTag = ({ it }) => {
    if (!it.tracksStock) return null;
    const q = Number(it.stock) || 0;
    return (
      <span className={`text-[10px] font-bold uppercase tracking-wide ${q <= 0 ? 'text-danger' : q <= 5 ? 'text-warning' : 'text-success'}`}>
        {q <= 0 ? 'Out' : `${q} left`}
      </span>
    );
  };

  // A veg / non-veg square marker (the familiar Indian food indicator).
  const DietDot = ({ type }) => (
    <span className={`h-4 w-4 rounded-[4px] border flex items-center justify-center bg-white/90 ${type === 'veg' ? 'border-success' : 'border-danger'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${type === 'veg' ? 'bg-success' : 'bg-danger'}`} />
    </span>
  );

  // Image-forward menu card with an inline quantity stepper (the single place to
  // add / remove qty). − turns into a trash at qty 1 so removing is one tap.
  const MenuCard = (it) => {
    const hasMods = it.modifierGroups?.length > 0;
    const soldOut = it.tracksStock && (Number(it.stock) || 0) <= 0;
    const q = hasMods ? totalQtyOf(it) : plainQty(it);
    return (
      <div key={it._id} className={`rounded-2xl bg-(--color-surface) border border-(--color-border) overflow-hidden flex flex-col ${soldOut ? 'opacity-60' : ''}`}>
        <div className="relative aspect-square bg-(--color-bg-soft)">
          {it.image
            ? <img src={it.image} alt={it.name} className="h-full w-full object-cover" />
            : <div className="h-full w-full flex items-center justify-center text-(--color-text-muted)"><Utensils size={26} /></div>}
          <span className="absolute top-2 left-2"><DietDot type={it.dietaryType} /></span>
          {it.tracksStock && !soldOut && (Number(it.stock) || 0) <= 5 && (
            <span className="absolute top-2 right-2 text-[9px] font-bold uppercase tracking-wide bg-warning/90 text-white px-1.5 py-0.5 rounded-md">{it.stock} left</span>
          )}
          {soldOut && (
            <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
              <span className="text-[11px] font-bold uppercase tracking-wide text-white bg-danger/90 px-2 py-1 rounded-md">Sold out</span>
            </div>
          )}
        </div>

        <div className="p-2.5 flex flex-col gap-1.5 flex-1">
          <p className="text-[13px] font-bold text-(--color-text-primary) leading-tight line-clamp-2 min-h-[2.4em]">{it.name}</p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-bold text-primary"><Money value={priceOf(it)} /></span>
            {it.discountedPrice && it.discountedPrice < it.price && (
              <span className="text-[10px] font-medium text-(--color-text-muted) line-through"><Money value={it.price} /></span>
            )}
          </div>
          {hasMods && <span className="text-[10px] font-bold text-(--color-text-muted) -mt-0.5">customizable</span>}

          <div className="mt-auto pt-1">
            {soldOut ? (
              <button disabled className="w-full py-2 rounded-xl bg-(--color-bg-soft) text-(--color-text-muted) text-xs font-bold">Unavailable</button>
            ) : (!hasMods && q > 0) ? (
              <div className="flex items-center justify-between rounded-xl bg-primary/10 border border-primary/25 p-1">
                <button onClick={() => decPlain(it)} className="h-8 w-8 rounded-lg bg-(--color-surface) text-primary flex items-center justify-center active:scale-90 shadow-sm">
                  {q > 1 ? <Minus size={15} /> : <Trash2 size={14} />}
                </button>
                <span className="text-sm font-bold text-primary tabular-nums">{q}</span>
                <button onClick={() => addItem(it)} className="h-8 w-8 rounded-lg bg-primary text-(--color-on-primary) flex items-center justify-center active:scale-90 shadow-sm"><Plus size={15} /></button>
              </div>
            ) : (
              <button onClick={() => addItem(it)} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-primary text-(--color-on-primary) text-xs font-bold active:scale-95 shadow-sm">
                <Plus size={14} /> Add{hasMods && q > 0 ? ` · ${q}` : ''}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-(--color-bg-base) pb-32">
      <div className="max-w-lg mx-auto px-5">
        <OrderHeader branchInfo={branchInfo} tableInfo={tableInfo} />

        {/* Recognised customer: greet, never re-ask for details. */}
        {profile && (
          <div className="mb-3 flex items-center justify-between gap-3 p-3 rounded-xl bg-(--color-surface) border border-(--color-border)">
            <div className="min-w-0">
              <p className="text-xs font-bold text-(--color-text-primary) truncate">
                Welcome back, {profile.name}
              </p>
              {offer.discountPercent > 0 && (
                <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-success/15 text-success text-[10px] font-bold">
                  {offer.discountPercent}% off your first order here
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={openProfileEditor}
              className="shrink-0 text-[11px] font-bold text-primary underline underline-offset-2"
            >
              Edit details
            </button>
          </div>
        )}

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
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-[11px] font-bold text-primary"><Money value={priceOf(it)} /></p>
                    <StockTag it={it} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <h2 className="text-[11px] font-bold uppercase tracking-wide text-(--color-text-muted) mb-3">Menu</h2>
        {items.length === 0 ? (
          <p className="text-center text-sm text-(--color-text-muted) py-8">No items available right now.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {items.map((it) => MenuCard(it))}
          </div>
        )}
      </div>

      {/* Cart bar — single review CTA (quantity is managed on the cards) */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 bg-(--color-surface)/95 backdrop-blur border-t border-(--color-border) shadow-2xl">
          <div className="max-w-lg mx-auto p-4">
            <button onClick={() => { setError(''); setStep('checkout'); }} className="w-full flex items-center justify-between py-3.5 px-5 bg-primary text-(--color-on-primary) rounded-xl active:scale-[0.99] shadow-sm">
              <span className="flex items-center gap-2 text-sm font-bold"><ShoppingBag size={17} /> {cartCount} item{cartCount > 1 ? 's' : ''}</span>
              <span className="flex items-center gap-2 text-sm font-bold">Review &amp; pay · <Money value={total} /> <ArrowRight size={16} /></span>
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
                      <span>{o.label}</span>{o.priceDelta ? <span className="text-xs"><Money value={o.priceDelta} prefix="+" /></span> : null}
                    </button>
                  );
                })}
              </div>
            ))}
            <button onClick={confirmMods} className="w-full py-3.5 bg-primary text-(--color-on-primary) text-sm font-bold rounded-xl">Add to order</button>
          </div>
        </div>
      )}

      {/* First-visit / edit sheet. Rendered OVER the menu so a guest can still
          browse; only dismissable when the branch has not made it mandatory. */}
      {showProfileSheet && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-(--color-surface) rounded-t-2xl sm:rounded-2xl p-5 max-h-[92vh] overflow-y-auto">
            <h3 className="text-base font-bold text-(--color-text-primary)">
              {profileMode === 'edit' ? 'Your details' : `Welcome to ${branchInfo?.name || 'our cafe'}`}
            </h3>
            {profileMode === 'new' && (
              <p className="text-xs text-(--color-text-muted) mt-1">
                {offer.discountPercent > 0 || crmCfg.askProfileOnScan
                  ? 'Tell us who you are so we can set up your rewards.'
                  : 'Tell us who you are.'}
              </p>
            )}

            <div className="space-y-3 mt-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide text-(--color-text-muted)">Name</label>
                <input
                  value={pForm.name}
                  onChange={(e) => setPForm({ ...pForm, name: e.target.value })}
                  placeholder="Your name"
                  className="mt-1 w-full px-3 py-2.5 rounded-xl bg-(--color-bg-soft) border border-(--color-border) text-sm outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide text-(--color-text-muted)">
                  Mobile {profileMode === 'edit' && <span className="normal-case font-medium">(currently {profile?.phone})</span>}
                </label>
                <input
                  value={pForm.phone}
                  onChange={(e) => setPForm({ ...pForm, phone: e.target.value.replace(/\D/g, '').slice(0, 15) })}
                  inputMode="numeric"
                  placeholder={profileMode === 'edit' ? 'Enter a new number to change it' : '10-digit mobile number'}
                  className="mt-1 w-full px-3 py-2.5 rounded-xl bg-(--color-bg-soft) border border-(--color-border) text-sm outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide text-(--color-text-muted)">Gender</label>
                <div className="mt-1 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {[
                    { v: 'male', l: 'Male' }, { v: 'female', l: 'Female' },
                    { v: 'other', l: 'Other' }, { v: 'prefer_not_to_say', l: 'Skip' },
                  ].map((g) => (
                    <button
                      key={g.v}
                      type="button"
                      onClick={() => setPForm({ ...pForm, gender: g.v })}
                      className={`py-2 rounded-lg text-[11px] font-bold transition-colors ${
                        pForm.gender === g.v
                          ? 'bg-primary text-(--color-on-primary)'
                          : 'bg-(--color-bg-soft) text-(--color-text-muted)'
                      }`}
                    >
                      {g.l}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide text-(--color-text-muted) flex items-center gap-1.5">
                  Date of birth {profile?.dobLocked && <span title="Locked once set">🔒</span>}
                </label>
                <input
                  type="date"
                  value={pForm.dob}
                  disabled={!!profile?.dobLocked}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setPForm({ ...pForm, dob: e.target.value })}
                  className={`mt-1 w-full px-3 py-2.5 rounded-xl border border-(--color-border) text-sm outline-none focus:border-primary ${
                    profile?.dobLocked ? 'bg-(--color-bg-soft)/50 text-(--color-text-muted) cursor-not-allowed' : 'bg-(--color-bg-soft)'
                  }`}
                />
                <p className="mt-1 text-[10px] text-(--color-text-muted)">
                  Used for special birthday offers. Once set, it can&apos;t be changed.
                </p>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide text-(--color-text-muted)">Email (optional)</label>
                <input
                  type="email"
                  value={pForm.email}
                  onChange={(e) => setPForm({ ...pForm, email: e.target.value })}
                  placeholder="you@example.com"
                  className="mt-1 w-full px-3 py-2.5 rounded-xl bg-(--color-bg-soft) border border-(--color-border) text-sm outline-none focus:border-primary"
                />
              </div>
            </div>

            {profileError && (
              <p className="mt-3 p-2.5 rounded-lg bg-danger/10 text-danger text-[11px] font-bold text-center">{profileError}</p>
            )}

            <div className="mt-4 flex gap-2">
              {profileMode === 'new' && !crmCfg.profileRequired && (
                <button
                  type="button"
                  onClick={skipProfile}
                  className="px-4 py-3 rounded-xl bg-(--color-bg-soft) text-(--color-text-muted) text-sm font-bold"
                >
                  Skip
                </button>
              )}
              {profileMode === 'edit' && (
                <button
                  type="button"
                  onClick={() => setShowProfileSheet(false)}
                  className="px-4 py-3 rounded-xl bg-(--color-bg-soft) text-(--color-text-muted) text-sm font-bold"
                >
                  Close
                </button>
              )}
              <button
                type="button"
                onClick={submitProfile}
                disabled={savingProfile}
                className="flex-1 py-3 rounded-xl bg-primary text-(--color-on-primary) text-sm font-bold disabled:opacity-60"
              >
                {savingProfile
                  ? 'Saving…'
                  : profileMode === 'edit'
                    ? 'Save changes'
                    : offer.discountPercent > 0
                      ? `Get ${offer.discountPercent}% off`
                      : 'Continue'}
              </button>
            </div>
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
