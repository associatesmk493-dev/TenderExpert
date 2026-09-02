/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CalendarCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Save,
  Target,
} from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);
const iso = (value: Date) => value.toISOString().slice(0, 10);
const mondayOf = (value: Date) => {
  const date = new Date(value);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return iso(date);
};
const shiftDays = (value: string, days: number) => {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return iso(date);
};
const blank = {
  scorecard_date: today(),
  cash_collected: 0,
  advances_expected: 0,
  strongest_followups: "",
  meetings_completed: 0,
  proposals_submitted: 0,
  deals_awaiting_decision: 0,
  outstanding_payments: 0,
  tomorrow_top_actions: "",
};
const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);

export default function GrowthScorecards() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState<any>(blank);
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const weekEnd = shiftDays(weekStart, 6);
  const [history, setHistory] = useState<any[]>([]);
  const [weeklyLogs, setWeeklyLogs] = useState<any[]>([]);
  const [loadedWeek, setLoadedWeek] = useState("");
  const [raw, setRaw] = useState<any>({
    leads: [],
    proposals: [],
    activities: [],
    receipts: [],
    milestones: [],
    tasks: [],
    stageHistory: [],
  });
  const load = useCallback(async () => {
    setLoadedWeek("");
    const [s, l, p, a, r, m, t, h, w] = await Promise.all([
      supabase
        .from("b2g_personal_scorecards" as any)
        .select("*")
        .order("scorecard_date", { ascending: false })
        .limit(14),
      supabase
        .from("b2g_leads" as any)
        .select(
          "id,organization_name,stage,proposal_value,expected_revenue,advance_amount,decision_deadline,closed_at,lost_reason_code,created_at,ai_score,next_best_action,next_follow_up_at",
        ),
      supabase
        .from("b2g_proposals" as any)
        .select("id,subtotal,created_at,status")
        .gte("created_at", `${weekStart}T00:00:00`)
        .lte("created_at", `${weekEnd}T23:59:59`),
      supabase
        .from("b2g_activities" as any)
        .select("id,activity_type,created_at")
        .gte("created_at", `${weekStart}T00:00:00`)
        .lte("created_at", `${weekEnd}T23:59:59`),
      supabase
        .from("b2g_payment_receipts" as any)
        .select("id,amount,received_on,b2g_payment_milestones(milestone_name)")
        .gte("received_on", weekStart)
        .lte("received_on", weekEnd),
      supabase
        .from("b2g_payment_milestones" as any)
        .select(
          "id,milestone_name,amount,gst_amount,amount_received,status,due_date",
        ),
      supabase
        .from("b2g_tasks" as any)
        .select(
          "id,title,due_at,priority,completed_at,b2g_leads(organization_name)",
        )
        .is("completed_at", null),
      supabase
        .from("b2g_stage_history" as any)
        .select("lead_id,to_stage,entered_at")
        .gte("entered_at", `${weekStart}T00:00:00`)
        .lte("entered_at", `${weekEnd}T23:59:59`),
      supabase
        .from("b2g_weekly_conversion_scorecards" as any)
        .select("*")
        .order("week_start", { ascending: false })
        .limit(16),
    ]);
    setHistory(s.data || []);
    setWeeklyLogs(w.data || []);
    const leads = l.data || [],
      proposals = p.data || [],
      activities = a.data || [],
      receipts = r.data || [],
      milestones = m.data || [],
      tasks = t.data || [];
    if (weekStart === mondayOf(new Date())) {
      const day = today(),
        tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const balance = (row: any) =>
        Math.max(
          0,
          Number(row.amount || 0) +
            Number(row.gst_amount || 0) -
            Number(row.amount_received || 0),
        );
      const strongest = [...leads]
        .filter((row: any) => !row.closed_at)
        .sort(
          (x: any, y: any) =>
            Number(y.ai_score || 0) - Number(x.ai_score || 0) ||
            Number(y.expected_revenue || 0) - Number(x.expected_revenue || 0),
        )
        .slice(0, 3)
        .map(
          (row: any, index: number) =>
            `${index + 1}. ${row.organization_name}: ${row.next_best_action || "Follow up on decision"}`,
        )
        .join("\n");
      const tomorrowActions = tasks
        .filter((row: any) => row.due_at?.slice(0, 10) === tomorrow)
        .slice(0, 3)
        .map(
          (row: any, index: number) =>
            `${index + 1}. ${row.b2g_leads?.organization_name || "Internal"}: ${row.title}`,
        )
        .join("\n");
      setForm({
        ...blank,
        scorecard_date: day,
        cash_collected: receipts
          .filter((row: any) => row.received_on === day)
          .reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0),
        advances_expected: milestones
          .filter((row: any) => /advance/i.test(row.milestone_name || ""))
          .reduce((sum: number, row: any) => sum + balance(row), 0),
        strongest_followups: strongest,
        meetings_completed: activities.filter(
          (row: any) =>
            row.activity_type === "meeting" &&
            row.created_at?.slice(0, 10) === day,
        ).length,
        proposals_submitted: proposals.filter(
          (row: any) => row.created_at?.slice(0, 10) === day,
        ).length,
        deals_awaiting_decision: leads.filter(
          (row: any) => row.decision_deadline && !row.closed_at,
        ).length,
        outstanding_payments: milestones.reduce(
          (sum: number, row: any) => sum + balance(row),
          0,
        ),
        tomorrow_top_actions:
          tomorrowActions || "No tasks scheduled for tomorrow.",
      });
    }
    setRaw({
      leads: l.data || [],
      proposals: p.data || [],
      activities: a.data || [],
      receipts: r.data || [],
      milestones: m.data || [],
      tasks: t.data || [],
      stageHistory: h.data || [],
    });
    setLoadedWeek(weekStart);
  }, [weekStart, weekEnd]);
  useEffect(() => {
    load();
  }, [load]);
  const weekly = useMemo(() => {
    const qualifiedIds = new Set(
      raw.stageHistory
        .filter(
          (row: any) =>
            !["new_lead", "tender_identified"].includes(row.to_stage),
        )
        .map((row: any) => row.lead_id),
    );
    const qualified = qualifiedIds.size;
    const lostRows = raw.leads.filter(
      (lead: any) =>
        lead.closed_at?.slice(0, 10) >= weekStart &&
        lead.closed_at?.slice(0, 10) <= weekEnd &&
        lead.lost_reason_code,
    );
    const lostReasons = lostRows.reduce((result: Record<string, number>, lead: any) => {
      const reason = lead.lost_reason_code || "Not specified";
      result[reason] = (result[reason] || 0) + 1;
      return result;
    }, {});
    return {
      qualified,
      quotations: raw.proposals.length,
      quotationValue: raw.proposals.reduce(
        (sum: number, row: any) => sum + Number(row.subtotal || 0),
        0,
      ),
      decisionDates: raw.leads.filter(
        (lead: any) =>
          lead.decision_deadline >= weekStart &&
          lead.decision_deadline <= weekEnd,
      ).length,
      advances: raw.receipts.filter((row: any) =>
        /advance/i.test(row.b2g_payment_milestones?.milestone_name || ""),
      ).length,
      cash: raw.receipts.reduce(
        (sum: number, row: any) => sum + Number(row.amount || 0),
        0,
      ),
      lost: lostRows.length,
      lostReasons,
      meetings: raw.activities.filter(
        (row: any) => row.activity_type === "meeting",
      ).length,
    };
  }, [raw, weekStart, weekEnd]);
  useEffect(() => {
    if (!user?.id || loadedWeek !== weekStart) return;
    const snapshot = {
      user_id: user.id,
      week_start: weekStart,
      week_end: weekEnd,
      qualified_leads: weekly.qualified,
      quotations: weekly.quotations,
      quotation_value: weekly.quotationValue,
      decision_dates: weekly.decisionDates,
      advances: weekly.advances,
      cash_collected: weekly.cash,
      meetings: weekly.meetings,
      deals_lost: weekly.lost,
      lost_reasons: weekly.lostReasons,
      updated_at: new Date().toISOString(),
    };
    void supabase
      .from("b2g_weekly_conversion_scorecards" as any)
      .upsert(snapshot, { onConflict: "user_id,week_start" })
      .select()
      .single()
      .then(({ data, error }) => {
        if (error || !data) return;
        setWeeklyLogs((current) =>
          [data, ...current.filter((row) => row.week_start !== weekStart)].sort(
            (a, b) => b.week_start.localeCompare(a.week_start),
          ),
        );
      });
  }, [loadedWeek, user?.id, weekStart, weekEnd, weekly]);
  const save = async () => {
    const { error } = await supabase
      .from("b2g_personal_scorecards" as any)
      .upsert(
        { ...form, user_id: user?.id, updated_at: new Date().toISOString() },
        { onConflict: "user_id,scorecard_date" },
      );
    if (error)
      return toast({
        title: "Scorecard not saved",
        description: error.message,
        variant: "destructive",
      });
    toast({ title: "Daily scorecard saved" });
    load();
  };
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="overflow-hidden border-0 shadow-sm">
        <div className="bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-900 p-5 text-white">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-white/10 p-2">
              <Target className="h-5 w-5 text-cyan-300" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bold">Weekly conversion scorecard</h2>
                <Badge className="border-0 bg-cyan-400/15 text-cyan-200">
                  Auto-updating
                </Badge>
              </div>
              <p className="mt-1 text-xs text-slate-300">
                Review the selected week every Saturday—no manual refresh
                required.
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-end gap-2">
            <Button
              size="icon"
              variant="secondary"
              onClick={() => setWeekStart(shiftDays(weekStart, -7))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <label className="min-w-44 flex-1">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                Week starting
              </span>
              <Input
                className="border-white/20 bg-white text-slate-950"
                type="date"
                value={weekStart}
                onChange={(event) =>
                  setWeekStart(
                    mondayOf(new Date(`${event.target.value}T12:00:00`)),
                  )
                }
              />
            </label>
            <Button
              size="icon"
              variant="secondary"
              onClick={() => setWeekStart(shiftDays(weekStart, 7))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              onClick={() => setWeekStart(mondayOf(new Date()))}
            >
              <CalendarDays className="mr-1.5 h-4 w-4" />
              This week
            </Button>
          </div>
          <p className="mt-3 text-sm font-semibold text-cyan-100">
            {new Date(`${weekStart}T12:00:00`).toLocaleDateString("en-IN", {
              dateStyle: "medium",
            })}{" "}
            –{" "}
            {new Date(`${weekEnd}T12:00:00`).toLocaleDateString("en-IN", {
              dateStyle: "medium",
            })}
          </p>
        </div>
        <CardContent className="p-5">
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Metric label="Qualified leads" value={weekly.qualified} />
            <Metric label="Quotations" value={weekly.quotations} />
            <Metric
              label="Quotation value"
              value={money(weekly.quotationValue)}
            />
            <Metric label="Decision dates" value={weekly.decisionDates} />
            <Metric label="Advances" value={weekly.advances} />
            <Metric label="Cash collected" value={money(weekly.cash)} />
            <Metric label="Meetings" value={weekly.meetings} />
            <Metric label="Deals lost" value={weekly.lost} />
          </div>
          <div className="mt-6 border-t pt-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold">Saved weekly logs</h3>
                <p className="text-[11px] text-muted-foreground">
                  Select a week to reopen its date-wise conversion data.
                </p>
              </div>
              <Badge variant="secondary">{weeklyLogs.length} weeks</Badge>
            </div>
            <div className="space-y-2">
              {weeklyLogs.slice(0, 8).map((row) => (
                <button
                  type="button"
                  key={row.id || row.week_start}
                  onClick={() => setWeekStart(row.week_start)}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition hover:border-blue-300 hover:bg-blue-50/50 ${
                    row.week_start === weekStart
                      ? "border-blue-400 bg-blue-50 ring-1 ring-blue-200"
                      : "bg-white"
                  }`}
                >
                  <span>
                    <span className="block text-xs font-bold">
                      {new Date(`${row.week_start}T12:00:00`).toLocaleDateString(
                        "en-IN",
                        { dateStyle: "medium" },
                      )}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {row.quotations} quotations · {row.meetings} meetings
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block text-xs font-bold text-emerald-700">
                      {money(row.cash_collected)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      collected
                    </span>
                  </span>
                </button>
              ))}
              {!weeklyLogs.length && (
                <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
                  Weekly logs will appear automatically after the database
                  migration is applied.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="border-0 shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-4 w-4" />
            <h2 className="font-bold">Personal scorecard</h2>
            <Badge variant="secondary">Auto-generated</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Calculated automatically from leads, meetings, proposals, tasks,
            receipts and payment milestones. Review and save the daily snapshot.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <ScoreField label="Scorecard date">
              <Input type="date" value={form.scorecard_date} readOnly />
            </ScoreField>
            <ScoreField label="Cash collected today" hint="INR">
              <Input type="number" value={form.cash_collected} readOnly />
            </ScoreField>
            <ScoreField label="Advances expected" hint="INR">
              <Input type="number" value={form.advances_expected} readOnly />
            </ScoreField>
            <ScoreField label="Meetings completed" hint="Count">
              <Input type="number" value={form.meetings_completed} readOnly />
            </ScoreField>
            <ScoreField label="Proposals submitted" hint="Count">
              <Input type="number" value={form.proposals_submitted} readOnly />
            </ScoreField>
            <ScoreField label="Deals awaiting decision" hint="Count">
              <Input
                type="number"
                value={form.deals_awaiting_decision}
                readOnly
              />
            </ScoreField>
            <div className="sm:col-span-2">
              <ScoreField label="Outstanding payments" hint="INR">
                <Input
                  type="number"
                  value={form.outstanding_payments}
                  readOnly
                />
              </ScoreField>
            </div>
            <div className="sm:col-span-2">
              <ScoreField
                label="Three strongest follow-ups"
                hint="AI-ranked by lead score and expected revenue"
              >
                <Textarea rows={5} value={form.strongest_followups} readOnly />
              </ScoreField>
            </div>
            <div className="sm:col-span-2">
              <ScoreField
                label="Tomorrow’s top three actions"
                hint="From scheduled tasks and follow-ups"
              >
                <Textarea rows={4} value={form.tomorrow_top_actions} readOnly />
              </ScoreField>
            </div>
          </div>
          <Button className="mt-3" onClick={save}>
            <Save className="mr-2 h-4 w-4" />
            Save scorecard
          </Button>
          <div className="mt-5 space-y-2">
            {history.slice(0, 5).map((row) => (
              <div
                key={row.id}
                className="flex justify-between rounded-xl border p-3 text-xs"
              >
                <span>
                  {new Date(row.scorecard_date).toLocaleDateString("en-IN")}
                </span>
                <span>
                  {money(row.cash_collected)} collected ·{" "}
                  {row.meetings_completed} meetings · {row.proposals_submitted}{" "}
                  proposals
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="font-extrabold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function ScoreField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between gap-2 text-xs font-semibold text-foreground">
        <span>{label}</span>
        {hint && (
          <span className="font-normal text-muted-foreground">{hint}</span>
        )}
      </span>
      {children}
    </label>
  );
}
