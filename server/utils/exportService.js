const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');

const generateCSV = (data) => {
  if (!data || data.length === 0) {
    return '';
  }
  
  // Extract headers from the first object
  const fields = Object.keys(data[0]);
  const json2csvParser = new Parser({ fields });
  const csv = json2csvParser.parse(data);
  return csv;
};

const generatePDF = (data, title = 'Export Report') => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 30, size: 'A4' });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // Title
      doc.fontSize(16).text(title, { align: 'center' }).moveDown();

      if (!data || data.length === 0) {
        doc.fontSize(12).text('No data available.', { align: 'center' });
        doc.end();
        return;
      }

      // Very simple table generation
      // For a robust implementation, a library like pdfkit-table would be better,
      // but this fulfills the basic requirement using pure pdfkit
      const keys = Object.keys(data[0]);
      let y = doc.y;
      
      doc.fontSize(10);
      keys.forEach((key, i) => {
        doc.text(key, 30 + (i * 100), y, { width: 90, continued: i < keys.length - 1 });
      });
      doc.moveDown();
      y = doc.y;
      
      doc.moveTo(30, y).lineTo(550, y).stroke();
      doc.moveDown(0.5);

      data.forEach(item => {
        y = doc.y;
        if (y > 750) {
          doc.addPage();
          y = doc.y;
        }
        
        doc.fontSize(8);
        keys.forEach((key, i) => {
          let val = item[key];
          if (val === null || val === undefined) val = '';
          else if (typeof val === 'object') val = JSON.stringify(val);
          else val = String(val);
          
          doc.text(val, 30 + (i * 100), y, { width: 90, height: 15, continued: i < keys.length - 1 });
        });
        doc.moveDown();
      });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = {
  generateCSV,
  generatePDF
};
