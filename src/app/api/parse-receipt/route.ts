import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseReceiptImage } from "@/lib/model";
import { reconcileSubtotal } from "@/lib/reconcile";

export const maxDuration = 300; // 5 minutes for model cold start

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // 1. Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse request body
  let body: { billId: string; receiptPath: string; receiptUrl: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { billId, receiptPath, receiptUrl } = body;
  if (!billId || !receiptUrl) {
    return NextResponse.json({ error: "Missing billId or receiptUrl" }, { status: 400 });
  }

  // 3. Verify ownership (RLS will block unauthorized access, but explicit check gives clearer error)
  const { data: bill, error: billError } = await supabase
    .from("bills")
    .select("id, owner_id, status")
    .eq("id", billId)
    .single();

  if (billError || !bill) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  }

  // 4. Update bill with receipt info and set status → uploaded
  await supabase
    .from("bills")
    .update({ receipt_path: receiptPath, receipt_url: receiptUrl, status: "uploaded" })
    .eq("id", billId);

  // 5. Parse the receipt with the VLM
  let parsed;
  try {
    parsed = await parseReceiptImage(receiptUrl);
  } catch (err) {
    console.error("[parse-receipt] Model error:", err);
    return NextResponse.json(
      { error: "Receipt parsing failed. The AI model encountered an error." },
      { status: 500 }
    );
  }

  // 6. Insert line items
  if (parsed.lineItems.length > 0) {
    const items = parsed.lineItems.map((item, i) => {
      const qty = item.quantity ?? 1;
      const unitPrice =
        item.unitPrice ?? (item.totalPrice != null ? item.totalPrice / qty : 0);
      return {
        bill_id: billId,
        name: item.name,
        quantity: qty,
        unit_price: unitPrice,
        total_price: item.totalPrice ?? unitPrice * qty,
        sort_order: i,
      };
    });

    const { error: itemsError } = await supabase.from("line_items").insert(items);
    if (itemsError) {
      console.error("[parse-receipt] Line items insert error:", itemsError);
    }
  }

  // 7. Upsert bill totals.
  //
  // The stored subtotal is always the sum of the line items we actually saved,
  // so bill_totals stays consistent with line_items and with what the verify
  // screen shows. The parser's reading of the receipt's own printed subtotal is
  // kept separately on the bill (step 7a) so the two can be compared.
  const computedSubtotal = parsed.lineItems.reduce(
    (sum, item) => sum + (item.totalPrice ?? 0),
    0
  );
  const computedTotal =
    computedSubtotal + (parsed.tax ?? 0) + (parsed.gratuity ?? 0) + (parsed.fees ?? 0) - (parsed.discounts ?? 0);

  const { error: totalsError } = await supabase.from("bill_totals").upsert({
    bill_id: billId,
    subtotal: computedSubtotal,
    tax: parsed.tax,
    gratuity: parsed.gratuity,
    fees: parsed.fees,
    discounts: parsed.discounts,
    total: computedTotal,
    currency: parsed.currency ?? "USD",
  });

  if (totalsError) {
    console.error("[parse-receipt] Totals upsert error:", totalsError);
  }

  // 7a. Record the receipt's own printed totals and reconcile against the items.
  //
  // These two numbers are independent readings of the same quantity, so a
  // disagreement means the parse is wrong — a dropped row, a price column read
  // off by one, a misread digit. We store the printed reading rather than
  // correcting anything: we can't tell which of the two is the bad one, and
  // quietly reconciling them would hide a bad parse behind a plausible bill.
  // The verify screen surfaces the gap for a human to resolve.
  const reconciliation = reconcileSubtotal(computedSubtotal, parsed.subtotal);
  if (reconciliation.status === "mismatch") {
    console.warn(
      `[parse-receipt] Subtotal mismatch on bill ${billId}: ${parsed.lineItems.length} items sum to ${reconciliation.itemsSum}, receipt reads ${reconciliation.receiptSubtotal} (off by ${reconciliation.difference})`
    );
  }

  await supabase
    .from("bills")
    .update({ receipt_subtotal: parsed.subtotal, receipt_total: parsed.total })
    .eq("id", billId);

  // 8. Update bill status → parsed
  await supabase.from("bills").update({ status: "parsed" }).eq("id", billId);

  // 9. Update bill name from restaurant name if present
  if (parsed.restaurantName?.trim()) {
    await supabase
      .from("bills")
      .update({ name: parsed.restaurantName.trim() })
      .eq("id", billId);
  }

  return NextResponse.json({ success: true, parsed });
}
