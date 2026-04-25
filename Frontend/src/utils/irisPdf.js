// IRIS-format PDF generator. Produces an Acknowledgement-Slip-style document
// matching FBR's official return printout (see Return.pdf at the repo root):
//   - Cover page with FBR header band, 5-row top summary, taxpayer profile,
//     filer disclaimer
//   - Per-section tables with IRIS field codes in column 1
// Uses jsPDF + jspdf-autotable, lazy-loaded by the caller.

import { buildIrisSections } from './irisFieldMap';

const FBR_BLUE = [17, 75, 122];      // approx. IRIS slip header tone
const SECTION_BG = [225, 234, 245];  // light-blue section banner
const ZEBRA      = [248, 250, 252];

// Format a number Indian-style (matches IRIS slip — uses thousands grouping
// without a currency symbol; the "Amount" column header carries the unit).
const fmt = (n) => {
  const v = typeof n === 'number' ? n : parseFloat(n);
  if (!Number.isFinite(v)) return '';
  return new Intl.NumberFormat('en-PK', { maximumFractionDigits: 0 }).format(v);
};

const dateLong = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const tableTheme = {
  styles:    { font: 'helvetica', fontSize: 9, cellPadding: 4, lineColor: [220, 220, 220], lineWidth: 0.4 },
  headStyles:{ fillColor: SECTION_BG, textColor: FBR_BLUE, fontStyle: 'bold', halign: 'left' },
  alternateRowStyles: { fillColor: ZEBRA },
  margin: { left: 36, right: 36 },
};

const totalRowStyle = {
  fillColor: [240, 246, 252],
  fontStyle: 'bold',
  textColor: FBR_BLUE,
};

/**
 * Generate the IRIS-format Acknowledgement Slip PDF and trigger download.
 *
 * `ctx` shape:
 *   {
 *     computation:           { income, tax, payments }   // /api/tax-computation/:year
 *     income, adjustable_tax, capital_gain, reductions, credits, deductions,
 *     final_min_income, expenses, wealth, wealth_reconciliation,
 *     tax_computation:       { refund_adjustment }
 *     profile:               { name, cnic, ntn, email, phone, address }
 *     taxYear:               '2025-26'
 *     formType:              '114(1) (Return of Income filed voluntarily for complete year)'
 *     filename:              optional override
 *   }
 */
