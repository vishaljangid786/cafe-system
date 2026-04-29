const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

const generateCSV = (data) => {
  if (!data || data.length === 0) return '';
  const fields = Object.keys(data[0]);
  const json2csvParser = new Parser({ fields });
  return json2csvParser.parse(data);
};

const generateExcel = async (data, title = 'Export Report') => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(title);

  if (data.length > 0) {
    const headers = Object.keys(data[0]);
    worksheet.addRow(headers);
    
    // Style headers
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD97706' } // Amber-600
    };

    data.forEach(item => {
      worksheet.addRow(Object.values(item));
    });

    worksheet.columns.forEach(column => {
      column.width = 20;
    });
  }

  return await workbook.xlsx.writeBuffer();
};

const generatePDF = (data, title = 'Export Report') => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Branding / Header
      doc.rect(0, 0, 600, 80).fill('#18181b'); // Zinc-900
      doc.fillColor('#fbbf24').fontSize(24).font('Helvetica-Bold').text('CAFE', 40, 25, { continued: true });
      doc.fillColor('#ffffff').text('OS');
      
      doc.fillColor('#ffffff').fontSize(10).font('Helvetica').text('Advanced Analytics & Export Engine', 40, 50);
      doc.text(new Date().toLocaleString(), 400, 35, { align: 'right' });

      doc.moveDown(4);
      doc.fillColor('#18181b').fontSize(18).font('Helvetica-Bold').text(title, { align: 'center' });
      doc.moveDown();

      if (!data || data.length === 0) {
        doc.fontSize(12).text('No data matching the current filters.', { align: 'center' });
        doc.end();
        return;
      }

      // Dynamic Table Implementation
      const keys = Object.keys(data[0]);
      const tableTop = 160;
      const colWidth = 515 / keys.length;

      // Table Header
      doc.rect(40, tableTop, 515, 20).fill('#d97706'); // Amber-600
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
      
      keys.forEach((key, i) => {
        doc.text(key.toUpperCase(), 45 + (i * colWidth), tableTop + 6, { width: colWidth - 5, lineBreak: false });
      });

      let currentY = tableTop + 20;

      data.forEach((item, index) => {
        // Stripe background
        if (index % 2 === 0) {
          doc.rect(40, currentY, 515, 18).fill('#f4f4f5'); // Zinc-100
        }

        doc.fillColor('#27272a').fontSize(7).font('Helvetica');
        keys.forEach((key, i) => {
          let val = item[key];
          if (val instanceof Date) val = val.toLocaleDateString();
          else if (typeof val === 'object' && val !== null) val = JSON.stringify(val);
          else val = String(val ?? '');

          doc.text(val, 45 + (i * colWidth), currentY + 5, { width: colWidth - 5, lineBreak: false });
        });

        currentY += 18;

        // New Page logic
        if (currentY > 750) {
          doc.addPage();
          currentY = 40;
        }
      });

      // Footer
      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        doc.fillColor('#a1a1aa').fontSize(8).text(
          `Page ${i + 1} of ${pages.count} - CafeOS Generated Intelligence`,
          0,
          doc.page.height - 20,
          { align: 'center' }
        );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = {
  generateCSV,
  generateExcel,
  generatePDF
};
