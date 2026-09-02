/* eslint-disable @typescript-eslint/no-explicit-any */
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function LeadOpportunitySheet({
  lead,
  update,
}: {
  lead: any;
  update: (patch: any) => void;
}) {
  const field =
    (column: string, numeric = false) =>
    (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      update({
        [column]: numeric
          ? Number(event.target.value || 0)
          : event.target.value || null,
      });
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5">
        <div className="mb-4">
          <h2 className="font-bold">Opportunity sheet</h2>
          <p className="text-xs text-muted-foreground">
            Technical, commercial and decision information for this opportunity
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Label text="Department / client">
            <Input
              defaultValue={
                lead.department_client || lead.organization_name || ""
              }
              onBlur={field("department_client")}
            />
          </Label>
          <Label text="Plant capacity">
            <Input
              defaultValue={lead.plant_capacity || ""}
              onBlur={field("plant_capacity")}
            />
          </Label>
          <Label text="Existing problem">
            <Textarea
              defaultValue={lead.existing_problem || ""}
              onBlur={field("existing_problem")}
            />
          </Label>
          <Label text="Sanctioned budget">
            <Input
              type="number"
              defaultValue={lead.sanctioned_budget || 0}
              onBlur={field("sanctioned_budget", true)}
            />
          </Label>
          <Label text="Proposed technology">
            <Textarea
              defaultValue={lead.proposed_technology || ""}
              onBlur={field("proposed_technology")}
            />
          </Label>
          <Label text="BOQ status">
            <Select
              value={lead.boq_status || "not_started"}
              onValueChange={(value) => update({ boq_status: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  "not_started",
                  "preparation",
                  "submitted",
                  "revision",
                  "approved",
                ].map((value) => (
                  <SelectItem key={value} value={value}>
                    {value
                      .replaceAll("_", " ")
                      .replace(/\b\w/g, (c) => c.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Label>
          <Label text="Decision-maker">
            <Input
              defaultValue={lead.decision_maker_name || ""}
              onBlur={field("decision_maker_name")}
            />
          </Label>
          <Label text="Tender timeline">
            <Input
              type="date"
              defaultValue={lead.tender_timeline || ""}
              onBlur={field("tender_timeline")}
            />
          </Label>
          <Label text="Commercial model">
            <Input
              defaultValue={lead.commercial_model || ""}
              onBlur={field("commercial_model")}
            />
          </Label>
          <Label text="Expected profit">
            <Input
              type="number"
              defaultValue={lead.expected_profit || 0}
              onBlur={field("expected_profit", true)}
            />
          </Label>
          <div className="sm:col-span-2">
            <Label text="Next action">
              <Input
                defaultValue={lead.next_best_action || ""}
                onBlur={field("next_best_action")}
              />
            </Label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Label({
  text,
  children,
}: {
  text: string;
  children: React.ReactNode;
}) {
  return (
    <label>
      <span className="text-xs font-medium text-muted-foreground">{text}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
