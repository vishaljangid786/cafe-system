"use client"
import { useRef, useState, useEffect } from 'react';
import { Printer, Download, Check, X, Camera, Loader2, Banknote, Smartphone } from 'lucide-react';
import html2canvas from 'html2canvas';
import { Button } from '../ui/Button';
import Modal from '../ui/Modal';
import toast from 'react-hot-toast';
import api from '../../services/api';

export default function BillPreview({ isOpen, onClose, onComplete, table, systemOrders = [], cafeName = "CafeOS" }) {
  const billRef = useRef(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [paymentType, setPaymentType] = useState('CASH');

  // Pull the branch's configured tax/billing so the receipt matches the books.
  const [cfg, setCfg] = useState(null);
  // Cafe (brand) that owns this branch — drives the receipt header branding.
  const [cafe, setCafe] = useState(null);
  // Bill id + timestamp are (re)generated per checkout inside the effect below, so
  // they must be declared BEFORE it (avoids a use-before-declaration TDZ).
  const [billId, setBillId] = useState('');
  const [dateTime, setDateTime] = useState('');
  useEffect(() => {
    if (!isOpen || !table) return;
    setPaymentType('CASH'); // fresh default for each table's checkout
    setBillId(`BILL-${Math.random().toString(36).substr(2, 9).toUpperCase()}`);
    setDateTime(new Date().toLocaleString());
    const branchId = table.locationId?._id || table.locationId;
    api.get(`/settings${branchId ? `?locationId=${branchId}` : ''}`)
      .then((res) => setCfg(res.data?.data || null))
      .catch(() => setCfg(null));
    if (branchId) {
      api.get(`/cafes?branchId=${branchId}`)
        .then((res) => setCafe(res.data?.data?.[0] || null))
        .catch(() => setCafe(null));
    } else {
      setCafe(null);
    }
  }, [isOpen, table]);

  const gstRate = Number(cfg?.tax?.gstRate ?? 5);
  const serviceChargeRate = Number(cfg?.billing?.serviceChargeRate ?? 0);
  // Prefer the cafe's GSTIN (brand-level); fall back to the branch's settings GSTIN.
  const gstin = cafe?.gstin || cfg?.tax?.gstin || '';
  const roundBill = cfg?.billing?.roundBill ?? true; // match server default (true)

  // Receipt header: cafe name/logo/address override the generic prop fallback.
  const brandName = cafe?.name || cafeName;
  const brandAddress = [cafe?.address?.line1, cafe?.address?.city, cafe?.address?.state, cafe?.address?.pincode]
    .filter(Boolean).join(', ');
  const brandPhone = cafe?.contact?.phone || '';
  const brandEmail = cafe?.contact?.email || '';

  // Combine staged items and completed/served system orders for the final bill
  const stagedItems = table?.orders || [];
  // Include all active (non-cancelled) kitchen orders in the bill.
  const finalizedOrders = systemOrders.filter(o => ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED'].includes(o.status));
  
  const allBillableItems = [
    ...stagedItems,
    ...finalizedOrders.flatMap(o => o.items.map(i => ({
      itemName: i.itemName || i.menuItem?.name,
      quantity: i.quantity,
      price: i.price || i.menuItem?.price || 0
    })))
  ];

  const subtotal = allBillableItems.reduce((acc, curr) => acc + (Number(curr.price) * Number(curr.quantity) || 0), 0);
  const discount = table?.discountAmount || 0;
  // GST is charged on the post-discount taxable amount, matching the server bill
  // calculation (orderController.generateOrderBill) so the displayed total agrees.
  const taxableAmount = Math.max(0, subtotal - discount);
  const serviceCharge = Number((taxableAmount * serviceChargeRate / 100).toFixed(2));
  const taxes = Number(((taxableAmount + serviceCharge) * gstRate / 100).toFixed(2));
  const rawTotal = taxableAmount + serviceCharge + taxes;
  const total = roundBill ? Math.round(rawTotal) : rawTotal;

  const handlePrint = () => {
    const printContent = billRef.current.innerHTML;
    const originalContent = document.body.innerHTML;

    // Simple print logic
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Print Receipt</title>
          <style>
            @page { size: auto; margin: 0mm; }
            body { 
              font-family: 'Courier New', Courier, monospace; 
              width: 350px; 
              margin: 20px auto; 
              padding: 20px; 
              font-size: 12px;
              color: #000;
              background: #fff;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .text-left { text-align: left; }
            .font-bold { font-weight: bold; }
            .font-bold { font-weight: 900; }
            .uppercase { text-transform: uppercase; }
            .italic { font-style: italic; }
            .flex { display: flex; }
            .justify-between { justify-content: space-between; }
            .items-center { align-items: center; }
            .w-full { width: 100%; }
            .my-4 { margin-top: 1rem; margin-bottom: 1rem; }
            .my-6 { margin-top: 1.5rem; margin-bottom: 1.5rem; }
            .mt-1 { margin-top: 0.25rem; }
            .mt-2 { margin-top: 0.5rem; }
            .pt-2 { padding-top: 0.5rem; }
            .pb-2 { padding-bottom: 0.5rem; }
            .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
            .border-t { border-top: 1px solid #000; }
            .border-b { border-bottom: 1px solid #000; }
            .border-dashed { border-style: dashed; }
            .text-xs { font-size: 10px; }
            .text-xl { font-size: 20px; }
            .text-base { font-size: 14px; }
            .opacity-70 { opacity: 0.7; }
            .text-(--color-text-muted) { color: #71717a; }
            .space-y-1 > * + * { margin-top: 0.25rem; }
            table { width: 100%; border-collapse: collapse; }
            th { border-bottom: 1px solid #000; font-weight: 900; }
            td { padding-top: 4px; padding-bottom: 4px; }
            @media print {
              body { width: 350px; margin: 0 auto; padding: 10mm; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            ${printContent}
          </div>
          <script>
            window.onload = function() {
              setTimeout(() => { 
                window.print(); 
                window.close(); 
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleFinalize = async () => {
    if (!billRef.current) {
      toast.error('Bill preview not ready');
      return;
    }

    setIsGenerating(true);
    const loadToast = toast.loading('Creating bill...');

    try {
      // Small delay to ensure styles are fully calculated
      await new Promise(resolve => setTimeout(resolve, 300));

      const canvas = await html2canvas(billRef.current, {
        backgroundColor: '#ffffff',
        scale: 2, // Explicitly set high scale for quality
        useCORS: true,
        allowTaint: false,
        logging: true,
        width: billRef.current.scrollWidth,
        height: billRef.current.scrollHeight,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDoc, element) => {
          // Force standard hex colors on the cloned document to avoid 'lab'/'oklch' errors
          const allElements = clonedDoc.getElementsByTagName("*");
          for (let i = 0; i < allElements.length; i++) {
            const el = allElements[i];
            try {
              const style = window.getComputedStyle(el);
              // If color contains lab or oklch, fallback to black/white
              if (style.color.includes('lab') || style.color.includes('oklch')) el.style.color = '#000000';
              if (style.backgroundColor.includes('lab') || style.backgroundColor.includes('oklch')) el.style.backgroundColor = '#ffffff';
              if (style.borderColor.includes('lab') || style.borderColor.includes('oklch')) el.style.borderColor = '#000000';
            } catch (e) { }
          }

          // Prepare the specific element for capture
          element.style.visibility = 'visible';
          element.style.position = 'absolute';
          element.style.left = '0';
          element.style.top = '0';
          element.style.width = '350px'; // Lock width for capture
          element.style.margin = '0';
          element.style.padding = '32px';
          element.style.backgroundColor = '#ffffff';
          element.style.color = '#000000';
          element.style.boxShadow = 'none';
          element.style.transform = 'none';
        }
      });

      canvas.toBlob(async (blob) => {
        if (!blob) {
          toast.error('Failed to create image', { id: loadToast });
          setIsGenerating(false);
          return;
        }

        const file = new File([blob], `bill-${table.tableNumber}-${Date.now()}.png`, { type: 'image/png' });

        try {
          // The parent (onComplete) validates + saves and shows its OWN success/
          // error toast. Previously this claimed success even when the parent
          // early-returned (e.g. missing customer name) — so just defer to it.
          await onComplete(file, total, paymentType);
          toast.dismiss(loadToast);
        } catch (err) {
          toast.dismiss(loadToast);
        } finally {
          setIsGenerating(false);
        }
      }, 'image/png', 1.0);
    } catch (error) {
      console.error('Bill Generation Error:', error);
      toast.error('Failed to create bill image', { id: loadToast });
      setIsGenerating(false);
    }
  };

  if (!table) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Checkout & Billing"
      maxWidth="max-w-lg"
    >
      <div className="space-y-8 ">
        {/* Receipt Preview */}
        <div className="bg-(--color-bg-base) p-6 rounded-xl border border-(--color-border) overflow-hidden">
          <div
            ref={billRef}
            className="bg-(--color-surface) text-(--color-on-primary) p-8 shadow-sm mx-auto"
            style={{ width: '100%', maxWidth: '350px', fontFamily: "'Courier New', Courier, monospace" }}
          >
            <div className="text-center space-y-1">
              {cafe?.logo && (
                <img src={cafe.logo} alt={brandName} crossOrigin="anonymous" className="h-12 mx-auto mb-1 object-contain" />
              )}
              <h2 className="text-xl font-bold uppercase tracking-tight">{brandName}</h2>
              <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">
                {table.locationId?.name || table.locationName || 'Main Branch'}
              </p>
              {brandAddress && <p className="text-[10px] font-medium opacity-70">{brandAddress}</p>}
              {(brandPhone || brandEmail) && (
                <p className="text-[10px] font-medium opacity-70">
                  {[brandPhone && `Tel: ${brandPhone}`, brandEmail].filter(Boolean).join('  •  ')}
                </p>
              )}
              {gstin && <p className="text-[10px] font-medium opacity-70">GSTIN: {gstin}</p>}
              <p className="text-[10px] font-medium opacity-70 mt-1">{dateTime}</p>
            </div>

            <div className="border-t border-dashed border-black my-4"></div>

            <div className="flex justify-between text-xs font-bold uppercase">
              <span>Bill ID:</span>
              <span>{billId}</span>
            </div>
            <div className="flex justify-between text-xs font-bold uppercase mt-1">
              <span>Table:</span>
              <span>T{table.tableNumber}</span>
            </div>

            <div className="border-t border-dashed border-black my-4"></div>

            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-left border-b border-black">
                  <th className="pb-2">ITEM</th>
                  <th className="pb-2 text-center">QTY</th>
                  <th className="pb-2 text-center">RATE</th>
                  <th className="pb-2 text-right">PRICE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--color-border)">
                {allBillableItems.map((item, i) => (
                  <tr key={i}>
                    <td className="py-2 uppercase font-bold">{item.itemName}</td>
                    <td className="py-2 text-center">{item.quantity}</td>
                    <td className="py-2 text-center">₹{Number(item.price || 0).toLocaleString()}</td>
                    <td className="py-2 text-right">₹{(Number(item.price || 0) * Number(item.quantity || 0)).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-t border-dashed border-black my-4"></div>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>SUBTOTAL:</span>
                <span>₹{subtotal.toLocaleString()}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-danger">
                  <span>DISCOUNT:</span>
                  <span>-₹{discount.toLocaleString()}</span>
                </div>
              )}
              {serviceCharge > 0 && (
                <div className="flex justify-between">
                  <span>SERVICE CHARGE ({serviceChargeRate}%):</span>
                  <span>₹{serviceCharge.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>GST ({gstRate}%):</span>
                <span>₹{taxes.toLocaleString()}</span>
              </div>
              {gstRate > 0 && (
                <div className="flex justify-between text-[10px] opacity-70">
                  <span>(CGST {(gstRate / 2)}% + SGST {(gstRate / 2)}%)</span>
                  <span>₹{(taxes / 2).toLocaleString()} + ₹{(taxes / 2).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold mt-2 pt-2 border-t border-black">
                <span>TOTAL PAYABLE:</span>
                <span>₹{total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span>PAID VIA:</span>
                <span>{paymentType}</span>
              </div>
            </div>

            <div className="border-t border-dashed border-black my-6"></div>

            <div className="text-center text-[10px] space-y-1 italic">
              <p>Thank you for visiting {brandName}!</p>
              <p>Visit again soon!</p>
              <p>*** End of Receipt ***</p>
            </div>
          </div>
        </div>

        {/* Payment Method */}
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Payment Method</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: 'CASH', label: 'Cash', icon: Banknote },
              { id: 'UPI', label: 'UPI', icon: Smartphone },
            ].map((m) => {
              const active = paymentType === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPaymentType(m.id)}
                  disabled={isGenerating}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-4 text-xs font-bold uppercase tracking-normal transition-all disabled:opacity-50 ${
                    active
                      ? 'border-primary bg-primary/10 text-primary shadow-sm'
                      : 'border-(--color-border) bg-(--color-surface-soft) text-(--color-text-muted) hover:text-(--color-text-primary) hover:border-primary/40'
                  }`}
                >
                  <m.icon size={16} />
                  {m.label}
                  {active && <Check size={14} className="ml-1" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            className="flex-1 !rounded-xl"
            icon={Printer}
            onClick={handlePrint}
          >
            Print Receipt
          </Button>
          <Button
            variant="primary"
            className="flex-1 !rounded-xl shadow-lg bg-primary "
            icon={isGenerating ? Loader2 : Check}
            onClick={handleFinalize}
            disabled={isGenerating}
          >
            {isGenerating ? 'Finalizing...' : 'Complete & Close'}
          </Button>
        </div>

        <p className="text-[10px] text-center text-(--color-text-muted) font-bold uppercase tracking-normal">
          Note: Completing will automatically save the bill proof and close the table.
        </p>
      </div>
    </Modal>
  );
}
