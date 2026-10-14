/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import { useEffect, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Pencil,
  Plus,
  RotateCcw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import TaskEditDialog from "@/components/TaskEditDialog";

const tomorrow = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
};
const blank = () => ({
  title: "",
  assignee: "",
  other_person: "",
  due_date: tomorrow(),
  due_time: "10:00",
  escalation_level: "0",
});
const levelName = (level: number) =>
  ["Normal", "Level 1", "Level 2", "Critical"][Math.min(level, 3)] ||
  `Level ${level}`;

export default function LeadFollowUpManager({
  leadId,
  onChanged,
}: {
  leadId: string;
  onChanged?: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ ...blank(), assignee: user?.id || "" });
  const load = async () => {
    const [taskResult, profileResult] = await Promise.all([
      supabase
        .from("b2g_tasks" as any)
        .select("*")
        .eq("lead_id", leadId)
        .eq("task_type", "follow_up")
        .order("due_at", { ascending: false }),
      supabase.from("profiles").select("user_id,full_name"),
    ]);
    if (!taskResult.error) setTasks(taskResult.data || []);
    setTeam((profileResult.data as any[]) || []);
  };
  useEffect(() => {
    load();
  }, [leadId]);
  useEffect(() => {
    setForm((current) =>
      current.assignee ? current : { ...current, assignee: user?.id || "" },
    );
  }, [user?.id]);
  const isOther = form.assignee === "other";
  const create = async () => {
    const member = team.find((entry) => entry.user_id === form.assignee);
    const owner = isOther ? form.other_person.trim() : member?.full_name || "";
    const dueAt = new Date(`${form.due_date}T${form.due_time || "10:00"}`);
    if (Number.isNaN(dueAt.getTime())) {
      return toast({
        title: "Choose a valid due date",
        variant: "destructive",
      });
    }
    const { error } = await supabase.from("b2g_tasks" as any).insert({
      lead_id: leadId,
      task_type: "follow_up",
      title: form.title.trim(),
      responsible_person: owner,
      due_at: dueAt.toISOString(),
      escalation_level: Number(form.escalation_level),
      assigned_to: isOther ? user?.id : form.assignee || user?.id,
      created_by: user?.id,
    });
    if (error)
      return toast({
        title: "Follow-up not saved",
        description: error.message,
        variant: "destructive",
      });
    await supabase
      .from("b2g_leads" as any)
      .update({ next_follow_up_at: dueAt.toISOString() })
      .eq("id", leadId);
    setForm({ ...blank(), assignee: user?.id || "" });
    await load();
    onChanged?.();
    toast({ title: "Follow-up assigned" });
  };
  const toggle = async (task: any) => {
    const { error } = await supabase
      .from("b2g_tasks" as any)
      .update({
        completed_at: task.completed_at ? null : new Date().toISOString(),
      })
      .eq("id", task.id);
    if (error)
      return toast({
        title: "Status not updated",
        description: error.message,
        variant: "destructive",
      });
    await load();
  };
  const ready =
    form.title.trim() &&
    form.due_date &&
    form.assignee &&
    (!isOther || form.other_person.trim());
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4" />
          <h2 className="font-bold">Follow-up responsibility</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Write what has to be done, choose who will do it and when it is due.
          It appears in Tasks & reminders for that person.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              What is to be done
            </span>
            <Input
              placeholder="e.g. Send revised quotation"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              Assign to
            </span>
            <Select
              value={form.assignee}
              onValueChange={(v) => setForm({ ...form, assignee: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select team member" />
              </SelectTrigger>
              <SelectContent>
                {team.map((member) => (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    {member.full_name}
                    {member.user_id === user?.id ? " (me)" : ""}
                  </SelectItem>
                ))}
                {!team.some((member) => member.user_id === user?.id) && (
                  <SelectItem value={user?.id || "me"}>Me</SelectItem>
                )}
                <SelectItem value="other">Someone else…</SelectItem>
              </SelectContent>
            </Select>
            {isOther && (
              <Input
                placeholder="Person's name"
                value={form.other_person}
                onChange={(e) =>
                  setForm({ ...form, other_person: e.target.value })
                }
              />
            )}
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              Due date & time
            </span>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              />
              <Input
                type="time"
                className="w-28"
                value={form.due_time}
                onChange={(e) => setForm({ ...form, due_time: e.target.value })}
              />
            </div>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              Urgency
            </span>
            <Select
              value={form.escalation_level}
              onValueChange={(v) => setForm({ ...form, escalation_level: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0, 1, 2, 3].map((v) => (
                  <SelectItem key={v} value={String(v)}>
                    {levelName(v)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button size="sm" disabled={!ready} onClick={create}>
            <Plus className="mr-1 h-4 w-4" />
            Assign follow-up
          </Button>
          {!ready && (
            <span className="text-xs text-muted-foreground">
              Fill “What is to be done”, who will do it, and the due date.
            </span>
          )}
        </div>
        <div className="mt-5 space-y-2">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`rounded-xl border p-3 ${task.completed_at ? "bg-slate-50 opacity-70" : ""}`}
            >
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{task.title}</p>
                    <Badge
                      variant={task.completed_at ? "secondary" : "default"}
                    >
                      {task.completed_at ? "Completed" : "Open"}
                    </Badge>
                    <Badge variant="outline">
                      {levelName(task.escalation_level)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {task.responsible_person || "Owner not set"} ·{" "}
                    {new Date(task.due_at).toLocaleString("en-IN")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditing(task)}
                  >
                    <Pencil className="mr-1 h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggle(task)}
                  >
                    {task.completed_at ? (
                      <>
                        <RotateCcw className="mr-1 h-3.5 w-3.5" />
                        Reopen
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                        Mark complete
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {!tasks.length && (
            <p className="rounded-xl bg-slate-50 py-6 text-center text-sm text-muted-foreground">
              No follow-ups assigned yet.
            </p>
          )}
        </div>
      </CardContent>
      <TaskEditDialog
        task={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          load();
          onChanged?.();
        }}
      />
    </Card>
  );
}
