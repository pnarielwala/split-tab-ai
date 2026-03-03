'use server';

import { createClient } from '@/lib/supabase/server';
import type {
  Bill,
  BillTotal,
  LineItemWithClaims,
  BillMemberWithProfile,
  Profile,
  ParticipantShare,
} from '@/types/database';

export type DashboardBill = Bill & { bill_totals: BillTotal | null };

export type BillPageData = {
  lineItems: LineItemWithClaims[];
  totals: BillTotal | null;
  members: BillMemberWithProfile[];
  ownerProfile: Profile;
  shares: ParticipantShare[];
};

export type SplitPageData = {
  lineItems: LineItemWithClaims[];
  totals: BillTotal | null;
  members: BillMemberWithProfile[];
  ownerProfile: Profile;
};

export async function getDashboardBills(): Promise<DashboardBill[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const currentUserId = user?.id ?? '';

  const { data: ownedBills } = await supabase
    .from('bills')
    .select('*, bill_totals(*)')
    .eq('owner_id', currentUserId)
    .order('created_at', { ascending: false });

  const { data: memberships } = await supabase
    .from('bill_members')
    .select('bill_id, bills(*, bill_totals(*))')
    .eq('user_id', currentUserId);

  const billMap = new Map<string, DashboardBill>();

  for (const bill of ownedBills ?? []) {
    const totals = Array.isArray(bill.bill_totals)
      ? (bill.bill_totals[0] ?? null)
      : bill.bill_totals;
    billMap.set(bill.id, { ...bill, bill_totals: totals });
  }

  for (const m of memberships ?? []) {
    const bill = (m.bills as unknown) as
      | (Bill & { bill_totals: BillTotal | BillTotal[] | null })
      | null;
    if (!bill || billMap.has(bill.id)) continue;
    const totals = Array.isArray(bill.bill_totals)
      ? (bill.bill_totals[0] ?? null)
      : bill.bill_totals;
    billMap.set(bill.id, { ...bill, bill_totals: totals });
  }

  return Array.from(billMap.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function getBillPageData(billId: string): Promise<BillPageData | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: bill } = await supabase
    .from('bills')
    .select('*')
    .eq('id', billId)
    .single();
  if (!bill) return null;

  const [
    { data: lineItemsRaw },
    { data: totals },
    { data: membersRaw },
    { data: ownerProfile },
  ] = await Promise.all([
    supabase
      .from('line_items')
      .select('*, bill_item_claims(*, profiles(*))')
      .eq('bill_id', billId)
      .order('sort_order', { ascending: true }),
    supabase.from('bill_totals').select('*').eq('bill_id', billId).single(),
    supabase.from('bill_members').select('*, profiles(*)').eq('bill_id', billId),
    supabase.from('profiles').select('*').eq('id', bill.owner_id).single(),
  ]);

  const lineItems = (lineItemsRaw ?? []) as LineItemWithClaims[];
  const members = (membersRaw ?? []) as BillMemberWithProfile[];

  const participantMap = new Map<string, string>();
  participantMap.set(bill.owner_id, ownerProfile?.display_name ?? 'Owner');
  for (const m of members) {
    participantMap.set(m.user_id, m.profiles.display_name);
  }

  const billSubtotal = totals?.subtotal ?? 0;
  const billTax = totals?.tax ?? 0;
  const billGratuity = totals?.gratuity ?? 0;
  const subtotals = new Map<string, number>();
  for (const item of lineItems) {
    const count = item.bill_item_claims.length;
    if (count === 0) continue;
    const share = item.total_price / count;
    for (const claim of item.bill_item_claims) {
      subtotals.set(claim.user_id, (subtotals.get(claim.user_id) ?? 0) + share);
    }
  }

  const shares: ParticipantShare[] = [];
  for (const [userId, displayName] of participantMap.entries()) {
    const sub = subtotals.get(userId) ?? 0;
    if (sub === 0) continue;
    const ratio = billSubtotal > 0 ? sub / billSubtotal : 0;
    shares.push({
      userId,
      displayName,
      subtotal: sub,
      tax: billTax * ratio,
      gratuity: billGratuity * ratio,
      total: sub + billTax * ratio + billGratuity * ratio,
    });
  }
  shares.sort((a, b) => b.total - a.total);

  return {
    lineItems,
    totals: totals ?? null,
    members,
    ownerProfile: (ownerProfile ?? {
      id: bill.owner_id,
      email: null,
      display_name: 'Owner',
    }) as Profile,
    shares,
  };
}

export async function getSplitPageData(billId: string): Promise<SplitPageData | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: bill } = await supabase
    .from('bills')
    .select('owner_id')
    .eq('id', billId)
    .single();
  if (!bill) return null;

  const [
    { data: lineItemsRaw },
    { data: totals },
    { data: membersRaw },
    { data: ownerProfileRaw },
  ] = await Promise.all([
    supabase
      .from('line_items')
      .select('*, bill_item_claims(*, profiles(*))')
      .eq('bill_id', billId)
      .order('sort_order', { ascending: true }),
    supabase.from('bill_totals').select('*').eq('bill_id', billId).single(),
    supabase.from('bill_members').select('*, profiles(*)').eq('bill_id', billId),
    supabase.from('profiles').select('*').eq('id', bill.owner_id).single(),
  ]);

  return {
    lineItems: (lineItemsRaw ?? []) as LineItemWithClaims[],
    totals: totals ?? null,
    members: (membersRaw ?? []) as BillMemberWithProfile[],
    ownerProfile: (ownerProfileRaw ?? {
      id: bill.owner_id,
      email: null,
      display_name: 'Owner',
    }) as Profile,
  };
}
