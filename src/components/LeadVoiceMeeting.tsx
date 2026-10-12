/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ListChecks, Loader2, Mic, MicOff, Save, Sparkles } from "lucide-react";
import { SPEECH_LANGUAGES, useSpeechToText } from "@/hooks/useSpeechToText";

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
    [projectId] = useState("general"),
    [projects, setProjects] = useState<any[]>([]),
    [draft, setDraft] = useState(""),
    [recent, setRecent] = useState<any[]>([]),
    [saving, setSaving] = useState(false),
    [summarizingId, setSummarizingId] = useState("");
  const baseText = useRef("");
  const started = useRef(0);
  const speech = useSpeechToText(language, (message) =>
    toast({
      title: "Voice typing",
      description: message,
      variant: "destructive",
    }),
  );
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
  }, [leadId]);

  // While listening, show what is being spoken right inside the text box.
  useEffect(() => {
    if (!speech.listening) return;
    const dictated = `${speech.text} ${speech.interim}`.trim();
    setDraft(
      [baseText.current, dictated].filter(Boolean).join("\n"),
    );
  }, [speech.listening, speech.text, speech.interim]);

  const toggle = async () => {
    if (speech.listening) {
      const spoken = speech.stop();
      setDraft([baseText.current, spoken].filter(Boolean).join("\n"));
      speech.reset();
      return;
    }
    baseText.current = draft.trim();
    started.current = Date.now();
    await speech.start();
  };

  const save = async () => {
    const transcript = draft.trim();
    if (!transcript) return toast({ title: "Nothing to save yet" });
    setSaving(true);
    const duration = started.current
      ? Math.round((Date.now() - started.current) / 1000)
      : 0;
    const { error } = await supabase.from("b2g_client_meetings" as any).insert({
      lead_id: leadId,
      project_id: projectId === "general" ? null : projectId,
      transcript,
      discussion_summary: null,
      language,
      duration_seconds: duration,
      recorded_by: user?.id,
    });
    if (!error)
      await supabase.from("b2g_activities" as any).insert({
        lead_id: leadId,
        activity_type: "meeting",
        subject: `Meeting record — ${organizationName}${projectId === "general" ? "" : ` · ${projects.find((project) => project.id === projectId)?.project_name || "Order"}`}`,
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
      setDraft("");
      baseText.current = "";
      started.current = 0;
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
          <h2 className="font-bold">Meeting record — voice or typed</h2>
          <p className="text-xs text-muted-foreground">
            Tap the mic and speak (speech-to-text), or type. Check the text,
            then save it against {organizationName}.
          </p>
        </div>
        <Select
          value={language}
          onValueChange={setLanguage}
          disabled={speech.listening}
        >
          <SelectTrigger className="sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SPEECH_LANGUAGES.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="py-5 text-center">
        <Button
          onClick={toggle}
          disabled={saving}
          className={`h-20 w-20 rounded-full ${speech.listening ? "bg-rose-600 hover:bg-rose-700 animate-pulse" : ""}`}
          aria-label={speech.listening ? "Stop recording" : "Start recording"}
        >
          {speech.listening ? (
            <MicOff className="h-8 w-8" />
          ) : (
            <Mic className="h-8 w-8" />
          )}
        </Button>
        <p className="text-sm font-semibold mt-3">
          {saving
            ? "Saving…"
            : speech.listening
              ? "Listening — tap to stop"
              : "Tap to speak"}
        </p>
        {!speech.supported && (
          <p className="mx-auto mt-2 max-w-md text-xs text-amber-700">
            Voice typing works in Google Chrome or Microsoft Edge. In this
            browser you can type the meeting notes below.
          </p>
        )}
      </div>
      <div className="space-y-2">
        {speech.listening && (
          <p className="flex items-center gap-1 text-xs text-cyan-700">
            <Sparkles className="h-3 w-3" />
            LIVE SPEECH-TO-TEXT
          </p>
        )}
        <Textarea
          rows={5}
          value={draft}
          disabled={speech.listening}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Your spoken words appear here. You can also type or correct the text before saving."
        />
        <div className="flex flex-wrap justify-end gap-2">
          {draft && !speech.listening && (
            <Button variant="ghost" size="sm" onClick={() => setDraft("")}>
              Clear
            </Button>
          )}
          <Button
            size="sm"
            disabled={saving || speech.listening || !draft.trim()}
            onClick={save}
          >
            <Save className="mr-1.5 h-4 w-4" />
            Save meeting
          </Button>
        </div>
      </div>
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
