/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const TYPES = ['follow_up', 'call', 'meeting', 'email', 'whatsapp', 'document', 'payment', 'tender', 'other'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const nice = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const toLocalInput = (iso?: string | null) =>
  iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';

export default function TaskEditDialog({
  task,
  leads,
  onClose,
  onSaved,
}: {
  task: any | null;
  leads?: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [team, setTeam] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    lead_id: 'none',
    task_type: 'follow_up',
    priority: 'medium',
    due_at: '',
    status: 'open',
    assignee: 'none',
  });

  useEffect(() => {
    if (!task) return;
    setForm({
      title: task.title || '',
      description: task.description || '',
      lead_id: task.lead_id || 'none',
      task_type: task.task_type || 'follow_up',
      priority: task.priority || 'medium',
      due_at: toLocalInput(task.due_at),
      status: task.completed_at ? 'completed' : 'open',
      assignee: 'none',
    });
    supabase
      .from('profiles')
      .select('user_id,full_name')
      .then(({ data }) => setTeam((data as any[]) || []));
  }, [task?.id]);

  const save = async () => {
    if (!form.title.trim() || !form.due_at) {
      toast({ title: 'Title and due date are required', variant: 'destructive' });
      return;
    }
    const member = team.find((entry) => entry.user_id === form.assignee);
    setSaving(true);
    const { error } = await supabase
      .from('b2g_tasks' as any)
      .update({
        title: form.title.trim(),
        description: form.description.trim() || null,
        ...(leads ? { lead_id: form.lead_id === 'none' ? null : form.lead_id } : {}),
        task_type: form.task_type,
        priority: form.priority,
        due_at: new Date(form.due_at).toISOString(),
        completed_at: form.status === 'completed' ? task.completed_at || new Date().toISOString() : null,
        assigned_to: form.assignee === 'none' ? task.assigned_to : form.assignee,
        responsible_person: member?.full_name || task.responsible_person || null,
      })
      .eq('id', task.id);
    setSaving(false);
    if (error) {
      toast({ title: 'Task not updated', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Task updated' });
    onSaved();
    onClose();
  };

  return (
    <Dialog open={task !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit task</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">What needs to be done</span>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Details</span>
            <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
          {leads && (
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Client</span>
              <Select value={form.lead_id} onValueChange={(value) => setForm({ ...form, lead_id: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Internal (no client)</SelectItem>
                  {leads.map((lead) => (
                    <SelectItem key={lead.id} value={lead.id}>{lead.organization_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Type</span>
              <Select value={form.task_type} onValueChange={(value) => setForm({ ...form, task_type: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map((value) => <SelectItem key={value} value={value}>{nice(value)}</SelectItem>)}</SelectContent>
              </Select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Priority</span>
              <Select value={form.priority} onValueChange={(value) => setForm({ ...form, priority: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITIES.map((value) => <SelectItem key={value} value={value}>{nice(value)}</SelectItem>)}</SelectContent>
              </Select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Due date & time</span>
              <Input type="datetime-local" value={form.due_at} onChange={(e) => setForm({ ...form, due_at: e.target.value })} />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Status</span>
              <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Assigned to</span>
            <Select value={form.assignee} onValueChange={(value) => setForm({ ...form, assignee: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{task?.responsible_person ? `Keep ${task.responsible_person}` : 'Not changed'}</SelectItem>
                {team.map((member) => (
                  <SelectItem key={member.user_id} value={member.user_id}>{member.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save changes'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
