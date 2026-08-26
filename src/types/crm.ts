export type AppRole = "ceo" | "manager" | "team_member" | "admin";
export type FunnelStage =
  | "new_lead"
  | "lead_capture"
  | "qualification"
  | "need_analysis"
  | "proposal"
  | "catalog_send"
  | "negotiation"
  | "closure_order_1"
  | "delivered"
  | "post_sale"
  | "lost_rejected"
  | "rnr";
export type LeadTemperature = "hot" | "warm" | "cold";
export type CallOutcome =
  | "walkin_scheduled"
  | "not_picked_up"
  | "not_interested"
  | "follow_up"
  | "switched_off"
  | "wrong_number";
export type SourcePortal =
  | "existing_customer"
  | "customer_referral"
  | "whatsapp"
  | "website"
  | "calling"
  | "exhibition"
  | "facebook_instagram"
  | "indiamart"
  | "manual_entry"
  | "portal_vs_network";

export type Region =
  | "north_india"
  | "south_india"
  | "east_india"
  | "west_india"
  | "central_india"
  | "international";

export type Industry =
  | "pnc"
  | "horeca"
  | "cinemas"
  | "dealers"
  | "exports"
  | "concession_supply"
  | "seasonings"
  | "other";

export type BusinessType =
  | "projects"
  | "retail"
  | "spares"
  | "consumer_supplies"
  | "service"
  | "trainings"
  | "popcorn_pnc"
  | "others";

export type OrderWonStatus = "wip" | "delivered" | "final_payment";

export type LeadType = "nbd_incoming" | "nbd_outgoing" | "nbd_crr";

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Showroom {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  customer_name: string;
  phone: string;
  email: string | null;
  source_portal: SourcePortal;
  showroom_id: string | null;
  assigned_to: string | null;
  funnel_stage: FunnelStage;
  temperature: LeadTemperature;
  last_call_outcome: CallOutcome | null;
  walkin_date: string | null;
  follow_up_date: string | null;
  booking_date: string | null;
  finance_updated_at: string | null;
  delivery_date: string | null;
  car_interest: string | null;
  budget: string | null;
  notes: string | null;
  date_of_birth: string | null;
  marriage_anniversary: string | null;
  company: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  industry: string | null;
  business_type: string | null;
  has_been_called: boolean;
  rnr_count: number;
  lead_type: LeadType | null;
  sub_category: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadActivity {
  id: string;
  lead_id: string;
  user_id: string | null;
  activity_type: string;
  description: string | null;
  created_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export const FUNNEL_STAGES: { value: FunnelStage; label: string; color: string }[] = [
  { value: "new_lead",         label: "New Lead",              color: "hsl(200 85% 50%)" },
  { value: "lead_capture",     label: "Lead",                  color: "hsl(var(--stage-lead-capture))" },
  { value: "qualification",    label: "Qualified Lead",        color: "hsl(var(--stage-qualification))" },
  { value: "need_analysis",    label: "Meetings/Needs Analysis", color: "hsl(var(--stage-need-analysis))" },
  { value: "proposal",         label: "Proposal Sent",         color: "hsl(var(--stage-proposal))" },
  { value: "catalog_send",     label: "Catalog Send",          color: "hsl(270 60% 55%)" },
  { value: "negotiation",      label: "Negotiation",           color: "hsl(var(--stage-negotiation))" },
  { value: "closure_order_1",  label: "Order Won",             color: "hsl(var(--stage-closure))" },
  { value: "delivered",        label: "Delivered",             color: "hsl(155 72% 38%)" },
  { value: "post_sale",        label: "Active Customer",       color: "hsl(var(--stage-post-sale))" },
  { value: "lost_rejected",    label: "Lost / Closed-Lost",    color: "hsl(var(--stage-lost))" },
  { value: "rnr",              label: "📵 RNR",                color: "hsl(25 95% 55%)" },
];

export const TEMPERATURE_OPTIONS: { value: LeadTemperature; label: string; emoji: string; color: string }[] = [
  { value: "hot", label: "Hot", emoji: "🔴", color: "hsl(var(--temp-hot))" },
  { value: "warm", label: "Warm", emoji: "🟡", color: "hsl(var(--temp-warm))" },
  { value: "cold", label: "Cold", emoji: "🔵", color: "hsl(var(--temp-cold))" },
];

export const CALL_OUTCOMES: { value: CallOutcome; label: string }[] = [
  { value: "walkin_scheduled", label: "📅 Walk-in Scheduled" },
  { value: "not_picked_up", label: "📵 RNR" },
  { value: "not_interested", label: "❌ Not Interested" },
  { value: "follow_up", label: "🔄 Follow Up" },
  { value: "switched_off", label: "📴 Switched Off" },
  { value: "wrong_number", label: "🚫 Wrong Number" },
];

export const SOURCE_PORTALS: { value: SourcePortal; label: string }[] = [
  { value: "existing_customer",  label: "Existing Customer" },
  { value: "customer_referral",  label: "Customer Referral" },
  { value: "whatsapp",           label: "WhatsApp" },
  { value: "website",            label: "Website" },
  { value: "calling",            label: "Calling" },
  { value: "exhibition",         label: "Exhibition" },
  { value: "facebook_instagram", label: "Facebook / Instagram" },
  { value: "indiamart",          label: "MailChamp" },
  { value: "manual_entry",       label: "Manual Entry" },
  { value: "portal_vs_network",  label: "VS Network" },
];

export const REGIONS: { value: Region; label: string }[] = [
  { value: "north_india",   label: "North India" },
  { value: "south_india",   label: "South India" },
  { value: "east_india",    label: "East India" },
  { value: "west_india",    label: "West India" },
  { value: "central_india",  label: "Central India" },
  { value: "international",  label: "International" },
];

export const INDUSTRIES: { value: Industry; label: string }[] = [
  { value: "pnc",                label: "PnC" },
  { value: "horeca",             label: "HoReCa" },
  { value: "cinemas",            label: "Cinemas" },
  { value: "dealers",            label: "Dealers" },
  { value: "exports",            label: "Exports" },
  { value: "concession_supply",  label: "Concession Supply" },
  { value: "seasonings",         label: "Seasonings" },
  { value: "other",              label: "Other" },
];

export const BUSINESS_TYPES: { value: BusinessType; label: string }[] = [
  { value: "projects",          label: "Projects" },
  { value: "retail",            label: "Retail" },
  { value: "spares",            label: "Spares" },
  { value: "consumer_supplies", label: "Consumer Supplies" },
  { value: "service",           label: "Service" },
  { value: "trainings",         label: "Trainings" },
  { value: "popcorn_pnc",       label: "Popcorn (PnC)" },
  { value: "others",            label: "Others" },
];

export const ORDER_WON_STATUSES: { value: OrderWonStatus; label: string; color: string }[] = [
  { value: "wip",           label: "WIP",            color: "hsl(var(--stage-negotiation))" },
  { value: "delivered",     label: "Delivered",      color: "hsl(var(--stage-closure))" },
  { value: "final_payment", label: "Final Payment",  color: "hsl(var(--stage-post-sale))" },
];

export const LEAD_TYPES: { value: LeadType; label: string }[] = [
  { value: "nbd_incoming", label: "NBD Incoming" },
  { value: "nbd_outgoing", label: "NBD Outgoing" },
  { value: "nbd_crr",      label: "NBD CRR"      },
];
