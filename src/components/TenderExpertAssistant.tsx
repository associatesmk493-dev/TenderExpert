import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AlertTriangle, Bot, CalendarClock, Check, ExternalLink, History, IndianRupee, Landmark, Loader2, MessageCircle, Plus, RotateCcw, Send, ShieldAlert, Sparkles, Trash2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type ToolEvent = {
  tool: string;
  status: 'succeeded' | 'failed' | 'confirmation_required' | 'duplicate';
  summary: string;
  link?: { label: string; url: string };
  action_id?: string;
  confirmation?: { reason: string; summary: string };
  invalidates?: string[];
};
type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string; tool_events?: ToolEvent[]; failed?: boolean };
type Conversation = { id: string; title: string; updated_at: string };
type ActionState = 'pending_confirmation' | 'succeeded' | 'failed' | 'cancelled' | 'expired' | 'confirmed' | 'started';
type PendingRequest = { requestId: string; text: string };

const quickPrompts = [
  { label: "Today's follow-ups", icon: CalendarClock, prompt: "Show my overdue and today's pending follow-up tasks with the lead names." },
  { label: 'Hot leads', icon: Sparkles, prompt: 'Which hot open leads need attention? Include next follow-up dates.' },
  { label: 'Outstanding payments', icon: IndianRupee, prompt: 'Show payment milestones with outstanding balance, earliest due first.' },
  { label: 'Tender deadlines', icon: Landmark, prompt: 'List tenders with upcoming submission deadlines.' },
];

const TOOL_LABEL: Record<string, string> = {
  search_business_data: 'Searching records', get_record: 'Reading a record', aggregate_business_data: 'Calculating totals',
  get_lead_context: 'Reviewing the lead', calculate_quote_options: 'Calculating prices', create_proposal_draft: 'Saving a draft proposal',
  update_lead: 'Updating the lead', create_task: 'Creating a task', mark_proposal_sent: 'Preparing to mark sent', delete_record: 'Preparing to delete',
};
const PROGRESS = ['Reading your CRM data…', 'Checking the records…', 'Working out the answer…'];
const newRequestId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

// Only same-app relative links are ever rendered as links.
const safeInternalPath = (url: string) => (/^\/[A-Za-z0-9/_\-.?=&]*$/.test(url) && !url.startsWith('//') ? url : null);

// Minimal, XSS-safe formatting: **bold** and "- " bullets. Everything is rendered as React text nodes.
function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>);
}
function FormattedText({ text }: { text: string }) {
  return <>{text.split('\n').map((line, i) => {
    const bullet = /^\s*[-•*]\s+(.*)$/.exec(line);
    if (bullet) return <div key={i} className="flex gap-2 pl-1"><span aria-hidden>•</span><span>{renderInline(bullet[1])}</span></div>;
    if (!line.trim()) return <div key={i} className="h-2" />;
    return <div key={i}>{renderInline(line)}</div>;
  })}</>;
}

async function callAssistant(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('ai-assistant', { body });
  if (error) {
    let message = 'The assistant is unavailable. Please try again.';
    let code: string | undefined;
    try {
      const res = (error as { context?: Response }).context;
      if (res) { const j = await res.json(); message = j.error || message; code = j.code; }
    } catch { /* keep default */ }
    throw Object.assign(new Error(message), { code });
  }
  return data as { conversation_id: string; message: { id: string; content: string; tool_events?: ToolEvent[] }; event?: ToolEvent };
}

