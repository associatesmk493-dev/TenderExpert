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

// A label/value line that disappears when there is no value.
const row = (label: string, value: unknown, bold = false) =>
  String(value ?? '').trim() ? `<div class="kv"><span>${label}</span>${bold ? '<b>' : ''}${esc(value)}${bold ? '</b>' : ''}</div>` : '';

export function invoiceHtml(invoice: any, companyInput: Partial<CompanyInfo> | null, kind: InvoiceKind) {
  const inv = withGst(invoice);
  const company = mergeCompany(companyInput);
  const items: InvoiceItem[] = (inv.line_items || []).map((item: any) => ({
    description: item.description || '',
    hsn_sac: item.hsn_sac || item.hsn || '',
    amount: Number(item.amount ?? Number(item.quantity || 1) * Number(item.rate || 0)) || 0,
  }));
  const hasHsn = items.some((item) => item.hsn_sac.trim());
  const gstType: GstType = inv.gst_type || 'igst';
  const rate = Number(inv.gst_rate || 0);
  const { total, advance, balance } = invoiceBalance(inv);
  const subtotal = Number(inv.subtotal || 0);
  const words = amountInWords(total);
  const title = kind === 'proforma' ? 'Proforma Invoice' : 'Tax Invoice';

  const taxRows: [string, number, number][] =
    gstType === 'igst'
      ? [['IGST', rate, Number(inv.igst_amount)]]
      : gstType === 'cgst_sgst'
      ? [
          ['CGST', rate / 2, Number(inv.cgst_amount)],
          ['SGST', rate / 2, Number(inv.sgst_amount)],
        ]
      : [];
  const hasTax = taxRows.length > 0 && taxRows.some(([, , amount]) => amount > 0);

  const header = company.logo_url
    ? `<img class="logo" src="${esc(company.logo_url)}" alt="${esc(company.company_name)}">`
    : `<div class="brand"><div class="amp">&amp;</div><div><div class="brand-name">${esc(company.company_name).toUpperCase()}</div><div class="brand-bar"></div><div class="tagline">${esc(company.tagline)}</div></div></div>`;

  const byLines = [
    company.address ? `<div class="line">${multiline(company.address)}</div>` : '',
    row('GST No', company.gst_number, true),
    row('PAN', company.pan_number, true),
    row('Phone', company.phone),
    row('Email', company.email),
  ].join('');

  const toLines = [
    inv.bill_to_contact ? `<div class="line">Attn: ${esc(inv.bill_to_contact)}</div>` : '',
    inv.bill_to_address ? `<div class="line">${multiline(inv.bill_to_address)}</div>` : '',
    row('GST No', inv.bill_to_gst, true),
    row('Phone', inv.bill_to_phone),
    row('Email', inv.bill_to_email),
  ].join('');

  const bankRows = [
    row('Account name', company.account_name),
    row('Account no', company.account_number),
    row('IFSC', company.ifsc_code),
    row('Bank', company.bank_name),
    row('Branch', company.bank_branch),
  ].join('');

  const paymentBox =
    advance > 0 || inv.payment_terms
      ? `<div class="box warm" style="flex:1">
          <div class="label">Payment terms</div>
          ${advance > 0 ? `<div class="pay-row"><span>Total amount</span><b>&#8377; ${formatMoney(total)}</b></div>
          <div class="pay-row"><span>Advance received</span><b>&#8377; ${formatMoney(advance)}</b></div>
          <div class="pay-row due"><span>Balance due</span><b>&#8377; ${formatMoney(balance)}</b></div>` : ''}
          ${inv.payment_terms ? `<div class="terms-text">${multiline(inv.payment_terms)}</div>` : ''}
        </div>`
      : '';

  const contacts = [company.phone, company.email, company.website].filter((value) => String(value || '').trim());

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=794"><title>${esc(inv.invoice_number)}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; background: #e5e7eb; font-family: Arial, Helvetica, sans-serif; color: #1f2937; }
  .page { font-family: Arial, Helvetica, sans-serif; color: #1f2937; width: 794px; margin: 0 auto; background: #fff; }
  .topbar { height: 8px; background: linear-gradient(90deg, #1b4f9c 0%, #1b4f9c 82%, #f7941d 82%, #f7941d 100%); }
  .content { padding: 28px 44px 8px; }
  .head { display: flex; justify-content: space-between; align-items: center; gap: 24px; padding-bottom: 18px; border-bottom: 2px solid #f7941d; }
  .logo { max-height: 72px; max-width: 340px; display: block; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .amp { width: 52px; height: 52px; border-radius: 50%; border: 4px solid #f7941d; color: #f7941d; font-weight: 800; font-size: 28px; display: flex; align-items: center; justify-content: center; }
  .brand-name { font-size: 24px; font-weight: 800; color: #1b4f9c; letter-spacing: .5px; }
  .brand-bar { height: 5px; background: #f7941d; margin: 3px 0; }
  .tagline { font-size: 11px; font-weight: 700; color: #1b4f9c; }
  .doc { text-align: right; }
  .doc-title { font-size: 22px; font-weight: 800; letter-spacing: 2px; color: #1b4f9c; text-transform: uppercase; }
  .chips { display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px; }
  .chip { min-width: 120px; padding: 7px 12px; border-radius: 8px; background: #eef3fb; text-align: left; }
  .chip span { display: block; font-size: 9px; font-weight: 700; letter-spacing: .9px; color: #6b7280; text-transform: uppercase; }
  .chip b { display: block; margin-top: 2px; font-size: 12.5px; color: #111827; }
  .parties { display: flex; gap: 16px; margin-top: 20px; }
  .box, .party { flex: 1; padding: 13px 15px; border-radius: 8px; background: #f7f9fc; }
  .party { border-left: 3px solid #1b4f9c; }
  .party.to { border-left-color: #f7941d; }
  .label { margin-bottom: 7px; font-size: 9.5px; font-weight: 700; letter-spacing: .9px; color: #1b4f9c; text-transform: uppercase; }
  .pname { margin-bottom: 4px; font-size: 14.5px; font-weight: 800; color: #111827; }
  .line { font-size: 11px; line-height: 1.55; color: #374151; }
  .kv { display: flex; gap: 8px; font-size: 11px; line-height: 1.7; color: #374151; }
  .kv span { min-width: 70px; color: #6b7280; }
  .kv b { color: #111827; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 20px; }
  table.items th { padding: 10px 12px; background: #fde6c4; color: #7a4a0a; font-size: 10px; letter-spacing: .8px; text-align: left; }
  table.items th:first-child { border-radius: 8px 0 0 8px; }
  table.items th:last-child { border-radius: 0 8px 8px 0; }
  table.items td { padding: 12px; border-bottom: 1px solid #eceff3; font-size: 11.5px; line-height: 1.5; vertical-align: top; }
  table.items th.c, table.items td.c { text-align: center; }
  table.items th.r, table.items td.r { text-align: right; white-space: nowrap; }
  table.items tr { page-break-inside: avoid; }
  .summary { display: flex; gap: 22px; margin-top: 18px; align-items: flex-start; }
  .words { flex: 1; padding: 13px 15px; border: 1px dashed #cbd5e1; border-radius: 8px; }
  .words .txt { margin-top: 2px; font-size: 12px; font-weight: 700; line-height: 1.55; }
  .words .eoe { margin-top: 8px; font-size: 10px; color: #6b7280; }
  .totals { width: 262px; }
  .totals .r { display: flex; justify-content: space-between; padding: 7px 4px; border-bottom: 1px solid #eceff3; font-size: 11.5px; color: #374151; }
  .totals .grand { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; padding: 11px 14px; border-radius: 8px; background: #1b4f9c; color: #fff; font-size: 14px; font-weight: 800; }
  .lower { display: flex; gap: 16px; margin-top: 18px; align-items: stretch; }
  .warm { background: #fffaf2; border: 1px solid #f3c88e; }
  .pay-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 11.5px; }
  .pay-row.due { margin-top: 5px; padding-top: 8px; border-top: 1px solid #f3c88e; font-size: 13px; color: #b45309; }
  .terms-text { margin-top: 8px; font-size: 10.5px; line-height: 1.55; color: #4b5563; }
  .sign { flex: .8; display: flex; flex-direction: column; justify-content: space-between; min-height: 110px; text-align: right; font-size: 11px; font-weight: 700; }
  .sign .sig-line { padding-top: 6px; border-top: 1px solid #9ca3af; }
  .terms { margin-top: 16px; font-size: 10px; line-height: 1.55; color: #4b5563; }
  .footer { margin-top: 24px; }
  .computer { padding-bottom: 8px; text-align: center; font-size: 9.5px; font-weight: 700; color: #6b7280; }
  .contacts { display: flex; justify-content: center; flex-wrap: wrap; gap: 5px 20px; padding: 0 44px 14px; font-size: 10px; font-weight: 700; color: #1b4f9c; }
  .contacts span::before { content: ''; display: inline-block; width: 7px; height: 7px; margin-right: 6px; border-radius: 50%; background: #f7941d; }
  .band { height: 8px; background: linear-gradient(90deg, #f7941d 0%, #f7941d 18%, #1b4f9c 18%, #1b4f9c 100%); }
  @media print { body { background: #fff; } }
</style></head><body><div class="page">
  <div class="topbar"></div>
  <div class="content">
    <div class="head">
      <div>${header}</div>
      <div class="doc">
        <div class="doc-title">${title}</div>
        <div class="chips">
          <div class="chip"><span>Invoice no</span><b>${esc(inv.invoice_number)}</b></div>
          <div class="chip"><span>Date</span><b>${formatDate(inv.invoice_date)}</b></div>
        </div>
      </div>
    </div>

    <div class="parties">
      <div class="party"><div class="label">Billed by</div><div class="pname">${esc(company.company_name)}</div>${byLines}</div>
      <div class="party to"><div class="label">Billed to</div><div class="pname">${esc(inv.bill_to_name || inv.b2g_leads?.organization_name || inv.companies?.name || 'Client')}</div>${toLines}</div>
    </div>

    <table class="items">
      <tr><th class="c" style="width:48px">S.NO</th><th>DESCRIPTION</th>${hasHsn ? '<th class="c" style="width:120px">HSN / SAC</th>' : ''}<th class="r" style="width:140px">AMOUNT (&#8377;)</th></tr>
      ${items.map((item, index) => `<tr><td class="c">${index + 1}</td><td>${multiline(item.description)}</td>${hasHsn ? `<td class="c">${esc(item.hsn_sac)}</td>` : ''}<td class="r">${formatMoney(item.amount)}</td></tr>`).join('')}
    </table>

    <div class="summary">
      <div class="words">
        <div class="label">Amount chargeable (in words)</div>
        <div class="txt">${esc(words)}</div>
        <div class="eoe">E. &amp; O.E</div>
      </div>
      <div class="totals">
        ${hasTax ? `<div class="r"><span>Sub total</span><span>${formatMoney(subtotal)}</span></div>` : ''}
        ${hasTax ? taxRows.map(([name, pct, amount]) => `<div class="r"><span>${name} (${pct}%)</span><span>${formatMoney(amount)}</span></div>`).join('') : ''}
        <div class="grand"><span>TOTAL</span><span>&#8377; ${formatMoney(total)}</span></div>
      </div>
    </div>

    <div class="lower">
      ${bankRows ? `<div class="box" style="flex:1.2"><div class="label">Bank details</div>${bankRows}</div>` : ''}
      ${paymentBox}
      <div class="sign"><div>for ${esc(company.company_name)}</div><div class="sig-line">Authorised Signatory</div></div>
    </div>
    ${company.terms_conditions ? `<div class="terms"><b>Terms &amp; Conditions</b><br>${multiline(company.terms_conditions)}</div>` : ''}
  </div>
  <div class="footer">
    <div class="computer">This is a Computer Generated Invoice</div>
    ${contacts.length ? `<div class="contacts">${contacts.map((value) => `<span>${esc(value)}</span>`).join('')}</div>` : ''}
    <div class="band"></div>
  </div>
</div></body></html>`;
}
