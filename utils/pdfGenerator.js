const PDFDocument = require('pdfkit');
const https       = require('https');
const http        = require('http');

/**
 * Fetches an image from a URL and returns it as a Buffer.
 */
const fetchImageBuffer = (url) => {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
};

/**
 * Generates a prescription PDF and returns it as a Buffer.
 *
 * @param {object} visit    - Populated Visit document
 * @param {object} patient  - Populated Patient document
 * @returns {Promise<Buffer>}
 */
const generatePrescriptionPDF = async (visit, patient) => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc    = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const TEAL     = '#0D9488';
      const NAVY     = '#0F172A';
      const GREY     = '#64748B';
      const LIGHT_BG = '#F8FAFC';
      const WHITE    = '#FFFFFF';
      const pageW    = doc.page.width;
      const margin   = 50;
      const contentW = pageW - margin * 2;

      // ─── HEADER ─────────────────────────────────────────────────────────
      doc.rect(0, 0, pageW, 110).fill(NAVY);

      // Logo
      const logoUrl = process.env.HOSPITAL_LOGO_URL;
      if (logoUrl) {
        try {
          const logoBuffer = await fetchImageBuffer(logoUrl);
          doc.image(logoBuffer, margin, 20, { width: 60, height: 60 });
        } catch (_) { /* logo fetch failed — skip */ }
      }

      // Hospital name
      doc.fillColor(WHITE)
        .font('Helvetica-Bold')
        .fontSize(20)
        .text(process.env.HOSPITAL_NAME || 'VisionCare Eye Hospital', margin + 70, 28);

      doc.fillColor(TEAL)
        .font('Helvetica')
        .fontSize(10)
        .text('Advanced Eye Care & Vision Sciences', margin + 70, 52);

      doc.fillColor('#94A3B8')
        .fontSize(9)
        .text('PRESCRIPTION', margin + 70, 68);

      // Ticket & Date (top-right)
      doc.fillColor(WHITE)
        .font('Helvetica-Bold')
        .fontSize(11)
        .text(`Ticket: ${visit.ticketNumber}`, pageW - 200, 28, { width: 150, align: 'right' });

      doc.fillColor('#94A3B8')
        .font('Helvetica')
        .fontSize(9)
        .text(new Date(visit.finalizedAt || visit.updatedAt).toLocaleDateString('en-GB', {
          day: 'numeric', month: 'long', year: 'numeric',
        }), pageW - 200, 48, { width: 150, align: 'right' });

      doc.moveDown(0.5);

      // ─── PATIENT & DOCTOR INFO BLOCK ─────────────────────────────────────
      let y = 125;

      const drawInfoCard = (x, width, title, lines) => {
        doc.rect(x, y, width, 90).fill(LIGHT_BG).stroke('#E2E8F0');
        doc.fillColor(TEAL).font('Helvetica-Bold').fontSize(8)
          .text(title, x + 10, y + 10);
        let lineY = y + 22;
        lines.forEach(([label, value]) => {
          doc.fillColor(GREY).font('Helvetica').fontSize(8)
            .text(`${label}:`, x + 10, lineY, { continued: true })
            .fillColor(NAVY).font('Helvetica-Bold')
            .text(` ${value || '—'}`, { lineBreak: false });
          lineY += 14;
        });
      };

      const doctorName = visit.assignedDoctor?.name || '—';
      const deptName   = visit.department?.name     || '—';

      drawInfoCard(margin, contentW / 2 - 5, 'PATIENT INFORMATION', [
        ['Name',      patient.name],
        ['Age/Gender', `${patient.age} yrs / ${patient.gender}`],
        ['Phone',     patient.phone],
        ['Patient ID', patient.patientId],
      ]);

      drawInfoCard(margin + contentW / 2 + 5, contentW / 2 - 5, 'DOCTOR INFORMATION', [
        ['Doctor',     `Dr. ${doctorName}`],
        ['Department', deptName],
        ['Room',       visit.roomNumber || '—'],
        ['Visit Type', visit.bookingType],
      ]);

      y += 105;

      // ─── SECTION HELPER ───────────────────────────────────────────────────
      const section = (title) => {
        y += 14;
        doc.rect(margin, y, contentW, 22).fill(NAVY);
        doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(9)
          .text(title, margin + 10, y + 7);
        y += 30;
      };

      const bodyText = (text) => {
        doc.fillColor(NAVY).font('Helvetica').fontSize(10)
          .text(text || 'N/A', margin + 10, y, { width: contentW - 20 });
        y = doc.y + 8;
      };

      // ─── CHIEF COMPLAINT ─────────────────────────────────────────────────
      if (visit.chiefComplaint) {
        section('CHIEF COMPLAINT');
        bodyText(visit.chiefComplaint);
      }

      // ─── DIAGNOSIS ────────────────────────────────────────────────────────
      section('DIAGNOSIS');
      bodyText(visit.diagnosis);

      // ─── MEDICINES TABLE ──────────────────────────────────────────────────
      if (visit.medicines && visit.medicines.length > 0) {
        section('PRESCRIBED MEDICINES');

        const colWidths = [contentW * 0.30, contentW * 0.18, contentW * 0.18, contentW * 0.34];
        const headers   = ['Medicine Name', 'Dosage', 'Duration', 'Timing / Instructions'];
        const rowH      = 20;

        // Header row
        doc.rect(margin, y, contentW, rowH).fill(TEAL);
        let cx = margin;
        headers.forEach((h, i) => {
          doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(8)
            .text(h, cx + 5, y + 6, { width: colWidths[i] - 10 });
          cx += colWidths[i];
        });
        y += rowH;

        // Data rows
        visit.medicines.forEach((med, idx) => {
          const bg = idx % 2 === 0 ? WHITE : LIGHT_BG;
          doc.rect(margin, y, contentW, rowH).fill(bg).stroke('#E2E8F0');
          const row = [med.name, med.dosage, med.duration, med.timing + (med.notes ? ` (${med.notes})` : '')];
          cx = margin;
          row.forEach((val, i) => {
            doc.fillColor(NAVY).font('Helvetica').fontSize(8)
              .text(val || '—', cx + 5, y + 6, { width: colWidths[i] - 10 });
            cx += colWidths[i];
          });
          y += rowH;
        });
        y += 8;
      }

      // ─── TESTS / PROCEDURES ───────────────────────────────────────────────
      if (visit.testsAdvised && visit.testsAdvised.length > 0) {
        section('TESTS & PROCEDURES ADVISED');

        const colW = [contentW * 0.40, contentW * 0.60];
        const rowH = 20;

        doc.rect(margin, y, contentW, rowH).fill(TEAL);
        doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(8)
          .text('Test Name', margin + 5, y + 6, { width: colW[0] - 10 });
        doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(8)
          .text('Result / Notes', margin + colW[0] + 5, y + 6, { width: colW[1] - 10 });
        y += rowH;

        visit.testsAdvised.forEach((test, idx) => {
          const bg = idx % 2 === 0 ? WHITE : LIGHT_BG;
          doc.rect(margin, y, contentW, rowH).fill(bg).stroke('#E2E8F0');
          doc.fillColor(NAVY).font('Helvetica').fontSize(8)
            .text(test.name, margin + 5, y + 6, { width: colW[0] - 10 });
          doc.fillColor(NAVY).font('Helvetica').fontSize(8)
            .text(test.result || 'Pending', margin + colW[0] + 5, y + 6, { width: colW[1] - 10 });
          y += rowH;
        });
        y += 8;
      }

      // ─── DOCTOR NOTES ─────────────────────────────────────────────────────
      if (visit.doctorNotes) {
        section('DOCTOR\'S NOTES');
        bodyText(visit.doctorNotes);
      }

      // ─── NEXT VISIT ───────────────────────────────────────────────────────
      if (visit.nextVisitDate) {
        section('NEXT VISIT');
        bodyText(new Date(visit.nextVisitDate).toLocaleDateString('en-GB', {
          day: 'numeric', month: 'long', year: 'numeric',
        }));
      }

      // ─── FOOTER ───────────────────────────────────────────────────────────
      const footerY = doc.page.height - 60;
      doc.rect(0, footerY, pageW, 60).fill(NAVY);

      doc.fillColor(WHITE).font('Helvetica').fontSize(8)
        .text(
          `This prescription is generated electronically by ${process.env.HOSPITAL_NAME || 'VisionCare Eye Hospital'} — No signature required`,
          margin, footerY + 10, { width: contentW, align: 'center' }
        );

      doc.fillColor('#94A3B8').fontSize(7)
        .text(
          `Generated on ${new Date().toLocaleString()} | Ticket: ${visit.ticketNumber}`,
          margin, footerY + 28, { width: contentW, align: 'center' }
        );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = generatePrescriptionPDF;
