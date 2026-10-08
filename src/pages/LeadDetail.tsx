/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import LeadVoiceMeeting from "@/components/LeadVoiceMeeting";
import LeadOrdersManager from "@/components/LeadOrdersManager";
import LeadFollowUpManager from "@/components/LeadFollowUpManager";
import LeadQuotationTimeline from "@/components/LeadQuotationTimeline";
import LeadOpportunitySheet from "@/components/LeadOpportunitySheet";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  BrainCircuit,
  Building2,
  CalendarClock,
  IndianRupee,
  Mail,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
} from "lucide-react";
const stages: Record<string, string[]> = {
  brand_approval: [
    "new_lead",
    "qualified_lead",
    "meeting_scheduled",
    "documents_requested",
    "documents_received",
    "proposal_submitted",
    "negotiation",
    "generate_pi",
    "advance_received",
    "project_started",
    "submission_completed",
    "under_process",
    "approval_completed",
    "final_payment_received",
    "closed",
  ],
  government_business_development: [
    "new_lead",
    "business_assessment",
    "opportunity_discussion",
    "proposal_submitted",
    "negotiation",
    "generate_pi",
    "agreement_signed",
    "project_active",
    "technical_presentation",
    "opportunity_identification",
    "tender_support",
    "order_conversion",
    "completed",
  ],
  tender_consultancy: [
    "tender_identified",
    "client_discussion",
    "tender_evaluation",
    "go_no_go_decision",
    "proposal_submitted",
    "generate_pi",
    "work_order_received",
    "bid_submission",
    "result_awaited",
    "order_received",
    "completed",
  ],
};
const title = (x: string) =>
  x
    ?.replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bPi\b/g, "PI");
