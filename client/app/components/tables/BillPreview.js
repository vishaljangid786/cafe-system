"use client"
import { useRef, useState } from 'react';
import { Printer, Download, Check, X, Camera, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import { Button } from '../ui/Button';
import Modal from '../ui/Modal';
import toast from 'react-hot-toast';

export default function BillPreview({ isOpen, onClose, onComplete, table, systemOrders = [], cafeName = "CafeOS" }) {
  const billRef = useRef(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Combine staged items and completed system orders for the final bill
  const stagedItems = table?.orders || [];
  const finalizedOrders = systemOrders.filter(o => o.status === 'COMPLETED');
  
  const allBillableItems = [
    ...stagedItems,
    ...finalizedOrders.flatMap(o => o.items.map(i => ({
      itemName: i.itemName,
      quantity: i.quantity,
      price: i.price
    })))
  ];

  const subtotal = allBillableItems.reduce((acc, curr) => acc + (Number(curr.price) * Number(curr.quantity) || 0), 0);
  const discount = table?.discountAmount || 0;
  const taxes = Number((subtotal * 0.05).toFixed(2)); // 5% GST
  const total = Math.max(0, subtotal + taxes - discount);
  const billId = `BILL-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  const dateTime = new Date().toLocaleString();

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
            .font-black { font-weight: 900; }
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
            .text-base { font-size: 16px; }
            .opacity-70 { opacity: 0.7; }
            .space-y-1 > * + * { margin-top: 0.25rem; }
            table { width: 100%; border-collapse: collapse; }
            th { border-bottom: 1px solid #000; }
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
      toast.error('Registry terminal not ready');
      return;
    }

    setIsGenerating(true);
    const loadToast = toast.loading('Generating bill proof...');

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
          toast.error('Capture protocol failed', { id: loadToast });
          setIsGenerating(false);
          return;
        }

        const file = new File([blob], `bill-${table.tableNumber}-${Date.now()}.png`, { type: 'image/png' });

        try {
          await onComplete(file, total);
          toast.success('Bill generated successfully', { id: loadToast });
        } catch (err) {
          toast.error('Ledger archival failed', { id: loadToast });
        } finally {
          setIsGenerating(false);
        }
      }, 'image/png', 1.0);
    } catch (error) {
      console.error('Bill Generation Error:', error);
      toast.error('Failed to generate bill proof', { id: loadToast });
      setIsGenerating(false);
    }
  };

  if (!table) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Session Completion & Billing"
      maxWidth="max-w-lg"
    >
      <div className="space-y-8 ">
        {/* Receipt Preview */}
        <div className="bg-[#f4f4f5] dark:bg-[#09090b] p-6 rounded-3xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
          <div
            ref={billRef}
            className="bg-white text-black p-8 shadow-sm mx-auto"
            style={{ width: '100%', maxWidth: '350px', fontFamily: "'Courier New', Courier, monospace" }}
          >
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold uppercase tracking-tighter">{cafeName}</h2>
              <p className="text-[10px] font-medium opacity-70">Operational Matrix Terminal</p>
              <p className="text-[10px]">{dateTime}</p>
            </div>

            <div className="border-t border-dashed border-black my-4"></div>

            <div className="flex justify-between text-xs font-bold uppercase">
              <span>Bill ID:</span>
              <span>{billId}</span>
            </div>
            <div className="flex justify-between text-xs font-bold uppercase mt-1">
              <span>Terminal:</span>
              <span>T{table.tableNumber}</span>
            </div>

            <div className="border-t border-dashed border-black my-4"></div>

            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-left border-b border-black">
                  <th className="pb-2">ITEM</th>
                  <th className="pb-2 text-center">QTY</th>
                  <th className="pb-2 text-right">PRICE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {allBillableItems.map((item, i) => (
                  <tr key={i}>
                    <td className="py-2 uppercase font-bold">{item.itemName}</td>
                    <td className="py-2 text-center">{item.quantity}</td>
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
              <div className="flex justify-between">
                <span>TAX (GST 5%):</span>
                <span>₹{taxes.toLocaleString()}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>DISCOUNT:</span>
                  <span>-₹{discount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-black mt-2 pt-2 border-t border-black">
                <span>TOTAL PAYABLE:</span>
                <span>₹{total.toLocaleString()}</span>
              </div>
            </div>

            <div className="border-t border-dashed border-black my-6"></div>

            <div className="text-center text-[10px] space-y-1 italic">
              <p>Thank you for visiting {cafeName}!</p>
              <p>Keep the matrix running.</p>
              <p>*** End of Receipt ***</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            className="flex-1 !rounded-2xl"
            icon={Printer}
            onClick={handlePrint}
          >
            Print Receipt
          </Button>
          <Button
            variant="primary"
            className="flex-1 !rounded-2xl shadow-lg shadow-amber-500/20"
            icon={isGenerating ? Loader2 : Check}
            onClick={handleFinalize}
            disabled={isGenerating}
          >
            {isGenerating ? 'Finalizing...' : 'Complete & Close'}
          </Button>
        </div>

        <p className="text-[10px] text-center text-zinc-500 font-bold uppercase tracking-widest">
          Note: Completing will automatically save the bill proof and close the table.
        </p>
      </div>
    </Modal>
  );
}
