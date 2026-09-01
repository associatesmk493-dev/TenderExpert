/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { FileClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
const nice = (value: string) =>
  value?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default function LeadQuotationTimeline({ leadId }: { leadId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    supabase
      .from("b2g_proposals" as any)
      .select("*,b2g_projects(project_name,order_number)")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .then(({ data }) => setRows(data || []));
  }, [leadId]);
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center gap-2">
          <FileClock className="h-4 w-4" />
          <h2 className="font-bold">Quotation revision timeline</h2>
          <Badge variant="secondary">{rows.length} versions</Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Original quotation and complete revision history for every order
        </p>
        <div className="mt-4 overflow-x-auto">
          <div className="min-w-[850px] overflow-hidden rounded-xl border">
            <div className="grid grid-cols-7 gap-3 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-muted-foreground">
              <span>Order</span>
              <span>Version</span>
              <span>Previous value</span>
              <span>Revised value</span>
              <span>Revision reason</span>
              <span>Created date</span>
              <span>Status</span>
            </div>
            <div className="divide-y">
              {rows.map((row) => {
                const previous =
                  rows.find((item) => item.id === row.supersedes_id) ||
                  rows.find(
                    (item) =>
                      item.project_id === row.project_id &&
                      Number(item.version) === Number(row.version) - 1,
                  );
                return (
                  <div
                    key={row.id}
                    className="grid grid-cols-7 gap-3 px-3 py-3 text-xs"
                  >
                    <span className="font-semibold">
                      {row.b2g_projects?.order_number ||
                        row.b2g_projects?.project_name ||
                        "General"}
                    </span>
                    <span>V{row.version || 1}</span>
                    <span>{previous ? money(previous.subtotal) : "—"}</span>
                    <span className="font-semibold">{money(row.subtotal)}</span>
                    <span>
                      {row.revision_reason ||
                        ((row.version || 1) === 1
                          ? "Initial quotation"
                          : "Not specified")}
                    </span>
                    <span>
                      {new Date(row.created_at).toLocaleDateString("en-IN")}
                    </span>
                    <span>
                      <Badge variant="outline">{nice(row.status)}</Badge>
                    </span>
                  </div>
                );
              })}
              {!rows.length && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No quotations created yet.
                </p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
