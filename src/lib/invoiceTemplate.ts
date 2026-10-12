/* eslint-disable @typescript-eslint/no-explicit-any */
import { amountInWords } from '@/lib/amountInWords';

export type GstType = 'igst' | 'cgst_sgst' | 'none';
export type InvoiceKind = 'proforma' | 'tax';
export type InvoiceItem = { description: string; hsn_sac: string; amount: number };

export type CompanyInfo = {
  company_name: string;
  tagline: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  gst_number: string;
  pan_number: string;
  account_name: string;
  account_number: string;
  ifsc_code: string;
  bank_name: string;
  bank_branch: string;
  logo_url: string;
  terms_conditions: string;
};

export const DEFAULT_COMPANY: CompanyInfo = {
  company_name: 'M K & Associates',
  tagline: 'Strategic B2G Consulting & Procurement',
  email: 'connect@mkassociatess.com',
  phone: '+91 9821180856',
  website: 'www.mkassociatess.com',
  address: '247 Workspace, Mega Mall, Phase - I, Golf Course Road, Gurugram, Haryana',
  gst_number: '06ACEFM6974B1Z7',
  pan_number: 'ACEFM6974B',
  account_name: 'M K & Associates',
  account_number: '142263200000072',
  ifsc_code: 'YESB0001422',
  bank_name: 'YES BANK LTD',
  bank_branch: 'Sector-56, Gurugram',
  logo_url: '',
  terms_conditions: '',
};

export const mergeCompany = (saved: Partial<CompanyInfo> | null | undefined): CompanyInfo => {
  const merged = { ...DEFAULT_COMPANY } as Record<string, string>;
  Object.entries(saved || {}).forEach(([key, value]) => {
    if (typeof value === 'string' && value.trim()) merged[key] = value;
  });
  return merged as unknown as CompanyInfo;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const calcInvoice = (items: { amount: number | string }[], gstType: GstType, rate: number) => {
  const subtotal = round2(items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0));
  const gst = gstType === 'none' ? 0 : round2((subtotal * (Number(rate) || 0)) / 100);
  const igst = gstType === 'igst' ? gst : 0;
  const cgst = gstType === 'cgst_sgst' ? round2(gst / 2) : 0;
  const sgst = gstType === 'cgst_sgst' ? round2(gst - cgst) : 0;
  return { subtotal, igst, cgst, sgst, total: round2(subtotal + igst + cgst + sgst) };
};

// Invoices saved before GST amounts were stored have a rate but zero tax amounts; derive them.
export const withGst = (inv: any) => {
  const gstType: GstType = inv.gst_type || 'igst';
  const stored = Number(inv.igst_amount || 0) + Number(inv.cgst_amount || 0) + Number(inv.sgst_amount || 0);
  if (stored > 0 || gstType === 'none' || !(Number(inv.gst_rate) > 0)) return inv;
  const derived = calcInvoice([{ amount: inv.subtotal }], gstType, Number(inv.gst_rate));
  return { ...inv, igst_amount: derived.igst, cgst_amount: derived.cgst, sgst_amount: derived.sgst };
};

export const invoiceTotal = (input: any) => {
  const inv = withGst(input);
  return round2(Number(inv.subtotal || 0) + Number(inv.igst_amount || 0) + Number(inv.cgst_amount || 0) + Number(inv.sgst_amount || 0));
};

// Advance received against the invoice and what is still to be paid.
export const invoiceBalance = (inv: any) => {
  const total = invoiceTotal(inv);
  const advance = Math.min(total, Math.max(0, Number(inv.advance_adjustment || 0)));
  return { total, advance, balance: round2(total - advance) };
};

