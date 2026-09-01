/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import { useEffect, useState } from "react";
import { CalendarClock, CheckCircle2, Plus, RotateCcw } from "lucide-react";
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

const blank = {
  title: "",
  responsible_person: "",
  due_at: "",
  escalation_level: "0",
};
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
  const [form, setForm] = useState(blank);
  const load = async () => {
    const { data, error } = await supabase
      .from("b2g_tasks" as any)
      .select("*")
      .eq("lead_id", leadId)
      .eq("task_type", "follow_up")
      .order("due_at", { ascending: false });
    if (!error) setTasks(data || []);
  };
  useEffect(() => {
    load();
  }, [leadId]);
  const create = async () => {
    const { error } = await supabase
      .from("b2g_tasks" as any)
      .insert({
        lead_id: leadId,
        task_type: "follow_up",
        title: form.title,
        responsible_person: form.responsible_person,
        due_at: form.due_at,
        escalation_level: Number(form.escalation_level),
        assigned_to: user?.id,
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
      .update({ next_follow_up_at: form.due_at })
      .eq("id", leadId);
    setForm(blank);
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
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4" />
          <h2 className="font-bold">Follow-up responsibility</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Complete record of ownership, due dates, escalation and completion
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            placeholder="Next action / follow-up"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <Input
            placeholder="Responsible person"
            value={form.responsible_person}
            onChange={(e) =>
              setForm({ ...form, responsible_person: e.target.value })
            }
          />
          <Input
            type="datetime-local"
            value={form.due_at}
            onChange={(e) => setForm({ ...form, due_at: e.target.value })}
          />
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
        </div>
        <Button
          className="mt-3"
          size="sm"
          disabled={!form.title || !form.responsible_person || !form.due_at}
          onClick={create}
        >
          <Plus className="mr-1 h-4 w-4" />
          Assign follow-up
        </Button>
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
          ))}
          {!tasks.length && (
            <p className="rounded-xl bg-slate-50 py-6 text-center text-sm text-muted-foreground">
              No follow-ups assigned yet.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
