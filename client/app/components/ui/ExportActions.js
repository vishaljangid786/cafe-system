'use client';
import { useState } from 'react';
import { Download, FileText, Printer, FileSpreadsheet, Calendar, Image as ImageIcon } from 'lucide-react';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import toast from 'react-hot-toast';
import html2canvas from 'html2canvas';

const escapeHtml = (str) => {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const sanitizeCsvCell = (val) => {
  const str = val == null ? '' : String(val);
  return /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
};

export default function ExportActions({ data = [], columns = [], filename = 'export', hasCharts = false }) {
  const [showOptions, setShowOptions] = useState(false);
  const [dateFilter, setDateFilter] = useState({ startDate: '', endDate: '' });
  const [showDateFilter, setShowDateFilter] = useState(false);

  // Apply basic date filtering if data has a 'date' or 'createdAt' field
  const getFilteredData = () => {
    if (!dateFilter.startDate && !dateFilter.endDate) return data;
    
    return data.filter(item => {
      const itemDateStr = item.date || item.createdAt;
      if (!itemDateStr) return true;
      const itemDate = new Date(itemDateStr);
      
      const start = dateFilter.startDate ? new Date(dateFilter.startDate) : new Date(0);
      const end = dateFilter.endDate ? new Date(dateFilter.endDate) : new Date(8640000000000000); // Max date
      end.setHours(23, 59, 59, 999);
      
      return itemDate >= start && itemDate <= end;
    });
  };

  const generateFileName = (ext) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${filename}_${timestamp}.${ext}`;
  };

  const handleCSV = () => {
    try {
      const filteredData = getFilteredData();
      if (filteredData.length === 0) {
        toast.error('No data available to export');
        return;
      }
      
      const sanitizedData = filteredData.map(item => {
        const row = {};
        columns.forEach(col => {
          const val = typeof col.key === 'function' ? col.key(item) : getNestedValue(item, col.key);
          row[col.header] = sanitizeCsvCell(val);
        });
        return row;
      });
      const csv = Papa.unparse(sanitizedData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', generateFileName('csv'));
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('CSV downloaded successfully');
      setShowOptions(false);
    } catch (error) {
      console.error(error);
      toast.error('Failed to generate CSV');
    }
  };

  const handleExcel = () => {
    try {
      const filteredData = getFilteredData();
      if (filteredData.length === 0) {
        toast.error('No data available to export');
        return;
      }

      const exportData = filteredData.map(item => {
        const row = {};
        columns.forEach(col => {
          row[col.header] = typeof col.key === 'function' ? col.key(item) : getNestedValue(item, col.key);
        });
        return row;
      });

      const escapeCell = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
      const headers = columns.map(col => `<th>${escapeCell(col.header)}</th>`).join('');
      const rows = exportData.map(row => (
        `<tr>${columns.map(col => `<td>${escapeCell(row[col.header])}</td>`).join('')}</tr>`
      )).join('');
      const workbookHtml = `
        <html>
          <head><meta charset="utf-8" /></head>
          <body><table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></body>
        </html>
      `;
      const blob = new Blob([workbookHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = generateFileName('xls');
      link.click();
      URL.revokeObjectURL(url);
      
      toast.success('Excel downloaded successfully');
      setShowOptions(false);
    } catch (error) {
      console.error(error);
      toast.error('Failed to generate Excel');
    }
  };

  const handleChartExport = async () => {
    try {
      const charts = document.querySelectorAll('.export-chart');
      if (charts.length === 0) {
        toast.error('No charts found to export. Please ensure they are visible.');
        return;
      }

      toast.loading('Preparing chart images...', { id: 'chart-export' });

      for (let i = 0; i < charts.length; i++) {
        const chartContainer = charts[i];
        // Target the specific Recharts SVG surface instead of just any SVG (to avoid icons)
        const svgElement = chartContainer.querySelector('.recharts-surface') || chartContainer.querySelector('svg');
        
        if (!svgElement) {
          // Fallback to html2canvas only if no SVG is found (less likely for Recharts)
          const canvas = await html2canvas(chartContainer, {
            scale: 2,
            logging: false,
            useCORS: true,
            onclone: (doc) => {
              const problematicTags = doc.querySelectorAll('link, style');
              problematicTags.forEach(tag => tag.remove());
            }
          });
          const image = canvas.toDataURL('image/png', 1.0);
          const link = document.createElement('a');
          link.href = image;
          link.download = `${filename}_visual_${i + 1}.png`;
          link.click();
          continue;
        }

        // Capture chart
        await new Promise((resolve, reject) => {
          const clonedSvg = svgElement.cloneNode(true);
          const width = svgElement.clientWidth || 800;
          const height = svgElement.clientHeight || 400;
          
          clonedSvg.setAttribute('width', width);
          clonedSvg.setAttribute('height', height);
          
          const isDark = document.documentElement.classList.contains('dark');
          clonedSvg.style.backgroundColor = isDark ? '#09090b' : '#ffffff';

          let svgData = new XMLSerializer().serializeToString(clonedSvg);
          svgData = svgData.replace(/okl(ch|ab)\([^)]+\)/g, '#f59e0b');

          const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(svgBlob);
          
          const img = new Image();
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = width * 2;
              canvas.height = height * 2;
              const ctx = canvas.getContext('2d');
              ctx.fillStyle = isDark ? '#09090b' : '#ffffff';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              
              const pngUrl = canvas.toDataURL('image/png');
              const downloadLink = document.createElement('a');
              downloadLink.href = pngUrl;
              downloadLink.download = `${filename}_chart_${i + 1}.png`;
              downloadLink.click();
              
              URL.revokeObjectURL(url);
              resolve();
            } catch (err) {
              reject(err);
            }
          };
          img.onerror = reject;
          img.src = url;
        });

        // Small delay between downloads for browser stability
        await new Promise(r => setTimeout(r, 300));
      }

      toast.success('Images saved successfully', { id: 'chart-export' });
      setShowOptions(false);
    } catch (error) {
      console.error('Chart Export Error:', error);
      toast.error('Export failed: ' + error.message, { id: 'chart-export' });
    }
  };

  const handlePDF = () => {
    try {
      const filteredData = getFilteredData();
      if (filteredData.length === 0) {
        toast.error('No data available to export');
        return;
      }

      const doc = new jsPDF();
      doc.text(`${filename.toUpperCase()} DATA EXPORT`, 14, 15);
      
      const tableColumn = columns.map(col => col.header);
      const tableRows = filteredData.map(item => {
        return columns.map(col => {
          const val = typeof col.key === 'function' ? col.key(item) : getNestedValue(item, col.key);
          return val != null ? String(val) : '';
        });
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 20,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [245, 158, 11] } // [var(--color-primary)]
      });

      doc.save(generateFileName('pdf'));
      toast.success('PDF downloaded successfully');
      setShowOptions(false);
    } catch (error) {
      console.error(error);
      toast.error('Failed to generate PDF');
    }
  };

  const handlePrint = () => {
    try {
      const filteredData = getFilteredData();
      if (filteredData.length === 0) {
        toast.error('No data available to print');
        return;
      }

      const printWindow = window.open('', '_blank');
      const tableHeaders = columns.map(col => `<th>${escapeHtml(col.header)}</th>`).join('');
      const tableRows = filteredData.map(item => {
        const rowData = columns.map(col => {
          const val = typeof col.key === 'function' ? col.key(item) : getNestedValue(item, col.key);
          return `<td>${escapeHtml(val)}</td>`;
        }).join('');
        return `<tr>${rowData}</tr>`;
      }).join('');

      const htmlContent = `
        <html>
          <head>
            <title>Print - ${filename}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              h1 { color: #333; text-transform: uppercase; margin-bottom: 20px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f59e0b; color: white; }
              tr:nth-child(even) { background-color: #f9f9f9; }
            </style>
          </head>
          <body>
            <h1>${filename} Data</h1>
            <table>
              <thead><tr>${tableHeaders}</tr></thead>
              <tbody>${tableRows}</tbody>
            </table>
            <script>
              window.onload = function() { window.print(); }
            </script>
          </body>
        </html>
      `;

      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      
      toast.success('Print window opened');
      setShowOptions(false);
    } catch (error) {
      console.error(error);
      toast.error('Failed to print data');
    }
  };

  // Helper for nested object paths (e.g., 'category.name')
  const getNestedValue = (obj, path) => {
    if (!path) return '';
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  };

  return (
    <div className="relative z-40 w-full sm:w-auto">
      <div className="flex flex-wrap items-center gap-2 justify-start sm:justify-end">
        {showDateFilter && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-2 shadow-sm w-full sm:w-auto">
            <input 
              type="date" 
              className="px-2 py-1.5 text-xs bg-transparent border border-[var(--color-border)] sm:border-none rounded-lg sm:rounded-none outline-none text-[var(--color-text-primary)] w-full sm:w-auto"
              value={dateFilter.startDate}
              onChange={e => setDateFilter({...dateFilter, startDate: e.target.value})}
              title="Start Date"
            />
            <span className="text-[var(--color-text-muted)] text-xs hidden sm:inline">-</span>
            <input 
              type="date" 
              className="px-2 py-1.5 text-xs bg-transparent border border-[var(--color-border)] sm:border-none rounded-lg sm:rounded-none outline-none text-[var(--color-text-primary)] w-full sm:w-auto"
              value={dateFilter.endDate}
              onChange={e => setDateFilter({...dateFilter, endDate: e.target.value})}
              title="End Date"
            />
          </div>
        )}
        
        <button
          onClick={() => setShowDateFilter(!showDateFilter)}
          className={`p-2.5 rounded-xl border transition-all ${showDateFilter ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)] text-[var(--color-primary)]' : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'}`}
          title="Date Range Filter"
        >
          <Calendar size={18} />
        </button>

        <button
          onClick={() => setShowOptions(!showOptions)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--color-primary)] text-[var(--color-on-primary)] rounded-lg font-semibold text-sm hover:bg-[var(--color-primary-hover)] active:scale-95 transition-colors w-full sm:w-auto"
        >
          <Download size={16} />
          Export
        </button>
      </div>

      {showOptions && (
        <div className="absolute right-0 mt-2 w-full sm:w-56 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-[var(--shadow-md)] py-2 flex flex-col z-50 animate-in fade-in slide-in-from-top-2">
          <button
            onClick={handleCSV}
            className="flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-soft)] transition-colors w-full text-left"
          >
            <FileSpreadsheet size={16} className="text-[var(--color-success)]" />
            Download CSV
          </button>
          <button
            onClick={handleExcel}
            className="flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-soft)] transition-colors w-full text-left"
          >
            <FileSpreadsheet size={16} className="text-[var(--color-success)]" />
            Download Excel (.xls)
          </button>
          <button
            onClick={handlePDF}
            className="flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-soft)] transition-colors w-full text-left"
          >
            <FileText size={16} className="text-[var(--color-danger)]" />
            Download PDF
          </button>
          {hasCharts && (
            <button
              onClick={handleChartExport}
              className="flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-soft)] transition-colors w-full text-left"
            >
              <ImageIcon size={16} className="text-[var(--color-primary)]" />
              Export Charts as Images
            </button>
          )}
          <div className="h-px bg-[var(--color-border)] my-1 mx-4"></div>
          <button
            onClick={handlePrint}
            className="flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-soft)] transition-colors w-full text-left"
          >
            <Printer size={16} className="text-[var(--color-primary)]" />
            Print Data
          </button>
        </div>
      )}
    </div>
  );
}
