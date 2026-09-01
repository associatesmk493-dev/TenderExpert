/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ListChecks, Loader2, Mic, MicOff, Sparkles } from "lucide-react";

export default function LeadVoiceMeeting({
  leadId,
  organizationName,
  onSaved,
}: {
  leadId: string;
  organizationName: string;
  onSaved?: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [language, setLanguage] = useState("en-IN"),
    [projectId, setProjectId] = useState("general"),
    [projects, setProjects] = useState<any[]>([]),
    [listening, setListening] = useState(false),
    [text, setText] = useState(""),
    [interim, setInterim] = useState(""),
    [recent, setRecent] = useState<any[]>([]),
    [saving, setSaving] = useState(false),
    [summarizingId, setSummarizingId] = useState("");
  const recognition = useRef<any>();
  const finalText = useRef("");
  const started = useRef(0);
  const load = () =>
    Promise.all([
      supabase
        .from("b2g_client_meetings" as any)
        .select("*,b2g_projects(project_name)")
        .eq("lead_id", leadId)
        .order("meeting_at", { ascending: false })
        .limit(5),
      supabase
        .from("b2g_projects" as any)
        .select("id,project_name")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false }),
    ]).then(([meetings, orders]) => {
      setRecent(meetings.data || []);
      setProjects(orders.data || []);
    });
  useEffect(() => {
    load();
    return () => recognition.current?.abort?.();
  }, [leadId]);
  const start = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition)
      return toast({
        title: "Voice transcription unavailable",
        description: "Use Chrome or Edge and allow microphone access.",
        variant: "destructive",
      });
    finalText.current = "";
    setText("");
    setInterim("");
    started.current = Date.now();
    const instance = new SpeechRecognition();
    recognition.current = instance;
    instance.continuous = true;
    instance.interimResults = true;
    instance.lang = language;
    instance.onresult = (event: any) => {
      let current = "";
      for (
        let index = event.resultIndex;
        index < event.results.length;
        index++
      ) {
        const words = event.results[index][0].transcript;
        if (event.results[index].isFinal) finalText.current += `${words} `;
        else current += words;
      }
      setText(finalText.current.trim());
      setInterim(current);
    };
    instance.onend = () => setListening(false);
    instance.onerror = (event: any) => {
      setListening(false);
      toast({
        title: "Microphone stopped",
        description: event.error,
        variant: "destructive",
      });
    };
    instance.start();
    setListening(true);
  };
  const stop = async () => {
    recognition.current?.stop();
    setListening(false);
    const transcript = `${finalText.current} ${interim}`.trim();
    if (!transcript) return toast({ title: "No speech detected" });
    setSaving(true);
    const { error } = await supabase
      .from("b2g_client_meetings" as any)
      .insert({
        lead_id: leadId,
        project_id: projectId === "general" ? null : projectId,
        transcript,
        discussion_summary: null,
        language,
        duration_seconds: Math.round((Date.now() - started.current) / 1000),
        recorded_by: user?.id,
      });
    if (!error)
      await supabase
        .from("b2g_activities" as any)
        .insert({
          lead_id: leadId,
          activity_type: "meeting",
          subject: `Voice meeting — ${organizationName}${projectId === "general" ? "" : ` · ${projects.find((project) => project.id === projectId)?.project_name || "Order"}`}`,
          description: transcript,
          created_by: user?.id,
        });
    setSaving(false);
    if (error)
      toast({
        title: "Meeting not saved",
        description: error.message,
        variant: "destructive",
      });
    else {
      toast({ title: "Meeting saved to this lead" });
      setText("");
      setInterim("");
      load();
      onSaved?.();
    }
  };
  const summarize = async (meeting: any) => {
    setSummarizingId(meeting.id);
    const prompt = `Summarize this client meeting for a CRM. Return only concise bullet points under these headings when supported by the transcript: Discussion, Key requirements, Client commitments, Our commitments, Objection, Outcome, Next action, Decision deadline, Expected collection date. Do not invent information. Use the same language as the transcript.\n\nClient: ${organizationName}\nTranscript: ${meeting.transcript}`;
    const { data, error } = await supabase.functions.invoke("tenderexpert-ai", {
      body: { messages: [{ role: "user", content: prompt }] },
    });
    let summary = data?.answer?.trim();
    if (!summary) {
      const sentences = meeting.transcript
        .split(/[.!?।]+/)
        .map((item: string) => item.trim())
        .filter(Boolean)
        .slice(0, 8);
      summary = sentences.map((item: string) => `• ${item}`).join("\n");
    }
    if (!summary) {
      setSummarizingId("");
      return toast({
        title: "Summary could not be created",
        description: error?.message,
        variant: "destructive",
      });
    }
    const { error: saveError } = await supabase
      .from("b2g_client_meetings" as any)
      .update({ discussion_summary: summary })
      .eq("id", meeting.id);
    setSummarizingId("");
    if (saveError)
      toast({
        title: "Summary not saved",
        description: saveError.message,
        variant: "destructive",
      });
    else {
      toast({ title: error ? "Quick summary created" : "AI summary created" });
      load();
    }
  };
  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">Voice meeting record</h2>
          <p className="text-xs text-muted-foreground">
            Tap, speak and stop. Saved automatically against {organizationName}.
          </p>
        </div>
        <Select
          value={language}
          onValueChange={setLanguage}
          disabled={listening}
        >
          <SelectTrigger className="sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en-IN">English (India)</SelectItem>
            <SelectItem value="hi-IN">Hindi</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="py-6 text-center">
        <Button
          onClick={listening ? stop : start}
          disabled={saving}
          className={`h-20 w-20 rounded-full ${listening ? "bg-rose-600 hover:bg-rose-700 animate-pulse" : ""}`}
        >
          {listening ? (
            <MicOff className="h-8 w-8" />
          ) : (
            <Mic className="h-8 w-8" />
          )}
        </Button>
        <p className="text-sm font-semibold mt-3">
          {saving
            ? "Saving…"
            : listening
              ? "Listening — tap to save"
              : "Tap to record meeting"}
        </p>
      </div>
      {(text || interim) && (
        <div className="rounded-xl bg-slate-950 text-white p-4">
          <p className="text-xs text-cyan-300 flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            LIVE TRANSCRIPT
          </p>
          <p className="text-sm mt-2">
            {text} <span className="text-slate-400">{interim}</span>
          </p>
        </div>
      )}
      <div className="space-y-3 mt-4">
        {recent.map((row) => (
          <div key={row.id} className="rounded-xl border p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Meeting</Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(row.meeting_at).toLocaleString("en-IN")}
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={summarizingId === row.id}
                onClick={() => summarize(row)}
              >
                {summarizingId === row.id ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <ListChecks className="h-3.5 w-3.5 mr-1.5" />
                )}
                {row.discussion_summary &&
                row.discussion_summary !== row.transcript
                  ? "Regenerate"
                  : "Summarize"}
              </Button>
            </div>
            {row.discussion_summary &&
            row.discussion_summary !== row.transcript ? (
              <div className="mt-3 rounded-xl bg-cyan-50 border border-cyan-100 p-4">
                <p className="text-xs font-bold text-cyan-800 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  MEETING SUMMARY
                </p>
                <p className="text-sm mt-2 whitespace-pre-wrap leading-relaxed">
                  {row.discussion_summary}
                </p>
              </div>
            ) : (
              <details className="mt-3">
                <summary className="text-xs font-medium text-muted-foreground cursor-pointer">
                  Read full transcript
                </summary>
                <p className="text-sm mt-2 whitespace-pre-wrap">
                  {row.transcript}
                </p>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
