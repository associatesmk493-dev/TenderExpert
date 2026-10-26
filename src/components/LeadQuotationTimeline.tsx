/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import { useEffect, useState } from "react";
import { FileClock, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { writeWithFallback } from "@/lib/writeWithFallback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
const nice = (value: string) =>
  value?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const blank = {
  order: "general",
  subject: "",
  scope: "",
  subtotal: "",
  gst_rate: "18",
  status: "sent",
  valid_until: "",
  revision_reason: "",
  payment_model: "80_20",
};

export default function LeadQuotationTimeline({
  leadId,
  organizationName,
  onChanged,
}: {
  leadId: string;
  organizationName?: string;
  onChanged?: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(blank);
  const load = async () => {
    const [proposals, projects] = await Promise.all([
      supabase
        .from("b2g_proposals" as any)
        .select("*,b2g_projects(project_name,order_number)")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false }),
      supabase
        .from("b2g_projects" as any)
        .select("id,project_name,order_number,payment_model")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false }),
    ]);
    setRows((proposals.data as any[]) || []);
    setOrders((projects.data as any[]) || []);
  };
  useEffect(() => {
    load();
  }, [leadId]);

  const targetProject = form.order === "general" ? null : form.order;
  const sameOrder = rows
    .filter((row) => (row.project_id || null) === targetProject)
    .sort((a, b) => Number(b.version || 1) - Number(a.version || 1));
  const nextVersion = Number(sameOrder[0]?.version || 0) + 1;

  const save = async () => {
    const subtotal = Number(form.subtotal);
    if (!(subtotal > 0)) {
      toast({
        title: "Enter the quotation value",
        variant: "destructive",
      });
      return;
    }
    const order = orders.find((entry) => entry.id === targetProject);
    const sent = form.status === "sent";
    setSaving(true);
    const { error } = await supabase.from("b2g_proposals" as any).insert({
      lead_id: leadId,
      project_id: targetProject,
      proposal_number: `Q-${Date.now().toString().slice(-7)}-V${nextVersion}`,
      subject:
        form.subject.trim() ||
        `Quotation — ${order?.project_name || organizationName || "Client"}`,
      scope:
        form.scope.trim() ||
        order?.project_name ||
        "As discussed with the client",
      payment_model: order?.payment_model || form.payment_model,
      subtotal,
      gst_rate: Number(form.gst_rate) || 0,
      status: form.status,
      valid_until: form.valid_until || null,
      version: nextVersion,
      supersedes_id: sameOrder[0]?.id || null,
      revision_reason: form.revision_reason.trim() || null,
      sent_at: sent ? new Date().toISOString() : null,
      submitted_at: sent ? new Date().toISOString() : null,
      created_by: user?.id,
    });
    setSaving(false);
    if (error) {
      toast({
        title: "Quotation not saved",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    // Keep the lead's commercials in step with the latest quotation.
    let synced = false;
    if (["draft", "sent", "viewed", "accepted"].includes(form.status)) {
      const { data: current } = await supabase
        .from("b2g_leads" as any)
        .select("probability,expected_revenue")
        .eq("id", leadId)
        .single();
      const rate = Number(form.gst_rate) || 0;
      const { result } = await writeWithFallback(
        (body) =>
          supabase
            .from("b2g_leads" as any)
            .update(body)
            .eq("id", leadId),
        {
          proposal_value: subtotal,
          proposal_gst_rate: rate,
          total_amount: Math.round(subtotal * (1 + rate / 100) * 100) / 100,
          // After the client's go-ahead, expected is the agreed amount and is left alone.
          expected_revenue:
            Number((current as any)?.probability ?? 0) >= 100
              ? Number((current as any)?.expected_revenue || 0)
              : (subtotal * Number((current as any)?.probability ?? 0)) / 100,
        },
      );
      synced = !result.error;
    }
    toast({
      title: nextVersion > 1 ? `Revision V${nextVersion} saved` : "Quotation saved",
      description: synced
        ? "Lead's proposal value and GST updated to match."
        : undefined,
    });
    setOpen(false);
    setForm(blank);
    load();
    onChanged?.();
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileClock className="h-4 w-4" />
            <h2 className="font-bold">Quotations & revisions</h2>
            <Badge variant="secondary">{rows.length} versions</Badge>
          </div>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            New quotation / revision
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Add a quotation any time — even before an order exists. Adding another
          one for the same order records it as the next revision.
        </p>
        <div className="mt-4 overflow-x-auto">
          <div className="min-w-[850px] overflow-hidden rounded-xl border">
            <div className="grid grid-cols-7 gap-3 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-muted-foreground">
              <span>Order</span>
              <span>Version</span>
              <span>Previous value</span>
              <span>Revised value</span>
              <span>Revision reason</span>
              <span>Created date</span>
              <span>Status</span>
            </div>
            <div className="divide-y">
              {rows.map((row) => {
                const previous =
                  rows.find((item) => item.id === row.supersedes_id) ||
                  rows.find(
                    (item) =>
                      item.project_id === row.project_id &&
                      Number(item.version) === Number(row.version) - 1,
                  );
                return (
                  <div
                    key={row.id}
                    className="grid grid-cols-7 gap-3 px-3 py-3 text-xs"
                  >
                    <span className="font-semibold">
                      {row.b2g_projects?.order_number ||
                        row.b2g_projects?.project_name ||
                        "General"}
                    </span>
                    <span>V{row.version || 1}</span>
                    <span>{previous ? money(previous.subtotal) : "—"}</span>
                    <span className="font-semibold">{money(row.subtotal)}</span>
                    <span>
                      {row.revision_reason ||
                        ((row.version || 1) === 1
                          ? "Initial quotation"
                          : "Not specified")}
                    </span>
                    <span>
                      {new Date(row.created_at).toLocaleDateString("en-IN")}
                    </span>
                    <span>
                      <Badge variant="outline">{nice(row.status)}</Badge>
                    </span>
                  </div>
                );
              })}
              {!rows.length && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No quotations yet. Click “New quotation / revision” to add the
                  first one.
                </p>
              )}
            </div>
          </div>
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {nextVersion > 1 ? `Revision V${nextVersion}` : "New quotation"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                For which order
              </span>
              <Select
                value={form.order}
                onValueChange={(value) => setForm({ ...form, order: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">
                    No order yet (general quotation)
                  </SelectItem>
                  {orders.map((order) => (
                    <SelectItem key={order.id} value={order.id}>
                      {order.order_number || order.project_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                Subject (optional)
              </span>
              <Input
                value={form.subject}
                placeholder={`Quotation — ${organizationName || "Client"}`}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                Scope / description (optional)
              </span>
              <Textarea
                rows={3}
                value={form.scope}
                onChange={(e) => setForm({ ...form, scope: e.target.value })}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Quotation value (before GST)
                </span>
                <Input
                  type="number"
                  min="0"
                  value={form.subtotal}
                  onChange={(e) =>
                    setForm({ ...form, subtotal: e.target.value })
                  }
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  GST %
                </span>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={form.gst_rate}
                  onChange={(e) =>
                    setForm({ ...form, gst_rate: e.target.value })
                  }
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Status
                </span>
                <Select
                  value={form.status}
                  onValueChange={(value) => setForm({ ...form, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "draft",
                      "sent",
                      "viewed",
                      "accepted",
                      "rejected",
                      "expired",
                    ].map((value) => (
                      <SelectItem key={value} value={value}>
                        {nice(value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Valid until
                </span>
                <Input
                  type="date"
                  value={form.valid_until}
                  onChange={(e) =>
                    setForm({ ...form, valid_until: e.target.value })
                  }
                />
              </label>
            </div>
            {nextVersion > 1 && (
              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Why is it revised?
                </span>
                <Textarea
                  rows={2}
                  value={form.revision_reason}
                  onChange={(e) =>
                    setForm({ ...form, revision_reason: e.target.value })
                  }
                />
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={saving} onClick={save}>
              {saving ? "Saving…" : "Save quotation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
