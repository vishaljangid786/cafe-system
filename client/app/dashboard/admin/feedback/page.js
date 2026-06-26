'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import toast from 'react-hot-toast';
import { PageTransition, SlideIn } from '../../../components/ui/AnimatedContainer';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import Modal from '../../../components/ui/Modal';
import PremiumSelect from '@/app/components/ui/PremiumSelect';
import { Star, MessageSquare, Link2, Copy, QrCode, Download } from 'lucide-react';
import QRCode from 'react-qr-code';

export default function FeedbackPage() {
  const { user } = useAuth();
  const branchScoped = ['branch_admin', 'location_admin'].includes(user?.role);

  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState([]);
  const [scope, setScope] = useState('');
  const [list, setList] = useState([]);
  const [stats, setStats] = useState(null);
  const [qrOpen, setQrOpen] = useState(false);
  const qrRef = useRef(null);

  useEffect(() => {
    if (!user || branchScoped) return;
    api.get('/locations').then((r) => {
      const locs = r.data?.data || r.data || [];
      setLocations(locs);
      setScope(locs[0]?._id || '');
    }).catch(() => {});
  }, [user, branchScoped]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = !branchScoped && scope ? `?locationId=${scope}` : '';
      const res = await api.get(`/feedback${q}`);
      setList(res.data.data || []);
      setStats(res.data.stats || null);
    } catch (e) {
      toast.error('Could not load feedback');
    } finally {
      setLoading(false);
    }
  }, [scope, branchScoped]);

  useEffect(() => { if (user) load(); }, [user, load]);

  const branchForLink = branchScoped ? (user?.assignedLocation?._id || user?.assignedLocation) : scope;
  const feedbackLink = branchForLink && typeof window !== 'undefined'
    ? `${window.location.origin}/feedback?branch=${branchForLink}`
    : '';

  const copyLink = () => {
    if (!feedbackLink) return;
    navigator.clipboard?.writeText(feedbackLink);
    toast.success('Feedback link copied');
  };

  const downloadQR = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const canvas = document.createElement('canvas');
    const size = 400;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      const a = document.createElement('a');
      a.download = 'feedback-qr.png';
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = url;
  };

  const selectedLocationName = branchScoped
    ? (user?.assignedLocation?.name || 'Your Branch')
    : (locations.find(l => l._id === scope)?.name || '');

  if (loading) return <LoadingScreen />;

  const total = stats?.count || 0;

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto space-y-6">
        <SlideIn>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary/10 text-primary"><MessageSquare size={22} /></div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold text-(--color-text-primary) tracking-tight">Customer Feedback</h1>
                <p className="text-[11px] font-medium text-(--color-text-muted) tracking-normal">Ratings & reviews</p>
              </div>
            </div>
            {!branchScoped && (
              <div className="w-48">
                <PremiumSelect
                  value={scope}
                  onChange={setScope}
                  options={locations.map((l) => ({ label: l.name, value: l._id }))}
                  placeholder="Select branch"
                />
              </div>
            )}
          </div>
        </SlideIn>

        {/* Shareable link + QR */}
        {feedbackLink && (
          <SlideIn delay={0.05}>
            <div className="glass-card p-4 rounded-xl flex items-center gap-3 flex-wrap">
              <Link2 size={16} className="text-primary shrink-0" />
              <span className="text-[11px] font-medium text-(--color-text-muted) flex-1 min-w-40 truncate">{feedbackLink}</span>
              <div className="flex items-center gap-2">
                <button onClick={copyLink} className="flex items-center gap-1.5 px-3 py-2 bg-(--color-surface-soft) text-(--color-text-secondary) text-[11px] font-medium tracking-normal rounded-lg border border-(--color-border) hover:text-primary hover:border-primary/30 transition-all">
                  <Copy size={12} /> Copy Link
                </button>
                <button onClick={() => setQrOpen(true)} className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 text-primary text-[11px] font-medium tracking-normal rounded-lg border border-primary/20 hover:bg-primary hover:text-(--color-on-primary) transition-all">
                  <QrCode size={12} /> Show QR
                </button>
              </div>
            </div>
          </SlideIn>
        )}

        {/* Stats */}
        <SlideIn delay={0.1}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-card p-5 rounded-xl text-center">
              <p className="text-[11px] font-medium tracking-normal text-(--color-text-muted)">Average rating</p>
              <p className="text-2xl font-semibold text-(--color-text-primary) tracking-tight mt-1">{stats?.avgRating || 0}<span className="text-lg text-(--color-text-muted)">/5</span></p>
              <div className="flex justify-center gap-0.5 mt-2">
                {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={16} className={(stats?.avgRating || 0) >= n - 0.5 ? 'text-amber-400 fill-amber-400' : 'text-(--color-border)'} />)}
              </div>
              <p className="text-[11px] text-(--color-text-muted) mt-2">{total} review{total === 1 ? '' : 's'}</p>
            </div>
            <div className="glass-card p-5 rounded-xl md:col-span-2 space-y-1.5">
              {[5, 4, 3, 2, 1].map((n) => {
                const c = stats?.distribution?.[n] || 0;
                const pct = total ? Math.round((c / total) * 100) : 0;
                return (
                  <div key={n} className="flex items-center gap-3">
                    <span className="text-[11px] font-medium text-(--color-text-muted) w-6">{n}★</span>
                    <div className="flex-1 h-2 rounded-full bg-(--color-surface-soft) overflow-hidden">
                      <div className="h-full bg-amber-400" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[11px] font-medium text-(--color-text-muted) w-8 text-right">{c}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </SlideIn>

        {/* Reviews */}
        <SlideIn delay={0.15}>
          <div className="glass-card p-5 rounded-xl space-y-3">
            <h2 className="text-sm font-semibold text-(--color-text-primary)">Recent reviews</h2>
            {list.length === 0 && <p className="text-xs text-(--color-text-muted)">No feedback yet. Share the link above to start collecting.</p>}
            <div className="divide-y divide-(--color-border)">
              {list.map((f) => (
                <div key={f._id} className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={13} className={f.rating >= n ? 'text-amber-400 fill-amber-400' : 'text-(--color-border)'} />)}
                      <span className="text-[11px] font-medium text-(--color-text-primary) ml-2">{f.customerName || 'Guest'}</span>
                    </div>
                    <span className="text-[9px] text-(--color-text-muted)">{new Date(f.createdAt).toLocaleDateString('en-IN')}</span>
                  </div>
                  {f.comment && <p className="text-xs text-(--color-text-secondary) mt-1.5">{f.comment}</p>}
                </div>
              ))}
            </div>
          </div>
        </SlideIn>
      </div>

      {/* QR Code Modal */}
      <Modal isOpen={qrOpen} onClose={() => setQrOpen(false)} title="Feedback QR Code" maxWidth="max-w-sm">
        <div className="flex flex-col items-center gap-6 p-4">
          <p className="text-xs text-(--color-text-muted) text-center">
            Customers scan this to leave feedback for{' '}
            <span className="font-medium text-(--color-text-primary)">{selectedLocationName}</span>.
          </p>
          <div ref={qrRef} className="p-5 bg-white rounded-2xl shadow-sm">
            <QRCode
              value={feedbackLink}
              size={200}
              level="H"
              style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
            />
          </div>
          <p className="text-[10px] text-(--color-text-muted) text-center break-all px-2">{feedbackLink}</p>
          <div className="flex w-full gap-3">
            <button
              onClick={copyLink}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-(--color-border) bg-(--color-surface-soft) text-xs font-medium text-(--color-text-secondary) hover:text-primary hover:border-primary/30 transition-all"
            >
              <Copy size={14} /> Copy Link
            </button>
            <button
              onClick={downloadQR}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-(--color-on-primary) text-xs font-semibold hover:opacity-90 transition-all"
            >
              <Download size={14} /> Download PNG
            </button>
          </div>
        </div>
      </Modal>
    </PageTransition>
  );
}