export function ChatAssistantPanel({ className, onClose }: { className?: string; onClose?: () => void }) {
  const location = useLocation();
  const leadId = useMemo(() => /^\/leads\/([0-9a-f-]{36})(?:\/|$)/i.exec(location.pathname)?.[1], [location.pathname]);
  const [conversationId, setConversationId] = useState<string | null>(() => { try { return sessionStorage.getItem('ai-conversation'); } catch { return null; } });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [history, setHistory] = useState<Conversation[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [actionStates, setActionStates] = useState<Record<string, ActionState>>({});
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<{ message: string; retry?: PendingRequest } | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, loading, error]);
  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setProgress((p) => (p + 1) % PROGRESS.length), 2500);
    return () => clearInterval(t);
  }, [loading]);

  const loadHistory = useCallback(async () => {
    const { data } = await supabase.from('ai_conversations' as never).select('id,title,updated_at').order('updated_at', { ascending: false }).limit(30);
    setHistory((data as unknown as Conversation[]) || []);
  }, []);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  const openConversation = useCallback(async (id: string | null) => {
    setError(null); setShowHistory(false);
    setConversationId(id);
    try { if (id) sessionStorage.setItem('ai-conversation', id); else sessionStorage.removeItem('ai-conversation'); } catch { /* ignore */ }
    if (!id) { setMessages([]); return; }
    const { data } = await supabase.from('ai_messages' as never).select('id,role,content,tool_events').eq('conversation_id', id).order('created_at').limit(200);
    const rows = ((data as unknown as ChatMessage[]) || []).map((m) => ({ ...m, tool_events: m.tool_events || [] }));
    setMessages(rows);
    // Staged actions may have been resolved since; read their current state so stale buttons never show.
    const ids = rows.flatMap((m) => (m.tool_events || []).filter((e) => e.status === 'confirmation_required' && e.action_id).map((e) => e.action_id as string));
    if (ids.length) {
      const { data: acts } = await supabase.from('ai_action_log' as never).select('id,status').in('id', ids);
      setActionStates(Object.fromEntries(((acts as unknown as { id: string; status: ActionState }[]) || []).map((a) => [a.id, a.status])));
    }
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (conversationId) openConversation(conversationId); }, []);

  const announceChanges = (events: ToolEvent[]) => {
    if (events.some((e) => e.status === 'succeeded' && e.invalidates?.length)) window.dispatchEvent(new CustomEvent('ai-assistant:data-changed'));
  };

  const send = async (text = input, retry?: PendingRequest) => {
    const question = (retry?.text ?? text).trim();
    if (!question || loading) return;
    const requestId = retry?.requestId ?? newRequestId();
    setError(null); setLoading(true); setProgress(0);
    if (!retry) { setMessages((m) => [...m, { id: `local-${requestId}`, role: 'user', content: question }]); setInput(''); }
    try {
      const data = await callAssistant({ conversation_id: conversationId ?? undefined, message: question, request_id: requestId, context: leadId ? { lead_id: leadId } : undefined });
      if (!conversationId) { setConversationId(data.conversation_id); try { sessionStorage.setItem('ai-conversation', data.conversation_id); } catch { /* ignore */ } }
      const events = data.message.tool_events || [];
      setMessages((m) => [...m, { id: data.message.id, role: 'assistant', content: data.message.content, tool_events: events }]);
      announceChanges(events);
      loadHistory();
    } catch (e) {
      const err = e as Error & { code?: string };
      setError({ message: err.code === 'AUTH_EXPIRED' ? 'Your session expired. Please sign in again.' : err.message, retry: err.code === 'AUTH_EXPIRED' || err.code === 'AI_KEY_NOT_CONFIGURED' ? undefined : { requestId, text: question } });
    } finally { setLoading(false); }
  };

  const resolve = async (event: ToolEvent, decision: 'confirm' | 'cancel') => {
    if (!event.action_id || !conversationId || busyAction) return;
    setBusyAction(event.action_id); setError(null);
    try {
      const data = await callAssistant({ conversation_id: conversationId, request_id: newRequestId(), confirm: { action_id: event.action_id, decision } });
      const result = data.event;
      setActionStates((s) => ({ ...s, [event.action_id as string]: decision === 'cancel' ? 'cancelled' : result?.status === 'failed' ? 'failed' : 'succeeded' }));
      setMessages((m) => [...m, { id: data.message.id, role: 'assistant', content: data.message.content, tool_events: data.message.tool_events || [] }]);
      if (result) announceChanges([result]);
    } catch (e) { setError({ message: (e as Error).message }); }
    finally { setBusyAction(null); }
  };

  const deleteConversation = async (id: string) => {
    await supabase.from('ai_conversations' as never).delete().eq('id', id);
    if (id === conversationId) openConversation(null);
    loadHistory();
  };

  const EventChips = ({ events }: { events: ToolEvent[] }) => <div className="mt-2 space-y-1.5">{events.map((e, i) => {
    const link = e.link && safeInternalPath(e.link.url);
    if (e.status === 'confirmation_required' && e.action_id) {
      const state = actionStates[e.action_id] ?? 'pending_confirmation';
      return <div key={i} className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
        <p className="flex items-center gap-1.5 font-semibold"><ShieldAlert className="h-3.5 w-3.5"/>Approval needed</p>
        <p className="mt-1">{e.confirmation?.summary}</p><p className="mt-0.5 text-amber-800">{e.confirmation?.reason}</p>
        {state === 'pending_confirmation' ? <div className="mt-2 flex gap-2">
          <Button size="sm" className="h-8" disabled={!!busyAction} onClick={() => resolve(e, 'confirm')}>{busyAction === e.action_id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin"/> : <Check className="mr-1 h-3.5 w-3.5"/>}Confirm</Button>
          <Button size="sm" variant="outline" className="h-8" disabled={!!busyAction} onClick={() => resolve(e, 'cancel')}>Cancel</Button>
        </div> : <p className="mt-2 font-medium">Status: {state.replace('_', ' ')}</p>}
      </div>;
    }
    return <div key={i} className={cn('flex flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1 text-xs', e.status === 'failed' ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-900')}>
      {e.status === 'failed' ? <AlertTriangle className="h-3 w-3"/> : <Check className="h-3 w-3"/>}
      <span className="min-w-0 break-words">{e.summary}</span>
      {link && <Link to={link} className="inline-flex items-center gap-0.5 font-medium underline"><ExternalLink className="h-3 w-3"/>{e.link?.label || 'Open'}</Link>}
    </div>;
  })}</div>;

  const visibleEvents = (m: ChatMessage) => (m.tool_events || []).filter((e) => e.status !== 'succeeded' || e.link || e.invalidates?.length);

  return <section className={cn('flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border bg-background shadow-xl', className)}>
    <header className="flex shrink-0 items-center justify-between border-b bg-primary px-4 py-3 text-primary-foreground">
      <div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15"><Bot className="h-5 w-5"/></div>
        <div className="min-w-0"><h2 className="truncate font-semibold">TenderExpert AI</h2><p className="truncate text-xs text-white/80">{leadId ? 'Working on the open lead' : 'B2G business assistant'}</p></div></div>
      <div className="flex items-center gap-1">
        <Button size="icon" variant="ghost" aria-label="New chat" className="h-8 w-8 text-white hover:bg-white/15 hover:text-white" onClick={() => openConversation(null)}><Plus className="h-4 w-4"/></Button>
        <Button size="icon" variant="ghost" aria-label="Conversation history" className="h-8 w-8 text-white hover:bg-white/15 hover:text-white" onClick={() => { setShowHistory((v) => !v); loadHistory(); }}><History className="h-4 w-4"/></Button>
        {onClose && <Button size="icon" variant="ghost" aria-label="Close" className="h-8 w-8 text-white hover:bg-white/15 hover:text-white" onClick={onClose}><X className="h-4 w-4"/></Button>}
      </div>
    </header>

    {showHistory ? <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent conversations</p>
      {!history.length && <p className="text-sm text-muted-foreground">No conversations yet.</p>}
      {history.map((c) => <div key={c.id} className={cn('mb-1.5 flex items-center gap-2 rounded-xl border bg-white p-2.5', c.id === conversationId && 'border-primary')}>
        <button className="min-w-0 flex-1 text-left" onClick={() => openConversation(c.id)}><p className="truncate text-sm font-medium">{c.title}</p><p className="text-xs text-muted-foreground">{new Date(c.updated_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p></button>
        <Button size="icon" variant="ghost" aria-label="Delete conversation" className="h-8 w-8 shrink-0" onClick={() => deleteConversation(c.id)}><Trash2 className="h-4 w-4"/></Button>
      </div>)}
    </div> : <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50/70 px-4 py-4">
      {!messages.length && <div className="rounded-2xl border bg-white p-4 text-sm shadow-sm"><p className="font-medium">Namaste! Ask me about your leads, follow-ups, payments, tenders and proposals.</p><p className="mt-1 text-muted-foreground">I can summarise a lead, find overdue follow-ups, work out quote options, save draft proposals and create tasks. I never send anything to clients.</p></div>}
      {messages.map((m) => <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
        <div className={cn('max-w-[90%] break-words rounded-2xl px-4 py-3 text-sm leading-relaxed', m.role === 'user' ? 'whitespace-pre-wrap rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md border bg-white text-foreground shadow-sm')}>
          {m.role === 'user' ? m.content : <FormattedText text={m.content} />}
          {m.role === 'assistant' && <EventChips events={visibleEvents(m)} />}
        </div>
      </div>)}
      {loading && <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin"/>{PROGRESS[progress]}</div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900" role="alert">
        <p className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/>{error.message}</p>
        {error.retry && <Button size="sm" variant="outline" className="mt-2 h-8" onClick={() => send('', error.retry)}><RotateCcw className="mr-1 h-3.5 w-3.5"/>Retry</Button>}
      </div>}
    </div>}

    {!showHistory && messages.length === 0 && <div className="grid shrink-0 grid-cols-2 gap-2 border-t bg-background p-3">{quickPrompts.map(({ label, icon: Icon, prompt }) =>
      <button key={label} onClick={() => send(prompt)} disabled={loading} className="flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-xs hover:bg-primary/5"><Icon className="h-3.5 w-3.5 shrink-0 text-primary"/><span className="truncate">{label}</span></button>)}</div>}
    {leadId && <div className="shrink-0 border-t bg-background px-3 pt-2"><Badge variant="secondary" className="text-[11px]">Context: open lead</Badge></div>}
    <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex shrink-0 gap-2 border-t bg-background p-3">
      <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about leads, quotes, tasks…" className="h-11 min-w-0 flex-1 rounded-xl border bg-white px-3 text-sm outline-none focus:border-primary" maxLength={4000} aria-label="Message"/>
      <Button type="submit" size="icon" aria-label="Send" className="h-11 w-11 shrink-0 rounded-xl" disabled={!input.trim() || loading}><Send className="h-4 w-4"/></Button>
    </form>
  </section>;
}

export default function TenderExpertAssistant() {
  const [open, setOpen] = useState(false);
  return <>
    {open && <div className="fixed bottom-[calc(9.25rem+env(safe-area-inset-bottom,0px))] left-3 right-3 z-40 h-[min(68dvh,620px)] md:bottom-24 md:left-auto md:right-6 md:w-[420px]"><ChatAssistantPanel onClose={() => setOpen(false)} /></div>}
    <Button size="icon" aria-label={open ? 'Close AI assistant' : 'Open AI assistant'} onClick={() => setOpen((value) => !value)} className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom,0px))] right-4 z-40 h-14 w-14 rounded-2xl shadow-lg md:bottom-6 md:right-6">{open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}</Button>
  </>;
}
