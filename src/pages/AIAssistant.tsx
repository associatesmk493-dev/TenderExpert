import { Sparkles } from 'lucide-react';
import { ChatAssistantPanel } from '@/components/TenderExpertAssistant';

export default function AIAssistant() {
  return <div className="min-h-full bg-slate-50/60 p-4 pb-28 md:p-7"><div className="mx-auto max-w-4xl"><div className="mb-5"><p className="flex items-center gap-2 text-xs font-bold tracking-wider text-primary"><Sparkles className="h-4 w-4"/>B2G INTELLIGENCE</p><h1 className="mt-2 text-2xl font-bold sm:text-3xl">AI Business Assistant</h1><p className="mt-1 text-sm text-muted-foreground">Ask about opportunities, follow-ups, collections, proposals and tender readiness.</p></div><ChatAssistantPanel className="h-[min(70dvh,720px)]"/></div></div>;
}
