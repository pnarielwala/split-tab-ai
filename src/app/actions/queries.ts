'use server';

import { createClient } from '@/lib/supabase/server';
import type {
  Bill,
  BillTotal,
  LineItemWithClaims,
  BillMemberWithProfile,
  BillGuest,
  Profile,
  ParticipantShare,
} from '@/types/database';
import type { PaymentMethods } from '@/lib/notifications/types';

export type DashboardBill = Bill & {
  bill_totals: BillTotal | null;
  owner_display_name?: string;
  member_count?: number;
  is_archived: boolean;
  contextual_status?: 'items_to_claim' | 'ready_to_claim' | 'waiting_for_lock' | 'unpaid' | 'awaiting_payments' | 'paid' | 'settled';
};

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
  isLocked: boolean;
  memberDoneStatuses: { userId: string; isDone: boolean }[];
  guests: BillGuest[];
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
    billMap.set(bill.id, { ...bill, bill_totals: totals, is_archived: false });
  }

  for (const m of memberships ?? []) {
    const bill = (m.bills as unknown) as
      | (Bill & { bill_totals: BillTotal | BillTotal[] | null })
      | null;
    if (!bill || billMap.has(bill.id)) continue;
    const totals = Array.isArray(bill.bill_totals)
      ? (bill.bill_totals[0] ?? null)
      : bill.bill_totals;
    billMap.set(bill.id, { ...bill, bill_totals: totals, is_archived: false });
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

  const verifiedOrLockedBillIds = Array.from(billMap.values())
    .filter((b) => b.status === 'verified' || b.status === 'locked')
    .map((b) => b.id);

  if (verifiedOrLockedBillIds.length > 0) {
    const { data: memberRows } = await supabase
      .from('bill_members')
      .select('bill_id')
      .in('bill_id', verifiedOrLockedBillIds);
    const memberCountMap = new Map<string, number>();
    for (const row of memberRows ?? []) {
      memberCountMap.set(row.bill_id, (memberCountMap.get(row.bill_id) ?? 0) + 1);
    }
    for (const bill of billMap.values()) {
      if (bill.status === 'verified' || bill.status === 'locked') {
        bill.member_count = (memberCountMap.get(bill.id) ?? 0) + 1; // +1 for owner
      }
    }

    // Fetch contextual status data in parallel
    const ownerBillIds = Array.from(billMap.values())
      .filter((b) => (b.status === 'verified' || b.status === 'locked') && b.owner_id === currentUserId)
      .map((b) => b.id);

    const ownerClaimsQuery = ownerBillIds.length > 0
      ? supabase
          .from('bill_item_claims')
          .select('item_id, line_items!inner(bill_id)')
          .eq('user_id', currentUserId)
          .in('line_items.bill_id', ownerBillIds)
      : null;

    const [
      { data: userPaymentRows },
      { data: userMemberRows },
      { data: allPaymentRows },
      ownerClaimsResult,
    ] = await Promise.all([
      supabase
        .from('bill_payments')
        .select('bill_id')
        .eq('user_id', currentUserId)
        .in('bill_id', verifiedOrLockedBillIds),
      supabase
        .from('bill_members')
        .select('bill_id, is_done')
        .eq('user_id', currentUserId)
        .in('bill_id', verifiedOrLockedBillIds),
      supabase
        .from('bill_payments')
        .select('bill_id')
        .in('bill_id', verifiedOrLockedBillIds),
      ownerClaimsQuery ?? Promise.resolve({ data: null }),
    ]);
    const ownerClaimRows = ownerClaimsResult.data;

    const paidBillIds = new Set((userPaymentRows ?? []).map((r) => r.bill_id));
    const doneMap = new Map((userMemberRows ?? []).map((r) => [r.bill_id, (r as unknown as { bill_id: string; is_done: boolean }).is_done]));
    const paidCountMap = new Map<string, number>();
    for (const row of allPaymentRows ?? []) {
      paidCountMap.set(row.bill_id, (paidCountMap.get(row.bill_id) ?? 0) + 1);
    }
    const ownerClaimedBillIds = new Set(
      (ownerClaimRows ?? []).map((r) => (r as unknown as { line_items: { bill_id: string } }).line_items.bill_id)
    );

    for (const bill of billMap.values()) {
      if (bill.status !== 'verified' && bill.status !== 'locked') continue;
      const isOwner = bill.owner_id === currentUserId;
      if (isOwner) {
        if (!ownerClaimedBillIds.has(bill.id)) {
          bill.contextual_status = 'items_to_claim';
        } else {
          const memberCount = (bill.member_count ?? 1) - 1; // subtract owner
          const paidCount = paidCountMap.get(bill.id) ?? 0;
          bill.contextual_status = memberCount > 0 && paidCount >= memberCount ? 'settled' : 'awaiting_payments';
        }
      } else {
        if (paidBillIds.has(bill.id)) {
          bill.contextual_status = 'paid';
        } else if (doneMap.get(bill.id)) {
          bill.contextual_status = bill.status === 'locked' ? 'unpaid' : 'waiting_for_lock';
        } else {
          bill.contextual_status = 'ready_to_claim';
        }
      }
    }
  }

  // Fetch archive state for current user (RLS filters to auth.uid() automatically)
  const allBillIds = Array.from(billMap.keys());
  if (allBillIds.length > 0) {
    const { data: archiveRows } = await supabase
      .from('bill_archives')
      .select('bill_id')
      .in('bill_id', allBillIds);
    const archivedSet = new Set((archiveRows ?? []).map((r) => r.bill_id));
    for (const bill of billMap.values()) {
      bill.is_archived = archivedSet.has(bill.id);
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
    { data: guestsRaw },
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
    // Fetched in parallel — returns {data: null, error} if migration not yet run (safe)
    supabase.from('bill_guests').select('*').eq('bill_id', billId),
  ]);

  const lineItems = (lineItemsRaw ?? []) as LineItemWithClaims[];
  const members = (membersRaw ?? []) as BillMemberWithProfile[];
  const guests = (guestsRaw ?? []) as BillGuest[];

  const guestSponsorMap = new Map<string, string>();
  for (const g of guests) guestSponsorMap.set(g.id, g.sponsored_by);

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
      const claimerId = claim.user_id ?? guestSponsorMap.get(claim.guest_id!)!;
      if (!claimerId) continue;
      const share = item.quantity > 1
        ? (claim.quantity_claimed / item.quantity) * item.total_price
        : item.total_price / item.bill_item_claims.length;
      subtotals.set(claimerId, (subtotals.get(claimerId) ?? 0) + share);
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
    .select('owner_id, payer_id, status')
    .eq('id', billId)
    .single();
  if (!bill) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const billData = bill as any;
  const ownerId: string = billData.owner_id;
  const payerId: string = billData.payer_id ?? ownerId;
  const isLocked: boolean = billData.status === 'locked';
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
    { data: guestsRaw },
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
    // Returns {data: null, error} if migration not yet run — safe to include in parallel
    supabase.from('bill_guests').select('*').eq('bill_id', billId),
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
  const guests = (guestsRaw ?? []) as BillGuest[];

  // Build guestId → sponsorUserId map for cost rollup
  const guestSponsorMap = new Map<string, string>();
  for (const guest of guests) {
    guestSponsorMap.set(guest.id, guest.sponsored_by);
  }

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
      // Guest claims roll up to the sponsor's userId
      const claimerId = claim.user_id ?? guestSponsorMap.get(claim.guest_id!)!;
      if (!claimerId) continue;
      const share = item.quantity > 1
        ? (claim.quantity_claimed / item.quantity) * item.total_price
        : item.total_price / item.bill_item_claims.length;
      subtotals.set(claimerId, (subtotals.get(claimerId) ?? 0) + share);
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
    isLocked,
    memberDoneStatuses: members.map((m) => ({ userId: m.user_id, isDone: (m as unknown as { is_done: boolean }).is_done ?? false })),
    guests,
  };
}