export async function generateIrisPdf(ctx) {
  const [{ default: JsPDF }, autoTableMod] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const autoTable = autoTableMod.default || autoTableMod;

  const sections = buildIrisSections(ctx);
  const doc = new JsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // ── Helpers ────────────────────────────────────────────────────────────────
  const drawSectionBanner = (text, y) => {
    doc.setFillColor(...SECTION_BG);
    doc.rect(36, y, pageWidth - 72, 22, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...FBR_BLUE);
    doc.text(text, 44, y + 15);
    return y + 26;
  };

  const drawHeaderBand = () => {
    doc.setFillColor(...FBR_BLUE);
    doc.rect(0, 0, pageWidth, 70, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(255, 255, 255);
    doc.text('ACKNOWLEDGEMENT SLIP', pageWidth / 2, 32, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Pakistan Tax Advisor — generated locally for review prior to FBR IRIS submission', pageWidth / 2, 52, { align: 'center' });
    doc.setTextColor(40, 40, 40);
  };

  const filerDisclaimer = (y) => {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    const txt = 'This is not a valid evidence of being a "filer" for the purposes of clauses (23A) and (35C) of sections 2 and 181A.';
    const lines = doc.splitTextToSize(txt, pageWidth - 72);
    doc.text(lines, pageWidth / 2, y, { align: 'center' });
    doc.setTextColor(40, 40, 40);
    return y + lines.length * 11;
  };

  // ── COVER PAGE ────────────────────────────────────────────────────────────
  drawHeaderBand();
  let y = 90;

  // Top summary table
  autoTable(doc, {
    ...tableTheme,
    startY: y,
    head: [['Code', 'Description', 'Amount']],
    body: sections.top_summary.map((r) => [r.code, r.label, fmt(r.amount)]),
    columnStyles: {
      0: { cellWidth: 60, halign: 'left',   font: 'courier' },
      1: { cellWidth: 'auto', halign: 'left' },
      2: { cellWidth: 110, halign: 'right', font: 'courier' },
    },
  });
  y = doc.lastAutoTable.finalY + 14;

  y = filerDisclaimer(y);
  y += 10;

  // Taxpayer profile block — two-column grid
  const profile = ctx.profile || {};
  const period  = `01-Jul-${ctx.taxYear?.split('-')[0] - 1 || '2024'}  -  30-Jun-${ctx.taxYear?.split('-')[0] || '2025'}`;
  const profileRows = [
    ['Name',             profile.name        || '—',                                  'Registration No', profile.ntn || profile.cnic || '—'],
    ['Address',          profile.address     || '—',                                  'Tax Year',        ctx.taxYear?.split('-')[0] || '2025'],
    ['Contact No',       profile.phone       || '—',                                  'Period',          period],
    ['Email',            profile.email       || '—',                                  'Form Type',       ctx.formType || '114(1)'],
    ['Document Date',    dateLong(new Date()),                                        'Due Date',        '30-Sep-' + (ctx.taxYear?.split('-')[0] || '2025')],
  ];
  autoTable(doc, {
    ...tableTheme,
    startY: y,
    body: profileRows,
    styles: { ...tableTheme.styles, fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 90,   fontStyle: 'bold', textColor: [80, 80, 80] },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 90,   fontStyle: 'bold', textColor: [80, 80, 80] },
      3: { cellWidth: 130 },
    },
  });
  y = doc.lastAutoTable.finalY + 16;

  // Filer status footer
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `Generated ${new Date().toLocaleString('en-PK')}  •  Pakistan Tax Advisor`,
    pageWidth / 2, pageHeight - 30, { align: 'center' }
  );

  // ── SECTION PAGES ─────────────────────────────────────────────────────────
  // Helper to draw a section, paginating if needed.
  const ensureSpace = (h) => {
    if (doc.lastAutoTable && doc.lastAutoTable.finalY + h > pageHeight - 50) {
      doc.addPage();
      return 50;
    }
    return doc.lastAutoTable ? doc.lastAutoTable.finalY + 16 : 50;
  };

  const renderTabularSection = ({ title, rows, head, columnStyles, formatRow, totalCodes = [] }) => {
    if (!rows || rows.length === 0) return;
    let yy = ensureSpace(80);
    yy = drawSectionBanner(title, yy);
    autoTable(doc, {
      ...tableTheme,
      startY: yy,
      head: [head],
      body: rows.map(formatRow),
      columnStyles,
      didParseCell: (data) => {
        // Highlight total/parent rows.
        const row = rows[data.row.index];
        if (row && (row.isTotal || totalCodes.includes(row.code))) {
          Object.assign(data.cell.styles, totalRowStyle);
        }
        // Mono-space all "Amount" / "Code" cells.
        if (data.column.index === 0) data.cell.styles.font = 'courier';
        if (data.section === 'body' && data.cell.styles.halign === 'right') data.cell.styles.font = 'courier';
      },
    });
  };

  // Move to a fresh page for sections (cover page is its own).
  doc.addPage();
  doc.lastAutoTable = null; // reset so ensureSpace starts at top of fresh page

  // ── Income ────────────────────────────────────────────────────────────────
  renderTabularSection({
    title: 'Income',
    rows:  sections.income,
    head:  ['Code', 'Total Amount', 'Exempt / Fixed / Final Tax', 'Description', 'Subject to Normal Tax'],
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 90, halign: 'right' },
      2: { cellWidth: 90, halign: 'right' },
      3: { cellWidth: 'auto' },
      4: { cellWidth: 90, halign: 'right' },
    },
    formatRow: (r) => [r.code, fmt(r.total), fmt(r.exempt), r.label, fmt(r.normal)],
  });

  // ── Tax Reductions ────────────────────────────────────────────────────────
  renderTabularSection({
    title: 'Tax Reductions',
    rows:  sections.tax_reductions,
    head:  ['Code', 'Total Amount', 'Tax Reducted', 'Description', 'Tax Chargeable'],
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 90, halign: 'right' },
      2: { cellWidth: 90, halign: 'right' },
      3: { cellWidth: 'auto' },
      4: { cellWidth: 90, halign: 'right' },
    },
    formatRow: (r) => [r.code, fmt(r.total), fmt(r.tax_reducted), r.label, fmt(r.tax_chargeable)],
  });

  // ── Capital Assets u/s 7E ─────────────────────────────────────────────────
  renderTabularSection({
    title: 'Capital Assets',
    rows:  sections.capital_assets,
    head:  ['Code', 'Cost / Declared Value', 'Description', 'Fair Market Value'],
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 110, halign: 'right' },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 110, halign: 'right' },
    },
    formatRow: (r) => [r.code, fmt(r.cost_declared), r.label, fmt(r.fair_market)],
  });

  // ── Adjustable Tax ────────────────────────────────────────────────────────
  renderTabularSection({
    title: 'Adjustable Tax',
    rows:  sections.adjustable_tax,
    head:  ['Code', 'Taxable Value', 'Tax Chargeable', 'Description', 'Tax Collected / Deducted'],
    totalCodes: ['640000'],
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 90, halign: 'right' },
      2: { cellWidth: 90, halign: 'right' },
      3: { cellWidth: 'auto' },
      4: { cellWidth: 110, halign: 'right' },
    },
    formatRow: (r) => [r.code, fmt(r.taxable_value), fmt(r.tax_chargeable), r.label, fmt(r.tax_collected)],
  });

  // ── Fixed / Final Tax ─────────────────────────────────────────────────────
  renderTabularSection({
    title: 'Fixed / Final Tax',
    rows:  sections.fixed_final_tax,
    head:  ['Code', 'Taxable Value', 'Tax Chargeable', 'Description', 'Tax Collected / Deducted'],
    totalCodes: ['64000101'],
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 90, halign: 'right' },
      2: { cellWidth: 90, halign: 'right' },
      3: { cellWidth: 'auto' },
      4: { cellWidth: 110, halign: 'right' },
    },
    formatRow: (r) => [r.code, fmt(r.taxable_value), fmt(r.tax_chargeable), r.label, fmt(r.tax_collected)],
  });

  // ── Computations ──────────────────────────────────────────────────────────
  renderTabularSection({
    title: 'Computations',
    rows:  sections.computations,
    head:  ['Code', 'Total Amount', 'Exempt / Fixed / Final Tax', 'Description', 'Subject to Normal Tax'],
    totalCodes: ['9000', '9100', '9200', '9210'],
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 100, halign: 'right' },
      2: { cellWidth: 90,  halign: 'right' },
      3: { cellWidth: 'auto' },
      4: { cellWidth: 90,  halign: 'right' },
    },
    formatRow: (r) => [r.code, fmt(r.total), fmt(r.exempt), r.label, fmt(r.normal)],
  });

  // ── Personal Assets / Liabilities ─────────────────────────────────────────
  renderTabularSection({
    title: 'Personal Assets / Liabilities',
    rows:  sections.personal_assets,
    head:  ['Code', 'Amount', 'Description'],
    totalCodes: ['7015', '7019'],
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 130, halign: 'right' },
      2: { cellWidth: 'auto' },
    },
    formatRow: (r) => [r.code, fmt(r.amount), r.label],
  });

  // ── Personal Expenses ─────────────────────────────────────────────────────
  renderTabularSection({
    title: 'Personal Expenses',
    rows:  sections.personal_expenses,
    head:  ['Code', 'Amount', 'Description'],
    totalCodes: ['7089'],
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 130, halign: 'right' },
      2: { cellWidth: 'auto' },
    },
    formatRow: (r) => [r.code, fmt(r.amount), r.label],
  });

  // ── Reconciliation of Net Assets ──────────────────────────────────────────
  renderTabularSection({
    title: 'Reconciliation of Net Assets',
    rows:  sections.reconciliation,
    head:  ['Code', 'Amount', 'Description'],
    totalCodes: ['703001', '703002', '703000'],
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 130, halign: 'right' },
      2: { cellWidth: 'auto' },
    },
    formatRow: (r) => [r.code, fmt(r.amount), r.label],
  });

  // ── Footer with page numbers on every page ────────────────────────────────
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth - 36, pageHeight - 22, { align: 'right' }
    );
    doc.text(
      'This is a computer-generated document for review. Verify against FBR IRIS before filing.',
      36, pageHeight - 22
    );
  }

  const filename = ctx.filename || `paktax-iris-${ctx.taxYear || 'return'}.pdf`;
  doc.save(filename);
  return filename;
}
