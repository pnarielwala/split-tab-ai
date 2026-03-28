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
import type { PaymentMethods } from '@/lib/notifications/types';

export type DashboardBill = Bill & { bill_totals: BillTotal | null; owner_display_name?: string; member_count?: number };

export type BillPageData = {
  lineItems: LineItemWithClaims[];
  totals: BillTotal | null;
  members: BillMemberWithProfile[];
  ownerProfile: Profile;
  shares: ParticipantShare[];
  paidUserIds: string[];
  payerId: string;
};

export type SplitPageData = {
  lineItems: LineItemWithClaims[];
  totals: BillTotal | null;
  members: BillMemberWithProfile[];
  ownerProfile: Profile;
  ownerPaymentMethods: PaymentMethods | null;
  payerProfile: Profile;
  payerPaymentMethods: PaymentMethods | null;
  paidUserIds: string[];
  shares: ParticipantShare[];
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

  const joinedOwnerIds = Array.from(billMap.values())
    .filter((b) => b.owner_id !== currentUserId)
    .map((b) => b.owner_id);

  if (joinedOwnerIds.length > 0) {
    const { data: ownerProfiles } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', joinedOwnerIds);
    const profileMap = new Map((ownerProfiles ?? []).map((p) => [p.id, p.display_name]));
    for (const bill of billMap.values()) {
      if (bill.owner_id !== currentUserId) {
        bill.owner_display_name = profileMap.get(bill.owner_id);
      }
    }
  }

  const verifiedBillIds = Array.from(billMap.values())
    .filter((b) => b.status === 'verified')
    .map((b) => b.id);

  if (verifiedBillIds.length > 0) {
    const { data: memberRows } = await supabase
      .from('bill_members')
      .select('bill_id')
      .in('bill_id', verifiedBillIds);
    const memberCountMap = new Map<string, number>();
    for (const row of memberRows ?? []) {
      memberCountMap.set(row.bill_id, (memberCountMap.get(row.bill_id) ?? 0) + 1);
    }
    for (const bill of billMap.values()) {
      if (bill.status === 'verified') {
        bill.member_count = (memberCountMap.get(bill.id) ?? 0) + 1; // +1 for owner
      }
    }
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const billAny = bill as any;
  const payerId: string = billAny.payer_id ?? bill.owner_id;

  const [
    { data: lineItemsRaw },
    { data: totals },
    { data: membersRaw },
    { data: ownerProfile },
    { data: paymentsRaw },
  ] = await Promise.all([
    supabase
      .from('line_items')
      .select('*, bill_item_claims(*, profiles(*))')
      .eq('bill_id', billId)
      .order('sort_order', { ascending: true }),
    supabase.from('bill_totals').select('*').eq('bill_id', billId).single(),
    supabase.from('bill_members').select('*, profiles(*)').eq('bill_id', billId),
    supabase.from('profiles').select('*').eq('id', bill.owner_id).single(),
    supabase.from('bill_payments').select('user_id').eq('bill_id', billId),
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
  const billFees = totals?.fees ?? 0;
  const billDiscounts = totals?.discounts ?? 0;
  const subtotals = new Map<string, number>();
  for (const item of lineItems) {
    if (item.bill_item_claims.length === 0) continue;
    for (const claim of item.bill_item_claims) {
      const share = item.quantity > 1
        ? (claim.quantity_claimed / item.quantity) * item.total_price
        : item.total_price / item.bill_item_claims.length;
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
      fees: billFees * ratio,
      discounts: billDiscounts * ratio,
      total: sub + billTax * ratio + billGratuity * ratio + billFees * ratio - billDiscounts * ratio,
    });
  }
  shares.sort((a, b) => b.total - a.total);

  const paidUserIds = (paymentsRaw ?? []).map((p) => p.user_id);

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
    paidUserIds,
    payerId,
  };
}

function extractPaymentMethods(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  profileRaw: any
): PaymentMethods | null {
  if (!profileRaw) return null;
  return {
    venmo_handle: profileRaw.venmo_handle ?? null,
    zelle_id: profileRaw.zelle_id ?? null,
    cashapp_handle: profileRaw.cashapp_handle ?? null,
    paypal_id: profileRaw.paypal_id ?? null,
  };
}

export async function getSplitPageData(billId: string): Promise<SplitPageData | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: bill } = await supabase
    .from('bills')
    .select('owner_id, payer_id')
    .eq('id', billId)
    .single();
  if (!bill) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const billData = bill as any;
  const ownerId: string = billData.owner_id;
  const payerId: string = billData.payer_id ?? ownerId;
  const payerDiffersFromOwner = payerId !== ownerId;

  const fetchPayerProfile = payerDiffersFromOwner
    ? supabase.from('profiles').select('*').eq('id', payerId).single()
    : Promise.resolve({ data: null });

  const [
    { data: lineItemsRaw },
    { data: totals },
    { data: membersRaw },
    { data: ownerProfileRaw },
    { data: payerProfileRawMaybe },
    { data: paymentsRaw },
  ] = await Promise.all([
    supabase
      .from('line_items')
      .select('*, bill_item_claims(*, profiles(*))')
      .eq('bill_id', billId)
      .order('sort_order', { ascending: true }),
    supabase.from('bill_totals').select('*').eq('bill_id', billId).single(),
    supabase.from('bill_members').select('*, profiles(*)').eq('bill_id', billId),
    supabase.from('profiles').select('*').eq('id', ownerId).single(),
    fetchPayerProfile,
    supabase.from('bill_payments').select('user_id').eq('bill_id', billId),
  ]);

  const ownerPaymentMethods = extractPaymentMethods(ownerProfileRaw);

  const ownerProfile: Profile = (ownerProfileRaw ?? {
    id: ownerId,
    email: null,
    display_name: 'Owner',
  }) as Profile;

  let payerProfile: Profile;
  let payerPaymentMethods: PaymentMethods | null;

  if (payerDiffersFromOwner && payerProfileRawMaybe) {
    payerProfile = payerProfileRawMaybe as Profile;
    payerPaymentMethods = extractPaymentMethods(payerProfileRawMaybe);
  } else {
    payerProfile = ownerProfile;
    payerPaymentMethods = ownerPaymentMethods;
  }

  const paidUserIds = (paymentsRaw ?? []).map((p) => p.user_id);

  const lineItems = (lineItemsRaw ?? []) as LineItemWithClaims[];
  const members = (membersRaw ?? []) as BillMemberWithProfile[];

  const billSubtotal = totals?.subtotal ?? 0;
  const billTax = totals?.tax ?? 0;
  const billGratuity = totals?.gratuity ?? 0;
  const billFees = totals?.fees ?? 0;
  const billDiscounts = totals?.discounts ?? 0;
  const participantMap = new Map<string, string>();
  participantMap.set(ownerId, ownerProfile.display_name);
  for (const m of members) {
    participantMap.set(m.user_id, m.profiles.display_name);
  }
  const subtotals = new Map<string, number>();
  for (const item of lineItems) {
    if (item.bill_item_claims.length === 0) continue;
    for (const claim of item.bill_item_claims) {
      const share = item.quantity > 1
        ? (claim.quantity_claimed / item.quantity) * item.total_price
        : item.total_price / item.bill_item_claims.length;
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
      fees: billFees * ratio,
      discounts: billDiscounts * ratio,
      total: sub + billTax * ratio + billGratuity * ratio + billFees * ratio - billDiscounts * ratio,
    });
  }

  return {
    lineItems,
    totals: totals ?? null,
    members,
    ownerProfile,
    ownerPaymentMethods,
    payerProfile,
    payerPaymentMethods,
    paidUserIds,
    shares,
  };
}
