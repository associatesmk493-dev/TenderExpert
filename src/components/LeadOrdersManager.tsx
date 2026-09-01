/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Banknote,
  FileText,
  IndianRupee,
  Plus,
  Receipt,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
const money = (v: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(v || 0);
const nice = (v: string) =>
  v?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const blankOrder = {
  order_number: "",
  project_name: "",
  scope: "",
  payment_model: "80_20",
  contract_value: "",
  estimated_cost: "",
  start_date: "",
  target_completion_date: "",
  expected_close_date: "",
};
export default function LeadOrdersManager({
  leadId,
  organizationName,
}: {
  leadId: string;
  organizationName: string;
}) {
  const { user } = useAuth(),
    { toast } = useToast();
  const [orders, setOrders] = useState<any[]>([]),
    [pnl, setPnl] = useState<any[]>([]),
    [open, setOpen] = useState(false),
    [form, setForm] = useState(blankOrder),
    [action, setAction] = useState<{ type: string; order: any } | null>(null),
    [actionForm, setActionForm] = useState<any>({});
  const load = () =>
    Promise.all([
      supabase
        .from("b2g_projects" as any)
        .select("*,b2g_payment_milestones(*),b2g_proposals(*)")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false }),
      supabase
        .from("b2g_project_pnl" as any)
        .select("*")
        .eq("lead_id", leadId),
    ]).then(([o, p]) => {
      setOrders(o.data || []);
      setPnl(p.data || []);
    });
  useEffect(() => {
    load();
  }, [leadId]);
  const createOrder = async () => {
    const { data, error } = await supabase
      .from("b2g_projects" as any)
      .insert({
        ...form,
        lead_id: leadId,
        contract_value: Number(form.contract_value || 0),
        estimated_cost: Number(form.estimated_cost || 0),
        start_date: form.start_date || null,
        target_completion_date: form.target_completion_date || null,
        expected_close_date: form.expected_close_date || null,
        created_by: user?.id,
      })
      .select("id")
      .single();
    if (error)
      return toast({
        title: "Order not created",
        description: error.message,
        variant: "destructive",
      });
    await supabase.rpc("generate_payment_milestones" as any, {
      target_project: data.id,
    });
    setOpen(false);
    setForm(blankOrder);
    toast({ title: "Order and payment schedule created" });
    load();
  };
  const begin = (type: string, order: any) => {
    setAction({ type, order });
    setActionForm(
      type === "quotation"
        ? { subtotal: "", status: "sent", valid_until: "", revision_reason: "" }
        : type === "receipt"
          ? {
              milestone_id: order.b2g_payment_milestones?.[0]?.id || "",
              amount: "",
              received_on: new Date().toISOString().slice(0, 10),
              mode: "bank_transfer",
              utr_ref: "",
            }
          : {
              category_id: "",
              vendor: "",
              amount: "",
              gst: "",
              paid_on: new Date().toISOString().slice(0, 10),
              description: "",
            },
    );
  };
  const saveAction = async () => {
    if (!action) return;
    let result: any;
    if (action.type === "quotation") {
      const previous = [...(action.order.b2g_proposals || [])].sort(
        (a, b) => b.version - a.version,
      )[0];
      result = await supabase
        .from("b2g_proposals" as any)
        .insert({
          lead_id: leadId,
          project_id: action.order.id,
          proposal_number: `${action.order.order_number || "ORD"}-Q${(previous?.version || 0) + 1}`,
          subject: `Quotation — ${action.order.project_name}`,
          scope: action.order.scope || action.order.project_name,
          payment_model: action.order.payment_model,
          subtotal: Number(actionForm.subtotal || 0),
          status: actionForm.status,
          valid_until: actionForm.valid_until || null,
          version: (previous?.version || 0) + 1,
          supersedes_id: previous?.id || null,
          revision_reason: actionForm.revision_reason || null,
          sent_at:
            actionForm.status === "sent" ? new Date().toISOString() : null,
          submitted_at:
            actionForm.status === "sent" ? new Date().toISOString() : null,
          created_by: user?.id,
        });
    } else if (action.type === "receipt") {
      result = await supabase
        .from("b2g_payment_receipts" as any)
        .insert({
          ...actionForm,
          amount: Number(actionForm.amount),
          created_by: user?.id,
        });
    } else {
      result = await supabase
        .from("b2g_expenses" as any)
        .insert({
          ...actionForm,
          project_id: action.order.id,
          category_id: null,
          amount: Number(actionForm.amount),
          gst: Number(actionForm.gst || 0),
          created_by: user?.id,
        });
    }
    if (result.error)
      return toast({
        title: "Not saved",
        description: result.error.message,
        variant: "destructive",
      });
    setAction(null);
    toast({ title: "Commercial record saved" });
    load();
  };
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h2 className="font-bold text-lg">Orders & commercials</h2>
            <p className="text-xs text-muted-foreground">
              All orders, quotations, payments, expenses and profitability for {organizationName}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  New order
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create another order</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      placeholder="Order number"
                      value={form.order_number}
                      onChange={(e) =>
                        setForm({ ...form, order_number: e.target.value })
                      }
                    />
                    <Input
                      placeholder="Order / project name"
                      value={form.project_name}
                      onChange={(e) =>
                        setForm({ ...form, project_name: e.target.value })
                      }
                    />
                  </div>
                  <Textarea
                    placeholder="Scope of work"
                    value={form.scope}
                    onChange={(e) =>
                      setForm({ ...form, scope: e.target.value })
                    }
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Select
                      value={form.payment_model}
                      onValueChange={(v) =>
                        setForm({ ...form, payment_model: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          "80_20",
                          "70_30",
                          "50_50",
                          "milestone",
                          "monthly_retainer",
                          "success_fee",
                        ].map((v) => (
                          <SelectItem key={v} value={v}>
                            {nice(v)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      placeholder="Order value"
                      value={form.contract_value}
                      onChange={(e) =>
                        setForm({ ...form, contract_value: e.target.value })
                      }
                    />
                    <Input
                      type="number"
                      placeholder="Estimated cost"
                      value={form.estimated_cost}
                      onChange={(e) =>
                        setForm({ ...form, estimated_cost: e.target.value })
                      }
                    />
                    <Input
                      type="date"
                      title="Expected close"
                      value={form.expected_close_date}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          expected_close_date: e.target.value,
                        })
                      }
                    />
                    <Input
                      type="date"
                      title="Start date"
                      value={form.start_date}
                      onChange={(e) =>
                        setForm({ ...form, start_date: e.target.value })
                      }
                    />
                    <Input
                      type="date"
                      title="Target completion"
                      value={form.target_completion_date}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          target_completion_date: e.target.value,
                        })
                      }
                    />
                  </div>
                  <Button
                    className="w-full"
                    disabled={!form.project_name || !form.contract_value}
                    onClick={createOrder}
                  >
                    Create order
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <div className="space-y-3 mt-5">
          {orders.map((order) => {
            const financial =
              pnl.find((row) => row.project_id === order.id) || {};
            const milestones = order.b2g_payment_milestones || [],
              invoice = milestones.reduce(
                (s: any, m: any) => s + Number(m.amount) + Number(m.gst_amount),
                0,
              ),
              received = milestones.reduce(
                (s: any, m: any) => s + Number(m.amount_received),
                0,
              ),
              proposals = order.b2g_proposals || [];
            return (
              <div key={order.id} className="rounded-2xl border p-4">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <h3 className="font-bold">{order.project_name}</h3>
                      <Badge variant="secondary">
                        {order.order_number || "No order no."}
                      </Badge>
                      <Badge>{nice(order.status)}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {nice(order.payment_model)} · expected close{" "}
                      {order.expected_close_date || "not set"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => begin("quotation", order)}
                    >
                      <FileText className="h-3.5 w-3.5 mr-1" />
                      Quotation
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!milestones.length}
                      onClick={() => begin("receipt", order)}
                    >
                      <Banknote className="h-3.5 w-3.5 mr-1" />
                      Receipt
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => begin("expense", order)}
                    >
                      <Receipt className="h-3.5 w-3.5 mr-1" />
                      Expense
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
                  <Stat
                    label="Order value"
                    value={money(order.contract_value)}
                  />
                  <Stat label="Invoiced" value={money(invoice)} />
                  <Stat label="Received" value={money(received)} />
                  <Stat
                    label="Outstanding"
                    value={money(Math.max(0, invoice - received))}
                  />
                  <Stat
                    label="Margin"
                    value={`${money(financial.margin_amount)} (${financial.margin_pct || 0}%)`}
                  />
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  {proposals.length} quotation version(s) · {milestones.length}{" "}
                  payment milestone(s)
                </div>
              </div>
            );
          })}
          {!orders.length && (
            <div className="rounded-xl bg-slate-50 py-10 text-center text-sm text-muted-foreground">
              No orders yet. Use “New order” when this client places an order.
            </div>
          )}
        </div>
        <Dialog open={!!action} onOpenChange={(v) => !v && setAction(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {action ? nice(action.type) : ""} —{" "}
                {action?.order?.project_name}
              </DialogTitle>
            </DialogHeader>
            {action?.type === "quotation" ? (
              <div className="space-y-3">
                <Input
                  type="number"
                  placeholder="Quotation value"
                  value={actionForm.subtotal || ""}
                  onChange={(e) =>
                    setActionForm({ ...actionForm, subtotal: e.target.value })
                  }
                />
                <Select
                  value={actionForm.status}
                  onValueChange={(v) =>
                    setActionForm({ ...actionForm, status: v })
                  }
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
                    ].map((v) => (
                      <SelectItem key={v} value={v}>
                        {nice(v)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  value={actionForm.valid_until || ""}
                  onChange={(e) =>
                    setActionForm({
                      ...actionForm,
                      valid_until: e.target.value,
                    })
                  }
                />
                <Textarea
                  placeholder="Revision reason"
                  value={actionForm.revision_reason || ""}
                  onChange={(e) =>
                    setActionForm({
                      ...actionForm,
                      revision_reason: e.target.value,
                    })
                  }
                />
              </div>
            ) : action?.type === "receipt" ? (
              <div className="space-y-3">
                <Select
                  value={actionForm.milestone_id || ""}
                  onValueChange={(v) =>
                    setActionForm({ ...actionForm, milestone_id: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Payment milestone" />
                  </SelectTrigger>
                  <SelectContent>
                    {action.order.b2g_payment_milestones?.map((m: any) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.milestone_name} —{" "}
                        {money(
                          Number(m.amount) +
                            Number(m.gst_amount) -
                            Number(m.amount_received),
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  placeholder="Amount received"
                  value={actionForm.amount || ""}
                  onChange={(e) =>
                    setActionForm({ ...actionForm, amount: e.target.value })
                  }
                />
                <Input
                  type="date"
                  value={actionForm.received_on || ""}
                  onChange={(e) =>
                    setActionForm({
                      ...actionForm,
                      received_on: e.target.value,
                    })
                  }
                />
                <Input
                  placeholder="UTR / reference"
                  value={actionForm.utr_ref || ""}
                  onChange={(e) =>
                    setActionForm({ ...actionForm, utr_ref: e.target.value })
                  }
                />
              </div>
            ) : (
              <div className="space-y-3">
                <Input
                  placeholder="Vendor"
                  value={actionForm.vendor || ""}
                  onChange={(e) =>
                    setActionForm({ ...actionForm, vendor: e.target.value })
                  }
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    type="number"
                    placeholder="Expense amount"
                    value={actionForm.amount || ""}
                    onChange={(e) =>
                      setActionForm({ ...actionForm, amount: e.target.value })
                    }
                  />
                  <Input
                    type="number"
                    placeholder="GST"
                    value={actionForm.gst || ""}
                    onChange={(e) =>
                      setActionForm({ ...actionForm, gst: e.target.value })
                    }
                  />
                </div>
                <Textarea
                  placeholder="Expense description"
                  value={actionForm.description || ""}
                  onChange={(e) =>
                    setActionForm({
                      ...actionForm,
                      description: e.target.value,
                    })
                  }
                />
              </div>
            )}
            <Button onClick={saveAction}>
              Save {action ? nice(action.type) : ""}
            </Button>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="font-bold text-sm">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
