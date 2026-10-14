/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import { useEffect, useState } from "react";
import {
  Ban,
  CalendarCheck,
  Clock,
  PhoneCall,
  PhoneOff,
  Power,
  Repeat,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Outcome = {
  key: string;
  label: string;
  icon: LucideIcon;
  tone: string;
  // what happens after the call is saved
  next: "retry" | "follow_up" | "meeting" | "close" | "none";
  taskTitle?: string;
  taskType?: string;
};

const OUTCOMES: Outcome[] = [
  { key: "spoke_follow_up", label: "Spoke — follow up", icon: Repeat, tone: "text-blue-600", next: "follow_up", taskTitle: "Follow up", taskType: "follow_up" },
  { key: "meeting_scheduled", label: "Meeting scheduled", icon: CalendarCheck, tone: "text-indigo-600", next: "meeting", taskTitle: "Meeting", taskType: "meeting" },
  { key: "not_picked_up", label: "Not picked up (RNR)", icon: PhoneOff, tone: "text-rose-600", next: "retry", taskTitle: "Call again", taskType: "call" },
  { key: "busy", label: "Busy — call later", icon: Clock, tone: "text-amber-600", next: "retry", taskTitle: "Call again", taskType: "call" },
  { key: "switched_off", label: "Switched off", icon: Power, tone: "text-orange-600", next: "retry", taskTitle: "Call again", taskType: "call" },
  { key: "wrong_number", label: "Wrong number", icon: Ban, tone: "text-slate-600", next: "close" },
  { key: "not_interested", label: "Not interested", icon: XCircle, tone: "text-rose-700", next: "close" },
];
const labelOf = (key: string) => OUTCOMES.find((item) => item.key === key)?.label || key;

const tomorrow = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export default function LeadCallOutcome({
  lead,
  canScheduleMeetingStage,
  update,
  onSaved,
}: {
  lead: any;
  canScheduleMeetingStage: boolean;
  update: (patch: any) => void | Promise<void>;
  onSaved?: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [calls, setCalls] = useState<any[]>([]);
  const [selected, setSelected] = useState<Outcome | null>(null);
  const [note, setNote] = useState("");
  const [date, setDate] = useState(tomorrow());
  const [time, setTime] = useState("10:00");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("b2g_activities" as any)
      .select("id,subject,description,outcome,created_at")
      .eq("lead_id", lead.id)
      .eq("activity_type", "call")
      .order("created_at", { ascending: false })
      .limit(30);
    setCalls((data as any[]) || []);
  };
  useEffect(() => {
    load();
  }, [lead.id]);

  const counts = calls.reduce((result: Record<string, number>, call) => {
    if (call.outcome) result[call.outcome] = (result[call.outcome] || 0) + 1;
    return result;
  }, {});
  const needsDate = selected && selected.next !== "close" && selected.next !== "none";

  const save = async () => {
    if (!selected) return;
    const due = new Date(`${date}T${time || "10:00"}`);
    if (needsDate && Number.isNaN(due.getTime())) {
      toast({ title: "Choose the next call date", variant: "destructive" });
      return;
    }
    setSaving(true);
    const activity = await supabase.from("b2g_activities" as any).insert({
      lead_id: lead.id,
      activity_type: "call",
      subject: `Call — ${selected.label}`,
      description: note.trim() || null,
      outcome: selected.key,
      created_by: user?.id,
    });
    if (activity.error) {
      setSaving(false);
      toast({ title: "Call not saved", description: activity.error.message, variant: "destructive" });
      return;
    }

    const patch: any = {};
    if (selected.next === "close") {
      patch.closed_at = lead.closed_at || new Date().toISOString();
      if (selected.key === "not_interested") {
        patch.lost_reason_code = "not_interested";
        patch.heat = "cold";
      } else {
        patch.lost_reason_code = "other";
        patch.lost_reason = "Wrong number";
      }
    } else {
      patch.next_follow_up_at = due.toISOString();
      if (selected.key === "spoke_follow_up" || selected.key === "meeting_scheduled") patch.last_contacted_at = new Date().toISOString();
      if (selected.key === "meeting_scheduled" && canScheduleMeetingStage) patch.stage = "meeting_scheduled";
      await supabase.from("b2g_tasks" as any).insert({
        lead_id: lead.id,
        title: `${selected.taskTitle} — ${lead.organization_name}`,
        description: note.trim() || `Last call: ${selected.label}`,
        task_type: selected.taskType,
        priority: selected.next === "retry" ? "medium" : "high",
        due_at: due.toISOString(),
        assigned_to: user?.id,
        created_by: user?.id,
      });
    }
    await update(patch);
    setSaving(false);
    setSelected(null);
    setNote("");
    setDate(tomorrow());
    setTime("10:00");
    await load();
    onSaved?.();
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <PhoneCall className="h-4 w-4" />
          <h2 className="font-bold">Call outcome</h2>
          {Object.entries(counts).map(([key, count]) => (
            <Badge key={key} variant="secondary">
              {labelOf(key)} ×{count}
            </Badge>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Log every call — even when nobody picks up. Not-picked-up and busy calls set the next call automatically.
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {OUTCOMES.map((outcome) => (
            <button
              key={outcome.key}
              type="button"
              onClick={() => setSelected(selected?.key === outcome.key ? null : outcome)}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors ${
                selected?.key === outcome.key ? "border-primary bg-primary/5" : "bg-slate-50 hover:bg-slate-100"
              }`}
            >
              <outcome.icon className={`h-4 w-4 ${outcome.tone}`} />
              {outcome.label}
            </button>
          ))}
        </div>

        {selected && (
          <div className="mt-4 space-y-3 rounded-xl border bg-white p-4">
            <p className="text-sm font-semibold">{selected.label}</p>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional) — what was said, when to try again…" />
            {needsDate && (
              <div className="grid grid-cols-[1fr_auto] gap-2 sm:max-w-sm">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    {selected.next === "meeting" ? "Meeting on" : "Next call on"}
                  </span>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Time</span>
                  <Input type="time" className="w-28" value={time} onChange={(e) => setTime(e.target.value)} />
                </label>
              </div>
            )}
            {selected.next === "close" && (
              <p className="text-xs text-muted-foreground">This moves the lead to “Not interested / Lost”. You can reopen it any time.</p>
            )}
            <div className="flex gap-2">
              <Button size="sm" disabled={saving} onClick={save}>
                {saving ? "Saving…" : "Save call"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {calls.length > 0 && (
          <div className="mt-5 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Recent calls</p>
            {calls.slice(0, 5).map((call) => (
              <div key={call.id} className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs">
                <div className="min-w-0">
                  <p className="font-medium">{call.subject?.replace("Call — ", "")}</p>
                  {call.description && <p className="mt-0.5 text-muted-foreground break-words">{call.description}</p>}
                </div>
                <span className="shrink-0 text-muted-foreground">{new Date(call.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
