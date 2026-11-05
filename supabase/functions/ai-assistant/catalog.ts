// Entity catalog: the ONLY tables/columns the assistant can read. Column lists were taken from
// supabase/migrations. Credentials / integration secrets (integration_settings, profiles email
// tokens, storage paths, auth tables) are deliberately absent.

export type Entity = {
  table: string;
  description: string;
  columns: string[];          // selectable + filterable + sortable
  search: string[];           // text columns used by the free-text `search` argument
  numeric: string[];          // columns allowed in sum/avg/min/max
  groupable: string[];        // columns allowed as group_by
  defaultSort: string;
  link?: (id: string) => string;
  relations: string;          // plain-language relationships, shown to the model
};

export const ENTITIES: Record<string, Entity> = {
  leads: {
    table: "b2g_leads",
    description: "Sales opportunities / leads (the app's core record). One company has many leads.",
    columns: ["id", "organization_name", "contact_name", "phone", "email", "website", "industry", "state", "city", "pipeline", "stage", "service_interest", "source", "heat", "ai_score", "ai_summary", "next_best_action", "assigned_to", "proposal_value", "expected_revenue", "probability", "expected_close_date", "next_follow_up_at", "last_contacted_at", "notes", "lost_reason", "closed_at", "created_at", "updated_at", "company_id", "sanctioned_budget", "expected_profit", "objection", "decision_deadline", "decision_maker_name", "competitor", "on_hold", "on_hold_reason", "lost_reason_code", "closure_outcome", "phase_no", "parent_lead_id", "last_activity_at", "department_client", "existing_problem", "proposed_technology", "boq_status", "commercial_model", "advance_amount", "total_amount", "received_amount", "proposal_gst_rate", "stalled_since"],
    search: ["organization_name", "contact_name", "industry", "city", "notes", "email", "phone"],
    numeric: ["ai_score", "proposal_value", "expected_revenue", "probability", "sanctioned_budget", "expected_profit", "advance_amount", "total_amount", "received_amount"],
    groupable: ["pipeline", "stage", "heat", "industry", "state", "city", "source", "assigned_to", "company_id", "lost_reason_code", "closure_outcome", "on_hold"],
    defaultSort: "created_at",
    link: (id) => `/leads/${id}`,
    relations: "company_id -> companies.id; parent_lead_id -> leads.id (re-opened phases); assigned_to = user id. Tasks, activities, proposals, projects and tenders reference lead_id. Open pipeline = closed_at is null. 'heat' is hot/warm/cold.",
  },
  tasks: {
    table: "b2g_tasks",
    description: "Follow-up tasks and reminders. A pending task has completed_at null; overdue = pending and due_at < now.",
    columns: ["id", "lead_id", "title", "description", "task_type", "priority", "due_at", "assigned_to", "created_by", "completed_at", "escalation_level", "created_at", "responsible_person"],
    search: ["title", "description", "responsible_person"],
    numeric: ["escalation_level"],
    groupable: ["task_type", "priority", "assigned_to", "lead_id"],
    defaultSort: "due_at",
    link: () => "/tasks",
    relations: "lead_id -> leads.id. task_type: follow_up, call, meeting, email, whatsapp, document, payment, tender, other.",
  },
  proposals: {
    table: "b2g_proposals",
    description: "Quotations / proposals. subtotal is the taxable value (after discount); gst_amount is computed; total = subtotal + gst_amount.",
    columns: ["id", "lead_id", "template_id", "proposal_number", "subject", "scope", "commercial_terms", "payment_model", "subtotal", "gst_rate", "gst_amount", "status", "valid_until", "sent_at", "accepted_at", "created_by", "created_at", "project_id", "version", "supersedes_id", "discount_amount", "revision_reason", "submitted_at"],
    search: ["proposal_number", "subject", "scope"],
    numeric: ["subtotal", "gst_amount", "discount_amount", "gst_rate", "version"],
    groupable: ["status", "payment_model", "lead_id", "created_by"],
    defaultSort: "created_at",
    link: () => "/proposals",
    relations: "lead_id -> leads.id; template_id -> templates.id; supersedes_id -> proposals.id (revisions). status: draft, sent, viewed, accepted, rejected, expired.",
  },
  projects: {
    table: "b2g_projects",
    description: "Orders / projects won from a lead. Holds contract value and estimated cost.",
    columns: ["id", "lead_id", "project_name", "scope", "payment_model", "contract_value", "gst_rate", "gst_amount", "start_date", "target_completion_date", "status", "created_at", "order_number", "expected_close_date", "delay_reason", "closure_reason", "delivery_risk", "estimated_cost"],
    search: ["project_name", "scope", "order_number"],
    numeric: ["contract_value", "gst_amount", "estimated_cost", "gst_rate"],
    groupable: ["status", "payment_model", "delivery_risk", "lead_id"],
    defaultSort: "created_at",
    link: () => "/orders",
    relations: "lead_id -> leads.id. Payment milestones and expenses reference project_id.",
  },
  payments: {
    table: "b2g_payment_milestones",
    description: "Payment milestones per project. Balance due = amount + gst_amount - amount_received.",
    columns: ["id", "project_id", "milestone_name", "sequence_no", "percentage", "amount", "gst_amount", "due_date", "amount_received", "received_at", "status", "invoice_number", "notes", "invoice_date", "responsible_person"],
    search: ["milestone_name", "invoice_number", "notes", "responsible_person"],
    numeric: ["amount", "gst_amount", "amount_received", "percentage"],
    groupable: ["status", "project_id", "responsible_person"],
    defaultSort: "due_date",
    link: () => "/orders",
    relations: "project_id -> projects.id. status: not_due, partially_paid, paid, overdue, waived.",
  },
  tenders: {
    table: "tender_opportunities",
    description: "Tender opportunities tracked for government work.",
    columns: ["id", "lead_id", "tender_title", "tender_number", "authority_name", "department", "state", "category", "estimated_value", "emd_amount", "submission_deadline", "go_no_go", "match_score", "ai_analysis", "status", "owner_id", "created_at", "next_action", "company_name", "sanctioned_budget", "project_stage"],
    search: ["tender_title", "tender_number", "authority_name", "department", "company_name"],
    numeric: ["estimated_value", "emd_amount", "match_score", "sanctioned_budget"],
    groupable: ["go_no_go", "status", "state", "category", "authority_name"],
    defaultSort: "submission_deadline",
    link: () => "/tenders",
    relations: "lead_id -> leads.id (optional).",
  },
  activities: {
    table: "b2g_activities",
    description: "Lead history: calls, emails, meetings, notes, stage changes, documents, proposals.",
    columns: ["id", "lead_id", "activity_type", "subject", "description", "outcome", "due_at", "completed_at", "created_by", "created_at"],
    search: ["subject", "description", "outcome"],
    numeric: [],
    groupable: ["activity_type", "lead_id", "created_by"],
    defaultSort: "created_at",
    relations: "lead_id -> leads.id.",
  },
  companies: {
    table: "companies",
    description: "Client organizations. Each has many leads over time.",
    columns: ["id", "name", "phone", "email", "website", "industry", "city", "state", "gst_number", "notes", "owner_id", "created_at", "account_tier", "annual_potential_value", "payment_reliability_score"],
    search: ["name", "industry", "city", "notes"],
    numeric: ["annual_potential_value", "payment_reliability_score"],
    groupable: ["industry", "state", "city", "account_tier"],
    defaultSort: "name",
    link: (id) => `/clients/${id}`,
    relations: "leads.company_id -> companies.id.",
  },
  expenses: {
    table: "b2g_expenses",
    description: "Project expenses (direct costs).",
    columns: ["id", "project_id", "category_id", "vendor", "description", "amount", "gst", "paid_on"],
    search: ["vendor", "description"],
    numeric: ["amount", "gst"],
    groupable: ["project_id", "category_id", "vendor"],
    defaultSort: "paid_on",
    relations: "project_id -> projects.id.",
  },
  templates: {
    table: "proposal_templates",
    description: "Proposal templates (subject/body/terms) per pipeline.",
    columns: ["id", "name", "pipeline", "subject_template", "body_template", "terms_template", "is_active"],
    search: ["name", "subject_template"],
    numeric: [],
    groupable: ["pipeline", "is_active"],
    defaultSort: "name",
    link: () => "/proposal-templates",
    relations: "proposals.template_id -> templates.id.",
  },
};

export const ENTITY_NAMES = Object.keys(ENTITIES);

/** Compact description handed to the model inside the tool description. */
export function catalogForModel(): string {
  return ENTITY_NAMES.map((name) => {
    const e = ENTITIES[name];
    return `- ${name}: ${e.description} Relations: ${e.relations} Columns: ${e.columns.join(", ")}.`;
  }).join("\n");
}

export const FILTER_OPS = ["eq", "neq", "gt", "gte", "lt", "lte", "contains", "in", "is_null", "not_null"] as const;
export type FilterOp = typeof FILTER_OPS[number];
