// Deterministic quotation maths. All money is computed in integer paise to avoid float drift.
// Rules mirror the app: b2g_proposals.gst_amount = round(subtotal * gst_rate / 100, 2), default GST 18%,
// and the proposal's `subtotal` is the taxable value (after discount). Margin = taxable value - cost
// (cost is supplied excluding GST). Nothing here invents a discount policy or a missing cost.

export const DEFAULT_GST_RATE = 18;

export type OptionInput = {
  name: string;
  list_price: number;           // INR, before discount and GST
  discount_pct?: number;        // 0-100
  cost?: number;                // INR excl. GST; unknown => margin not computed
  gst_rate?: number;            // percent
};

export type OptionResult = {
  name: string;
  list_price: number;
  discount_pct: number;
  discount_amount: number;
  taxable_value: number;
  gst_rate: number;
  gst_amount: number;
  total_with_gst: number;
  cost: number | null;
  margin_amount: number | null;
  margin_pct: number | null;
  budget: number | null;
  taxable_minus_budget: number | null;
  total_minus_budget: number | null;
  notes: string[];
};

const toPaise = (rupees: number) => Math.round(rupees * 100);
const toRupees = (paise: number) => paise / 100;
const roundHalfUp = (n: number) => Math.round(n);

export function calculateOption(input: OptionInput, budget?: number | null, defaultGst = DEFAULT_GST_RATE): OptionResult {
  const notes: string[] = [];
  const list = toPaise(input.list_price);
  const pct = input.discount_pct ?? 0;
  const discount = roundHalfUp((list * pct) / 100);
  const taxable = list - discount;
  const gstRate = input.gst_rate ?? defaultGst;
  if (input.gst_rate === undefined) notes.push(`GST ${defaultGst}% assumed (app default); confirm the rate.`);
  const gst = roundHalfUp((taxable * gstRate) / 100);
  const total = taxable + gst;
  let margin: number | null = null;
  let marginPct: number | null = null;
  if (input.cost !== undefined) {
    margin = taxable - toPaise(input.cost);
    marginPct = taxable > 0 ? Math.round((margin / taxable) * 10000) / 100 : null;
    if (margin < 0) notes.push("Taxable value is below cost: this option loses money.");
  } else {
    notes.push("Cost not provided: margin not calculated.");
  }
  const b = budget && budget > 0 ? toPaise(budget) : null;
  return {
    name: input.name,
    list_price: toRupees(list),
    discount_pct: pct,
    discount_amount: toRupees(discount),
    taxable_value: toRupees(taxable),
    gst_rate: gstRate,
    gst_amount: toRupees(gst),
    total_with_gst: toRupees(total),
    cost: input.cost !== undefined ? input.cost : null,
    margin_amount: margin === null ? null : toRupees(margin),
    margin_pct: marginPct,
    budget: b === null ? null : toRupees(b),
    taxable_minus_budget: b === null ? null : toRupees(taxable - b),
    total_minus_budget: b === null ? null : toRupees(total - b),
    notes,
  };
}

/**
 * Discount policy. The repository defines no discount rules, so the default is that ANY discount
 * needs explicit user confirmation. An admin can raise the automatic ceiling by setting
 * integration_settings(provider='openai').config.max_auto_discount_pct.
 */
export function discountNeedsConfirmation(discountPct: number | undefined, maxAutoPct: number): boolean {
  return (discountPct ?? 0) > maxAutoPct;
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
