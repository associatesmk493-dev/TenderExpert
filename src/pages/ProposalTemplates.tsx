/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { FileText, Pencil, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const pipelines = [
  ["brand_approval", "Brand Approval / Product Approval"],
  ["government_business_development", "Government Business Development"],
  ["tender_consultancy", "Tender Consultancy"],
] as const;

const empty = {
  name: "",
  pipeline: "brand_approval",
  subject_template: "",
  body_template: "",
  terms_template: "",
  is_active: true,
};

const pipelineName = (value: string) =>
  pipelines.find(([key]) => key === value)?.[1] || value;

export default function ProposalTemplates() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(empty);

  const load = async () => {
    const { data, error } = await supabase
      .from("proposal_templates" as any)
      .select("*")
      .order("name");
    if (error) {
      toast({
        title: "Templates could not be loaded",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setRows(data || []);
  };

  useEffect(() => {
    void load();
  }, []);

  const createNew = () => {
    setEditingId(null);
    setForm(empty);
    setOpen(true);
  };

  const edit = (row: any) => {
    setEditingId(row.id);
    setForm({
      name: row.name || "",
      pipeline: row.pipeline || "brand_approval",
      subject_template: row.subject_template || "",
      body_template: row.body_template || "",
      terms_template: row.terms_template || "",
      is_active: row.is_active,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.subject_template.trim() || !form.body_template.trim())
      return;
    setSaving(true);
    const payload = {
      ...form,
      name: form.name.trim(),
      subject_template: form.subject_template.trim(),
      body_template: form.body_template.trim(),
      terms_template: form.terms_template.trim() || null,
      created_by: user?.id,
    };
    const result = editingId
      ? await supabase
          .from("proposal_templates" as any)
          .update(payload)
          .eq("id", editingId)
      : await supabase.from("proposal_templates" as any).insert(payload);
    setSaving(false);
    if (result.error) {
      toast({
        title: "Template not saved",
        description: result.error.message,
        variant: "destructive",
      });
      return;
    }
    toast({ title: editingId ? "Template updated" : "Template created" });
    setOpen(false);
    void load();
  };

  const toggle = async (row: any, isActive: boolean) => {
    const { error } = await supabase
      .from("proposal_templates" as any)
      .update({ is_active: isActive })
      .eq("id", row.id);
    if (error) {
      toast({
        title: "Status not updated",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    void load();
  };

  return (
    <div className="min-h-full bg-slate-50/60 p-4 md:p-7">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold tracking-wider text-primary">
            QUOTATION SUPPORT
          </p>
          <h1 className="mt-1 text-3xl font-bold">Proposal templates</h1>
          <p className="text-muted-foreground">
            Shared email templates with dynamic client and invoice details
          </p>
        </div>
        <Button onClick={createNew}>
          <Plus className="mr-2 h-4 w-4" />
          New template
        </Button>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        {rows.map((row) => (
          <Card key={row.id} className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold">{row.name}</h2>
                    <Badge variant={row.is_active ? "default" : "secondary"}>
                      {row.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {pipelineName(row.pipeline)}
                  </p>
                  <p className="mt-3 line-clamp-2 text-sm font-medium">
                    {row.subject_template}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {row.body_template}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t pt-3">
                <label className="flex items-center gap-2 text-xs font-medium">
                  <Switch
                    checked={row.is_active}
                    onCheckedChange={(value) => toggle(row, value)}
                  />
                  Available in proposal builder
                </label>
                <Button size="sm" variant="outline" onClick={() => edit(row)}>
                  <Pencil className="mr-1 h-3.5 w-3.5" />
                  Edit
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!rows.length && (
          <div className="rounded-2xl bg-white py-20 text-center text-muted-foreground xl:col-span-2">
            No proposal templates created yet.
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit proposal template" : "Create proposal template"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Template name *">
              <Input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Brand Approval Standard"
              />
            </Field>
            <Field label="Pipeline *">
              <Select
                value={form.pipeline}
                onValueChange={(value) => setForm({ ...form, pipeline: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Proposal subject *">
              <Input
                value={form.subject_template}
                onChange={(event) =>
                  setForm({ ...form, subject_template: event.target.value })
                }
                placeholder="Proposal for {{organization}}"
              />
            </Field>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-primary mb-1">Dynamic placeholders</p>
              Use these in the subject or message: <code>{'{{client_name}}'}</code>, <code>{'{{company_name}}'}</code>, <code>{'{{invoice_number}}'}</code>, <code>{'{{invoice_date}}'}</code>, <code>{'{{due_date}}'}</code>, <code>{'{{total_amount}}'}</code>, <code>{'{{salesperson_name}}'}</code>.
            </div>
            <Field label="Standard scope of work *">
              <Textarea
                rows={7}
                value={form.body_template}
                onChange={(event) =>
                  setForm({ ...form, body_template: event.target.value })
                }
              />
            </Field>
            <Field label="Standard commercial terms">
              <Textarea
                rows={4}
                value={form.terms_template}
                onChange={(event) =>
                  setForm({ ...form, terms_template: event.target.value })
                }
              />
            </Field>
            <label className="flex items-center gap-2 text-sm font-medium">
              <Switch
                checked={form.is_active}
                onCheckedChange={(value) =>
                  setForm({ ...form, is_active: value })
                }
              />
              Make available in proposal builder
            </label>
            <Button
              className="w-full"
              disabled={
                saving ||
                !form.name.trim() ||
                !form.subject_template.trim() ||
                !form.body_template.trim()
              }
              onClick={save}
            >
              {saving ? "Saving…" : "Save template"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
