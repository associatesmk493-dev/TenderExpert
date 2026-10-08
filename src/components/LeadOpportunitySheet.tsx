/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Save, Trash2 } from "lucide-react";

type BoqRow = {
  item: string;
  make: string;
  qty: string;
  rate: string;
  commercial_model: string;
  expected_profit: string;
};
const blankRow = (): BoqRow => ({
  item: "",
  make: "",
  qty: "",
  rate: "",
  commercial_model: "",
  expected_profit: "",
});
const toRows = (items: any): BoqRow[] => {
  const rows = Array.isArray(items) ? items : [];
  return rows.length
    ? rows.map((row: any) => ({
        item: row.item || "",
        make: row.make || "",
        qty: row.qty ? String(row.qty) : "",
        rate: row.rate ? String(row.rate) : "",
        commercial_model: row.commercial_model || "",
        expected_profit: row.expected_profit ? String(row.expected_profit) : "",
      }))
    : [blankRow()];
};
const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n || 0);

export default function LeadOpportunitySheet({
  lead,
  update,
}: {
  lead: any;
  update: (patch: any) => void | Promise<void>;
}) {
  const [rows, setRows] = useState<BoqRow[]>(() => toRows(lead.boq_items));
  const [dirty, setDirty] = useState(false);
  const field =
    (column: string, numeric = false) =>
    (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      update({
        [column]: numeric
          ? Number(event.target.value || 0)
          : event.target.value || null,
      });

  const setRow = (index: number, patch: Partial<BoqRow>) => {
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
    setDirty(true);
  };
  const addRow = () => {
    setRows((current) => [...current, blankRow()]);
    setDirty(true);
  };
  const removeRow = (index: number) => {
    setRows((current) =>
      current.length === 1 ? [blankRow()] : current.filter((_, i) => i !== index),
    );
    setDirty(true);
  };
  const totalProfit = rows.reduce(
    (sum, row) => sum + (Number(row.expected_profit) || 0),
    0,
  );
  const saveBoq = async () => {
    const cleaned = rows
      .filter((row) => Object.values(row).some((value) => value.trim()))
      .map((row) => ({
        item: row.item.trim(),
        make: row.make.trim(),
        qty: Number(row.qty) || 0,
        rate: Number(row.rate) || 0,
        commercial_model: row.commercial_model.trim(),
        expected_profit: Number(row.expected_profit) || 0,
      }));
    const models = Array.from(
      new Set(cleaned.map((row) => row.commercial_model).filter(Boolean)),
    );
    await update({
      boq_items: cleaned,
      expected_profit: cleaned.reduce((sum, row) => sum + row.expected_profit, 0),
      commercial_model: models.length ? models.join(", ") : null,
    });
    setRows(toRows(cleaned));
    setDirty(false);
  };

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
          <Label text="Site name (location)">
            <Input
              defaultValue={lead.site_name || ""}
              onBlur={field("site_name")}
            />
          </Label>
          <Label text="Name of work">
            <Input
              defaultValue={lead.work_name || ""}
              onBlur={field("work_name")}
            />
          </Label>
          <Label text="Contact no">
            <Input
              type="tel"
              defaultValue={lead.contact_no || lead.phone || ""}
              onBlur={field("contact_no")}
            />
          </Label>
          <Label text="Plant capacity">
            <Input
              defaultValue={lead.plant_capacity || ""}
              onBlur={field("plant_capacity")}
            />
          </Label>
          <Label text="Sanctioned budget">
            <Input
              type="number"
              defaultValue={lead.sanctioned_budget || 0}
              onBlur={field("sanctioned_budget", true)}
            />
          </Label>
          <Label text="Existing problem">
            <Textarea
              defaultValue={lead.existing_problem || ""}
              onBlur={field("existing_problem")}
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
          <div className="sm:col-span-2">
            <Label text="Next action">
              <Input
                defaultValue={lead.next_best_action || ""}
                onBlur={field("next_best_action")}
              />
            </Label>
          </div>
        </div>

        <div className="mt-6 border-t pt-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-bold">BOQ</h3>
              <p className="text-xs text-muted-foreground">
                Item-wise quantities, rate, commercial model and expected profit
              </p>
            </div>
            <Button
              type="button"
              size="icon"
              variant="outline"
              title="Add row"
              aria-label="Add BOQ row"
              onClick={addRow}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-slate-50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="w-14 px-2 py-2">S.No</th>
                  <th className="px-2 py-2">Item</th>
                  <th className="px-2 py-2">Make</th>
                  <th className="w-24 px-2 py-2">Qty</th>
                  <th className="w-28 px-2 py-2">Rate</th>
                  <th className="px-2 py-2">Commercial model</th>
                  <th className="w-32 px-2 py-2">Expected profit</th>
                  <th className="w-10 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index} className="border-t">
                    <td className="px-2 py-1.5 text-muted-foreground">
                      {index + 1}
                    </td>
                    <td className="px-1 py-1">
                      <Input
                        value={row.item}
                        onChange={(e) => setRow(index, { item: e.target.value })}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <Input
                        value={row.make}
                        onChange={(e) => setRow(index, { make: e.target.value })}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <Input
                        type="number"
                        min="0"
                        value={row.qty}
                        onChange={(e) => setRow(index, { qty: e.target.value })}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <Input
                        type="number"
                        min="0"
                        value={row.rate}
                        onChange={(e) => setRow(index, { rate: e.target.value })}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <Input
                        value={row.commercial_model}
                        onChange={(e) =>
                          setRow(index, { commercial_model: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-1 py-1">
                      <Input
                        type="number"
                        value={row.expected_profit}
                        onChange={(e) =>
                          setRow(index, { expected_profit: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-1 py-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        title="Remove row"
                        aria-label={`Remove row ${index + 1}`}
                        onClick={() => removeRow(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              <span className="text-muted-foreground">
                Total expected profit:{" "}
              </span>
              <span className="font-bold">{money(totalProfit)}</span>
            </p>
            <Button type="button" disabled={!dirty} onClick={saveBoq}>
              <Save className="mr-2 h-4 w-4" />
              Save BOQ
            </Button>
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
