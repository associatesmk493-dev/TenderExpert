/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, Download, Mail, MessageCircle, Save, Send, Share2 } from 'lucide-react';
import { formatMoney, invoiceHtml, invoiceTotal, mergeCompany, type CompanyInfo, type InvoiceKind } from '@/lib/invoiceTemplate';
import { downloadBlob, invoiceToPngBlob } from '@/lib/invoiceImage';

const DEFAULT_SUBJECT = '{{invoice_type}} {{invoice_number}} from {{company_name}}';
const DEFAULT_BODY =
  'Dear {{client_name}},\n\nPlease find {{invoice_type}} {{invoice_number}} dated {{invoice_date}} for {{total_amount}}.\n\nKindly share the payment confirmation once done.\n\nRegards,\n{{salesperson_name}}\n{{company_name}}';
const PLACEHOLDERS = ['client_name', 'company_name', 'invoice_type', 'invoice_number', 'invoice_date', 'due_date', 'total_amount', 'salesperson_name'];

const waNumber = (value: string) => {
  const digits = value.replace(/\D/g, '');
  return digits.length === 10 ? `91${digits}` : digits.replace(/^0+/, '');
};

export default function SendInvoiceDialog({
  invoice,
  kind,
  company,
  onClose,
}: {
  invoice: any | null;
  kind: InvoiceKind;
  company: Partial<CompanyInfo> | null;
  onClose: () => void;
}) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateId, setTemplateId] = useState('default');
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [toEmail, setToEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState('');
  const [templateName, setTemplateName] = useState('');
  const imageRef = useRef<Blob | null>(null);

  const loadTemplates = async () => {
    const { data } = await supabase
      .from('proposal_templates' as any)
      .select('id,name,subject_template,body_template')
      .eq('is_active', true)
      .order('name');
    setTemplates((data as any[]) || []);
  };

  useEffect(() => {
    if (!invoice) return;
    imageRef.current = null;
    setTemplateId('default');
    setSubject(DEFAULT_SUBJECT);
    setBody(DEFAULT_BODY);
    setToEmail(invoice.bill_to_email || '');
    setPhone(invoice.bill_to_phone || '');
    setTemplateName('');
    loadTemplates();
  }, [invoice?.id]);

  const values = useMemo<Record<string, string>>(() => {
    if (!invoice) return {};
    const formatDate = (date?: string | null) =>
      date ? new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '';
    return {
      client_name: invoice.bill_to_name || invoice.b2g_leads?.organization_name || invoice.companies?.name || 'Client',
      company_name: mergeCompany(company).company_name,
      invoice_number: invoice.invoice_number,
      invoice_type: kind === 'proforma' ? 'Proforma Invoice' : 'Tax Invoice',
      invoice_date: formatDate(invoice.invoice_date),
      due_date: formatDate(invoice.due_date) || 'on receipt',
      total_amount: `₹${formatMoney(invoiceTotal(invoice))}`,
      salesperson_name: profile?.full_name || user?.email?.split('@')[0] || '',
    };
  }, [invoice, company, kind, profile, user]);

  const fill = (text: string) => text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => values[key] ?? match);
  const filename = `${invoice?.invoice_number || 'invoice'}.png`;

  const chooseTemplate = (id: string) => {
    setTemplateId(id);
    if (id === 'default') {
      setSubject(DEFAULT_SUBJECT);
      setBody(DEFAULT_BODY);
      return;
    }
    const template = templates.find((entry) => entry.id === id);
    if (template) {
      setSubject(template.subject_template);
      setBody(template.body_template);
    }
  };

  const getImage = async () => {
    if (!imageRef.current) imageRef.current = await invoiceToPngBlob(invoiceHtml(invoice, company, kind));
    return imageRef.current;
  };

  const copyImage = async () => {
    const blob = await getImage();
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      return true;
    } catch {
      downloadBlob(blob, filename);
      return false;
    }
  };

  const run = async (name: string, action: () => Promise<void>) => {
    setBusy(name);
    try {
      await action();
    } catch (error: any) {
      toast({ title: 'Could not prepare the invoice image', description: error?.message, variant: 'destructive' });
    } finally {
      setBusy('');
    }
  };

  const copiedToast = (copied: boolean, where: string) =>
    toast(
      copied
        ? { title: 'Invoice image copied', description: `Open the ${where} and press Ctrl+V (paste) to attach it.` }
        : { title: 'Invoice image downloaded', description: `Copying is not available here — attach the downloaded image in ${where}.` },
    );

  const openWithImage = (name: string, where: string, buildUrl: () => string) =>
    run(name, async () => {
      const popup = window.open('', '_blank');
      try {
        const copied = await copyImage();
        if (popup) popup.location.href = buildUrl();
        else toast({ title: 'Allow pop-ups to open the app', variant: 'destructive' });
        copiedToast(copied, where);
      } catch (error) {
        popup?.close();
        throw error;
      }
    });

  const whatsapp = () => openWithImage('whatsapp', 'WhatsApp chat', () => `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(fill(body))}`);
  const gmail = () =>
    openWithImage(
      'gmail',
      'email',
      () => `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(toEmail)}&su=${encodeURIComponent(fill(subject))}&body=${encodeURIComponent(fill(body))}`,
    );
  const mailApp = () =>
    run('mail', async () => {
      const copied = await copyImage();
      window.location.href = `mailto:${toEmail}?subject=${encodeURIComponent(fill(subject))}&body=${encodeURIComponent(fill(body))}`;
      copiedToast(copied, 'email');
    });
  const copyOnly = () => run('copy', async () => copiedToast(await copyImage(), 'WhatsApp or your email'));
  const download = () => run('download', async () => downloadBlob(await getImage(), filename));
  const share = () =>
    run('share', async () => {
      const file = new File([await getImage()], filename, { type: 'image/png' });
      if (!navigator.canShare?.({ files: [file] })) {
        toast({ title: 'Sharing is not supported on this device', variant: 'destructive' });
        return;
      }
      try {
        await navigator.share({ files: [file], title: fill(subject), text: fill(body) });
      } catch (error: any) {
        if (error?.name !== 'AbortError') throw error;
      }
    });

  const saveTemplate = async () => {
    if (!templateName.trim() || !subject.trim() || !body.trim()) {
      toast({ title: 'Enter a template name, subject and message', variant: 'destructive' });
      return;
    }
    const { error } = await supabase
      .from('proposal_templates' as any)
      .insert({ name: templateName.trim(), subject_template: subject.trim(), body_template: body.trim(), created_by: user?.id });
    if (error) {
      toast({ title: 'Template not saved', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Template saved', description: 'You can pick it for any client from the template list.' });
    setTemplateName('');
    loadTemplates();
  };

  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const label = (name: string, text: string) => (busy === name ? 'Preparing…' : text);

  return (
    <Dialog open={invoice !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send {invoice?.invoice_number}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-1.5">
            <span className="text-sm font-medium">Message template</span>
            <Select value={templateId} onValueChange={chooseTemplate}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default message</SelectItem>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <span className="text-sm font-medium">Email to</span>
              <Input type="email" value={toEmail} onChange={(e) => setToEmail(e.target.value)} placeholder="client@example.com" />
            </div>
            <div className="space-y-1.5">
              <span className="text-sm font-medium">WhatsApp number</span>
              <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98XXXXXXXX" />
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-sm font-medium">Subject</span>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <span className="text-sm font-medium">Message</span>
            <Textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              Placeholders change for every client:{' '}
              {PLACEHOLDERS.map((key) => (
                <code key={key} className="mr-1.5 rounded bg-slate-100 px-1">{`{{${key}}}`}</code>
              ))}
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-3 text-sm">
            <p className="text-xs font-semibold text-muted-foreground mb-1">Preview</p>
            <p className="font-semibold">{fill(subject)}</p>
            <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{fill(body)}</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Save this message as a template — name" />
            <Button type="button" variant="outline" onClick={saveTemplate}><Save className="h-4 w-4 mr-2" />Save template</Button>
          </div>

          <div className="grid grid-cols-2 gap-2 border-t pt-4">
            <Button disabled={busy !== ''} onClick={whatsapp}><MessageCircle className="h-4 w-4 mr-2" />{label('whatsapp', 'WhatsApp')}</Button>
            <Button disabled={busy !== ''} onClick={gmail}><Mail className="h-4 w-4 mr-2" />{label('gmail', 'Gmail')}</Button>
            <Button variant="outline" disabled={busy !== ''} onClick={mailApp}><Send className="h-4 w-4 mr-2" />{label('mail', 'Mail app')}</Button>
            <Button variant="outline" disabled={busy !== ''} onClick={copyOnly}><Copy className="h-4 w-4 mr-2" />{label('copy', 'Copy image')}</Button>
            <Button variant="outline" disabled={busy !== ''} onClick={download}><Download className="h-4 w-4 mr-2" />{label('download', 'Download image')}</Button>
            {canShare && <Button variant="outline" disabled={busy !== ''} onClick={share}><Share2 className="h-4 w-4 mr-2" />{label('share', 'Share')}</Button>}
          </div>
          <p className="text-xs text-muted-foreground">
            WhatsApp / Gmail / Mail app copy the invoice as an image and open the message ready to send — press Ctrl+V (paste) to attach the image. On a phone, use Share to send the image directly.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
