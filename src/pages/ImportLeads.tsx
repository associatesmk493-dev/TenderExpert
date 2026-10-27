import { useState, useRef, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { SOURCE_PORTALS, type SourcePortal } from '@/types/crm';
import { skippedMessage, writeManyWithFallback } from '@/lib/writeWithFallback';
import { ArrowLeft, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Download, ArrowRight, Users } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import * as XLSX from 'xlsx';

interface ParsedLead {
  customer_name: string; phone: string; email?: string;
  car_interest?: string; notes?: string; budget?: string;
  region?: string; business_type?: string; industry?: string;
  owner_name?: string; company?: string; quoted_amount?: string;
  funnel_stage?: string; lead_type?: string;
  assigned_to_name?: string;
  assigned_to_email?: string;
  designation?: string; website?: string; city?: string; state?: string;
  pipeline?: string; heat?: string; gst_rate?: string; gst_number?: string;
  expected_close_date?: string; next_follow_up?: string;
  boq_link?: string; event_name?: string;
  extra_contacts?: { name: string; designation: string; phone: string; email: string; note: string }[];
  valid: boolean; error?: string;
  _rowIndex?: number;
}

type ExtraContactField =
  | 'contact2_name' | 'contact2_designation' | 'contact2_phone' | 'contact2_email'
  | 'contact3_name' | 'contact3_designation' | 'contact3_phone' | 'contact3_email';

type LeadField =
  | 'customer_name' | 'phone' | 'email' | 'car_interest'
  | 'notes' | 'budget' | 'region' | 'business_type' | 'industry'
  | 'owner_name' | 'company' | 'quoted_amount'
  | 'funnel_stage' | 'lead_type' | 'assigned_to_name' | 'assigned_to_email'
  | 'designation' | 'website' | 'city' | 'state' | 'pipeline' | 'heat'
  | 'gst_rate' | 'gst_number' | 'expected_close_date' | 'next_follow_up'
  | 'boq_link' | 'event_name' | ExtraContactField | 'ignore';

const FIELD_OPTIONS: { value: LeadField; label: string; required?: boolean }[] = [
  { value: 'ignore', label: '— Ignore —' },
  { value: 'company', label: 'Organization / Company Name' },
  { value: 'customer_name', label: 'Contact Person' },
  { value: 'designation', label: 'Designation' },
  { value: 'phone', label: 'Phone Number' },
  { value: 'email', label: 'Email' },
  { value: 'website', label: 'Website' },
  { value: 'gst_number', label: 'GST Number' },
  { value: 'city', label: 'City' },
  { value: 'state', label: 'State' },
  { value: 'pipeline', label: 'Pipeline (Brand Approval / Govt BD / Tender)' },
  { value: 'heat', label: 'Heat (Hot / Warm / Cold)' },
  { value: 'gst_rate', label: 'GST Rate %' },
  { value: 'expected_close_date', label: 'Expected Close Date' },
  { value: 'next_follow_up', label: 'Next Follow-up Date' },
  { value: 'boq_link', label: 'BOQ / Drive Link' },
  { value: 'event_name', label: 'Event Name' },
  { value: 'contact2_name', label: 'Contact 2 — Name' },
  { value: 'contact2_designation', label: 'Contact 2 — Designation' },
  { value: 'contact2_phone', label: 'Contact 2 — Phone' },
  { value: 'contact2_email', label: 'Contact 2 — Email' },
  { value: 'contact3_name', label: 'Contact 3 — Name' },
  { value: 'contact3_designation', label: 'Contact 3 — Designation' },
  { value: 'contact3_phone', label: 'Contact 3 — Phone' },
  { value: 'contact3_email', label: 'Contact 3 — Email' },
  { value: 'car_interest', label: 'Equipment / Product Interest' },
  { value: 'notes', label: 'Notes / Remark' },
  { value: 'budget', label: 'Budget' },
  { value: 'quoted_amount', label: 'Quoted Amount' },
  { value: 'region', label: 'Region' },
  { value: 'industry', label: 'Industry' },
  { value: 'business_type', label: 'Business Type' },
  { value: 'owner_name', label: 'Owner Name' },
  { value: 'company', label: 'Company Name' },
  { value: 'funnel_stage', label: 'Funnel Stage (Status)' },
  { value: 'lead_type', label: 'Lead Type' },
  { value: 'assigned_to_name', label: 'Assign Lead To (Name)' },
  { value: 'assigned_to_email', label: 'Assign Lead To (Email)' },
];

// Maps raw text from file → valid funnel_stage enum values
const parseFunnelStage = (raw: string): string | null => {
  const v = raw.toLowerCase().trim();
  if (!v) return null;
  if (v === 'new lead' || v === 'new_lead' || v === 'new') return 'new_lead';
  if (v.includes('rnr') || v.includes('lead capture') || v.includes('capture') || v === 'lead') return 'lead_capture';
  if (v.includes('qualif') || v.includes('qualified lead')) return 'qualification';
  if (v.includes('need analysis') || v.includes('need_analysis') || v.includes('meeting') || v.includes('proposal') || v.includes('needs analysis')) return 'need_analysis';
  if (v.includes('negotiat')) return 'negotiation';
  if (v.includes('won') || v.includes('order won') || v.includes('closure')) return 'closure_order_1';
  if (v.includes('lost') || v.includes('closed') || v.includes('rejected')) return 'lost_rejected';
  if (v.includes('post sale') || v.includes('active customer') || v.includes('post_sale')) return 'post_sale';
  return null;
};

// Maps raw text → valid lead_type check-constraint values
const parseLeadType = (raw: string): string | null => {
  const v = raw.toLowerCase().replace(/[\s_-]/g, '');
  if (v.includes('nbdincoming') || v === 'incoming') return 'nbd_incoming';
  if (v.includes('nbdoutgoing') || v === 'outgoing') return 'nbd_outgoing';
  if (v.includes('crr') || v.includes('retention')) return 'nbd_crr';
  return null;
};

const parseRegion = (raw: string): string | null => {
  const v = raw.toLowerCase().trim();
  if (!v) return null;
  if (v.includes('north')) return 'north_india';
  if (v.includes('south')) return 'south_india';
  if (v.includes('east'))  return 'east_india';
  if (v.includes('west'))  return 'west_india';
  if (v.includes('central')) return 'central_india';
  return null;
};

const parseIndustry = (raw: string): string | null => {
  const v = raw.toLowerCase().replace(/[\s_-]/g, '');
  if (!v) return null;
  if (v.includes('horeca') || v.includes('hotel') || v.includes('restaurant') || v.includes('cafe')) return 'horeca';
  if (v.includes('cinema') || v.includes('theatre') || v.includes('multiplex') || v.includes('amusement')) return 'cinemas';
  if (v.includes('dealer')) return 'dealers';
  if (v.includes('export') || v.includes('international')) return 'exports';
  if (v.includes('concession') || v.includes('supply')) return 'concession_supply';
  if (v.includes('season')) return 'seasonings';
  if (v.includes('pnc') || v.includes('popcorn') || v.includes('confection')) return 'pnc';
  return null;
};

const parseBusinessType = (raw: string): string | null => {
  const v = raw.toLowerCase().replace(/[\s_-]/g, '');
  if (!v) return null;
  if (v.includes('retail')) return 'retail';
  if (v.includes('project')) return 'projects';
  if (v.includes('spare')) return 'spares';
  if (v.includes('consumer') || v.includes('consumable')) return 'consumer_supplies';
  if (v.includes('service')) return 'service';
  if (v.includes('training')) return 'trainings';
  return null;
};

// Same fields as "Add opportunity", in the same order, so the sheet can be filled in and imported as it is.
const SAMPLE_HEADERS = [
  'organization_name', 'contact_person', 'designation', 'phone', 'email', 'website', 'gst_number',
  'industry', 'city', 'state', 'pipeline', 'services', 'heat', 'proposal_value', 'gst_rate',
  'expected_close_date', 'next_follow_up_date', 'boq_link', 'event_name', 'notes',
  'contact2_name', 'contact2_designation', 'contact2_phone', 'contact2_email',
  'contact3_name', 'contact3_designation', 'contact3_phone', 'contact3_email',
];
const SAMPLE_ROWS = [
  ['AquaTech Industries Pvt Ltd', 'Rahul Sharma', 'Branch Head', '9876543210', 'rahul@aquatech.in', 'www.aquatech.in', '07ABCDE1234F1Z5',
    'Water & Wastewater', 'Noida', 'Uttar Pradesh', 'Brand Approval', 'CPWD Class Registration', 'warm', '250000', '18',
    '2026-12-31', '2026-11-05', 'https://drive.google.com/your-link', 'Raipur Exhibition 2026', 'Requires government product approval',
    'Neha Verma', 'Director', '9812345678', 'neha@aquatech.in', '', '', '', ''],
  ['InfraBuild Solutions', 'Priya Singh', 'Procurement Manager', '8765432109', 'priya@infrabuild.in', '', '',
    'Infrastructure', 'Jaipur', 'Rajasthan', 'Tender Consultancy', 'Tender Consultancy', 'hot', '500000', '18',
    '', '2026-11-02', '', '', 'Interested in upcoming state tenders',
    '', '', '', '', '', '', '', ''],
];
const csvCell = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
const SAMPLE_CSV = [SAMPLE_HEADERS, ...SAMPLE_ROWS].map((row) => row.map(csvCell).join(',')).join('\n');

// One phone number out of a cell: handles "+91 98765 43210", 9876543210.0, 9.87654E+09 and "98765 43210 / 98123 45678".
const toPhone = (value: string): string => {
  let s = value.trim();
  if (/^\d+(\.\d+)?e\+?\d+$/i.test(s)) s = Number(s).toFixed(0);
  s = s.replace(/\.0+$/, '');
  let phone = s.replace(/[^0-9]/g, '');
  if (phone.startsWith('0091')) phone = phone.slice(2);
  if (phone.startsWith('091')) phone = phone.slice(1);
  if (phone.startsWith('0') && phone.length === 11) phone = '91' + phone.slice(1);
  if (phone.length === 10) phone = '91' + phone;
  if (phone.length === 11 && phone.startsWith('1')) phone = '9' + phone;
  return phone.length >= 10 && phone.length <= 15 ? phone : '';
};
const pickPhone = (raw: string): string => {
  for (const part of raw.split(/[/;,|\n]+/)) {
    const phone = toPhone(part);
    if (phone) return phone;
  }
  return toPhone(raw);
};

const pad = (n: number) => String(n).padStart(2, '0');
// yyyy-mm-dd, dd/mm/yyyy, dd-mm-yyyy or an Excel date number → yyyy-mm-dd.
const parseDate = (raw: string): string | null => {
  const v = raw.trim();
  if (!v) return null;
  if (/^\d{5}(\.\d+)?$/.test(v)) {
    const date = new Date(Math.round((Number(v) - 25569) * 86400 * 1000));
    return Number.isNaN(date.getTime()) ? null : `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  }
  let m = v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${pad(Number(m[2]))}-${pad(Number(m[3]))}`;
  m = v.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) return `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
  return null;
};

const parsePipeline = (raw: string): string | null => {
  const v = raw.toLowerCase();
  if (!v.trim()) return null;
  if (v.includes('tender')) return 'tender_consultancy';
  if (v.includes('govern') || v.includes('gov') || v.includes('business dev') || v.includes('bd')) return 'government_business_development';
  if (v.includes('brand') || v.includes('approval')) return 'brand_approval';
  return null;
};
const parseHeat = (raw: string): string | null => {
  const v = raw.toLowerCase();
  return v.includes('hot') ? 'hot' : v.includes('warm') ? 'warm' : v.includes('cold') ? 'cold' : null;
};

const splitCsvLine = (line: string): string[] => {
  const cols: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') { inQuotes = !inQuotes; continue; }
    if (char === ',' && !inQuotes) { cols.push(current.trim()); current = ''; continue; }
    current += char;
  }
  cols.push(current.trim());
  return cols;
};

const autoDetect = (header: string): LeadField => {
  const h = header.toLowerCase().trim();
  // Same text without punctuation, so "Phone No." / "phone_no" / "Phone-No" all read alike.
  const n = h.replace(/[^a-z0-9]+/g, ' ').trim();
  const extra = n.match(/^contact ?([23]) ?(name|person|designation|title|phone|mobile|email|mail)/);
  if (extra) {
    const kind = /name|person/.test(extra[2]) ? 'name' : /designation|title/.test(extra[2]) ? 'designation' : /phone|mobile/.test(extra[2]) ? 'phone' : 'email';
    return `contact${extra[1]}_${kind}` as LeadField;
  }
  if (!n.includes('assign') && !n.includes('manager') && (n.includes('email') || n.includes('mail'))) return 'email';
  if (/\bgstin\b|gst (number|no)|gst ?in/.test(n)) return 'gst_number';
  if (/gst (rate|percent)|^gst$|gst ?%/.test(n)) return 'gst_rate';
  if (n.includes('boq') || n.includes('drive link')) return 'boq_link';
  if (n.includes('website') || n.includes('web site') || n === 'url') return 'website';
  if (/(organi[sz]ation|company|firm|institution)( name)?$/.test(n) && !n.includes('assign')) return 'company';
  if (/designation|job title|position|^title$/.test(n)) return 'designation';
  if (/(phone|mobile|whatsapp|telephone|\bmob\b|\bcell\b|contact (no|number|num)|\btel\b)/.test(n) && !n.includes('assign')) return 'phone';
  if (n === 'city') return 'city';
  if (n === 'state') return 'state';
  if (n === 'pipeline') return 'pipeline';
  if (n === 'heat' || n === 'temperature') return 'heat';
  if (n.includes('expected close') || n.includes('close date')) return 'expected_close_date';
  if (n.includes('follow up') || n.includes('followup')) return 'next_follow_up';
  if (n.includes('event')) return 'event_name';
  if (n.includes('proposal value') || n.includes('proposal amount')) return 'quoted_amount';
  if (n === 'services' || n === 'service' || n.includes('service interest')) return 'car_interest';
  if (n === 'contact person' || n === 'contact name' || n === 'person name' || n === 'customer name' || n === 'name' || (h.includes('name') && !h.includes('assignee') && !h.includes('owner') && !h.includes('manager') && !h.includes('poc') && !h.includes('company'))) return 'customer_name';
  if (h === 'status' || h === 'funnel stage' || h === 'funnel_stage' || h === 'stage') return 'funnel_stage';
  if (h === 'lead type' || h === 'lead_type' || h === 'customer type' || h === 'customer_type') return 'lead_type';
  if (h.includes('requirement') || h.includes('equipment') || h === 'product type' || h === 'product_type' || h.includes('interest') || h.includes('machine') || h.includes('item')) return 'car_interest';
  if (h.includes('remark') || h.includes('note') || h.includes('comment') || h.includes('description')) return 'notes';
  if (h === 'budget') return 'budget';
  if (h.includes('quoted') || h === 'quoted amount') return 'quoted_amount';
  if (h === 'region') return 'region';
  if (h.includes('industry')) return 'industry';
  if (h === 'business type' || h === 'business_type') return 'business_type';
  if (h === 'owners name' || h === 'owner name' || h === 'owner') return 'owner_name';
  if (h === 'company name' || h === 'company' || h === 'company_name') return 'company';
  if (h === 'assigned to' || h === 'assigned_to' || h === 'assignee' || h === 'assign' || h === 'assigned' || h === 'assign lead' || h === 'assign to' || h === 'assignee name' || h === 'assigned name' || h === 'sales person' || h === 'salesperson' || h === 'sales rep' || h === 'sales_person') return 'assigned_to_name';
  if (h === 'assignee email' || h === 'assignee emailid' || h === 'assignee email id' || h === 'assigned email' || h === 'assigned_to_email') return 'assigned_to_email';
  return 'ignore';
};

const cleanValue = (val: unknown): string => {
  const s = String(val ?? '').trim();
  return s === '_' || s === '-' || s.toLowerCase() === 'null' || s.toLowerCase() === 'nan' ? '' : s;
};

const ImportLeads = () => {
  const navigate = useNavigate();
  const { user, canImport } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<LeadField[]>([]);
  const [mapped, setMapped] = useState(false);
  const [parsedLeads, setParsedLeads] = useState<ParsedLead[]>([]);
  const [sourcePortal, setSourcePortal] = useState<SourcePortal>('manual_entry');
  const [subCategory, setSubCategory] = useState('');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });
  const [imported, setImported] = useState(false);
  const [fileName, setFileName] = useState('');
  const [failedRecords, setFailedRecords] = useState<{ row: number; name: string; phone: string; reason: string }[]>([]);

  type TeamUser = { user_id: string; full_name: string; email?: string };
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [assignments, setAssignments] = useState<Record<string, { selected: boolean; ratio: number }>>({});

  useEffect(() => {
    if (!canImport) return;
    (async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name, email');
      const list = (data ?? []) as TeamUser[];
      setTeamUsers(list);
      setAssignments(Object.fromEntries(list.map((u) => [u.user_id, { selected: false, ratio: 1 }])));
    })();
  }, [canImport]);

  if (!user) return <Navigate to="/" replace />;

  const buildLeads = (rows: string[][], map: LeadField[]): ParsedLead[] => {
    const get = (field: LeadField, cols: string[]) => {
      const i = map.findIndex((m) => m === field);
      return i >= 0 ? cleanValue(cols[i]) : '';
    };

    const batchTs = Date.now();
    return rows.map((cols, rowIdx) => {
      const name = get('customer_name', cols);
      const rawPhone = get('phone', cols);

      // Normalize phone (handles country code, Excel number formats and several numbers in one cell)
      let phone = pickPhone(rawPhone);

      // If phone is still missing or invalid → generate unique placeholder
      // so the record still imports and can be corrected later
      let phoneNote = '';
      if (!phone) {
        phone = `NOPHONE_${batchTs}_${rowIdx + 2}`;
        phoneNote = rawPhone.trim()
          ? `Invalid phone "${rawPhone}" — placeholder assigned`
          : 'No phone — placeholder assigned';
      }

      const email = get('email', cols);
      const car = get('car_interest', cols);
      const notes = get('notes', cols);
      const budget = get('budget', cols);
      const quoted_amount = get('quoted_amount', cols);
      const region = parseRegion(get('region', cols));
      const industry = get('industry', cols) || parseIndustry(get('industry', cols));
      const business_type = parseBusinessType(get('business_type', cols));
      const owner_name = get('owner_name', cols);
      const company = get('company', cols);
      const funnel_stage = parseFunnelStage(get('funnel_stage', cols));
      const lead_type = parseLeadType(get('lead_type', cols));
      const assigned_to_name = get('assigned_to_name', cols) || undefined;
      const assigned_to_email = get('assigned_to_email', cols) || undefined;
      const finalName = name || owner_name || company || 'Unknown';
      const extra_contacts = ['2', '3']
        .map((k) => ({
          name: get(`contact${k}_name` as LeadField, cols),
          designation: get(`contact${k}_designation` as LeadField, cols),
          phone: pickPhone(get(`contact${k}_phone` as LeadField, cols)) || get(`contact${k}_phone` as LeadField, cols),
          email: get(`contact${k}_email` as LeadField, cols),
          note: '',
        }))
        .filter((c) => c.name || c.phone || c.email || c.designation);

      return {
        designation: get('designation', cols) || undefined,
        website: get('website', cols) || undefined,
        city: get('city', cols) || undefined,
        state: get('state', cols) || undefined,
        pipeline: parsePipeline(get('pipeline', cols)) ?? undefined,
        heat: parseHeat(get('heat', cols)) ?? undefined,
        gst_rate: get('gst_rate', cols) || undefined,
        gst_number: get('gst_number', cols).toUpperCase() || undefined,
        expected_close_date: parseDate(get('expected_close_date', cols)) ?? undefined,
        next_follow_up: parseDate(get('next_follow_up', cols)) ?? undefined,
        boq_link: get('boq_link', cols) || undefined,
        event_name: get('event_name', cols) || undefined,
        extra_contacts: extra_contacts.length ? extra_contacts : undefined,
        customer_name: finalName, phone,
        email: email || undefined, car_interest: car || undefined,
        notes: notes || undefined, budget: budget || undefined,
        quoted_amount: quoted_amount || undefined,
        region: region ?? undefined, industry: industry ?? undefined,
        business_type: business_type ?? undefined,
        owner_name: owner_name || undefined, company: company || undefined,
        funnel_stage: funnel_stage ?? undefined,
        lead_type: lead_type || undefined,
        assigned_to_name,
        assigned_to_email,
        valid: true,
        error: phoneNote || undefined,
        _rowIndex: rowIdx + 2,
      };
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name); setImported(false); setMapped(false); setParsedLeads([]);

    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        let hdrs: string[];
        let rows: string[][];

        if (isExcel) {
          const data = new Uint8Array(evt.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const sheet: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          if (sheet.length < 2) {
            toast({ title: 'Empty file', description: 'File needs at least a header and one row', variant: 'destructive' });
            return;
          }
          hdrs = (sheet[0] as unknown[]).map((c) => String(c).trim());
          rows = sheet.slice(1)
            .filter((r) => (r as unknown[]).some((c) => String(c).trim() !== ''))
            .map((r) => hdrs.map((_, i) => String((r as unknown[])[i] ?? '')));
        } else {
          const text = evt.target?.result as string;
          const lines = text.trim().split(/\r?\n/);
          if (lines.length < 2) {
            toast({ title: 'Empty CSV', description: 'File needs at least a header and one row', variant: 'destructive' });
            return;
          }
          hdrs = splitCsvLine(lines[0]);
          rows = lines.slice(1).filter((l) => l.trim()).map(splitCsvLine);
        }

        setHeaders(hdrs);
        setRawRows(rows);
        setMapping(hdrs.map((h) => autoDetect(h)));
      } catch {
        toast({ title: 'Failed to read file', description: 'Please check the file format', variant: 'destructive' });
      }
    };

    if (isExcel) reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
  };

  const updateMapping = (idx: number, value: LeadField) => {
    setMapping((prev) => {
      const next = [...prev];
      // Ensure each field (except 'ignore') is mapped only once
      if (value !== 'ignore') {
        for (let i = 0; i < next.length; i++) if (i !== idx && next[i] === value) next[i] = 'ignore';
      }
      next[idx] = value;
      return next;
    });
  };

  const missingRequired = useMemo(() => {
    return [] as LeadField[]; // phone is no longer required — all records import with placeholder if missing
  }, [mapping]);

  const confirmMapping = () => {
    if (missingRequired.length > 0) {
      toast({ title: 'Required fields missing', description: `Please map: ${missingRequired.join(', ')}`, variant: 'destructive' });
      return;
    }
    const leads = buildLeads(rawRows, mapping);
    setParsedLeads(leads);
    setMapped(true);
    if (leads.length === 0) toast({ title: 'No leads found', description: 'Check your CSV format', variant: 'destructive' });
  };

  const resetFile = () => {
    setHeaders([]); setRawRows([]); setMapping([]); setMapped(false);
    setParsedLeads([]); setFileName(''); setImported(false); setFailedRecords([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImport = async () => {
    if (!user) return;
    const validLeads = parsedLeads; // all records are importable
    if (validLeads.length === 0) return;

    // Build assignment plan
    const selected = teamUsers
      .map((u) => ({ ...u, ratio: assignments[u.user_id]?.ratio ?? 0, on: assignments[u.user_id]?.selected }))
      .filter((u) => u.on && u.ratio > 0);

    let assigneeForIndex: (i: number) => string | null = () => null;
    if (canImport && selected.length > 0) {
      const totalRatio = selected.reduce((s, u) => s + u.ratio, 0);
      const n = validLeads.length;
      // Largest-remainder allocation
      const exact = selected.map((u) => ({ id: u.user_id, q: (u.ratio / totalRatio) * n }));
      const counts = exact.map((e) => Math.floor(e.q));
      let remaining = n - counts.reduce((s, c) => s + c, 0);
      const order = exact
        .map((e, i) => ({ i, frac: e.q - Math.floor(e.q) }))
        .sort((a, b) => b.frac - a.frac);
      for (let k = 0; k < order.length && remaining > 0; k++, remaining--) counts[order[k].i]++;
      const queue: string[] = [];
      counts.forEach((c, i) => { for (let k = 0; k < c; k++) queue.push(exact[i].id); });
      assigneeForIndex = (i) => queue[i] ?? null;
    } else if (!canImport) {
      assigneeForIndex = () => user.id;
    }

    setImporting(true);
    setImportProgress({ done: 0, total: 0 });
    setFailedRecords([]);
    try {
      const CHUNK = 500;

      const failures: { row: number; name: string; phone: string; reason: string }[] = [];

      // Duplicate phone checks skipped — import all leads regardless of duplicates
      const newLeads = validLeads;

      if (newLeads.length === 0) {
        setFailedRecords(failures);
        toast({ title: 'No new leads', description: 'All phone numbers already exist in the system.' });
        setImported(true);
        setImporting(false);
        return;
      }

      // Step 4: rebuild assignment queue for newLeads count
      let newAssigneeForIndex: (i: number) => string | null = () => null;
      if (canImport && selected.length > 0) {
        const totalRatio = selected.reduce((s, u) => s + u.ratio, 0);
        const n = newLeads.length;
        const exact = selected.map((u) => ({ id: u.user_id, q: (u.ratio / totalRatio) * n }));
        const counts = exact.map((e) => Math.floor(e.q));
        let remaining = n - counts.reduce((s, c) => s + c, 0);
        const order = exact.map((e, i) => ({ i, frac: e.q - Math.floor(e.q) })).sort((a, b) => b.frac - a.frac);
        for (let k = 0; k < order.length && remaining > 0; k++, remaining--) counts[order[k].i]++;
        const queue: string[] = [];
        counts.forEach((c, i) => { for (let k = 0; k < c; k++) queue.push(exact[i].id); });
        newAssigneeForIndex = (i) => queue[i] ?? null;
      } else if (!canImport) {
        newAssigneeForIndex = () => user.id;
      }

      // Step 5: insert in chunks of 500
      setImportProgress({ done: 0, total: newLeads.length });
      let inserted = 0;
      const skippedColumns = new Set<string>();
      for (let i = 0; i < newLeads.length; i += CHUNK) {
        const chunk = newLeads.slice(i, i + CHUNK);
        const rows = chunk.map((l, ci) => {
          const proposalValue = l.quoted_amount
            ? parseFloat(l.quoted_amount.replace(/[^0-9.]/g, '')) || 0
            : l.budget ? parseFloat(l.budget.replace(/[^0-9.]/g, '')) || 0 : 0;
          const stageMap: Record<string, string> = {
            new_lead: 'new_lead',
            qualification: 'qualified_lead',
            need_analysis: 'meeting_scheduled',
            proposal: 'proposal_submitted',
            negotiation: 'negotiation',
          };
          const row: Record<string, unknown> = {
            organization_name: l.company || l.owner_name || l.customer_name,
            contact_name: l.customer_name,
            phone: l.phone,
            email: l.email || null,
            industry: l.industry || 'Other',
            pipeline: l.pipeline || 'brand_approval',
            stage: l.pipeline === 'tender_consultancy' ? 'tender_identified' : (l.pipeline && l.pipeline !== 'brand_approval' ? 'new_lead' : stageMap[l.funnel_stage || ''] || 'new_lead'),
            website: l.website || null,
            city: l.city || null,
            state: l.state || null,
            gst_number: l.gst_number || null,
            boq_link: l.boq_link || null,
            event_name: l.event_name || null,
            expected_close_date: l.expected_close_date || null,
            next_follow_up_at: l.next_follow_up ? new Date(`${l.next_follow_up}T10:00:00`).toISOString() : null,
            proposal_gst_rate: proposalValue > 0 ? (Number(l.gst_rate) >= 0 && l.gst_rate !== undefined && l.gst_rate !== '' ? Number(l.gst_rate) : 18) : 0,
            contact_designation: l.designation || null,
            contacts: l.extra_contacts || [],
            ...(l.heat ? { heat: l.heat } : {}),
            service_interest: l.car_interest ? [l.car_interest] : [],
            notes: l.notes || null,
            proposal_value: proposalValue,
            expected_revenue: 0,
            probability: 0,
            source: sourcePortal,
            campaign_name: subCategory.trim() || null,
            assigned_to: user.id,
            created_by: user.id,
          };
          // CSV-level assignment takes priority over the ratio assignment panel
          if (l.assigned_to_email || l.assigned_to_name) {
            const assignEmail = l.assigned_to_email?.toLowerCase().trim();
            const assignName = l.assigned_to_name?.toLowerCase().trim();
            const matched = teamUsers.find((u) => {
              const uEmail = (u.email ?? '').toLowerCase().trim();
              const uFull = u.full_name.toLowerCase().trim();
              const uParts = uFull.split(' ');
              // 1. Exact email match
              if (assignEmail && uEmail && uEmail === assignEmail) return true;
              // 2. Email prefix match (e.g. "kamal" matches "kamal@kitchenrama.com")
              if (assignName && uEmail && uEmail.startsWith(assignName + '@')) return true;
              if (assignName) {
                // 3. Full name exact or first name exact
                if (uFull === assignName || uParts[0] === assignName) return true;
                // 4. All words in assignName appear in user full name (handles "Neha Kohli" → "Neha Koli")
                const assignParts = assignName.split(' ').filter(Boolean);
                if (assignParts.length > 1 && assignParts.every((w) => uParts.some((p) => p.startsWith(w) || w.startsWith(p)))) return true;
                // 5. assignName is a prefix of user first name (e.g. "kamal" prefix of "kamaljeet")
                if (uParts[0].startsWith(assignName) && assignName.length >= 4) return true;
              }
              return false;
            });
            if (matched) row.assigned_to = matched.user_id;
          } else {
            const assignee = newAssigneeForIndex(i + ci);
            if (assignee) row.assigned_to = assignee;
          }
          return row;
        });
        // A column the database does not have yet is dropped instead of failing the whole import.
        const { result, skipped } = await writeManyWithFallback((body) => supabase.from('b2g_leads' as any).insert(body as any), rows);
        if (result.error) throw result.error;
        skipped.forEach((column) => skippedColumns.add(column));
        inserted += chunk.length;
        setImportProgress({ done: inserted, total: newLeads.length });
      }

      setFailedRecords(failures);
      setImported(true);
      const skipped = validLeads.length - newLeads.length;
      toast({
        title: `${inserted} leads imported!`,
        description: skipped > 0 ? `${skipped} skipped (already exist)` : skippedMessage(Array.from(skippedColumns)),
      });
    } catch (err: any) {
      toast({ title: 'Import failed', description: err.message, variant: 'destructive' });
    } finally { setImporting(false); }
  };

  const downloadSample = (format: 'xlsx' | 'csv' = 'xlsx') => {
    if (format === 'xlsx') {
      const sheet = XLSX.utils.aoa_to_sheet([SAMPLE_HEADERS, ...SAMPLE_ROWS]);
      sheet['!cols'] = SAMPLE_HEADERS.map((header) => ({ wch: Math.max(16, header.length + 2) }));
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, 'Leads');
      XLSX.writeFile(book, 'sample_leads.xlsx');
      return;
    }
    const blob = new Blob(['﻿' + SAMPLE_CSV], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'sample_leads.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const validCount = parsedLeads.length; // all records are importable now
  const noPhoneCount = parsedLeads.filter((l) => l.phone.startsWith('NOPHONE_')).length;

  return (
    <div className="max-w-lg mx-auto lg:max-w-5xl animate-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-b-[2rem] px-5 pb-8 lg:pb-6 lg:rounded-2xl lg:mx-4 lg:mt-4" style={{ background: 'var(--gradient-header)', paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.5rem)' }}>
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-30" style={{ background: 'radial-gradient(circle, var(--blob-blue), transparent 70%)' }} />
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-foreground/60 hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="h-5 w-5" /><span className="text-[15px] font-medium">Back</span>
        </button>
        <h1 className="text-xl font-bold text-foreground">Import Leads</h1>
        <p className="text-muted-foreground text-[15px] mt-1">Upload CSV or Excel (.xlsx) to bulk import leads</p>
      </div>

      <div className="px-4 -mt-4 lg:mt-4 space-y-4 pb-6">
        {/* Step 1: Source */}
        <Card className="shadow-card border-0 rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-[13px] font-bold text-primary">1</div>
              <p className="text-[15px] font-semibold text-foreground">Select Source Portal</p>
            </div>
            <Select value={sourcePortal} onValueChange={(v) => setSourcePortal(v as SourcePortal)}>
              <SelectTrigger className="h-11 rounded-xl border-border/60"><SelectValue /></SelectTrigger>
              <SelectContent>{SOURCE_PORTALS.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}</SelectContent>
            </Select>
            <p className="text-[13px] text-muted-foreground mt-2">All imported leads will be tagged as <span className="font-medium text-foreground">{SOURCE_PORTALS.find(s => s.value === sourcePortal)?.label}</span></p>

            {/* Sub-Category / Campaign Name */}
            <div className="mt-4 border-t border-border/40 pt-4">
              <p className="text-[14px] font-semibold text-foreground mb-1">Sub-Category / Campaign Name</p>
              <Input
                placeholder="e.g. IIM Campaign, Delhi Exhibition 2024, Meta Ads Feb..."
                value={subCategory}
                onChange={(e) => setSubCategory(e.target.value)}
                className="h-11 rounded-xl border-border/60 text-[14px]"
              />
              <p className="text-[12px] text-muted-foreground mt-1.5">
                Tagged leads will be <span className="font-medium text-amber-600">highlighted in amber</span> and shown at the bottom of the leads list for easy identification.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Upload */}
        <Card className="shadow-card border-0 rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-[13px] font-bold text-primary">2</div>
              <p className="text-[15px] font-semibold text-foreground">Upload CSV or Excel File</p>
            </div>
            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileSelect} className="hidden" />
            {!fileName ? (
              <div onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-primary/20 rounded-2xl p-10 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all duration-200">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                <p className="font-semibold text-[15px] text-foreground">Upload CSV or Excel File</p>
                <p className="text-[13px] text-muted-foreground mt-1">Supports .csv, .xlsx, .xls</p>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3.5 bg-muted/50 rounded-xl">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[15px] text-foreground truncate">{fileName}</p>
                  <p className="text-[13px] text-muted-foreground">{rawRows.length} rows • {headers.length} columns</p>
                </div>
                <Button variant="outline" size="sm" className="rounded-xl text-[13px]" onClick={resetFile}>Change</Button>
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
              <button onClick={() => downloadSample('xlsx')} className="flex items-center gap-1.5 text-[13px] text-primary font-medium hover:underline underline-offset-2">
                <Download className="h-3 w-3" /> Download sample Excel
              </button>
              <button onClick={() => downloadSample('csv')} className="flex items-center gap-1.5 text-[13px] text-muted-foreground font-medium hover:underline underline-offset-2">
                <Download className="h-3 w-3" /> or CSV
              </button>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">The sample has every Add-opportunity field, plus up to 2 extra contacts — fill it in and upload it as it is.</p>
          </CardContent>
        </Card>

        {/* Step 3: Column Mapping */}
        {headers.length > 0 && !mapped && (
          <Card className="shadow-card border-0 rounded-2xl">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-[13px] font-bold text-primary">3</div>
                  <p className="text-[15px] font-semibold text-foreground">Map Columns</p>
                </div>
                <span className="text-[12px] text-muted-foreground">{headers.length} columns detected</span>
              </div>
              <p className="text-[13px] text-muted-foreground mb-3 ml-9">Match each column to a lead field. <span className="text-destructive">*</span> required. Scroll to see all columns.</p>

              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1 scrollbar-thin">
                {headers.map((header, idx) => {
                  const rawSample = rawRows[0]?.[idx] ?? '';
                  const sample = cleanValue(rawSample);
                  const isMapped = mapping[idx] !== 'ignore' && mapping[idx] !== undefined;
                  return (
                    <div key={idx} className={`flex items-center gap-2 p-2.5 rounded-xl transition-colors ${isMapped ? 'bg-primary/8 border border-primary/20' : 'bg-muted/30'}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-foreground truncate">{header || `Column ${idx + 1}`}</p>
                        {sample ? (
                          <p className="text-[11px] text-muted-foreground truncate">e.g. {sample}</p>
                        ) : (
                          <p className="text-[11px] text-muted-foreground/50 truncate italic">empty</p>
                        )}
                      </div>
                      <ArrowRight className={`h-3.5 w-3.5 shrink-0 ${isMapped ? 'text-primary' : 'text-muted-foreground'}`} />
                      <Select value={mapping[idx] ?? 'ignore'} onValueChange={(v) => updateMapping(idx, v as LeadField)}>
                        <SelectTrigger className={`h-9 w-[150px] rounded-lg text-[13px] shrink-0 ${isMapped ? 'border-primary/40 text-primary font-medium' : ''}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FIELD_OPTIONS.map((f) => (
                            <SelectItem key={f.value} value={f.value} className="text-[13px]">
                              {f.label}{f.required && ' *'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>

              {missingRequired.length > 0 && (
                <div className="mt-3 flex items-start gap-2 p-3 bg-destructive/5 border border-destructive/20 rounded-xl">
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-[13px] text-destructive">Required field{missingRequired.length > 1 ? 's' : ''} not mapped: <span className="font-semibold">{missingRequired.map(r => FIELD_OPTIONS.find(f => f.value === r)?.label).join(', ')}</span></p>
                </div>
              )}

              <Button className="w-full h-11 rounded-xl text-[14px] font-semibold mt-4"
                style={{ background: 'var(--gradient-primary)' }}
                onClick={confirmMapping} disabled={missingRequired.length > 0}>
                Confirm Mapping & Preview
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Preview */}
        {mapped && parsedLeads.length > 0 && !imported && (
          <>
            <Card className="shadow-card border-0 rounded-2xl overflow-hidden">
              <CardContent className="p-0">
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[15px] font-semibold text-foreground">Preview</h3>
                    <button onClick={() => setMapped(false)} className="text-[12px] text-primary font-medium hover:underline">Edit mapping</button>
                  </div>
                  <div className="flex gap-2">
                    <Badge className="bg-primary/10 text-primary border-0 text-[13px] gap-1 rounded-lg">
                      <CheckCircle2 className="h-3 w-3" /> {parsedLeads.length} ready
                    </Badge>
                    {parsedLeads.filter(l => l.error).length > 0 && (
                      <Badge className="bg-amber-100 text-amber-700 border-0 text-[13px] gap-1 rounded-lg dark:bg-amber-900/30 dark:text-amber-400">
                        <AlertCircle className="h-3 w-3" /> {parsedLeads.filter(l => l.error).length} no phone
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/30">
                        <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider">Name</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider">Phone</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider">Equipment</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedLeads.slice(0, 15).map((lead, i) => (
                        <TableRow key={i} className="border-border/20">
                          <TableCell className="py-2.5">
                            {lead.error
                              ? <span title={lead.error}><AlertCircle className="h-4 w-4 text-amber-500" /></span>
                              : <CheckCircle2 className="h-4 w-4 text-primary" />}
                          </TableCell>
                          <TableCell className="text-[13px] py-2.5 font-medium">{lead.customer_name}</TableCell>
                          <TableCell className="text-[13px] py-2.5 text-muted-foreground">
                            {lead.phone.startsWith('NOPHONE_') ? <span className="italic text-amber-500">no phone</span> : lead.phone}
                          </TableCell>
                          <TableCell className="text-[13px] py-2.5 text-muted-foreground">{lead.car_interest ?? '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {parsedLeads.length > 15 && <p className="text-[13px] text-muted-foreground text-center py-3">+{parsedLeads.length - 15} more</p>}
                </div>
              </CardContent>
            </Card>
            {canImport && teamUsers.length > 0 && (
              <Card className="shadow-card border-0 rounded-2xl">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-[15px] font-semibold text-foreground">Assign Leads</p>
                  </div>
                  <p className="text-[13px] text-muted-foreground mb-3 ml-9">Select users and set a ratio. Leads will be distributed proportionally.</p>
                  {(() => {
                    const selected = teamUsers.filter((u) => assignments[u.user_id]?.selected && (assignments[u.user_id]?.ratio ?? 0) > 0);
                    const total = selected.reduce((s, u) => s + (assignments[u.user_id]?.ratio ?? 0), 0);
                    return (
                      <div className="space-y-2">
                        {teamUsers.map((u) => {
                          const a = assignments[u.user_id] ?? { selected: false, ratio: 1 };
                          const share = a.selected && total > 0 ? Math.round(((a.ratio / total) * validCount)) : 0;
                          return (
                            <div key={u.user_id} className="flex items-center gap-3 p-2.5 bg-muted/30 rounded-xl">
                              <Checkbox checked={a.selected} onCheckedChange={(v) => setAssignments((p) => ({ ...p, [u.user_id]: { ...a, selected: !!v } }))} />
                              <p className="flex-1 text-[13px] font-medium text-foreground truncate">{u.full_name}</p>
                              {a.selected && (
                                <>
                                  <span className="text-[11px] text-muted-foreground">~{share}</span>
                                  <Input type="number" min={1} value={a.ratio}
                                    onChange={(e) => setAssignments((p) => ({ ...p, [u.user_id]: { ...a, ratio: Math.max(1, parseInt(e.target.value) || 1) } }))}
                                    className="h-9 w-16 rounded-lg text-[13px]" />
                                </>
                              )}
                            </div>
                          );
                        })}
                        {selected.length === 0 && (
                          <p className="text-[12px] text-muted-foreground italic">No users selected — leads will be unassigned.</p>
                        )}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            )}
            <Button className="w-full h-12 rounded-xl text-[15px] font-semibold shadow-lg shadow-primary/20"
              style={{ background: 'var(--gradient-primary)' }} onClick={handleImport} disabled={importing || validCount === 0}>
              {importing
              ? <span className="flex items-center gap-2"><div className="h-5 w-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />{importProgress.total > 0 ? `Importing… ${importProgress.done} / ${importProgress.total}` : 'Checking duplicates…'}</span>
              : `Import ${validCount} Leads${noPhoneCount > 0 ? ` (${noPhoneCount} no phone)` : ''}`}
            </Button>
          </>
        )}

        {/* Success */}
        {imported && (
          <>
            <Card className="shadow-card border-0 rounded-2xl overflow-hidden">
              <div className="h-1 w-full" style={{ background: 'var(--gradient-booking)' }} />
              <CardContent className="p-6 text-center">
                <div className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--gradient-booking)' }}>
                  <CheckCircle2 className="h-8 w-8 text-white" />
                </div>
                <p className="font-bold text-foreground text-lg">Import Complete!</p>
                <div className="flex justify-center gap-4 mt-3">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-primary">{parsedLeads.length - failedRecords.length}</p>
                    <p className="text-[12px] text-muted-foreground">Imported</p>
                  </div>
                  {noPhoneCount > 0 && (
                    <div className="text-center">
                      <p className="text-2xl font-bold text-amber-500">{noPhoneCount}</p>
                      <p className="text-[12px] text-muted-foreground">No phone (placeholder)</p>
                    </div>
                  )}
                  {failedRecords.length > 0 && (
                    <div className="text-center">
                      <p className="text-2xl font-bold text-destructive">{failedRecords.length}</p>
                      <p className="text-[12px] text-muted-foreground">Skipped (duplicates)</p>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 mt-5">
                  <Button variant="outline" className="flex-1 h-11 rounded-xl" onClick={resetFile}>Import More</Button>
                  <Button className="flex-1 h-11 rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={() => navigate('/leads')}>View Leads</Button>
                </div>
              </CardContent>
            </Card>

            {/* Failed Records Report */}
            {failedRecords.length > 0 && (
              <Card className="shadow-card border-0 rounded-2xl overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-border/20">
                    <div>
                      <p className="text-[15px] font-semibold text-foreground flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-destructive" />
                        Failed / Skipped Records
                      </p>
                      <p className="text-[12px] text-muted-foreground mt-0.5">{failedRecords.length} records — fix and re-import</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl text-[13px] gap-1.5"
                      onClick={() => {
                        const header = 'Row,Name,Phone,Reason\n';
                        const rows = failedRecords.map(f => `${f.row},"${f.name}","${f.phone}","${f.reason}"`).join('\n');
                        const blob = new Blob([header + rows], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a'); a.href = url; a.download = 'failed_records.csv'; a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      <Download className="h-3.5 w-3.5" /> Download CSV
                    </Button>
                  </div>
                  <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border/30">
                          <TableHead className="text-[11px] uppercase tracking-wider w-14">Row</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wider">Name</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wider">Phone</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wider">Reason</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {failedRecords.slice(0, 100).map((f, i) => (
                          <TableRow key={i} className="border-border/20">
                            <TableCell className="text-[12px] text-muted-foreground py-2">{f.row}</TableCell>
                            <TableCell className="text-[13px] font-medium py-2">{f.name}</TableCell>
                            <TableCell className="text-[12px] text-muted-foreground py-2">{f.phone || '—'}</TableCell>
                            <TableCell className="py-2">
                              <Badge className={`text-[11px] rounded-lg border-0 ${
                                f.reason.includes('already exists') ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                f.reason.includes('Duplicate') ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                'bg-destructive/10 text-destructive'
                              }`}>
                                {f.reason}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {failedRecords.length > 100 && (
                      <p className="text-[12px] text-muted-foreground text-center py-3">
                        Showing 100 of {failedRecords.length} — download CSV for full list
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ImportLeads;
