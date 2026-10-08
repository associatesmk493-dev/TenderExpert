/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Building2, ImagePlus, QrCode, Save, Wallet } from 'lucide-react';

const blank = {
  id: '',
  company_name: '',
  email: '',
  phone: '',
  address: '',
  gst_number: '',
  pan_number: '',
  website: '',
  tagline: '',
  logo_url: '',
  bank_name: '',
  bank_branch: '',
  account_name: '',
  account_number: '',
  ifsc_code: '',
  terms_conditions: '',
  qr_code_url: '',
};

export default function InvoiceSettings() {
  const { toast } = useToast();
  const [form, setForm] = useState<any>(blank);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<'logo' | 'qr' | ''>('');

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('invoice_company_settings' as any)
      .select('*')
      .limit(1)
      .maybeSingle();
    if (error) toast({ title: 'Settings could not load', description: error.message, variant: 'destructive' });
    setForm({ ...blank, ...(data || {}) });
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const set = (key: string, value: string) => setForm((prev: any) => ({ ...prev, [key]: value }));

  const upload = async (file: File, kind: 'logo' | 'qr') => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 2MB allowed', variant: 'destructive' });
      return;
    }
    setUploading(kind);
    const ext = file.name.split('.').pop();
    const path = `${kind}-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('invoice-assets').upload(path, file, { upsert: true });
    if (uploadError) {
      toast({ title: 'Upload failed', description: uploadError.message, variant: 'destructive' });
      setUploading('');
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from('invoice-assets').getPublicUrl(path);
    const url = `${publicUrl}?t=${Date.now()}`;
    set(kind === 'logo' ? 'logo_url' : 'qr_code_url', url);
    setUploading('');
  };

  const save = async () => {
    if (!form.company_name.trim()) {
      toast({ title: 'Company name is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload = { ...form, updated_at: new Date().toISOString() };
    const result = form.id
      ? await supabase.from('invoice_company_settings' as any).update(payload).eq('id', form.id).select('*').single()
      : await supabase.from('invoice_company_settings' as any).insert(payload).select('*').single();
    setSaving(false);
    if (result.error) {
      toast({ title: 'Settings could not be saved', description: result.error.message, variant: 'destructive' });
      return;
    }
    setForm({ ...blank, ...(result.data as any) });
    toast({ title: 'Invoice settings saved' });
  };

  if (loading) return <div className="min-h-full bg-slate-50/60 p-4 md:p-7"><div className="max-w-3xl mx-auto space-y-4">{[1, 2, 3].map(x => <div key={x} className="h-48 rounded-2xl bg-white animate-pulse" />)}</div></div>;

  return <div className="min-h-full bg-slate-50/60 p-4 md:p-7">
    <div className="max-w-3xl mx-auto">
      <p className="text-xs font-bold tracking-wider text-primary">BILLING</p>
      <h1 className="text-3xl font-bold mt-1">Invoice settings</h1>
      <p className="text-muted-foreground">Company details, bank information and branding used on every proforma and tax invoice.</p>

      <Card className="border-0 shadow-sm mt-6"><CardContent className="p-5 md:p-6">
        <h2 className="font-bold flex items-center gap-2 mb-5"><Building2 className="h-4 w-4 text-primary" />Company details</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Company name *"><Input value={form.company_name} onChange={e => set('company_name', e.target.value)} placeholder="MK Associates" /></Field>
          <Field label="GST number"><Input value={form.gst_number} onChange={e => set('gst_number', e.target.value)} placeholder="22AAAAA0000A1Z5" /></Field>
          <Field label="PAN number"><Input value={form.pan_number} onChange={e => set('pan_number', e.target.value)} /></Field>
          <Field label="Tagline"><Input value={form.tagline} onChange={e => set('tagline', e.target.value)} placeholder="Strategic B2G Consulting & Procurement" /></Field>
          <Field label="Website"><Input value={form.website} onChange={e => set('website', e.target.value)} placeholder="www.example.com" /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={e => set('email', e.target.value)} /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91" /></Field>
          <div className="md:col-span-2"><Field label="Address"><Textarea value={form.address} onChange={e => set('address', e.target.value)} placeholder="Registered office address" /></Field></div>
        </div>
      </CardContent></Card>

      <Card className="border-0 shadow-sm mt-5"><CardContent className="p-5 md:p-6">
        <h2 className="font-bold flex items-center gap-2 mb-5"><Wallet className="h-4 w-4 text-primary" />Bank details</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Bank name"><Input value={form.bank_name} onChange={e => set('bank_name', e.target.value)} /></Field>
          <Field label="Account holder name"><Input value={form.account_name} onChange={e => set('account_name', e.target.value)} /></Field>
          <Field label="Account number"><Input value={form.account_number} onChange={e => set('account_number', e.target.value)} /></Field>
          <Field label="IFSC code"><Input value={form.ifsc_code} onChange={e => set('ifsc_code', e.target.value)} /></Field>
          <Field label="Branch"><Input value={form.bank_branch} onChange={e => set('bank_branch', e.target.value)} /></Field>
        </div>
      </CardContent></Card>

      <Card className="border-0 shadow-sm mt-5"><CardContent className="p-5 md:p-6">
        <h2 className="font-bold flex items-center gap-2 mb-5"><ImagePlus className="h-4 w-4 text-primary" />Branding</h2>
        <div className="grid md:grid-cols-2 gap-5">
          <UploadField label="Company logo" preview={form.logo_url} icon={ImagePlus} uploading={uploading === 'logo'} onFile={file => upload(file, 'logo')} />
          <UploadField label="Payment QR code" preview={form.qr_code_url} icon={QrCode} uploading={uploading === 'qr'} onFile={file => upload(file, 'qr')} />
        </div>
      </CardContent></Card>

      <Card className="border-0 shadow-sm mt-5"><CardContent className="p-5 md:p-6">
        <h2 className="font-bold mb-5">Terms & conditions</h2>
        <Textarea rows={5} value={form.terms_conditions} onChange={e => set('terms_conditions', e.target.value)} placeholder="Payment terms, late fee policy, disclaimers... shown on every invoice." />
      </CardContent></Card>

      <Button className="mt-5 w-full sm:w-auto" disabled={saving} onClick={save}><Save className="h-4 w-4 mr-2" />{saving ? 'Saving…' : 'Save settings'}</Button>
    </div>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="space-y-2 block"><span className="text-sm font-medium">{label}</span>{children}</label>;
}

function UploadField({ label, preview, icon: Icon, uploading, onFile }: { label: string; preview?: string; icon: any; uploading: boolean; onFile: (file: File) => void }) {
  return <div>
    <Label>{label}</Label>
    <div className="mt-2 flex items-center gap-3">
      <div className="h-16 w-16 rounded-xl border bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
        {preview ? <img src={preview} alt={label} className="h-full w-full object-contain" /> : <Icon className="h-5 w-5 text-muted-foreground" />}
      </div>
      <label className="h-9 px-3 rounded-md border text-sm flex items-center cursor-pointer hover:bg-muted">
        {uploading ? 'Uploading…' : 'Upload image'}
        <input type="file" accept="image/*" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) onFile(file); e.target.value = ''; }} />
      </label>
    </div>
  </div>;
}
