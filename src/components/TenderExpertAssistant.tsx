import { useEffect, useRef, useState } from 'react';
import { Bot, CalendarClock, IndianRupee, Landmark, MessageCircle, Send, Sparkles, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type ChatMessage = { role: 'user' | 'assistant'; content: string };
type CrmSnapshot = { leads: any[]; tasks: any[]; payments: any[]; tenders: any[]; proposals: any[] };

const formatMoney = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
const quickPrompts = [
  { label: "Today's follow-ups", icon: CalendarClock, prompt: "Show today's follow-ups and overdue tasks with the next action." },
  { label: 'Hot leads', icon: Sparkles, prompt: 'Which leads are hot and should I prioritize today?' },
  { label: 'Outstanding payments', icon: IndianRupee, prompt: 'Show outstanding payments, overdue collections and balance due.' },
  { label: 'Tender opportunities', icon: Landmark, prompt: 'Summarize current tender opportunities and approaching deadlines.' },
];

const initialMessage: ChatMessage = {
  role: 'assistant',
  content: 'Namaste! I am TenderExpert AI. Ask me about hot leads, follow-ups, payments, tender deadlines, proposals, or request a WhatsApp/email draft.',
};

async function getSnapshot(): Promise<CrmSnapshot> {
  const [leads, tasks, payments, tenders, proposals] = await Promise.all([
    supabase.from('b2g_leads' as any).select('organization_name,contact_name,pipeline,stage,heat,ai_score,proposal_value,expected_revenue,next_follow_up_at,next_best_action').order('ai_score', { ascending: false }).limit(20),
    supabase.from('b2g_tasks' as any).select('title,priority,due_at,completed_at,b2g_leads(organization_name)').is('completed_at', null).order('due_at').limit(15),
    supabase.from('b2g_payment_milestones' as any).select('milestone_name,amount,gst_amount,amount_received,due_date,status,b2g_projects(project_name)').order('due_date').limit(20),
    supabase.from('tender_opportunities' as any).select('tender_title,authority_name,submission_deadline,go_no_go,match_score').order('submission_deadline').limit(10),
    supabase.from('b2g_proposals' as any).select('proposal_number,subject,subtotal,gst_amount,status,b2g_leads(organization_name)').order('created_at', { ascending: false }).limit(10),
  ]);
  return { leads: leads.data || [], tasks: tasks.data || [], payments: payments.data || [], tenders: tenders.data || [], proposals: proposals.data || [] };
}

function localResponse(question: string, data: CrmSnapshot) {
  const query = question.toLowerCase();
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  if (/whatsapp|email|draft|message/.test(query)) {
    const lead = data.leads.find(item => item.heat === 'hot') || data.leads[0];
    if (!lead) return 'Please add a lead first. I can then prepare a client-specific WhatsApp or email follow-up draft.';
    return `Draft for ${lead.organization_name}:\n\nDear ${lead.contact_name},\n\nFollowing up regarding your government business / approval requirements. Please share a convenient time to discuss the next steps and pending documentation.\n\nRegards,\nTenderExpert`;
  }

  if (/payment|collection|outstanding|balance|revenue|gst|advance/.test(query)) {
    const open = data.payments.filter(item => Number(item.amount) + Number(item.gst_amount) > Number(item.amount_received));
    if (!open.length) return 'There are currently no outstanding payment milestones in the CRM.';
    const total = open.reduce((sum, item) => sum + Number(item.amount) + Number(item.gst_amount) - Number(item.amount_received), 0);
    const lines = open.slice(0, 5).map(item => `• ${item.b2g_projects?.project_name || 'Project'} — ${item.milestone_name}: ${formatMoney(Number(item.amount) + Number(item.gst_amount) - Number(item.amount_received))}${item.due_date ? ` · Due ${new Date(item.due_date).toLocaleDateString('en-IN')}` : ''}`);
    return `Outstanding collections: ${formatMoney(total)} across ${open.length} milestone(s).\n\n${lines.join('\n')}\n\nNext action: follow up first on the earliest due payment.`;
  }

  if (/tender|bid|deadline|go.?no.?go/.test(query)) {
    if (!data.tenders.length) return 'No tender opportunities have been added yet. Create a tender to track authority, deadline, fit score and Go / No-Go decisions.';
    return `Tender opportunities: ${data.tenders.length}\n\n${data.tenders.slice(0, 5).map(item => `• ${item.tender_title} — ${item.authority_name}${item.submission_deadline ? ` · ${new Date(item.submission_deadline).toLocaleDateString('en-IN')}` : ''} · ${item.go_no_go}`).join('\n')}`;
  }

  if (/follow.?up|task|today|overdue|reminder|pending/.test(query)) {
    const followups = data.leads.filter(item => item.next_follow_up_at?.slice(0, 10) <= today);
    const urgent = data.tasks.filter(item => item.due_at?.slice(0, 10) <= today);
    if (!followups.length && !urgent.length) return 'There are no pending or overdue follow-ups for today. Review hot leads and schedule the next decision-maker conversations.';
    const lines = [...followups.slice(0, 4).map(item => `• ${item.organization_name}: ${item.next_best_action || 'Follow up with the decision-maker'}`), ...urgent.slice(0, 4).map(item => `• ${item.title} — ${item.b2g_leads?.organization_name || 'Internal'} (${item.priority})`)];
    return `${followups.length} lead follow-up(s) and ${urgent.length} task(s) need attention.\n\n${lines.join('\n')}`;
  }

  if (/proposal|quotation|quote/.test(query)) {
    if (!data.proposals.length) return 'No proposals have been created yet. Use the Proposals section to generate a quotation from the Brand Approval, Government Business Development or Tender Consultancy templates.';
    return `Recent proposals:\n\n${data.proposals.slice(0, 5).map(item => `• ${item.b2g_leads?.organization_name || 'Client'} — ${item.proposal_number}: ${formatMoney(Number(item.subtotal) + Number(item.gst_amount))} · ${item.status}`).join('\n')}`;
  }

  const hot = data.leads.filter(item => item.heat === 'hot');
  if (!data.leads.length) return 'Your CRM does not have any leads yet. Add a lead first and I can identify hot opportunities, follow-ups, expected revenue and next actions.';
  return `${data.leads.length} opportunities in CRM, including ${hot.length} hot lead(s).\n\n${(hot.length ? hot : data.leads).slice(0, 5).map(item => `• ${item.organization_name}: score ${item.ai_score}, ${formatMoney(Number(item.proposal_value))}${item.next_best_action ? ` · ${item.next_best_action}` : ''}`).join('\n')}\n\nAsk me for follow-ups, outstanding payments, proposals or tender deadlines.`;
}

export function ChatAssistantPanel({ className, onClose }: { className?: string; onClose?: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([initialMessage]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [liveMode, setLiveMode] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, loading]);

  const send = async (text = input) => {
    const question = text.trim();
    if (!question || loading) return;
    const history = [...messages, { role: 'user' as const, content: question }];
    setMessages(history); setInput(''); setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('tenderexpert-ai', { body: { messages: history.slice(-12) } });
      if (error || !data?.answer) throw error || new Error('AI is not configured');
      setLiveMode(true);
      setMessages(current => [...current, { role: 'assistant', content: String(data.answer) }]);
    } catch {
      try {
        const snapshot = await getSnapshot();
        setMessages(current => [...current, { role: 'assistant', content: localResponse(question, snapshot) }]);
      } catch {
        setMessages(current => [...current, { role: 'assistant', content: 'CRM data is temporarily unavailable. Please verify your connection and try again.' }]);
      }
    } finally { setLoading(false); }
  };

  return <section className={cn('flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border bg-background shadow-xl', className)}>
    <header className="flex shrink-0 items-center justify-between border-b bg-primary px-4 py-3 text-primary-foreground"><div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15"><Bot className="h-5 w-5"/></div><div className="min-w-0"><h2 className="truncate font-semibold">TenderExpert AI</h2><p className="truncate text-xs text-white/80">B2G business assistant</p></div></div><div className="flex items-center gap-2"><Badge className="border-0 bg-white/15 text-white">{liveMode ? 'Live AI' : 'CRM assistant'}</Badge>{onClose&&<Button size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-white/15 hover:text-white" onClick={onClose}><X className="h-4 w-4"/></Button>}</div></header>
    <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50/70 px-4 py-4">{messages.map((message,index)=><div key={`${index}-${message.role}`} className={cn('flex',message.role==='user'?'justify-end':'justify-start')}><div className={cn('max-w-[88%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-relaxed',message.role==='user'?'rounded-br-md bg-primary text-primary-foreground':'rounded-bl-md border bg-white text-foreground shadow-sm')}>{message.content}</div></div>)}{loading&&<div className="flex items-center gap-2 text-sm text-muted-foreground"><Bot className="h-4 w-4 animate-pulse"/>Analyzing your CRM data…</div>}</div>
    {messages.length<3&&<div className="grid shrink-0 grid-cols-2 gap-2 border-t bg-background p-3">{quickPrompts.map(({label,icon:Icon,prompt})=><button key={label} onClick={()=>send(prompt)} disabled={loading} className="flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-xs hover:bg-primary/5"><Icon className="h-3.5 w-3.5 shrink-0 text-primary"/><span className="truncate">{label}</span></button>)}</div>}
    <form onSubmit={event=>{event.preventDefault();send()}} className="flex shrink-0 gap-2 border-t bg-background p-3"><input value={input} onChange={event=>setInput(event.target.value)} placeholder="Ask about leads, payments, tenders…" className="h-11 min-w-0 flex-1 rounded-xl border bg-white px-3 text-sm outline-none focus:border-primary" maxLength={4000}/><Button type="submit" size="icon" className="h-11 w-11 shrink-0 rounded-xl" disabled={!input.trim()||loading}><Send className="h-4 w-4"/></Button></form>
  </section>;
}

export default function TenderExpertAssistant() {
  const [open, setOpen] = useState(false);
  return <>
    {open&&<div className="fixed bottom-[9.25rem] left-3 right-3 z-40 h-[min(68dvh,620px)] md:bottom-24 md:left-auto md:right-6 md:w-[420px]"><ChatAssistantPanel onClose={()=>setOpen(false)}/></div>}
    <Button size="icon" aria-label={open?'Close AI assistant':'Open AI assistant'} onClick={()=>setOpen(value=>!value)} className="fixed bottom-24 right-4 z-40 h-14 w-14 rounded-2xl shadow-lg md:bottom-6 md:right-6">{open?<X className="h-5 w-5"/>:<MessageCircle className="h-5 w-5"/>}</Button>
  </>;
}
