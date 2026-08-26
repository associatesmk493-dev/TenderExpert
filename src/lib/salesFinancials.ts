import { endOfDay, isValid, isWithinInterval, parseISO, startOfDay } from 'date-fns';
import type { DashActivity, DashLead, DashOrder } from '@/lib/mecaCache';

function inRange(dateStr: string | null | undefined, start: Date, end: Date): boolean {
  if (!dateStr) return false;
  const date = parseISO(dateStr);
  if (!isValid(date)) return false;
  return isWithinInterval(date, { start: startOfDay(start), end: endOfDay(end) });
}

// The activity log is the reliable close-date signal for imported/older leads.
// Generic updated_at can change for unrelated edits.
export function getClosedAtByLead(activities: DashActivity[]): Map<string, string> {
  const closedAt = new Map<string, string>();

  for (const activity of activities) {
    const isWonStage = activity.description === 'Stage → closure_order_1'
      || activity.description === 'Stage → delivered'
      || activity.description === 'Stage → post_sale';
    const isAmountEdit = (activity.description?.toLowerCase() ?? '').includes('amount updated');
    if (!isWonStage && !isAmountEdit) continue;

    const existing = closedAt.get(activity.lead_id);
    if (!existing || activity.created_at > existing) {
      closedAt.set(activity.lead_id, activity.created_at);
    }
  }

  return closedAt;
}

export function filterFinanceLeads(
  leads: DashLead[],
  activities: DashActivity[],
  startDate?: Date,
  endDate?: Date,
): DashLead[] {
  if (!startDate || !endDate) return leads;
  const closedAtByLead = getClosedAtByLead(activities);

  return leads.filter((lead) => inRange(
    lead.booking_date
      ?? closedAtByLead.get(lead.id)
      ?? lead.finance_updated_at
      ?? lead.created_at,
    startDate,
    endDate,
  ));
}

export function filterFinanceOrders(
  orders: DashOrder[],
  startDate?: Date,
  endDate?: Date,
): DashOrder[] {
  if (!startDate || !endDate) return orders;
  return orders.filter((order) => inRange(order.updated_at ?? order.created_at, startDate, endDate));
}

export function sumTotalSales(leads: DashLead[], orders: DashOrder[]): number {
  return leads.reduce((sum, lead) => sum + (lead.closed_amount ?? 0), 0)
    + orders.reduce((sum, order) => sum + (order.closed_amount ?? 0), 0);
}
