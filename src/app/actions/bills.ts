'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

// ── Create placeholder bill (no form — auto-redirects to upload) ──────────────

export async function createPlaceholderBill(): Promise<{ billId: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: bill, error } = await supabase
    .from('bills')
    .insert({ owner_id: user.id, payer_id: user.id, name: 'New Bill' })
    .select()
    .single();

  if (error) return { error: error.message };
  return { billId: bill.id };
}

// ── Update bill name + description (from verify page) ─────────────────────────

const updateBillDetailsSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
});

export async function updateBillDetails(billId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'Unauthorized' };

  const parsed = updateBillDetailsSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description') || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const { error } = await supabase
    .from('bills')
    .update({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
    })
    .eq('id', billId)
    .eq('owner_id', user.id);

  if (error) return { error: error.message };

  revalidatePath(`/bills/${billId}/verify`);
  revalidatePath(`/bills/${billId}`);
  return { success: true };
}

// ── Create bill ──────────────────────────────────────────────────────────────

const createBillSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
});

export async function createBill(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const parsed = createBillSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description') || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const { data: bill, error } = await supabase
    .from('bills')
    .insert({
      owner_id: user.id,
      payer_id: user.id,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  redirect(`/bills/${bill.id}/upload`);
}

// ── Update receipt info on bill after upload ──────────────────────────────────

export async function updateBillReceipt(
  billId: string,
  receiptPath: string,
  receiptUrl: string
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('bills')
    .update({
      receipt_path: receiptPath,
      receipt_url: receiptUrl,
      status: 'uploaded',
    })
    .eq('id', billId);

  if (error) throw new Error(error.message);
  revalidatePath(`/bills/${billId}`);
}

// ── Update line item ──────────────────────────────────────────────────────────

export async function updateLineItem(
  itemId: string,
  billId: string,
  data: {
    name?: string;
    quantity?: number;
    unit_price?: number;
    total_price?: number;
  }
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('line_items')
    .update(data)
    .eq('id', itemId);

  if (error) throw new Error(error.message);
  revalidatePath(`/bills/${billId}/verify`);
}

// ── Delete line item ──────────────────────────────────────────────────────────

export async function deleteLineItem(itemId: string, billId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('line_items').delete().eq('id', itemId);

  if (error) throw new Error(error.message);
  revalidatePath(`/bills/${billId}/verify`);
}

// ── Split line item ───────────────────────────────────────────────────────────

export async function splitLineItem(itemId: string, billId: string, names: string[]) {
  const supabase = await createClient();

  const { data: original, error: fetchErr } = await supabase
    .from('line_items')
    .select('*')
    .eq('id', itemId)
    .single();
  if (fetchErr || !original) throw new Error('Item not found');

  const count = names.length;
  const basePrice = Math.floor((original.unit_price / count) * 100) / 100;
  const remainder = Math.round((original.unit_price - basePrice * count) * 100) / 100;

  const { data: laterItems } = await supabase
    .from('line_items')
    .select('id, sort_order')
    .eq('bill_id', billId)
    .gt('sort_order', original.sort_order);

  await supabase.from('line_items').delete().eq('id', itemId);

  if (laterItems?.length) {
    for (const row of laterItems) {
      await supabase
        .from('line_items')
        .update({ sort_order: row.sort_order + count - 1 })
        .eq('id', row.id);
    }
  }

  const inserts = names.map((name, i) => {
    const price = i === count - 1 ? basePrice + remainder : basePrice;
    return {
      bill_id: billId,
      name,
      quantity: 1,
      unit_price: price,
      total_price: price,
      sort_order: original.sort_order + i,
    };
  });

  const { error: insertErr } = await supabase.from('line_items').insert(inserts);
  if (insertErr) throw new Error(insertErr.message);

  revalidatePath(`/bills/${billId}/verify`);
}

// ── Add line item ─────────────────────────────────────────────────────────────

export async function addLineItem(
  billId: string,
  data: {
    name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    sort_order: number;
  }
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('line_items')
    .insert({ bill_id: billId, ...data });

  if (error) throw new Error(error.message);
  revalidatePath(`/bills/${billId}/verify`);
}

// ── Update bill totals ────────────────────────────────────────────────────────

export async function updateBillTotals(
  billId: string,
  totals: {
    subtotal?: number | null;
    tax?: number | null;
    gratuity?: number | null;
    fees?: number | null;
    discounts?: number | null;
    total?: number | null;
    currency?: string;
  }
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('bill_totals')
    .upsert({ bill_id: billId, ...totals });

  if (error) throw new Error(error.message);
  revalidatePath(`/bills/${billId}/verify`);
}

// ── Clear parsed data (for re-parse) ─────────────────────────────────────────

export async function clearBillParseData(billId: string) {
  const supabase = await createClient();
  await supabase.from('line_items').delete().eq('bill_id', billId);
  await supabase.from('bill_totals').delete().eq('bill_id', billId);
  const { error } = await supabase
    .from('bills')
    .update({ status: 'uploaded' })
    .eq('id', billId);
  if (error) throw new Error(error.message);
}

// ── Confirm bill (set status → verified) ─────────────────────────────────────

export async function confirmBill(billId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('bills')
    .update({ status: 'verified' })
    .eq('id', billId);

  if (error) throw new Error(error.message);
  revalidatePath(`/bills/${billId}`);
  redirect(`/bills/${billId}?created=1`);
}

// ── Delete bill ───────────────────────────────────────────────────────────────

export async function deleteBill(billId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('bills').delete().eq('id', billId);

  if (error) throw new Error(error.message);
  revalidatePath('/dashboard');
  redirect('/dashboard');
}

// ── Join bill ─────────────────────────────────────────────────────────────────

export async function joinBill(billId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // If owner, skip insert and go straight to split
  const { data: bill } = await supabase
    .from('bills')
    .select('owner_id')
    .eq('id', billId)
    .single();

  if (!bill) return { error: 'Bill not found' };

  if (bill.owner_id !== user.id) {
    const { error } = await supabase
      .from('bill_members')
      .insert({ bill_id: billId, user_id: user.id });

    // 23505 = unique_violation (already a member) — that's fine
    if (error && error.code !== '23505') return { error: error.message };
  }
  revalidatePath(`/bills/${billId}`);
  redirect(`/bills/${billId}?joined=1`);
}

// ── Add guest ─────────────────────────────────────────────────────────────────

export async function addGuest(
  billId: string,
  name: string
): Promise<{ id: string; name: string; sponsored_by: string; bill_id: string; created_at: string } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const trimmed = name.trim();
  if (!trimmed) return { error: 'Name is required' };

  const { data, error } = await supabase
    .from('bill_guests')
    .insert({ bill_id: billId, name: trimmed, sponsored_by: user.id })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath(`/bills/${billId}`);
  return data;
}

// ── Remove guest ──────────────────────────────────────────────────────────────

export async function removeGuest(
  guestId: string,
  billId: string
): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { error } = await supabase
    .from('bill_guests')
    .delete()
    .eq('id', guestId)
    .eq('sponsored_by', user.id);

  if (error) return { error: error.message };
  revalidatePath(`/bills/${billId}`);
  return { success: true };
}

