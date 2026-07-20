'use client';
import { useRef, useState } from 'react';
import QRCode from 'react-qr-code';
import jsPDF from 'jspdf';
import toast from 'react-hot-toast';
import { Printer, Download, Copy, QrCode, Link2, Image as ImageIcon, Store } from 'lucide-react';
import Modal from '../ui/Modal';
import PremiumSelect from '../ui/PremiumSelect';

// The public self-ordering link. With a tableId it's a dine-in order for that
// exact table; without one it's a branch-wide takeaway / parcel link.
export const orderUrl = (branchId, tableId, qrToken) => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return tableId
    ? `${origin}/order?branch=${branchId}&table=${tableId}${qrToken ? `&token=${encodeURIComponent(qrToken)}` : ''}`
    : `${origin}/order?branch=${branchId}`;
};

const tableLabel = (t) => (t.tableName ? `${t.tableName} · T${t.tableNumber}` : `Table ${t.tableNumber}`);
const branchIdOf = (t) => t.locationId?._id || t.locationId;
const safe = (s) => (s || 'qr').toString().replace(/[^\w]+/g, '-');

// Escape any user-controlled string before it goes into the print-window HTML.
// Branch and table names are staff-settable, so an unescaped name like
// `<img src=x onerror=...>` would execute as script in the print popup (stored XSS).
const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const PRINT_CSS = `
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; padding: 24px; color: #0f172a; }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px; }
  .card { border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; text-align: center; page-break-inside: avoid; }
  .card h1 { font-size: 15px; margin: 0 0 2px; }
  .card h2 { font-size: 20px; margin: 0 0 12px; }
  .card .qr { display: flex; justify-content: center; margin: 8px 0; }
  .card .qr svg { width: 190px; height: 190px; }
  .card p { font-size: 12px; color: #64748b; margin: 8px 0 0; }
  .card .url { font-size: 9px; word-break: break-all; color: #94a3b8; margin-top: 6px; }
  @media print { body { padding: 0; } }
`;

const printCards = (cardsHtml, title) => {
  const w = window.open('', '_blank', 'width=820,height=920');
  if (!w) { toast.error('Please allow pop-ups to print QR codes'); return; }
  w.document.write(`<!doctype html><html><head><title>${escapeHtml(title)}</title><meta charset="utf-8"><style>${PRINT_CSS}</style></head><body>${cardsHtml}<script>window.onload=function(){setTimeout(function(){window.print();},250);};</script></body></html>`);
  w.document.close();
};

const cardHtml = ({ branchName, label, url, svg }) => `
  <div class="card">
    <h1>${escapeHtml(branchName || 'Scan & Order')}</h1>
    <h2>${escapeHtml(label)}</h2>
    <div class="qr">${svg || ''}</div>
    <p>Scan to view the menu &amp; order</p>
    <p class="url">${escapeHtml(url)}</p>
  </div>`;

// ---- Download helpers -------------------------------------------------------
// These render straight from the QR's <svg>, NOT via html2canvas — html2canvas
// 1.x can't parse Tailwind v4's oklch() colors and throws, which was breaking
// every download. Drawing the SVG onto a plain canvas sidesteps that entirely.

const svgFrom = (nodeOrSvg) =>
  (nodeOrSvg && nodeOrSvg.tagName && nodeOrSvg.tagName.toLowerCase() === 'svg')
    ? nodeOrSvg
    : (nodeOrSvg?.querySelector ? nodeOrSvg.querySelector('svg') : null);

const loadQrImage = (svgEl) => new Promise((resolve, reject) => {
  try {
    const xml = new XMLSerializer().serializeToString(svgEl);
    const src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)));
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  } catch (e) { reject(e); }
});

// A clean white poster canvas (title, subtitle, QR, footnote) for PNG/PDF export.
const buildPosterCanvas = async (svgEl, { title, subtitle, footnote } = {}) => {
  const img = await loadQrImage(svgEl);
  const W = 640, qr = 470, top = 150;
  const H = top + qr + 84;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  const font = (weight, size) => `${weight} ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.fillStyle = '#0f172a';
  ctx.font = font(600, 26);
  ctx.fillText(title || 'Scan & Order', W / 2, 64);
  ctx.font = font(700, 36);
  ctx.fillText(subtitle || '', W / 2, 112);
  ctx.drawImage(img, (W - qr) / 2, top, qr, qr);
  ctx.fillStyle = '#64748b';
  ctx.font = font(400, 18);
  ctx.fillText(footnote || 'Scan to view the menu & order', W / 2, top + qr + 44);
  return c;
};

const downloadPng = async (nodeOrSvg, meta, filename) => {
  const svg = svgFrom(nodeOrSvg);
  if (!svg) { toast.error('QR is not ready yet'); return; }
  const t = toast.loading('Preparing image…');
  try {
    const c = await buildPosterCanvas(svg, meta);
    const a = document.createElement('a');
    a.href = c.toDataURL('image/png');
    a.download = `${filename}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    toast.success('Image downloaded', { id: t });
  } catch { toast.error('Could not create the image', { id: t }); }
};

