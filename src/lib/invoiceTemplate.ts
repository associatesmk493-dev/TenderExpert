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
  qr_code_url: string;
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
  qr_code_url: '',
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

// A "Label: value" line that disappears when there is no value.
const line = (label: string, value: unknown) =>
  String(value ?? '').trim() ? `<div class="ln"><b>${label}:</b> ${esc(value)}</div>` : '';

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

  const brand = company.logo_url
    ? `<img class="logo" src="${esc(company.logo_url)}" alt="${esc(company.company_name)}">`
    : `<div class="brand"><div class="amp">&amp;</div><div><div class="brand-name">${esc(company.company_name).toUpperCase()}</div><div class="brand-bar"></div><div class="tagline">${esc(company.tagline)}</div></div></div>`;

  const fromLines = [
    company.address ? `<div class="ln"><b>Address:</b> ${multiline(company.address)}</div>` : '',
    line('Phone', company.phone),
    line('Email', company.email),
    line('GST No', company.gst_number),
    line('PAN', company.pan_number),
  ].join('');

  const toLines = [
    line('Attn', inv.bill_to_contact),
    inv.bill_to_address ? `<div class="ln"><b>Address:</b> ${multiline(inv.bill_to_address)}</div>` : '',
    line('Phone', inv.bill_to_phone),
    line('Email', inv.bill_to_email),
    line('GST No', inv.bill_to_gst),
  ].join('');

  const bankLines = [
    line('Account name', company.account_name),
    line('Account no', company.account_number),
    line('IFSC', company.ifsc_code),
    line('Bank', company.bank_name),
    line('Branch', company.bank_branch),
  ].join('');

  const termsList = [
    ...(inv.payment_terms ? String(inv.payment_terms).split('\n') : []),
    ...(company.terms_conditions ? String(company.terms_conditions).split('\n') : []),
  ]
    .map((entry) => entry.trim().replace(/^\d+[.)]\s*/, ''))
    .filter(Boolean);

  const contacts = [company.phone, company.email, company.website].filter((value) => String(value || '').trim());
  const payable = advance > 0 ? balance : total;

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=794"><title>${esc(inv.invoice_number)}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; background: #e5e7eb; font-family: Arial, Helvetica, sans-serif; color: #111827; }
  .page { font-family: Arial, Helvetica, sans-serif; color: #111827; width: 794px; min-height: 1120px; margin: 0 auto; background: #fff; display: flex; flex-direction: column; }
  .topbar { height: 9px; background: linear-gradient(90deg, #1b4f9c 0%, #1b4f9c 82%, #f7941d 82%, #f7941d 100%); }
  .content { flex: 1; display: flex; flex-direction: column; padding: 26px 44px 0; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
  .logo { max-height: 78px; max-width: 340px; display: block; }
  .brand { display: flex; align-items: center; gap: 13px; }
  .amp { width: 56px; height: 56px; border-radius: 50%; border: 4px solid #f7941d; color: #f7941d; font-weight: 800; font-size: 30px; display: flex; align-items: center; justify-content: center; }
  .brand-name { font-size: 24px; font-weight: 800; color: #1b4f9c; letter-spacing: .5px; white-space: nowrap; }
  .brand-bar { height: 5px; background: #f7941d; margin: 3px 0; }
  .tagline { font-size: 12px; font-weight: 700; color: #1b4f9c; }
  .doc { text-align: right; }
  .doc-title { font-size: 26px; font-weight: 800; line-height: 1; letter-spacing: .5px; white-space: nowrap; color: #1b4f9c; text-transform: uppercase; }
  .doc-meta { margin-top: 9px; font-size: 13px; line-height: 1.65; }
  .doc-meta b { font-weight: 800; }
  .parties { display: flex; gap: 26px; margin-top: 22px; }
  .party { flex: 1; min-width: 0; }
  .bar { padding: 9px 15px; background: #1b4f9c; color: #fff; font-size: 14px; font-weight: 800; }
  .pbody { padding: 10px 2px 0; font-size: 12px; line-height: 1.6; }
  .pname { margin-bottom: 4px; font-size: 15.5px; font-weight: 800; }
  .ln b { font-weight: 800; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 20px; border: 1px solid #1f2937; }
  table.items th { padding: 10px 14px; border: 1px solid #1f2937; background: #1b4f9c; color: #fff; font-size: 13px; text-align: left; }
  table.items td { padding: 11px 14px; border: 1px solid #1f2937; font-size: 13px; line-height: 1.5; vertical-align: top; }
  table.items th.c, table.items td.c { text-align: center; }
  table.items th.r, table.items td.r { text-align: right; white-space: nowrap; }
  table.items tr { page-break-inside: avoid; }
  .summary { display: flex; gap: 28px; margin-top: 18px; align-items: flex-start; }
  .left { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 10px; }
  .box { padding: 11px 14px; border: 1px dashed #b8c2d0; border-radius: 10px; }
  .box-title { margin-bottom: 6px; font-size: 10.5px; font-weight: 800; letter-spacing: .9px; color: #1b4f9c; text-transform: uppercase; }
  .words-text { font-size: 13px; font-weight: 800; line-height: 1.5; }
  .eoe { margin-top: 6px; font-size: 10.5px; color: #6b7280; }
  .bank { font-size: 11.5px; line-height: 1.6; }
  .qr { display: flex; align-items: center; gap: 16px; }
  .qr img { width: 96px; height: 96px; display: block; }
  .qr .pay { font-size: 14px; font-weight: 800; }
  .qr .apps { margin-top: 4px; font-size: 11px; color: #6b7280; }
  .totals { width: 300px; font-size: 13.5px; }
  .totals .r { display: flex; justify-content: space-between; padding: 6px 0; }
  .totals .r b { font-weight: 800; }
  .totals .grand { display: flex; justify-content: space-between; margin-top: 6px; padding-top: 12px; border-top: 2px solid #1b4f9c; font-size: 18px; font-weight: 800; }
  .totals .due { color: #b45309; font-weight: 800; }
  .terms { margin-top: 16px; font-size: 12px; line-height: 1.65; }
  .terms .t { margin-bottom: 4px; font-size: 14px; font-weight: 800; }
  .grow { flex: 1; min-height: 18px; }
  .sign { align-self: flex-end; width: 240px; padding-top: 6px; text-align: right; font-size: 12.5px; }
  .sign .for { font-weight: 700; }
  .sign .space { height: 40px; }
  .sign .sig { padding-top: 7px; border-top: 1px solid #9ca3af; color: #4b5563; text-align: center; }
  .footer { margin-top: 14px; }
  .computer { padding-bottom: 6px; text-align: center; font-size: 10px; color: #6b7280; }
  .contacts { display: flex; justify-content: center; flex-wrap: wrap; gap: 4px 22px; padding: 0 46px 12px; font-size: 11px; font-weight: 700; color: #1b4f9c; }
  .contacts span::before { content: ''; display: inline-block; width: 7px; height: 7px; margin-right: 6px; border-radius: 50%; background: #f7941d; }
  .thanks { padding: 13px; border-top: 4px solid #f7941d; background: #1b4f9c; color: #fff; text-align: center; font-size: 15px; font-weight: 800; }
  @media print { body { background: #fff; } }
</style></head><body><div class="page">
  <div class="topbar"></div>
  <div class="content">
    <div class="head">
      <div>${brand}</div>
      <div class="doc">
        <div class="doc-title">${title}</div>
        <div class="doc-meta"><div><b>Invoice No:</b> ${esc(inv.invoice_number)}</div><div><b>Date:</b> ${formatDate(inv.invoice_date)}</div>${inv.due_date ? `<div><b>Due:</b> ${formatDate(inv.due_date)}</div>` : ''}</div>
      </div>
    </div>

    <div class="parties">
      <div class="party"><div class="bar">Billed By</div><div class="pbody"><div class="pname">${esc(company.company_name)}</div>${fromLines}</div></div>
      <div class="party"><div class="bar">Billed To</div><div class="pbody"><div class="pname">${esc(inv.bill_to_name || inv.b2g_leads?.organization_name || inv.companies?.name || 'Client')}</div>${toLines}</div></div>
    </div>

    <table class="items">
      <tr><th class="c" style="width:48px">#</th><th>Description</th>${hasHsn ? '<th class="c" style="width:120px">HSN / SAC</th>' : ''}<th class="r" style="width:150px">Amount</th></tr>
      ${items.map((item, index) => `<tr><td class="c">${index + 1}</td><td>${multiline(item.description)}</td>${hasHsn ? `<td class="c">${esc(item.hsn_sac)}</td>` : ''}<td class="r">&#8377;${formatMoney(item.amount)}</td></tr>`).join('')}
    </table>

    <div class="summary">
      <div class="left">
        <div class="box"><div class="box-title">Amount chargeable (in words)</div><div class="words-text">${esc(words)}</div><div class="eoe">E. &amp; O.E</div></div>
        ${bankLines ? `<div class="box"><div class="box-title">Bank details</div><div class="bank">${bankLines}</div></div>` : ''}
        ${company.qr_code_url ? `<div class="box qr"><img src="${esc(company.qr_code_url)}" alt="Payment QR"><div><div class="pay">Scan &amp; pay &#8377;${formatMoney(payable)}</div><div class="apps">GPay &middot; PhonePe &middot; Paytm &middot; any UPI app</div></div></div>` : ''}
      </div>
      <div class="totals">
        ${hasTax ? `<div class="r"><span>Taxable Amount</span><b>&#8377;${formatMoney(subtotal)}</b></div>` : ''}
        ${hasTax ? taxRows.map(([name, pct, amount]) => `<div class="r"><span>${name} (${pct}%)</span><b>&#8377;${formatMoney(amount)}</b></div>`).join('') : ''}
        <div class="grand"><span>Total Amount</span><span>&#8377;${formatMoney(total)}</span></div>
        ${advance > 0 ? `<div class="r"><span>Advance received</span><b>&#8377;${formatMoney(advance)}</b></div><div class="r due"><span>Balance Due</span><span>&#8377;${formatMoney(balance)}</span></div>` : ''}
      </div>
    </div>

    ${termsList.length ? `<div class="terms"><div class="t">Terms &amp; Conditions</div>${termsList.map((entry, index) => `<div>${termsList.length > 1 ? `${index + 1}. ` : ''}${esc(entry)}</div>`).join('')}</div>` : ''}

    <div class="grow"></div>
    <div class="sign"><div class="for">for ${esc(company.company_name)}</div><div class="space"></div><div class="sig">Authorised Signatory</div></div>

    <div class="footer">
      <div class="computer">This is a Computer Generated Invoice</div>
      ${contacts.length ? `<div class="contacts">${contacts.map((value) => `<span>${esc(value)}</span>`).join('')}</div>` : ''}
    </div>
  </div>
  <div class="thanks">Thank you for your business!</div>
</div></body></html>`;
}
