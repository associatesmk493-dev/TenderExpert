/* eslint-disable @typescript-eslint/no-explicit-any */
// Reads the client's "Current Sites" Excel sheet (one block of rows per site) so it can be loaded once.

export type ParsedSite = {
  month: string;
  site_name: string;
  division: string;
  tender_title: string;
  estimated_value: number;
  approved_fund: string;
  offices: string[];
  status_log: string[];
  parties: string[];
  documents: { name: string; status: string }[];
  boq_items: any[];
  conversation: string;
  calculations: { name: string; lines: { label: string; kind: 'in' | 'out'; amount: number; note: string }[] }[];
};

const text = (value: any) => (value === null || value === undefined ? '' : String(value).replace(/\s+/g, ' ').trim());
const num = (value: any): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const cleaned = text(value).replace(/[₹,\s]/g, '');
  if (!cleaned || !/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  return Number(cleaned);
};
const unique = (items: string[]) => Array.from(new Set(items.filter(Boolean)));
const normalise = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();

export const siteKey = (site: { month?: string | null; site_name?: string | null; tender_title?: string | null }) =>
  [site.month, site.site_name, site.tender_title].map((part) => normalise(String(part || ''))).join('|');

const DOC_STATUS: Record<string, string> = { done: 'done', pending: 'pending', awaited: 'awaited', 'not required': 'not_required' };

export async function parseCurrentSites(buffer: ArrayBuffer): Promise<ParsedSite[]> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames.find((name) => /current/i.test(name)) || workbook.SheetNames[0];
  const rows: any[][] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: true });

  const headerIndex = rows.slice(0, 20).findIndex((row) => row.some((cell) => normalise(text(cell)) === 'site') && row.some((cell) => normalise(text(cell)).startsWith('scope')));
  if (headerIndex < 0) throw new Error('This does not look like the Current Sites sheet (the “Site” and “Scope of work” headings were not found).');

  const header = rows[headerIndex].map((cell) => normalise(text(cell)));
  const find = (predicate: (value: string) => boolean, from = 0) => {
    for (let index = from; index < header.length; index++) if (predicate(header[index])) return index;
    return -1;
  };
  const col = {
    month: find((h) => h === 'month'),
    cost: find((h) => h.startsWith('tentative')),
    site: find((h) => h === 'site'),
    division: find((h) => h === 'division'),
    office: find((h) => h === 'office'),
    scope: find((h) => h.startsWith('scope')),
    status: find((h) => h === 'status'),
    fund: find((h) => h.startsWith('approved')),
    parties: find((h) => h === 'parties'),
    document: find((h) => h === 'document'),
    boqItem: find((h) => h.startsWith('boq item')),
    brand: find((h) => h === 'brand'),
    qty: find((h) => h === 'qty'),
    unit: find((h) => h === 'unit'),
    amount: find((h) => h === 'amount'),
    conversation: find((h) => h.startsWith('conversation')),
    calc: find((h) => h.startsWith('project calc')),
  };
  const docStatus = col.document >= 0 ? find((h) => h === 'status', col.document + 1) : -1;
  const cell = (row: any[], index: number) => (index >= 0 ? row[index] : '');

  const blocks: any[][][] = [];
  for (const row of rows.slice(headerIndex + 1)) {
    if (text(cell(row, col.site))) blocks.push([row]);
    else if (blocks.length) blocks[blocks.length - 1].push(row);
  }

  let lastMonth = '';
  const sites: ParsedSite[] = [];
  for (const block of blocks) {
    const first = block[0];
    const month = text(cell(first, col.month)) || lastMonth;
    lastMonth = month;

    const calcOptions: Record<string, ParsedSite['calculations'][number]['lines']> = { 'Option 1': [], 'Option 2': [], Final: [] };
    const addLine = (option: string, label: string, value: number | null, note: string) => {
      if (!label || value === null || /^(grand total|net profit|total)$/i.test(label)) return;
      calcOptions[option].push({ label, kind: value < 0 ? 'out' : 'in', amount: Math.abs(value), note });
    };
    for (const row of block) {
      if (col.calc < 0) break;
      const label = text(row[col.calc]);
      addLine('Option 1', label, num(row[col.calc + 1]), text(row[col.calc + 2]));
      addLine('Option 2', label, num(row[col.calc + 3]), '');
      addLine('Final', text(row[col.calc + 6]), num(row[col.calc + 7]), text(row[col.calc + 8]));
    }

    const boq = block
      .filter((row) => text(cell(row, col.boqItem)))
      .map((row) => ({
        item: text(cell(row, col.boqItem)),
        make: text(cell(row, col.brand)),
        qty: num(cell(row, col.qty)) ?? 0,
        unit: text(cell(row, col.unit)),
        // The sheet's "Amount" is the price per unit; the line total is qty × rate.
        rate: num(cell(row, col.amount)) ?? 0,
        amount: (Number(num(cell(row, col.qty))) > 0 ? Number(num(cell(row, col.qty))) : 1) * (num(cell(row, col.amount)) ?? 0),
        commercial_model: '',
        expected_profit: 0,
      }));

    const fund = block.map((row) => cell(row, col.fund)).find((value) => text(value));
    sites.push({
      month,
      site_name: text(cell(first, col.site)),
      division: text(block.map((row) => text(cell(row, col.division))).find(Boolean) || ''),
      tender_title: text(block.map((row) => text(cell(row, col.scope))).find(Boolean) || ''),
      estimated_value: num(block.map((row) => cell(row, col.cost)).find((value) => num(value) !== null)) ?? 0,
      approved_fund: fund === undefined ? '' : text(fund),
      offices: unique(block.map((row) => text(cell(row, col.office)))),
      status_log: block.map((row) => text(cell(row, col.status))).filter(Boolean),
      parties: unique(block.map((row) => text(cell(row, col.parties)))),
      documents: block
        .filter((row) => text(cell(row, col.document)))
        .map((row) => ({ name: text(cell(row, col.document)), status: DOC_STATUS[normalise(text(cell(row, docStatus)))] || 'pending' })),
      boq_items: boq,
      conversation: block.map((row) => text(cell(row, col.conversation))).filter(Boolean).join('\n'),
      calculations: Object.entries(calcOptions)
        .filter(([, lines]) => lines.length)
        .map(([name, lines]) => ({ name, lines })),
    });
  }
  return sites;
}
