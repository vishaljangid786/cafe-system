'use client';
import { useRef } from 'react';
import QRCode from 'react-qr-code';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import toast from 'react-hot-toast';
import { Printer, Download, Copy, QrCode, Link2 } from 'lucide-react';
import Modal from '../ui/Modal';

// The public self-ordering link a customer reaches by scanning the table QR.
export const orderUrl = (branchId, tableId) => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/order?branch=${branchId}&table=${tableId}`;
};

const tableLabel = (t) => (t.tableName ? `${t.tableName} · T${t.tableNumber}` : `Table ${t.tableNumber}`);
const branchIdOf = (t) => t.locationId?._id || t.locationId;

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

// Serialize the already-rendered SVG(s) into a fresh print window. More reliable
// than rasterizing when printing many codes at once.
const printCards = (cardsHtml, title) => {
  const w = window.open('', '_blank', 'width=820,height=920');
  if (!w) { toast.error('Please allow pop-ups to print QR codes'); return; }
  w.document.write(`<!doctype html><html><head><title>${title}</title><meta charset="utf-8"><style>${PRINT_CSS}</style></head><body>${cardsHtml}<script>window.onload=function(){setTimeout(function(){window.print();},250);};</script></body></html>`);
  w.document.close();
};

const cardHtml = ({ branchName, label, url, svg }) => `
  <div class="card">
    <h1>${branchName || 'Scan &amp; Order'}</h1>
    <h2>${label}</h2>
    <div class="qr">${svg || ''}</div>
    <p>Scan to view the menu &amp; order</p>
    <p class="url">${url}</p>
  </div>`;

// ---------------------------------------------------------------------------
// Single-table QR modal: view, print, download PDF, copy link.
// ---------------------------------------------------------------------------
export function TableQRModal({ isOpen, onClose, table, branchName }) {
  const cardRef = useRef(null);
  if (!table) return null;

  const url = orderUrl(branchIdOf(table), table._id);
  const label = tableLabel(table);

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(url); toast.success('Link copied'); }
    catch { toast.error('Could not copy the link'); }
  };

  const print = () => {
    const svg = cardRef.current?.querySelector('svg')?.outerHTML || '';
    printCards(`<div class="grid" style="grid-template-columns:1fr;max-width:340px;margin:0 auto">${cardHtml({ branchName, label, url, svg })}</div>`, label);
  };

  const downloadPdf = async () => {
    if (!cardRef.current) return;
    const t = toast.loading('Preparing PDF…');
    try {
      const canvas = await html2canvas(cardRef.current, { scale: 2, backgroundColor: '#ffffff' });
      const img = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
      const pw = pdf.internal.pageSize.getWidth();
      const props = pdf.getImageProperties(img);
      const w = Math.min(360, pw - 80);
      const h = (w * props.height) / props.width;
      pdf.addImage(img, 'PNG', (pw - w) / 2, 60, w, h);
      pdf.save(`${label.replace(/[^\w]+/g, '-')}-qr.pdf`);
      toast.success('PDF downloaded', { id: t });
    } catch { toast.error('Could not create the PDF', { id: t }); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`QR Code · ${label}`} maxWidth="max-w-md">
      <div className="space-y-5">
        <div ref={cardRef} className="mx-auto w-full max-w-xs rounded-2xl border border-(--color-border) bg-white p-6 text-center">
          <p className="text-sm font-bold text-slate-800">{branchName || 'Scan & Order'}</p>
          <p className="text-lg font-bold text-slate-900 mb-3">{label}</p>
          <div className="flex justify-center">
            <QRCode value={url} size={190} />
          </div>
          <p className="text-xs text-slate-500 mt-3">Scan to view the menu &amp; order</p>
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-(--color-bg-soft) border border-(--color-border) px-3 py-2">
          <Link2 size={14} className="text-(--color-text-muted) shrink-0" />
          <span className="text-[11px] text-(--color-text-muted) truncate flex-1">{url}</span>
          <button onClick={copyLink} className="shrink-0 text-primary"><Copy size={14} /></button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button onClick={print} className="flex flex-col items-center gap-1 py-3 rounded-xl bg-primary/10 text-primary border border-primary/20 text-[11px] font-bold active:scale-95">
            <Printer size={16} /> Print
          </button>
          <button onClick={downloadPdf} className="flex flex-col items-center gap-1 py-3 rounded-xl bg-(--color-bg-soft) text-(--color-text-primary) border border-(--color-border) text-[11px] font-bold active:scale-95">
            <Download size={16} /> PDF
          </button>
          <button onClick={copyLink} className="flex flex-col items-center gap-1 py-3 rounded-xl bg-(--color-bg-soft) text-(--color-text-primary) border border-(--color-border) text-[11px] font-bold active:scale-95">
            <Copy size={16} /> Copy
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Bulk QR modal: preview every table's code and print them all on one sheet.
// ---------------------------------------------------------------------------
export function TableQRBulkModal({ isOpen, onClose, tables = [], branchName }) {
  const gridRef = useRef(null);

  const printAll = () => {
    if (!gridRef.current || tables.length === 0) return;
    const cards = tables.map((t) => {
      const node = gridRef.current.querySelector(`[data-qr="${t._id}"] svg`);
      return cardHtml({
        branchName,
        label: tableLabel(t),
        url: orderUrl(branchIdOf(t), t._id),
        svg: node ? node.outerHTML : '',
      });
    }).join('');
    printCards(`<div class="grid">${cards}</div>`, `${branchName || 'Cafe'} — Table QR Codes`);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Print QR Codes · ${tables.length} table${tables.length === 1 ? '' : 's'}`} maxWidth="max-w-3xl">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-(--color-text-muted)">Every table's QR opens the self-ordering menu for that exact table. Print the whole sheet and place one on each table.</p>
          <button onClick={printAll} disabled={tables.length === 0} className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-(--color-on-primary) text-[11px] font-bold uppercase tracking-wide active:scale-95 disabled:opacity-50">
            <Printer size={15} /> Print all
          </button>
        </div>

        <div ref={gridRef} className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {tables.map((t) => (
            <div key={t._id} data-qr={t._id} className="rounded-xl border border-(--color-border) bg-white p-3 text-center">
              <p className="text-[11px] font-bold text-slate-900 mb-2">{tableLabel(t)}</p>
              <div className="flex justify-center">
                <QRCode value={orderUrl(branchIdOf(t), t._id)} size={112} />
              </div>
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
