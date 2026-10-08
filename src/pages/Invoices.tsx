/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Download, Eye, FileCheck2, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { amountInWords } from '@/lib/amountInWords';
import { calcInvoice, formatMoney, invoiceHtml, invoiceTotal, withGst, type CompanyInfo, type GstType, type InvoiceKind } from '@/lib/invoiceTemplate';
import SendInvoiceDialog from '@/components/SendInvoiceDialog';

type Item = { description: string; hsn_sac: string; amount: string };
const blankItem = (): Item => ({ description: '', hsn_sac: '', amount: '' });
const today = () => new Date().toISOString().slice(0, 10);
const money = (value: number) => `₹${formatMoney(value)}`;
const blankForm = () => ({
  lead_id: '',
  invoice_number: '',
  invoice_date: today(),
  gst_type: 'igst' as GstType,
  gst_rate: '18',
  bill_to_name: '',
  bill_to_phone: '',
  bill_to_email: '',
  bill_to_address: '',
  items: [blankItem()],
});

const nextNumber = (prefix: string, existing: string[]) => {
  const stem = `${prefix}-${new Date().getFullYear()}-`;
  const highest = existing
    .filter((number) => number.startsWith(stem))
    .map((number) => Number(number.slice(stem.length)))
    .filter((value) => Number.isFinite(value))
    .reduce((max, value) => Math.max(max, value), 0);
  return `${stem}${String(highest + 1).padStart(4, '0')}`;
};

