import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CalendarClock, Check, TriangleAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { deliverReminderNotification } from '@/lib/reminderNotifications';

const formatDate = (value: string) =>
  new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

export function NotificationBell({ iconClassName }: { iconClassName?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<any[]>([]);
  const [followups, setFollowups] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    let mounted = true;

    const load = async () => {
      const reminderWindow = new Date(Date.now() + 86_400_000).toISOString();
      const [taskResult, followupResult, notificationResult] = await Promise.all([
        supabase.from('b2g_tasks' as any).select('*,b2g_leads(organization_name)').is('completed_at', null).lte('due_at', reminderWindow).order('due_at').limit(12),
        supabase.from('b2g_leads' as any).select('id,organization_name,contact_name,next_follow_up_at,next_best_action').not('next_follow_up_at', 'is', null).is('closed_at', null).lte('next_follow_up_at', reminderWindow).order('next_follow_up_at').limit(12),
        supabase.from('b2g_notifications' as any).select('*').eq('user_id', user.id).is('read_at', null).order('created_at', { ascending: false }).limit(8),
      ]);

      if (!mounted) return;
      const upcomingTasks = taskResult.data || [];
      const upcomingFollowups = followupResult.data || [];
      setTasks(upcomingTasks);
      setFollowups(upcomingFollowups);
      setNotes(notificationResult.data || []);

      for (const task of upcomingTasks) {
        void deliverReminderNotification(user.id, `task:${task.id}:${task.due_at}`, `Task reminder: ${task.title}`, `${task.b2g_leads?.organization_name || 'Internal'} · ${formatDate(task.due_at)}${task.description ? ` · ${task.description}` : ''}`);
      }

      for (const lead of upcomingFollowups) {
        void deliverReminderNotification(user.id, `follow-up:${lead.id}:${lead.next_follow_up_at}`, `Follow-up reminder: ${lead.organization_name}`, `${lead.contact_name || 'Client follow-up'} · ${formatDate(lead.next_follow_up_at)}${lead.next_best_action ? ` · ${lead.next_best_action}` : ''}`);
      }
    };

    void load();
    const interval = window.setInterval(load, 60_000);
    window.addEventListener('tenderexpert:notification-preferences', load);
    return () => { mounted = false; window.clearInterval(interval); window.removeEventListener('tenderexpert:notification-preferences', load); };
  }, [user?.id]);

  const count = tasks.length + followups.length + notes.length;
  const completeTask = async (id: string) => { const { error } = await supabase.from('b2g_tasks' as any).update({ completed_at: new Date().toISOString() }).eq('id', id); if (!error) setTasks(current => current.filter(task => task.id !== id)); };

  return <Popover><PopoverTrigger asChild><button className="relative h-9 w-9 rounded-xl hover:bg-muted flex items-center justify-center"><Bell className={cn('h-5 w-5', iconClassName)}/>{count>0&&<span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 bg-rose-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center">{count>9?'9+':count}</span>}</button></PopoverTrigger><PopoverContent align="end" className="w-[min(22rem,calc(100vw-1.5rem))] p-0"><div className="p-4 border-b"><div className="flex justify-between"><h3 className="font-bold">Action centre</h3><Badge>{count}</Badge></div><p className="text-xs text-muted-foreground">Tasks and follow-ups due within one day</p></div><div className="max-h-96 overflow-auto p-2 space-y-2">{followups.map(lead=>{const overdue=new Date(lead.next_follow_up_at)<new Date();return <button key={lead.id} onClick={()=>navigate(`/leads/${lead.id}`)} className={`w-full p-3 rounded-xl text-left ${overdue?'bg-rose-50':'bg-violet-50'}`}><div className="flex gap-2"><CalendarClock className={`h-4 w-4 shrink-0 mt-0.5 ${overdue?'text-rose-600':'text-violet-600'}`}/><div><p className="text-sm font-semibold">Follow up: {lead.organization_name}</p><p className="text-xs text-muted-foreground">{lead.contact_name||'Client'} · {formatDate(lead.next_follow_up_at)}</p></div></div></button>})}{tasks.map(task=>{const overdue=new Date(task.due_at)<new Date();return <div key={task.id} className={`p-3 rounded-xl ${overdue?'bg-rose-50':'bg-slate-50'}`}><div className="flex gap-2"><div className={overdue?'text-rose-600':'text-primary'}>{overdue?<TriangleAlert className="h-4 w-4"/>:<CalendarClock className="h-4 w-4"/>}</div><div className="flex-1 min-w-0"><p className="text-sm font-semibold">{task.title}</p>{task.description&&<p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>}<p className="text-xs text-muted-foreground">{task.b2g_leads?.organization_name||'Internal'} · {formatDate(task.due_at)}</p></div><button onClick={()=>completeTask(task.id)}><Check className="h-4 w-4 text-emerald-600"/></button></div></div>})}{notes.map(note=><div key={note.id} className="p-3 rounded-xl bg-amber-50"><p className="text-sm font-semibold">{note.title}</p><p className="text-xs text-muted-foreground">{note.message}</p></div>)}{!count&&<p className="text-sm text-center text-muted-foreground py-8">You're all caught up.</p>}</div><div className="p-2 border-t"><Button variant="ghost" className="w-full" onClick={()=>navigate('/tasks')}>Open all tasks</Button></div></PopoverContent></Popover>;
}
