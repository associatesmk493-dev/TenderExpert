import { describe, expect, it } from 'vitest';
import type { DashActivity, DashLead, DashOrder } from '@/lib/mecaCache';
import { filterFinanceLeads, filterFinanceOrders, sumTotalSales } from '@/lib/salesFinancials';

const lead = (overrides: Partial<DashLead> = {}): DashLead => ({
  id: 'lead-1',
  assigned_to: 'user-1',
  funnel_stage: 'closure_order_1',
  walkin_date: null,
  booking_date: null,
  finance_updated_at: null,
  created_at: '2026-06-01T10:00:00.000Z',
  updated_at: '2026-07-20T10:00:00.000Z',
  quoted_amount: 0,
  closed_amount: 500_000,
  margin_percent: null,
  advance_amount: null,
  before_delivery_amount: null,
  after_delivery_amount: null,
  ...overrides,
});

const activity = (overrides: Partial<DashActivity> = {}): DashActivity => ({
  lead_id: 'lead-1',
  activity_type: 'update',
  description: 'Stage → closure_order_1',
  created_at: '2026-07-07T10:00:00.000Z',
  ...overrides,
});

const order = (overrides: Partial<DashOrder> = {}): DashOrder => ({
  id: 'order-1',
  lead_id: 'lead-1',
  quoted_amount: null,
  closed_amount: 250_000,
  advance_amount: null,
  before_delivery_amount: null,
  after_delivery_amount: null,
  created_at: '2026-07-08T10:00:00.000Z',
  updated_at: '2026-07-08T10:00:00.000Z',
  ...overrides,
});

describe('shared sales financial calculations', () => {
  const start = new Date('2026-07-05T00:00:00');
  const end = new Date('2026-07-11T00:00:00');

  it('includes an older lead when its close activity is inside the range', () => {
    expect(filterFinanceLeads([lead()], [activity()], start, end)).toHaveLength(1);
  });

  it('excludes a lead when its financial date is outside the range', () => {
    expect(filterFinanceLeads([lead()], [activity({ created_at: '2026-07-12T10:00:00.000Z' })], start, end)).toHaveLength(0);
  });

  it('includes repeat orders and uses closed amounts for total sales', () => {
    const financeLeads = filterFinanceLeads([lead()], [activity()], start, end);
    const financeOrders = filterFinanceOrders([order()], start, end);
    expect(sumTotalSales(financeLeads, financeOrders)).toBe(750_000);
  });
});
