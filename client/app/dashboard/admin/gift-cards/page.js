'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '../../../services/api';
import { digitsOnly, blockNegative } from '@/app/utils/inputValidation';
import toast from 'react-hot-toast';
import { PageTransition, SlideIn } from '../../../components/ui/AnimatedContainer';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { Money } from '@/app/components/ui/Money';
import { Gift, Plus, Search, IndianRupee } from 'lucide-react';

export default function GiftCardsPage() {
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState([]);
  const [form, setForm] = useState({ amount: '', issuedToName: '', issuedToPhone: '' });
  const [busy, setBusy] = useState(false);

  // lookup (balance check only — redemption happens at billing, against an order)
  const [code, setCode] = useState('');
  const [found, setFound] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/gift-cards');
      setCards(res.data.data || []);
    } catch (e) { console.error('Could not load gift cards'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const issue = async () => {
    if (!form.amount || Number(form.amount) <= 0) return toast.error('Enter an amount');
    setBusy(true);
    try {
      const res = await api.post('/gift-cards', form);
      toast.success(`Issued ${res.data.data.code}`);
      setForm({ amount: '', issuedToName: '', issuedToPhone: '' });
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Could not issue card'); }
    finally { setBusy(false); }
  };

  const lookup = async () => {
    if (!code) return;
    try {
      const res = await api.get(`/gift-cards/lookup/${code.toUpperCase()}`);
      setFound(res.data.data);
    } catch (e) { setFound(null); toast.error(e.response?.data?.message || 'Card not found'); }
  };

  if (loading) return <LoadingScreen />;

  const inputCls = 'px-3 py-2.5 rounded-xl bg-(--color-surface-soft) border border-(--color-border) text-xs font-medium text-(--color-text-primary) outline-none focus:border-primary';

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto space-y-6">
        <SlideIn>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10 text-primary"><Gift size={22} /></div>
            <div>
              <h1 className="text-2xl font-semibold text-(--color-text-primary) tracking-tight">Gift Cards</h1>
              <p className="text-[11px] font-medium text-(--color-text-muted) uppercase tracking-normal">Issue & redeem store credit</p>
            </div>
          </div>
        </SlideIn>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Issue */}
          <SlideIn delay={0.05}>
            <div className="glass-card p-6 rounded-xl space-y-3 h-full">
              <h2 className="text-sm font-semibold text-(--color-text-primary) flex items-center gap-2"><Plus size={15} className="text-primary" /> Issue a card</h2>
              <input type="number" min="0" onKeyDown={blockNegative} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="Amount (₹)" className={`${inputCls} w-full`} />
              <input value={form.issuedToName} onChange={(e) => setForm({ ...form, issuedToName: e.target.value })} placeholder="Recipient name (optional)" className={`${inputCls} w-full`} />
              <input type="tel" inputMode="numeric" maxLength={10} value={form.issuedToPhone} onChange={(e) => setForm({ ...form, issuedToPhone: digitsOnly(e.target.value, 10) })} placeholder="Phone (optional)" className={`${inputCls} w-full`} />
              <button onClick={issue} disabled={busy} className="w-full py-3 bg-primary text-(--color-on-primary) text-[11px] font-semibold uppercase tracking-normal rounded-xl hover:opacity-90 disabled:opacity-50">Issue card</button>
            </div>
          </SlideIn>

          {/* Lookup (balance check) */}
          <SlideIn delay={0.1}>
            <div className="glass-card p-6 rounded-xl space-y-3 h-full">
              <h2 className="text-sm font-semibold text-(--color-text-primary) flex items-center gap-2"><Search size={15} className="text-primary" /> Check balance</h2>
              <div className="flex gap-2">
                <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Card code (e.g. GC-XXXX)" className={`${inputCls} flex-1`} />
                <button onClick={lookup} className="px-4 py-2.5 bg-(--color-surface-soft) border border-(--color-border) text-[11px] font-medium uppercase tracking-normal rounded-xl text-(--color-text-primary)">Check</button>
              </div>
              {found && (
                <div className="p-3 rounded-xl bg-(--color-surface-soft) border border-(--color-border)">
                  <p className="text-xs font-medium text-(--color-text-primary)">{found.code} · balance <span className="text-primary font-semibold"><Money value={found.balance} /></span> {!found.active && <span className="text-danger">({found.expired ? 'expired' : 'inactive'})</span>}</p>
                </div>
              )}
              <p className="text-[11px] text-(--color-text-muted)">To redeem, open the order in All Orders → Redeem gift card.</p>
            </div>
          </SlideIn>
        </div>

        {/* List */}
        <SlideIn delay={0.15}>
          <div className="glass-card p-6 rounded-xl space-y-3">
            <h2 className="text-sm font-semibold text-(--color-text-primary)">Issued cards</h2>
            {cards.length === 0 && <p className="text-xs text-(--color-text-muted)">No gift cards yet.</p>}
            <div className="divide-y divide-(--color-border)">
              {cards.map((c) => (
                <div key={c._id} className="py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-xs font-medium text-(--color-text-primary)">{c.code} <span className="text-(--color-text-muted) text-[11px]">· {c.issuedToName || 'guest'}</span></p>
                    <p className="text-[11px] text-(--color-text-muted)">Issued <Money value={c.initialBalance} /> · {new Date(c.createdAt).toLocaleDateString('en-IN')}</p>
                  </div>
                  <span className={`text-sm font-semibold ${c.balance > 0 ? 'text-primary' : 'text-(--color-text-muted)'}`}><Money value={c.balance} /></span>
                </div>
              ))}
            </div>
          </div>
        </SlideIn>
      </div>
    </PageTransition>
  );
}