const downloadPdf = async (nodeOrSvg, meta, filename) => {
  const svg = svgFrom(nodeOrSvg);
  if (!svg) { toast.error('QR is not ready yet'); return; }
  const t = toast.loading('Preparing PDF…');
  try {
    const c = await buildPosterCanvas(svg, meta);
    const png = c.toDataURL('image/png');
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const pw = pdf.internal.pageSize.getWidth();
    const w = Math.min(360, pw - 80);
    const h = (w * c.height) / c.width;
    pdf.addImage(png, 'PNG', (pw - w) / 2, 60, w, h);
    pdf.save(`${filename}.pdf`);
    toast.success('PDF downloaded', { id: t });
  } catch { toast.error('Could not create the PDF', { id: t }); }
};

// A square white PNG of just the QR (for laying many into one PDF).
const svgToPng = async (svgEl, size = 512) => {
  const img = await loadQrImage(svgEl);
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, size, size);
  ctx.drawImage(img, 0, 0, size, size);
  return c.toDataURL('image/png');
};

const QRAction = ({ icon: Icon, label, onClick, primary }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center gap-1 py-3 rounded-xl text-[11px] font-bold active:scale-95 border ${primary ? 'bg-primary/10 text-primary border-primary/20' : 'bg-(--color-bg-soft) text-(--color-text-primary) border-(--color-border)'}`}
  >
    <Icon size={16} /> {label}
  </button>
);

// Shared white poster + link + actions used by both the table and branch modals.
function QRPoster({ title, subtitle, url, footnote = 'Scan to view the menu & order' }) {
  const cardRef = useRef(null);
  const fileBase = safe(`${title}-${subtitle}`);
  const meta = { title, subtitle, footnote };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(url); toast.success('Link copied'); }
    catch { toast.error('Could not copy the link'); }
  };
  const print = () => {
    const svg = cardRef.current?.querySelector('svg')?.outerHTML || '';
    printCards(`<div class="grid" style="grid-template-columns:1fr;max-width:340px;margin:0 auto">${cardHtml({ branchName: title, label: subtitle, url, svg })}</div>`, subtitle);
  };

  return (
    <div className="space-y-5">
      <div ref={cardRef} className="mx-auto w-full max-w-xs rounded-2xl border border-(--color-border) bg-white p-6 text-center">
        <p className="text-sm font-bold text-slate-800">{title || 'Scan & Order'}</p>
        <p className="text-lg font-bold text-slate-900 mb-3">{subtitle}</p>
        <div className="flex justify-center"><QRCode value={url} size={190} /></div>
        <p className="text-xs text-slate-500 mt-3">{footnote}</p>
      </div>

      <div className="flex items-center gap-2 rounded-xl bg-(--color-bg-soft) border border-(--color-border) px-3 py-2">
        <Link2 size={14} className="text-(--color-text-muted) shrink-0" />
        <span className="text-[11px] text-(--color-text-muted) truncate flex-1">{url}</span>
        <button onClick={copyLink} aria-label="Copy QR order link" title="Copy QR order link" className="shrink-0 text-primary"><Copy size={14} /></button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <QRAction icon={Printer} label="Print" primary onClick={print} />
        <QRAction icon={Download} label="PDF" onClick={() => downloadPdf(cardRef.current, meta, `${fileBase}-qr`)} />
        <QRAction icon={ImageIcon} label="PNG" onClick={() => downloadPng(cardRef.current, meta, `${fileBase}-qr`)} />
        <QRAction icon={Copy} label="Copy" onClick={copyLink} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single-table QR modal.
// ---------------------------------------------------------------------------
export function TableQRModal({ isOpen, onClose, table, branchName }) {
  if (!table) return null;
  const url = orderUrl(branchIdOf(table), table._id, table.publicOrderToken);
  const label = tableLabel(table);
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`QR Code · ${label}`} maxWidth="max-w-md">
      <QRPoster title={branchName} subtitle={label} url={url} />
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Branch (cafe-wide) takeaway / parcel QR — no table.
// ---------------------------------------------------------------------------
export function BranchQRModal({ isOpen, onClose, branchId, branchName, branches = [] }) {
  const list = Array.isArray(branches) ? branches : [];
  const [sel, setSel] = useState(branchId || (list[0]?._id || list[0]) || '');
  const activeId = sel || branchId || '';
  const activeName = list.find((b) => (b._id || b) === activeId)?.name || branchName || 'Cafe';

  if (!isOpen) return null;
  if (!activeId) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Cafe QR — Takeaway / Parcel" maxWidth="max-w-md">
        <div className="py-10 text-center text-sm text-(--color-text-muted)">
          <Store size={40} className="mx-auto mb-3 opacity-30" /> Select a branch to generate its takeaway QR.
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cafe QR — Takeaway / Parcel" maxWidth="max-w-md">
      <div className="space-y-4">
        <p className="text-xs text-(--color-text-muted)">
          One QR for the whole cafe. Customers scan it to order for takeaway / parcel — no table needed. Great for a queue at the counter or when every table is full.
        </p>
        {list.length > 1 && (
          <PremiumSelect
            label="Branch"
            value={activeId}
            onChange={setSel}
            options={list.map((b) => ({ label: b.name || b.city || 'Branch', value: b._id || b }))}
            placeholder="Select branch"
          />
        )}
        <QRPoster title={activeName} subtitle="Takeaway / Parcel" url={orderUrl(activeId)} footnote="Scan to order for takeaway" />
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Bulk QR modal: preview + print all + download all + per-card download.
// ---------------------------------------------------------------------------
export function TableQRBulkModal({ isOpen, onClose, tables = [], branchName }) {
  const gridRef = useRef(null);

  const printAll = () => {
    if (!gridRef.current || tables.length === 0) return;
    const cards = tables.map((t) => {
      const node = gridRef.current.querySelector(`[data-qr="${t._id}"] svg`);
      return cardHtml({ branchName, label: tableLabel(t), url: orderUrl(branchIdOf(t), t._id, t.publicOrderToken), svg: node ? node.outerHTML : '' });
    }).join('');
    printCards(`<div class="grid">${cards}</div>`, `${branchName || 'Cafe'} — Table QR Codes`);
  };

  // Lay every table's QR onto A4 pages (2 columns) and download as one PDF.
  const downloadAll = async () => {
    if (!gridRef.current || tables.length === 0) return;
    const t = toast.loading('Building PDF…');
    try {
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const margin = 32, cols = 2;
      const colW = (pw - margin * 2) / cols;
      const qr = 170, cellH = qr + 44;
      let y = margin + 24, col = 0;
      pdf.setFontSize(14);
      pdf.text(`${branchName || 'Cafe'} — Table QR Codes`, margin, margin + 6);
      for (const tbl of tables) {
        const svg = gridRef.current.querySelector(`[data-qr="${tbl._id}"] svg`);
        if (!svg) continue;
        const png = await svgToPng(svg, 512);
        if (col === 0 && y + cellH > ph - margin) { pdf.addPage(); y = margin; }
        const cx = margin + col * colW;
        pdf.setFontSize(11);
        pdf.text(tableLabel(tbl), cx + colW / 2, y + 12, { align: 'center' });
        pdf.addImage(png, 'PNG', cx + (colW - qr) / 2, y + 20, qr, qr);
        col += 1;
        if (col >= cols) { col = 0; y += cellH; }
      }
      pdf.save(`${safe(branchName)}-table-qr-codes.pdf`);
      toast.success('PDF downloaded', { id: t });
    } catch { toast.error('Could not build the PDF', { id: t }); }
  };

  const downloadOne = (tbl) => {
    const svg = gridRef.current?.querySelector(`[data-qr="${tbl._id}"] svg`);
    downloadPng(svg, { title: branchName, subtitle: tableLabel(tbl) }, `${safe(tableLabel(tbl))}-qr`);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Table QR Codes · ${tables.length} table${tables.length === 1 ? '' : 's'}`} maxWidth="max-w-3xl">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-(--color-text-muted) flex-1 min-w-40">Each table&apos;s QR opens the menu for that exact table. Print or download the whole set, or download one at a time.</p>
          <div className="flex items-center gap-2">
            <button onClick={downloadAll} disabled={tables.length === 0} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-(--color-bg-soft) text-(--color-text-primary) border border-(--color-border) text-[11px] font-bold uppercase tracking-wide active:scale-95 disabled:opacity-50">
              <Download size={15} /> Download all
            </button>
            <button onClick={printAll} disabled={tables.length === 0} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-(--color-on-primary) text-[11px] font-bold uppercase tracking-wide active:scale-95 disabled:opacity-50">
              <Printer size={15} /> Print all
            </button>
          </div>
        </div>

        <div ref={gridRef} className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {tables.map((t) => (
            <div key={t._id} className="relative">
              <div data-qr={t._id} className="rounded-xl border border-(--color-border) bg-white p-3 text-center">
                <p className="text-[11px] font-bold text-slate-900 mb-2">{tableLabel(t)}</p>
                <div className="flex justify-center"><QRCode value={orderUrl(branchIdOf(t), t._id, t.publicOrderToken)} size={112} /></div>
              </div>
              <button
                onClick={() => downloadOne(t)}
                title="Download this QR (PNG)"
                className="absolute top-1.5 right-1.5 h-7 w-7 rounded-lg bg-primary/90 text-white flex items-center justify-center shadow-sm active:scale-95"
              >
                <Download size={13} />
              </button>
            </div>
          ))}
          {tables.length === 0 && (
            <div className="col-span-full py-12 text-center text-sm text-(--color-text-muted)">
              <QrCode size={40} className="mx-auto mb-3 opacity-30" /> No tables to print. Add tables first.
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