export const formatMoney = (n: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

const esc = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const multiline = (value: unknown) => esc(value).replace(/\n/g, '<br>');

const formatDate = (value: string) => {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? esc(value) : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

export function invoiceHtml(invoice: any, companyInput: Partial<CompanyInfo> | null, kind: InvoiceKind) {
  const inv = withGst(invoice);
  const company = mergeCompany(companyInput);
  const items: InvoiceItem[] = (inv.line_items || []).map((item: any) => ({
    description: item.description || '',
    hsn_sac: item.hsn_sac || item.hsn || '',
    amount: Number(item.amount ?? Number(item.quantity || 1) * Number(item.rate || 0)) || 0,
  }));
  const gstType: GstType = inv.gst_type || 'igst';
  const rate = Number(inv.gst_rate || 0);
  const { total, advance, balance } = invoiceBalance(inv);
  const subtotal = Number(inv.subtotal || 0);
  const words = amountInWords(total);
  const title = kind === 'proforma' ? 'Proforma Invoice' : 'Tax Invoice';

  const taxRows =
    gstType === 'igst'
      ? [['IGST', rate, Number(inv.igst_amount)]]
      : gstType === 'cgst_sgst'
      ? [
          ['CGST', rate / 2, Number(inv.cgst_amount)],
          ['SGST', rate / 2, Number(inv.sgst_amount)],
        ]
      : [];

  const header = company.logo_url
    ? `<img class="logo" src="${esc(company.logo_url)}" alt="${esc(company.company_name)}">`
    : `<div class="brand"><div class="amp">&amp;</div><div><div class="brand-name">${esc(company.company_name).toUpperCase()}</div><div class="brand-bar"></div><div class="tagline">${esc(company.tagline)}</div></div></div>`;

  const billLines = [
    inv.bill_to_contact ? `<span class="muted">Attn:</span> ${esc(inv.bill_to_contact)}` : '',
    inv.bill_to_address ? multiline(inv.bill_to_address) : '',
    inv.bill_to_phone ? `<span class="muted">Phone:</span> ${esc(inv.bill_to_phone)}` : '',
    inv.bill_to_email ? `<span class="muted">Email:</span> ${esc(inv.bill_to_email)}` : '',
    inv.bill_to_gst ? `<span class="muted">GST No:</span> <b>${esc(inv.bill_to_gst)}</b>` : '',
  ].filter(Boolean);

  const paymentBox =
    advance > 0 || inv.payment_terms
      ? `<div class="box pay-box" style="flex:1">
          <div class="box-label">Payment terms</div>
          ${advance > 0 ? `<div class="pay-row"><span>Total amount</span><b>&#8377; ${formatMoney(total)}</b></div>
          <div class="pay-row"><span>Advance received</span><b>&#8377; ${formatMoney(advance)}</b></div>
          <div class="pay-row due"><span>Balance due</span><b>&#8377; ${formatMoney(balance)}</b></div>` : ''}
          ${inv.payment_terms ? `<div class="terms-text">${multiline(inv.payment_terms)}</div>` : ''}
        </div>`
      : '';

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(inv.invoice_number)}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; background: #e5e7eb; font-family: Arial, Helvetica, sans-serif; color: #1f2937; }
  .page { font-family: Arial, Helvetica, sans-serif; color: #1f2937; width: 794px; min-height: 1120px; margin: 0 auto; background: #fff; display: flex; flex-direction: column; }
  .topbar { height: 8px; background: linear-gradient(90deg, #1b4f9c 0%, #1b4f9c 80%, #f7941d 80%, #f7941d 100%); }
  .content { flex: 1; padding: 30px 44px 18px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
  .logo { max-height: 72px; max-width: 340px; display: block; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .amp { width: 52px; height: 52px; border-radius: 50%; border: 4px solid #f7941d; color: #f7941d; font-weight: 800; font-size: 28px; display: flex; align-items: center; justify-content: center; }
  .brand-name { font-size: 24px; font-weight: 800; color: #1b4f9c; letter-spacing: .5px; }
  .brand-bar { height: 5px; background: #f7941d; margin: 3px 0; }
  .tagline { font-size: 11px; font-weight: 700; color: #1b4f9c; }
  .doc { text-align: right; }
  .doc h1 { margin: 0; font-size: 24px; letter-spacing: 1.5px; color: #1b4f9c; text-transform: uppercase; }
  .doc .no { margin-top: 8px; font-size: 12px; font-weight: 700; }
  .doc .dt { margin-top: 3px; font-size: 12px; color: #4b5563; }
  .strip { display: flex; flex-wrap: wrap; gap: 4px 20px; margin-top: 16px; padding: 9px 0; border-top: 2px solid #f7941d; border-bottom: 1px solid #e5e7eb; font-size: 10px; color: #4b5563; }
  .strip b { color: #1f2937; }
  .boxes { display: flex; gap: 16px; margin-top: 18px; }
  .box { flex: 1; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; background: #fafbfd; }
  .box-label { margin-bottom: 7px; font-size: 9.5px; font-weight: 700; letter-spacing: .9px; color: #1b4f9c; text-transform: uppercase; }
  .to-name { margin-bottom: 4px; font-size: 15px; font-weight: 800; color: #111827; }
  .line { font-size: 11px; line-height: 1.6; color: #374151; }
  .muted { color: #6b7280; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 20px; }
  table.items th { padding: 9px 10px; background: #fde6c4; border-bottom: 2px solid #f3c88e; color: #7a4a0a; font-size: 10px; letter-spacing: .7px; text-align: left; }
  table.items td { padding: 11px 10px; border-bottom: 1px solid #eceff3; font-size: 11.5px; vertical-align: top; }
  table.items th.c, table.items td.c { text-align: center; }
  table.items th.r, table.items td.r { text-align: right; white-space: nowrap; }
  table.items tr { page-break-inside: avoid; }
  .summary { display: flex; gap: 22px; margin-top: 16px; align-items: flex-start; }
  .words { flex: 1; padding: 12px 14px; border: 1px dashed #d1d5db; border-radius: 8px; }
  .words .lbl { font-size: 9.5px; font-weight: 700; letter-spacing: .9px; color: #1b4f9c; text-transform: uppercase; }
  .words .txt { margin-top: 6px; font-size: 12px; font-weight: 700; line-height: 1.5; }
  .words .eoe { margin-top: 8px; font-size: 10px; color: #6b7280; }
  .totals { width: 260px; }
  .totals .row { display: flex; justify-content: space-between; padding: 6px 2px; border-bottom: 1px solid #eceff3; font-size: 11.5px; }
  .totals .grand { display: flex; justify-content: space-between; margin-top: 8px; padding: 10px 12px; border-radius: 6px; background: #1b4f9c; color: #fff; font-size: 14px; font-weight: 800; }
  .lower { display: flex; gap: 16px; margin-top: 18px; }
  .pay { font-size: 11px; line-height: 1.75; }
  .pay b { display: inline-block; min-width: 92px; font-weight: 600; color: #6b7280; }
  .ids { margin-top: 8px; padding-top: 8px; border-top: 1px solid #eceff3; font-size: 11px; font-weight: 800; line-height: 1.7; }
  .pay-box { background: #fffaf2; border-color: #f3c88e; }
  .pay-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 11.5px; }
  .pay-row.due { margin-top: 4px; padding-top: 7px; border-top: 1px solid #f3c88e; font-size: 13px; color: #b45309; }
  .terms-text { margin-top: 8px; font-size: 10.5px; line-height: 1.55; color: #4b5563; }
  .sign { display: flex; flex-direction: column; justify-content: space-between; min-height: 140px; text-align: right; font-size: 11px; font-weight: 700; }
  .sign .line-sign { margin-top: auto; padding-top: 6px; border-top: 1px solid #9ca3af; }
  .terms { margin-top: 16px; font-size: 10px; line-height: 1.55; color: #4b5563; }
  .footer { margin-top: auto; }
  .computer { padding-bottom: 8px; text-align: center; font-size: 9.5px; font-weight: 700; color: #6b7280; }
  .contacts { display: flex; justify-content: center; flex-wrap: wrap; gap: 5px 20px; padding: 0 44px 12px; font-size: 10px; font-weight: 700; color: #1b4f9c; }
  .contacts span::before { content: ''; display: inline-block; width: 7px; height: 7px; margin-right: 6px; border-radius: 50%; background: #f7941d; }
  .band { height: 8px; background: linear-gradient(90deg, #f7941d 0%, #f7941d 20%, #1b4f9c 20%, #1b4f9c 100%); }
  @media print { body { background: #fff; } }
</style></head><body><div class="page">
  <div class="topbar"></div>
  <div class="content">
    <div class="head">
      <div>${header}</div>
      <div class="doc"><h1>${title}</h1><div class="no">No. ${esc(inv.invoice_number)}</div><div class="dt">Date: ${formatDate(inv.invoice_date)}</div></div>
    </div>
    <div class="strip"><span>${esc(company.address)}</span><span><b>GST</b> ${esc(company.gst_number)}</span><span><b>PAN</b> ${esc(company.pan_number)}</span></div>

    <div class="boxes">
      <div class="box">
        <div class="box-label">${title} to</div>
        <div class="to-name">${esc(inv.bill_to_name || inv.b2g_leads?.organization_name || inv.companies?.name || 'Client')}</div>
        <div class="line">${billLines.join('<br>')}</div>
      </div>
    </div>

    <table class="items">
      <tr><th class="c" style="width:46px">S.NO</th><th>DESCRIPTION</th><th class="c" style="width:120px">HSN / SAC</th><th class="r" style="width:140px">AMOUNT (&#8377;)</th></tr>
      ${items.map((item, index) => `<tr><td class="c">${index + 1}</td><td>${multiline(item.description)}</td><td class="c">${esc(item.hsn_sac)}</td><td class="r">${formatMoney(item.amount)}</td></tr>`).join('')}
    </table>

    <div class="summary">
      <div class="words">
        <div class="lbl">Amount chargeable (in words)</div>
        <div class="txt">${esc(words)}</div>
        <div class="eoe">E. &amp; O.E</div>
      </div>
      <div class="totals">
        <div class="row"><span>Sub total</span><span>${formatMoney(subtotal)}</span></div>
        ${taxRows.map(([name, pct, amount]) => `<div class="row"><span>${name} (${pct}%)</span><span>${formatMoney(Number(amount))}</span></div>`).join('')}
        <div class="grand"><span>TOTAL</span><span>&#8377; ${formatMoney(total)}</span></div>
      </div>
    </div>

    <div class="lower">
      <div class="box" style="flex:1.25">
        <div class="box-label">Payment info</div>
        <div class="pay"><b>Account name</b>${esc(company.account_name)}<br><b>Account no</b>${esc(company.account_number)}<br><b>IFSC</b>${esc(company.ifsc_code)}<br><b>Bank</b>${esc(company.bank_name)}<br><b>Branch</b>${esc(company.bank_branch)}</div>
      </div>
      ${paymentBox}
      <div class="sign" style="flex:0.9"><div>for ${esc(company.company_name)}</div><div class="line-sign">Authorised Signatory</div></div>
    </div>
    ${company.terms_conditions ? `<div class="terms"><b>Terms &amp; Conditions</b><br>${multiline(company.terms_conditions)}</div>` : ''}
  </div>
  <div class="footer">
    <div class="computer">This is a Computer Generated Invoice</div>
    <div class="contacts"><span>${esc(company.phone)}</span><span>${esc(company.email)}</span><span>${esc(company.website)}</span></div>
    <div class="band"></div>
  </div>
</div></body></html>`;
}
