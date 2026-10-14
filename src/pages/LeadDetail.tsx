/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import LeadVoiceMeeting from "@/components/LeadVoiceMeeting";
import LeadOrdersManager from "@/components/LeadOrdersManager";
import LeadFollowUpManager from "@/components/LeadFollowUpManager";
import LeadQuotationTimeline from "@/components/LeadQuotationTimeline";
import LeadCallOutcome from "@/components/LeadCallOutcome";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import DictateButton from "@/components/DictateButton";
import { SHOW_AUTOMATION } from "@/lib/features";
import { skippedMessage, writeWithFallback } from "@/lib/writeWithFallback";
import {
  CLOSED_STAGES,
  LOST_REASONS,
  fromCampaign,
  leadState,
  sourceLabel,
} from "@/lib/leadOptions";
import {
  ArrowLeft,
  BrainCircuit,
  Building2,
  CalendarClock,
  IndianRupee,
  Mail,
  Megaphone,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  Trash2,
  UserX,
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
    [meetings, setMeetings] = useState<any[]>([]),
    [paymentsReceived, setPaymentsReceived] = useState(0),
    [note, setNote] = useState("");
  const load = async () => {
    const [l, a, m, p] = await Promise.all([
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
      supabase
        .from("b2g_client_meetings" as any)
        .select("id,transcript,meeting_at")
        .eq("lead_id", id)
        .order("meeting_at", { ascending: false }),
      supabase
        .from("b2g_projects" as any)
        .select("b2g_payment_milestones(amount_received)")
        .eq("lead_id", id),
    ]);
    setLead(l.data);
    setActs(a.data || []);
    setMeetings((m.data as any[]) || []);
    setPaymentsReceived(
      ((p.data as any[]) || []).reduce(
        (sum, project) =>
          sum +
          (project.b2g_payment_milestones || []).reduce(
            (inner: number, milestone: any) =>
              inner + Number(milestone.amount_received || 0),
            0,
          ),
        0,
      ),
    );
  };
  useEffect(() => {
    load();
  }, [id]);
  const update = async (p: any) => {
    const { result, skipped } = await writeWithFallback(
      (body) =>
        supabase
          .from("b2g_leads" as any)
          .update(body)
          .eq("id", id),
      p,
    );
    if (result.error)
      toast({
        title: "Update failed",
        description: result.error.message,
        variant: "destructive",
      });
    else {
      setLead((x: any) => ({ ...x, ...p }));
      toast({ title: "Updated", description: skippedMessage(skipped) });
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
  const markNotInterested = () =>
    update({
      lost_reason_code: "not_interested",
      closed_at: lead.closed_at || new Date().toISOString(),
      heat: "cold",
    });
  const reopenLead = () =>
    update({
      lost_reason_code: null,
      closed_at: CLOSED_STAGES.includes(lead.stage) ? lead.closed_at : null,
    });
  const deleteLead = async () => {
    const { error } = await supabase
      .from("b2g_leads" as any)
      .delete()
      .eq("id", id);
    if (error) {
      toast({
        title: "Lead could not be deleted",
        description: /foreign key|violates/i.test(error.message)
          ? "This lead already has orders or payments, so it cannot be deleted. Use “Not interested” to move it out of the active list."
          : error.message,
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Lead deleted" });
    nav("/leads");
  };
  if (!lead) return <div className="p-8">Loading opportunity…</div>;
  const state = leadState(lead);
  const timeline = [
    ...acts,
    ...meetings
      .filter((m) => !acts.some((a) => a.description === m.transcript))
      .map((m) => ({
        id: `meeting-${m.id}`,
        subject: "Meeting record",
        description: m.transcript,
        created_at: m.meeting_at,
      })),
  ].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const gstRate = Number(lead.proposal_gst_rate || 0);
  const proposalTotal =
    Math.round(Number(lead.proposal_value || 0) * (1 + gstRate / 100) * 100) /
    100;
  const receivedShown =
    paymentsReceived > 0 ? paymentsReceived : Number(lead.received_amount || 0);
  const commercialPatch = (value: number, rate: number) => ({
    proposal_value: value,
    proposal_gst_rate: rate,
    total_amount: Math.round(value * (1 + rate / 100) * 100) / 100,
    expected_revenue: (value * Number(lead.probability)) / 100,
  });
  return (
    <div className="min-h-full bg-slate-50/60 p-4 md:p-7">
      <button
        onClick={() => nav("/leads")}
        className="flex items-center gap-2 text-sm text-muted-foreground mb-5"
      >
        <ArrowLeft className="h-4 w-4" />
        Opportunities
      </button>
      {fromCampaign(lead) && (
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-indigo-50 px-4 py-2.5 text-sm font-medium text-indigo-700">
          <Megaphone className="h-4 w-4" />
          <span>Exported from campaign: {lead.campaign_name}</span>
          <span>
            · Event: {lead.event_name || lead.campaign_name}
          </span>
        </div>
      )}
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
                {title(lead.heat)}
                {SHOW_AUTOMATION ? ` · AI ${lead.ai_score}` : ""}
              </Badge>
              {state === "lost" && (
                <Badge variant="destructive">
                  {lead.lost_reason_code === "not_interested"
                    ? "Not interested"
                    : `Lost · ${title(lead.lost_reason_code)}`}
                </Badge>
              )}
              {state === "closed" && <Badge variant="secondary">Closed</Badge>}
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
          {state === "active" ? (
            <Button
              variant="outline"
              title="Move to the Not interested list"
              onClick={markNotInterested}
            >
              <UserX className="h-4 w-4 mr-2" />
              Not interested
            </Button>
          ) : (
            <Button variant="outline" onClick={reopenLead}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reopen lead
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="text-destructive"
                aria-label="Delete lead"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this lead permanently?</AlertDialogTitle>
                <AlertDialogDescription>
                  “{lead.organization_name}” and its follow-ups, notes and
                  quotations will be removed. This cannot be undone. If the
                  client is just not interested, use “Not interested” instead —
                  it keeps the history.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={deleteLead}
                >
                  Delete lead
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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
                    closed_at: CLOSED_STAGES.includes(v)
                      ? new Date().toISOString()
                      : lead.lost_reason_code
                        ? lead.closed_at
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
                <Info
                  label="Source"
                  value={
                    lead.source === "event" && lead.event_name
                      ? `Event — ${lead.event_name}`
                      : sourceLabel(lead.source)
                  }
                />
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
                <DecisionField label="Proposal amount (before GST)">
                  <Input
                    type="number"
                    defaultValue={lead.proposal_value || 0}
                    onBlur={(e) =>
                      update(
                        commercialPatch(Number(e.target.value || 0), gstRate),
                      )
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
                      v === "none"
                        ? reopenLead()
                        : update({
                            lost_reason_code: v,
                            closed_at:
                              lead.closed_at || new Date().toISOString(),
                            ...(v === "not_interested" ? { heat: "cold" } : {}),
                          })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not lost</SelectItem>
                      {LOST_REASONS.map((v) => (
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
          <LeadCallOutcome
            lead={lead}
            canScheduleMeetingStage={stages[lead.pipeline]?.includes("meeting_scheduled")}
            update={update}
            onSaved={load}
          />
          <LeadFollowUpManager leadId={lead.id} onChanged={load} />
          <LeadOrdersManager
            leadId={lead.id}
            organizationName={lead.organization_name}
          />
          <LeadQuotationTimeline
            leadId={lead.id}
            organizationName={lead.organization_name}
            onChanged={load}
          />
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
                <Badge variant="secondary">{timeline.length} records</Badge>
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
              <div className="mt-2 flex justify-end">
                <DictateButton
                  onText={(spoken) =>
                    setNote((current) =>
                      current ? `${current.trimEnd()} ${spoken}` : spoken,
                    )
                  }
                />
              </div>
              <div className="mt-5 space-y-3">
                {timeline.map((a) => (
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
          {SHOW_AUTOMATION && (
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
          )}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <h2 className="font-bold flex items-center gap-2">
                <IndianRupee className="h-4 w-4" />
                Commercials
              </h2>
              <p className="text-2xl font-extrabold mt-4">
                {money(proposalTotal)}
              </p>
              <p className="text-xs text-muted-foreground">
                Total with GST
              </p>
              <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Proposal value (before GST)
                  </span>
                  <span className="font-semibold">
                    {money(lead.proposal_value)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">GST</span>
                  <Select
                    value={String(gstRate)}
                    onValueChange={(v) =>
                      update(
                        commercialPatch(
                          Number(lead.proposal_value || 0),
                          Number(v),
                        ),
                      )
                    }
                  >
                    <SelectTrigger className="h-8 w-32 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from(new Set([0, 5, 12, 18, 28, gstRate])).map(
                        (x) => (
                          <SelectItem key={x} value={String(x)}>
                            {x === 0 ? "No GST" : `GST ${x}%`}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
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
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                Expected = Proposal value × Probability. Raise the probability as
                the deal moves forward; the dashboard uses it to forecast
                revenue.
              </p>
              <div className="mt-5 space-y-3 border-t pt-4">
                <h3 className="text-sm font-bold">Fund flow</h3>
                <div>
                  <span className="text-xs text-muted-foreground">
                    Total amount (proposal value incl. GST)
                  </span>
                  <p className="mt-1 rounded-md border bg-slate-50 px-3 py-2 text-sm font-semibold">
                    {money(proposalTotal)}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Same as the proposal total above — change the proposal value
                    or GST to update it.
                  </p>
                </div>
                <label className="block">
                  <span className="text-xs text-muted-foreground">
                    Amount received so far
                  </span>
                  {paymentsReceived > 0 ? (
                    <>
                      <p className="mt-1 rounded-md border bg-slate-50 px-3 py-2 text-sm font-semibold">
                        {money(paymentsReceived)}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Synced from payments recorded for this client's orders.
                      </p>
                    </>
                  ) : (
                    <Input
                      className="mt-1"
                      type="number"
                      min="0"
                      defaultValue={lead.received_amount || 0}
                      onBlur={(e) =>
                        update({ received_amount: Number(e.target.value || 0) })
                      }
                    />
                  )}
                </label>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p
                    className={`font-bold ${proposalTotal - receivedShown > 0 ? "text-rose-700" : "text-emerald-700"}`}
                  >
                    {money(Math.max(0, proposalTotal - receivedShown))}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Balance payment
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full bg-emerald-500"
                      style={{
                        width: `${Math.min(100, proposalTotal > 0 ? (receivedShown * 100) / proposalTotal : 0)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
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