export default function Invoices({ type }: { type: InvoiceKind }) {
  const table = type === 'proforma' ? 'proforma_invoices' : 'tax_invoices';
  const label = type === 'proforma' ? 'Proforma Invoice' : 'Tax Invoice';
  const prefix = type === 'proforma' ? 'PI' : 'TI';
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [company, setCompany] = useState<Partial<CompanyInfo> | null>(null);
  const [taxByProforma, setTaxByProforma] = useState<Record<string, any>>({});
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [viewRow, setViewRow] = useState<any>(null);
  const [sendRow, setSendRow] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState('');
  const [form, setForm] = useState(blankForm());

  const load = async () => {
    const select = type === 'tax' ? '*,b2g_leads(organization_name),companies(name),proforma_invoices(invoice_number)' : '*,b2g_leads(organization_name),companies(name)';
    const [invoices, stageLeads, settings] = await Promise.all([
      supabase.from(table as any).select(select).order('created_at', { ascending: false }),
      supabase.from('b2g_leads' as any).select('id,organization_name,contact_name,phone,email,city,state,company_id').eq('stage', 'generate_pi').order('organization_name'),
      supabase.from('invoice_company_settings' as any).select('*').limit(1).maybeSingle(),
    ]);
    if (invoices.error) toast({ title: `${label}s could not load`, description: invoices.error.message, variant: 'destructive' });
    setRows((invoices.data as any[]) || []);
    setLeads((stageLeads.data as any[]) || []);
    setCompany((settings.data as any) || null);
    if (type === 'proforma') {
      const taxes = await supabase.from('tax_invoices' as any).select('id,invoice_number,proforma_invoice_id').not('proforma_invoice_id', 'is', null);
      setTaxByProforma(Object.fromEntries(((taxes.data as any[]) || []).map((tax) => [tax.proforma_invoice_id, tax])));
    }
  };
  useEffect(() => { load(); }, [table]);

  const leadOptions = useMemo(() => {
    if (editing?.lead_id && !leads.some((lead) => lead.id === editing.lead_id)) {
      return [{ id: editing.lead_id, organization_name: editing.b2g_leads?.organization_name || editing.bill_to_name || 'Client' }, ...leads];
    }
    return leads;
  }, [leads, editing]);

  const totals = useMemo(() => calcInvoice(form.items, form.gst_type, Number(form.gst_rate)), [form.items, form.gst_type, form.gst_rate]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...blankForm(), invoice_number: nextNumber(prefix, rows.map((row) => row.invoice_number)) });
    setOpen(true);
  };

  const openEdit = (row: any) => {
    setEditing(row);
    setForm({
      lead_id: row.lead_id || '',
      invoice_number: row.invoice_number,
      invoice_date: row.invoice_date,
      gst_type: (row.gst_type || 'igst') as GstType,
      gst_rate: String(row.gst_rate ?? 18),
      bill_to_name: row.bill_to_name || '',
      bill_to_phone: row.bill_to_phone || '',
      bill_to_email: row.bill_to_email || '',
      bill_to_address: row.bill_to_address || '',
      items: (row.line_items || []).length
        ? row.line_items.map((item: any) => ({
            description: item.description || '',
            hsn_sac: item.hsn_sac || '',
            amount: String(item.amount ?? Number(item.quantity || 1) * Number(item.rate || 0)),
          }))
        : [blankItem()],
    });
    setViewRow(null);
    setOpen(true);
  };

  const chooseLead = (leadId: string) => {
    const lead = leads.find((entry) => entry.id === leadId);
    setForm((current) => ({
      ...current,
      lead_id: leadId,
      bill_to_name: lead?.organization_name || '',
      bill_to_phone: lead?.phone || '',
      bill_to_email: lead?.email || '',
      bill_to_address: [lead?.city, lead?.state].filter(Boolean).join(', '),
    }));
  };

  const setItem = (index: number, patch: Partial<Item>) =>
    setForm((current) => ({ ...current, items: current.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) }));

  const save = async () => {
    const items = form.items.filter((item) => item.description.trim() || Number(item.amount) > 0);
    const rate = Number(form.gst_rate);
    if (!editing && !form.lead_id) return toast({ title: 'Select a client', variant: 'destructive' });
    if (!form.invoice_number.trim()) return toast({ title: 'Invoice number is required', variant: 'destructive' });
    if (!items.length || items.some((item) => !item.description.trim() || !(Number(item.amount) > 0))) {
      return toast({ title: 'Every line needs a description and an amount', variant: 'destructive' });
    }
    if (form.gst_type !== 'none' && !(rate >= 0 && rate <= 100)) return toast({ title: 'GST rate must be between 0 and 100', variant: 'destructive' });

    const lead = leads.find((entry) => entry.id === form.lead_id);
    const payload: any = {
      invoice_number: form.invoice_number.trim(),
      invoice_date: form.invoice_date,
      line_items: items.map((item) => ({ description: item.description.trim(), hsn_sac: item.hsn_sac.trim(), amount: Number(item.amount) })),
      hsn_sac_code: items[0].hsn_sac.trim() || null,
      subtotal: totals.subtotal,
      gst_type: form.gst_type,
      gst_rate: form.gst_type === 'none' ? 0 : rate,
      igst_amount: totals.igst,
      cgst_amount: totals.cgst,
      sgst_amount: totals.sgst,
      amount_in_words: amountInWords(totals.total),
      bill_to_name: form.bill_to_name.trim() || null,
      bill_to_phone: form.bill_to_phone.trim() || null,
      bill_to_email: form.bill_to_email.trim() || null,
      bill_to_address: form.bill_to_address.trim() || null,
    };
    setSaving(true);
    const result = editing
      ? await supabase.from(table as any).update(payload).eq('id', editing.id)
      : await supabase.from(table as any).insert({ ...payload, lead_id: form.lead_id, company_id: lead?.company_id ?? null, created_by: user?.id });
    setSaving(false);
    if (result.error) return toast({ title: `${label} not saved`, description: result.error.message, variant: 'destructive' });
    toast({ title: editing ? `${label} updated` : `${label} created` });
    setOpen(false);
    load();
  };

  const convert = async (source: any) => {
    const row = withGst(source);
    setConverting(row.id);
    const existing = await supabase.from('tax_invoices' as any).select('invoice_number');
    const number = nextNumber('TI', ((existing.data as any[]) || []).map((entry) => entry.invoice_number));
    const { error } = await supabase.from('tax_invoices' as any).insert({
      invoice_number: number,
      proforma_invoice_id: row.id,
      lead_id: row.lead_id,
      company_id: row.company_id,
      invoice_date: today(),
      line_items: row.line_items,
      hsn_sac_code: row.hsn_sac_code,
      subtotal: row.subtotal,
      gst_type: row.gst_type,
      gst_rate: row.gst_rate,
      igst_amount: row.igst_amount,
      cgst_amount: row.cgst_amount,
      sgst_amount: row.sgst_amount,
      amount_in_words: amountInWords(invoiceTotal(row)),
      bill_to_name: row.bill_to_name || row.b2g_leads?.organization_name || row.companies?.name || null,
      bill_to_phone: row.bill_to_phone,
      bill_to_email: row.bill_to_email,
      bill_to_address: row.bill_to_address,
      created_by: user?.id,
    });
    setConverting('');
    if (error) return toast({ title: 'Tax invoice could not be created', description: error.message, variant: 'destructive' });
    toast({ title: `Tax invoice ${number} created`, description: 'You can edit it from the Tax Invoices page.' });
    navigate('/tax-invoices');
  };

  const htmlFor = (row: any) => invoiceHtml(row, company, type);
  const download = (row: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return toast({ title: 'Allow pop-ups to download the PDF', variant: 'destructive' });
    printWindow.document.write(htmlFor(row));
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 600);
  };

  return (
    <div className="min-h-full bg-slate-50/60 p-4 md:p-7">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
        <div>
          <p className="text-xs font-bold tracking-wider text-primary">BILLING</p>
          <h1 className="text-3xl font-bold">{label}s</h1>
          <p className="text-muted-foreground">
            {type === 'proforma' ? 'Create from clients in the Generate PI stage, then convert to a tax invoice in one click' : 'Tax invoices are created from a proforma invoice and can be edited here'}
          </p>
        </div>
        {type === 'proforma' ? (
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Create {label}</Button>
        ) : (
          <Button variant="outline" onClick={() => navigate('/proforma-invoices')}>Go to Proforma Invoices</Button>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        {rows.map((row) => {
          const tax = taxByProforma[row.id];
          return (
            <Card key={row.id} className="border-0 shadow-sm">
              <CardContent className="p-5">
                <div className="flex justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-primary">{row.invoice_number}</p>
                    <h3 className="font-bold truncate">{row.bill_to_name || row.b2g_leads?.organization_name || row.companies?.name || 'Client'}</h3>
                    <p className="text-xs text-muted-foreground">
                      {new Date(`${row.invoice_date}T12:00:00`).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                      {type === 'tax' && row.proforma_invoices?.invoice_number ? ` · from ${row.proforma_invoices.invoice_number}` : ''}
                    </p>
                  </div>
                  <Badge variant="secondary" className="h-fit capitalize">{row.status}</Badge>
                </div>
                <p className="font-bold text-xl mt-4">{money(invoiceTotal(row))}</p>
                <p className="text-xs text-muted-foreground">{row.line_items?.length || 0} item(s) · {row.gst_type === 'none' ? 'No GST' : row.gst_type === 'cgst_sgst' ? `CGST + SGST ${row.gst_rate}%` : `IGST ${row.gst_rate}%`}</p>
                <div className="flex flex-wrap items-center gap-2 mt-4">
                  <Button size="icon" variant="outline" title="Preview" aria-label="Preview" onClick={() => setViewRow(row)}><Eye className="h-4 w-4" /></Button>
                  <Button size="icon" variant="outline" title="Edit" aria-label="Edit" onClick={() => openEdit(row)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="outline" title="Download PDF" aria-label="Download PDF" onClick={() => download(row)}><Download className="h-4 w-4" /></Button>
                  <Button size="icon" variant="outline" title="Send by WhatsApp / Email" aria-label="Send" onClick={() => setSendRow(row)}><Send className="h-4 w-4" /></Button>
                  {type === 'proforma' && (tax ? (
                    <Button size="sm" variant="secondary" onClick={() => navigate('/tax-invoices')}><FileCheck2 className="h-4 w-4 mr-1.5" />Tax invoice {tax.invoice_number}</Button>
                  ) : (
                    <Button size="sm" disabled={converting === row.id} onClick={() => convert(row)}><FileCheck2 className="h-4 w-4 mr-1.5" />{converting === row.id ? 'Creating…' : 'Make Tax Invoice'}</Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!rows.length && (
          <div className="lg:col-span-2 py-20 text-center bg-white rounded-2xl text-muted-foreground">
            {type === 'proforma' ? 'No proforma invoices yet.' : 'No tax invoices yet. Open a proforma invoice and click “Make Tax Invoice”.'}
          </div>
        )}
      </div>

      <SendInvoiceDialog invoice={sendRow} kind={type} company={company} onClose={() => setSendRow(null)} />

      <Dialog open={viewRow !== null} onOpenChange={(value) => !value && setViewRow(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{label} {viewRow?.invoice_number}</DialogTitle></DialogHeader>
          {viewRow && <iframe title="Invoice preview" srcDoc={htmlFor(viewRow)} sandbox="" className="w-full h-[68vh] rounded-lg border bg-white" />}
          {viewRow && (
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={() => openEdit(viewRow)}><Pencil className="h-4 w-4 mr-2" />Edit</Button>
              <Button variant="outline" onClick={() => { setSendRow(viewRow); setViewRow(null); }}><Send className="h-4 w-4 mr-2" />Send</Button>
              <Button onClick={() => download(viewRow)}><Download className="h-4 w-4 mr-2" />PDF</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? `Edit ${label}` : `Create ${label}`}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <Field label="Client (leads in Generate PI stage)">
              <Select value={form.lead_id} onValueChange={chooseLead} disabled={Boolean(editing)}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>{leadOptions.map((lead) => <SelectItem key={lead.id} value={lead.id}>{lead.organization_name}</SelectItem>)}</SelectContent>
              </Select>
              {!editing && !leads.length && <p className="text-xs text-amber-600">No client is in the “Generate PI” stage yet. Move a lead to that stage from its detail page first.</p>}
            </Field>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Invoice number"><Input value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} /></Field>
              <Field label="Invoice date"><Input type="date" value={form.invoice_date} onChange={(e) => setForm({ ...form, invoice_date: e.target.value })} /></Field>
              <Field label="Bill to name"><Input value={form.bill_to_name} onChange={(e) => setForm({ ...form, bill_to_name: e.target.value })} /></Field>
              <Field label="Phone"><Input value={form.bill_to_phone} onChange={(e) => setForm({ ...form, bill_to_phone: e.target.value })} /></Field>
              <Field label="Email"><Input type="email" value={form.bill_to_email} onChange={(e) => setForm({ ...form, bill_to_email: e.target.value })} /></Field>
              <Field label="Address"><Textarea rows={2} value={form.bill_to_address} onChange={(e) => setForm({ ...form, bill_to_address: e.target.value })} /></Field>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Items</h3>
                <Button type="button" size="sm" variant="outline" onClick={() => setForm({ ...form, items: [...form.items, blankItem()] })}><Plus className="h-4 w-4 mr-1" />Add item</Button>
              </div>
              {form.items.map((item, index) => (
                <div key={index} className="grid grid-cols-[1fr_1fr_auto] sm:grid-cols-[1fr_130px_130px_auto] gap-2 items-start rounded-xl border bg-white p-3">
                  <div className="col-span-3 sm:col-span-1"><Input placeholder="Description" value={item.description} onChange={(e) => setItem(index, { description: e.target.value })} /></div>
                  <Input placeholder="HSN / SAC" value={item.hsn_sac} onChange={(e) => setItem(index, { hsn_sac: e.target.value })} />
                  <Input type="number" min="0" placeholder="Amount" value={item.amount} onChange={(e) => setItem(index, { amount: e.target.value })} />
                  <Button type="button" size="icon" variant="ghost" disabled={form.items.length === 1} onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== index) })}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="GST type">
                <Select value={form.gst_type} onValueChange={(value) => setForm({ ...form, gst_type: value as GstType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="igst">IGST</SelectItem>
                    <SelectItem value="cgst_sgst">CGST + SGST</SelectItem>
                    <SelectItem value="none">No GST</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="GST rate (%)"><Input type="number" min="0" max="100" disabled={form.gst_type === 'none'} value={form.gst_rate} onChange={(e) => setForm({ ...form, gst_rate: e.target.value })} /></Field>
            </div>

            <div className="rounded-xl bg-slate-50 p-4 space-y-1.5 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>{money(totals.subtotal)}</span></div>
              {form.gst_type === 'igst' && <div className="flex justify-between"><span>IGST ({Number(form.gst_rate) || 0}%)</span><span>{money(totals.igst)}</span></div>}
              {form.gst_type === 'cgst_sgst' && (
                <>
                  <div className="flex justify-between"><span>CGST ({(Number(form.gst_rate) || 0) / 2}%)</span><span>{money(totals.cgst)}</span></div>
                  <div className="flex justify-between"><span>SGST ({(Number(form.gst_rate) || 0) / 2}%)</span><span>{money(totals.sgst)}</span></div>
                </>
              )}
              <div className="flex justify-between font-bold text-base border-t pt-2"><span>Total</span><span>{money(totals.total)}</span></div>
              <p className="text-xs text-muted-foreground pt-1"><span className="font-semibold">Amount chargeable (in words):</span> {amountInWords(totals.total)}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={saving} onClick={save}>{saving ? 'Saving…' : editing ? 'Save changes' : `Create ${label}`}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </div>
  );
}
