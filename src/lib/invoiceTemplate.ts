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
  const total = invoiceTotal(inv);
  const words = amountInWords(total);
  const title = kind === 'proforma' ? 'Proforma Invoice' : 'Tax Invoice';

  const gstRows =
    gstType === 'igst'
      ? `<tr><td class="lbl">IGST (${rate}%)</td><td></td><td class="amt">${formatMoney(Number(inv.igst_amount))}</td></tr>`
      : gstType === 'cgst_sgst'
      ? `<tr><td class="lbl">CGST (${rate / 2}%)</td><td></td><td class="amt">${formatMoney(Number(inv.cgst_amount))}</td></tr>
         <tr><td class="lbl">SGST (${rate / 2}%)</td><td></td><td class="amt">${formatMoney(Number(inv.sgst_amount))}</td></tr>`
      : '';

  const header = company.logo_url
    ? `<img class="logo" src="${esc(company.logo_url)}" alt="${esc(company.company_name)}">`
    : `<div class="brand"><div class="amp">&amp;</div><div><div class="brand-name">${esc(company.company_name).toUpperCase()}</div><div class="brand-bar"></div><div class="tagline">${esc(company.tagline)}</div></div></div>`;

  const billLines = [
    inv.bill_to_phone ? esc(inv.bill_to_phone) : '',
    inv.bill_to_email ? esc(inv.bill_to_email) : '',
    inv.bill_to_address ? multiline(inv.bill_to_address) : '',
  ].filter(Boolean);

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(inv.invoice_number)}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; background: #e5e7eb; font-family: Arial, Helvetica, sans-serif; color: #1f2937; }
  .page { font-family: Arial, Helvetica, sans-serif; color: #1f2937; position: relative; width: 794px; min-height: 1123px; margin: 0 auto; background: #fff; padding: 40px 48px 190px; overflow: hidden; }
  .deco-blue { position: absolute; top: -200px; right: -60px; width: 300px; height: 300px; border-radius: 50%; background: #1b4f9c; }
  .deco-orange { position: absolute; top: -225px; right: -140px; width: 300px; height: 300px; border-radius: 50%; background: #f7941d; }
  .header { position: relative; z-index: 2; margin-bottom: 30px; }
  .logo { max-height: 84px; max-width: 420px; display: block; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .amp { width: 54px; height: 54px; border-radius: 50%; border: 4px solid #f7941d; color: #f7941d; font-weight: 800; font-size: 30px; display: flex; align-items: center; justify-content: center; }
  .brand-name { font-size: 28px; font-weight: 800; color: #1b4f9c; letter-spacing: .5px; }
  .brand-bar { height: 6px; background: #f7941d; margin: 3px 0; }
  .tagline { font-size: 12px; font-weight: 700; color: #1b4f9c; }
  .meta { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 18px; }
  .to-label { font-size: 12px; margin-bottom: 4px; }
  .to-name { font-size: 18px; font-weight: 800; margin-bottom: 4px; }
  .to-line { font-size: 11px; line-height: 1.55; color: #374151; }
  .meta-right { position: relative; z-index: 3; padding-top: 22px; text-align: right; font-size: 12px; }
  .meta-right b { font-size: 12px; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 10px; }
  table.items th { background: #fde6c4; border: 1px solid #f3c88e; padding: 9px 10px; font-size: 11px; text-align: center; letter-spacing: .4px; }
  table.items td { border: 1px solid #f3c88e; padding: 11px 10px; font-size: 12px; vertical-align: top; }
  table.items td.hsn { text-align: center; }
  table.items td.amt { text-align: right; white-space: nowrap; }
  table.items td.lbl { font-weight: 600; }
  table.items tr.total td { font-weight: 800; background: #fff8ee; }
  .eoe { text-align: right; font-size: 11px; margin-top: 4px; }
  .words-label { font-size: 12px; font-weight: 800; margin-top: 4px; }
  .words { font-size: 12px; margin-top: 4px; min-height: 18px; }
  .ids { margin-top: 26px; font-size: 12px; font-weight: 800; line-height: 1.9; }
  .bottom { display: flex; justify-content: space-between; gap: 24px; margin-top: 18px; }
  .pay-title { font-size: 12px; font-weight: 800; margin-bottom: 4px; }
  .pay { font-size: 11px; line-height: 1.75; }
  .sign { text-align: right; font-size: 11px; font-weight: 800; display: flex; flex-direction: column; justify-content: space-between; min-height: 110px; }
  .terms { margin-top: 18px; font-size: 10px; line-height: 1.5; color: #4b5563; }
  .footer { position: absolute; left: 0; right: 0; bottom: 0; }
  .computer { text-align: center; font-size: 10px; font-weight: 800; margin-bottom: 10px; }
  .contacts { display: flex; justify-content: center; flex-wrap: wrap; gap: 8px 22px; padding: 0 48px 12px; font-size: 10.5px; font-weight: 700; color: #1b4f9c; }
  .contacts span::before { content: ''; display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: #f7941d; margin-right: 6px; }
  .band { position: relative; height: 34px; background: #1b4f9c; overflow: hidden; }
  .band::after { content: ''; position: absolute; right: -40px; bottom: -70px; width: 220px; height: 130px; border-radius: 50%; background: #f7941d; }
  @media print { body { background: #fff; } .page { margin: 0; } }
</style></head><body><div class="page">
  <div class="deco-blue"></div><div class="deco-orange"></div>
  <div class="header">${header}</div>
  <div class="meta">
    <div>
      <div class="to-label">${title} to :</div>
      <div class="to-name">${esc(inv.bill_to_name || inv.b2g_leads?.organization_name || inv.companies?.name || 'Client')}</div>
      <div class="to-line">${billLines.join('<br>')}</div>
    </div>
    <div class="meta-right"><div><b>Invoice no : ${esc(inv.invoice_number)}</b></div><div style="margin-top:6px">${formatDate(inv.invoice_date)}</div></div>
  </div>
  <table class="items">
    <tr><th>DESCRIPTION</th><th style="width:140px">HSN / SAC</th><th style="width:160px">AMOUNT</th></tr>
    ${items.map((item) => `<tr><td>${multiline(item.description)}</td><td class="hsn">${esc(item.hsn_sac)}</td><td class="amt">${formatMoney(item.amount)}</td></tr>`).join('')}
    ${gstRows}
    <tr class="total"><td>TOTAL</td><td></td><td class="amt">&#8377; ${formatMoney(total)}</td></tr>
  </table>
  <div class="eoe">E. &amp; O.E</div>
  <div class="words-label">Amount Chargeable (in Words)</div>
  <div class="words">${esc(words)}</div>
  <div class="ids"><div>GST No : ${esc(company.gst_number)}</div><div>PAN No : ${esc(company.pan_number)}</div></div>
  <div class="bottom">
    <div>
      <div class="pay-title">Payment info:</div>
      <div class="pay">Account Name: ${esc(company.account_name)}<br>Account No: ${esc(company.account_number)}<br>IFSC No.: ${esc(company.ifsc_code)}<br>Bank Name: ${esc(company.bank_name)}<br>Branch : ${esc(company.bank_branch)}</div>
    </div>
    <div class="sign"><div>for ${esc(company.company_name)}</div><div>Authorised Signatory</div></div>
  </div>
  ${company.terms_conditions ? `<div class="terms"><b>Terms &amp; Conditions</b><br>${multiline(company.terms_conditions)}</div>` : ''}
  <div class="footer">
    <div class="computer">This is a Computer Generated Invoice</div>
    <div class="contacts"><span>${esc(company.address)}</span><span>${esc(company.phone)}</span><span>${esc(company.email)}</span><span>${esc(company.website)}</span></div>
    <div class="band"></div>
  </div>
</div></body></html>`;
}
