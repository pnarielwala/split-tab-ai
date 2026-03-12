import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBillPageData } from "@/app/actions/queries";
import { sendReminder } from "@/lib/notifications";
import type { PaymentMethods } from "@/lib/notifications";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { billId: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { billId } = body;
  if (!billId) {
    return NextResponse.json({ error: "Missing billId" }, { status: 400 });
  }

  // Payer check (only the payer can request payment)
  const { data: bill } = await supabase
    .from("bills")
    .select("id, name, owner_id, payer_id")
    .eq("id", billId)
    .single();

  if (!bill) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const billData = bill as any;
  const payerId: string = billData.payer_id ?? billData.owner_id;

  if (payerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get per-person shares via existing helper
  const pageData = await getBillPageData(billId);
  if (!pageData) {
    return NextResponse.json({ error: "Failed to load bill data" }, { status: 500 });
  }

  // Fetch member emails
  const { data: membersRaw } = await supabase
    .from("bill_members")
    .select("user_id, profiles(email, display_name)")
    .eq("bill_id", billId);

  // Fetch payer's payment methods
  const { data: payerProfile } = await supabase
    .from("profiles")
    .select("display_name, venmo_handle, zelle_id, cashapp_handle, paypal_id")
    .eq("id", payerId)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payerRaw = payerProfile as any;

  const methods: PaymentMethods = {
    venmo_handle: payerRaw?.venmo_handle ?? null,
    zelle_id: payerRaw?.zelle_id ?? null,
    cashapp_handle: payerRaw?.cashapp_handle ?? null,
    paypal_id: payerRaw?.paypal_id ?? null,
  };

  const hasPaymentMethod =
    methods.venmo_handle ||
    methods.zelle_id ||
    methods.cashapp_handle ||
    methods.paypal_id;

  if (!hasPaymentMethod) {
    return NextResponse.json({ error: "no_payment_methods" }, { status: 400 });
  }

  const ownerName = payerRaw?.display_name ?? "Your friend";
  const sharesMap = new Map(pageData.shares.map((s) => [s.userId, s]));

  let sent = 0;

  for (const memberRaw of membersRaw ?? []) {
    // Skip the payer (they don't owe themselves)
    if (memberRaw.user_id === payerId) continue;

    const profile = (memberRaw.profiles as unknown) as {
      email: string | null;
      display_name: string;
    } | null;

    const email = profile?.email;
    if (!email) continue;

    const share = sharesMap.get(memberRaw.user_id);
    if (!share || share.total <= 0) continue;

    const ok = await sendReminder({
      channel: "email",
      recipientName: profile?.display_name ?? "there",
      recipientContact: email,
      ownerName,
      billName: bill.name,
      amount: share.total,
      paymentMethods: methods,
    });

    if (ok) sent++;
  }

  return NextResponse.json({ sent });
}