const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n || 0);
export default function LeadDetail() {
  const { id } = useParams(),
    nav = useNavigate(),
    { toast } = useToast();
  const [lead, setLead] = useState<any>(null),
    [acts, setActs] = useState<any[]>([]),
    [note, setNote] = useState("");
  const load = async () => {
    const [l, a] = await Promise.all([
      supabase
        .from("b2g_leads" as any)
        .select("*")
        .eq("id", id)
        .single(),
      supabase
        .from("b2g_activities" as any)
        .select("*")
        .eq("lead_id", id)
        .order("created_at", { ascending: false }),
    ]);
    setLead(l.data);
    setActs(a.data || []);
  };
  useEffect(() => {
    load();
  }, [id]);
  const update = async (p: any) => {
    const { error } = await supabase
      .from("b2g_leads" as any)
      .update(p)
      .eq("id", id);
    if (error)
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    else {
      setLead((x: any) => ({ ...x, ...p }));
      toast({ title: "Updated" });
    }
  };
  const addNote = async () => {
    if (!note.trim()) return;
    await supabase
      .from("b2g_activities" as any)
      .insert({
        lead_id: id,
        activity_type: "note",
        subject: "Team note",
        description: note,
      });
    setNote("");
    load();
  };
  if (!lead) return <div className="p-8">Loading opportunity…</div>;
  return (
    <div className="min-h-full bg-slate-50/60 p-4 md:p-7">
      <button
        onClick={() => nav("/leads")}
        className="flex items-center gap-2 text-sm text-muted-foreground mb-5"
      >
        <ArrowLeft className="h-4 w-4" />
        Opportunities
      </button>
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
        <div className="flex gap-3">
          <div className="h-12 w-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
            <Building2 />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{lead.organization_name}</h1>
            <p className="text-muted-foreground">
              {lead.contact_name} · {lead.industry}
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge>{title(lead.pipeline)}</Badge>
              <Badge variant="outline">
                {title(lead.heat)} · AI {lead.ai_score}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => nav(`/leads/${lead.id}/edit`)}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit lead
          </Button>
          <Button variant="outline" asChild>
            <a href={`tel:${lead.phone}`}>
              <Phone className="h-4 w-4 mr-2" />
              Call
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a
              href={`https://wa.me/${lead.phone?.replace(/\D/g, "")}`}
              target="_blank"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              WhatsApp
            </a>
          </Button>
          {lead.email && (
            <Button variant="outline" asChild>
              <a href={`mailto:${lead.email}`}>
                <Mail className="h-4 w-4" />
              </a>
            </Button>
          )}
        </div>
      </div>
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <h2 className="font-bold mb-4">Pipeline progress</h2>
              <Select
                value={lead.stage}
                onValueChange={(v) =>
                  update({
                    stage: v,
                    closed_at: [
                      "closed",
                      "completed",
                      "final_payment_received",
                    ].includes(v)
                      ? new Date().toISOString()
                      : null,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stages[lead.pipeline].map((s) => (
                    <SelectItem key={s} value={s}>
                      {title(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="mt-4 flex gap-1 overflow-hidden rounded-full bg-slate-100 h-2">
                {stages[lead.pipeline].map((s, i) => (
                  <div
                    key={s}
                    className={`flex-1 ${i <= stages[lead.pipeline].indexOf(lead.stage) ? "bg-primary" : "bg-transparent"}`}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
          <LeadOpportunitySheet lead={lead} update={update} />
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <h2 className="font-bold mb-4">Customer intelligence</h2>
              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                <Info label="Phone" value={lead.phone} />
                <Info label="Email" value={lead.email || "—"} />
                <Info
                  label="Location"
                  value={
                    [lead.city, lead.state].filter(Boolean).join(", ") || "—"
                  }
                />
                <Info label="Source" value={title(lead.source)} />
                <Info
                  label="Services"
                  value={lead.service_interest?.join(", ") || "—"}
                />
                <Info
                  label="Last contacted"
                  value={
                    lead.last_contacted_at
                      ? new Date(lead.last_contacted_at).toLocaleString("en-IN")
                      : "—"
                  }
                />
              </div>
              {lead.notes && (
                <p className="mt-4 p-4 bg-slate-50 rounded-xl text-sm">
                  {lead.notes}
                </p>
              )}
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="mb-4">
                <h2 className="font-bold">Decision & collection brief</h2>
                <p className="text-xs text-muted-foreground">
                  The seven facts required before every management review
                </p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <DecisionField label="Final decision-maker">
                  <Input
                    defaultValue={lead.decision_maker_name || ""}
                    onBlur={(e) =>
                      update({ decision_maker_name: e.target.value || null })
                    }
                  />
                </DecisionField>
                <DecisionField label="Proposal amount">
                  <Input
                    type="number"
                    defaultValue={lead.proposal_value || 0}
                    onBlur={(e) =>
                      update({
                        proposal_value: Number(e.target.value || 0),
                        expected_revenue:
                          (Number(e.target.value || 0) *
                            Number(lead.probability)) /
                          100,
                      })
                    }
                  />
                </DecisionField>
                <DecisionField label="Advance amount">
                  <Input
                    type="number"
                    defaultValue={lead.advance_amount || 0}
                    onBlur={(e) =>
                      update({ advance_amount: Number(e.target.value || 0) })
                    }
                  />
                </DecisionField>
                <DecisionField label="Objection">
                  <Input
                    defaultValue={lead.objection || ""}
                    onBlur={(e) =>
                      update({ objection: e.target.value || null })
                    }
                  />
                </DecisionField>
                <DecisionField label="Next action">
                  <Input
                    defaultValue={lead.next_best_action || ""}
                    onBlur={(e) =>
                      update({ next_best_action: e.target.value || null })
                    }
                  />
                </DecisionField>
                <DecisionField label="Decision deadline">
                  <Input
                    type="date"
                    defaultValue={lead.decision_deadline || ""}
                    onBlur={(e) =>
                      update({ decision_deadline: e.target.value || null })
                    }
                  />
                </DecisionField>
                <DecisionField label="Expected collection date">
                  <Input
                    type="date"
                    defaultValue={lead.expected_collection_date || ""}
                    onBlur={(e) =>
                      update({
                        expected_collection_date: e.target.value || null,
                      })
                    }
                  />
                </DecisionField>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <h2 className="font-bold mb-4">Delay / loss / closure</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <DecisionField label="Lost reason">
                  <Select
                    value={lead.lost_reason_code || "none"}
                    onValueChange={(v) =>
                      update({ lost_reason_code: v === "none" ? null : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not lost</SelectItem>
                      {[
                        "price",
                        "competitor",
                        "budget_freeze",
                        "no_response",
                        "timeline",
                        "scope_mismatch",
                        "project_cancelled",
                        "lost_to_incumbent",
                        "other",
                      ].map((v) => (
                        <SelectItem key={v} value={v}>
                          {title(v)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </DecisionField>
                <DecisionField label="Delay reason">
                  <Input
                    defaultValue={lead.delay_reason || ""}
                    onBlur={(e) =>
                      update({
                        delay_reason: e.target.value || null,
                        stalled_since: e.target.value
                          ? lead.stalled_since || new Date().toISOString()
                          : null,
                      })
                    }
                  />
                </DecisionField>
                <DecisionField label="On hold reason">
                  <Input
                    defaultValue={lead.on_hold_reason || ""}
                    onBlur={(e) =>
                      update({
                        on_hold: !!e.target.value,
                        on_hold_reason: e.target.value || null,
                      })
                    }
                  />
                </DecisionField>
                <DecisionField label="Closed reason / notes">
                  <Input
                    defaultValue={lead.lost_reason || ""}
                    onBlur={(e) =>
                      update({ lost_reason: e.target.value || null })
                    }
                  />
                </DecisionField>
              </div>
            </CardContent>
          </Card>
          <LeadFollowUpManager leadId={lead.id} onChanged={load} />
          <LeadOrdersManager
            leadId={lead.id}
            organizationName={lead.organization_name}
          />
          <LeadQuotationTimeline leadId={lead.id} />
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <LeadVoiceMeeting
                leadId={lead.id}
                organizationName={lead.organization_name}
                onSaved={load}
              />
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-bold">Activity & meeting notes</h2>
                <Badge variant="secondary">{acts.length} records</Badge>
              </div>
              <div className="flex gap-2 mt-4">
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add meeting note, call outcome, decision-maker update…"
                />
                <Button onClick={addNote} size="icon" className="shrink-0">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-5 space-y-3">
                {acts.map((a) => (
                  <div
                    key={a.id}
                    className="border-l-2 border-primary/30 pl-4 py-1"
                  >
                    <p className="text-sm font-semibold">{a.subject}</p>
                    <p className="text-sm text-muted-foreground">
                      {a.description}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(a.created_at).toLocaleString("en-IN")}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-5">
          <Card className="border-0 shadow-sm bg-slate-950 text-white">
            <CardContent className="p-5">
              <div className="flex gap-2 items-center text-cyan-300">
                <BrainCircuit className="h-5 w-5" />
                <span className="font-bold">AI recommendation</span>
              </div>
              <p className="text-sm text-slate-300 mt-4">
                {lead.ai_summary ||
                  "Lead score is based on pipeline activity, proposal value, follow-up recency and engagement."}
              </p>
              <p className="text-sm font-semibold mt-4 p-3 bg-white/5 rounded-xl">
                Next:{" "}
                {lead.next_best_action ||
                  "Schedule a decision-maker conversation and confirm document readiness."}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <h2 className="font-bold flex items-center gap-2">
                <IndianRupee className="h-4 w-4" />
                Commercials
              </h2>
              <p className="text-2xl font-extrabold mt-4">
                {money(lead.proposal_value)}
              </p>
              <p className="text-xs text-muted-foreground">Proposal value</p>
              <div className="mt-4">
                <label className="text-xs text-muted-foreground">
                  Probability
                </label>
                <Select
                  value={String(lead.probability)}
                  onValueChange={(v) =>
                    update({
                      probability: Number(v),
                      expected_revenue:
                        (Number(lead.proposal_value) * Number(v)) / 100,
                    })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((x) => (
                      <SelectItem key={x} value={String(x)}>
                        {x}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="font-bold mt-4">
                {money(lead.expected_revenue)}{" "}
                <span className="font-normal text-xs text-muted-foreground">
                  expected
                </span>
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <h2 className="font-bold flex items-center gap-2">
                <CalendarClock className="h-4 w-4" />
                Next follow-up
              </h2>
              <Input
                className="mt-4"
                type="datetime-local"
                value={lead.next_follow_up_at?.slice(0, 16) || ""}
                onChange={(e) =>
                  update({ next_follow_up_at: e.target.value || null })
                }
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium mt-1">{value}</p>
    </div>
  );
}
function DecisionField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
