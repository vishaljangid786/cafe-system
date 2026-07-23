'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import toast from 'react-hot-toast';
import { PageTransition, SlideIn } from '../../../components/ui/AnimatedContainer';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import Modal from '../../../components/ui/Modal';
import PremiumSelect from '@/app/components/ui/PremiumSelect';
import { Star, MessageSquare, Link2, Copy, QrCode, Download, Printer, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import QRCode from 'react-qr-code';
import RowDeleteButton from '@/app/components/ui/RowDeleteButton';

const PAGE_SIZE = 10;

// Minimal HTML escaping for the print window (branch name / URL come from our own
// data, but keep it safe since we inject them into a document.write string).
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export default function FeedbackPage() {
  const { user } = useAuth();
  const branchScoped = ['branch_admin', 'location_admin'].includes(user?.role);

  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const didInit = useRef(false);
  const [locations, setLocations] = useState([]);
  const [scope, setScope] = useState('');
  const [list, setList] = useState([]);
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
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

  // Debounce the typed search so we don't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // A new search term or branch always starts back at page 1.
  useEffect(() => { setPage(1); }, [search, scope]);

  const load = useCallback(async () => {
    if (!didInit.current) setLoading(true); else setRefetching(true);
    try {
      const params = new URLSearchParams();
      if (!branchScoped && scope) params.append('locationId', scope);
      if (search) params.append('search', search);
      params.append('page', String(page));
      params.append('limit', String(PAGE_SIZE));
      const res = await api.get(`/feedback?${params.toString()}`);
      setList(res.data.data || []);
      setStats(res.data.stats || null);
      setPagination(res.data.pagination || null);
    } catch (e) {
      console.error('Could not load feedback');
    } finally {
      didInit.current = true;
      setLoading(false);
      setRefetching(false);
    }
  }, [scope, branchScoped, search, page]);

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

  // Render the QR SVG onto a white canvas and hand back a PNG data URL — shared by
  // both Download and Print so the two always produce the same image.
  const qrToPng = (cb) => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;
    const svgStr = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const size = 600;
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
      cb(canvas.toDataURL('image/png'));
    };
    img.src = url;
  };

  const downloadQR = () => qrToPng((dataUrl) => {
    const a = document.createElement('a');
    a.download = `feedback-qr-${(selectedLocationName || 'branch').replace(/\s+/g, '-').toLowerCase()}.png`;
    a.href = dataUrl;
    a.click();
  });

  // Open a clean printable poster (QR + branch + instruction) and print it.
  const printQR = () => qrToPng((dataUrl) => {
    const w = window.open('', '_blank', 'width=520,height=720');
    if (!w) { toast.error('Allow pop-ups to print the QR'); return; }
    w.document.write(`<!doctype html><html><head><title>Feedback QR</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
        body{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:32px}
        .card{text-align:center;max-width:420px}
        h1{font-size:26px;font-weight:700;margin-bottom:6px;color:#111}
        .branch{font-size:16px;color:#555;margin-bottom:24px}
        img{width:320px;height:320px}
        .scan{font-size:18px;font-weight:600;margin-top:20px;color:#111}
        .url{font-size:11px;color:#888;margin-top:8px;word-break:break-all}
        @media print{ body{padding:0} }
      </style></head>
      <body>
        <div class="card">
          <h1>We'd love your feedback</h1>
          <p class="branch">${esc(selectedLocationName)}</p>
          <img src="${dataUrl}" onload="window.focus();window.print();" />
          <p class="scan">Scan to leave a quick review</p>
          <p class="url">${esc(feedbackLink)}</p>
        </div>
      </body></html>`);
    w.document.close();
  });

  const selectedLocationName = branchScoped
    ? (user?.assignedLocation?.name || 'Your Branch')
    : (locations.find(l => l._id === scope)?.name || '');

  if (loading) return <LoadingScreen fullScreen={false} />;

  const total = stats?.count || 0;
  const pages = pagination?.pages || 1;
  const listTotal = pagination?.total ?? list.length;

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
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={copyLink} className="flex items-center gap-1.5 px-3 py-2 bg-(--color-surface-soft) text-(--color-text-secondary) text-[11px] font-medium tracking-normal rounded-lg border border-(--color-border) hover:text-primary hover:border-primary/30 transition-all" title="Copy the feedback link">
                  <Copy size={12} /> Copy Link
                </button>
                <button onClick={() => setQrOpen(true)} className="flex items-center gap-1.5 px-3 py-2 bg-(--color-surface-soft) text-(--color-text-secondary) text-[11px] font-medium tracking-normal rounded-lg border border-(--color-border) hover:text-primary hover:border-primary/30 transition-all" title="Show the QR code">
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
          <div className="glass-card p-5 rounded-xl space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-sm font-semibold text-(--color-text-primary)">
                All reviews <span className="text-(--color-text-muted) font-normal">({listTotal})</span>
              </h2>
              <div className="relative w-full sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-(--color-text-muted)" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search by customer name…"
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-(--color-surface-soft) border border-(--color-border) text-xs font-medium text-(--color-text-primary) outline-none focus:border-primary"
                />
              </div>
            </div>

            {list.length === 0 ? (
              <p className="text-xs text-(--color-text-muted)">
                {search ? `No reviews match “${search}”.` : 'No feedback yet. Share the link above to start collecting.'}
              </p>
            ) : (
              <div className={`divide-y divide-(--color-border) transition-opacity ${refetching ? 'opacity-50' : ''}`}>
                {list.map((f) => (
                  <div key={f._id} className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={13} className={f.rating >= n ? 'text-amber-400 fill-amber-400' : 'text-(--color-border)'} />)}
                        <span className="text-[11px] font-medium text-(--color-text-primary) ml-2">{f.customerName || 'Guest'}</span>
                        {f.locationId?.name && <span className="text-[10px] text-(--color-text-muted) ml-1">· {f.locationId.name}</span>}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-(--color-text-muted)">{new Date(f.createdAt).toLocaleDateString('en-IN')}</span>
                        <RowDeleteButton
                          actionKey="feedback.delete"
                          endpoint={`/feedback/${f._id}`}
                          label={`${f.customerName || 'this guest'}'s feedback`}
                          description="Removing feedback changes this branch's rating average. The deletion itself is recorded in the audit log."
                          onDeleted={load}
                          size={13}
                          className="p-1.5!"
                        />
                      </div>
                    </div>
                    {f.comment && <p className="text-xs text-(--color-text-secondary) mt-1.5">{f.comment}</p>}
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-between pt-2 border-t border-(--color-border)">
                <p className="text-[11px] text-(--color-text-muted)">Page {page} of {pages}</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1 || refetching}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-(--color-border) bg-(--color-surface-soft) text-[11px] font-medium text-(--color-text-secondary) disabled:opacity-40 hover:text-primary hover:border-primary/30 transition-all"
                  >
                    <ChevronLeft size={13} /> Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(pages, p + 1))}
                    disabled={page >= pages || refetching}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-(--color-border) bg-(--color-surface-soft) text-[11px] font-medium text-(--color-text-secondary) disabled:opacity-40 hover:text-primary hover:border-primary/30 transition-all"
                  >
                    Next <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            )}
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
          <div className="grid grid-cols-3 w-full gap-2">
            <button
              onClick={copyLink}
              className="flex items-center justify-center gap-1.5 px-3 py-3 rounded-xl border border-(--color-border) bg-(--color-surface-soft) text-xs font-medium text-(--color-text-secondary) hover:text-primary hover:border-primary/30 transition-all"
            >
              <Copy size={14} /> Copy
            </button>
            <button
              onClick={downloadQR}
              className="flex items-center justify-center gap-1.5 px-3 py-3 rounded-xl border border-(--color-border) bg-(--color-surface-soft) text-xs font-medium text-(--color-text-secondary) hover:text-primary hover:border-primary/30 transition-all"
            >
              <Download size={14} /> PNG
            </button>
            <button
              onClick={printQR}
              className="flex items-center justify-center gap-1.5 px-3 py-3 rounded-xl bg-primary text-(--color-on-primary) text-xs font-semibold hover:opacity-90 transition-all"
            >
              <Printer size={14} /> Print
            </button>
          </div>
        </div>
      </Modal>
    </PageTransition>
  );
}
