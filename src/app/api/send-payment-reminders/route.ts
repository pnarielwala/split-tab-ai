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

  // Ownership check
  const { data: bill } = await supabase
    .from("bills")
    .select("id, name, owner_id")
    .eq("id", billId)
    .single();

  if (!bill) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  }
  if (bill.owner_id !== user.id) {
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

  // Fetch owner's payment methods
  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("display_name, venmo_handle, zelle_id, cashapp_handle, paypal_id")
    .eq("id", user.id)
    .single();

  const methods: PaymentMethods = {
    venmo_handle: ownerProfile?.venmo_handle ?? null,
    zelle_id: ownerProfile?.zelle_id ?? null,
    cashapp_handle: ownerProfile?.cashapp_handle ?? null,
    paypal_id: ownerProfile?.paypal_id ?? null,
  };

  const hasPaymentMethod =
    methods.venmo_handle ||
    methods.zelle_id ||
    methods.cashapp_handle ||
    methods.paypal_id;

  if (!hasPaymentMethod) {
    return NextResponse.json({ error: "no_payment_methods" }, { status: 400 });
  }

  const ownerName = ownerProfile?.display_name ?? "Your friend";
  const sharesMap = new Map(pageData.shares.map((s) => [s.userId, s]));

  let sent = 0;

  for (const memberRaw of membersRaw ?? []) {
    // Skip owner
    if (memberRaw.user_id === user.id) continue;

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