// ── Claim item ────────────────────────────────────────────────────────────────

export async function claimItem(itemId: string, billId: string, guestId?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Delete+insert for all claims — avoids ON CONFLICT with partial indexes
  // (migration 0015 drops the full unique constraint; PostgREST can't resolve partial indexes)
  if (guestId) {
    await supabase
      .from('bill_item_claims')
      .delete()
      .eq('item_id', itemId)
      .eq('guest_id', guestId);
    const { error } = await supabase
      .from('bill_item_claims')
      .insert({ item_id: itemId, guest_id: guestId, user_id: null });
    if (error) throw new Error(error.message);
  } else {
    await supabase
      .from('bill_item_claims')
      .delete()
      .eq('item_id', itemId)
      .eq('user_id', user.id);
    const { error } = await supabase
      .from('bill_item_claims')
      .insert({ item_id: itemId, user_id: user.id });
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/bills/${billId}/split`);
}

// ── Update bill payer ─────────────────────────────────────────────────────────

export async function updateBillPayer(
  billId: string,
  newPayerUserId: string
): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'Unauthorized' };

  // Verify current user is the owner
  const { data: bill } = await supabase
    .from('bills')
    .select('owner_id')
    .eq('id', billId)
    .eq('owner_id', user.id)
    .single();

  if (!bill) return { error: 'Bill not found or not authorized' };

  // Verify new payer is a participant (owner or member)
  if (newPayerUserId !== bill.owner_id) {
    const { data: membership } = await supabase
      .from('bill_members')
      .select('id')
      .eq('bill_id', billId)
      .eq('user_id', newPayerUserId)
      .single();

    if (!membership) return { error: 'User is not a participant on this bill' };
  }

  const { error } = await supabase
    .from('bills')
    .update({ payer_id: newPayerUserId })
    .eq('id', billId)
    .eq('owner_id', user.id);

  if (error) return { error: error.message };

  revalidatePath(`/bills/${billId}`);
  return { success: true };
}

// ── Mark as paid ─────────────────────────────────────────────────────────────

export async function markAsPaid(
  billId: string,
  userId?: string
): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'Unauthorized' };

  const targetUserId = userId ?? user.id;

  // If marking someone else, verify current user is the payer
  if (targetUserId !== user.id) {
    const { data: bill } = await supabase
      .from('bills')
      .select('payer_id')
      .eq('id', billId)
      .single();
    if (!bill || bill.payer_id !== user.id) {
      return { error: 'Only the payer can mark others as paid' };
    }
  }

  const { error } = await supabase
    .from('bill_payments')
    .insert({ bill_id: billId, user_id: targetUserId });

  // 23505 = unique_violation (already marked paid) — that's fine
  if (error && error.code !== '23505') return { error: error.message };
  return { success: true };
}

// ── Mark as unpaid ────────────────────────────────────────────────────────────

export async function markAsUnpaid(
  billId: string,
  userId: string
): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'Unauthorized' };

  // If unmarking someone else, verify current user is the payer
  if (userId !== user.id) {
    const { data: bill } = await supabase
      .from('bills')
      .select('payer_id')
      .eq('id', billId)
      .single();
    if (!bill || bill.payer_id !== user.id) {
      return { error: 'Only the payer can unmark others as paid' };
    }
  }

  const { error } = await supabase
    .from('bill_payments')
    .delete()
    .eq('bill_id', billId)
    .eq('user_id', userId);

  if (error) return { error: error.message };
  return { success: true };
}

// ── Set claimed quantity (quantity=0 removes claim) ───────────────────────────

export async function setClaimedQuantity(itemId: string, billId: string, quantity: number, guestId?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  if (guestId) {
    // Guest claims: delete then re-insert (avoids partial index upsert issues)
    await supabase
      .from('bill_item_claims')
      .delete()
      .eq('item_id', itemId)
      .eq('guest_id', guestId);
    if (quantity > 0) {
      const { error } = await supabase
        .from('bill_item_claims')
        .insert({ item_id: itemId, guest_id: guestId, user_id: null, quantity_claimed: quantity });
      if (error) throw new Error(error.message);
    }
  } else {
    // Delete then re-insert — avoids ON CONFLICT with partial indexes
    await supabase
      .from('bill_item_claims')
      .delete()
      .eq('item_id', itemId)
      .eq('user_id', user.id);
    if (quantity > 0) {
      const { error } = await supabase
        .from('bill_item_claims')
        .insert({ item_id: itemId, user_id: user.id, quantity_claimed: quantity });
      if (error) throw new Error(error.message);
    }
  }

  revalidatePath(`/bills/${billId}/split`);
}

// ── Unlock bill ───────────────────────────────────────────────────────────────

export async function unlockBill(
  billId: string
): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'Unauthorized' };

  const { error } = await supabase
    .from('bills')
    .update({ status: 'verified' })
    .eq('id', billId)
    .eq('owner_id', user.id)
    .eq('status', 'locked');

  if (error) return { error: error.message };
  revalidatePath(`/bills/${billId}`);
  return { success: true };
}

// ── Mark member done ──────────────────────────────────────────────────────────

export async function markMemberDone(
  billId: string,
  isDone: boolean
): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'Unauthorized' };

  // Guard: bill must be verified (not locked)
  const { data: bill } = await supabase
    .from('bills')
    .select('owner_id, status')
    .eq('id', billId)
    .single();

  if (!bill) return { error: 'Bill not found' };
  if (bill.owner_id === user.id) return { error: 'Owner does not need to mark done' };
  if (bill.status === 'locked') return { error: 'Bill is locked' };

  const { error } = await supabase
    .from('bill_members')
    .update({ is_done: isDone })
    .eq('bill_id', billId)
    .eq('user_id', user.id);

  if (error) return { error: error.message };
  revalidatePath(`/bills/${billId}`);
  return { success: true };
}

// ── Lock bill ─────────────────────────────────────────────────────────────────

export async function lockBill(
  billId: string
): Promise<{ error: string; unclaimedItems?: { name: string; unclaimed: number }[] } | { success: true }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'Unauthorized' };

  // Verify owner and status
  const { data: bill } = await supabase
    .from('bills')
    .select('owner_id, status')
    .eq('id', billId)
    .eq('owner_id', user.id)
    .single();

  if (!bill) return { error: 'Bill not found or not authorized' };
  if (bill.status !== 'verified') return { error: 'Bill must be verified before locking' };

  // Check all members are done
  const { data: members } = await supabase
    .from('bill_members')
    .select('user_id, is_done')
    .eq('bill_id', billId);

  const notDone = (members ?? []).filter((m) => !m.is_done);
  if (notDone.length > 0) return { error: 'Not all members are done claiming' };

  // Check all line items are fully claimed
  const { data: lineItems } = await supabase
    .from('line_items')
    .select('id, name, quantity, bill_item_claims(quantity_claimed)')
    .eq('bill_id', billId);

  const unclaimed = (lineItems ?? []).filter((item) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const claims = (item as any).bill_item_claims as { quantity_claimed: number }[] ?? [];
    const totalClaimed = claims.reduce((sum, c) => sum + c.quantity_claimed, 0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return totalClaimed < (item as any).quantity;
  });

  if (unclaimed.length > 0) {
    return {
      error: 'unclaimed_items',
      unclaimedItems: unclaimed.map((item) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const claims = (item as any).bill_item_claims as { quantity_claimed: number }[] ?? [];
        const totalClaimed = claims.reduce((sum, c) => sum + c.quantity_claimed, 0);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return { name: item.name, unclaimed: (item as any).quantity - totalClaimed };
      }),
    };
  }

  const { error } = await supabase
    .from('bills')
    .update({ status: 'locked' })
    .eq('id', billId)
    .eq('owner_id', user.id);

  if (error) return { error: error.message };
  revalidatePath(`/bills/${billId}`);
  return { success: true };
}

// ── Archive / unarchive bill ──────────────────────────────────────────────────

export async function archiveBill(billId: string): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { error } = await supabase
    .from('bill_archives')
    .insert({ bill_id: billId, user_id: user.id });

  if (error && error.code !== '23505') return { error: error.message };
  revalidatePath('/dashboard');
  return { success: true };
}

export async function unarchiveBill(billId: string): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { error } = await supabase
    .from('bill_archives')
    .delete()
    .eq('bill_id', billId)
    .eq('user_id', user.id);

  if (error) return { error: error.message };
  revalidatePath('/dashboard');
  return { success: true };
}

// ── Unclaim item ──────────────────────────────────────────────────────────────

export async function unclaimItem(itemId: string, billId: string, guestId?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  if (guestId) {
    const { error } = await supabase
      .from('bill_item_claims')
      .delete()
      .eq('item_id', itemId)
      .eq('guest_id', guestId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from('bill_item_claims')
      .delete()
      .eq('item_id', itemId)
      .eq('user_id', user.id);
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/bills/${billId}/split`);
}
