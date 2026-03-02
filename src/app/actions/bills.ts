'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

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

// ── Confirm bill (set status → verified) ─────────────────────────────────────

export async function confirmBill(billId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('bills')
    .update({ status: 'verified' })
    .eq('id', billId);

  if (error) throw new Error(error.message);
  revalidatePath(`/bills/${billId}`);
  redirect(`/bills/${billId}`);
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
  revalidatePath(`/bills/${billId}/split`);
  redirect(`/bills/${billId}/split`);
}

// ── Claim item ────────────────────────────────────────────────────────────────

export async function claimItem(itemId: string, billId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { error } = await supabase
    .from('bill_item_claims')
    .upsert(
      { item_id: itemId, user_id: user.id },
      { onConflict: 'item_id,user_id' }
    );

  if (error) throw new Error(error.message);
  revalidatePath(`/bills/${billId}/split`);
}

// ── Unclaim item ──────────────────────────────────────────────────────────────

export async function unclaimItem(itemId: string, billId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { error } = await supabase
    .from('bill_item_claims')
    .delete()
    .eq('item_id', itemId)
    .eq('user_id', user.id);

  if (error) throw new Error(error.message);
  revalidatePath(`/bills/${billId}/split`);
}
