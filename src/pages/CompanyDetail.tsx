/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Building2, IndianRupee, Target } from "lucide-react";
const money = (v: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(v || 0);
const nice = (v: string) =>
  v?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
export default function CompanyDetail() {
  const { id } = useParams(),
    nav = useNavigate();
  const [company, setCompany] = useState<any>(),
    [leads, setLeads] = useState<any[]>([]),
    [projects, setProjects] = useState<any[]>([]),
    [insights, setInsights] = useState<any[]>([]);
  useEffect(() => {
    Promise.all([
      supabase
        .from("company_rollup" as any)
        .select("*")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("b2g_leads" as any)
        .select("*")
        .eq("company_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("b2g_projects" as any)
        .select("*,b2g_leads!inner(company_id)")
        .eq("b2g_leads.company_id", id),
      supabase
        .from("b2g_ai_insights" as any)
        .select("*")
        .eq("company_id", id),
    ]).then(([c, l, p, i]) => {
      setCompany(c.data);
      setLeads(l.data || []);
      setProjects(p.data || []);
      setInsights(i.data || []);
    });
  }, [id]);
  if (!company) return <div className="p-7">Loading company…</div>;
  return (
    <div className="min-h-full bg-slate-50/60 p-4 md:p-7 space-y-5">
      <Button variant="ghost" onClick={() => nav("/clients")}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Clients
      </Button>
      <Card
        className="border-0 !bg-slate-950 text-white shadow-lg"
        style={{ background: "linear-gradient(135deg, #0f172a 0%, #172554 100%)" }}
      >
        <CardContent className="p-6">
          <div className="flex gap-4">
            <Building2 className="h-12 w-12 p-3 rounded-xl bg-white/10" />
            <div>
              <h1 className="text-2xl font-bold">{company.name}</h1>
              <p className="text-slate-400">
                {company.industry || "Industry not set"}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <V l="Opportunities" v={company.opportunity_count} />
            <V
              l="Weighted pipeline"
              v={money(company.total_expected_revenue)}
            />
            <V l="Outstanding" v={money(company.outstanding_amount)} />
            <V l="Won" v={company.won_opportunity_count} />
          </div>
        </CardContent>
      </Card>
      <div className="grid xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-3">
          <h2 className="font-bold">Opportunity history</h2>
          {leads.map((l) => (
            <Card
              key={l.id}
              onClick={() => nav(`/leads/${l.id}`)}
              className="border-0 shadow-sm cursor-pointer"
            >
              <CardContent className="p-4 flex items-center gap-3">
                <Target className="text-primary" />
                <div className="flex-1">
                  <p className="font-semibold">{nice(l.pipeline)}</p>
                  <p className="text-xs text-muted-foreground">
                    {nice(l.stage)}
                  </p>
                </div>
                <strong>{money(l.proposal_value)}</strong>
              </CardContent>
            </Card>
          ))}
          <h2 className="font-bold pt-3">Projects</h2>
          {projects.map((p) => (
            <Card key={p.id} className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <IndianRupee className="text-emerald-600" />
                <div className="flex-1">
                  <p className="font-semibold">{p.project_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {nice(p.status)}
                  </p>
                </div>
                <strong>{money(p.contract_value)}</strong>
              </CardContent>
            </Card>
          ))}
        </div>
        <div>
          <h2 className="font-bold mb-3">Account recommendations</h2>
          {insights.map((i) => (
            <Card key={i.id} className="border-0 shadow-sm mb-3">
              <CardContent className="p-4">
                <Badge variant="secondary">{nice(i.insight_type)}</Badge>
                <p className="font-semibold mt-2">{i.title}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {i.narrative}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
function V({ l, v }: { l: string; v: any }) {
  return (
    <div>
      <p className="font-bold text-lg">{v}</p>
      <p className="text-xs text-slate-400">{l}</p>
    </div>
  );
}
