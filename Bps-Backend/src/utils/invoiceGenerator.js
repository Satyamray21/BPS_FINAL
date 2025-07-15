import PDFDocument from 'pdfkit';

export const generateInvoicePDF = async (customer, bookings) => {
  const doc = new PDFDocument({ margin: 40 });
  const buffers = [];

  return new Promise((resolve, reject) => {
    doc.on('data', chunk => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const lineHeight = 20;
    let y = 80;

    // Header
    doc.fontSize(16).text('TAX INVOICE', { align: 'center' });
    y += 30;
    doc.fontSize(12);
    doc.text('Bharat Parcel Services Pvt.Ltd.', 50, y); y += lineHeight;
    doc.text('332, Kucha Ghasi Ram, Chandni Chowk, Fatehpuri, Delhi -110006', 50, y); y += lineHeight;
    doc.text('GSTIN: 07AAECB6506F1ZY    PAN: AAECB6506F    SAC CODE: 9968', 50, y); y += lineHeight + 10;

    // Customer Info
    const fullName = `${customer.firstName || ''}${customer.middleName || ''}${customer.lastName || ''}`.trim();
    doc.text(`Party Name: ${fullName}`, 50, y); y += lineHeight;
    doc.text(`Email: ${customer.emailId}`, 50, y); y += lineHeight;
    doc.text('State Code: 07, Delhi', 50, y); y += lineHeight + 10;

    // Table Header
    doc.font('Helvetica-Bold');
    doc.text('SR', 50, y)
      .text('Date', 90, y)
      .text('Receiver', 180, y)
      .text('Amount', 360, y)
      .text('CGST', 420, y)
      .text('SGST', 480, y);
    y += lineHeight;
    doc.font('Helvetica');

    let totalAmount = 0, totalCgst = 0, totalSgst = 0;

    bookings.forEach((b, index) => {
      const receiverName = truncateText(b.receiverName, 32); // limit to 32 chars

      if (y > 700) {
        doc.addPage();
        y = 80;
      }

      doc.text(index + 1, 50, y)
        .text(formatDate(b.bookingDate), 90, y)
        .text(receiverName, 180, y, { width: 160, ellipsis: true })
        .text(b.billTotal.toFixed(2), 360, y)
        .text(b.cgst.toFixed(2), 420, y)
        .text(b.sgst.toFixed(2), 480, y);

      y += lineHeight;

      totalAmount += b.billTotal;
      totalCgst += b.cgst;
      totalSgst += b.sgst;
    });

    const grandTotal = totalAmount + totalCgst + totalSgst;

    // Totals
    doc.font('Helvetica-Bold');
    y += 10;
    doc.text('TOTAL', 180, y)
      .text(totalAmount.toFixed(2), 360, y)
      .text(totalCgst.toFixed(2), 420, y)
      .text(totalSgst.toFixed(2), 480, y);

    // Grand Total
    y += lineHeight + 10;
    doc.text(`GRAND TOTAL: ₹${grandTotal.toFixed(2)}`, 360, y);

    // Amount in Words
    y += lineHeight;
    doc.text(`Amount in Words: ${convertNumberToWords(grandTotal)} only`, 50, y);

    // Footer
    y += 2 * lineHeight;
    doc.text('For Bharat Parcel Services Pvt.Ltd.', { align: 'right' });
    doc.text('DIRECTOR', { align: 'right' });

    doc.end();
  });
};

// --- Helper functions ---
function formatDate(date) {
  const d = new Date(date);
  return `${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()}`;
}

function truncateText(text, maxLength) {
  return text.length > maxLength ? text.slice(0, maxLength - 3) + '...' : text;
}

function convertNumberToWords(n) {
  return `INR ${n.toFixed(2)}`;
}
