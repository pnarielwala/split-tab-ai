import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseReceiptImage } from "@/lib/model";

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
    const items = parsed.lineItems.map((item, i) => ({
      bill_id: billId,
      name: item.name,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total_price: item.totalPrice,
      sort_order: i,
    }));

    const { error: itemsError } = await supabase.from("line_items").insert(items);
    if (itemsError) {
      console.error("[parse-receipt] Line items insert error:", itemsError);
    }
  }

  // 7. Upsert bill totals
  const { error: totalsError } = await supabase.from("bill_totals").upsert({
    bill_id: billId,
    subtotal: parsed.subtotal,
    tax: parsed.tax,
    gratuity: parsed.gratuity,
    total: parsed.total,
    currency: parsed.currency ?? "USD",
  });

  if (totalsError) {
    console.error("[parse-receipt] Totals upsert error:", totalsError);
  }

  // 8. Update bill status → parsed
  await supabase.from("bills").update({ status: "parsed" }).eq("id", billId);

  return NextResponse.json({ success: true, parsed });
}
